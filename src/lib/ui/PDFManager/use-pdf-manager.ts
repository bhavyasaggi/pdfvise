import { useCallback, useEffect, useRef, useState } from "react";
import type { pdflib } from "@/lib/utils/pdf";
import type { PDFManagerStoreType, PDFPageDataType } from "./types";

const getPageMeta = (page: pdflib.PDFPage) => {
	const itemSize = page.getSize();
	const itemCropBox = page.getCropBox();
	const itemPosition = page.getPosition();
	const itemRotation = page.getRotation();

	return {
		height: itemSize.height,
		width: itemSize.width,
		cropTop: itemSize.height - itemCropBox.y,
		cropLeft: itemCropBox.x,
		cropBottom: itemCropBox.y,
		cropRight: itemSize.width - itemCropBox.x,
		positionBottom: itemPosition.y,
		positionLeft: itemPosition.x,
		rotation:
			itemRotation.type === "degrees"
				? itemRotation.angle
				: (itemRotation.angle * 180) / Math.PI,
	};
};

export function usePDFManager(
	initStore?: PDFManagerStoreType,
	options?: {
		firstPageOnly?: boolean;
	},
) {
	const storeRef = useRef<PDFManagerStoreType>(initStore ?? {});
	const optionsRef = useRef<{
		firstPageOnly?: boolean;
	}>(options ?? {});

	const [meta, setMeta] = useState<{
		data?: PDFPageDataType[];
		isLoading?: boolean;
		error?: Error;
	}>({
		data: initStore
			? Object.entries(initStore).flatMap(([id, item]) => {
					return (item.pdfDocument as pdflib.PDFDocument)
						.getPages()
						.slice(0, optionsRef.current?.firstPageOnly ? 1 : undefined)
						.map((localPage, index) => ({
							id,
							index,
							...getPageMeta(localPage),
						}));
				})
			: undefined,
		isLoading: false,
		error: undefined,
	});

	const add = useCallback(async (file: File) => {
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

			const additionalPageData = pdfDocument
				.getPages()
				.slice(0, optionsRef.current?.firstPageOnly ? 1 : undefined)
				.map((localPage, index) => ({
					id: storeId,
					index,
					...getPageMeta(localPage),
				}));

			setMeta((prev) => ({
				...prev,
				isLoading: false,
				data: [...(prev.data || []), ...additionalPageData],
			}));
		} catch (error) {
			console.error(error);
			setMeta((prev) => ({
				...prev,
				isLoading: false,
				error: error as Error,
			}));
		}
	}, []);

	const remove = useCallback((fileOrId: File | string) => {
		const removeId: string | undefined =
			typeof fileOrId === "string"
				? fileOrId
				: Object.keys(storeRef.current).find(
						(key) => storeRef.current[key].file === fileOrId,
					);

		if (!removeId) {
			return;
		}

		delete storeRef.current[removeId];
		setMeta((prev) => ({
			...prev,
			data: prev.data?.filter((item) => item.id !== removeId),
		}));
	}, []);

	const get = useCallback((fileOrId: File | string) => {
		const getId: string | undefined =
			typeof fileOrId === "string"
				? fileOrId
				: Object.keys(storeRef.current).find(
						(key) => storeRef.current[key].file === fileOrId,
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
	}, []);

	const getThumbnail = useCallback(
		(
			data: Pick<PDFPageDataType, "id" | "index">,
			options?: {
				maxDimension?: number;
				quality?: number;
			},
		) => {
			const { id, index } = data;
			const maxDimension = options?.maxDimension || 1200;
			const quality = options?.quality || 0.8;

			const { pdfDocumentProxy, pageThumbnailCache } =
				storeRef.current[id] || {};
			const pageThumbnailCacheKey = `${id}-${index}:${maxDimension}:${quality}`;
			if (pageThumbnailCache?.[pageThumbnailCacheKey]) {
				return pageThumbnailCache[pageThumbnailCacheKey];
			}

			if (!pdfDocumentProxy) {
				throw new Error("PDF Document Not Loaded");
			}

			const thumbnailPromise = (async () => {
				const pageProxy = await pdfDocumentProxy.getPage(index + 1);
				const viewport = pageProxy.getViewport({ scale: 1 });
				const scale =
					Math.min(
						maxDimension / viewport.width,
						maxDimension / viewport.height,
					) || 1;

				const canvas = window.document.createElement("canvas");
				canvas.height = viewport.height * scale;
				canvas.width = viewport.width * scale;

				await pageProxy.render({
					canvas: canvas,
					viewport: pageProxy.getViewport({ scale }),
				}).promise;
				const pageThumbnail = await new Promise<Blob | null>(
					(resolve, reject) => {
						try {
							canvas.toBlob(resolve, "image/jpeg", quality);
						} catch (error) {
							reject(error);
						}
					},
				);
				return pageThumbnail;
			})();

			storeRef.current[id].pageThumbnailCache ??= {};
			storeRef.current[id].pageThumbnailCache[pageThumbnailCacheKey] =
				thumbnailPromise;

			return thumbnailPromise;
		},
		[],
	);

	useEffect(() => {
		Object.keys(storeRef.current).forEach((key) => {
			if (!meta.data?.find((item) => item.id === key)) {
				delete storeRef.current[key];
			}
		});
	}, [meta]);

	return {
		add,
		remove,
		get,
		getThumbnail,
		setMeta,
		meta,
	};
}
