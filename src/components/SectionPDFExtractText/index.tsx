import type { ComponentProps } from "react";
import { useCallback } from "react";

import PDFManager from "@/lib/ui/PDFManager";

import styles from "../SectionPDFPages/styles.module.scss";

export default function SectionPDFExtractText(
	props: ComponentProps<typeof PDFManager>,
) {
	const handleSave = useCallback<
		NonNullable<ComponentProps<typeof PDFManager.Form>["onSubmit"]>
	>(async (pages, _formData, utils) => {
		if (!utils?.extractText || !utils.get) {
			throw new Error("Add a PDF page before saving.");
		}
		const groups = new Map<string, { name: string; chunks: string[] }>();
		for (const page of pages ?? []) {
			const text = await utils.extractText({ id: page.id, index: page.index });
			const name = utils.get(page.id)?.file.name ?? "document.pdf";
			const chunk = `--- Page ${page.index + 1} ---\n${text}`;
			const group = groups.get(page.id);
			if (group) {
				group.chunks.push(chunk);
			} else {
				groups.set(page.id, { name, chunks: [chunk] });
			}
		}
		if (groups.size === 0) {
			throw new Error("Add a PDF page before saving.");
		}
		const { downloadBlob } = await import("@/lib/utils/download");
		const entries = [...groups.values()];
		const used = new Set<string>();
		const fileName = (name: string) => {
			const base = name.replace(/\.pdf$/i, "") || "document";
			let candidate = `${base}.txt`;
			let suffix = 2;
			while (used.has(candidate)) {
				candidate = `${base}-${suffix}.txt`;
				suffix += 1;
			}
			used.add(candidate);
			return candidate;
		};
		const first = entries[0];
		if (entries.length === 1 && first) {
			downloadBlob(
				new Blob([first.chunks.join("\n\n")], { type: "text/plain" }),
				fileName(first.name),
			);
			return;
		}
		const { default: JSZip } = await import("jszip");
		const zip = new JSZip();
		for (const group of entries) {
			zip.file(fileName(group.name), group.chunks.join("\n\n"));
		}
		downloadBlob(
			await zip.generateAsync({ type: "blob" }),
			`text-${Date.now().toString(36)}.zip`,
		);
	}, []);

	return (
		<PDFManager {...props}>
			<div className={styles.section}>
				<PDFManager.Form
					onSubmit={handleSave}
					className={styles.optionsContainer}
				>
					<hr />
					<small>
						This reads the text layer already stored in the PDF. Scanned pages
						without embedded text come back empty.
					</small>
					<hr />
				</PDFManager.Form>
				<PDFManager.View className={styles.viewContainer} />
			</div>
		</PDFManager>
	);
}
