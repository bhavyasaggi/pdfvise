import { lazy } from "react";
import type { PDFMetaTool } from "@/lib/pdf-tools";
import PDFFileGate from "@/lib/ui/PDFFileGate";

const SectionPDFMeta = lazy(() => import("./index"));

export default function SectionPDFMetaLazy(props: { tool?: PDFMetaTool }) {
	return (
		<PDFFileGate>
			{(store) => <SectionPDFMeta initStore={store} tool={props.tool} />}
		</PDFFileGate>
	);
}
