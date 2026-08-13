# status-quo

Aggregates public status-page incident data from multiple SaaS providers and
uses an LLM to interpret it into a consistent, cross-company analytics view —
incident summaries, affected-surface tagging, and computed metrics, without
inventing facts the source data doesn't support.

See `AGENTS.md` for repository layout, commands, and conventions.

## Running collection

The collector runs as a long-running container with an internal scheduler
(supercronic), not a host-level cron/timer. Required environment variables:

- `STATUS_QUO_HF_DATASET_REPO` — private HuggingFace dataset repo id to export to
- `HF_TOKEN` — HuggingFace token with write access to that dataset
- `HEALTHCHECKS_PING_URL` — optional; pinged on each successful fetch cycle

```
docker compose up -d --build
```

To trigger a fetch or export outside the schedule:

```
docker compose exec status-quo status-quo fetch
docker compose exec status-quo status-quo export
```
