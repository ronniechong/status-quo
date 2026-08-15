"""Statuspage `/api/v2/incidents.json` adapter with retry/backoff.

All 10 cohort providers share this schema (Atlassian Statuspage).
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone

from status_quo.providers import Provider

USER_AGENT = "status-quo-collector/0.1 (+https://github.com/ronniechong/status-quo)"
TIMEOUT_SECONDS = 20
TRANSIENT_STATUSES = {429, 500, 502, 503, 504}
MAX_ATTEMPTS = 4
BASE_BACKOFF_SECONDS = 3


@dataclass
class FetchResult:
    outcome: str  # 'ok' | 'structural_failure' | 'transport_failure'
    http_status: int | None
    body: dict | None
    fetched_at_utc: str


def _now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _request_once(url: str) -> tuple[int, bytes]:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
        return resp.status, resp.read()


def fetch_provider(provider: Provider) -> FetchResult:
    last_status: int | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            status, raw = _request_once(provider.url)
        except urllib.error.HTTPError as exc:
            status = exc.code
            raw = exc.read()
        except (urllib.error.URLError, TimeoutError, OSError):
            # transport-level failure: no HTTP status at all
            if attempt < MAX_ATTEMPTS:
                time.sleep(BASE_BACKOFF_SECONDS * (2 ** (attempt - 1)))
                continue
            return FetchResult("transport_failure", None, None, _now_utc_iso())

        last_status = status

        if status == 200:
            try:
                body = json.loads(raw)
            except json.JSONDecodeError:
                return FetchResult("structural_failure", status, None, _now_utc_iso())
            return FetchResult("ok", status, body, _now_utc_iso())

        if status in TRANSIENT_STATUSES and attempt < MAX_ATTEMPTS:
            time.sleep(BASE_BACKOFF_SECONDS * (2 ** (attempt - 1)))
            continue

        return FetchResult("structural_failure", status, None, _now_utc_iso())

    return FetchResult("structural_failure", last_status, None, _now_utc_iso())
