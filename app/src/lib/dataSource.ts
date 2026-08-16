import type { CoverageEntry, Incident, Meta } from "./types";

// Data is committed to a top-level `dashboard-data/` directory (outside
// `app/`, deliberately) by a separate GitHub Actions workflow that pulls
// from HuggingFace on its own schedule — decoupled from this app's own
// build/deploy so new data never needs a Pages redeploy to reach visitors.
// raw.githubusercontent.com serves committed files with CORS already open.
const DATA_BASE_URL = "https://raw.githubusercontent.com/ronniechong/status-quo/main/dashboard-data";

async function fetchJson<T>(file: string): Promise<T> {
	const res = await fetch(`${DATA_BASE_URL}/${file}`, { cache: "no-store" });
	if (!res.ok) throw new Error(`Failed to fetch ${file}: ${res.status}`);
	return res.json();
}

export function fetchMeta(): Promise<Meta> {
	return fetchJson<Meta>("meta.json");
}

export async function fetchDashboardData(): Promise<{ meta: Meta; incidents: Incident[]; coverage: CoverageEntry[] }> {
	const [meta, incidents, coverage] = await Promise.all([
		fetchJson<Meta>("meta.json"),
		fetchJson<Incident[]>("incidents.json"),
		fetchJson<CoverageEntry[]>("coverage.json"),
	]);
	return { meta, incidents, coverage };
}
