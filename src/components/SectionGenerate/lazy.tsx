import { lazy } from "react";

import SuspenseErrorBoundary from "@/lib/ui/SuspenseErrorBoundary";
import type { GenerateKind } from "@/lib/utils/pdf-generate";

const SectionGenerate = lazy(() => import("./index"));

function fallback(error?: Error) {
	if (error) {
		return <div>Error: {error.message}</div>;
	}
	return (
		<output aria-live="polite" aria-busy="true">
			Loading…
		</output>
	);
}

export default function SectionGenerateLazy(props: { kind: GenerateKind }) {
	return (
		<SuspenseErrorBoundary fallback={fallback}>
			<SectionGenerate kind={props.kind} />
		</SuspenseErrorBoundary>
	);
}
