import type { ComponentProps } from "react";
import { useCallback } from "react";

import {
	MARGIN_UNIT_OPTIONS,
	PAGE_LAYOUT_OPTIONS,
	PAGE_ORIENTATION_OPTIONS,
	PAGE_SIZE_OPTIONS,
	PDF_PAGE_TOOLS,
	type PDFPagesTool,
	YES_NO_OPTIONS,
} from "@/lib/pdf-tools";
import Input from "@/lib/ui/Input";
import InputSelect from "@/lib/ui/InputSelect";
import PDFManager from "@/lib/ui/PDFManager";

import styles from "./styles.module.scss";

function UnitFields(props: {
	label: string;
	name: string;
	defaultValue?: string;
}) {
	return (
		<div className={styles.optionsItemUnit}>
			<span>{props.label}</span>
			<Input
				type="number"
				step="0.1"
				min="0"
				name={props.name}
				ariaLabel={props.label}
				defaultValue={props.defaultValue ?? "0.00"}
			/>
			<InputSelect
				name={`${props.name}Unit`}
				ariaLabel={`${props.label} unit`}
				defaultValue="72"
				data={MARGIN_UNIT_OPTIONS}
			/>
		</div>
	);
}

export default function SectionPDFPages(
	props: ComponentProps<typeof PDFManager> & { tool?: PDFPagesTool },
) {
	const { tool = "merge", ...managerProps } = props;
	const config = PDF_PAGE_TOOLS[tool];
	const handleSave = useCallback<
		NonNullable<ComponentProps<typeof PDFManager.Form>["onSubmit"]>
	>(
		async (pages, formData, utils) => {
			if (!formData || !utils?.get) {
				throw new Error("Add a PDF page before saving.");
			}
			const { buildPdfBlobs } = await import("@/lib/utils/pdf-export");
			const { downloadPdfBlobs } = await import("@/lib/utils/download");
			const blobs = await buildPdfBlobs(
				pages ?? [],
				utils.get,
				formData,
				config,
			);
			await downloadPdfBlobs(
				blobs,
				`${config.downloadName}-${Date.now().toString(36)}`,
			);
		},
		[config],
	);

	const { show, defaults } = config;

	return (
		<PDFManager {...managerProps}>
			<div className={styles.section}>
				<PDFManager.Form
					onSubmit={handleSave}
					className={styles.optionsContainer}
				>
					{show.layout || show.size || show.orientation || show.batch ? (
						<hr />
					) : null}
					{show.layout ? (
						<InputSelect
							name="pageLayout"
							label="Page Layout"
							className={styles.optionsItem}
							defaultValue={defaults.layout}
							data={PAGE_LAYOUT_OPTIONS}
						/>
					) : null}
					{show.size ? (
						<InputSelect
							name="pageSize"
							label="Page Size"
							className={styles.optionsItem}
							defaultValue={defaults.pageSize}
							data={PAGE_SIZE_OPTIONS}
						/>
					) : null}
					{show.orientation ? (
						<InputSelect
							name="pageOrientation"
							label="Orientation"
							className={styles.optionsItem}
							defaultValue={defaults.orientation}
							data={PAGE_ORIENTATION_OPTIONS}
						/>
					) : null}
					{show.batch ? (
						<>
							<Input
								name="pageBatchSize"
								label="Batch Size"
								className={styles.optionsItem}
								defaultValue={defaults.batchSize}
							/>
							<small>
								Leave this empty to keep every page in one PDF. 1 saves each
								page on its own.
							</small>
						</>
					) : null}
					{show.margin ? (
						<>
							<hr />
							<UnitFields label="Margin Top" name="pageMarginTop" />
							<UnitFields label="Margin Bottom" name="pageMarginBottom" />
							<UnitFields label="Margin Left" name="pageMarginLeft" />
							<UnitFields label="Margin Right" name="pageMarginRight" />
						</>
					) : null}
					{show.crop ? (
						<>
							<hr />
							<UnitFields label="Crop Top" name="cropTop" />
							<UnitFields label="Crop Bottom" name="cropBottom" />
							<UnitFields label="Crop Left" name="cropLeft" />
							<UnitFields label="Crop Right" name="cropRight" />
						</>
					) : null}
					{show.header ? (
						<>
							<hr />
							<Input
								name="headerText"
								label="Header"
								defaultValue={defaults.headerText}
								className={styles.optionsItem}
							/>
						</>
					) : null}
					{show.footer ? (
						<>
							<hr />
							<Input
								name="footerText"
								label="Footer"
								defaultValue={defaults.footerText}
								className={styles.optionsItem}
							/>
							<small>
								Use {"{n}"} for the page number and {"{total}"} for the page
								count.
							</small>
						</>
					) : null}
					{show.bates ? (
						<>
							<hr />
							<Input
								name="batesPrefix"
								label="Prefix"
								defaultValue={defaults.batesPrefix}
								className={styles.optionsItem}
							/>
							<Input
								name="batesStart"
								label="Start"
								type="number"
								min="0"
								step="1"
								defaultValue={defaults.batesStart}
								className={styles.optionsItem}
							/>
						</>
					) : null}
					{show.watermark ? (
						<>
							<hr />
							<Input
								name="watermarkText"
								label="Watermark"
								defaultValue={defaults.watermarkText}
								className={styles.optionsItem}
							/>
						</>
					) : null}
					{show.flatten || show.annotation || show.metadata ? <hr /> : null}
					{show.flatten ? (
						<InputSelect
							label="Flatten Fields"
							name="pageFlatten"
							defaultValue={defaults.flatten}
							data={YES_NO_OPTIONS}
							className={styles.optionsItem}
						/>
					) : null}
					{show.annotation ? (
						<InputSelect
							label="Remove Annotation"
							name="pageRemoveAnnotation"
							defaultValue={defaults.removeAnnotation}
							data={YES_NO_OPTIONS}
							className={styles.optionsItem}
						/>
					) : null}
					{show.metadata ? (
						<InputSelect
							label="Remove Metadata"
							name="pageRemoveMetadata"
							defaultValue={defaults.removeMetadata}
							data={YES_NO_OPTIONS}
							className={styles.optionsItem}
						/>
					) : null}
					<hr />
				</PDFManager.Form>
				<PDFManager.View className={styles.viewContainer} pageEditor />
			</div>
		</PDFManager>
	);
}
