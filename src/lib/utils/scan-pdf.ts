import { PDFDocument } from "pdf-lib";

import { scanPagePoints } from "./scan";
import { yieldToMain } from "./schedule";

export async function buildScanPdf(jpegs: readonly Uint8Array[]) {
	if (jpegs.length === 0) {
		throw new Error("Add a page before saving.");
	}
	const doc = await PDFDocument.create({ updateMetadata: false });
	doc.setTitle("Scan");
	doc.setCreator("PDFvise");
	doc.setProducer("PDFvise");
	doc.setCreationDate(new Date());
	for (const jpeg of jpegs) {
		await yieldToMain();
		const image = await doc.embedJpg(jpeg);
		const size = scanPagePoints(image.width, image.height);
		if (!size) {
			throw new Error("This photo could not be read.");
		}
		const page = doc.addPage([size.width, size.height]);
		page.drawImage(image, {
			x: 0,
			y: 0,
			width: size.width,
			height: size.height,
		});
	}
	return doc.save({ addDefaultPage: false });
}
