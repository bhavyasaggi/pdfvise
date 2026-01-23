import { useEffect, useState } from "react";

type State = {
	isIntersecting: boolean;
	entry?: IntersectionObserverEntry;
};

type IntersectionReturn = [
	(node?: Element | null) => void,
	boolean,
	IntersectionObserverEntry | undefined,
];

export function useIntersectionObserver(): IntersectionReturn {
	const [ref, setRef] = useState<Element | null>(null);

	const [state, setState] = useState<State>(() => ({
		isIntersecting: false,
		entry: undefined,
	}));

	const frozen = state.entry?.isIntersecting;

	useEffect(() => {
		// Ensure we have a ref to observe
		if (!ref) return;

		// Ensure the browser supports the Intersection Observer API
		if (!("IntersectionObserver" in window)) return;

		// Skip if frozen
		if (frozen) return;

		let unobserve: (() => void) | undefined;

		const observer = new IntersectionObserver(
			(entries: IntersectionObserverEntry[]): void => {
				const thresholds = Array.isArray(observer.thresholds)
					? observer.thresholds
					: [observer.thresholds];

				entries.forEach((entry) => {
					const isIntersecting =
						entry.isIntersecting &&
						thresholds.some(
							(threshold) => entry.intersectionRatio >= threshold,
						);

					setState({ isIntersecting, entry });

					if (isIntersecting && unobserve) {
						unobserve();
						unobserve = undefined;
					}
				});
			},
		);

		observer.observe(ref);

		return () => {
			observer.disconnect();
		};
	}, [ref, frozen]);

	return [
		setRef,
		Boolean(state.isIntersecting),
		state.entry,
	] as IntersectionReturn;
}
