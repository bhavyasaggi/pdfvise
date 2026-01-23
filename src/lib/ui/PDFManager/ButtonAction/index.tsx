import type React from "react";
import { useContext } from "react";
import { PDFManagerActionContext, PDFManagerValueContext } from "../context";

import styles from "../styles.module.scss";

import type { PDFPageDataType } from "../types";

export default function PDFManagerButtonAction(props: {
	disabled?: boolean;
	onClick?: (
		data: PDFPageDataType[],
	) => Promise<PDFPageDataType[]> | PDFPageDataType[];
	children?: React.ReactNode;
	className?: string;
	style?: React.CSSProperties;
}) {
	const { data, isLoading } = useContext(PDFManagerValueContext);
	const { setMeta } = useContext(PDFManagerActionContext);

	const handleClickCb = async () => {
		if (isLoading || !props.onClick) {
			return;
		}
		setMeta((prev) => ({ ...prev, isLoading: true }));
		try {
			const nextData = await props.onClick?.(data || []);
			setMeta((prev) => ({ ...prev, isLoading: false, data: nextData }));
		} catch (error) {
			setMeta((prev) => ({ ...prev, isLoading: false, error: error as Error }));
		}
	};

	return (
		<button
			type="button"
			disabled={props.disabled || isLoading}
			onClick={handleClickCb}
			className={[styles.formButton, props.className].filter(Boolean).join(" ")}
			style={props.style}
		>
			{props.children}
		</button>
	);
}
