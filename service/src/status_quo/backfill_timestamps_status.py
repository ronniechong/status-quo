"""One-off backfill: populates created_at/resolved_at/duration_hours/
incident_status for interpretations written before those columns existed
(M07 spec-review extension to M06 — open-incident support).

Same matching approach as backfill_severity_source_url.py. All existing
rows at this point are resolved incidents (open-incident support didn't
exist yet), so incident_status backfills to 'resolved' uniformly; duration
is computed the same way interpret.compute_metrics does going forward.

Run once, by hand: `python -m status_quo.backfill_timestamps_status`
"""

from __future__ import annotations

import json
import logging
from contextlib import closing
from datetime import datetime

from status_quo import db, interpret
from status_quo.cycle import DEFAULT_DB_PATH

logger = logging.getLogger("status_quo.backfill_timestamps_status")


def _latest_incidents_by_key(conn) -> dict[tuple[str, str], dict]:
    conn.row_factory = None
    cur = conn.execute(
        "SELECT provider_id, body FROM snapshots WHERE outcome = 'ok' AND body IS NOT NULL ORDER BY fetched_at_utc"
    )
    latest: dict[tuple[str, str], dict] = {}
    for provider_id, body in cur.fetchall():
        parsed = json.loads(body)
        for incident in parsed.get("incidents", []) or []:
            key = (provider_id, incident.get("id"))
            existing = latest.get(key)
            if existing is None or (incident.get("updated_at") or "") >= (existing.get("updated_at") or ""):
                latest[key] = incident
    return latest


def _duration_hours(created: str | None, resolved: str | None) -> float | None:
    if not created or not resolved:
        return None
    try:
        c = datetime.fromisoformat(created.replace("Z", "+00:00"))
        r = datetime.fromisoformat(resolved.replace("Z", "+00:00"))
        span_seconds = (r - c).total_seconds()
        if span_seconds < interpret.MIN_RELIABLE_DURATION_SECONDS:
            return None
        return round(span_seconds / 3600, 2)
    except ValueError:
        return None


def backfill(db_path=DEFAULT_DB_PATH) -> int:
    with closing(db.connect(db_path)) as conn:
        incidents_by_key = _latest_incidents_by_key(conn)

        conn.row_factory = None
        rows = conn.execute(
            "SELECT id, provider_id, incident_id FROM interpretations WHERE created_at IS NULL"
        ).fetchall()

        updated = 0
        missing = 0
        for row_id, provider_id, incident_id in rows:
            incident = incidents_by_key.get((provider_id, incident_id))
            if incident is None:
                missing += 1
                logger.warning("no raw snapshot found for %s/%s — leaving timestamps null", provider_id, incident_id)
                continue
            created_at = incident.get("created_at")
            resolved_at = incident.get("resolved_at")
            conn.execute(
                """
                UPDATE interpretations
                SET created_at = ?, resolved_at = ?, duration_hours = ?, incident_status = ?, exported_at_utc = NULL
                WHERE id = ?
                """,
                (created_at, resolved_at, _duration_hours(created_at, resolved_at), incident.get("status", "resolved"), row_id),
            )
            updated += 1
        conn.commit()

    logger.info("backfill complete: %d updated, %d missing raw snapshot", updated, missing)
    return updated


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    backfill()
