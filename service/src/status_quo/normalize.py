"""UTC timestamp normalisation for Statuspage incident records.

Statuspage's `/api/v2/incidents.json` already returns ISO 8601 timestamps
with an explicit offset, so normalising is a parse-and-convert, not a
schema-specific decode (contrast AWS Health's epoch seconds or Heroku's
disagreeing `resolved`/`resolved_at`, which are M8 concerns for a
different platform type). The provider's original string is always kept
alongside the normalised one — nothing is overwritten.
"""

from __future__ import annotations

from datetime import datetime, timezone

TIMESTAMP_FIELDS = ("created_at", "updated_at", "monitoring_at", "resolved_at")


def _to_utc_iso(raw_value: str | None) -> str | None:
    if not raw_value:
        return None
    try:
        dt = datetime.fromisoformat(raw_value)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


def normalized_timestamps(incident: dict) -> dict[str, dict[str, str | None]]:
    """Per-incident {field: {raw, utc}} for each known timestamp field."""
    result = {}
    for field in TIMESTAMP_FIELDS:
        raw_value = incident.get(field)
        result[field] = {"raw": raw_value, "utc": _to_utc_iso(raw_value)}
    return result


def normalize_incidents(body: dict) -> list[dict]:
    return [
        {"id": incident.get("id"), "timestamps": normalized_timestamps(incident)}
        for incident in body.get("incidents", [])
    ]
