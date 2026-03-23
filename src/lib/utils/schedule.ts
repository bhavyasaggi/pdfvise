/** Lets the browser paint a loading state before a long PDF task. */
export function yieldToMain(): Promise<void> {
	const scheduler = (
		globalThis as {
			scheduler?: { yield?: () => Promise<void> };
		}
	).scheduler;
	if (typeof scheduler?.yield === "function") {
		return scheduler.yield();
	}
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
}
