import { padIndex } from "./pdf-geometry";

export function pdfBytesToBlob(bytes: Uint8Array) {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return new Blob([copy], { type: "application/pdf" });
}

export function downloadBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	setTimeout(() => {
		URL.revokeObjectURL(url);
	}, 30_000);
}

export async function downloadPdfBlobs(blobs: Blob[], baseName: string) {
	const first = blobs[0];
	if (!first) {
		throw new Error("Nothing to download.");
	}
	if (blobs.length === 1) {
		downloadBlob(first, `${baseName}.pdf`);
		return;
	}
	const { default: JSZip } = await import("jszip");
	const zip = new JSZip();
	blobs.forEach((blob, index) => {
		zip.file(`page-${padIndex(index + 1, blobs.length)}.pdf`, blob);
	});
	const zipped = await zip.generateAsync({ type: "blob" });
	downloadBlob(zipped, `${baseName}.zip`);
}
