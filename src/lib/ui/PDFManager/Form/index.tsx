import type React from "react";
import { useContext } from "react";
import ButtonFile from "@/lib/ui/ButtonFile";
import Icon from "@/lib/ui/Icon";

import { PDFManagerActionContext, PDFManagerValueContext } from "../context";
import styles from "../styles.module.scss";
import type { PDFPageDataType } from "../types";

export interface PDFMangerFormProps {
	onSubmit?: (
		data?: PDFPageDataType[],
		formData?: FormData,
		utils?: Partial<
			React.ComponentProps<typeof PDFManagerActionContext.Provider>["value"]
		>,
	) => Promise<void>;
	onReset?: () => void;
	children?: React.ReactNode;
	className?: string;
	style?: React.CSSProperties;
}

export default function PDFManagerForm(props: PDFMangerFormProps) {
	const { data, isUninitialized, isLoading } = useContext(
		PDFManagerValueContext,
	);
	const { get, add, setMeta, extractImage, extractThumbnail } = useContext(
		PDFManagerActionContext,
	);

	return (
		<form
			onSubmit={async (e) => {
				try {
					e.preventDefault();
					setMeta((prev) => ({ ...prev, isLoading: true }));

					const formData = new FormData(e.currentTarget);
					await props.onSubmit?.(data, formData, {
						get,
						extractImage,
						extractThumbnail,
					});

					setMeta((prev) => ({ ...prev, isLoading: false, data: [] }));
				} catch (error) {
					console.error(error);
					globalThis.alert(
						`Error: ${(error as Error)?.message || "Unknown error"}`,
					);
				}
			}}
			onReset={(e) => {
				try {
					e.preventDefault();
					e.currentTarget.reset();
					props.onReset?.();
					setMeta((prev) => ({ ...prev, isLoading: false, data: [] }));
				} catch (error) {
					console.error(error);
					globalThis.alert(
						`Error: ${(error as Error)?.message || "Unknown error"}`,
					);
				}
			}}
			className={[styles.formContainer, props.className]
				.filter(Boolean)
				.join(" ")}
			style={props.style}
		>
			<button
				type="submit"
				disabled={isUninitialized || isLoading}
				className={styles.formButton}
			>
				<Icon
					icon="download-cloud"
					height={16}
					width={16}
					title="Save and Download"
				/>
				<span>Save & Download</span>
			</button>
			<ButtonFile
				disabled={isUninitialized || isLoading}
				className={["outline", styles.formButton].join(" ")}
				onChange={async (files) => {
					const file = files?.[0];
					if (file) {
						void add(new File([file], file.name, { type: file.type }));
					}
				}}
			>
				<Icon icon="plus-circle" height={16} width={16} title="Add File" />
				<span>Add</span>
			</ButtonFile>
			{props.children}
			<button
				type="reset"
				disabled={isUninitialized || isLoading}
				className={["outline", "secondary", styles.formButton].join(" ")}
			>
				Reset
			</button>
		</form>
	);
}
