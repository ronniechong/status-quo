"""Runs interpretation over newly-collected resolved incidents.

Invoked after each fetch cycle (see cycle.py) and as a standalone
`status-quo interpret` command. Only interprets incidents not already
interpreted at the current PROMPT_VERSION — re-interpreting a previous
prompt version's back-catalogue is a separate, deliberate operation
(see reinterpret.py), not something this runs implicitly.
"""

from __future__ import annotations

import logging
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

from status_quo import db
from status_quo.cycle import DEFAULT_DB_PATH
from status_quo.interpret import PROMPT_VERSION, interpret_incident
from status_quo.observability import log_line
from status_quo.tracing import make_trace_fn

logger = logging.getLogger("status_quo.interpret_pipeline")

OPEN_SNAPSHOT_PROMPT_VERSION = "raw-v1"
OPEN_SNAPSHOT_SCHEMA_VERSION = "v3"


def _parse_dt(iso: str | None) -> datetime | None:
    if not iso:
        return None
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def run_interpretation_batch(db_path: Path = DEFAULT_DB_PATH, sample_rate: float = 1.0) -> int:
    """Interprets every resolved incident not yet tagged at PROMPT_VERSION.
    Returns the number of incidents interpreted. Failures on individual
    incidents are logged and skipped, not fatal to the batch.

    Skips incidents whose own `updated_at` predates the provider's first
    successful fetch — a newly-added provider's status page can return up
    to ~50 already-resolved incidents on its very first fetch, and none of
    that backlog should trigger an LLM call. Rolling-forward collection
    only: interpretation spend covers incidents observed from when we
    started watching a provider, never its pre-existing history.
    """
    trace_fn, flush_fn = make_trace_fn(PROMPT_VERSION, sample_rate=sample_rate)
    interpreted = 0
    skipped_backlog = 0

    with closing(db.connect(db_path)) as conn:
        already_done = db.interpreted_incident_keys(conn, PROMPT_VERSION)
        candidates = db.latest_resolved_incidents(conn)
        first_seen_cache: dict[str, datetime | None] = {}

        for entry in candidates:
            provider_id = entry["provider_id"]
            incident = entry["incident"]
            incident["_provider_id"] = provider_id
            key = (provider_id, incident.get("id"))
            if key in already_done:
                continue

            if provider_id not in first_seen_cache:
                first_seen_cache[provider_id] = _parse_dt(db.provider_first_seen_utc(conn, provider_id))
            first_seen = first_seen_cache[provider_id]
            incident_updated = _parse_dt(incident.get("updated_at"))
            if first_seen is not None and incident_updated is not None and incident_updated < first_seen:
                skipped_backlog += 1
                continue

            try:
                record = interpret_incident(incident, trace_fn=trace_fn)
            except Exception as exc:
                logger.warning("interpretation failed for %s/%s: %s", provider_id, incident.get("id"), exc)
                log_line(event="interpret_failed", provider=provider_id, incident_id=incident.get("id"), error=str(exc))
                continue

            db.insert_interpretation(conn, record)
            # Drop any stale open-incident raw snapshot now superseded by a
            # real interpretation — otherwise both rows would exist and the
            # dashboard build would have to guess which one wins.
            db.delete_open_snapshot(conn, incident.get("id"), provider_id, OPEN_SNAPSHOT_PROMPT_VERSION)
            conn.commit()
            interpreted += 1
            log_line(
                event="interpret",
                provider=provider_id,
                incident_id=incident.get("id"),
                model_used=record["model_used"],
                affected_surface=record["affected_surface"],
            )
            already_done.add(key)

        open_count = _refresh_open_incidents(conn)

    flush_fn()
    log_line(event="interpret_batch_complete", interpreted=interpreted, open_refreshed=open_count, skipped_backlog=skipped_backlog)
    return interpreted


def _refresh_open_incidents(conn) -> int:
    """Upserts a raw (no-LLM) snapshot for every currently-open incident —
    run every cycle, since an open incident's status/severity can change
    between fetches until it resolves and moves to the real interpreted path.
    """
    from status_quo.interpret import compute_metrics

    refreshed = 0
    for entry in db.latest_open_incidents(conn):
        provider_id = entry["provider_id"]
        incident = entry["incident"]
        metrics = compute_metrics(incident)
        record = {
            "incident_id": incident.get("id"),
            "provider_id": provider_id,
            "incident_updated_at_utc": incident.get("updated_at"),
            "title": incident.get("name"),
            "model_used": "none",
            "prompt_version": OPEN_SNAPSHOT_PROMPT_VERSION,
            "schema_version": OPEN_SNAPSHOT_SCHEMA_VERSION,
            "interpreted_at_utc": datetime.now(timezone.utc).isoformat(),
            **metrics,
        }
        db.upsert_open_incident_snapshot(conn, record)
        refreshed += 1
    conn.commit()
    return refreshed


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_interpretation_batch()
