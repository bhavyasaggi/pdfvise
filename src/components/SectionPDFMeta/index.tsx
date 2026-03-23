import type { ComponentProps } from "react";
import { useCallback } from "react";

import type { PDFMetaTool } from "@/lib/pdf-tools";
import Icon from "@/lib/ui/Icon";
import Input from "@/lib/ui/Input";
import PDFManager from "@/lib/ui/PDFManager";

import styles from "./styles.module.scss";

const DOWNLOAD_NAMES: Record<PDFMetaTool, string> = {
	metadata: "metadata",
	rotate: "rotated",
	reverse: "reversed",
	reorder: "reordered",
};

function dateInputValue(date: Date | undefined) {
	if (!date || Number.isNaN(date.getTime())) {
		return "";
	}
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

export default function SectionPDFMeta(
	props: ComponentProps<typeof PDFManager> & { tool?: PDFMetaTool },
) {
	const { tool = "metadata", initStore, ...managerProps } = props;
	const source = Object.values(initStore ?? {})[0]?.pdfDocument;
	const downloadName = DOWNLOAD_NAMES[tool];

	const handleSave = useCallback<
		NonNullable<ComponentProps<typeof PDFManager.Form>["onSubmit"]>
	>(
		async (pages, formData, utils) => {
			if (!utils?.get) {
				throw new Error("Add a PDF page before saving.");
			}
			const { imposePDFPages } = await import("@/lib/utils/pdf");
			const { readMetadataOptions, specsFromPages } = await import(
				"@/lib/utils/pdf-export"
			);
			const { downloadBlob, pdfBytesToBlob } = await import(
				"@/lib/utils/download"
			);
			const specs = specsFromPages(pages ?? [], utils.get);
			const options =
				tool === "metadata" && formData ? readMetadataOptions(formData) : {};
			const doc = await imposePDFPages(specs, options);
			downloadBlob(
				pdfBytesToBlob(await doc.save({ addDefaultPage: false })),
				`${downloadName}-${Date.now().toString(36)}.pdf`,
			);
		},
		[downloadName, tool],
	);

	return (
		<PDFManager {...managerProps} initStore={initStore}>
			<div className={styles.section}>
				<PDFManager.Form
					onSubmit={handleSave}
					className={styles.optionsContainer}
				>
					{tool === "metadata" ? (
						<>
							<hr />
							<Input
								name="metaTitle"
								label="Title"
								type="text"
								defaultValue={source?.getTitle() ?? ""}
								className={styles.optionsItem}
							/>
							<Input
								name="metaSubject"
								label="Subject"
								type="text"
								defaultValue={source?.getSubject() ?? ""}
								className={styles.optionsItem}
							/>
							<Input
								name="metaAuthor"
								label="Author"
								type="text"
								defaultValue={source?.getAuthor() ?? ""}
								className={styles.optionsItem}
							/>
							<Input
								name="metaCreator"
								label="Creator"
								type="text"
								defaultValue={source?.getCreator() ?? ""}
								className={styles.optionsItem}
							/>
							<Input
								name="metaProducer"
								label="Producer"
								type="text"
								defaultValue={source?.getProducer() ?? ""}
								className={styles.optionsItem}
							/>
							<Input
								name="metaKeywords"
								label="Keywords"
								type="text"
								defaultValue={(source?.getKeywords() ?? "")
									.split(/\s+/)
									.filter(Boolean)
									.join(", ")}
								className={styles.optionsItem}
							/>
							<Input
								name="metaCreationDate"
								label="Creation Date"
								type="date"
								defaultValue={dateInputValue(source?.getCreationDate())}
								className={styles.optionsItem}
							/>
							<Input
								name="metaModificationDate"
								label="Modification Date"
								type="date"
								defaultValue={dateInputValue(source?.getModificationDate())}
								className={styles.optionsItem}
							/>
						</>
					) : null}
					{tool === "metadata" || tool === "rotate" || tool === "reverse" ? (
						<hr />
					) : null}
					{tool === "metadata" || tool === "rotate" ? (
						<PDFManager.ButtonAction
							onClick={(data) => {
								return data.map((datum) => ({
									...datum,
									rotation: (datum.rotation + 90) % 360,
								}));
							}}
							className="secondary"
						>
							<Icon
								icon="rotate-cw"
								height={16}
								width={16}
								title="Rotate"
								decorative
							/>
							<span>Rotate All</span>
						</PDFManager.ButtonAction>
					) : null}
					{tool === "metadata" || tool === "reverse" ? (
						<PDFManager.ButtonAction
							onClick={(data) => data.toReversed()}
							className="secondary"
						>
							<Icon
								icon="repeat"
								height={16}
								width={16}
								title="Reverse"
								decorative
							/>
							<span>Reverse Pages</span>
						</PDFManager.ButtonAction>
					) : null}
					<hr />
				</PDFManager.Form>
				<PDFManager.View className={styles.viewContainer} />
			</div>
		</PDFManager>
	);
}
