# AGENTS.md — status-quo

> Instructions for AI coding agents working in this repository.

## Project overview
**status-quo** — aggregates public status-page incident data from multiple
SaaS providers and uses an LLM to interpret it into a consistent,
cross-company analytics view. Design priorities: no invented facts (every
generated claim must trace to source text or computed metadata), low
operating cost, and durable off-host storage so the compute host stays
disposable.

## Repository layout
- `service/` — the collection/interpretation pipeline (Python)
  - `service/src/status_quo/` — collection, tagging, and pipeline code
  - `service/crontab` — supercronic schedule (runs inside the container)
  - `service/Dockerfile`
- `app/` — the public dashboard (Astro + React islands, static site)
- `docker-compose.yml`, `.env`/`.env.example` — orchestration, stay at repo root (compose auto-loads a same-directory `.env`)
- `.github/workflows/` — CI (dashboard build/deploy)

## Commands
- **Install pipeline:** `cd service && pip install .`
- **Run one fetch cycle:** `status-quo fetch`
- **Run one export batch:** `status-quo export`
- **Build dashboard data:** `status-quo build-dashboard-data --out app/public/data`
- **Dashboard dev server:** `cd app && npm run dev`
- **Dashboard build:** `cd app && npm run build`
- **Test:** TBD — added once tests exist
- **Lint:** TBD
- **Typecheck:** N/A for the pipeline (Python, no static typechecker configured yet); Astro/TypeScript strict mode for `app/`
- **Build pipeline image:** `docker build ./service` (or `docker compose build` from repo root)
- **Run (long-lived, scheduled):** `docker compose up -d --build` (see README)

## Verified facts
- The primary structured status-page API shape (`/api/v2/incidents.json`) has
  no working pagination on the providers tested — repeated `?page=` requests
  return identical data. History depth is whatever the endpoint's fixed
  record window happens to cover, which varies by provider incident rate.
- Non-Statuspage providers require per-provider schema handling — field
  names, encoding (e.g. some return non-UTF-8 responses), and available
  fields (e.g. some providers expose no per-update status field, or only
  currently-active incidents with no historical/resolved list) all vary.
- Providers commonly hosted on Instatus mirror the Statuspage
  `/api/v2/incidents.json` shape deliberately, for tooling compatibility —
  worth checking before assuming a new provider needs custom parsing.

## Settled technical decisions (do not re-litigate silently — flag first)
| Decision | Choice | Revisit if |
|---|---|---|
| Pipeline language | Python | A single-language (TS) stack becomes strongly preferred once the dashboard is built |
| Runtime shape | Long-running container, not one that exits between runs | Memory usage grows measurably over weeks of running, or migration lands on a platform with native scheduling |
| Scheduler mechanism | supercronic running inside the container | Cadence drops below ~1h, where a systemd timer's catch-up-after-downtime semantics start to matter more |
| Durable storage | Two-tier: local SQLite (rolling window, droppable/rebuildable) + HuggingFace Parquet (source of truth, off-host, private) | Not expected to revisit |
| LLM provider/model | Groq, `openai/gpt-oss-120b` | Cost or accuracy regressions observed in production use |

## Security invariants (standing rules — a violation is never a refactor)
1. Secrets (`GROQ_API_KEY`, `HF_TOKEN`) are supplied via environment
   only — never committed, never hardcoded, never written to a file inside
   this repo.
2. `gitleaks` runs as a pre-commit hook; a failing scan blocks the commit,
   it is never bypassed.
3. Host-specific values (paths, hostnames, ports) come from environment
   variables or a gitignored override file — never hardcoded in source.
4. No secret or host-identifying value is ever logged.

## Conventions
- Python, standard library preferred where practical; third-party deps kept
  minimal and justified.
- No test framework chosen yet — add one before the first non-trivial
  pipeline module lands.

## Verification gate
A change is only done when: tests pass (once a test suite exists), lint
passes (once configured), and the change has been run against real (or
realistic sample) data at least once — not just reviewed as a diff.

## Rules for any AI agent working here
1. Passing the verification gate above means a change is technically sound —
   it does not by itself mean a milestone or feature is complete. Do not mark
   milestone-level work done without the project owner's explicit sign-off
   against a plain-language summary of what shipped.
2. Before implementing any non-trivial task, raise at least one risk, gap, or
   alternative; if genuinely fine as proposed, say so in one sentence.
3. Never silently override a settled decision in this file — flag it and wait
   for a response instead of re-litigating unprompted.
4. Comments/commit messages in this repo never conversationally attribute a
   decision to the owner by name ("X decided/asked/confirmed...") and never
   reference this project's private planning repo by name or file
   (no "see JOURNAL", "STATE.md", "work-docs", "ops/runbook.md", etc.) —
   see the private repo's scrub gate for the full rule and why.
5. Code comments explain non-obvious why only — a hidden constraint, a
   subtle invariant, a workaround for a specific bug. Default to no
   comment. Never write a running decision log in comments: no
   timestamps, no "changed from X to Y because...", no per-change
   justification trail. That belongs in the commit message or the
   private JOURNAL, not in source — see the private repo's comment-scope
   rule for the full rule and why.
