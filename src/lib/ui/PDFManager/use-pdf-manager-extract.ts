import { useCallback } from "react";

import type { pdfjs } from "@/lib/utils/pdf";

import type { PDFManagerStoreType, PDFPageDataType } from "./types";

export function usePDFManagerExtract(options: {
	storeRef?: React.MutableRefObject<PDFManagerStoreType>;
	mode?: "default" | "firstPageOnly" | "imagesOnly" | "textOnly";
}) {
	const storeRef = options?.storeRef;

	const extractThumbnail = useCallback(
		(
			data: Pick<PDFPageDataType, "id" | "index">,
			options?: {
				maxDimension?: number;
				quality?: number;
			},
		) => {
			if (!storeRef?.current) {
				throw new Error("Store Context Not Loaded");
			}
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

			if (storeRef.current[id]) {
				storeRef.current[id].pageThumbnailCache ??= {};
				storeRef.current[id].pageThumbnailCache[pageThumbnailCacheKey] =
					thumbnailPromise;
			}

			return thumbnailPromise;
		},
		[storeRef],
	);

	const extractImage = useCallback(
		async (
			data: Pick<PDFPageDataType, "id" | "index">,
			options?: {
				maxDimension?: number;
				quality?: number;
				imageIndex?: number;
			},
		): Promise<Blob | null> => {
			if (!storeRef || !storeRef.current) {
				throw new Error("Store Context Not Loaded");
			}

			const { id, index } = data;
			const maxDimension = options?.maxDimension || 1200;
			const quality = options?.quality || 0.8;
			const imageIndex = options?.imageIndex || 0;

			const { pdfDocumentProxy, pageThumbnailCache } =
				storeRef.current[id] || {};
			if (!pdfDocumentProxy) {
				throw new Error("PDF Document Not Loaded");
			}

			const imgCacheKey = `${id}-${index}-${imageIndex || 0}:${maxDimension}:${quality}`;
			if (pageThumbnailCache?.[imgCacheKey]) {
				return await pageThumbnailCache[imgCacheKey];
			}

			const { parsePDFEmbedImage } = await import("@/lib/utils/pdf");
			const pdfPageProxy = await (
				pdfDocumentProxy as pdfjs.PDFDocumentProxy
			).getPage(index + 1);
			const { argsArray } = await pdfPageProxy.getOperatorList();

			const imgPromise = Promise.resolve(argsArray[imageIndex][0])
				.then((imgFn) => {
					if (!imgFn) {
						throw new Error("Image Not Found");
					}
					return parsePDFEmbedImage(pdfPageProxy, imgFn);
				})
				.then((img) => {
					if (!img) {
						return null;
					}

					const scale =
						Math.min(maxDimension / img.width, maxDimension / img.height) || 1;

					const canvas = window.document.createElement("canvas");
					canvas.height = img.height * scale;
					canvas.width = img.width * scale;

					const ctx = canvas.getContext("2d");
					if (!ctx) {
						return null;
					}

					if (img.bitmap) {
						ctx.drawImage(img.bitmap, 0, 0, canvas.width, canvas.height);
					} else if (img.data) {
						ctx.putImageData(
							new ImageData(
								Uint8ClampedArray.from(img.data),
								img.width,
								img.height,
							),
							0,
							0,
						);
						ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height);
					} else {
						return null;
					}

					return new Promise<Blob | null>((resolve, reject) => {
						try {
							canvas.toBlob(resolve, "image/png", quality);
						} catch (error) {
							reject(error);
						}
					});
				});

			if (storeRef.current[id]) {
				storeRef.current[id].pageThumbnailCache ??= {};
				storeRef.current[id].pageThumbnailCache[imgCacheKey] = imgPromise;
			}

			return await imgPromise;
		},
		[storeRef],
	);

	const extractText = useCallback(async () => {}, []);

	return {
		extractThumbnail,
		extractImage,
		extractText,
	};
}
