import { css } from "../../../styled-system/css";

export const trendHeader = css({ display: "flex", justifyContent: "space-between", fontSize: "xs", color: "ink.700", mb: "1" });
export const trendCard = css({ bg: "cream.100", borderRadius: "md", p: "3", mb: "4" });
export const statsGrid = css({ display: "grid", gridTemplateColumns: { base: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" }, gap: "3", my: "4" });
export const statBox = css({ bg: "cream.100", borderRadius: "md", p: "3" });
export const statLabel = css({ fontSize: "xs", color: "ink.700" });
export const statValue = css({ fontSize: "xl", fontWeight: "600", fontFamily: "monospace" });

export const filterRow = css({
	display: "flex",
	flexDirection: { base: "column", sm: "row" },
	gap: "4",
	alignItems: { base: "stretch", sm: "center" },
	justifyContent: "space-between",
	my: "4",
});
export const rangeGroups = css({ display: "flex", flexWrap: "wrap", gap: "3", alignItems: "center" });
export const rangeGroup = css({ display: "flex", gap: "1", alignItems: "center", flexWrap: "wrap" });
export const rangeGroupLabel = css({ fontSize: "xs", color: "ink.700", mr: "1" });
export const rangeButton = (active: boolean) =>
	css({
		fontSize: "xs",
		px: "3",
		py: "1",
		borderRadius: "full",
		border: "1px solid",
		borderColor: active ? "blue.700" : "cream.300",
		bg: active ? "blue.700" : "white",
		color: active ? "white" : "ink.800",
		cursor: "pointer",
	});

export const comboboxRoot = css({ minW: { base: "100%", sm: "200px" }, w: { base: "100%", sm: "auto" } });
export const comboboxLabel = css({ position: "absolute", w: "1px", h: "1px", overflow: "hidden", clip: "rect(0,0,0,0)" });
export const comboboxControl = css({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "2",
	bg: "white",
	border: "1px solid",
	borderColor: "cream.300",
	borderRadius: "full",
	px: "4",
	py: "2",
	cursor: "pointer",
});
export const comboboxSummary = css({ fontSize: "sm", fontWeight: "600", color: "ink.900" });
export const comboboxTrigger = css({ border: "none", bg: "none", cursor: "pointer", color: "ink.700" });
export const comboboxContent = css({
	bg: "white",
	border: "1px solid",
	borderColor: "cream.300",
	borderRadius: "md",
	boxShadow: "lg",
	minW: "280px",
	maxH: "340px",
	overflowY: "auto",
	p: "2",
});
export const comboboxSearchInput = css({
	w: "100%",
	bg: "cream.50",
	border: "1px solid",
	borderColor: "cream.300",
	borderRadius: "full",
	px: "3",
	py: "1.5",
	fontSize: "sm",
	outline: "none",
	mb: "2",
});
export const comboboxItem = (dimmed: boolean) =>
	css({
		display: "flex",
		alignItems: "center",
		gap: "2",
		justifyContent: "space-between",
		px: "2",
		py: "1.5",
		borderRadius: "sm",
		fontSize: "sm",
		cursor: "pointer",
		opacity: dimmed ? "0.5" : "1",
		_hover: { bg: "cream.50" },
	});
export const comboboxCheckbox = css({ flexShrink: "0", w: "4" });
export const comboboxItemBadge = css({ fontSize: "xs", bg: "cream.200", color: "ink.700", px: "1.5", py: "0.5", borderRadius: "full" });
export const comboboxItemMeta = css({ color: "ink.700", opacity: "0.7", display: "flex", gap: "1.5", alignItems: "center", ml: "auto", fontFamily: "monospace", fontSize: "xs" });
export const comboboxFooter = css({ fontSize: "xs", color: "ink.700", opacity: "0.7", borderTop: "1px solid", borderColor: "cream.200", mt: "1", pt: "2", px: "2" });

export const feedList = css({ display: "flex", flexDirection: "column", gap: "3", listStyle: "none", m: "0", p: "0" });
export const card = (active: boolean) =>
	css({
		border: "1px solid",
		borderColor: active ? "blue.700" : "cream.200",
		boxShadow: active ? "0 0 0 2px var(--colors-blue-100)" : "none",
		borderRadius: "md",
		bg: "white",
	});
export const cardMain = css({
	textAlign: "left",
	p: "4",
	pb: "2",
	bg: "none",
	border: "none",
	cursor: "pointer",
	font: "inherit",
	width: "100%",
});
export const cardHeader = css({ display: "flex", gap: "2", alignItems: "center", justifyContent: "space-between", fontSize: "sm" });
export const badgeRow = css({ display: "flex", gap: "1.5", alignItems: "center", flexWrap: "wrap", mt: "1" });
export const cardTitle = css({ fontSize: "md", fontWeight: "600", mt: "2", mb: "1" });
export const cardSummary = css({ fontSize: "sm", color: "ink.700", lineHeight: "1.5", mb: "2" });
export const cardTimestamp = css({ fontSize: "xs", color: "ink.700", opacity: "0.6", fontFamily: "monospace", ml: "auto" });
export const cardFooter = css({
	display: "flex",
	justifyContent: "space-between",
	gap: "3",
	px: "4",
	py: "2.5",
	fontSize: "xs",
	borderTop: "1px solid",
	borderColor: "cream.100",
});

export const chip = (bg: string) => css({ fontSize: "xs", px: "2", py: "0.5", borderRadius: "full", bg });

export const providerName = css({ fontSize: "md", fontWeight: "600", color: "ink.900" });

// Panda statically extracts css() calls at build time and can't resolve a
// template-literal token like `${color}.100` — each colour needs its own
// literal call so the class actually gets generated.
const severityPillBase = { fontSize: "xs", px: "2", py: "0.5", borderRadius: "full", border: "1px solid" } as const;
const severityPillVariants: Record<string, string> = {
	red: css({ ...severityPillBase, bg: "red.50", color: "red.700", borderColor: "red.200" }),
	orange: css({ ...severityPillBase, bg: "orange.50", color: "orange.700", borderColor: "orange.200" }),
	amber: css({ ...severityPillBase, bg: "amber.50", color: "amber.700", borderColor: "amber.200" }),
	gray: css({ ...severityPillBase, bg: "gray.50", color: "gray.700", borderColor: "gray.200" }),
};
export const severityPill = (color: string) => severityPillVariants[color] ?? severityPillVariants.gray;

export const tagRow = css({ display: "flex", flexWrap: "wrap", gap: "1.5", mt: "1" });
export const tagChip = (positive: boolean) =>
	css({
		fontSize: "xs",
		px: "2",
		py: "0.5",
		borderRadius: "full",
		bg: positive ? "green.50" : "cream.100",
		color: positive ? "green.700" : "ink.700",
	});

export const showMoreWrap = css({ textAlign: "center", mt: "4" });
export const showMoreButton = css({
	fontSize: "sm",
	px: "4",
	py: "1.5",
	borderRadius: "full",
	border: "1px solid",
	borderColor: "cream.300",
	bg: "white",
	cursor: "pointer",
});
export const showMoreCaption = css({ fontSize: "xs", color: "ink.700", opacity: "0.6", mt: "1" });

export const emptyState = css({
	textAlign: "center",
	py: "6",
	px: "3",
	color: "ink.700",
	fontSize: "sm",
	border: "1px dashed",
	borderColor: "cream.300",
	borderRadius: "md",
});
export const emptyStateAction = css({
	display: "inline-block",
	mt: "2",
	fontSize: "sm",
	color: "blue.700",
	bg: "none",
	border: "none",
	cursor: "pointer",
	textDecoration: "underline",
	font: "inherit",
});

export const coverageSection = css({ mt: "6", p: "3", bg: "cream.100", borderRadius: "md" });
export const coverageLabel = css({ fontSize: "xs", color: "ink.700", mb: "2" });
export const coverageChips = css({ display: "flex", gap: "2", flexWrap: "wrap" });
export const coverageChip = (state: "reported" | "none" | "gap") =>
	css({
		fontSize: "xs",
		px: "2.5",
		py: "1",
		borderRadius: "full",
		border: "1px solid",
		borderColor: state === "gap" ? "red.300" : state === "none" ? "green.300" : "cream.300",
		color: state === "gap" ? "red.700" : state === "none" ? "green.700" : "ink.800",
		bg: state === "gap" ? "red.50" : state === "none" ? "green.50" : "white",
	});

export const dialogBackdrop = css({ position: "fixed", inset: "0", bg: "rgba(33, 30, 23, 0.55)" });
export const dialogPositioner = css({
	position: "fixed",
	inset: "0",
	display: "flex",
	alignItems: { base: "stretch", sm: "center" },
	justifyContent: "center",
	p: { base: "0", sm: "4" },
});
export const dialogContent = css({
	bg: "white",
	borderRadius: { base: "0", sm: "lg" },
	p: "6",
	maxW: { base: "100%", sm: "600px" },
	w: "100%",
	maxH: { base: "100%", sm: "85vh" },
	h: { base: "100%", sm: "auto" },
	overflowY: "auto",
});
export const dialogHeader = css({ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: "3" });
export const dialogHeaderTop = css({ display: "flex", gap: "2", alignItems: "center", flexWrap: "wrap" });
export const dialogTitle = css({ fontSize: "xl", fontWeight: "600", m: "0", mb: "2" });
export const dialogClose = css({
	border: "1px solid",
	borderColor: "cream.300",
	borderRadius: "full",
	bg: "none",
	w: "8",
	h: "8",
	fontSize: "sm",
	cursor: "pointer",
	flexShrink: "0",
});
export const dialogStatus = css({ fontSize: "sm", color: "ink.700", my: "2" });
export const dialogSummary = css({ fontSize: "sm", color: "ink.700", lineHeight: "1.6", mb: "4" });

export const dialogStatsGrid = css({ display: "grid", gridTemplateColumns: { base: "1fr 1fr", sm: "1fr 1fr" }, gap: "3", mb: "4" });
export const dialogStatBox = css({ bg: "cream.100", borderRadius: "md", p: "3" });
export const dialogStatLabel = css({ fontSize: "xs", color: "ink.700" });
export const dialogStatValue = css({ fontSize: "md", fontWeight: "600", fontFamily: "monospace" });

export const dialogProvenanceLabel = css({ fontSize: "xs", fontWeight: "700", letterSpacing: "wide", textTransform: "uppercase", color: "ink.700", mt: "4", mb: "2" });
export const dialogMeta = css({
	fontSize: "sm",
	color: "ink.800",
	display: "grid",
	gridTemplateColumns: "auto 1fr",
	gap: "1.5 3",
	bg: "cream.100",
	borderRadius: "md",
	p: "3",
	fontFamily: "monospace",
});
export const dialogLinks = css({ display: "flex", justifyContent: "space-between", gap: "4", mt: "4", pt: "3", borderTop: "1px solid", borderColor: "cream.200" });
export const dialogSourceLink = css({ fontSize: "sm", color: "blue.700" });
