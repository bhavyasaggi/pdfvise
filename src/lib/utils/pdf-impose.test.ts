import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inflateSync } from "node:zlib";

import { degrees, PageSizes, PDFDocument, StandardFonts } from "pdf-lib";

import { PDF_PAGE_TOOLS } from "../pdf-tools.ts";
import { buildPdfBlobs, readMetadataOptions } from "./pdf-export.ts";
import { cropInsetsFromBoxes } from "./pdf-geometry.ts";
import { type ImposeSourcePage, imposePDFPages } from "./pdf-impose.ts";

async function drawPage(
	doc: PDFDocument,
	size: [number, number],
	label: string,
) {
	const page = doc.addPage(size);
	const font = await doc.embedFont(StandardFonts.Helvetica);
	page.drawText(label, { x: 24, y: 24, size: 18, font });
	return page;
}

function spec(
	page: Awaited<ReturnType<typeof drawPage>>,
	overrides: Partial<ImposeSourcePage> = {},
): ImposeSourcePage {
	const media = page.getMediaBox();
	const crop = page.getCropBox();
	return {
		page,
		rotation: page.getRotation().angle,
		width: media.width,
		height: media.height,
		...cropInsetsFromBoxes(media, crop),
		...overrides,
	};
}

async function source(label = "ONE") {
	const doc = await PDFDocument.create({ updateMetadata: false });
	doc.setTitle("Original");
	doc.setAuthor("Ada");
	doc.setKeywords(["eggs", "wall"]);
	doc.setCreationDate(new Date(2020, 0, 2));
	const page = await drawPage(doc, [200, 400], label);
	return { doc, page };
}

function decodedPdf(bytes: Uint8Array) {
	const raw = Buffer.from(bytes);
	const source = raw.toString("latin1");
	const chunks = [source];
	let offset = 0;
	while (offset < source.length) {
		const start = source.indexOf("stream\n", offset);
		if (start < 0) {
			break;
		}
		const dataStart = start + "stream\n".length;
		const end = source.indexOf("\nendstream", dataStart);
		if (end < 0) {
			break;
		}
		try {
			chunks.push(
				inflateSync(Uint8Array.from(raw.subarray(dataStart, end))).toString(
					"latin1",
				),
			);
		} catch {
			// Plain streams are already in the source text.
		}
		offset = end + 10;
	}
	return chunks.join("\n");
}

function cardsFor(doc: PDFDocument, id = "file") {
	return doc.getPages().map((page, index) => {
		const item = spec(page);
		return {
			id,
			index,
			rotation: item.rotation,
			width: item.width,
			height: item.height,
			cropTop: item.cropTop,
			cropLeft: item.cropLeft,
			cropBottom: item.cropBottom,
			cropRight: item.cropRight,
		};
	});
}

