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
};

export type PDFManagerStoreType = Record<
	string,
	{
		file: File;
		pdfDocument: pdflib.PDFDocument;
		pdfDocumentProxy: pdfjs.PDFDocumentProxy;
		pageThumbnailCache?: Record<string, Promise<Blob | null>>;
	}
>;

export type PDFManagerMetaType = {
	mode: "default" | "firstPageOnly" | "imagesOnly" | "textOnly";
	data?: PDFPageDataType[];
	isUninitialized: boolean;
	isLoading: boolean;
	error?: Error;
};
