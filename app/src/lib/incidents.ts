// Client-safe pure functions — no Node built-ins, importable from both
// Astro frontmatter (server) and React islands (browser). Data loading
// (fs-based) lives in loader.ts instead, which only .astro files import.
import type { IntlShape } from "react-intl";
import type { DailyCount, Incident } from "./types";

export type { DailyCount } from "./types";

// Windowing uses incident_updated_at_utc as the recency signal — the raw
// pipeline doesn't store a separate "occurred" timestamp distinct from the
// source's own update timestamp, so this is what's actually available.
export function withinWindow(incidents: Incident[], hours: number): Incident[] {
	const cutoff = Date.now() - hours * 3600_000;
	return incidents.filter((i) => {
		const t = i.incident_updated_at_utc ? Date.parse(i.incident_updated_at_utc) : null;
		return t !== null && t >= cutoff;
	});
}

export function medianDurationHours(incidents: Incident[]): number | null {
	const durations = incidents
		.map((i) => i.duration_hours)
		.filter((d): d is number => d !== null && d !== undefined)
		.sort((a, b) => a - b);
	if (durations.length === 0) return null;
	const mid = Math.floor(durations.length / 2);
	return durations.length % 2 === 0 ? (durations[mid - 1] + durations[mid]) / 2 : durations[mid];
}

// Only the numeral goes through Intl (locale-correct digits/decimal
// separator) — the "m"/"h" suffix stays a literal. Intl's unit-style
// "narrow" display depends on CLDR data that isn't guaranteed identical
// between Node's bundled ICU (build-time SSR) and the browser's (client
// hydration), which was producing real hydration mismatches.
export function formatDuration(intl: IntlShape, hours: number | null): string {
	if (hours === null) return "—";
	if (hours < 1) return `${intl.formatNumber(Math.round(hours * 60))}m`;
	return `${intl.formatNumber(hours, { maximumFractionDigits: 1 })}h`;
}

// Shown in the viewer's own local timezone (not a fixed UTC), per user
// request — the datetime variant labels the zone explicitly (via
// timeZoneName) so a screenshot shared across timezones isn't ambiguous
// about what time it actually shows. `dailyCounts` below stays bucketed in
// UTC regardless — that's a computed daily aggregate, not a display string,
// and changing its bucketing has its own tradeoffs.
export function formatLocalDate(intl: IntlShape, iso: string): string {
	return intl.formatDate(iso, { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function formatLocalDateTime(intl: IntlShape, iso: string): string {
	const date = intl.formatDate(iso, { year: "numeric", month: "2-digit", day: "2-digit" });
	const time = intl.formatTime(iso, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "short" });
	return `${date} ${time}`;
}

const ISSUE_REPO = "ronniechong/status-quo";

// Prefills GitHub's Issue Form (correction.yml) via query params — one per
// form field id — so a correction ships with the model's actual output and
// version stamps attached, not free prose that needs hand-transcribing
// later (spec §11).
export function reportErrorUrl(incident: Incident, permalink: string): string {
	const params = new URLSearchParams({
		template: "correction.yml",
		incident_id: incident.incident_id,
		provider: incident.provider_name,
		dashboard_permalink: permalink,
		model_output: [incident.title, incident.summary].filter(Boolean).join("\n\n"),
		model_used: incident.model_used,
		prompt_version: incident.prompt_version,
		schema_version: incident.schema_version,
	});
	return `https://github.com/${ISSUE_REPO}/issues/new?${params.toString()}`;
}

// Fixed 30-day window, independent of the selected filter range — spec §7:
// answers "is this window unusual", which needs a stable baseline.
export function dailyCounts(incidents: Incident[], days = 30): DailyCount[] {
	const today = new Date();
	const dayMs = 86_400_000;
	const buckets = new Map<string, number>();
	for (let i = days - 1; i >= 0; i--) {
		const d = new Date(today.getTime() - i * dayMs);
		buckets.set(d.toISOString().slice(0, 10), 0);
	}
	for (const incident of incidents) {
		if (!incident.incident_updated_at_utc) continue;
		const key = incident.incident_updated_at_utc.slice(0, 10);
		if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
	}
	return [...buckets.entries()].map(([date, count]) => ({ date, count }));
}

// Severity is the provider's own word, never a model judgement (spec §9) —
// this only maps their vocabulary to a colour bucket for scannability, it
// doesn't rank or compare severity across providers.
export function severityColorScale(severity: string | null): string {
	if (!severity) return "gray";
	const s = severity.toLowerCase();
	if (/(critical|major|outage)/.test(s)) return "red";
	if (/(degraded|minor|partial)/.test(s)) return "orange";
	if (/(none|resolved|operational)/.test(s)) return "gray";
	return "amber";
}