describe("imposePDFPages", () => {
	it("copies rotation and an existing crop box", async () => {
		const { page } = await source();
		page.setCropBox(10, 20, 150, 300);
		page.setRotation(degrees(90));
		const doc = await imposePDFPages([spec(page)]);
		const saved = await PDFDocument.load(
			await doc.save({ addDefaultPage: false }),
		);
		const output = saved.getPage(0);
		assert.equal(output.getRotation().angle, 90);
		const crop = output.getCropBox();
		assert.equal(crop.x, 10);
		assert.equal(crop.y, 20);
		assert.equal(crop.width, 150);
		assert.equal(crop.height, 300);
		assert.equal(saved.getTitle(), "Original");
		assert.equal(saved.getAuthor(), "Ada");
	});

	it("mirrors a copied page and keeps its rotation", async () => {
		const { page } = await source();
		page.setRotation(degrees(90));
		const imposed = await imposePDFPages([
			spec(page, { flipHorizontal: true }),
		]);
		const bytes = await imposed.save({ addDefaultPage: false });
		const saved = await PDFDocument.load(bytes);
		assert.equal(saved.getPage(0).getRotation().angle, 90);
		const raw = decodedPdf(bytes);
		assert.match(raw, /-1 0 0 1/);
		assert.match(raw, /1 0 0 1 200 0 cm/);
	});

	it("insets one page by its own margins without resizing the sheet", async () => {
		const { page } = await source();
		const imposed = await imposePDFPages([
			spec(page, { marginLeft: 50, marginRight: 50 }),
		]);
		const bytes = await imposed.save({ addDefaultPage: false });
		const saved = await PDFDocument.load(bytes);
		const output = saved.getPage(0);
		assert.equal(output.getWidth(), 200);
		assert.equal(output.getHeight(), 400);
		assert.equal(output.getRotation().angle, 0);
		assert.match(decodedPdf(bytes), /0\.5 0 0 0\.5/);
	});

	it("mirrors an embedded page when that page also has a margin", async () => {
		const { page } = await source();
		const imposed = await imposePDFPages([
			spec(page, {
				flipHorizontal: true,
				flipVertical: true,
				marginLeft: 10,
			}),
		]);
		const bytes = await imposed.save({ addDefaultPage: false });
		const saved = await PDFDocument.load(bytes);
		assert.equal(saved.getPage(0).getRotation().angle, 0);
		assert.equal(saved.getPage(0).getWidth(), 200);
		assert.match(decodedPdf(bytes), /-1 0 0 -1/);
	});

	it("writes explicit metadata and drops a cleared date", async () => {
		const { page } = await source();
		const doc = await imposePDFPages([spec(page)], {
			metaTitle: "",
			metaAuthor: "Bea",
			metaKeywords: ["kept"],
			metaCreationDate: null,
		});
		assert.equal(doc.getTitle(), "");
		assert.equal(doc.getAuthor(), "Bea");
		assert.equal(doc.getKeywords(), "kept");
		assert.equal(doc.getCreationDate(), undefined);
	});

	it("clears copied metadata when asked", async () => {
		const { page } = await source();
		const doc = await imposePDFPages([spec(page)], { clearMetadata: true });
		assert.equal(doc.getTitle(), "");
		assert.equal(doc.getAuthor(), "");
		assert.equal(doc.getKeywords(), "");
	});

	it("places four pages on one n-up sheet and a fifth on the next", async () => {
		const doc = await PDFDocument.create({ updateMetadata: false });
		const pages = [];
		for (const label of ["A", "B", "C", "D", "E"]) {
			pages.push(spec(await drawPage(doc, [200, 400], label)));
		}
		const imposed = await imposePDFPages(pages, {
			layout: "4-n-up",
			pageWidth: PageSizes.A4[0],
			pageHeight: PageSizes.A4[1],
		});
		assert.equal(imposed.getPageCount(), 2);
		const sheet = imposed.getPage(0);
		assert.equal(sheet.getRotation().angle, 0);
		assert.ok(Math.abs(sheet.getWidth() - (PageSizes.A4[0] ?? 0)) < 0.01);
		assert.ok(Math.abs(sheet.getHeight() - (PageSizes.A4[1] ?? 0)) < 0.01);
	});

	it("rejects an empty page list and a crop larger than the page", async () => {
		await assert.rejects(() => imposePDFPages([]), /Add a PDF page/);
		const { page } = await source();
		await assert.rejects(
			() =>
				imposePDFPages([
					spec(page, {
						cropLeft: 180,
						cropRight: 180,
						cropTop: 0,
						cropBottom: 0,
					}),
				]),
			/Crop is larger than the page/,
		);
	});

	it("draws a footer and a watermark into the page content", async () => {
		const { doc, page } = await source();
		const second = spec(await drawPage(doc, [200, 400], "TWO"));
		const imposed = await imposePDFPages([spec(page), second], {
			footerText: "{n} / {total}",
			watermarkText: "SECRET",
		});
		const raw = decodedPdf(
			await imposed.save({ addDefaultPage: false }),
		).replace(/<([0-9A-Fa-f\s]+)>/g, (token, hex: string) => {
			const compact = hex.replace(/\s+/g, "");
			if (compact.length < 2 || compact.length % 2 !== 0) {
				return token;
			}
			let text = "";
			for (let index = 0; index < compact.length; index += 2) {
				text += String.fromCharCode(
					Number.parseInt(compact.slice(index, index + 2), 16),
				);
			}
			return text;
		});
		assert.match(raw, /1 \/ 2/);
		assert.match(raw, /2 \/ 2/);
		assert.match(raw, /SECRET/);
	});

	it("flattens fields before copying pages", async () => {
		const doc = await PDFDocument.create({ updateMetadata: false });
		const page = await drawPage(doc, [200, 400], "FORM");
		doc.getForm().createTextField("name").addToPage(page, {
			x: 20,
			y: 40,
			width: 80,
			height: 16,
		});
		const imposed = await imposePDFPages([spec(page)], { flatten: true });
		assert.equal(imposed.getPageCount(), 1);
		assert.equal(doc.getForm().getFields().length, 0);
		assert.equal(imposed.catalog.AcroForm(), undefined);
	});

	it("copies the same page twice when it is duplicated", async () => {
		const { page } = await source();
		const imposed = await imposePDFPages([spec(page), spec(page)]);
		assert.equal(imposed.getPageCount(), 2);
	});

	it("rejects margins that leave no room", async () => {
		const { page } = await source();
		await assert.rejects(
			() =>
				imposePDFPages([spec(page)], {
					pageWidth: 200,
					pageHeight: 400,
					pageMarginTop: 300,
					pageMarginBottom: 200,
				}),
			/Margins are larger than the page/,
		);
	});
});

