"""Provider cohort configuration.

The cohort is 24 Atlassian Statuspage instances (10 from the private
project's M0 spike, plus 14 added later — see the private project's
decisions table for the addition). All share the same `/api/v2/incidents.json`
schema, so `platform_type` is carried for forward compatibility with a
future, non-Statuspage cohort rather than branching any behaviour today.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Provider:
    id: str
    url: str
    platform_type: str
    poll_cadence_hours: int


PROVIDERS: list[Provider] = [
    Provider("github", "https://www.githubstatus.com/api/v2/incidents.json", "statuspage", 6),
    Provider("cloudflare", "https://www.cloudflarestatus.com/api/v2/incidents.json", "statuspage", 6),
    Provider("discord", "https://discordstatus.com/api/v2/incidents.json", "statuspage", 6),
    Provider("reddit", "https://www.redditstatus.com/api/v2/incidents.json", "statuspage", 6),
    Provider("vercel", "https://www.vercel-status.com/api/v2/incidents.json", "statuspage", 6),
    Provider("linear", "https://linearstatus.com/api/v2/incidents.json", "statuspage", 6),
    Provider("notion", "https://www.notion-status.com/api/v2/incidents.json", "statuspage", 6),
    Provider("netlify", "https://www.netlifystatus.com/api/v2/incidents.json", "statuspage", 6),
    Provider("digitalocean", "https://status.digitalocean.com/api/v2/incidents.json", "statuspage", 6),
    Provider("npm", "https://status.npmjs.org/api/v2/incidents.json", "statuspage", 6),
    Provider("stripe", "https://www.stripestatus.com/api/v2/incidents.json", "statuspage", 6),
    Provider("dropbox", "https://status.dropbox.com/api/v2/incidents.json", "statuspage", 6),
    Provider("twilio", "https://status.twilio.com/api/v2/incidents.json", "statuspage", 6),
    Provider("openai", "https://status.openai.com/api/v2/incidents.json", "statuspage", 6),
    # Anthropic's status page moved from status.anthropic.com (still 301s
    # here) to status.claude.com — using the resolved URL directly.
    Provider("anthropic", "https://status.claude.com/api/v2/incidents.json", "statuspage", 6),
    Provider("datadog", "https://status.datadoghq.com/api/v2/incidents.json", "statuspage", 6),
    Provider("circleci", "https://status.circleci.com/api/v2/incidents.json", "statuspage", 6),
    Provider("figma", "https://status.figma.com/api/v2/incidents.json", "statuspage", 6),
    Provider("asana", "https://status.asana.com/api/v2/incidents.json", "statuspage", 6),
    Provider("sentry", "https://status.sentry.io/api/v2/incidents.json", "statuspage", 6),
    Provider("supabase", "https://status.supabase.com/api/v2/incidents.json", "statuspage", 6),
    Provider("render", "https://status.render.com/api/v2/incidents.json", "statuspage", 6),
    Provider("hashicorp", "https://status.hashicorp.com/api/v2/incidents.json", "statuspage", 6),
    # zoom.us's status page redirects (302) to zoomstatus.com — using the
    # resolved URL directly.
    Provider("zoom", "https://www.zoomstatus.com/api/v2/incidents.json", "statuspage", 6),
]
