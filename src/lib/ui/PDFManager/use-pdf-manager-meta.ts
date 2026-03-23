import type { MutableRefObject } from "react";
import { useEffect, useState } from "react";

import { toError } from "@/lib/utils/pdf-geometry";

import type { PDFManagerMetaType, PDFManagerStoreType } from "./types";

import { getPDFManagerMeta } from "./utils";

export function usePDFManagerMeta(options: {
	storeRef?: MutableRefObject<PDFManagerStoreType>;
	mode?: PDFManagerMetaType["mode"];
}) {
	const storeRef = options.storeRef;
	const optionsMode = options.mode ?? "default";

	const [meta, setMeta] = useState<PDFManagerMetaType>(() => ({
		mode: optionsMode,
		data: undefined,
		isUninitialized: true,
		isLoading: true,
		error: undefined,
		notice: undefined,
	}));

	const isUninitializedMeta = meta.isUninitialized;
	useEffect(() => {
		if (!storeRef?.current || !isUninitializedMeta) {
			return;
		}
		let isStale = false;
		getPDFManagerMeta(storeRef.current, { mode: optionsMode })
			.then((data) => {
				if (isStale) {
					return;
				}
				const opened = Object.keys(storeRef?.current ?? {}).length > 0;
				const nothingRead = opened && data.length === 0;
				setMeta((prevMeta) => ({
					...prevMeta,
					data: nothingRead ? undefined : data,
					isUninitialized: false,
					isLoading: false,
					notice: undefined,
					error: nothingRead
						? new Error(
								optionsMode === "imagesOnly"
									? "No images were found in this PDF."
									: "This PDF has no pages.",
							)
						: undefined,
				}));
			})
			.catch((error: unknown) => {
				const nextError = toError(error);
				console.error(nextError);
				if (!isStale) {
					setMeta((prevMeta) => ({
						...prevMeta,
						data: undefined,
						isUninitialized: false,
						isLoading: false,
						notice: undefined,
						error: nextError,
					}));
				}
			});
		return () => {
			isStale = true;
		};
	}, [isUninitializedMeta, optionsMode, storeRef]);

	useEffect(() => {
		const store = storeRef?.current;
		if (!store || meta.isUninitialized || meta.isLoading || !meta.data) {
			return;
		}
		for (const key of Object.keys(store)) {
			if (!meta.data.some((item) => item.id === key)) {
				const removed = store[key];
				delete store[key];
				void removed?.pdfDocumentProxy.destroy();
			}
		}
	}, [meta, storeRef]);

	return [meta, setMeta] as const;
}
