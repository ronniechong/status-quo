"""Orchestrates one fetch cycle across the provider cohort.

Invoked either by supercronic on the ~6h schedule, or manually via the
`status-quo fetch` one-shot CLI command.
"""

from __future__ import annotations

import json
import logging
import os
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path

from status_quo import db
from status_quo.fetch import fetch_provider
from status_quo.normalize import normalize_incidents
from status_quo.observability import log_line, ping_healthchecks
from status_quo.providers import PROVIDERS

logger = logging.getLogger("status_quo.cycle")

DEFAULT_DB_PATH = Path(os.environ.get("STATUS_QUO_DB_PATH", "data/status-quo.db"))
DEFAULT_STATUS_PATH = Path(os.environ.get("STATUS_QUO_STATUS_JSON_PATH", "data/status.json"))
PRUNE_WINDOW_DAYS = int(os.environ.get("STATUS_QUO_PRUNE_WINDOW_DAYS", "45"))
HEALTHCHECKS_PING_URL = os.environ.get("HEALTHCHECKS_PING_URL")


def run_cycle(db_path: Path = DEFAULT_DB_PATH, status_path: Path = DEFAULT_STATUS_PATH) -> bool:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    db.init_db(db_path)

    any_failure = False
    with closing(db.connect(db_path)) as conn:
        for provider in PROVIDERS:
            result = fetch_provider(provider)
            normalized = normalize_incidents(result.body) if result.body else None
            db.insert_snapshot(
                conn,
                provider_id=provider.id,
                fetched_at_utc=result.fetched_at_utc,
                http_status=result.http_status,
                outcome=result.outcome,
                body=result.body,
                normalized_timestamps=normalized,
            )
            conn.commit()

            if result.outcome == "ok":
                n_incidents = len(result.body.get("incidents", [])) if result.body else 0
                log_line(
                    event="fetch_cycle",
                    provider=provider.id,
                    outcome=result.outcome,
                    http_status=result.http_status,
                    n_incidents=n_incidents,
                )
            else:
                any_failure = True
                log_line(
                    event="fetch_cycle",
                    provider=provider.id,
                    outcome=result.outcome,
                    http_status=result.http_status,
                )

        cutoff = (datetime.now(timezone.utc) - timedelta(days=PRUNE_WINDOW_DAYS)).isoformat()
        pruned = db.prune_older_than(conn, cutoff)
        conn.commit()
        if pruned:
            log_line(event="prune", rows_deleted=pruned, cutoff=cutoff)

        _write_health_status(conn, status_path)

    success = not any_failure
    log_line(event="fetch_cycle_complete", success=success)
    ping_healthchecks(HEALTHCHECKS_PING_URL, success)

    try:
        from status_quo.interpret_pipeline import run_interpretation_batch

        run_interpretation_batch(db_path)
    except Exception as exc:
        # Interpretation failing must never fail the fetch cycle's own
        # success/healthcheck signal -- collection is the thing that can't
        # have gaps, interpretation can catch up on the next cycle.
        logger.warning("interpretation batch failed: %s", exc)
        log_line(event="interpret_batch_failed", error=str(exc))

    return success


def _write_health_status(conn, status_path: Path) -> None:
    status_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "providers": db.health_summary(conn),
        "recent_failures": db.recent_failures(conn),
    }
    status_path.write_text(json.dumps(payload, indent=2))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_cycle()
