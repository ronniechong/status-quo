import { css } from "../../../styled-system/css";

export const provenanceBar = css({
	display: "flex",
	flexWrap: "wrap",
	gap: "2",
	justifyContent: "space-between",
	bg: "cream.100",
	borderRadius: "md",
	px: "3",
	py: "3",
	my: "4",
	fontSize: "sm",
	color: "ink.700",
});
export const provenanceLink = css({ color: "blue.700" });

const pulse = { animation: "pulse 1.6s ease-in-out infinite" };

export const skeletonBar = css({ ...pulse, bg: "cream.200", borderRadius: "md", h: "3", mb: "2" });
export const skeletonBlock = css({ ...pulse, bg: "cream.100", borderRadius: "md" });
export const skeletonStatsGrid = css({ display: "grid", gridTemplateColumns: { base: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" }, gap: "3", my: "4" });
export const skeletonStat = css({ ...pulse, bg: "cream.100", borderRadius: "md", h: "70px" });
export const skeletonChart = css({ ...pulse, bg: "cream.100", borderRadius: "md", h: "196px", my: "4" });
export const skeletonCards = css({ display: "flex", flexDirection: "column", gap: "3" });
export const skeletonCard = css({ ...pulse, bg: "cream.100", borderRadius: "md", h: "140px" });

export const errorState = css({
	textAlign: "center",
	py: "10",
	px: "4",
	color: "ink.800",
	fontSize: "md",
	border: "1px dashed",
	borderColor: "red.300",
	borderRadius: "md",
	my: "4",
});
export const retryButton = css({
	display: "inline-block",
	ml: "2",
	fontSize: "md",
	color: "blue.700",
	bg: "none",
	border: "none",
	cursor: "pointer",
	textDecoration: "underline",
	font: "inherit",
});
