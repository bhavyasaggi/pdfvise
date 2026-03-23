import { lazy } from "react";

import PDFFileGate from "@/lib/ui/PDFFileGate";

const SectionPDFExtractImages = lazy(() => import("./index"));

export default function SectionPDFExtractImagesLazy() {
	return (
		<PDFFileGate>
			{(store) => (
				<SectionPDFExtractImages initStore={store} mode="imagesOnly" />
			)}
		</PDFFileGate>
	);
}
