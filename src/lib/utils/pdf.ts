import * as pdflib from "pdf-lib";
import * as pdfjs from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import PDFLayoutFactory from "./pdf-layout";

// Configuration & Initialization

const getWorker = () => new Worker(pdfjsWorker, { type: "module" });
pdfjs.GlobalWorkerOptions.workerPort = getWorker();

// TODO: If file is Image, convert to pdfDocument & pdfDocumentProxy
// TODO: If file is Text, convert to pdfDocument & pdfDocumentProxy
// If File is PDF, parse to pdfDocument & pdfDocumentProxy
async function parsePDFDocument(file: File) {
	let pdfDocument: pdflib.PDFDocument | undefined;
	let pdfDocumentProxy: pdfjs.PDFDocumentProxy | undefined;

	const fileArrayBuffer = await file.arrayBuffer();

	if (file.type.startsWith("image/")) {
		// TODO: Convert Image to PDF
	}

	if (file.type.startsWith("text/")) {
		// TODO: Convert Text to PDF
	}

	if (file.type === "application/pdf") {
		[pdfDocument, pdfDocumentProxy] = await Promise.all([
			pdflib.PDFDocument.load(structuredClone(fileArrayBuffer), {
				ignoreEncryption: false,
				parseSpeed: pdflib.ParseSpeeds.Slow,
				throwOnInvalidObject: true,
				updateMetadata: false,
				capNumbers: false,
			}),
			pdfjs.getDocument(structuredClone(fileArrayBuffer)).promise,
		]);
	}

	if (
		!pdfDocument ||
		!pdfDocumentProxy ||
		pdfDocument.getPageCount() !== pdfDocumentProxy.numPages
	) {
		throw new Error("PDF Page Count Mismatch");
	}

	return {
		id: Math.random().toString(36).substring(2, 9),
		file,
		pdfDocument,
		pdfDocumentProxy,
	};
}

async function imposePDFPages(
	pages: Array<pdflib.PDFPage>,
	options?: {
		layout?: "4-zine" | "4-n-up";
		pageWidth?: number;
		pageHeight?: number;
		pageMarginLeft?: number;
		pageMarginRight?: number;
		pageMarginTop?: number;
		pageMarginBottom?: number;
		removeAnnotations?: boolean;
		flatten?: boolean;
		// TODO: Implement following options
		metaTitle?: string;
		metaSubject?: string;
		metaAuthor?: string;
		metaCreator?: string;
		metaProducer?: string;
		metaCreationDate?: string;
		metaModificationDate?: string;
		headerImage?: string;
		headerText?: string; // templated
		headerHeight?: number;
		footerImage?: string;
		footerText?: string; // templated
		footerHeight?: number;
		watermarkImage?: string;
		watermarkText?: string;
	},
): Promise<pdflib.PDFDocument> {
	const doc = await pdflib.PDFDocument.create();

	// Default Options
	const {
		layout = "1-n-up",
		pageWidth,
		pageHeight,
		pageMarginLeft = 0,
		pageMarginRight = 0,
		pageMarginTop = 0,
		pageMarginBottom = 0,
		removeAnnotations = false,
		flatten = false,
		metaTitle,
		metaSubject,
		metaAuthor,
		metaCreator,
		metaProducer,
		metaCreationDate,
		metaModificationDate,
	} = options || {};

	const innerPageWidth =
		(pageWidth || pdflib.PageSizes.A4[0]) - pageMarginLeft - pageMarginRight;
	const innerPageHeight =
		(pageHeight || pdflib.PageSizes.A4[1]) - pageMarginTop - pageMarginBottom;

	const isEmptyLayout = !layout || layout === "1-n-up";
	const layoutGenerator = PDFLayoutFactory({
		layout,
		pageWidth: innerPageWidth,
		pageHeight: innerPageHeight,
	});
	for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
		const { value: layoutOptions, done: layoutDone } = layoutGenerator.next();
		const docPageCount = doc.getPageCount();
		const pageToDraw = pages[pageIndex];

		if (layoutDone || !layoutOptions || !pageToDraw) {
			break;
		}

		const pageToDrawOnWidth = pageWidth || pageToDraw.getWidth();
		const pageToDrawOnHeight = pageHeight || pageToDraw.getHeight();
		const pageToDrawOn =
			layoutOptions.pageNumber > docPageCount
				? doc.addPage([pageToDrawOnWidth, pageToDrawOnHeight])
				: doc.getPage(docPageCount - 1);

		const pageToDrawWindowWidth =
			layoutOptions.width ||
			pageToDrawOnWidth - pageMarginLeft - pageMarginRight;
		const pageToDrawWindowHeight =
			layoutOptions.height ||
			pageToDrawOnHeight - pageMarginTop - pageMarginBottom;
		let pageToDrawWidth = pageToDraw.getWidth();
		let pageToDrawHeight = pageToDraw.getHeight();
		const pageToDrawScale = Math.min(
			pageToDrawWindowWidth / pageToDrawWidth,
			pageToDrawWindowHeight / pageToDrawHeight,
		);
		pageToDrawWidth = pageToDrawWidth * pageToDrawScale;
		pageToDrawHeight = pageToDrawHeight * pageToDrawScale;
		const pageToDrawX = layoutOptions.x + pageMarginLeft;
		const pageToDrawY = layoutOptions.y + pageMarginBottom;
		const pageToDrawRotate = layoutOptions.rotate;

		const embeddedPage = await doc.embedPage(pageToDraw);
		pageToDrawOn.drawPage(embeddedPage, {
			x: pageToDrawX,
			y: pageToDrawY,
			width: pageToDrawWidth,
			height: pageToDrawHeight,
			rotate: pageToDrawRotate,
		});

		// Force multiplier
		if (isEmptyLayout) {
			const pageToDrawCropBox = pageToDraw.getCropBox();
			pageToDrawOn.setCropBox(
				pageToDrawCropBox.x,
				pageToDrawCropBox.y,
				pageToDrawCropBox.width,
				pageToDrawCropBox.height,
			);
			pageToDrawOn.setRotation(pageToDraw.getRotation());
		}

		if (removeAnnotations) {
			const annots = pageToDrawOn.node.Annots();
			const annotsSize = annots?.size() || 0;
			for (let i = annotsSize - 1; i >= 0; i--) {
				// @ts-expect-error
				annots.context.delete(annots.get(i));
			}
		}
	}

	if (metaTitle !== undefined) {
		doc.setTitle(metaTitle);
	}
	if (metaSubject !== undefined) {
		doc.setSubject(metaSubject);
	}
	if (metaAuthor !== undefined) {
		doc.setAuthor(metaAuthor);
	}
	if (metaCreator !== undefined) {
		doc.setCreator(metaCreator);
	}
	if (metaProducer !== undefined) {
		doc.setProducer(metaProducer);
	}
	if (metaCreationDate !== undefined) {
		doc.setCreationDate(new Date(metaCreationDate));
	}
	if (metaModificationDate !== undefined) {
		doc.setModificationDate(new Date(metaModificationDate));
	}

	if (flatten) {
		doc.getForm().flatten();
	}

	return doc;
}

