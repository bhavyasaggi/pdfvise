import { useEffect, useMemo } from "react";

export function useObjectUrl(object: Blob | File | null) {
	const localUrl = useMemo(
		() => (object ? URL.createObjectURL(object) : null),
		[object],
	);

	useEffect(() => {
		return () => {
			if (localUrl !== null) {
				URL.revokeObjectURL(localUrl);
			}
		};
	}, [localUrl]);

	return localUrl;
}
