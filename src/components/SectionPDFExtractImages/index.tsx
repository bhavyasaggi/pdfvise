import type { ComponentProps } from "react";
import { useCallback } from "react";

import PDFManager from "@/lib/ui/PDFManager";
import { padIndex } from "@/lib/utils/pdf-geometry";

import styles from "./styles.module.scss";

export default function SectionPDFExtractImages(
	props: ComponentProps<typeof PDFManager>,
) {
	const handleSave = useCallback<
		NonNullable<ComponentProps<typeof PDFManager.Form>["onSubmit"]>
	>(async (pages, _formData, utils) => {
		const images = pages ?? [];
		const { default: JSZip } = await import("jszip");
		const { downloadBlob } = await import("@/lib/utils/download");
		const zip = new JSZip();
		const fileOrder = new Map<string, number>();
		let count = 0;
		for (const page of images) {
			if (page.opIndex === undefined) {
				continue;
			}
			const image = await utils?.extractImage?.(
				{ id: page.id, index: page.index },
				{ imageIndex: page.opIndex },
			);
			if (!image) {
				continue;
			}
			count += 1;
			const fileNumber = fileOrder.get(page.id) ?? fileOrder.size + 1;
			fileOrder.set(page.id, fileNumber);
			zip.file(
				`file-${padIndex(fileNumber, images.length)}-page-${padIndex(page.index + 1, images.length)}-image-${padIndex(count, images.length)}.png`,
				image,
			);
		}
		if (count === 0) {
			throw new Error("No images were found in this PDF.");
		}
		const bytes = await zip.generateAsync({ type: "blob" });
		downloadBlob(bytes, `images-${Date.now().toString(36)}.zip`);
	}, []);

	return (
		<PDFManager {...props} mode="imagesOnly">
			<div className={styles.section}>
				<PDFManager.Form
					onSubmit={handleSave}
					className={styles.optionsContainer}
				>
					<hr />
				</PDFManager.Form>
				<PDFManager.View className={styles.viewContainer} />
			</div>
		</PDFManager>
	);
}
