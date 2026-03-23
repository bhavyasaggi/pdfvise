import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useCallback } from "react";

import { toError } from "@/lib/utils/pdf-geometry";
import { yieldToMain } from "@/lib/utils/schedule";

import type { PDFManagerMetaType, PDFManagerStoreType } from "./types";

import { getPDFManagerMeta } from "./utils";

export function usePDFManagerAction(
	setMeta: Dispatch<SetStateAction<PDFManagerMetaType>>,
	rootOptions?: {
		storeRef?: MutableRefObject<PDFManagerStoreType>;
		mode?: PDFManagerMetaType["mode"];
	},
) {
	const storeRef = rootOptions?.storeRef;
	const mode = rootOptions?.mode;

	const add = useCallback(
		async (file: File) => {
			const store = storeRef?.current;
			if (!store) {
				return;
			}
			setMeta((prev) => ({
				...prev,
				isLoading: true,
				error: undefined,
				notice: undefined,
			}));
			await yieldToMain();
			try {
				const { parsePDFDocument } = await import("@/lib/utils/pdf");
				const parsed = await parsePDFDocument(file);
				const record = {
					file: parsed.file,
					pdfDocument: parsed.pdfDocument,
					pdfDocumentProxy: parsed.pdfDocumentProxy,
				};
				const additionalMetaData = await getPDFManagerMeta(
					{ [parsed.id]: record },
					{ mode },
				);
				if (additionalMetaData.length === 0) {
					await parsed.pdfDocumentProxy.destroy();
					setMeta((prev) => ({
						...prev,
						isLoading: false,
						notice: undefined,
						error: new Error(
							mode === "imagesOnly"
								? "No images were found in this PDF."
								: "This PDF has no pages.",
						),
					}));
					return;
				}
				store[parsed.id] = record;
				setMeta((prev) => ({
					...prev,
					isLoading: false,
					error: undefined,
					notice: undefined,
					data: [...(prev.data ?? []), ...additionalMetaData],
				}));
			} catch (error) {
				const nextError = toError(error);
				console.error(nextError);
				setMeta((prev) => ({
					...prev,
					isLoading: false,
					notice: undefined,
					error: nextError,
				}));
			}
		},
		[setMeta, storeRef, mode],
	);

	const remove = useCallback(
		(fileOrId: File | string) => {
			const store = storeRef?.current;
			if (!store) {
				return;
			}
			const removeId =
				typeof fileOrId === "string"
					? fileOrId
					: Object.keys(store).find((key) => store[key]?.file === fileOrId);
			if (!removeId) {
				return;
			}
			const removed = store[removeId];
			delete store[removeId];
			void removed?.pdfDocumentProxy.destroy();
			setMeta((prev) => ({
				...prev,
				data: prev.data?.filter((item) => item.id !== removeId),
			}));
		},
		[setMeta, storeRef],
	);

	const get = useCallback(
		(fileOrId: File | string) => {
			const store = storeRef?.current;
			if (!store) {
				return undefined;
			}
			const getId =
				typeof fileOrId === "string"
					? fileOrId
					: Object.keys(store).find((key) => store[key]?.file === fileOrId);
			const item = getId ? store[getId] : undefined;
			if (!item) {
				return undefined;
			}
			return {
				file: item.file,
				pdfDocument: item.pdfDocument,
				pdfDocumentProxy: item.pdfDocumentProxy,
			};
		},
		[storeRef],
	);

	return { add, remove, get };
}
