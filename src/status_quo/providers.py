"""Provider cohort configuration.

The cohort is 10 Atlassian Statuspage instances (see the private project's
M0 spike). All 10 share the same `/api/v2/incidents.json` schema, so
`platform_type` is carried for forward compatibility with a future,
non-Statuspage cohort rather than branching any behaviour today.
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
]