describe("buildPdfBlobs", () => {
	it("splits on the break preset and keeps a zero batch finite", async () => {
		const doc = await PDFDocument.create({ updateMetadata: false });
		await drawPage(doc, [200, 400], "A");
		await drawPage(doc, [200, 400], "B");
		const cards = cardsFor(doc);
		const get = () => ({ pdfDocument: doc });
		const split = await buildPdfBlobs(
			cards,
			get,
			new FormData(),
			PDF_PAGE_TOOLS.break,
		);
		assert.equal(split.length, 2);
		const form = new FormData();
		form.set("pageBatchSize", "0");
		const together = await buildPdfBlobs(
			cards,
			get,
			form,
			PDF_PAGE_TOOLS.break,
		);
		assert.equal(together.length, 1);
	});

	it("turns a portrait page sideways when landscape is requested", async () => {
		const doc = await PDFDocument.create({ updateMetadata: false });
		await drawPage(doc, [200, 400], "A");
		const form = new FormData();
		form.set("pageOrientation", "1");
		form.set("pageSize", "");
		const blobs = await buildPdfBlobs(
			cardsFor(doc),
			() => ({ pdfDocument: doc }),
			form,
			PDF_PAGE_TOOLS.resize,
		);
		const blob = blobs[0];
		assert.ok(blob);
		const saved = await PDFDocument.load(await blob.arrayBuffer());
		assert.equal(saved.getPage(0).getRotation().angle, 90);
	});

	it("swaps a named page size for landscape without rotating the sheet", async () => {
		const doc = await PDFDocument.create({ updateMetadata: false });
		await drawPage(doc, [200, 400], "A");
		const form = new FormData();
		form.set("pageOrientation", "1");
		form.set("pageSize", "Letter");
		const blobs = await buildPdfBlobs(
			cardsFor(doc),
			() => ({ pdfDocument: doc }),
			form,
			PDF_PAGE_TOOLS.resize,
		);
		const blob = blobs[0];
		assert.ok(blob);
		const saved = await PDFDocument.load(await blob.arrayBuffer());
		const page = saved.getPage(0);
		assert.equal(page.getRotation().angle, 0);
		assert.ok(Math.abs(page.getWidth() - 792) < 0.1);
		assert.ok(Math.abs(page.getHeight() - 612) < 0.1);
	});

	it("reads metadata dates as local calendar days", () => {
		const form = new FormData();
		form.set("metaTitle", "Title");
		form.set("metaSubject", "");
		form.set("metaAuthor", "");
		form.set("metaCreator", "");
		form.set("metaProducer", "");
		form.set("metaKeywords", "eggs, wall");
		form.set("metaCreationDate", "2020-01-02");
		form.set("metaModificationDate", "");
		const options = readMetadataOptions(form);
		assert.equal(options.metaTitle, "Title");
		assert.deepEqual(options.metaKeywords, ["eggs", "wall"]);
		assert.equal(options.metaCreationDate?.getFullYear(), 2020);
		assert.equal(options.metaCreationDate?.getMonth(), 0);
		assert.equal(options.metaCreationDate?.getDate(), 2);
		assert.equal(options.metaModificationDate, null);
	});
});
