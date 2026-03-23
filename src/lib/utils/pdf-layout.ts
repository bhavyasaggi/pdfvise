import { degrees, type Rotation } from "pdf-lib";

export type LayoutSlot = {
	pageNumber: number;
	x: number;
	y: number;
	width: number;
	height: number;
	rotate?: Rotation;
};

type SlotSeed = {
	xFactor: number;
	yFactor: number;
	rotate?: Rotation;
};

/**
 * Slots are bottom-left corners in an upright sheet.
 * A 180 degree seed is rotated around the drawn page's bottom-left by the
 * impose step, which parks it in the quadrant described here.
 *
 * Zine:
 * [Page 1 inverted] [Page 4 inverted]
 * [Page 2         ] [Page 3         ]
 *
 * N-up:
 * [Page 1] [Page 2]
 * [Page 3] [Page 4]
 */
const ZINE_SEEDS: readonly SlotSeed[] = [
	{ xFactor: 0, yFactor: 1, rotate: degrees(180) },
	{ xFactor: 0, yFactor: 0 },
	{ xFactor: 1, yFactor: 0 },
	{ xFactor: 1, yFactor: 1, rotate: degrees(180) },
];

const NUP_SEEDS: readonly SlotSeed[] = [
	{ xFactor: 0, yFactor: 1 },
	{ xFactor: 1, yFactor: 1 },
	{ xFactor: 0, yFactor: 0 },
	{ xFactor: 1, yFactor: 0 },
];

function* tiledLayout(
	pageWidth: number,
	pageHeight: number,
	seeds: readonly SlotSeed[],
): Generator<LayoutSlot> {
	const slotWidth = pageWidth / 2;
	const slotHeight = pageHeight / 2;
	let sectionCount = 0;
	while (true) {
		const seed = seeds[sectionCount % seeds.length];
		const pageNumber = Math.floor(sectionCount / seeds.length) + 1;
		sectionCount += 1;
		if (!seed) {
			throw new Error("Layout seed is missing.");
		}
		yield {
			pageNumber,
			x: seed.xFactor * slotWidth,
			y: seed.yFactor * slotHeight,
			width: slotWidth,
			height: slotHeight,
			...(seed.rotate ? { rotate: seed.rotate } : {}),
		};
	}
}

export function zinePDFLayout(pageWidth: number, pageHeight: number) {
	return tiledLayout(pageWidth, pageHeight, ZINE_SEEDS);
}

export function nupPDFLayout(pageWidth: number, pageHeight: number) {
	return tiledLayout(pageWidth, pageHeight, NUP_SEEDS);
}

export function* standardPDFLayout(): Generator<LayoutSlot> {
	let pageNumber = 0;
	while (true) {
		pageNumber += 1;
		yield {
			pageNumber,
			x: 0,
			y: 0,
			width: 0,
			height: 0,
		};
	}
}

export default function PDFLayoutFactory(options: {
	layout?: "4-zine" | "4-n-up" | "1-n-up" | string;
	pageWidth?: number;
	pageHeight?: number;
}): Generator<LayoutSlot> {
	if (options.layout === "4-zine" || options.layout === "4-n-up") {
		if (!options.pageWidth || !options.pageHeight) {
			throw new Error("Page dimensions are required for this layout.");
		}
		return options.layout === "4-zine"
			? zinePDFLayout(options.pageWidth, options.pageHeight)
			: nupPDFLayout(options.pageWidth, options.pageHeight);
	}
	return standardPDFLayout();
}
