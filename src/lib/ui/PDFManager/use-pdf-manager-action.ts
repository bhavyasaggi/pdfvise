import type React from "react";
import { useCallback } from "react";

import type { PDFManagerMetaType, PDFManagerStoreType } from "./types";

import { getPDFManagerMeta } from "./utils";

export function usePDFManagerAction(
	_meta: PDFManagerMetaType,
	setMeta: (
		value:
			| PDFManagerMetaType
			| ((prev: PDFManagerMetaType) => PDFManagerMetaType),
	) => void,
	rootOptions?: {
		storeRef?: React.MutableRefObject<PDFManagerStoreType>;
		mode?: "default" | "firstPageOnly" | "imagesOnly" | "textOnly";
	},
) {
	const storeRef = rootOptions?.storeRef;
	const mode = rootOptions?.mode;

	const add = useCallback(
		async (file: File) => {
			if (!storeRef || !storeRef.current) {
				return;
			}
			try {
				setMeta((prev) => ({
					...prev,
					isLoading: true,
				}));

				const { parsePDFDocument } = await import("@/lib/utils/pdf");
				const {
					id: storeId,
					pdfDocument,
					pdfDocumentProxy,
				} = await parsePDFDocument(file);
				storeRef.current[storeId] = {
					file,
					pdfDocument,
					pdfDocumentProxy,
				};

				const additionalMetaData = await getPDFManagerMeta(
					{
						[storeId]: {
							file,
							pdfDocument,
							pdfDocumentProxy,
						},
					},
					{ mode: mode },
				);

				setMeta((prev) => ({
					...prev,
					isLoading: false,
					data: [...(prev.data || []), ...additionalMetaData],
				}));
			} catch (error) {
				console.error(error);
				setMeta((prev) => ({
					...prev,
					isLoading: false,
					error: error as Error,
				}));
			}
		},
		[setMeta, storeRef, mode],
	);

	const remove = useCallback(
		(fileOrId: File | string) => {
			if (!storeRef || !storeRef.current) {
				return;
			}
			const removeId: string | undefined =
				typeof fileOrId === "string"
					? fileOrId
					: Object.keys(storeRef.current).find(
							(key) => storeRef.current[key]?.file === fileOrId,
						);

			if (!removeId) {
				return;
			}

			delete storeRef.current[removeId];
			setMeta((prev) => ({
				...prev,
				data: prev.data?.filter((item) => item.id !== removeId),
			}));
		},
		[setMeta, storeRef],
	);

	const get = useCallback(
		(fileOrId: File | string) => {
			if (!storeRef || !storeRef.current) {
				return undefined;
			}
			const getId: string | undefined =
				typeof fileOrId === "string"
					? fileOrId
					: Object.keys(storeRef.current).find(
							(key) => storeRef.current[key]?.file === fileOrId,
						);
			if (!getId) {
				return undefined;
			}

			const item = storeRef.current[getId];
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

	return {
		add,
		remove,
		get,
	};
}
