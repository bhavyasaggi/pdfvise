import type React from "react";
import { useCallback, useRef } from "react";
import PDFManager from "@/lib/ui/PDFManager";

import styles from "./styles.module.scss";

export default function SectionPDFExtractImages(
	props: React.ComponentProps<typeof PDFManager>,
) {
	const downloadLinkRef = useRef<string>("");
	const handleSave = useCallback(
		(async (pages, _formData, utils) => {
			if (downloadLinkRef.current) {
				URL.revokeObjectURL(downloadLinkRef.current);
			}

			const { default: JSZip } = await import("jszip");
			const zip = new JSZip();

			for (const page of pages || []) {
				if (!page?.opIndex) {
					continue;
				}

				const image = await utils?.extractImage?.(
					{ id: page.id, index: page.index },
					{
						imageIndex: page.opIndex,
					},
				);
				if (image) {
					zip.file(
						`page-${`${page.opIndex + 1}`.padStart(
							Math.max(0, 9 - String(page.opIndex + 1).length),
							"0",
						)}.png`,
						image,
					);
				}
			}

			const bytes = await zip.generateAsync({ type: "blob" });
			const a = document.createElement("a");
			a.href = URL.createObjectURL(bytes);
			a.download = `images-${Date.now().toString(36)}.zip`;

			a.click();
			downloadLinkRef.current = a.href;
		}) satisfies NonNullable<
			React.ComponentProps<typeof PDFManager.Form>["onSubmit"]
		>,
		[],
	);

	return (
		<PDFManager {...props} mode="imagesOnly">
			<div className={styles.section}>
				<PDFManager.Form
					onSubmit={handleSave}
					className={styles.optionsContainer}
				>
					<hr />
				</PDFManager.Form>
				<PDFManager.View className={styles.viewContainer as string} />
			</div>
		</PDFManager>
	);
}
