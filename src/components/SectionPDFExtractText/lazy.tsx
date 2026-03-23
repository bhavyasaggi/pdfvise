import { lazy } from "react";

import PDFFileGate from "@/lib/ui/PDFFileGate";

const SectionPDFExtractText = lazy(() => import("./index"));

export default function SectionPDFExtractTextLazy() {
	return (
		<PDFFileGate>
			{(store) => <SectionPDFExtractText initStore={store} />}
		</PDFFileGate>
	);
}
