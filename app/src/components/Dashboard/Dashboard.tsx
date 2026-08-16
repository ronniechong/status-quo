import { useMemo, useState } from "react";
import { Combobox, Dialog, createListCollection } from "@ark-ui/react";
import { IntlProvider, useIntl, type IntlShape } from "react-intl";
import TrendChart from "../TrendChart/TrendChart";
import type { CoverageEntry, Incident } from "../../lib/types";
import { medianDurationHours, formatDuration, formatUtcDate, formatUtcDateTime, dailyCounts, reportErrorUrl, severityColorScale } from "../../lib/incidents";
import { useHashRoute } from "../../lib/useHashRoute";
import { useLocale } from "../../lib/useLocale";
import * as s from "./Dashboard.css";

interface Props {
	incidents: Incident[];
	coverage: CoverageEntry[];
	dataAsOfIso: string;
}

const RANGE_GROUPS = [
	{ label: "Recent", ranges: [{ label: "24h", hours: 24 }, { label: "48h", hours: 48 }] },
	{
		label: "History",
		ranges: [
			{ label: "7d", hours: 24 * 7 },
			{ label: "30d", hours: 24 * 30 },
			{ label: "90d", hours: 24 * 90 },
		],
	},
];

const FEED_PAGE_SIZE = 10;
const WEEK_MS = 7 * 86_400_000;

function formatCardTimestamp(intl: IntlShape, incident: Incident): string {
	const iso = incident.created_at ?? incident.incident_updated_at_utc;
	if (!iso) return "";
	const label = formatUtcDate(intl, iso);
	return incident.duration_hours !== null ? `${label} · ${formatDuration(intl, incident.duration_hours)}` : label;
}

export default function Dashboard(props: Props) {
	const locale = useLocale();
	return (
		<IntlProvider locale={locale} defaultLocale="en-US">
			<DashboardInner {...props} />
		</IntlProvider>
	);
}

