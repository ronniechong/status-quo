import fs from "node:fs";
import path from "node:path";

export interface Incident {
	incident_id: string;
	provider_id: string;
	provider_name: string;
	title: string | null;
	summary: string | null;
	affected_surface: string | null;
	tags: string[];
	workaround_offered: boolean;
	workaround: string | null;
	severity: string | null;
	source_url: string | null;
	source_is_fallback: boolean;
	status: string;
	is_open: boolean;
	is_retroactive: boolean;
	created_at: string | null;
	resolved_at: string | null;
	duration_hours: number | null;
	time_to_first_update_min: number | null;
	updates_per_hour: number | null;
	component_count: number | null;
	incident_updated_at_utc: string | null;
	model_used: string;
	prompt_version: string;
	schema_version: string;
	interpreted_at_utc: string;
	is_provenance_exception: boolean;
}

export interface CoverageEntry {
	provider_id: string;
	provider_name: string;
	collection_start_utc: string | null;
	last_success_utc: string | null;
	last_attempt_utc: string | null;
	gaps: { start: string; end: string }[];
}

export interface Meta {
	generated_at_utc: string;
	default_model: string;
	default_prompt_version: string;
	default_schema_version: string;
	incident_count: number;
}

const DATA_DIR = path.resolve("public/data");

function readJson<T>(file: string): T {
	return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
}

export function loadMeta(): Meta {
	return readJson<Meta>("meta.json");
}

export function loadIncidents(): Incident[] {
	return readJson<Incident[]>("incidents.json");
}

export function loadCoverage(): CoverageEntry[] {
	return readJson<CoverageEntry[]>("coverage.json");
}

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

export interface DailyCount {
	date: string; // YYYY-MM-DD, UTC
	count: number;
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

export function formatDuration(hours: number | null): string {
	if (hours === null) return "—";
	if (hours < 1) return `${Math.round(hours * 60)}m`;
	return `${hours.toFixed(1)}h`;
}
