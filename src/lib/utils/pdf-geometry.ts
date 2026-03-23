export type Box = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type CropInsets = {
	cropLeft: number;
	cropBottom: number;
	cropRight: number;
	cropTop: number;
};

export type QuarterTurn = 0 | 90 | 180 | 270;

export function normalizeQuarterTurn(angle: number): QuarterTurn {
	if (!Number.isFinite(angle)) {
		return 0;
	}
	const rounded = Math.round(angle / 90) * 90;
	const mod = ((rounded % 360) + 360) % 360;
	if (mod === 90 || mod === 180 || mod === 270) {
		return mod;
	}
	return 0;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

export function cropInsetsFromBoxes(media: Box, crop: Box): CropInsets {
	return {
		cropLeft: clamp(crop.x - media.x, 0, media.width),
		cropBottom: clamp(crop.y - media.y, 0, media.height),
		cropRight: clamp(
			media.x + media.width - (crop.x + crop.width),
			0,
			media.width,
		),
		cropTop: clamp(
			media.y + media.height - (crop.y + crop.height),
			0,
			media.height,
		),
	};
}

export function cropBoxFromInsets(media: Box, insets: CropInsets): Box {
	return {
		x: media.x + insets.cropLeft,
		y: media.y + insets.cropBottom,
		width: media.width - insets.cropLeft - insets.cropRight,
		height: media.height - insets.cropBottom - insets.cropTop,
	};
}

export function visualSize(width: number, height: number, rotation: number) {
	const turn = normalizeQuarterTurn(rotation);
	if (turn === 90 || turn === 270) {
		return { width: height, height: width };
	}
	return { width, height };
}

export function fitPageInSlot(
	mediaWidth: number,
	mediaHeight: number,
	rotation: number,
	slotWidth: number,
	slotHeight: number,
) {
	const turn = normalizeQuarterTurn(rotation);
	const visual = visualSize(mediaWidth, mediaHeight, turn);
	const scale =
		Math.min(slotWidth / visual.width, slotHeight / visual.height) || 1;
	const drawnWidth = mediaWidth * scale;
	const drawnHeight = mediaHeight * scale;
	const drawnVisual = visualSize(drawnWidth, drawnHeight, turn);
	return {
		rotation: turn,
		drawnWidth,
		drawnHeight,
		offsetX: (slotWidth - drawnVisual.width) / 2,
		offsetY: (slotHeight - drawnVisual.height) / 2,
	};
}

/**
 * pdf-lib rotates a drawn page around its bottom-left after scaling.
 * The returned point is that anchor so the rotated page fills the box
 * whose bottom-left is `origin` and whose size matches the rotated drawing.
 */
export function drawAnchor(
	originX: number,
	originY: number,
	drawnWidth: number,
	drawnHeight: number,
	rotation: number,
) {
	const turn = normalizeQuarterTurn(rotation);
	if (turn === 90) {
		return { x: originX + drawnHeight, y: originY };
	}
	if (turn === 180) {
		return { x: originX + drawnWidth, y: originY + drawnHeight };
	}
	if (turn === 270) {
		return { x: originX, y: originY + drawnWidth };
	}
	return { x: originX, y: originY };
}

export function withOrientation<
	T extends { width: number; height: number; rotation: number },
>(pages: readonly T[], orientation: "" | "portrait" | "landscape"): T[] {
	if (!orientation) {
		return [...pages];
	}
	return pages.map((page) => {
		const visual = visualSize(page.width, page.height, page.rotation);
		const isLandscape = visual.width > visual.height;
		const wantLandscape = orientation === "landscape";
		if (isLandscape === wantLandscape || visual.width === visual.height) {
			return page;
		}
		return {
			...page,
			rotation: normalizeQuarterTurn(page.rotation + 90),
		};
	});
}

export function padIndex(index: number, count: number) {
	const width = String(Math.max(count, 1)).length;
	return String(index).padStart(width, "0");
}

export function fillPageTemplate(
	template: string,
	pageNumber: number,
	pageCount: number,
) {
	return template
		.replaceAll("{n}", String(pageNumber))
		.replaceAll("{total}", String(pageCount));
}

export function readFiniteNumber(value: unknown) {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : undefined;
	}
	if (typeof value !== "string" || value.trim() === "") {
		return undefined;
	}
	const number = Number(value);
	return Number.isFinite(number) ? number : undefined;
}

export function toError(error: unknown) {
	if (error instanceof Error) {
		return error;
	}
	return new Error("Unknown error");
}
