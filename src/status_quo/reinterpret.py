"""Re-interpretation: re-run the current prompt version over the FULL
back-catalogue and diff against whatever was previously interpreted.

Sources raw incidents from the HuggingFace Parquet export
(`data/{provider}/{month}.parquet`), not SQLite — SQLite is a droppable
~30-60 day rolling window (see M03), so "full back-catalogue" only means
something if it reads from the durable, off-host store. Existing
interpretations (`interpretations/{provider}/{month}.parquet`) are read the
same way to build the "old" side of the diff.

This is a deliberate, manually-invoked operation (`status-quo reinterpret`),
not something the scheduled cycle runs implicitly — a prompt-version bump
in interpret.py plus running this is how a prompt change gets validated
across history before it's trusted to run forward.
"""

from __future__ import annotations

import json
import logging
import os
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory

import pyarrow.parquet as pq
from huggingface_hub import HfApi

from status_quo.interpret import PROMPT_VERSION, interpret_incident
from status_quo.observability import log_line

logger = logging.getLogger("status_quo.reinterpret")

HF_DATASET_REPO = os.environ.get("STATUS_QUO_HF_DATASET_REPO")
HF_TOKEN = os.environ.get("HF_TOKEN")

DIFF_FIELDS = ("title", "summary", "affected_surface", "fault_origin", "workaround_offered")


def _list_parquet_files(api: HfApi, dataset_repo: str, prefix: str) -> list[str]:
    all_files = api.list_repo_files(dataset_repo, repo_type="dataset")
    return [f for f in all_files if f.startswith(prefix) and f.endswith(".parquet")]


def _load_raw_incidents(api: HfApi, dataset_repo: str) -> list[dict]:
    """Dedups raw snapshot rows down to the latest known state of each
    resolved incident, across the entire durable dataset.
    """
    latest: dict[tuple[str, str], dict] = {}
    for remote_path in _list_parquet_files(api, dataset_repo, "data/"):
        local_path = api.hf_hub_download(repo_id=dataset_repo, repo_type="dataset", filename=remote_path)
        table = pq.read_table(local_path)
        for row in table.to_pylist():
            body = json.loads(row["body"]) if row["body"] else None
            if not body:
                continue
            for incident in body.get("incidents", []) or []:
                if incident.get("status") != "resolved":
                    continue
                key = (row["provider_id"], incident.get("id"))
                existing = latest.get(key)
                if existing is None or (incident.get("updated_at") or "") >= (existing["incident"].get("updated_at") or ""):
                    incident["_provider_id"] = row["provider_id"]
                    latest[key] = {"provider_id": row["provider_id"], "incident": incident}
    return list(latest.values())


def _load_existing_interpretations(api: HfApi, dataset_repo: str) -> dict[tuple[str, str], dict]:
    """Latest interpretation (by prompt_version, lexicographically) per
    (provider_id, incident_id) — the "old" side of the diff.
    """
    latest: dict[tuple[str, str], dict] = {}
    for remote_path in _list_parquet_files(api, dataset_repo, "interpretations/"):
        local_path = api.hf_hub_download(repo_id=dataset_repo, repo_type="dataset", filename=remote_path)
        table = pq.read_table(local_path)
        for row in table.to_pylist():
            key = (row["provider_id"], row["incident_id"])
            existing = latest.get(key)
            if existing is None or row["prompt_version"] > existing["prompt_version"]:
                latest[key] = row
    return latest


def run_reinterpretation(dataset_repo: str | None = None, sample_rate: float = 1.0) -> dict:
    """Re-runs PROMPT_VERSION over every resolved incident in the durable
    HuggingFace dataset, diffs against the previous interpretation (if any)
    per incident. Returns a summary dict; also writes a full diff report.
    """
    dataset_repo = dataset_repo or HF_DATASET_REPO
    if not dataset_repo:
        raise RuntimeError("STATUS_QUO_HF_DATASET_REPO is not set — refusing to re-interpret")

    api = HfApi(token=HF_TOKEN)
    with TemporaryDirectory():
        raw_entries = _load_raw_incidents(api, dataset_repo)
        old_interpretations = _load_existing_interpretations(api, dataset_repo)

    from status_quo.tracing import make_trace_fn

    trace_fn, flush_fn = make_trace_fn(PROMPT_VERSION, sample_rate=sample_rate)

    diffs = []
    errors = 0
    for entry in raw_entries:
        provider_id = entry["provider_id"]
        incident = entry["incident"]
        key = (provider_id, incident.get("id"))
        old = old_interpretations.get(key)

        try:
            new_record = interpret_incident(incident, trace_fn=trace_fn)
        except Exception as exc:
            logger.warning("reinterpretation failed for %s/%s: %s", provider_id, incident.get("id"), exc)
            errors += 1
            continue

        changed_fields = []
        if old is not None:
            for field in DIFF_FIELDS:
                if old.get(field) != new_record.get(field):
                    changed_fields.append(field)

        diffs.append({
            "provider_id": provider_id,
            "incident_id": incident.get("id"),
            "old_prompt_version": old["prompt_version"] if old else None,
            "new_prompt_version": PROMPT_VERSION,
            "changed_fields": changed_fields,
            "old": {f: old.get(f) for f in DIFF_FIELDS} if old else None,
            "new": {f: new_record.get(f) for f in DIFF_FIELDS},
        })

    flush_fn()
    n_changed = sum(1 for d in diffs if d["changed_fields"])
    n_new = sum(1 for d in diffs if d["old_prompt_version"] is None)

    report_path = Path(f"reinterpret_diff_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json")
    report_path.write_text(json.dumps({"diffs": diffs, "errors": errors}, indent=2))

    summary = {
        "total_incidents": len(raw_entries),
        "changed": n_changed,
        "newly_interpreted": n_new,
        "unchanged": len(diffs) - n_changed - n_new,
        "errors": errors,
        "report_path": str(report_path),
    }
    log_line(event="reinterpret_complete", **{k: v for k, v in summary.items() if k != "report_path"})
    return summary


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(json.dumps(run_reinterpretation(), indent=2))
