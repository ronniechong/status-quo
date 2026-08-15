"""LLM interpretation: tags a resolved incident with title/summary/taxonomy.

Ports the spike's validated tag.py prompt, with the free-text
`affected_surface` field replaced by Milestone 04's finalised 12-value fixed
enum. `fault_origin` stays a free-text field, collected but not surfaced on
the dashboard (roadmap's own scope call — too sparse to carry a primary
axis yet).

Pure-metadata metrics (duration-derived, component count, retroactive flag)
are computed in code, never asked of the model — a hard boundary carried
forward from the roadmap.
"""

from __future__ import annotations

import json
import logging
import os
import time
import urllib.request
from datetime import datetime, timezone

logger = logging.getLogger("status_quo.interpret")

MODEL = "openai/gpt-oss-120b"
FALLBACK_MODEL = "openai/gpt-oss-20b"
PROMPT_VERSION = "v3"
SCHEMA_VERSION = "v3"

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

AFFECTED_SURFACE_ENUM = [
    "api",
    "web_dashboard",
    "auth",
    "network",
    "database",
    "messaging",
    "compute",
    "search",
    "ai_ml",
    "infrastructure",
    "monitoring_observability",
    "other",
]

SYSTEM_PROMPT = """You analyse a single incident from a SaaS status page. You are given the incident's chronological update timeline, plus authoritative metadata (reported duration, affected components) computed separately from the provider's own data — not inferred by you. All posts and metadata already provided; do not assume any other information exists.

Produce a JSON object with exactly these fields:
- "title": a single-line headline for this incident, in the style of an incident title (e.g. "API errors from a misconfigured deploy, resolved in 3 hours"). Should read like a real title, not a category label. Base it on what actually happened per the updates; if a cause is stated, the title may name it briefly, but do not invent a cause that isn't in the text.
- "summary": 2-4 sentences covering what was first observed, what action was taken, and how it ended. You MUST explicitly state the resolution time using the provided duration metadata (e.g. "resolved in 3 hours", "resolved within 25 minutes") — use the metadata's value, do not estimate your own from the prose. You MUST explicitly state impact coverage using the provided components metadata (e.g. "affecting the API and Webhooks components", or "no specific components listed" if the metadata list is empty). Do not infer or guess anything else not stated in the updates.
- "affected_surface": exactly one of {enum} — pick the closest fit based only on the text and components metadata; use "other" if genuinely none fit.
- "fault_origin": one of "code_deploy", "infrastructure", "third_party_dependency", "capacity_load", "network", "not_stated", "unclear" — based only on what the updates say, not speculation.
- "workaround_offered": true if the updates explicitly suggest a customer-facing mitigation or workaround (e.g. "use API v2 in the meantime", "retry your request"), false otherwise.
- "workaround": a short quote or close paraphrase of the workaround if workaround_offered is true, else null. Do not invent a workaround that isn't in the text.

Respond with ONLY the JSON object, no other text.""".format(enum=json.dumps(AFFECTED_SURFACE_ENUM))


def format_metadata(incident: dict) -> str:
    created = incident.get("created_at")
    resolved = incident.get("resolved_at")
    duration_str = "not available"
    if created and resolved:
        try:
            c = datetime.fromisoformat(created.replace("Z", "+00:00"))
            r = datetime.fromisoformat(resolved.replace("Z", "+00:00"))
            total_min = (r - c).total_seconds() / 60
            if total_min <= 0:
                duration_str = "reported and resolved at the same recorded timestamp (duration not meaningfully measurable from metadata)"
            elif total_min < 60:
                duration_str = f"{int(total_min)} minutes"
            else:
                duration_str = f"{total_min / 60:.1f} hours"
        except ValueError:
            duration_str = "not available"
    components = [c.get("name") for c in (incident.get("components") or []) if c.get("name")]
    components_str = ", ".join(components) if components else "none listed"
    return f"Reported duration (created_at to resolved_at): {duration_str}\nAffected components (provider metadata): {components_str}"


