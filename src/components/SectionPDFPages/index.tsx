import JSZip from "jszip";
import type React from "react";
import { useCallback } from "react";
import Input from "@/lib/ui/Input";
import InputSelect from "@/lib/ui/InputSelect";
import PDFManager from "@/lib/ui/PDFManager";
import { imposePDFPages, pdflib } from "@/lib/utils/pdf";

import styles from "./styles.module.scss";

const DATA_PAGE_LAYOUT_OPTIONS = [
	{ value: "", label: "Original" },
	{ value: "4-zine", label: "Zine" },
	{ value: "4-n-up", label: "N-up" },
];
const DATA_PAGE_SIZE_OPTIONS = [
	{ value: "", label: "Original" },
	...Object.keys(pdflib.PageSizes),
];
const DATA_PAGE_ORIENTATION_OPTIONS = [
	{ value: "", label: "Original" },
	{ value: "0", label: "Portrait" },
	{ value: "1", label: "Landscape" },
];
const DATA_PAGE_MARGIN_UNIT_OPTIONS = [
	{ value: "72", label: "Inches" },
	{ value: "28.3464", label: "Centimeters" },
	{ value: "2.83464", label: "Millimeters" },
];
const DATA_PAGE_ANNOTATION_OPTIONS = [
	{ value: "", label: "No" },
	{ value: "1", label: "Yes" },
];
const DATA_PAGE_FLATTEN_OPTIONS = [
	{ value: "", label: "No" },
	{ value: "1", label: "Yes" },
];

