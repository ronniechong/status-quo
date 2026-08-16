import { css } from "../../../styled-system/css";

export const backdrop = css({ position: "fixed", inset: "0", bg: "blackAlpha.400" });
export const positioner = css({ position: "fixed", inset: "0", display: "flex", alignItems: "center", justifyContent: "center", p: "4" });
export const content = css({ bg: "white", borderRadius: "md", p: "6", maxW: "640px", w: "100%", maxH: "85vh", overflowY: "auto" });
export const header = css({ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: "3" });
export const title = css({ fontSize: "xl", fontWeight: "600", m: "0" });
export const close = css({ border: "none", bg: "none", fontSize: "lg", cursor: "pointer" });
export const section = css({ mt: "4" });
export const heading = css({ fontSize: "sm", fontWeight: "600", color: "gray.700", mb: "1" });
export const body = css({ fontSize: "sm", color: "gray.700", lineHeight: "1.5" });
export const neverList = css({ fontSize: "sm", color: "gray.800", pl: "5", lineHeight: "1.7" });
export const admission = css({ fontSize: "sm", fontStyle: "italic", color: "gray.600", mt: "2" });
export const footer = css({ fontSize: "xs", color: "gray.500", mt: "5", pt: "3", borderTop: "1px solid", borderColor: "gray.200" });
export const link = css({ color: "blue.700" });
