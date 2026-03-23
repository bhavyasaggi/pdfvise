import type { MutableRefObject } from "react";
import { useCallback } from "react";

import { normalizeQuarterTurn } from "@/lib/utils/pdf-geometry";

import type {
	PDFManagerMetaType,
	PDFManagerStoreType,
	PDFPageDataType,
} from "./types";

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
	return new Promise<Blob | null>((resolve, reject) => {
		try {
			canvas.toBlob(resolve, type, quality);
		} catch (error) {
			reject(error);
		}
	});
}

export function usePDFManagerExtract(options: {
	storeRef?: MutableRefObject<PDFManagerStoreType>;
	mode?: PDFManagerMetaType["mode"];
}) {
	const storeRef = options.storeRef;

	const extractThumbnail = useCallback(
		(
			data: Pick<PDFPageDataType, "id" | "index">,
			options?: {
				maxDimension?: number;
				quality?: number;
				rotation?: number;
			},
		) => {
			const store = storeRef?.current;
			if (!store) {
				throw new Error("PDF store is not ready.");
			}
			const { id, index } = data;
			const maxDimension = options?.maxDimension ?? 1200;
			const quality = options?.quality ?? 0.8;
			const rotation = normalizeQuarterTurn(options?.rotation ?? 0);
			const entry = store[id];
			const pageThumbnailCacheKey = `${id}-${index}:${maxDimension}:${quality}:${rotation}`;
			const cached = entry?.pageThumbnailCache?.[pageThumbnailCacheKey];
			if (cached) {
				return cached;
			}
			if (!entry?.pdfDocumentProxy) {
				throw new Error("PDF document is not loaded.");
			}

			const thumbnailPromise = (async () => {
				const pageProxy = await entry.pdfDocumentProxy.getPage(index + 1);
				const base = pageProxy.getViewport({ scale: 1, rotation });
				const scale =
					Math.min(maxDimension / base.width, maxDimension / base.height) || 1;
				const viewport = pageProxy.getViewport({ scale, rotation });
				const canvas = document.createElement("canvas");
				canvas.height = viewport.height;
				canvas.width = viewport.width;
				await pageProxy.render({ canvas, viewport }).promise;
				return canvasBlob(canvas, "image/jpeg", quality);
			})();

			entry.pageThumbnailCache ??= {};
			entry.pageThumbnailCache[pageThumbnailCacheKey] = thumbnailPromise;
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
		) => {
			const store = storeRef?.current;
			if (!store) {
				throw new Error("PDF store is not ready.");
			}
			const { id, index } = data;
			const maxDimension = options?.maxDimension ?? 1200;
			const quality = options?.quality ?? 0.8;
			const imageIndex = options?.imageIndex ?? 0;
			const entry = store[id];
			if (!entry?.pdfDocumentProxy) {
				throw new Error("PDF document is not loaded.");
			}

			const imgCacheKey = `${id}-${index}-${imageIndex}:${maxDimension}:${quality}`;
			const cached = entry.pageThumbnailCache?.[imgCacheKey];
			if (cached) {
				return cached;
			}

			const imgPromise = (async () => {
				const { readPDFEmbedImage } = await import("@/lib/utils/pdf-image");
				const pdfPageProxy = await entry.pdfDocumentProxy.getPage(index + 1);
				const img = await readPDFEmbedImage(pdfPageProxy, imageIndex);
				if (!img) {
					return null;
				}
				const scale =
					Math.min(maxDimension / img.width, maxDimension / img.height) || 1;
				const canvas = document.createElement("canvas");
				canvas.width = Math.max(1, Math.round(img.width * scale));
				canvas.height = Math.max(1, Math.round(img.height * scale));
				const ctx = canvas.getContext("2d");
				if (!ctx) {
					return null;
				}
				if (img.bitmap) {
					ctx.drawImage(img.bitmap, 0, 0, canvas.width, canvas.height);
				} else if (img.data && img.data.length >= img.width * img.height * 4) {
					const source = document.createElement("canvas");
					source.width = img.width;
					source.height = img.height;
					const sourceCtx = source.getContext("2d");
					if (!sourceCtx) {
						return null;
					}
					const pixels = img.data.subarray(0, img.width * img.height * 4);
					sourceCtx.putImageData(
						new ImageData(new Uint8ClampedArray(pixels), img.width, img.height),
						0,
						0,
					);
					ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
				} else {
					return null;
				}
				return canvasBlob(canvas, "image/png", quality);
			})();

			entry.pageThumbnailCache ??= {};
			entry.pageThumbnailCache[imgCacheKey] = imgPromise;
			return imgPromise;
		},
		[storeRef],
	);

	const extractText = useCallback(
		async (data: Pick<PDFPageDataType, "id" | "index">) => {
			const proxy = storeRef?.current?.[data.id]?.pdfDocumentProxy;
			if (!proxy) {
				throw new Error("PDF document is not loaded.");
			}
			const page = await proxy.getPage(data.index + 1);
			const content = await page.getTextContent();
			const lines: string[] = [];
			let line = "";
			for (const item of content.items) {
				if (!("str" in item)) {
					continue;
				}
				line += item.str;
				if (item.hasEOL) {
					lines.push(line);
					line = "";
				}
			}
			if (line) {
				lines.push(line);
			}
			return lines.join("\n");
		},
		[storeRef],
	);

	return { extractThumbnail, extractImage, extractText };
}
