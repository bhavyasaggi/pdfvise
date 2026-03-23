import type { CSSProperties } from "preact";
import type { ReactNode } from "react";
import { useContext } from "react";

import { toError } from "@/lib/utils/pdf-geometry";
import { yieldToMain } from "@/lib/utils/schedule";

import { PDFManagerActionContext, PDFManagerValueContext } from "../context";

import styles from "../styles.module.scss";

import type { PDFPageDataType } from "../types";

export default function PDFManagerButtonAction(props: {
	disabled?: boolean;
	onClick?: (
		data: PDFPageDataType[],
	) => Promise<PDFPageDataType[]> | PDFPageDataType[];
	children?: ReactNode;
	className?: string;
	style?: CSSProperties;
}) {
	const { data, isLoading } = useContext(PDFManagerValueContext);
	const { setMeta } = useContext(PDFManagerActionContext);

	const handleClickCb = async () => {
		if (isLoading || !props.onClick) {
			return;
		}
		setMeta((prev) => ({
			...prev,
			isLoading: true,
			error: undefined,
			notice: undefined,
		}));
		await yieldToMain();
		try {
			const nextData = await props.onClick?.(data || []);
			setMeta((prev) => ({
				...prev,
				isLoading: false,
				error: undefined,
				notice: undefined,
				data: nextData,
			}));
		} catch (error) {
			const nextError = toError(error);
			console.error(nextError);
			setMeta((prev) => ({
				...prev,
				isLoading: false,
				notice: undefined,
				error: nextError,
			}));
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
