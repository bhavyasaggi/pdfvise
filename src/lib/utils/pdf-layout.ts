import { degrees, type Rotation } from "pdf-lib";

type LayoutOptionsType = {
	pageNumber: number;
	x: number;
	y: number;
	height: number;
	width: number;
	rotate?: Rotation;
};

// TODO: Adjust x, y, width, height based on rotation (along bottom-left corner)
export function* zinePDFLayout(
	pageWidth: number,
	pageHeight: number,
): Generator<LayoutOptionsType, void, unknown> {
	/*
	 * [Page 1 INV] [Page 4 INV]
	 * [Page 2    ] [Page 3    ]
	 */
	let sectionCount = -1;
	while (true) {
		sectionCount += 1;
		const sectionPage = Math.floor(sectionCount / 4);
		const sectionMod = sectionCount % 4;
		switch (sectionMod) {
			case 0:
				yield {
					pageNumber: sectionPage + 1,
					x: pageWidth / 2,
					y: pageHeight,
					width: pageWidth / 2,
					height: pageHeight / 2,
					rotate: degrees(180),
				};
				break;
			case 1:
				yield {
					pageNumber: sectionPage + 1,
					x: 0,
					y: 0,
					width: pageWidth / 2,
					height: pageHeight / 2,
				};
				break;
			case 2:
				yield {
					pageNumber: sectionPage + 1,
					x: pageWidth / 2,
					y: 0,
					width: pageWidth / 2,
					height: pageHeight / 2,
				};
				break;
			case 3:
				yield {
					pageNumber: sectionPage + 1,
					x: pageWidth,
					y: pageHeight,
					width: pageWidth / 2,
					height: pageHeight / 2,
					rotate: degrees(180),
				};
				break;
			default:
				throw new Error("Not implemented");
		}
	}
}

// TODO: Adjust x, y, width, height based on rotation (along bottom-left corner)
export function* nupPDFLayout(
	pageWidth: number,
	pageHeight: number,
): Generator<LayoutOptionsType> {
	/*
	 * [Page 1] [Page 2]
	 * [Page 3] [Page 4]
	 */
	let sectionCount = -1;
	while (true) {
		sectionCount += 1;
		const sectionPage = Math.floor(sectionCount / 4);
		const sectionMod = sectionCount % 4;
		switch (sectionMod) {
			case 0:
				yield {
					pageNumber: sectionPage + 1,
					x: 0,
					y: pageHeight / 2,
					width: pageWidth / 2,
					height: pageHeight / 2,
				};
				break;
			case 1:
				yield {
					pageNumber: sectionPage + 1,
					x: pageWidth / 2,
					y: pageHeight / 2,
					width: pageWidth / 2,
					height: pageHeight / 2,
				};
				break;
			case 2:
				yield {
					pageNumber: sectionPage + 1,
					x: 0,
					y: 0,
					width: pageWidth / 2,
					height: pageHeight / 2,
				};
				break;
			case 3:
				yield {
					pageNumber: sectionPage + 1,
					x: pageWidth / 2,
					y: 0,
					width: pageWidth / 2,
					height: pageHeight / 2,
				};
				break;
			default:
				throw new Error("Not implemented");
		}
	}
}

export function* standardPDFLayout(): Generator<
	LayoutOptionsType,
	void,
	unknown
> {
	let sectionCount = -1;
	while (true) {
		sectionCount += 1;
		yield {
			pageNumber: sectionCount + 1,
			x: 0,
			y: 0,
			width: 0,
			height: 0,
		};
	}
}

export default function PDFLayoutFactory(options: {
	layout?: "4-zine" | "4-n-up" | string;
	pageWidth?: number;
	pageHeight?: number;
}): Generator<LayoutOptionsType, void, unknown> {
	switch (options?.layout) {
		case "4-zine":
			if (!options.pageHeight || !options.pageWidth) {
				throw new Error("Page dimensions are required for 4-zine layout");
			}
			return zinePDFLayout(options.pageWidth, options.pageHeight);
		case "4-n-up":
			if (!options.pageHeight || !options.pageWidth) {
				throw new Error("Page dimensions are required for 4-n-up layout");
			}
			return nupPDFLayout(options.pageWidth, options.pageHeight);
		default:
			return standardPDFLayout();
	}
}
