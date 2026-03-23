import type { PDFDocument } from "pdf-lib";
import { PageSizes } from "pdf-lib";
import type { PDFPagesToolConfig } from "@/lib/pdf-tools";
import type { PDFPageDataType } from "@/lib/ui/PDFManager/types";

import { pdfBytesToBlob } from "./download";
import {
	type CropInsets,
	readFiniteNumber,
	withOrientation,
} from "./pdf-geometry";
import type { ImposeOptions, ImposeSourcePage } from "./pdf-impose";
import { imposePDFPages } from "./pdf-impose";

type PageLookup = (id: string) => { pdfDocument: PDFDocument } | undefined;

export function specsFromPages(
	pages: readonly PDFPageDataType[],
	get: PageLookup,
) {
	const specs: ImposeSourcePage[] = [];
	for (const item of pages) {
		const stored = get(item.id);
		const page = stored?.pdfDocument.getPages()[item.index];
		if (!page) {
			continue;
		}
		specs.push({
			page,
			rotation: item.rotation,
			width: item.width,
			height: item.height,
			cropLeft: item.cropLeft,
			cropBottom: item.cropBottom,
			cropRight: item.cropRight,
			cropTop: item.cropTop,
			flipHorizontal: item.flipHorizontal,
			flipVertical: item.flipVertical,
			marginTop: item.marginTop,
			marginRight: item.marginRight,
			marginBottom: item.marginBottom,
			marginLeft: item.marginLeft,
		});
	}
	if (specs.length === 0) {
		throw new Error("Add a PDF page before saving.");
	}
	return specs;
}

function formValue(formData: FormData, name: string, fallback: string) {
	const value = formData.get(name);
	return typeof value === "string" ? value : fallback;
}

function points(
	formData: FormData,
	amountName: string,
	unitName: string,
	shown: boolean,
) {
	if (!shown) {
		return 0;
	}
	const amount = readFiniteNumber(formData.get(amountName)) ?? 0;
	const scale = readFiniteNumber(formData.get(unitName)) ?? 72;
	return Math.max(0, amount) * scale;
}

function sheetSize(name: string, orientation: string) {
	if (!name || !(name in PageSizes)) {
		return undefined;
	}
	const size = PageSizes[name as keyof typeof PageSizes];
	const width = size[0];
	const height = size[1];
	if (width === undefined || height === undefined) {
		return undefined;
	}
	if (orientation === "1" && width < height) {
		return { width: height, height: width };
	}
	if (orientation === "0" && width > height) {
		return { width: height, height: width };
	}
	return { width, height };
}

function layoutOf(value: string): ImposeOptions["layout"] {
	if (value === "4-zine" || value === "4-n-up") {
		return value;
	}
	return "1-n-up";
}

function addCrop(spec: ImposeSourcePage, extra: CropInsets): ImposeSourcePage {
	return {
		...spec,
		cropLeft: spec.cropLeft + extra.cropLeft,
		cropBottom: spec.cropBottom + extra.cropBottom,
		cropRight: spec.cropRight + extra.cropRight,
		cropTop: spec.cropTop + extra.cropTop,
	};
}

function positiveCount(value: string, fallback: number) {
	const number = Number(value);
	if (!Number.isFinite(number) || number < 1) {
		return fallback;
	}
	return Math.floor(number);
}

function shownValue(
	formData: FormData,
	shown: boolean,
	name: string,
	fallback: string,
) {
	return shown ? formValue(formData, name, fallback) : fallback;
}

function orientSpecs(
	specs: ImposeSourcePage[],
	orientation: string,
	size: { width: number; height: number } | undefined,
) {
	if (size) {
		return specs;
	}
	const mode =
		orientation === "1" ? "landscape" : orientation === "0" ? "portrait" : "";
	return withOrientation(specs, mode);
}

function cropSpecs(
	specs: ImposeSourcePage[],
	formData: FormData,
	shown: boolean,
) {
	if (!shown) {
		return specs;
	}
	const extra = {
		cropTop: points(formData, "cropTop", "cropTopUnit", true),
		cropBottom: points(formData, "cropBottom", "cropBottomUnit", true),
		cropLeft: points(formData, "cropLeft", "cropLeftUnit", true),
		cropRight: points(formData, "cropRight", "cropRightUnit", true),
	};
	return specs.map((spec) => addCrop(spec, extra));
}

function marginPair(
	formData: FormData,
	shown: boolean,
	topName: string,
	bottomName: string,
	topFloor: number,
	bottomFloor: number,
) {
	return {
		top: Math.max(points(formData, topName, `${topName}Unit`, shown), topFloor),
		bottom: Math.max(
			points(formData, bottomName, `${bottomName}Unit`, shown),
			bottomFloor,
		),
	};
}

function furnitureFromForm(
	formData: FormData,
	config: PDFPagesToolConfig,
): Pick<
	ImposeOptions,
	"headerText" | "footerText" | "watermarkText" | "batesPrefix" | "batesStart"
