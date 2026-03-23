import type { PDFDocument, PDFFont, PDFPage, Rotation } from "pdf-lib";
import * as pdflib from "pdf-lib";

import {
	type Box,
	type CropInsets,
	cropBoxFromInsets,
	drawAnchor,
	fillPageTemplate,
	fitPageInSlot,
	normalizeQuarterTurn,
} from "./pdf-geometry";
import type { LayoutSlot } from "./pdf-layout";
import PDFLayoutFactory from "./pdf-layout";

export type ImposeSourcePage = CropInsets & {
	page: PDFPage;
	rotation: number;
	width: number;
	height: number;
	flipHorizontal?: boolean;
	flipVertical?: boolean;
	marginTop?: number;
	marginRight?: number;
	marginBottom?: number;
	marginLeft?: number;
};

export type ImposeOptions = {
	layout?: "1-n-up" | "4-zine" | "4-n-up";
	pageWidth?: number;
	pageHeight?: number;
	pageMarginLeft?: number;
	pageMarginRight?: number;
	pageMarginTop?: number;
	pageMarginBottom?: number;
	removeAnnotations?: boolean;
	flatten?: boolean;
	clearMetadata?: boolean;
	metaTitle?: string;
	metaSubject?: string;
	metaAuthor?: string;
	metaCreator?: string;
	metaProducer?: string;
	metaKeywords?: string[];
	metaCreationDate?: Date | null;
	metaModificationDate?: Date | null;
	headerText?: string;
	footerText?: string;
	batesPrefix?: string;
	batesStart?: number;
	watermarkText?: string;
};

type Margins = {
	left: number;
	right: number;
	top: number;
	bottom: number;
};

type IndexedPage = {
	spec: ImposeSourcePage;
	sourceIndex: number;
};

function rotationAngle(rotation?: Rotation) {
	if (!rotation) {
		return 0;
	}
	return rotation.type === "radians"
		? (rotation.angle * 180) / Math.PI
		: rotation.angle;
}

function insetAmount(value: number | undefined) {
	if (value === undefined || !Number.isFinite(value) || value <= 0) {
		return 0;
	}
	return value;
}

function hasPageMargin(spec: ImposeSourcePage) {
	return (
		insetAmount(spec.marginLeft) > 0 ||
		insetAmount(spec.marginRight) > 0 ||
		insetAmount(spec.marginTop) > 0 ||
		insetAmount(spec.marginBottom) > 0
	);
}

function needsEmbed(
	options: ImposeOptions,
	pages: readonly ImposeSourcePage[],
) {
	const layout = options.layout ?? "1-n-up";
	return (
		layout === "4-zine" ||
		layout === "4-n-up" ||
		options.pageWidth !== undefined ||
		options.pageHeight !== undefined ||
		insetAmount(options.pageMarginLeft) > 0 ||
		insetAmount(options.pageMarginRight) > 0 ||
		insetAmount(options.pageMarginTop) > 0 ||
		insetAmount(options.pageMarginBottom) > 0 ||
		pages.some(hasPageMargin)
	);
}

function marginsOf(options: ImposeOptions): Margins {
	return {
		left: options.pageMarginLeft ?? 0,
		right: options.pageMarginRight ?? 0,
		top: options.pageMarginTop ?? 0,
		bottom: options.pageMarginBottom ?? 0,
	};
}

function assertRoom(width: number, height: number, message: string) {
	if (width <= 1 || height <= 1) {
		throw new Error(message);
	}
}

function indexPages(pages: readonly ImposeSourcePage[]): IndexedPage[] {
	return pages.map((spec) => {
		const sourceIndex = spec.page.doc.getPages().indexOf(spec.page);
		if (sourceIndex < 0) {
			throw new Error("PDF page is no longer available.");
		}
		return { spec, sourceIndex };
	});
}

function flattenSources(pages: readonly ImposeSourcePage[]) {
	const seen = new Set<PDFDocument>();
	for (const spec of pages) {
		const source = spec.page.doc;
		if (seen.has(source)) {
			continue;
		}
		seen.add(source);
		if (!source.catalog.AcroForm()) {
			continue;
		}
		const form = source.getForm();
		if (form.getFields().length > 0) {
			form.flatten();
		}
	}
}

function applyCrop(page: PDFPage, spec: CropInsets) {
	const media = page.getMediaBox();
	const crop = cropBoxFromInsets(media, spec);
	assertRoom(crop.width, crop.height, "Crop is larger than the page.");
	page.setCropBox(crop.x, crop.y, crop.width, crop.height);
}

