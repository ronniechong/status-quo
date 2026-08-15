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
from pathlib import Path

from status_quo import db
from status_quo.cycle import DEFAULT_DB_PATH
from status_quo.interpret import PROMPT_VERSION, interpret_incident
from status_quo.observability import log_line
from status_quo.tracing import make_trace_fn

logger = logging.getLogger("status_quo.interpret_pipeline")


def run_interpretation_batch(db_path: Path = DEFAULT_DB_PATH, sample_rate: float = 1.0) -> int:
    """Interprets every resolved incident not yet tagged at PROMPT_VERSION.
    Returns the number of incidents interpreted. Failures on individual
    incidents are logged and skipped, not fatal to the batch.
    """
    trace_fn, flush_fn = make_trace_fn(PROMPT_VERSION, sample_rate=sample_rate)
    interpreted = 0

    with closing(db.connect(db_path)) as conn:
        already_done = db.interpreted_incident_keys(conn, PROMPT_VERSION)
        candidates = db.latest_resolved_incidents(conn)

        for entry in candidates:
            provider_id = entry["provider_id"]
            incident = entry["incident"]
            incident["_provider_id"] = provider_id
            key = (provider_id, incident.get("id"))
            if key in already_done:
                continue

            try:
                record = interpret_incident(incident, trace_fn=trace_fn)
            except Exception as exc:
                logger.warning("interpretation failed for %s/%s: %s", provider_id, incident.get("id"), exc)
                log_line(event="interpret_failed", provider=provider_id, incident_id=incident.get("id"), error=str(exc))
                continue

            db.insert_interpretation(conn, record)
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

    flush_fn()
    log_line(event="interpret_batch_complete", interpreted=interpreted)
    return interpreted


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_interpretation_batch()
