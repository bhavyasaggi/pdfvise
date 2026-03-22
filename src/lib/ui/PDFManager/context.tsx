import { createContext } from "react";
import type { pdfjs, pdflib } from "@/lib/utils/pdf";
import type { PDFManagerMetaType, PDFPageDataType } from "./types";

const noop = () => {};
const noopPromise = <T = unknown>(..._args: unknown[]) =>
	Promise.resolve(null as T);

export const PDFManagerValueContext = createContext<PDFManagerMetaType>({
	mode: "default",
	data: undefined,
	isUninitialized: true,
	isLoading: false,
	error: undefined,
});

export const PDFManagerActionContext = createContext<{
	add: (file: File) => Promise<void>;
	remove: (fileOrId: File | string) => void;
	get: (fileOrId: File | string) =>
		| {
				file: File;
				pdfDocument: pdflib.PDFDocument;
				pdfDocumentProxy: pdfjs.PDFDocumentProxy;
		  }
		| undefined;
	setMeta: React.Dispatch<React.SetStateAction<PDFManagerMetaType>>;
	extractThumbnail: (
		data: Pick<PDFPageDataType, "id" | "index">,
		options?: {
			maxDimension?: number;
			quality?: number;
		},
	) => Promise<Blob | null>;
	extractImage: (
		data: Pick<PDFPageDataType, "id" | "index">,
		options?: {
			maxDimension?: number;
			quality?: number;
			imageIndex?: number;
		},
	) => Promise<Blob | null>;
}>({
	add: noopPromise,
	remove: noop,
	get: () => undefined,
	setMeta: noop,
	extractThumbnail: noopPromise,
	extractImage: noopPromise,
});
