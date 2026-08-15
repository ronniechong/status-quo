"""One-off backfill: populates severity/source_url for interpretations
written before those columns existed (M07 spec-review extension to M06).

Matches each interpretation row to its raw incident record by
(provider_id, incident_id), reusing the same snapshot dedup logic as
`db.latest_resolved_incidents`. Resets exported_at_utc on any row it
touches so the next export re-uploads the corrected record — export_hf's
merge logic dedupes by `id`, so the corrected row replaces the stale one
already on HuggingFace rather than duplicating it.

Run once, by hand: `python -m status_quo.backfill_severity_source_url`
"""

from __future__ import annotations

import json
import logging
from contextlib import closing

from status_quo import db
from status_quo.cycle import DEFAULT_DB_PATH

logger = logging.getLogger("status_quo.backfill_severity_source_url")


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


def backfill(db_path=DEFAULT_DB_PATH) -> int:
    with closing(db.connect(db_path)) as conn:
        incidents_by_key = _latest_incidents_by_key(conn)

        conn.row_factory = None
        rows = conn.execute(
            "SELECT id, provider_id, incident_id FROM interpretations WHERE severity IS NULL AND source_url IS NULL"
        ).fetchall()

        updated = 0
        missing = 0
        for row_id, provider_id, incident_id in rows:
            incident = incidents_by_key.get((provider_id, incident_id))
            if incident is None:
                missing += 1
                logger.warning("no raw snapshot found for %s/%s — leaving severity/source_url null", provider_id, incident_id)
                continue
            conn.execute(
                "UPDATE interpretations SET severity = ?, source_url = ?, exported_at_utc = NULL WHERE id = ?",
                (incident.get("impact"), incident.get("shortlink"), row_id),
            )
            updated += 1
        conn.commit()

    logger.info("backfill complete: %d updated, %d missing raw snapshot", updated, missing)
    return updated


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    backfill()
