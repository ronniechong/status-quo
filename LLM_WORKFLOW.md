# How the LLM interpretation works

This describes the one place an LLM touches this project: tagging a resolved incident with a title, summary, and taxonomy. Everything else — durations, update counts, component counts, daily trend counts, staleness — is computed in code from structured metadata, never asked of the model.

## Design constraint: no invented facts

The model is given the incident's raw update timeline plus metadata computed separately (duration, affected components) and instructed not to state anything beyond what's in that text. It must use the provided duration/component values verbatim in its summary rather than estimating its own. `service/src/status_quo/interpret.py`'s system prompt is the source of truth for the exact wording; this file explains the shape of the pipeline around it.

## Pipeline stages

1. **Fetch** (`status-quo fetch`, supercronic every ~6h) — pulls each provider's public status-page API, stores the raw response verbatim in local SQLite (`fetch.py`, `db.py`). Append-only; a fetch is never mutated after the fact.
2. **Interpret** (`status-quo interpret`, runs after each fetch) — for every newly-*resolved* incident not yet interpreted at the current prompt version, calls the model once (`interpret_pipeline.py` → `interpret.interpret_incident`). Currently-*open* incidents get a separate no-LLM path (see below).
3. **Export** (`status-quo export`, ~20min after each fetch) — batches new/updated SQLite rows to the private HuggingFace dataset (Parquet, partitioned by provider/month) — the durable, off-host source of truth. SQLite itself is a droppable rolling window, not permanent storage.
4. **Dashboard data build** (`status-quo build-dashboard-data`, GitHub Actions `sync-data.yml`, ~20min after export) — reads all HuggingFace partitions, dedupes, shapes into the compact JSON the dashboard fetches client-side.

## The interpretation call

- **Model:** `openai/gpt-oss-120b` via Groq, `temperature=0`, `reasoning_effort=low`. Two retries, then falls back to `openai/gpt-oss-20b` — whichever model actually answered is stamped on the record (`model_used`), never hidden.
- **Input:** the incident's chronological update timeline (status + body per update) plus a metadata block stating the provider-reported duration and affected components — computed deterministically from `created_at`/`resolved_at`/`components`, not left for the model to infer.
- **Output (exactly these fields, JSON only):**
  - `title` — single-line headline, may name a cause only if the text states one
  - `summary` — 2-4 sentences, must cite the *provided* duration/component metadata verbatim rather than re-deriving it from prose
  - `affected_surface` — one of a fixed 12-value enum (`api`, `auth`, `database`, … `other`); anything the model returns outside the enum is coerced to `other` in code, not trusted as-is
  - `fault_origin` — one of a fixed set (`code_deploy`, `infrastructure`, `third_party_dependency`, `capacity_load`, `network`, `not_stated`, `unclear`); collected but not currently surfaced on the dashboard (too sparse to carry a primary axis yet)
  - `workaround_offered` / `workaround` — boolean + a quote/close paraphrase, `null` if none stated

## What's never asked of the model

`duration_hours`, `time_to_first_update_min`, `updates_per_hour`, `component_count`, `is_retroactive`, `severity` (the provider's own reported word, unmodified), `source_url` — all computed in `interpret.compute_metrics`, pure arithmetic over the raw incident's own fields. This split exists so a wrong or hallucinated number is architecturally impossible for these fields, not just discouraged by prompting.

## Open incidents

An incident that hasn't resolved yet never gets an LLM call — summarizing an in-progress incident risks stating an outcome that hasn't happened. Instead a raw snapshot (`model_used: "none"`, `prompt_version: "raw-v1"`) is upserted every cycle until it resolves, at which point the snapshot is deleted and replaced by a real interpretation.

## Prompt versioning

`PROMPT_VERSION` in `interpret.py` (currently `v3`) is bumped whenever the prompt or output schema changes. The scheduled pipeline only interprets incidents not yet tagged at the *current* version — it never silently re-processes history. Re-running the current prompt over the full back-catalogue to validate a change (and diff against prior results) is a separate, manually-invoked command: `status-quo reinterpret`, reading from the durable HuggingFace store rather than the droppable local SQLite window.

Every interpreted incident carries `model_used`, `prompt_version`, `schema_version`, and `interpreted_at_utc` — visible per-incident in the dashboard's detail modal, and via the `is_provenance_exception` flag (a card badge when a row's model/prompt version differs from the current default) on the feed itself.

## Accuracy measurement

A 50-incident hand-labelled sample was scored against an over-claiming rubric (asserting a cause only implied, upgrading uncertainty to certainty, inflating scope). Measured result: 0% combined over-claiming rate (gate: ≤10%), zero Fabrication findings. The reviewer was this project's author, not an independent party — see the "How this works" panel on the live dashboard for the same caveat stated publicly.

## Where to look

- `service/src/status_quo/interpret.py` — the system prompt, model call, fallback logic, and `compute_metrics`
- `service/src/status_quo/interpret_pipeline.py` — the batch runner and open-incident snapshot logic
- `service/src/status_quo/reinterpret.py` — the manual back-catalogue re-run/diff tool
- `service/src/status_quo/tracing.py` — Langfuse tracing hook (sampled, injected as a callback so `interpret.py` has no hard dependency on the SDK being configured)
