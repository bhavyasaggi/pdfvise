import * as pdflib from "pdf-lib";
import * as pdfjs from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export { extractPDFEmbedImages, parsePDFEmbedImage } from "./pdf-image";
export type { ImposeOptions, ImposeSourcePage } from "./pdf-impose";
export { imposePDFPages } from "./pdf-impose";

export { pdflib, pdfjs };

const MAX_PDF_BYTES = 100 * 1024 * 1024;

let workerReady = false;

function ensurePdfWorker() {
	if (workerReady || typeof window === "undefined") {
		return;
	}
	pdfjs.GlobalWorkerOptions.workerPort = new Worker(pdfjsWorker, {
		type: "module",
	});
	workerReady = true;
}

function createId() {
	if (globalThis.crypto?.randomUUID) {
		return globalThis.crypto.randomUUID();
	}
	return Math.random().toString(36).slice(2, 10);
}

function isPdfFile(file: File) {
	const type = file.type.toLowerCase();
	return (
		type === "application/pdf" ||
		type === "application/x-pdf" ||
		file.name.toLowerCase().endsWith(".pdf")
	);
}

export async function parsePDFDocument(file: File) {
	ensurePdfWorker();
	if (!isPdfFile(file)) {
		throw new Error("Only PDF files are supported.");
	}
	if (file.size > MAX_PDF_BYTES) {
		throw new Error("This PDF is larger than 100 MB.");
	}

	const bytes = new Uint8Array(await file.arrayBuffer());
	const [pdfDocument, pdfDocumentProxy] = await Promise.all([
		pdflib.PDFDocument.load(bytes.slice(), {
			ignoreEncryption: false,
			parseSpeed: pdflib.ParseSpeeds.Slow,
			throwOnInvalidObject: true,
			updateMetadata: false,
			capNumbers: true,
		}),
		pdfjs.getDocument({ data: bytes.slice() }).promise,
	]);

	if (pdfDocument.getPageCount() !== pdfDocumentProxy.numPages) {
		await pdfDocumentProxy.destroy();
		throw new Error("PDF page count mismatch.");
	}

	return {
		id: createId(),
		file,
		pdfDocument,
		pdfDocumentProxy,
	};
}
