"""One-off backfill: nulls out duration_hours/updates_per_hour on already-
exported interpretations whose created_at/resolved_at gap is below
interpret.MIN_RELIABLE_DURATION_SECONDS (or negative) — those rows predate
the reliability check added to interpret.compute_metrics. Re-exporting the
affected rows is triggered by clearing exported_at_utc, same as
backfill_timestamps_status.py does.

Run once, by hand: `python -m status_quo.backfill_unreliable_durations`
"""

from __future__ import annotations

import logging
from contextlib import closing
from datetime import datetime

from status_quo import db, interpret
from status_quo.cycle import DEFAULT_DB_PATH

logger = logging.getLogger("status_quo.backfill_unreliable_durations")


def _is_unreliable(created_at: str | None, resolved_at: str | None) -> bool:
    if not created_at or not resolved_at:
        return False
    try:
        c = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        r = datetime.fromisoformat(resolved_at.replace("Z", "+00:00"))
    except ValueError:
        return False
    return (r - c).total_seconds() < interpret.MIN_RELIABLE_DURATION_SECONDS


def backfill(db_path=DEFAULT_DB_PATH) -> int:
    with closing(db.connect(db_path)) as conn:
        conn.row_factory = None
        rows = conn.execute(
            "SELECT id, created_at, resolved_at FROM interpretations WHERE duration_hours IS NOT NULL"
        ).fetchall()

        updated = 0
        for row_id, created_at, resolved_at in rows:
            if not _is_unreliable(created_at, resolved_at):
                continue
            conn.execute(
                """
                UPDATE interpretations
                SET duration_hours = NULL, updates_per_hour = NULL, exported_at_utc = NULL
                WHERE id = ?
                """,
                (row_id,),
            )
            updated += 1
        conn.commit()

    logger.info("backfill complete: %d rows nulled out for re-export", updated)
    return updated


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    backfill()
