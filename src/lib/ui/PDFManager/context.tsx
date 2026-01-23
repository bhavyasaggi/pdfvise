import { createContext } from "react";
import type { pdfjs, pdflib } from "@/lib/utils/pdf";
import type { PDFPageDataType } from "./types";

const noop = () => {};
const noopPromise = <T = unknown>(..._args: unknown[]) =>
	Promise.resolve(null as T);

export const PDFManagerValueContext = createContext<{
	data?: PDFPageDataType[];
	isLoading?: boolean;
	error?: Error;
}>({
	data: undefined,
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
	setMeta: React.Dispatch<
		React.SetStateAction<{
			data?: PDFPageDataType[] | undefined;
			isLoading?: boolean | undefined;
			error?: Error | undefined;
		}>
	>;
	getThumbnail: (
		data: Pick<PDFPageDataType, "id" | "index">,
		options?: {
			maxDimension?: number;
			quality?: number;
		},
	) => Promise<Blob | null>;
}>({
	add: noopPromise,
	remove: noop,
	get: () => undefined,
	setMeta: noop,
	getThumbnail: noopPromise,
});
