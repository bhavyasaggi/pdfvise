import type React from "react";
import { useEffect, useRef, useState } from "react";

import type { PDFManagerMetaType, PDFManagerStoreType } from "./types";

import { getPDFManagerMeta } from "./utils";

export function usePDFManagerMeta(options: {
	storeRef?: React.MutableRefObject<PDFManagerStoreType>;
	mode?: "default" | "firstPageOnly" | "imagesOnly" | "textOnly";
}) {
	const storeRef = options?.storeRef;
	const optionsMode = options?.mode || "default";

	// TODO: lazy state initialization
	const [meta, setMeta] = useState<PDFManagerMetaType>({
		mode: options.mode || "default",
		data: undefined,
		isUninitialized: true,
		isLoading: true,
		error: undefined,
	});

	const isUninitializedMeta = Boolean(meta.isUninitialized);
	const uninitializedIdRef = useRef<string>("__UNINIT");
	useEffect(() => {
		let isStale = false;
		const effectId = Math.random().toString().slice(2, 10);
		if (
			storeRef?.current &&
			isUninitializedMeta &&
			uninitializedIdRef.current === "__UNINIT"
		) {
			uninitializedIdRef.current = effectId;
			getPDFManagerMeta(storeRef.current, { mode: optionsMode })
				.then((data) => {
					if (isStale || uninitializedIdRef.current !== effectId) {
						throw new Error(`Stale Request: ${JSON.stringify(data)}`);
					} else {
						setMeta((prevMeta) => ({
							...prevMeta,
							data,
							isUninitialized: false,
							isLoading: false,
							error: undefined,
						}));
					}
				})
				.catch((error) => {
					console.error(error);
					if (!isStale && uninitializedIdRef.current === effectId) {
						setMeta((prevMeta) => ({
							...prevMeta,
							data: undefined,
							isUninitialized: false,
							isLoading: false,
							error: error as Error,
						}));
					}
				});
		}
		return () => {
			isStale = true;
		};
	}, [isUninitializedMeta, optionsMode, storeRef]);

	useEffect(() => {
		if (storeRef?.current && !meta.isUninitialized && !meta.isLoading) {
			Object.keys(storeRef.current).forEach((key) => {
				if (!meta.data?.find((item) => item.id === key)) {
					delete storeRef.current[key];
				}
			});
		}
	}, [meta, storeRef]);

	return [meta, setMeta] as const;
}