function DashboardInner({ incidents, coverage, dataAsOfIso }: Props) {
	const intl = useIntl();
	const dataAsOfLabel = formatUtcDateTime(intl, dataAsOfIso);
	const [rangeHours, setRangeHours] = useState(24 * 7);
	const [selectedProviders, setSelectedProviders] = useState<string[]>(coverage.map((c) => c.provider_id));
	const [feedShown, setFeedShown] = useState(FEED_PAGE_SIZE);
	const [providerSearch, setProviderSearch] = useState("");

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

	const filteredProviderItems = useMemo(
		() => providerCollection.items.filter((item) => item.label.toLowerCase().includes(providerSearch.toLowerCase())),
		[providerCollection, providerSearch],
	);

	function selectRange(hours: number) {
		setRangeHours(hours);
		setFeedShown(FEED_PAGE_SIZE);
	}

	return (
		<div>
			<div className={s.statsGrid}>
				<Stat label="Incidents in window" value={intl.formatNumber(windowIncidents.length)} />
				<Stat label="Providers affected" value={`${intl.formatNumber(providersAffected)}/${intl.formatNumber(coverage.length)}`} />
				<Stat label="Median duration" value={formatDuration(intl, median)} />
				<Stat label="Open at last check" value={intl.formatNumber(openIncidents.length)} />
			</div>

			<div className={s.trendCard}>
				<div className={s.trendHeader}>
					<span>Incidents per day, last 30 days</span>
					<span>Shaded = selected window</span>
				</div>
				<TrendChart data={trend} selectedWindowDays={selectedWindowDays} locale={intl.locale} />
			</div>

			<div className={s.filterRow}>
				<div className={s.rangeGroups}>
					{RANGE_GROUPS.map((group) => (
						<div key={group.label} className={s.rangeGroup} role="group" aria-label={`${group.label} time range`}>
							<span className={s.rangeGroupLabel}>{group.label}</span>
							{group.ranges.map((r) => (
								<button
									key={r.label}
									onClick={() => selectRange(r.hours)}
									className={s.rangeButton(rangeHours === r.hours)}
									aria-pressed={rangeHours === r.hours}
								>
									{r.label}
								</button>
							))}
						</div>
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
					inputValue={providerSearch}
					onInputValueChange={(details) => setProviderSearch(details.inputValue)}
					className={s.comboboxRoot}
				>
					<Combobox.Label className={s.comboboxLabel}>Providers</Combobox.Label>
					<Combobox.Control className={s.comboboxControl}>
						<Combobox.Trigger className={s.comboboxTrigger}>
							<span className={s.comboboxSummary}>
								{selectedProviders.length === coverage.length ? "All providers" : `${intl.formatNumber(selectedProviders.length)} providers`}
							</span>
							<span aria-hidden="true">▾</span>
						</Combobox.Trigger>
					</Combobox.Control>
					<Combobox.Positioner>
						<Combobox.Content className={s.comboboxContent}>
							<Combobox.Input placeholder="Search providers" className={s.comboboxSearchInput} />
							{filteredProviderItems.map((item) => {
								const count = windowIncidents.filter((i) => i.provider_id === item.value).length;
								const entry = coverage.find((c) => c.provider_id === item.value);
								const hasGap = (entry?.gaps.length ?? 0) > 0;
								const weeksCollected = entry?.collection_start_utc
									? Math.round((Date.now() - Date.parse(entry.collection_start_utc)) / WEEK_MS)
									: null;
								const isShortHistory = weeksCollected !== null && weeksCollected < 8;
								return (
									<Combobox.Item key={item.value} item={item} className={s.comboboxItem(count === 0)}>
										<Combobox.ItemIndicator className={s.comboboxCheckbox}>✓</Combobox.ItemIndicator>
										<Combobox.ItemText>{item.label}</Combobox.ItemText>
										<span className={s.comboboxItemMeta}>
											{isShortHistory && <span className={s.comboboxItemBadge}>{intl.formatNumber(weeksCollected)} wks</span>}
											{hasGap && (
												<span title="collection gap" aria-label="collection gap">
													⚠
												</span>
											)}
											{count === 0 ? "none" : `${intl.formatNumber(count)} incident${count === 1 ? "" : "s"}`}
										</span>
									</Combobox.Item>
								);
							})}
							<div className={s.comboboxFooter}>
								{providerSearch
									? `${intl.formatNumber(filteredProviderItems.length)} of ${intl.formatNumber(providerCollection.items.length)} match '${providerSearch}' · `
									: ""}
								counts are for the selected window
							</div>
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
				<ul className={s.feedList}>
					{feed.map((incident) => {
						const key = `${incident.provider_id}-${incident.incident_id}`;
						const isActive = openIncident !== null && openIncident.provider_id === incident.provider_id && openIncident.incident_id === incident.incident_id;
						return (
							<li key={key} className={s.card(isActive)}>
								<button onClick={() => openIncidentModal(incident)} className={s.cardMain}>
									<div className={s.cardHeader}>
										<strong className={s.providerName}>{incident.provider_name}</strong>
										<span className={s.cardTimestamp}>{formatCardTimestamp(intl, incident)}</span>
									</div>
									<h3 className={s.cardTitle}>{incident.title ?? "(untitled)"}</h3>
									{incident.summary && <p className={s.cardSummary}>{incident.summary}</p>}
									<div className={s.badgeTagRow}>
										<div className={s.badgeRow}>
											<StatusBadge incident={incident} dataAsOfLabel={dataAsOfLabel} />
											{incident.severity && (
												<span className={s.severityPill(severityColorScale(incident.severity))}>
													{incident.provider_name}: {incident.severity}
												</span>
											)}
										</div>
										<TagRow incident={incident} />
									</div>
								</button>
								<div className={s.cardFooter}>
									<a href={incident.source_url ?? "#"} className={s.dialogSourceLink} onClick={(e) => e.stopPropagation()}>
										↗ {incident.source_is_fallback ? "Provider status page" : "Source"}
									</a>
									<a
										href={reportErrorUrl(incident, permalinkFor(incident))}
										className={s.dialogSourceLink}
										onClick={(e) => e.stopPropagation()}
									>
										⚑ Report an error
									</a>
								</div>
							</li>
						);
					})}
				</ul>
			)}

			{feedShown < windowIncidents.length && (
				<div className={s.showMoreWrap}>
					<button onClick={() => setFeedShown((n) => n + FEED_PAGE_SIZE)} className={s.showMoreButton}>
						Show more
					</button>
					<div className={s.showMoreCaption}>
						Showing {intl.formatNumber(feed.length)} of {intl.formatNumber(windowIncidents.length)} incidents
					</div>
				</div>
			)}

			<section className={s.coverageSection}>
				<div className={s.coverageLabel}>Coverage in this window</div>
				<div className={s.coverageChips}>
					{coverage.map((c) => {
						const count = windowIncidents.filter((i) => i.provider_id === c.provider_id).length;
						const hasGap = c.gaps.length > 0;
						const state = hasGap ? "gap" : count > 0 ? "reported" : "none";
						return (
							<span key={c.provider_id} className={s.coverageChip(state)}>
								{hasGap ? "⚠ " : "✓ "}
								{c.provider_name} — {hasGap ? "collection gap" : count > 0 ? `${intl.formatNumber(count)} reported` : "none reported"}
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
									<div className={s.dialogHeaderTop}>
										<strong className={s.providerName}>{openIncident.provider_name}</strong>
										<StatusBadge incident={openIncident} dataAsOfLabel={dataAsOfLabel} />
									</div>
									<Dialog.CloseTrigger aria-label="Close" className={s.dialogClose}>
										✕
									</Dialog.CloseTrigger>
								</div>
								<Dialog.Title className={s.dialogTitle}>{openIncident.title ?? "(untitled)"}</Dialog.Title>
								{openIncident.summary && <p className={s.dialogSummary}>{openIncident.summary}</p>}

								<div className={s.dialogStatsGrid}>
									<DialogStat label="Severity (provider's own)" value={openIncident.severity ?? "—"} />
									<DialogStat label="Duration" value={formatDuration(intl, openIncident.duration_hours)} />
									<DialogStat
										label="Time to first update"
										value={
											openIncident.time_to_first_update_min !== null
												? `${intl.formatNumber(openIncident.time_to_first_update_min)} min`
												: "—"
										}
									/>
									<DialogStat
										label="Updates · Components"
										value={
											openIncident.component_count !== null
												? `${openIncident.updates_per_hour !== null ? intl.formatNumber(Math.round(openIncident.updates_per_hour * (openIncident.duration_hours ?? 1))) : "—"} updates · ${intl.formatNumber(openIncident.component_count)} components`
												: "—"
										}
									/>
								</div>

								<TagRow incident={openIncident} />

								<div className={s.dialogProvenanceLabel}>Provenance</div>
								<dl className={s.dialogMeta}>
									<dt>Model</dt>
									<dd>{openIncident.model_used}</dd>
									<dt>Prompt version</dt>
									<dd>{openIncident.prompt_version}</dd>
									<dt>Schema version</dt>
									<dd>{openIncident.schema_version}</dd>
									<dt>Interpreted at</dt>
									<dd>{formatUtcDateTime(intl, openIncident.interpreted_at_utc)}</dd>
								</dl>

								<div className={s.dialogLinks}>
									<a href={openIncident.source_url ?? "#"} className={s.dialogSourceLink}>
										↗ {openIncident.source_is_fallback ? "Provider status page" : "Source"}
									</a>
									<a href={reportErrorUrl(openIncident, permalinkFor(openIncident))} className={s.dialogSourceLink}>
										⚑ Report an error
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

function TagRow({ incident }: { incident: Incident }) {
	// The pipeline already writes the workaround status into `tags` (e.g.
	// "no workaround"/"workaround offered") — don't append it a second time.
	return (
		<div className={s.tagRow}>
			{incident.tags.map((tag) => (
				<span key={tag} className={s.tagChip(tag === "workaround offered")}>
					{tag}
				</span>
			))}
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

function DialogStat({ label, value }: { label: string; value: string }) {
	return (
		<div className={s.dialogStatBox}>
			<div className={s.dialogStatLabel}>{label}</div>
			<div className={s.dialogStatValue}>{value}</div>
		</div>
	);
}

function StatusBadge({ incident, dataAsOfLabel }: { incident: Incident; dataAsOfLabel: string }) {
	if (incident.is_open) return <span className={s.chip("amber.100")}>Open as of {dataAsOfLabel}</span>;
	if (incident.is_retroactive) return <span className={s.chip("purple.100")}>Published after resolution</span>;
	return <span className={s.chip("green.100")}>Resolved</span>;
}
