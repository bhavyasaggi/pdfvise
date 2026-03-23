import { OPS, type PDFDocumentProxy, type PDFPageProxy } from "pdfjs-dist";

export type PdfImage = {
	width: number;
	height: number;
	data: Uint8ClampedArray | null;
	bitmap?: ImageBitmap;
};

const IMAGE_OPERATORS = new Set<number>([
	OPS.paintImageXObject,
	OPS.paintImageXObjectRepeat,
	OPS.paintInlineImageXObject,
]);

function isPdfImage(value: unknown): value is PdfImage {
	if (!value || typeof value !== "object") {
		return false;
	}
	const record = value as { width?: unknown; height?: unknown };
	return typeof record.width === "number" && typeof record.height === "number";
}

export async function parsePDFEmbedImage(
	pdfPageProxy: PDFPageProxy,
	imgFn: string,
): Promise<PdfImage | undefined> {
	const fromPage = await readObject(pdfPageProxy.objs, imgFn);
	if (fromPage) {
		return fromPage;
	}
	return readObject(pdfPageProxy.commonObjs, imgFn);
}

function readObject(
	store: PDFPageProxy["objs"],
	imgFn: string,
): Promise<PdfImage | undefined> {
	return new Promise((resolve) => {
		try {
			if (!store.has(imgFn)) {
				resolve(undefined);
				return;
			}
			store.get(imgFn, (value: unknown) => {
				resolve(isPdfImage(value) ? value : undefined);
			});
		} catch (error) {
			console.error(error);
			resolve(undefined);
		}
	});
}

export async function readPDFEmbedImage(
	pdfPageProxy: PDFPageProxy,
	opIndex: number,
) {
	const { fnArray, argsArray } = await pdfPageProxy.getOperatorList();
	const operator = fnArray[opIndex];
	const args = argsArray[opIndex];
	if (operator === undefined || !IMAGE_OPERATORS.has(operator) || !args) {
		return undefined;
	}
	if (operator === OPS.paintInlineImageXObject) {
		return isPdfImage(args[0]) ? args[0] : undefined;
	}
	const objectId = args[0];
	if (typeof objectId !== "string") {
		return undefined;
	}
	return parsePDFEmbedImage(pdfPageProxy, objectId);
}

export async function* extractPDFEmbedImages(
	pdfDocumentProxy: PDFDocumentProxy,
) {
	let currentPage = 0;
	while (currentPage < pdfDocumentProxy.numPages) {
		const pdfPageProxy = await pdfDocumentProxy.getPage(currentPage + 1);
		const { fnArray } = await pdfPageProxy.getOperatorList();
		let currentPageImage = 0;
		while (currentPageImage < fnArray.length) {
			const operator = fnArray[currentPageImage];
			if (operator !== undefined && IMAGE_OPERATORS.has(operator)) {
				const img = await readPDFEmbedImage(pdfPageProxy, currentPageImage);
				if (img) {
					yield {
						pageIndex: currentPage,
						imageIndex: currentPageImage,
						width: img.width,
						height: img.height,
						data: img.data,
						bitmap: img.bitmap,
					};
				}
			}
			currentPageImage += 1;
		}
		currentPage += 1;
	}
}
