import { lazy } from "react";

import type { PDFPagesTool } from "@/lib/pdf-tools";
import PDFFileGate from "@/lib/ui/PDFFileGate";

const SectionPDFPages = lazy(() => import("./index"));

export default function SectionPDFPagesLazy(props: { tool?: PDFPagesTool }) {
	return (
		<PDFFileGate>
			{(store) => <SectionPDFPages initStore={store} tool={props.tool} />}
		</PDFFileGate>
	);
}
