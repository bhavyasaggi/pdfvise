import type { pdfjs, pdflib } from "@/lib/utils/pdf";

import type { PDFManagerStoreType, PDFPageDataType } from "./types";

export const getPageMeta = (page: pdflib.PDFPage) => {
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

export const getPDFManagerMeta = async (
	initStore?: PDFManagerStoreType,
	options?: {
		mode?: "default" | "firstPageOnly" | "imagesOnly" | "textOnly";
	},
): Promise<PDFPageDataType[]> => {
	const optionsMode = options?.mode;
	if (!initStore) {
		return [];
	}

	const imagesOnly = optionsMode === "imagesOnly";
	if (imagesOnly) {
		// TODO: implement images only mode meta format
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

	const textOnly = optionsMode === "textOnly";
	if (textOnly) {
		throw new Error("Unsupported mode");
	}

	const firstPageOnly = optionsMode === "firstPageOnly";
	return Object.entries(initStore).flatMap(([id, item]) => {
		return (item.pdfDocument as pdflib.PDFDocument)
			.getPages()
			.slice(0, firstPageOnly ? 1 : undefined)
			.map((localPage, index) => ({
				id,
				index,
				...getPageMeta(localPage),
			}));
	});
};