def compute_metrics(incident: dict) -> dict:
    """Pure-metadata metrics — no LLM, no invention risk."""

    def parse(ts):
        return datetime.fromisoformat(ts.replace("Z", "+00:00")) if ts else None

    created = parse(incident.get("created_at"))
    resolved = parse(incident.get("resolved_at"))
    updates = sorted(incident.get("incident_updates", []) or [], key=lambda u: u.get("created_at", ""))
    update_times = [parse(u.get("created_at")) for u in updates if u.get("created_at")]

    time_to_first_update_min = None
    if created and update_times:
        time_to_first_update_min = round((update_times[0] - created).total_seconds() / 60, 1)

    updates_per_hour = None
    if created and resolved and updates:
        span_hours = (resolved - created).total_seconds() / 3600
        updates_per_hour = round(len(updates) / span_hours, 2) if span_hours > 0 else None

    component_count = len(incident.get("components") or [])
    is_retroactive = len(updates) <= 1 and created == resolved

    if is_retroactive:
        time_to_first_update_min = None
        updates_per_hour = None

    return {
        "time_to_first_update_min": time_to_first_update_min,
        "updates_per_hour": updates_per_hour,
        "component_count": component_count,
        "is_retroactive": is_retroactive,
    }


def incident_text(incident: dict) -> str:
    updates = incident.get("incident_updates", []) or []
    lines = []
    for u in sorted(updates, key=lambda u: u.get("created_at", "")):
        lines.append(f"[{u.get('status', '')} @ {u.get('created_at', '')}]\n{u.get('body', '')}")
    return "\n\n".join(lines) if lines else "(no updates recorded)"


def _call_groq(model: str, user_content: str, timeout: int = 30) -> dict:
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not set — refusing to call the interpretation model")
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        "max_tokens": 700,
        "reasoning_effort": "low",
        "temperature": 0,
    }
    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "status-quo/0.1 interpretation-pipeline",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


def _call_with_fallback(user_content: str) -> tuple[dict, str]:
    """Tries the primary model, falls back to the named fallback on failure.

    Returns (response_body, model_used) — model_used is what actually ran,
    stamped on the interpretation record regardless of which one it was.
    """
    last_err: Exception | None = None
    for attempt in range(2):
        try:
            return _call_groq(MODEL, user_content), MODEL
        except Exception as exc:
            last_err = exc
            logger.warning("primary model call failed (attempt %d): %s", attempt + 1, exc)
            time.sleep(2)
    logger.warning("primary model exhausted retries, falling back: %s", last_err)
    return _call_groq(FALLBACK_MODEL, user_content), FALLBACK_MODEL


def interpret_incident(incident: dict, trace_fn=None) -> dict:
    """Runs the tagging call for one incident, returns a fully-formed
    interpretation record ready for `db.insert_interpretation`.

    `trace_fn`, if given, is called with (model_used, user_content, parsed)
    for Langfuse tracing — kept as an injected callback so this module has
    no hard dependency on the Langfuse SDK being importable/configured.
    """
    metadata_text = format_metadata(incident)
    user_content = f"Metadata:\n{metadata_text}\n\nIncident update timeline:\n\n{incident_text(incident)}"

    body, model_used = _call_with_fallback(user_content)
    content = body["choices"][0]["message"]["content"]
    parsed = json.loads(content)  # let a malformed response raise — caller logs and skips

    if parsed.get("affected_surface") not in AFFECTED_SURFACE_ENUM:
        parsed["affected_surface"] = "other"

    if trace_fn is not None:
        trace_fn(model_used, user_content, parsed)

    metrics = compute_metrics(incident)

    return {
        "incident_id": incident.get("id"),
        "provider_id": incident.get("_provider_id"),
        "incident_updated_at_utc": incident.get("updated_at"),
        "title": parsed.get("title"),
        "summary": parsed.get("summary"),
        "affected_surface": parsed.get("affected_surface"),
        "fault_origin": parsed.get("fault_origin"),
        "workaround_offered": parsed.get("workaround_offered", False),
        "workaround": parsed.get("workaround"),
        **metrics,
        "model_used": model_used,
        "prompt_version": PROMPT_VERSION,
        "schema_version": SCHEMA_VERSION,
        "interpreted_at_utc": datetime.now(timezone.utc).isoformat(),
    }