function mirrorMediaBox(page: PDFPage, media: Box, horizontal: boolean) {
	// The later call is the outer transform. Together they mirror the box in place.
	if (horizontal) {
		page.scaleContent(-1, 1);
		page.translateContent(media.x * 2 + media.width, 0);
		return;
	}
	page.scaleContent(1, -1);
	page.translateContent(0, media.y * 2 + media.height);
}

function flipCopiedPage(page: PDFPage, spec: ImposeSourcePage) {
	const flipHorizontal = spec.flipHorizontal === true;
	const flipVertical = spec.flipVertical === true;
	if (!flipHorizontal && !flipVertical) {
		return;
	}
	const media = page.getMediaBox();
	if (flipHorizontal) {
		mirrorMediaBox(page, media, true);
	}
	if (flipVertical) {
		mirrorMediaBox(page, media, false);
	}
}

function flipMatrix(
	crop: Box,
	spec: ImposeSourcePage,
): [number, number, number, number, number, number] | undefined {
	const flipHorizontal = spec.flipHorizontal === true;
	const flipVertical = spec.flipVertical === true;
	if (!flipHorizontal && !flipVertical) {
		return undefined;
	}
	// Mirror the crop, then park its lower-left at the origin so it stays in the form box.
	const right = crop.x + crop.width;
	const top = crop.y + crop.height;
	return [
		flipHorizontal ? -1 : 1,
		0,
		0,
		flipVertical ? -1 : 1,
		flipHorizontal ? right : -crop.x,
		flipVertical ? top : -crop.y,
	];
}

function insetSlot(
	slot: LayoutSlot,
	sheet: PDFPage,
	margins: Margins,
	spec: ImposeSourcePage,
) {
	const baseWidth =
		slot.width || sheet.getWidth() - margins.left - margins.right;
	const baseHeight =
		slot.height || sheet.getHeight() - margins.top - margins.bottom;
	const extraLeft = insetAmount(spec.marginLeft);
	const extraRight = insetAmount(spec.marginRight);
	const extraTop = insetAmount(spec.marginTop);
	const extraBottom = insetAmount(spec.marginBottom);
	return {
		width: baseWidth - extraLeft - extraRight,
		height: baseHeight - extraTop - extraBottom,
		x: slot.x + margins.left + extraLeft,
		y: slot.y + margins.bottom + extraBottom,
	};
}

function copyMetadata(doc: PDFDocument, source: PDFDocument | undefined) {
	if (!source) {
		return;
	}
	const title = source.getTitle();
	const author = source.getAuthor();
	const subject = source.getSubject();
	const creator = source.getCreator();
	const producer = source.getProducer();
	const keywords = source.getKeywords();
	const created = source.getCreationDate();
	const modified = source.getModificationDate();
	if (title) {
		doc.setTitle(title);
	}
	if (author) {
		doc.setAuthor(author);
	}
	if (subject) {
		doc.setSubject(subject);
	}
	if (creator) {
		doc.setCreator(creator);
	}
	if (producer) {
		doc.setProducer(producer);
	}
	if (keywords) {
		doc.setKeywords(keywords.split(/\s+/).filter(Boolean));
	}
	if (created) {
		doc.setCreationDate(created);
	}
	if (modified) {
		doc.setModificationDate(modified);
	}
}

function clearMetadata(doc: PDFDocument) {
	doc.setTitle("");
	doc.setAuthor("");
	doc.setSubject("");
	doc.setCreator("");
	doc.setProducer("");
	doc.setKeywords([]);
}

function metadataIsExplicit(options: ImposeOptions) {
	return (
		options.metaTitle !== undefined ||
		options.metaAuthor !== undefined ||
		options.metaSubject !== undefined ||
		options.metaCreator !== undefined ||
		options.metaProducer !== undefined ||
		options.metaKeywords !== undefined ||
		options.metaCreationDate !== undefined ||
		options.metaModificationDate !== undefined
	);
}

function assignMetadata(doc: PDFDocument, options: ImposeOptions) {
	if (options.metaTitle !== undefined) {
		doc.setTitle(options.metaTitle);
	}
	if (options.metaAuthor !== undefined) {
		doc.setAuthor(options.metaAuthor);
	}
	if (options.metaSubject !== undefined) {
		doc.setSubject(options.metaSubject);
	}
	if (options.metaCreator !== undefined) {
		doc.setCreator(options.metaCreator);
	}
	if (options.metaProducer !== undefined) {
		doc.setProducer(options.metaProducer);
	}
	if (options.metaKeywords) {
		doc.setKeywords(options.metaKeywords);
	}
	if (options.metaCreationDate instanceof Date) {
		doc.setCreationDate(options.metaCreationDate);
	}
	if (options.metaModificationDate instanceof Date) {
		doc.setModificationDate(options.metaModificationDate);
	}
}

