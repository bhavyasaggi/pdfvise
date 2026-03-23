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
		if (!ref) {
			return;
		}
		if (!("IntersectionObserver" in window)) {
			setState({ isIntersecting: true });
			return;
		}
		if (frozen) {
			return;
		}

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
