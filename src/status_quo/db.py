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

CREATE TABLE IF NOT EXISTS interpretations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    incident_updated_at_utc TEXT NOT NULL,  -- source incident's own updated_at, for dedup/staleness checks
    title TEXT,
    summary TEXT,
    affected_surface TEXT,
    fault_origin TEXT,
    workaround_offered INTEGER,             -- 0/1
    workaround TEXT,
    time_to_first_update_min REAL,
    updates_per_hour REAL,
    component_count INTEGER,
    is_retroactive INTEGER,                 -- 0/1
    model_used TEXT NOT NULL,               -- which model actually produced this record
    prompt_version TEXT NOT NULL,
    schema_version TEXT NOT NULL,
    interpreted_at_utc TEXT NOT NULL,
    exported_at_utc TEXT,
    UNIQUE (incident_id, provider_id, prompt_version)
);

CREATE INDEX IF NOT EXISTS idx_interpretations_unexported
    ON interpretations (exported_at_utc);
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


def latest_resolved_incidents(conn: sqlite3.Connection) -> list[dict]:
    """Dedup 'ok' snapshots down to the latest known state of each resolved
    incident (by provider_id, incident id), keyed on the incident's own
    `updated_at`, not the fetch time. Only resolved incidents are returned —
    interpretation summarises a finished incident, not an in-progress one.
    """
    conn.row_factory = sqlite3.Row
    cur = conn.execute(
        "SELECT provider_id, body FROM snapshots WHERE outcome = 'ok' AND body IS NOT NULL ORDER BY fetched_at_utc"
    )
    latest: dict[tuple[str, str], dict] = {}
    for row in cur.fetchall():
        body = json.loads(row["body"])
        for incident in body.get("incidents", []) or []:
            if incident.get("status") != "resolved":
                continue
            key = (row["provider_id"], incident.get("id"))
            existing = latest.get(key)
            if existing is None or (incident.get("updated_at") or "") >= (existing["incident"].get("updated_at") or ""):
                latest[key] = {"provider_id": row["provider_id"], "incident": incident}
    return list(latest.values())


def interpreted_incident_keys(conn: sqlite3.Connection, prompt_version: str) -> set[tuple[str, str]]:
    """(provider_id, incident_id) pairs already interpreted at this prompt version."""
    cur = conn.execute(
        "SELECT provider_id, incident_id FROM interpretations WHERE prompt_version = ?",
        (prompt_version,),
    )
    return {(row[0], row[1]) for row in cur.fetchall()}


def insert_interpretation(conn: sqlite3.Connection, record: dict) -> None:
    conn.execute(
        """
        INSERT OR IGNORE INTO interpretations (
            incident_id, provider_id, incident_updated_at_utc, title, summary,
            affected_surface, fault_origin, workaround_offered, workaround,
            time_to_first_update_min, updates_per_hour, component_count, is_retroactive,
            model_used, prompt_version, schema_version, interpreted_at_utc
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            record["incident_id"],
            record["provider_id"],
            record["incident_updated_at_utc"],
            record.get("title"),
            record.get("summary"),
            record.get("affected_surface"),
            record.get("fault_origin"),
            int(bool(record.get("workaround_offered"))),
            record.get("workaround"),
            record.get("time_to_first_update_min"),
            record.get("updates_per_hour"),
            record.get("component_count"),
            int(bool(record.get("is_retroactive"))),
            record["model_used"],
            record["prompt_version"],
            record["schema_version"],
            record["interpreted_at_utc"],
        ),
    )


def unexported_interpretations(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    conn.row_factory = sqlite3.Row
    cur = conn.execute("SELECT * FROM interpretations WHERE exported_at_utc IS NULL ORDER BY interpreted_at_utc")
    return cur.fetchall()


def mark_interpretations_exported(conn: sqlite3.Connection, ids: list[int], exported_at_utc: str) -> None:
    conn.executemany(
        "UPDATE interpretations SET exported_at_utc = ? WHERE id = ?",
        [(exported_at_utc, i) for i in ids],
    )


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
