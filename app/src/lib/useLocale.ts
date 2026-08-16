import { useEffect, useState } from "react";

// SSG build has no `navigator`, so the first client render must match the
// server's deterministic default (en-US) or React logs a hydration
// mismatch — the real locale is picked up a tick later, after mount.
const DEFAULT_LOCALE = "en-US";

export function useLocale(): string {
	const [locale, setLocale] = useState(DEFAULT_LOCALE);
	useEffect(() => {
		if (typeof navigator !== "undefined" && navigator.language) setLocale(navigator.language);
	}, []);
	return locale;
}
