export type PDFManagerStoreType = Record<
	string,
	{
		file: File;
		pdfDocument: pdflib.PDFDocument;
		pdfDocumentProxy: pdfjs.PDFDocumentProxy;
		pageThumbnailCache?: Record<string, Promise<Blob | null>>;
	}
>;

export type PDFPageDataType = {
	id: string;
	index: number;
	width: number;
	height: number;
	cropTop: number;
	cropLeft: number;
	cropBottom: number;
	cropRight: number;
	rotation: number;
};
