import type { CSSProperties } from "preact";
import type { ReactNode } from "react";
import { useContext } from "react";

import ButtonFile from "@/lib/ui/ButtonFile";
import Icon from "@/lib/ui/Icon";
import { toError } from "@/lib/utils/pdf-geometry";
import { yieldToMain } from "@/lib/utils/schedule";

import {
	PDFManagerActionContext,
	type PDFManagerActions,
	PDFManagerValueContext,
} from "../context";
import styles from "../styles.module.scss";
import type { PDFPageDataType } from "../types";

export interface PDFManagerFormProps {
	onSubmit?: (
		data?: PDFPageDataType[],
		formData?: FormData,
		utils?: Pick<
			PDFManagerActions,
			"get" | "extractImage" | "extractThumbnail" | "extractText"
		>,
	) => Promise<void>;
	onReset?: () => void;
	children?: ReactNode;
	className?: string;
	style?: CSSProperties;
}

export default function PDFManagerForm(props: PDFManagerFormProps) {
	const { data, isUninitialized, isLoading } = useContext(
		PDFManagerValueContext,
	);
	const { get, add, setMeta, extractImage, extractThumbnail, extractText } =
		useContext(PDFManagerActionContext);
	const blocked = isUninitialized || isLoading || !data?.length;

	return (
		<form
			onSubmit={async (event) => {
				event.preventDefault();
				const form = event.currentTarget;
				setMeta((prev) => ({
					...prev,
					isLoading: true,
					error: undefined,
					notice: undefined,
				}));
				await yieldToMain();
				try {
					const formData = new FormData(form);
					await props.onSubmit?.(data, formData, {
						get,
						extractImage,
						extractThumbnail,
						extractText,
					});
					setMeta((prev) => ({
						...prev,
						isLoading: false,
						error: undefined,
						notice: "Saved. The download has started.",
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
			}}
			onReset={(event) => {
				event.preventDefault();
				event.currentTarget.reset();
				props.onReset?.();
				setMeta((prev) => ({
					...prev,
					isLoading: false,
					error: undefined,
					notice: undefined,
					data: [],
				}));
			}}
			className={[styles.formContainer, props.className]
				.filter(Boolean)
				.join(" ")}
			style={props.style}
		>
			<button type="submit" disabled={blocked} className={styles.formButton}>
				<Icon
					icon="download-cloud"
					height={16}
					width={16}
					title="Save and Download"
					decorative
				/>
				<span>Save & Download</span>
			</button>
			<ButtonFile
				multiple
				disabled={isUninitialized || isLoading}
				className={["outline", styles.formButton].join(" ")}
				onChange={async (files) => {
					for (const file of files) {
						await add(file);
					}
				}}
			>
				<Icon
					icon="plus-circle"
					height={16}
					width={16}
					title="Add File"
					decorative
				/>
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
