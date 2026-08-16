import { css } from "../../../styled-system/css";

export const backdrop = css({ position: "fixed", inset: "0", zIndex: "40", bg: "rgba(33, 30, 23, 0.55)" });
export const positioner = css({
	position: "fixed",
	inset: "0",
	zIndex: "40",
	display: "flex",
	alignItems: { base: "stretch", sm: "center" },
	justifyContent: "center",
	p: { base: "0", sm: "4" },
});
export const content = css({
	bg: "white",
	borderRadius: { base: "0", sm: "lg" },
	p: "6",
	maxW: { base: "100%", sm: "640px" },
	w: "100%",
	maxH: { base: "100%", sm: "85vh" },
	h: { base: "100%", sm: "auto" },
	overflowY: "auto",
});
export const header = css({ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: "3" });
export const title = css({ fontSize: "2xl", fontWeight: "600", m: "0", color: "ink.900" });
export const close = css({
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
export const section = css({ mt: "5" });
export const heading = css({ fontSize: "xs", fontWeight: "700", letterSpacing: "wide", textTransform: "uppercase", color: "ink.700", mb: "2" });
export const body = css({ fontSize: "sm", color: "ink.800", lineHeight: "1.6" });
export const neverBox = css({ bg: "cream.100", borderRadius: "md", p: "4" });
export const neverList = css({ fontSize: "sm", color: "ink.800", pl: "5", lineHeight: "1.8", m: "0" });
export const admission = css({ fontSize: "sm", fontStyle: "italic", color: "ink.700", mt: "2" });
export const footer = css({ fontSize: "xs", color: "ink.700", mt: "5", pt: "3", borderTop: "1px solid", borderColor: "cream.300" });
export const link = css({ color: "blue.700" });
