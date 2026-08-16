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

export interface DailyCount {
	date: string; // YYYY-MM-DD, UTC
	count: number;
}

export interface Meta {
	generated_at_utc: string;
	default_model: string;
	default_prompt_version: string;
	default_schema_version: string;
	incident_count: number;
}
