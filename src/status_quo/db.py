"""SQLite working store.

Raw snapshots are append-only: a fetch is stored whole, never updated in
place. Deduplication across snapshots (same incident ID, newer
`updated_at` wins) happens at read time against this table, not at write
time here.
"""

from __future__ import annotations

import json
import sqlite3
from contextlib import closing
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id TEXT NOT NULL,
    fetched_at_utc TEXT NOT NULL,
    http_status INTEGER,
    outcome TEXT NOT NULL,           -- 'ok' | 'structural_failure' | 'transport_failure'
    body TEXT,                        -- raw JSON response body, NULL on failure
    normalized_timestamps TEXT,       -- per-incident {raw, utc} timestamps, derived from body
    exported_at_utc TEXT              -- set once included in a HuggingFace export batch
);

CREATE INDEX IF NOT EXISTS idx_snapshots_provider_time
    ON snapshots (provider_id, fetched_at_utc);

CREATE INDEX IF NOT EXISTS idx_snapshots_unexported
    ON snapshots (exported_at_utc);

CREATE TABLE IF NOT EXISTS fetch_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id TEXT NOT NULL,
    fetched_at_utc TEXT NOT NULL,
    outcome TEXT NOT NULL,
    http_status INTEGER,
    note TEXT
);
"""


def connect(db_path: str | Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db(db_path: str | Path) -> None:
    with closing(connect(db_path)) as conn:
        conn.executescript(SCHEMA)
        conn.commit()


def insert_snapshot(
    conn: sqlite3.Connection,
    provider_id: str,
    fetched_at_utc: str,
    http_status: int | None,
    outcome: str,
    body: dict | None,
    normalized_timestamps: list[dict] | None = None,
) -> None:
    conn.execute(
        """
        INSERT INTO snapshots (provider_id, fetched_at_utc, http_status, outcome, body, normalized_timestamps)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            provider_id,
            fetched_at_utc,
            http_status,
            outcome,
            json.dumps(body) if body is not None else None,
            json.dumps(normalized_timestamps) if normalized_timestamps is not None else None,
        ),
    )
    conn.execute(
        """
        INSERT INTO fetch_log (provider_id, fetched_at_utc, outcome, http_status, note)
        VALUES (?, ?, ?, ?, ?)
        """,
        (provider_id, fetched_at_utc, outcome, http_status, None),
    )


def prune_older_than(conn: sqlite3.Connection, cutoff_utc: str) -> int:
    """Delete snapshots older than cutoff that have already been exported.

    Never prunes un-exported rows — the SQLite copy is droppable/rebuildable
    only once HuggingFace actually holds the data, not before.
    """
    cur = conn.execute(
        """
        DELETE FROM snapshots
        WHERE fetched_at_utc < ?
          AND exported_at_utc IS NOT NULL
        """,
        (cutoff_utc,),
    )
    return cur.rowcount


def mark_exported(conn: sqlite3.Connection, snapshot_ids: list[int], exported_at_utc: str) -> None:
    conn.executemany(
        "UPDATE snapshots SET exported_at_utc = ? WHERE id = ?",
        [(exported_at_utc, sid) for sid in snapshot_ids],
    )


def unexported_snapshots(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    conn.row_factory = sqlite3.Row
    cur = conn.execute(
        """
        SELECT id, provider_id, fetched_at_utc, http_status, outcome, body, normalized_timestamps
        FROM snapshots
        WHERE exported_at_utc IS NULL AND outcome = 'ok'
        ORDER BY fetched_at_utc
        """
    )
    return cur.fetchall()


def health_summary(conn: sqlite3.Connection) -> list[dict]:
    """Last successful fetch, record counts, and last outcome per provider."""
    conn.row_factory = sqlite3.Row
    cur = conn.execute(
        """
        SELECT
            provider_id,
            COUNT(*) AS total_fetches,
            SUM(CASE WHEN outcome = 'ok' THEN 1 ELSE 0 END) AS ok_fetches,
            MAX(CASE WHEN outcome = 'ok' THEN fetched_at_utc END) AS last_success_utc,
            MAX(fetched_at_utc) AS last_attempt_utc
        FROM fetch_log
        GROUP BY provider_id
        ORDER BY provider_id
        """
    )
    return [dict(row) for row in cur.fetchall()]


def recent_failures(conn: sqlite3.Connection, limit: int = 20) -> list[dict]:
    conn.row_factory = sqlite3.Row
    cur = conn.execute(
        """
        SELECT provider_id, fetched_at_utc, outcome, http_status
        FROM fetch_log
        WHERE outcome != 'ok'
        ORDER BY fetched_at_utc DESC
        LIMIT ?
        """,
        (limit,),
    )
    return [dict(row) for row in cur.fetchall()]
