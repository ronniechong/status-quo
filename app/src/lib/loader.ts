// Server-only (fs-based) — import this from .astro frontmatter only, never
// from a React island. See incidents.ts for the client-safe pure functions.
import fs from "node:fs";
import path from "node:path";
import type { CoverageEntry, Incident, Meta } from "./types";

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
