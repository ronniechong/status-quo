import { useMemo, useState } from "react";
import { Combobox, Dialog, createListCollection } from "@ark-ui/react";
import TrendChart from "../TrendChart/TrendChart";
import type { CoverageEntry, Incident } from "../../lib/types";
import { medianDurationHours, formatDuration, dailyCounts, reportErrorUrl } from "../../lib/incidents";
import { useHashRoute } from "../../lib/useHashRoute";
import * as s from "./Dashboard.css";

interface Props {
	incidents: Incident[];
	coverage: CoverageEntry[];
	dataAsOfLabel: string;
}

const RANGES = [
	{ label: "24h", hours: 24 },
	{ label: "48h", hours: 48 },
	{ label: "7d", hours: 24 * 7 },
	{ label: "30d", hours: 24 * 30 },
	{ label: "90d", hours: 24 * 90 },
];

const FEED_PAGE_SIZE = 10;

export default function Dashboard({ incidents, coverage, dataAsOfLabel }: Props) {
	const [rangeHours, setRangeHours] = useState(24 * 7);
	const [selectedProviders, setSelectedProviders] = useState<string[]>(coverage.map((c) => c.provider_id));
	const [feedShown, setFeedShown] = useState(FEED_PAGE_SIZE);

	const { hash, navigate, close } = useHashRoute();
	const openIncident = useMemo(() => {
		const m = hash.match(/^#\/incident\/([^/]+)\/(.+)$/);
		if (!m) return null;
		const [, providerId, incidentId] = m;
		return incidents.find((i) => i.provider_id === providerId && i.incident_id === decodeURIComponent(incidentId)) ?? null;
	}, [hash, incidents]);

	function incidentHash(incident: Incident) {
		return `#/incident/${incident.provider_id}/${encodeURIComponent(incident.incident_id)}`;
	}

	function openIncidentModal(incident: Incident) {
		navigate(incidentHash(incident));
	}

	function permalinkFor(incident: Incident) {
		if (typeof window === "undefined") return incidentHash(incident);
		return `${window.location.origin}${window.location.pathname}${incidentHash(incident)}`;
	}

	const providerCollection = useMemo(
		() => createListCollection({ items: coverage.map((c) => ({ value: c.provider_id, label: c.provider_name })) }),
		[coverage],
	);

	const windowIncidents = useMemo(() => {
		const cutoff = Date.now() - rangeHours * 3600_000;
		const providerSet = new Set(selectedProviders);
		return incidents.filter((i) => {
			if (!providerSet.has(i.provider_id)) return false;
			const t = i.incident_updated_at_utc ? Date.parse(i.incident_updated_at_utc) : null;
			return t !== null && t >= cutoff;
		});
	}, [incidents, rangeHours, selectedProviders]);

	const providersAffected = new Set(windowIncidents.map((i) => i.provider_id)).size;
	const openIncidents = incidents.filter((i) => i.is_open && selectedProviders.includes(i.provider_id));
	const median = medianDurationHours(windowIncidents.filter((i) => !i.is_open));
	const trend = useMemo(() => dailyCounts(incidents.filter((i) => selectedProviders.includes(i.provider_id)), 30), [incidents, selectedProviders]);
	const selectedWindowDays = Math.min(30, Math.max(1, Math.round(rangeHours / 24)));

	const feed = windowIncidents.slice(0, feedShown);

	function selectRange(hours: number) {
		setRangeHours(hours);
		setFeedShown(FEED_PAGE_SIZE);
	}

	return (
		<div>
			<div className={s.trendHeader}>
				<span>Incidents per day, last 30 days</span>
				<span>Shaded = selected window</span>
			</div>
			<TrendChart data={trend} selectedWindowDays={selectedWindowDays} />

			<div className={s.statsGrid}>
				<Stat label="Incidents in window" value={String(windowIncidents.length)} />
				<Stat label="Providers affected" value={`${providersAffected}/${coverage.length}`} />
				<Stat label="Median duration" value={formatDuration(median)} />
				<Stat label="Open at last check" value={String(openIncidents.length)} />
			</div>

			<div className={s.filterRow}>
				<div className={s.rangeGroup} role="group" aria-label="Time range">
					{RANGES.map((r) => (
						<button key={r.label} onClick={() => selectRange(r.hours)} className={s.rangeButton(rangeHours === r.hours)} aria-pressed={rangeHours === r.hours}>
							{r.label}
						</button>
					))}
				</div>

				<Combobox.Root
					collection={providerCollection}
					multiple
					value={selectedProviders}
					onValueChange={(details) => {
						setSelectedProviders(details.value);
						setFeedShown(FEED_PAGE_SIZE);
					}}
					className={s.comboboxRoot}
				>
					<Combobox.Label className={s.comboboxLabel}>Providers</Combobox.Label>
					<Combobox.Control className={s.comboboxControl}>
						<Combobox.Input placeholder={`${selectedProviders.length} providers`} className={s.comboboxInput} />
						<Combobox.Trigger className={s.comboboxTrigger}>▾</Combobox.Trigger>
					</Combobox.Control>
					<Combobox.Positioner>
						<Combobox.Content className={s.comboboxContent}>
							{providerCollection.items.map((item) => {
								const count = windowIncidents.filter((i) => i.provider_id === item.value).length;
								const entry = coverage.find((c) => c.provider_id === item.value);
								const hasGap = (entry?.gaps.length ?? 0) > 0;
								return (
									<Combobox.Item key={item.value} item={item} className={s.comboboxItem}>
										<Combobox.ItemText>{item.label}</Combobox.ItemText>
										<span className={s.comboboxItemMeta}>
											{count}
											{hasGap && <span title="collection gap">⚠</span>}
											<Combobox.ItemIndicator>✓</Combobox.ItemIndicator>
										</span>
									</Combobox.Item>
								);
							})}
						</Combobox.Content>
					</Combobox.Positioner>
				</Combobox.Root>
			</div>

			{windowIncidents.length === 0 ? (
				<div className={s.emptyState} role="status">
					No incidents reported by the selected providers in this window.
					<br />
					<button
						className={s.emptyStateAction}
						onClick={() => {
							selectRange(24 * 90);
							setSelectedProviders(coverage.map((c) => c.provider_id));
						}}
					>
						Widen to 90 days, all providers
					</button>
				</div>
			) : (
			<div className={s.feedList}>
				{feed.map((incident) => (
					<div key={`${incident.provider_id}-${incident.incident_id}`} className={s.card}>
						<button onClick={() => openIncidentModal(incident)} className={s.cardMain}>
							<div className={s.cardHeader}>
								<strong>{incident.provider_name}</strong>
								<StatusBadge incident={incident} dataAsOfLabel={dataAsOfLabel} />
								{incident.severity && (
									<span className={s.chip("gray.100")}>
										{incident.provider_name}: {incident.severity}
									</span>
								)}
							</div>
							<h3 className={s.cardTitle}>{incident.title ?? "(untitled)"}</h3>
						</button>
						<div className={s.cardFooter}>
							<a href={incident.source_url ?? "#"} className={s.dialogSourceLink} onClick={(e) => e.stopPropagation()}>
								{incident.source_is_fallback ? "Provider status page" : "Source"}
							</a>
							<a
								href={reportErrorUrl(incident, permalinkFor(incident))}
								className={s.dialogSourceLink}
								onClick={(e) => e.stopPropagation()}
							>
								Report an error
							</a>
						</div>
					</div>
				))}
			</div>
			)}

			{feedShown < windowIncidents.length && (
				<div className={s.showMoreWrap}>
					<button onClick={() => setFeedShown((n) => n + FEED_PAGE_SIZE)} className={s.showMoreButton}>
						Show more
					</button>
					<div className={s.showMoreCaption}>
						Showing {feed.length} of {windowIncidents.length} incidents
					</div>
				</div>
			)}

			<section className={s.coverageSection}>
				<div className={s.coverageLabel}>Coverage in this window</div>
				<div className={s.coverageChips}>
					{coverage.map((c) => {
						const count = windowIncidents.filter((i) => i.provider_id === c.provider_id).length;
						const hasGap = c.gaps.length > 0;
						return (
							<span key={c.provider_id} className={s.coverageChip(hasGap)}>
								{hasGap ? "⚠ " : "✓ "}
								{c.provider_name} — {hasGap ? "collection gap" : count > 0 ? `${count} reported` : "none reported"}
							</span>
						);
					})}
				</div>
			</section>

			<Dialog.Root open={openIncident !== null} onOpenChange={(d) => !d.open && close()}>
				<Dialog.Backdrop className={s.dialogBackdrop} />
				<Dialog.Positioner className={s.dialogPositioner}>
					<Dialog.Content className={s.dialogContent}>
						{openIncident && (
							<>
								<div className={s.dialogHeader}>
									<Dialog.Title className={s.dialogTitle}>{openIncident.title ?? "(untitled)"}</Dialog.Title>
									<Dialog.CloseTrigger aria-label="Close" className={s.dialogClose}>
										✕
									</Dialog.CloseTrigger>
								</div>
								<div className={s.dialogStatus}>
									<StatusBadge incident={openIncident} dataAsOfLabel={dataAsOfLabel} />
								</div>
								{openIncident.summary && <p className={s.dialogSummary}>{openIncident.summary}</p>}
								<dl className={s.dialogMeta}>
									{openIncident.duration_hours !== null && (
										<>
											<dt>Duration</dt>
											<dd>{formatDuration(openIncident.duration_hours)}</dd>
										</>
									)}
									{openIncident.component_count !== null && (
										<>
											<dt>Components affected</dt>
											<dd>{openIncident.component_count}</dd>
										</>
									)}
									<dt>Model</dt>
									<dd>{openIncident.model_used}</dd>
									<dt>Prompt / schema</dt>
									<dd>
										{openIncident.prompt_version} / {openIncident.schema_version}
									</dd>
									<dt>Interpreted at</dt>
									<dd>{openIncident.interpreted_at_utc}</dd>
								</dl>
								<div className={s.dialogLinks}>
									<a href={openIncident.source_url ?? "#"} className={s.dialogSourceLink}>
										{openIncident.source_is_fallback ? "Provider status page ↗" : "Source ↗"}
									</a>
									<a href={reportErrorUrl(openIncident, permalinkFor(openIncident))} className={s.dialogSourceLink}>
										Report an error ↗
									</a>
								</div>
							</>
						)}
					</Dialog.Content>
				</Dialog.Positioner>
			</Dialog.Root>
		</div>
	);
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div className={s.statBox}>
			<div className={s.statLabel}>{label}</div>
			<div className={s.statValue}>{value}</div>
		</div>
	);
}

function StatusBadge({ incident, dataAsOfLabel }: { incident: Incident; dataAsOfLabel: string }) {
	if (incident.is_open) return <span className={s.chip("amber.100")}>Open as of {dataAsOfLabel}</span>;
	if (incident.is_retroactive) return <span className={s.chip("purple.100")}>Published after resolution</span>;
	return <span className={s.chip("green.100")}>Resolved</span>;
}