function applyMetadata(
	doc: PDFDocument,
	source: PDFDocument | undefined,
	options: ImposeOptions,
) {
	if (options.clearMetadata) {
		clearMetadata(doc);
		return;
	}
	if (!metadataIsExplicit(options)) {
		copyMetadata(doc, source);
		return;
	}
	assignMetadata(doc, options);
}

function hasFurniture(options: ImposeOptions) {
	return Boolean(
		options.headerText?.trim() ||
			options.footerText?.trim() ||
			options.watermarkText?.trim() ||
			options.batesPrefix !== undefined ||
			options.batesStart !== undefined,
	);
}

function drawCentered(
	page: PDFPage,
	font: PDFFont,
	text: string,
	y: number,
	size: number,
) {
	const width = page.getWidth();
	const textWidth = font.widthOfTextAtSize(text, size);
	page.drawText(text, {
		x: Math.max(16, (width - textWidth) / 2),
		y,
		size,
		font,
		color: pdflib.rgb(0.12, 0.14, 0.18),
	});
}

function drawFurniture(
	page: PDFPage,
	font: PDFFont,
	pageIndex: number,
	pageCount: number,
	options: ImposeOptions,
) {
	const header = options.headerText?.trim();
	const footer = options.footerText?.trim();
	const watermark = options.watermarkText?.trim();
	const hasBates =
		options.batesPrefix !== undefined || options.batesStart !== undefined;
	if (!header && !footer && !watermark && !hasBates) {
		return;
	}

	const { width, height } = page.getSize();
	const size = 10;
	const label = (template: string) =>
		fillPageTemplate(template, pageIndex + 1, pageCount);

	if (header) {
		drawCentered(page, font, label(header), height - 24, size);
	}
	if (footer) {
		drawCentered(page, font, label(footer), 18, size);
	}
	if (hasBates) {
		const text = `${options.batesPrefix ?? ""}${(options.batesStart ?? 1) + pageIndex}`;
		const textWidth = font.widthOfTextAtSize(text, size);
		page.drawText(text, {
			x: Math.max(16, width - textWidth - 16),
			y: height - 24,
			size,
			font,
			color: pdflib.rgb(0.12, 0.14, 0.18),
		});
	}
	if (watermark) {
		const text = label(watermark);
		const watermarkSize = 48;
		const textWidth = font.widthOfTextAtSize(text, watermarkSize);
		const angle = Math.PI / 4;
		page.drawText(text, {
			x: width / 2 - (textWidth / 2) * Math.cos(angle),
			y: height / 2 - (textWidth / 2) * Math.sin(angle),
			size: watermarkSize,
			font,
			color: pdflib.rgb(0.65, 0.67, 0.72),
			opacity: 0.35,
			rotate: pdflib.degrees(45),
		});
	}
}

async function copyPagesInOrder(
	doc: PDFDocument,
	indexed: readonly IndexedPage[],
) {
	const groups = new Map<PDFDocument, number[]>();
	for (const item of indexed) {
		const source = item.spec.page.doc;
		const indices = groups.get(source) ?? [];
		indices.push(item.sourceIndex);
		groups.set(source, indices);
	}

	const queues = new Map<PDFDocument, PDFPage[]>();
	for (const [source, indices] of groups) {
		queues.set(source, await doc.copyPages(source, indices));
	}

	const copied: PDFPage[] = [];
	for (const item of indexed) {
		const page = queues.get(item.spec.page.doc)?.shift();
		if (!page) {
			throw new Error("PDF page could not be copied.");
		}
		flipCopiedPage(page, item.spec);
		page.setRotation(pdflib.degrees(normalizeQuarterTurn(item.spec.rotation)));
		applyCrop(page, item.spec);
		copied.push(page);
	}
	return copied;
}

async function placeByCopy(
	doc: PDFDocument,
	indexed: readonly IndexedPage[],
	options: ImposeOptions,
) {
	const copied = await copyPagesInOrder(doc, indexed);
	for (const page of copied) {
		if (options.removeAnnotations) {
			page.node.delete(pdflib.PDFName.of("Annots"));
		}
		doc.addPage(page);
	}
}