> {
	const { show, defaults } = config;
	const headerText = shownValue(
		formData,
		show.header,
		"headerText",
		defaults.headerText,
	).trim();
	const footerText = shownValue(
		formData,
		show.footer,
		"footerText",
		defaults.footerText,
	).trim();
	const watermarkText = shownValue(
		formData,
		show.watermark,
		"watermarkText",
		defaults.watermarkText,
	).trim();
	const batesPrefix = shownValue(
		formData,
		show.bates,
		"batesPrefix",
		defaults.batesPrefix,
	);
	const batesStartValue = shownValue(
		formData,
		show.bates,
		"batesStart",
		defaults.batesStart,
	);
	const useBates =
		show.bates &&
		(batesPrefix.trim() !== "" ||
			readFiniteNumber(batesStartValue) !== undefined);
	return {
		headerText,
		footerText,
		watermarkText,
		batesPrefix: useBates ? batesPrefix : undefined,
		batesStart: useBates
			? Math.floor(readFiniteNumber(batesStartValue) ?? 1)
			: undefined,
	};
}

function optionsFromForm(
	formData: FormData,
	config: PDFPagesToolConfig,
	size: { width: number; height: number } | undefined,
	furniture: ReturnType<typeof furnitureFromForm>,
): ImposeOptions {
	const { show, defaults } = config;
	const vertical = marginPair(
		formData,
		show.margin,
		"pageMarginTop",
		"pageMarginBottom",
		furniture.headerText || furniture.batesPrefix !== undefined ? 36 : 0,
		furniture.footerText ? 36 : 0,
	);
	const yes = (shown: boolean, name: string, fallback: string) =>
		shownValue(formData, shown, name, fallback) === "1";
	return {
		layout: layoutOf(
			shownValue(formData, show.layout, "pageLayout", defaults.layout),
		),
		pageWidth: size?.width,
		pageHeight: size?.height,
		pageMarginLeft: points(
			formData,
			"pageMarginLeft",
			"pageMarginLeftUnit",
			show.margin,
		),
		pageMarginRight: points(
			formData,
			"pageMarginRight",
			"pageMarginRightUnit",
			show.margin,
		),
		pageMarginTop: vertical.top,
		pageMarginBottom: vertical.bottom,
		removeAnnotations: yes(
			show.annotation,
			"pageRemoveAnnotation",
			defaults.removeAnnotation,
		),
		flatten: yes(show.flatten, "pageFlatten", defaults.flatten),
		clearMetadata: yes(
			show.metadata,
			"pageRemoveMetadata",
			defaults.removeMetadata,
		),
		...furniture,
	};
}

export async function buildPdfBlobs(
	pages: readonly PDFPageDataType[],
	get: PageLookup,
	formData: FormData,
	config: PDFPagesToolConfig,
) {
	const { show, defaults } = config;
	const orientation = shownValue(
		formData,
		show.orientation,
		"pageOrientation",
		defaults.orientation,
	);
	const size = sheetSize(
		shownValue(formData, show.size, "pageSize", defaults.pageSize),
		orientation,
	);
	const specs = cropSpecs(
		orientSpecs(specsFromPages(pages, get), orientation, size),
		formData,
		show.crop,
	);
	const furniture = furnitureFromForm(formData, config);
	const options = optionsFromForm(formData, config, size, furniture);
	const batchSize = positiveCount(
		shownValue(formData, show.batch, "pageBatchSize", defaults.batchSize),
		specs.length,
	);
	const blobs: Blob[] = [];
	for (let index = 0; index < specs.length; index += batchSize) {
		const doc = await imposePDFPages(
			specs.slice(index, index + batchSize),
			options,
		);
		blobs.push(pdfBytesToBlob(await doc.save({ addDefaultPage: false })));
	}
	return blobs;
}

function localDate(value: string) {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
	if (!match) {
		return null;
	}
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const parsed = new Date(year, month - 1, day);
	if (
		parsed.getFullYear() !== year ||
		parsed.getMonth() !== month - 1 ||
		parsed.getDate() !== day
	) {
		return null;
	}
	return parsed;
}

export function readMetadataOptions(formData: FormData): ImposeOptions {
	const text = (name: string) => {
		const value = formData.get(name);
		return typeof value === "string" ? value : "";
	};
	const date = (name: string) => {
		const value = formData.get(name);
		if (typeof value !== "string" || value.trim() === "") {
			return null;
		}
		return localDate(value);
	};
	const keywords = text("metaKeywords")
		.split(/[,]+/)
		.map((item) => item.trim())
		.filter(Boolean);
	return {
		metaTitle: text("metaTitle"),
		metaSubject: text("metaSubject"),
		metaAuthor: text("metaAuthor"),
		metaCreator: text("metaCreator"),
		metaProducer: text("metaProducer"),
		metaKeywords: keywords,
		metaCreationDate: date("metaCreationDate"),
		metaModificationDate: date("metaModificationDate"),
	};
}
