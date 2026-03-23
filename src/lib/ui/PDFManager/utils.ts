import type { pdfjs } from "@/lib/utils/pdf";
import {
	cropInsetsFromBoxes,
	normalizeQuarterTurn,
} from "@/lib/utils/pdf-geometry";

import type { PDFManagerStoreType, PDFPageDataType } from "./types";

export function getPageMeta(page: import("pdf-lib").PDFPage) {
	const media = page.getMediaBox();
	const crop = page.getCropBox();
	const insets = cropInsetsFromBoxes(media, crop);
	return {
		width: media.width,
		height: media.height,
		...insets,
		rotation: normalizeQuarterTurn(page.getRotation().angle),
	};
}

export async function getPDFManagerMeta(
	initStore?: PDFManagerStoreType,
	options?: {
		mode?: "default" | "firstPageOnly" | "imagesOnly" | "textOnly";
	},
): Promise<PDFPageDataType[]> {
	if (!initStore) {
		return [];
	}

	const optionsMode = options?.mode ?? "default";
	if (optionsMode === "imagesOnly") {
		const { extractPDFEmbedImages } = await import("@/lib/utils/pdf");
		const returnData: PDFPageDataType[] = [];
		for (const [id, item] of Object.entries(initStore)) {
			const extractorPDFEmbedImages = extractPDFEmbedImages(
				item.pdfDocumentProxy as pdfjs.PDFDocumentProxy,
			);
			for await (const embedImageData of extractorPDFEmbedImages) {
				returnData.push({
					id,
					index: embedImageData.pageIndex,
					opIndex: embedImageData.imageIndex,
					height: embedImageData.height,
					width: embedImageData.width,
					cropTop: 0,
					cropLeft: 0,
					cropBottom: 0,
					cropRight: 0,
					rotation: 0,
				});
			}
		}
		return returnData;
	}

	const firstPageOnly = optionsMode === "firstPageOnly";
	return Object.entries(initStore).flatMap(([id, item]) => {
		return item.pdfDocument
			.getPages()
			.slice(0, firstPageOnly ? 1 : undefined)
			.map((localPage, index) => ({
				id,
				index,
				...getPageMeta(localPage),
			}));
	});
}
