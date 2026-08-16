// Client-safe pure functions — no Node built-ins, importable from both
// Astro frontmatter (server) and React islands (browser). Data loading
// (fs-based) lives in loader.ts instead, which only .astro files import.
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

export function formatDuration(hours: number | null): string {
	if (hours === null) return "—";
	if (hours < 1) return `${Math.round(hours * 60)}m`;
	return `${hours.toFixed(1)}h`;
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
