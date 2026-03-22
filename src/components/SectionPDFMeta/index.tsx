import type React from "react";
import { useCallback, useRef } from "react";
import Icon from "@/lib/ui/Icon";
import Input from "@/lib/ui/Input";
import PDFManager from "@/lib/ui/PDFManager";
import type { pdflib } from "@/lib/utils/pdf";

import styles from "./styles.module.scss";

export default function SectionPDFMeta(
	props: React.ComponentProps<typeof PDFManager>,
) {
	const downloadLinkRef = useRef<string>("");
	const handleSave = useCallback(
		(async (pages, formData, utils) => {
			if (downloadLinkRef.current) {
				URL.revokeObjectURL(downloadLinkRef.current);
			}
			const data = (pages || [])
				.map((item) => {
					const page = utils?.get?.(item.id)?.pdfDocument?.getPage(item.index);
					if (!page) {
						return undefined;
					}
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
				.filter((page): page is pdflib.PDFPage => Boolean(page));

			const metaTitle = String(formData?.get("metaTitle") || "") || undefined;
			const metaSubject =
				String(formData?.get("metaSubject") || "") || undefined;
			const metaAuthor = String(formData?.get("metaAuthor") || "") || undefined;
			const metaCreator =
				String(formData?.get("metaCreator") || "") || undefined;
			const metaProducer =
				String(formData?.get("metaProducer") || "") || undefined;
			const metaCreationDate =
				String(formData?.get("metaCreationDate") || "") || undefined;
			const metaModificationDate =
				String(formData?.get("metaModificationDate") || "") || undefined;

			const { imposePDFPages } = await import("@/lib/utils/pdf");
			const doc = await imposePDFPages(data, {
				metaTitle,
				metaSubject,
				metaAuthor,
				metaCreator,
				metaProducer,
				metaCreationDate: metaCreationDate
					? new Date(metaCreationDate).toISOString()
					: undefined,
				metaModificationDate: metaModificationDate
					? new Date(metaModificationDate).toISOString()
					: undefined,
			});
			const bytes = await doc.save();
			const blob = new Blob([bytes as unknown as BlobPart], {
				type: "application/pdf",
			});

			const a = document.createElement("a");
			a.href = URL.createObjectURL(blob);
			a.download = `merged-${Date.now().toString(36)}.pdf`;

			a.click();
			downloadLinkRef.current = a.href;
		}) satisfies NonNullable<
			React.ComponentProps<typeof PDFManager.Form>["onSubmit"]
		>,
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
					<Input
						name="metaTitle"
						label="Title"
						type="text"
						defaultValue=""
						className={styles.optionsItem}
					/>
					<Input
						name="metaSubject"
						label="Subject"
						type="text"
						defaultValue=""
						className={styles.optionsItem}
					/>
					<Input
						name="metaAuthor"
						label="Author"
						type="text"
						defaultValue=""
						className={styles.optionsItem}
					/>
					<Input
						name="metaCreator"
						label="Creator"
						type="text"
						defaultValue=""
						className={styles.optionsItem}
					/>
					<Input
						name="metaProducer"
						label="Producer"
						type="text"
						defaultValue=""
						className={styles.optionsItem}
					/>
					<Input
						name="metaCreationDate"
						label="Creation Date"
						type="date"
						defaultValue=""
						className={styles.optionsItem}
					/>
					<Input
						name="metaModificationDate"
						label="Modification Date"
						type="date"
						defaultValue=""
						className={styles.optionsItem}
					/>
					<hr />
					<PDFManager.ButtonAction
						onClick={(data) => {
							return data.map((datum) => ({
								...datum,
								rotation: (datum.rotation + 90) % 360,
							}));
						}}
						className="secondary"
					>
						<Icon icon="rotate-cw" height={16} width={16} title="Rotate" />
						<span>Rotate All</span>
					</PDFManager.ButtonAction>
					<PDFManager.ButtonAction
						onClick={(data) => {
							return data.toReversed();
						}}
						className="secondary"
					>
						<Icon icon="repeat" height={16} width={16} title="Reverse" />
						<span>Reverse Pages</span>
					</PDFManager.ButtonAction>
					<hr />
				</PDFManager.Form>
				<PDFManager.View className={styles.viewContainer} />
			</div>
		</PDFManager>
	);
}
