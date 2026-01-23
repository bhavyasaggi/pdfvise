import type React from "react";
import { useContext } from "react";
import ButtonFile from "@/lib/ui/ButtonFile";
import Icon from "@/lib/ui/Icon";
import type { pdflib } from "@/lib/utils/pdf";

import { PDFManagerActionContext, PDFManagerValueContext } from "../context";
import styles from "../styles.module.scss";

export interface PDFMangerFormProps {
	onSubmit?: (
		data: Array<pdflib.PDFPage>,
		formData?: FormData,
	) => Promise<void>;
	onReset?: () => void;
	children?: React.ReactNode;
	className?: string;
	style?: React.CSSProperties;
}

export default function PDFManagerForm(props: PDFMangerFormProps) {
	const { data, isLoading } = useContext(PDFManagerValueContext);
	const { get, add, setMeta } = useContext(PDFManagerActionContext);

	return (
		<form
			onSubmit={async (e) => {
				e.preventDefault();
				setMeta((prev) => ({ ...prev, isLoading: true }));

				const pages = (data || [])
					.map((item) => {
						const page = get(item.id)?.pdfDocument.getPage(item.index);
						if (!page) {
							return undefined;
						}
						// TODO:
						page.setSize(item.width, item.height);
						page.setCropBox(
							item.cropLeft,
							item.cropTop,
							item.width - item.cropLeft - item.cropRight,
							item.height - item.cropTop - item.cropBottom,
						);
						page.setRotation({
							type: "degrees" as pdflib.RotationTypes.Degrees,
							angle: item.rotation,
						});
						return page;
					})
					.filter(Boolean) as pdflib.PDFPage[];
				const formData = new FormData(e.currentTarget);
				e.currentTarget.reset();

				await props.onSubmit?.(pages, formData);

				setMeta((prev) => ({ ...prev, isLoading: false, data: [] }));
			}}
			onReset={(e) => {
				e.preventDefault();
				e.currentTarget.reset();
				props.onReset?.();
				setMeta((prev) => ({ ...prev, isLoading: false, data: [] }));
			}}
			className={[styles.formContainer, props.className]
				.filter(Boolean)
				.join(" ")}
			style={props.style}
		>
			<button type="submit" disabled={isLoading} className={styles.formButton}>
				<Icon
					icon="download-cloud"
					height={16}
					width={16}
					title="Save and Download"
				/>
				<span>Save & Download</span>
			</button>
			<ButtonFile
				disabled={isLoading}
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
				disabled={isLoading}
				className={["outline", "secondary", styles.formButton].join(" ")}
			>
				Reset
			</button>
		</form>
	);
}
