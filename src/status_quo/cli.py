"""Manual entrypoint — also what supercronic invokes on schedule.

`status-quo fetch` and `status-quo export` both work as one-shot commands
outside the schedule, per the milestone's requirement for a manual trigger
that doesn't wait on the cron cadence.
"""

from __future__ import annotations

import argparse
import logging
import sys


def main() -> int:
    parser = argparse.ArgumentParser(prog="status-quo")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("fetch", help="Run one fetch cycle across the provider cohort")
    sub.add_parser("export", help="Run one batched SQLite -> HuggingFace export")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")

    if args.command == "fetch":
        from status_quo.cycle import run_cycle

        success = run_cycle()
        return 0 if success else 1

    if args.command == "export":
        from status_quo.export_hf import export_batch

        export_batch()
        return 0

    return 1


if __name__ == "__main__":
    sys.exit(main())
