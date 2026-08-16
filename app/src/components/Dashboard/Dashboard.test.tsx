import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Dashboard from "./Dashboard";
import type { CoverageEntry, Incident } from "../../lib/types";

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString();

function makeIncident(overrides: Partial<Incident>): Incident {
	return {
		incident_id: "i1",
		provider_id: "github",
		provider_name: "GitHub",
		title: "Elevated error rates",
		summary: "Something happened.",
		affected_surface: "api",
		tags: ["api"],
		workaround_offered: false,
		workaround: null,
		severity: "minor",
		source_url: "https://stspg.io/abc",
		source_is_fallback: false,
		status: "resolved",
		is_open: false,
		is_retroactive: false,
		created_at: hoursAgo(10),
		resolved_at: hoursAgo(9),
		duration_hours: 1,
		time_to_first_update_min: 5,
		updates_per_hour: 2,
		component_count: 1,
		incident_updated_at_utc: hoursAgo(9),
		model_used: "openai/gpt-oss-120b",
		prompt_version: "v3",
		schema_version: "v3",
		interpreted_at_utc: hoursAgo(9),
		is_provenance_exception: false,
		...overrides,
	};
}

function statValue(label: string): string | null {
	const labelEl = screen.getByText(label);
	return labelEl.nextElementSibling?.textContent ?? null;
}

const coverage: CoverageEntry[] = [
	{ provider_id: "github", provider_name: "GitHub", collection_start_utc: hoursAgo(200), last_success_utc: hoursAgo(1), last_attempt_utc: hoursAgo(1), gaps: [] },
	{ provider_id: "netlify", provider_name: "Netlify", collection_start_utc: hoursAgo(200), last_success_utc: hoursAgo(1), last_attempt_utc: hoursAgo(1), gaps: [{ start: hoursAgo(20), end: hoursAgo(10) }] },
];

describe("Dashboard", () => {
	it("counts only incidents within the selected range", () => {
		const incidents = [
			makeIncident({ incident_id: "recent", incident_updated_at_utc: hoursAgo(2) }),
			makeIncident({ incident_id: "old", incident_updated_at_utc: hoursAgo(24 * 40) }), // outside 7d default
		];
		render(<Dashboard incidents={incidents} coverage={coverage} dataAsOfLabel="2026-08-16 00:00 UTC" />);
		expect(statValue("Incidents in window")).toBe("1"); // only "recent" falls in the 7d default window
	});

	it("switching to 90d range includes previously out-of-window incidents", () => {
		const incidents = [makeIncident({ incident_id: "old", incident_updated_at_utc: hoursAgo(24 * 40) })];
		render(<Dashboard incidents={incidents} coverage={coverage} dataAsOfLabel="2026-08-16 00:00 UTC" />);
		expect(statValue("Incidents in window")).toBe("0"); // not in 7d default window
		fireEvent.click(screen.getByRole("button", { name: "90d" }));
		expect(statValue("Incidents in window")).toBe("1"); // now included
	});

	it("opens the detail modal with the incident's title when a card is clicked", () => {
		const incidents = [makeIncident({ incident_id: "recent", title: "Real title here", incident_updated_at_utc: hoursAgo(2) })];
		render(<Dashboard incidents={incidents} coverage={coverage} dataAsOfLabel="2026-08-16 00:00 UTC" />);
		fireEvent.click(screen.getByRole("button", { name: /Real title here/ }));
		expect(screen.getAllByText("Real title here").length).toBeGreaterThan(0);
	});

	it("flags a provider with a collection gap in the coverage strip", () => {
		render(<Dashboard incidents={[]} coverage={coverage} dataAsOfLabel="2026-08-16 00:00 UTC" />);
		expect(screen.getByText(/Netlify.*collection gap/)).toBeTruthy();
	});
});