export default function SectionPDFPages(
	props: React.ComponentProps<typeof PDFManager>,
) {
	const handleSave = useCallback(
		async (data: pdflib.PDFPage[], formData?: FormData) => {
			const pageLayout = String(formData?.get("pageLayout") || "");
			const pageSize = String(formData?.get("pageSize") || "");
			let [pageWidth, pageHeight] = pageSize
				? pdflib.PageSizes[pageSize as keyof typeof pdflib.PageSizes]
				: [];

			const pageOrientation = String(formData?.get("pageOrientation") || "");
			if (pageOrientation === "1") {
				[pageWidth, pageHeight] = [pageHeight, pageWidth];
			}

			const pageRemoveAnnotation =
				String(formData?.get("pageRemoveAnnotation") || "") === "1";
			const pageRemoveMetadata =
				String(formData?.get("pageRemoveMetadata") || "") === "1";
			const pageFlatten = String(formData?.get("pageFlatten") || "") === "1";

			const pageMarginTop =
				Number(formData?.get("pageMarginTop") || "") || undefined;
			const pageMarginTopScale =
				Number(formData?.get("pageMarginTopUnit") || "") || 1;
			const pageMarginBottom =
				Number(formData?.get("pageMarginBottom") || "") || undefined;
			const pageMarginBottomScale =
				Number(formData?.get("pageMarginBottomUnit") || "") || 1;
			const pageMarginLeft =
				Number(formData?.get("pageMarginLeft") || "") || undefined;
			const pageMarginLeftScale =
				Number(formData?.get("pageMarginLeftUnit") || "") || 1;
			const pageMarginRight =
				Number(formData?.get("pageMarginRight") || "") || undefined;
			const pageMarginRightScale =
				Number(formData?.get("pageMarginRightUnit") || "") || 1;
			const pageBatchSize =
				Number(formData?.get("pageBatchSize") || "") || data.length;

			const batchBlob: Blob[] = [];
			for (
				let batchDataIndex = 0;
				batchDataIndex < data.length;
				batchDataIndex += pageBatchSize
			) {
				const batchDataSlice = data.slice(
					batchDataIndex,
					batchDataIndex + pageBatchSize,
				);
				const doc = await imposePDFPages(batchDataSlice, {
					layout: pageLayout as "4-zine" | "4-n-up" | undefined,
					pageWidth,
					pageHeight,
					pageMarginLeft: pageMarginLeft
						? pageMarginLeft * pageMarginLeftScale
						: undefined,
					pageMarginRight: pageMarginRight
						? pageMarginRight * pageMarginRightScale
						: undefined,
					pageMarginTop: pageMarginTop
						? pageMarginTop * pageMarginTopScale
						: undefined,
					pageMarginBottom: pageMarginBottom
						? pageMarginBottom * pageMarginBottomScale
						: undefined,
					removeAnnotations: pageRemoveAnnotation,
					flatten: pageFlatten,
					metaTitle: pageRemoveMetadata ? "" : undefined,
					metaSubject: pageRemoveMetadata ? "" : undefined,
					metaAuthor: pageRemoveMetadata ? "" : undefined,
					metaCreator: pageRemoveMetadata ? "" : undefined,
					metaProducer: pageRemoveMetadata ? "" : undefined,
					metaCreationDate: pageRemoveMetadata ? "" : undefined,
					metaModificationDate: pageRemoveMetadata ? "" : undefined,
				});
				const bytes = await doc.save();
				const blob = new Blob([bytes as unknown as BlobPart], {
					type: "application/pdf",
				});
				batchBlob.push(blob);
			}

			const a = document.createElement("a");
			if (batchBlob.length === 1) {
				a.href = URL.createObjectURL(batchBlob[0]);
				a.download = `merged-${Date.now().toString(36)}.pdf`;
			} else if (batchBlob.length > 1) {
				const zip = new JSZip();
				batchBlob.forEach((blob, index) => {
					zip.file(
						`page-${`${index + 1}`.padStart(
							String(data.length).length - String(index + 1).length,
							"0",
						)}.pdf`,
						blob,
					);
				});
				const bytes = await zip.generateAsync({ type: "blob" });
				a.href = URL.createObjectURL(bytes);
				a.download = `merged-${Date.now().toString(36)}.zip`;
			}

			if (a.href) {
				a.click();
				setTimeout(
					() => {
						URL.revokeObjectURL(a.href);
					},
					2 * 60 * 1000,
				);
			}
		},
		[],
	);

	return (
		<PDFManager {...props}>
			<div className={styles.section}>
				<PDFManager.Form
					onSubmit={handleSave}
					className={styles.optionsContainer}
				>
					<hr />
					<InputSelect
						name="pageLayout"
						label="Page Layout"
						className={styles.optionsItem}
						defaultValue=""
						data={DATA_PAGE_LAYOUT_OPTIONS}
					/>
					<InputSelect
						name="pageSize"
						label="Page Size"
						className={styles.optionsItem}
						defaultValue=""
						data={DATA_PAGE_SIZE_OPTIONS}
					/>
					<InputSelect
						name="pageOrientation"
						label="Orientation"
						className={styles.optionsItem}
						defaultValue=""
						data={DATA_PAGE_ORIENTATION_OPTIONS}
					/>
					<Input
						name="pageBatchSize"
						label="Batch Size"
						className={styles.optionsItem}
						defaultValue=""
					/>
					<hr />
					<div className={styles.optionsItemUnit}>
						<span>Margin Top</span>
						<Input
							type="number"
							step="0.1"
							min="0"
							name="pageMarginTop"
							defaultValue="0.00"
						/>
						<InputSelect
							name="pageMarginTopUnit"
							defaultValue="Inches"
							data={DATA_PAGE_MARGIN_UNIT_OPTIONS}
						/>
					</div>
					<div className={styles.optionsItemUnit}>
						<span>Margin Bottom</span>
						<Input
							type="number"
							step="0.1"
							min="0"
							name="pageMarginBottom"
							defaultValue="0.00"
						/>
						<InputSelect
							name="pageMarginBottomUnit"
							defaultValue="Inches"
							data={DATA_PAGE_MARGIN_UNIT_OPTIONS}
						/>
					</div>
					<div className={styles.optionsItemUnit}>
						<span>Margin Left</span>
						<Input
							type="number"
							step="0.1"
							min="0"
							name="pageMarginLeft"
							defaultValue="0.00"
						/>
						<InputSelect
							name="pageMarginLeftUnit"
							defaultValue="Inches"
							data={DATA_PAGE_MARGIN_UNIT_OPTIONS}
						/>
					</div>
					<div className={styles.optionsItemUnit}>
						<span>Margin Right</span>
						<Input
							type="number"
							step="0.1"
							min="0"
							name="pageMarginRight"
							defaultValue="0.00"
						/>
						<InputSelect
							name="pageMarginRightUnit"
							defaultValue="Inches"
							data={DATA_PAGE_MARGIN_UNIT_OPTIONS}
						/>
					</div>
					<hr />
					<div>
						<InputSelect
							label="Flatten Fields"
							name="pageFlatten"
							defaultValue=""
							data={DATA_PAGE_FLATTEN_OPTIONS}
							className={styles.optionsItem}
						/>
						<InputSelect
							label="Remove Annotation"
							name="pageRemoveAnnotation"
							defaultValue=""
							data={DATA_PAGE_ANNOTATION_OPTIONS}
							className={styles.optionsItem}
						/>
						<InputSelect
							label="Remove Metadata"
							name="pageRemoveMetadata"
							defaultValue=""
							data={DATA_PAGE_ANNOTATION_OPTIONS}
							className={styles.optionsItem}
						/>
					</div>
					<hr />
				</PDFManager.Form>
				<PDFManager.View className={styles.viewContainer} />
			</div>
		</PDFManager>
	);
}
