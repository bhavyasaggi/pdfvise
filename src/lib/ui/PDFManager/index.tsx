import type React from "react";
import { useRef } from "react";
import PDFManagerButtonAction from "./ButtonAction";
import { PDFManagerActionContext, PDFManagerValueContext } from "./context";
import PDFManagerForm from "./Form";
import type { PDFManagerStoreType } from "./types";
import { usePDFManagerAction } from "./use-pdf-manager-action";
import { usePDFManagerExtract } from "./use-pdf-manager-extract";
import { usePDFManagerMeta } from "./use-pdf-manager-meta";
import PDFManagerView from "./View";

const DEFAULT_STORE: PDFManagerStoreType = {};

function PDFManager(props: {
	initStore?: PDFManagerStoreType;
	mode?: "default" | "firstPageOnly" | "imagesOnly" | "textOnly";
	children?: React.ReactNode;
}) {
	const storeRef = useRef<PDFManagerStoreType>(
		props.initStore ?? DEFAULT_STORE,
	);

	const [meta, setMeta] = usePDFManagerMeta({ storeRef, mode: props.mode });

	const { add, remove, get } = usePDFManagerAction(meta, setMeta, {
		storeRef: storeRef,
		mode: props.mode,
	});

	const { extractImage, extractThumbnail } = usePDFManagerExtract({
		storeRef: storeRef,
		mode: props.mode,
	});

	return (
		<PDFManagerActionContext.Provider
			value={{
				add,
				remove,
				get,
				setMeta,
				extractImage,
				extractThumbnail,
			}}
		>
			<PDFManagerValueContext.Provider value={meta}>
				{props.children}
			</PDFManagerValueContext.Provider>
		</PDFManagerActionContext.Provider>
	);
}

PDFManager.Form = PDFManagerForm;
PDFManager.View = PDFManagerView;
PDFManager.ButtonAction = PDFManagerButtonAction;

PDFManager.ActionContext = PDFManagerActionContext;
PDFManager.ValueContext = PDFManagerValueContext;

export default PDFManager;

export type { PDFManagerStoreType } from "./types";
