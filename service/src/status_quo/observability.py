"""Shared logging and healthchecks.io ping helpers for scheduled jobs."""

from __future__ import annotations

import urllib.request


def log_line(**fields) -> None:
    """logfmt to stdout, picked up by the container's log collection."""
    parts = [f"{k}={v}" for k, v in fields.items()]
    print(" ".join(parts), flush=True)


def ping_healthchecks(ping_url: str | None, success: bool) -> None:
    if not ping_url:
        return
    url = ping_url if success else f"{ping_url}/fail"
    try:
        with urllib.request.urlopen(url, timeout=10):
            pass
    except OSError as exc:
        log_line(event="healthchecks_ping_failed", error=str(exc))