async function parsePDFEmbedImage<
	R extends {
		width: number;
		height: number;
		data: Uint8ClampedArray | null;
		bitmap?: ImageBitmap;
	},
>(pdfPageProxy: pdfjs.PDFPageProxy, imgFn: string): Promise<R | undefined> {
	const img: R | undefined = await new Promise((resolve) => {
		try {
			if (pdfPageProxy.objs.has(imgFn)) {
				pdfPageProxy.objs.get(imgFn, resolve);
			} else {
				resolve(undefined);
			}
		} catch (error) {
			console.error(error);
			resolve(undefined);
		}
	});
	if (img) {
		return img;
	}

	const commonImg: R | undefined = await new Promise((resolve) => {
		try {
			if (pdfPageProxy.commonObjs.has(imgFn)) {
				pdfPageProxy.commonObjs.get(imgFn, resolve);
			} else {
				resolve(undefined);
			}
		} catch (error) {
			console.error(error);
			resolve(undefined);
		}
	});
	if (commonImg) {
		return commonImg;
	}

	return undefined;
}

async function* extractPDFEmbedImages(
	pdfDocumentProxy: pdfjs.PDFDocumentProxy,
) {
	let currentPage = 0;

	while (currentPage < pdfDocumentProxy.numPages) {
		const pdfPageProxy = await pdfDocumentProxy.getPage(currentPage + 1);
		const { fnArray, argsArray } = await pdfPageProxy.getOperatorList();
		let currentPageImage = 0;
		while (currentPageImage < fnArray.length) {
			const fn = fnArray[currentPageImage];
			const args = argsArray[currentPageImage];
			let img:
				| {
						width: number;
						height: number;
						data: Uint8ClampedArray | null;
						bitmap?: ImageBitmap;
				  }
				| undefined;
			if (fn === pdfjs.OPS.paintInlineImageXObject) {
				img = args[0];
			} else if (fn === pdfjs.OPS.paintImageXObject) {
				const objId: string = args[0];
				img = await parsePDFEmbedImage(pdfPageProxy, objId);
			}
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
			currentPageImage += 1;
		}
		currentPage += 1;
	}
}

export {
	pdflib,
	pdfjs,
	parsePDFDocument,
	imposePDFPages,
	parsePDFEmbedImage,
	extractPDFEmbedImages,
};