function sheetForSpec(
	doc: PDFDocument,
	spec: ImposeSourcePage,
	slotPageNumber: number,
	uniform: boolean,
	baseWidth: number,
	baseHeight: number,
) {
	if (slotPageNumber > doc.getPageCount()) {
		const sheetWidth = uniform ? baseWidth : spec.width;
		const sheetHeight = uniform ? baseHeight : spec.height;
		return doc.addPage([sheetWidth, sheetHeight]);
	}
	return doc.getPage(doc.getPageCount() - 1);
}

async function drawEmbeddedSpec(
	doc: PDFDocument,
	spec: ImposeSourcePage,
	slot: LayoutSlot,
	margins: Margins,
	uniform: boolean,
	baseWidth: number,
	baseHeight: number,
) {
	const sheet = sheetForSpec(
		doc,
		spec,
		slot.pageNumber,
		uniform,
		baseWidth,
		baseHeight,
	);
	const inset = insetSlot(slot, sheet, margins, spec);
	assertRoom(inset.width, inset.height, "Margins are larger than the page.");

	const crop = cropBoxFromInsets(spec.page.getMediaBox(), spec);
	assertRoom(crop.width, crop.height, "Crop is larger than the page.");
	const embedded = await doc.embedPage(
		spec.page,
		{
			left: crop.x,
			bottom: crop.y,
			right: crop.x + crop.width,
			top: crop.y + crop.height,
		},
		flipMatrix(crop, spec),
	);
	const rotation = normalizeQuarterTurn(
		spec.rotation + rotationAngle(slot.rotate),
	);
	const fit = fitPageInSlot(
		embedded.width,
		embedded.height,
		rotation,
		inset.width,
		inset.height,
	);
	const anchor = drawAnchor(
		inset.x + fit.offsetX,
		inset.y + fit.offsetY,
		fit.drawnWidth,
		fit.drawnHeight,
		fit.rotation,
	);
	sheet.drawPage(embedded, {
		x: anchor.x,
		y: anchor.y,
		width: fit.drawnWidth,
		height: fit.drawnHeight,
		rotate: pdflib.degrees(fit.rotation),
	});
}

async function placeByEmbed(
	doc: PDFDocument,
	pages: readonly ImposeSourcePage[],
	options: ImposeOptions,
) {
	const margins = marginsOf(options);
	const layout = options.layout ?? "1-n-up";
	const uniform =
		layout !== "1-n-up" ||
		options.pageWidth !== undefined ||
		options.pageHeight !== undefined;
	const first = pages[0];
	const baseWidth = options.pageWidth ?? first?.width ?? pdflib.PageSizes.A4[0];
	const baseHeight =
		options.pageHeight ?? first?.height ?? pdflib.PageSizes.A4[1];
	const innerWidth = baseWidth - margins.left - margins.right;
	const innerHeight = baseHeight - margins.top - margins.bottom;
	assertRoom(innerWidth, innerHeight, "Margins are larger than the page.");

	const layoutGenerator = PDFLayoutFactory({
		layout,
		pageWidth: innerWidth,
		pageHeight: innerHeight,
	});
	for (const spec of pages) {
		const next = layoutGenerator.next();
		if (next.done || !next.value) {
			break;
		}
		await drawEmbeddedSpec(
			doc,
			spec,
			next.value,
			margins,
			uniform,
			baseWidth,
			baseHeight,
		);
	}
}

async function stampFurniture(doc: PDFDocument, options: ImposeOptions) {
	if (!hasFurniture(options)) {
		return;
	}
	const font = await doc.embedFont(pdflib.StandardFonts.Helvetica);
	const output = doc.getPages();
	for (let index = 0; index < output.length; index += 1) {
		const page = output[index];
		if (page) {
			drawFurniture(page, font, index, output.length, options);
		}
	}
}

export async function imposePDFPages(
	pages: readonly ImposeSourcePage[],
	options: ImposeOptions = {},
) {
	if (pages.length === 0) {
		throw new Error("Add a PDF page before saving.");
	}
	const indexed = indexPages(pages);
	if (options.flatten) {
		flattenSources(pages);
	}

	const doc = await pdflib.PDFDocument.create({ updateMetadata: false });
	if (needsEmbed(options, pages)) {
		await placeByEmbed(doc, pages, options);
	} else {
		await placeByCopy(doc, indexed, options);
	}

	applyMetadata(doc, pages[0]?.page.doc, options);
	await stampFurniture(doc, options);
	return doc;
}
