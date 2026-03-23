import { lazy } from "react";

import SuspenseErrorBoundary from "@/lib/ui/SuspenseErrorBoundary";

const SectionScan = lazy(() => import("./index"));

function fallback(error?: Error) {
	if (error) {
		return <div role="alert">Error: {error.message}</div>;
	}
	return (
		<output aria-live="polite" aria-busy="true">
			Loading…
		</output>
	);
}

export default function SectionScanLazy() {
	return (
		<SuspenseErrorBoundary fallback={fallback}>
			<SectionScan />
		</SuspenseErrorBoundary>
	);
}
