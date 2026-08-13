"""Batched export of un-exported SQLite snapshots to a private HuggingFace
Parquet dataset — the durable, off-host source of truth.

Runs daily/weekly via supercronic, never per-fetch: HuggingFace is a
dataset host, not a high-frequency append target. Partitioned by
provider/month so a batch only ever touches the current month's file, and
individual snapshots are never written as their own tiny Parquet file.
"""

from __future__ import annotations

import logging
import os
from collections import defaultdict
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory

import pyarrow as pa
import pyarrow.parquet as pq
from huggingface_hub import HfApi

from status_quo import db
from status_quo.cycle import DEFAULT_DB_PATH

logger = logging.getLogger("status_quo.export_hf")

HF_DATASET_REPO = os.environ.get("STATUS_QUO_HF_DATASET_REPO")  # e.g. "<user>/status-quo-raw"
HF_TOKEN = os.environ.get("HF_TOKEN")
MAX_UPLOAD_ATTEMPTS = 3


def _month_partition(fetched_at_utc: str) -> str:
    dt = datetime.fromisoformat(fetched_at_utc)
    return dt.strftime("%Y-%m")


def _rows_to_table(rows: list) -> pa.Table:
    return pa.table(
        {
            "id": [r["id"] for r in rows],
            "provider_id": [r["provider_id"] for r in rows],
            "fetched_at_utc": [r["fetched_at_utc"] for r in rows],
            "http_status": [r["http_status"] for r in rows],
            "body": [r["body"] for r in rows],
            "normalized_timestamps": [r["normalized_timestamps"] for r in rows],
        }
    )


def export_batch(db_path: Path = DEFAULT_DB_PATH, dataset_repo: str | None = None) -> int:
    """Exports all currently un-exported 'ok' snapshots. Returns rows exported."""
    dataset_repo = dataset_repo or HF_DATASET_REPO
    if not dataset_repo:
        raise RuntimeError("STATUS_QUO_HF_DATASET_REPO is not set — refusing to export")

    with closing(db.connect(db_path)) as conn:
        rows = db.unexported_snapshots(conn)
        if not rows:
            logger.info("export_batch: nothing to export")
            return 0

        by_partition: dict[tuple[str, str], list] = defaultdict(list)
        for row in rows:
            partition_key = (row["provider_id"], _month_partition(row["fetched_at_utc"]))
            by_partition[partition_key].append(row)

        api = HfApi(token=HF_TOKEN)
        exported_ids: list[int] = []

        with TemporaryDirectory() as tmp:
            for (provider_id, month), partition_rows in by_partition.items():
                table = _rows_to_table(partition_rows)
                local_path = Path(tmp) / f"{provider_id}_{month}.parquet"
                pq.write_table(table, local_path)

                remote_path = f"data/{provider_id}/{month}.parquet"
                _upload_with_retry(api, dataset_repo, local_path, remote_path)
                exported_ids.extend(r["id"] for r in partition_rows)

        exported_at = datetime.now(timezone.utc).isoformat()
        db.mark_exported(conn, exported_ids, exported_at)
        conn.commit()

    logger.info("export_batch: exported %d rows across %d partitions", len(exported_ids), len(by_partition))
    return len(exported_ids)


def _upload_with_retry(api: HfApi, dataset_repo: str, local_path: Path, remote_path: str) -> None:
    """Merges new rows into any existing partition file before uploading —
    a batch must never overwrite prior months' data, and re-running an
    export after a partial failure must not duplicate already-exported rows
    (rows are only marked exported after every partition upload succeeds).
    """
    last_error: Exception | None = None
    for attempt in range(1, MAX_UPLOAD_ATTEMPTS + 1):
        try:
            _merge_with_existing(api, dataset_repo, local_path, remote_path)
            api.upload_file(
                path_or_fileobj=str(local_path),
                path_in_repo=remote_path,
                repo_id=dataset_repo,
                repo_type="dataset",
            )
            return
        except Exception as exc:  # HfApi raises various HTTP/network errors
            last_error = exc
            logger.warning("upload attempt %d/%d failed for %s: %s", attempt, MAX_UPLOAD_ATTEMPTS, remote_path, exc)
    raise RuntimeError(f"Failed to upload {remote_path} after {MAX_UPLOAD_ATTEMPTS} attempts") from last_error


def _merge_with_existing(api: HfApi, dataset_repo: str, local_path: Path, remote_path: str) -> None:
    try:
        existing_path = api.hf_hub_download(
            repo_id=dataset_repo, repo_type="dataset", filename=remote_path
        )
    except Exception:
        return  # no existing partition file yet — first write for this provider/month

    existing_table = pq.read_table(existing_path)
    new_table = pq.read_table(local_path)
    merged = pa.concat_tables([existing_table, new_table])
    pq.write_table(merged, local_path)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    export_batch()
