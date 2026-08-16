import { useCallback, useEffect, useState } from "react";

// Lightweight pushState-backed routing for modals on a single-page static
// site (spec §10/§12: both the incident detail modal and "How this works"
// need a real URL so they're shareable, and browser back must close them).
// No router library — there's exactly two routes, both modal state.
export function useHashRoute() {
	const [hash, setHash] = useState(() => (typeof window !== "undefined" ? window.location.hash : ""));

	useEffect(() => {
		const onPop = () => setHash(window.location.hash);
		window.addEventListener("popstate", onPop);
		window.addEventListener("hashchange", onPop);
		return () => {
			window.removeEventListener("popstate", onPop);
			window.removeEventListener("hashchange", onPop);
		};
	}, []);

	const navigate = useCallback((next: string) => {
		if (window.location.hash === next) return;
		window.history.pushState(null, "", next || window.location.pathname + window.location.search);
		setHash(next);
	}, []);

	const close = useCallback(() => {
		if (!window.location.hash) return;
		window.history.back();
	}, []);

	return { hash, navigate, close };
}
