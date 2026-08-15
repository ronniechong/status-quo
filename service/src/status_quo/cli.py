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
    sub.add_parser("interpret", help="Tag any resolved incidents not yet interpreted at the current prompt version")
    sub.add_parser("reinterpret", help="Re-run the current prompt version over the full HuggingFace back-catalogue and diff against prior results")
    build_dashboard = sub.add_parser("build-dashboard-data", help="Build the dashboard's static JSON data from the HuggingFace export")
    build_dashboard.add_argument("--out", default="app/public/data")
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

    if args.command == "interpret":
        from status_quo.interpret_pipeline import run_interpretation_batch

        run_interpretation_batch()
        return 0

    if args.command == "reinterpret":
        from status_quo.reinterpret import run_reinterpretation

        summary = run_reinterpretation()
        print(summary)
        return 0

    if args.command == "build-dashboard-data":
        from status_quo.build_dashboard_data import build

        build(args.out)
        return 0

    return 1


if __name__ == "__main__":
    sys.exit(main())
