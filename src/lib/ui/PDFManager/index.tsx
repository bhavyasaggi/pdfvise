import type React from "react";
import PDFManagerButtonAction from "./ButtonAction";
import { PDFManagerActionContext, PDFManagerValueContext } from "./context";
import PDFManagerForm from "./Form";
import type { PDFManagerStoreType } from "./types";
import { usePDFManager } from "./use-pdf-manager";
import PDFManagerView from "./View";

function PDFManager(props: {
	initStore?: PDFManagerStoreType;
	firstPageOnly?: boolean;
	children?: React.ReactNode;
}) {
	const { meta, add, remove, get, getThumbnail, setMeta } = usePDFManager(
		props.initStore,
		{
			firstPageOnly: props.firstPageOnly,
		},
	);

	return (
		<PDFManagerActionContext.Provider
			value={{
				add,
				remove,
				get,
				setMeta,
				getThumbnail,
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

export default PDFManager;

export type { PDFManagerStoreType } from "./types";
