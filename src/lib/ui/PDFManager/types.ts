import type { PDFDocument } from "pdf-lib";
import type { PDFDocumentProxy } from "pdfjs-dist";

export type PDFPageDataType = {
	/**
	 * Id of the file
	 */
	id: string;
	/**
	 * Index of the page
	 */
	index: number;
	/**
	 * Index of the operation on page (used for images or text)
	 */
	opIndex?: number;
	/**
	 * Width of the page
	 */
	width: number;
	/**
	 * Height of the page
	 */
	height: number;
	/**
	 * Top crop of the page
	 */
	cropTop: number;
	/**
	 * Left crop of the page
	 */
	cropLeft: number;
	/**
	 * Bottom crop of the page
	 */
	cropBottom: number;
	/**
	 * Right crop of the page
	 */
	cropRight: number;
	/**
	 * Rotation of the page
	 */
	rotation: number;
	/**
	 * Mirror the page left to right before rotation.
	 */
	flipHorizontal?: boolean;
	/**
	 * Mirror the page top to bottom before rotation.
	 */
	flipVertical?: boolean;
	/**
	 * Extra top inset for this page, in points.
	 */
	marginTop?: number;
	/**
	 * Extra right inset for this page, in points.
	 */
	marginRight?: number;
	/**
	 * Extra bottom inset for this page, in points.
	 */
	marginBottom?: number;
	/**
	 * Extra left inset for this page, in points.
	 */
	marginLeft?: number;
};

export type PDFManagerStoreType = Record<
	string,
	{
		file: File;
		pdfDocument: PDFDocument;
		pdfDocumentProxy: PDFDocumentProxy;
		pageThumbnailCache?: Record<string, Promise<Blob | null>>;
	}
>;

export type PDFManagerMetaType = {
	mode: "default" | "firstPageOnly" | "imagesOnly" | "textOnly";
	data?: PDFPageDataType[];
	isUninitialized: boolean;
	isLoading: boolean;
	error?: Error;
	/** Shown after a finished download. Cleared when the next task starts. */
	notice?: string;
};
