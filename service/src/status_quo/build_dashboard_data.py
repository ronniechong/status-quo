"""Builds the dashboard's static JSON data from the real HuggingFace
interpretation export. Runs inside the GitHub Actions build, never as
part of the collection/interpretation pipeline itself — this module has
no write path back to HuggingFace or SQLite, read-only by construction.

Ships row-level incident data rather than precomputed per-window
aggregates: the full dataset is tiny (currently ~500 rows, low
hundreds of KB), so client-side filtering/aggregation over an
already-loaded array is synchronous and instant — not the "live
computation" the UI/UX spec's non-negotiables warn against, which is
about the LLM never producing a number, not about browser arithmetic.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path

import pyarrow.parquet as pq
from huggingface_hub import HfApi

from status_quo.interpret import MODEL, PROMPT_VERSION, SCHEMA_VERSION
from status_quo.providers import PROVIDERS

logger = logging.getLogger("status_quo.build_dashboard_data")

HF_DATASET_REPO = os.environ.get("STATUS_QUO_HF_DATASET_REPO")
HF_TOKEN = os.environ.get("HF_TOKEN")

# Display names and status-page homepages are a dashboard-presentation
# concern, not a collection-pipeline one — kept here rather than in
# providers.py so this build never needs a pipeline redeploy to change.
PROVIDER_DISPLAY_NAMES = {
    "github": "GitHub",
    "cloudflare": "Cloudflare",
    "discord": "Discord",
    "reddit": "Reddit",
    "vercel": "Vercel",
    "linear": "Linear",
    "notion": "Notion",
    "netlify": "Netlify",
    "digitalocean": "DigitalOcean",
    "npm": "npm",
}

# Derived from each provider's already-configured API base URL — the
# status-page homepage is that URL with the API path stripped.
PROVIDER_STATUS_HOMEPAGES = {p.id: p.url.rsplit("/api/v2/incidents.json", 1)[0] for p in PROVIDERS}


def _list_parquet_files(api: HfApi, prefix: str) -> list[str]:
    all_files = api.list_repo_files(repo_id=HF_DATASET_REPO, repo_type="dataset")
    return [f for f in all_files if f.startswith(prefix) and f.endswith(".parquet")]


def _load_interpretations(api: HfApi) -> list[dict]:
    files = _list_parquet_files(api, "interpretations/")
    rows: list[dict] = []
    for f in files:
        local_path = api.hf_hub_download(repo_id=HF_DATASET_REPO, repo_type="dataset", filename=f)
        rows.extend(pq.read_table(local_path).to_pylist())
    # A given (incident_id, provider_id) can have rows at multiple
    # prompt_versions (older back-catalogue entries) or a stale open-incident
    # raw snapshot alongside a resolved interpretation for the same
    # incident_id if a delete_open_snapshot ever raced an export — the
    # highest interpreted_at_utc wins in either case.
    latest: dict[tuple[str, str], dict] = {}
    for row in rows:
        key = (row["provider_id"], row["incident_id"])
        existing = latest.get(key)
        if existing is None or row["interpreted_at_utc"] > existing["interpreted_at_utc"]:
            latest[key] = row
    return list(latest.values())


def _load_coverage(api: HfApi) -> list[dict]:
    try:
        local_path = api.hf_hub_download(repo_id=HF_DATASET_REPO, repo_type="dataset", filename="coverage/latest.json")
    except Exception:
        logger.warning("no coverage/latest.json found on the dataset yet")
        return []
    return json.loads(Path(local_path).read_text())


def _shape_incident(row: dict) -> dict:
    is_open = row["incident_status"] != "resolved"
    source_url = row.get("source_url")
    source_is_fallback = source_url is None
    tags = []
    if row.get("affected_surface"):
        tags.append(row["affected_surface"])
    if not is_open and row.get("workaround_offered") == 0:
        tags.append("no workaround")

    return {
        "incident_id": row["incident_id"],
        "provider_id": row["provider_id"],
        "provider_name": PROVIDER_DISPLAY_NAMES.get(row["provider_id"], row["provider_id"]),
        "title": row.get("title"),
        "summary": row.get("summary"),
        "affected_surface": row.get("affected_surface"),
        "tags": tags,
        "workaround_offered": bool(row.get("workaround_offered")),
        "workaround": row.get("workaround"),
        "severity": row.get("severity"),
        "source_url": source_url or PROVIDER_STATUS_HOMEPAGES.get(row["provider_id"]),
        "source_is_fallback": source_is_fallback,
        "status": row["incident_status"],
        "is_open": is_open,
        "is_retroactive": bool(row.get("is_retroactive")),
        "created_at": row.get("created_at"),
        "resolved_at": row.get("resolved_at"),
        "duration_hours": row.get("duration_hours"),
        "time_to_first_update_min": row.get("time_to_first_update_min"),
        "updates_per_hour": row.get("updates_per_hour"),
        "component_count": row.get("component_count"),
        "incident_updated_at_utc": row.get("incident_updated_at_utc"),
        "model_used": row.get("model_used"),
        "prompt_version": row.get("prompt_version"),
        "schema_version": row.get("schema_version"),
        "interpreted_at_utc": row.get("interpreted_at_utc"),
        # Provenance badge shows only on exceptions — the default is
        # stated once in the provenance bar, not repeated per card.
        "is_provenance_exception": row.get("model_used") != MODEL or row.get("prompt_version") != PROMPT_VERSION,
    }


def _shape_coverage(coverage_rows: list[dict]) -> list[dict]:
    by_provider = {c["provider_id"]: c for c in coverage_rows}
    shaped = []
    for provider in PROVIDERS:
        c = by_provider.get(provider.id, {})
        shaped.append({
            "provider_id": provider.id,
            "provider_name": PROVIDER_DISPLAY_NAMES.get(provider.id, provider.id),
            "collection_start_utc": c.get("collection_start_utc"),
            "last_success_utc": c.get("last_success_utc"),
            "last_attempt_utc": c.get("last_attempt_utc"),
            "gaps": c.get("gaps", []),
        })
    return shaped


def build(out_dir: str | Path) -> dict:
    if not HF_DATASET_REPO:
        raise RuntimeError("STATUS_QUO_HF_DATASET_REPO is not set — refusing to build")

    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    api = HfApi(token=HF_TOKEN)
    interpretation_rows = _load_interpretations(api)
    coverage_rows = _load_coverage(api)

    incidents = [_shape_incident(r) for r in interpretation_rows]
    incidents.sort(key=lambda i: i["incident_updated_at_utc"] or "", reverse=True)
    coverage = _shape_coverage(coverage_rows)

    from datetime import datetime, timezone

    meta = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "default_model": MODEL,
        "default_prompt_version": PROMPT_VERSION,
        "default_schema_version": SCHEMA_VERSION,
        "incident_count": len(incidents),
    }

    (out_path / "meta.json").write_text(json.dumps(meta, separators=(",", ":")))
    (out_path / "incidents.json").write_text(json.dumps(incidents, separators=(",", ":")))
    (out_path / "coverage.json").write_text(json.dumps(coverage, separators=(",", ":")))

    logger.info(
        "built dashboard data: %d incidents (%d open), %d providers in coverage",
        len(incidents), sum(1 for i in incidents if i["is_open"]), len(coverage),
    )
    return meta


if __name__ == "__main__":
    import argparse

    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="app/public/data")
    args = parser.parse_args()
    build(args.out)
