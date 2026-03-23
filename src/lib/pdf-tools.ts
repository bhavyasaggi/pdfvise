export const PAGE_SIZE_OPTIONS = [
	{ value: "", label: "Original" },
	{ value: "A3", label: "A3" },
	{ value: "A4", label: "A4" },
	{ value: "A5", label: "A5" },
	{ value: "A6", label: "A6" },
	{ value: "B5", label: "B5" },
	{ value: "Executive", label: "Executive" },
	{ value: "Folio", label: "Folio" },
	{ value: "Legal", label: "Legal" },
	{ value: "Letter", label: "Letter" },
	{ value: "Tabloid", label: "Tabloid" },
];

export const PAGE_LAYOUT_OPTIONS = [
	{ value: "", label: "Original" },
	{ value: "4-zine", label: "Zine" },
	{ value: "4-n-up", label: "N-up" },
];

export const PAGE_ORIENTATION_OPTIONS = [
	{ value: "", label: "Original" },
	{ value: "0", label: "Portrait" },
	{ value: "1", label: "Landscape" },
];

export const MARGIN_UNIT_OPTIONS = [
	{ value: "72", label: "Inches" },
	{ value: "28.3464567", label: "Centimeters" },
	{ value: "2.83464567", label: "Millimeters" },
];

export const YES_NO_OPTIONS = [
	{ value: "", label: "No" },
	{ value: "1", label: "Yes" },
];

type ToolShow = {
	layout: boolean;
	size: boolean;
	orientation: boolean;
	batch: boolean;
	margin: boolean;
	flatten: boolean;
	annotation: boolean;
	metadata: boolean;
	crop: boolean;
	footer: boolean;
	header: boolean;
	bates: boolean;
	watermark: boolean;
};

export type ToolDefaults = {
	layout: "" | "4-zine" | "4-n-up";
	pageSize: string;
	orientation: "" | "0" | "1";
	batchSize: string;
	flatten: "" | "1";
	removeAnnotation: "" | "1";
	removeMetadata: "" | "1";
	footerText: string;
	headerText: string;
	batesPrefix: string;
	batesStart: string;
	watermarkText: string;
};

export type PDFPagesToolConfig = {
	downloadName: string;
	show: ToolShow;
	defaults: ToolDefaults;
};

const HIDDEN_SHOW: ToolShow = {
	layout: false,
	size: false,
	orientation: false,
	batch: false,
	margin: false,
	flatten: false,
	annotation: false,
	metadata: false,
	crop: false,
	footer: false,
	header: false,
	bates: false,
	watermark: false,
};

const EMPTY_DEFAULTS: ToolDefaults = {
	layout: "",
	pageSize: "",
	orientation: "",
	batchSize: "",
	flatten: "",
	removeAnnotation: "",
	removeMetadata: "",
	footerText: "",
	headerText: "",
	batesPrefix: "",
	batesStart: "",
	watermarkText: "",
};

function tool(
	downloadName: string,
	show: Partial<ToolShow>,
	defaults: Partial<ToolDefaults> = {},
): PDFPagesToolConfig {
	return {
		downloadName,
		show: { ...HIDDEN_SHOW, ...show },
		defaults: { ...EMPTY_DEFAULTS, ...defaults },
	};
}

export const PDF_PAGE_TOOLS = {
	merge: tool("merged", {
		layout: true,
		size: true,
		orientation: true,
		batch: true,
		margin: true,
		flatten: true,
		annotation: true,
		metadata: true,
	}),
	break: tool("pages", { batch: true }, { batchSize: "1" }),
	flatten: tool("flattened", { flatten: true }, { flatten: "1" }),
	margin: tool("margin", { margin: true }),
	"n-up": tool(
		"n-up",
		{ layout: true, size: true, orientation: true, margin: true },
		{ layout: "4-n-up", pageSize: "A4" },
	),
	zine: tool(
		"zine",
		{ layout: true, size: true, orientation: true, margin: true },
		{ layout: "4-zine", pageSize: "A4" },
	),
	resize: tool("resized", { size: true, orientation: true }),
	"remove-metadata": tool(
		"cleaned",
		{ metadata: true },
		{ removeMetadata: "1" },
	),
	"remove-annotation": tool(
		"cleaned",
		{ annotation: true },
		{ removeAnnotation: "1" },
	),
	combine: tool("combined", {
		layout: true,
		size: true,
		margin: true,
		crop: true,
	}),
	extract: tool("extracted", { batch: true }, { batchSize: "1" }),
	remove: tool("pages", {}),
	"rotate-pages": tool("rotated", {}),
	crop: tool("cropped", { crop: true }),
	"page-number": tool(
		"numbered",
		{ footer: true },
		{ footerText: "{n} / {total}" },
	),
	bates: tool(
		"bates",
		{ bates: true },
		{ batesPrefix: "BATES ", batesStart: "1" },
	),
	letterhead: tool("letterhead", { header: true }),
	watermark: tool("watermark", { watermark: true }),
} as const;

export type PDFPagesTool = keyof typeof PDF_PAGE_TOOLS;

export type PDFMetaTool = "metadata" | "rotate" | "reverse" | "reorder";
