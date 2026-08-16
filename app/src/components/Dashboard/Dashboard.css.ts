import { css } from "../../../styled-system/css";

export const trendHeader = css({ display: "flex", justifyContent: "space-between", fontSize: "xs", color: "gray.500", mb: "1" });
export const statsGrid = css({ display: "grid", gridTemplateColumns: { base: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" }, gap: "3", my: "4" });
export const statBox = css({ border: "1px solid", borderColor: "gray.200", borderRadius: "md", p: "3" });
export const statLabel = css({ fontSize: "xs", color: "gray.500" });
export const statValue = css({ fontSize: "xl", fontWeight: "600" });

export const filterRow = css({ display: "flex", flexDirection: { base: "column", sm: "row" }, gap: "4", alignItems: { base: "stretch", sm: "center" }, my: "4" });
export const rangeGroup = css({ display: "flex", gap: "1", flexWrap: "wrap" });
export const rangeButton = (active: boolean) =>
	css({
		fontSize: "xs",
		px: "3",
		py: "1",
		borderRadius: "full",
		border: "1px solid",
		borderColor: "gray.300",
		bg: active ? "blue.700" : "white",
		color: active ? "white" : "gray.700",
		cursor: "pointer",
	});

export const comboboxRoot = css({ minW: { base: "100%", sm: "260px" }, w: { base: "100%", sm: "auto" } });
export const comboboxLabel = css({ fontSize: "xs", color: "gray.500" });
export const comboboxControl = css({ display: "flex", border: "1px solid", borderColor: "gray.300", borderRadius: "md", px: "2", py: "0.5" });
export const comboboxInput = css({ border: "none", outline: "none", fontSize: "sm", flex: "1" });
export const comboboxTrigger = css({ border: "none", bg: "none", cursor: "pointer" });
export const comboboxContent = css({
	bg: "white",
	border: "1px solid",
	borderColor: "gray.300",
	borderRadius: "md",
	boxShadow: "md",
	maxH: "260px",
	overflowY: "auto",
});
export const comboboxItem = css({ display: "flex", justifyContent: "space-between", px: "3", py: "1.5", fontSize: "sm", cursor: "pointer" });
export const comboboxItemMeta = css({ color: "gray.400", display: "flex", gap: "1.5", alignItems: "center" });

export const feedList = css({ display: "flex", flexDirection: "column", gap: "3" });
export const card = css({ border: "1px solid", borderColor: "gray.200", borderRadius: "md", bg: "white" });
export const cardMain = css({
	textAlign: "left",
	p: "3",
	pb: "1",
	bg: "none",
	border: "none",
	cursor: "pointer",
	font: "inherit",
	width: "100%",
});
export const cardHeader = css({ display: "flex", gap: "2", alignItems: "center", fontSize: "sm", flexWrap: "wrap" });
export const cardTitle = css({ fontSize: "md", fontWeight: "600", my: "1" });
export const cardFooter = css({ display: "flex", gap: "3", px: "3", pb: "2", fontSize: "xs" });

export const chip = (bg: string) => css({ fontSize: "xs", px: "2", py: "0.5", borderRadius: "full", bg });

export const showMoreWrap = css({ textAlign: "center", mt: "4" });
export const showMoreButton = css({
	fontSize: "sm",
	px: "4",
	py: "1.5",
	borderRadius: "md",
	border: "1px solid",
	borderColor: "gray.300",
	bg: "white",
	cursor: "pointer",
});
export const showMoreCaption = css({ fontSize: "xs", color: "gray.400", mt: "1" });

export const emptyState = css({
	textAlign: "center",
	py: "6",
	px: "3",
	color: "gray.500",
	fontSize: "sm",
	border: "1px dashed",
	borderColor: "gray.300",
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

export const coverageSection = css({ mt: "6", p: "3", bg: "gray.50", borderRadius: "md" });
export const coverageLabel = css({ fontSize: "xs", color: "gray.500", mb: "2" });
export const coverageChips = css({ display: "flex", gap: "2", flexWrap: "wrap" });
export const coverageChip = (hasGap: boolean) =>
	css({
		fontSize: "xs",
		px: "2.5",
		py: "1",
		borderRadius: "full",
		border: "1px solid",
		borderColor: hasGap ? "red.300" : "gray.300",
		color: hasGap ? "red.700" : "gray.700",
		bg: hasGap ? "red.50" : "white",
	});

export const dialogBackdrop = css({ position: "fixed", inset: "0", bg: "blackAlpha.400" });
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
	borderRadius: { base: "0", sm: "md" },
	p: "5",
	maxW: { base: "100%", sm: "560px" },
	w: "100%",
	maxH: { base: "100%", sm: "80vh" },
	h: { base: "100%", sm: "auto" },
	overflowY: "auto",
});
export const dialogHeader = css({ display: "flex", justifyContent: "space-between", alignItems: "flex-start" });
export const dialogTitle = css({ fontSize: "lg", fontWeight: "600", m: "0" });
export const dialogClose = css({ border: "none", bg: "none", fontSize: "lg", cursor: "pointer" });
export const dialogStatus = css({ fontSize: "sm", color: "gray.500", my: "2" });
export const dialogSummary = css({ fontSize: "sm" });
export const dialogMeta = css({ fontSize: "sm", color: "gray.700", display: "grid", gridTemplateColumns: "auto 1fr", gap: "1 3" });
export const dialogLinks = css({ display: "flex", gap: "4", mt: "2" });
export const dialogSourceLink = css({ fontSize: "sm", color: "blue.700" });
