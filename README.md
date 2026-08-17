# status-quo

Aggregates public status-page incident data from multiple SaaS providers and
uses an LLM to interpret it into a consistent, cross-company analytics view —
incident summaries, affected-surface tagging, and computed metrics, without
inventing facts the source data doesn't support.

**Live dashboard:** https://ronniechong.com/status-quo/

See `AGENTS.md` for repository layout, commands, and conventions.
See `LLM_WORKFLOW.md` for exactly how the interpretation model is used, what
it's never asked to do, and how prompt changes get versioned/validated.

## How it fits together

- `service/` — the collection/interpretation pipeline (Python), runs as a
  long-running Docker container with an internal scheduler (supercronic),
  not host-level cron. Fetches every ~12h, interprets newly-resolved
  incidents, exports to a private HuggingFace dataset ~20min later.
- `app/` — the public dashboard (Astro + React islands, static site),
  deployed to GitHub Pages.
- `dashboard-data/` — JSON snapshots synced from HuggingFace by a scheduled
  GitHub Actions workflow (`sync-data.yml`, ~12-hourly) and fetched
  client-side by the dashboard at page load. Deliberately outside `app/` so
  a data sync never triggers an app rebuild.

## Running collection

Required environment variables (see `.env.example` for the full annotated
list):

- `STATUS_QUO_HF_DATASET_REPO` — private HuggingFace dataset repo id to export to
- `HF_TOKEN` — HuggingFace token with write access to that dataset
- `GROQ_API_KEY` — for the interpretation model calls
- `HEALTHCHECKS_PING_URL` / `HEALTHCHECKS_EXPORT_PING_URL` — optional, pinged on each successful fetch/export cycle
- `LANGFUSE_SECRET_KEY` / `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_BASE_URL` — optional, sampled tracing of interpretation calls

```
docker compose up -d --build
```

To trigger a step outside the schedule:

```
docker compose exec status-quo status-quo fetch
docker compose exec status-quo status-quo interpret
docker compose exec status-quo status-quo export
docker compose exec status-quo status-quo build-dashboard-data --out dashboard-data
```

## Running the dashboard locally

```
cd app
npm install
npm run dev
```

The app fetches `dashboard-data/*.json` from `raw.githubusercontent.com` at
page load (hardcoded, same URL in dev and prod) — no local pipeline run or
env config needed to develop against real, current data.
