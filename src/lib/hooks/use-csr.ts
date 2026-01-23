import { useSyncExternalStore } from "react";

function subscribeClean() {
	return;
}
function subscribe() {
	return subscribeClean;
}
function getSnapshot() {
	return true;
}
function getServerSnapshot() {
	return false;
}

export function useCSR() {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
