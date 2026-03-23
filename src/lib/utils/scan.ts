import { normalizeQuarterTurn, type QuarterTurn } from "./pdf-geometry";
import { yieldToMain } from "./schedule";

export type Point = { x: number; y: number };
export type Quad = readonly [Point, Point, Point, Point];
export type CornerIndex = 0 | 1 | 2 | 3;
export type ScanFilter = "original" | "grayscale" | "lighter" | "bw";

export type Raster = {
	width: number;
	height: number;
	data: Uint8ClampedArray;
};

type Mat3 = readonly [
	readonly [number, number, number],
	readonly [number, number, number],
	readonly [number, number, number],
];

export const MAX_SCAN_PAGES = 30;
export const MAX_SCAN_IMAGE_BYTES = 25 * 1024 * 1024;
export const SCAN_SOURCE_LONG_EDGE = 2400;
export const SCAN_PREVIEW_LONG_EDGE = 720;
export const SCAN_EXPORT_LONG_EDGE = 2000;
export const SCAN_JPEG_QUALITY = 0.85;
export const SCAN_PREVIEW_JPEG_QUALITY = 0.82;
export const SCAN_PDF_LONG_EDGE = 841.89;
export const SCAN_ACCEPT =
	"image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

export const FULL_FRAME: Quad = [
	{ x: 0, y: 0 },
	{ x: 1, y: 0 },
	{ x: 1, y: 1 },
	{ x: 0, y: 1 },
];

export const SCAN_FILTERS: readonly { id: ScanFilter; label: string }[] = [
	{ id: "original", label: "Original" },
	{ id: "grayscale", label: "Grayscale" },
	{ id: "lighter", label: "Lighter paper" },
	{ id: "bw", label: "Black and white" },
];

const CORNER_LABELS = [
	"Top left corner",
	"Top right corner",
	"Bottom right corner",
	"Bottom left corner",
] as const;

const IMAGE_MIME = new Set([
	"image/jpeg",
	"image/jpg",
	"image/pjpeg",
	"image/png",
	"image/webp",
]);

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

export function cornerLabel(index: CornerIndex) {
	return CORNER_LABELS[index];
}

export function isScanFilter(value: string): value is ScanFilter {
	return SCAN_FILTERS.some((filter) => filter.id === value);
}

export function clampUnit(value: number) {
	if (!Number.isFinite(value) || value < 0) {
		return 0;
	}
	if (value > 1) {
		return 1;
	}
	return value;
}

export function copyQuad(quad: Quad): Quad {
	return [
		{ x: pointAt(quad, 0).x, y: pointAt(quad, 0).y },
		{ x: pointAt(quad, 1).x, y: pointAt(quad, 1).y },
		{ x: pointAt(quad, 2).x, y: pointAt(quad, 2).y },
		{ x: pointAt(quad, 3).x, y: pointAt(quad, 3).y },
	];
}

export function moveCorner(quad: Quad, index: CornerIndex, point: Point): Quad {
	const next = copyQuad(quad);
	const corners: [Point, Point, Point, Point] = [
		next[0],
		next[1],
		next[2],
		next[3],
	];
	corners[index] = { x: clampUnit(point.x), y: clampUnit(point.y) };
	return corners;
}

export function quadArea(quad: Quad) {
	let sum = 0;
	for (let index = 0; index < 4; index += 1) {
		const current = pointAt(quad, index as CornerIndex);
		const next = pointAt(quad, ((index + 1) % 4) as CornerIndex);
		sum += current.x * next.y - next.x * current.y;
	}
	return Math.abs(sum) / 2;
}

export function quadProblem(quad: Quad) {
	if (!quadIsFinite(quad)) {
		return "Move the corners onto the page.";
	}
	const [a, b, c, d] = quad;
	if (!a || !b || !c || !d) {
		return "Move the corners onto the page.";
	}
	if (segmentsCross(a, b, c, d) || segmentsCross(b, c, d, a)) {
		return "The outline crosses itself. Move a corner so the page is a simple shape.";
	}
	if (quadArea(quad) < 0.02) {
		return "The outline is too small. Spread the corners around the page.";
	}
	const edges = [
		distance(a, b),
		distance(b, c),
		distance(c, d),
		distance(d, a),
	];
	if (edges.some((edge) => edge < 0.02)) {
		return "An edge is too short. Spread those corners apart.";
	}
	const source = quadPixels(quad, 100, 100);
	const destination: Quad = [
		{ x: 0, y: 0 },
		{ x: 100, y: 0 },
		{ x: 100, y: 100 },
		{ x: 0, y: 100 },
	];
	if (!homographyFromQuads(destination, source)) {
		return "The outline could not be flattened. Spread the corners around the page.";
	}
	return null;
}

export function scanFileProblem(file: {
	name: string;
	type: string;
	size: number;
}) {
	const extension = fileExtension(file.name);
	const type = file.type.toLowerCase();
	if (
		extension === "svg" ||
		extension === "heic" ||
		extension === "heif" ||
		type === "image/svg+xml" ||
		type === "image/heic" ||
		type === "image/heif" ||
		type === "image/heic-sequence" ||
		type === "image/heif-sequence"
	) {
		return "Use a JPEG, PNG, or WebP image.";
	}
	if (file.size > MAX_SCAN_IMAGE_BYTES) {
		return "Each image can be up to 25 MB.";
	}
	if (file.size <= 0) {
		return "This photo could not be read.";
	}
	if (type.length > 0) {
		return IMAGE_MIME.has(type) ? null : "Use a JPEG, PNG, or WebP image.";
	}
	return IMAGE_EXT.has(extension) ? null : "Use a JPEG, PNG, or WebP image.";
}

export function cameraErrorMessage(error: unknown) {
	const name = errorName(error);
	if (name === "NotAllowedError") {
		return "Allow the camera to take a photo, or add an image instead.";
	}
	if (name === "NotFoundError") {
		return "No camera was found. Add an image instead.";
	}
	return "The camera is unavailable. Add an image instead.";
}

export async function requestRearCamera() {
	const devices = navigator.mediaDevices;
	const getUserMedia = devices?.getUserMedia;
	if (
		!globalThis.isSecureContext ||
		!devices ||
		typeof getUserMedia !== "function"
	) {
		throw new Error("The camera is unavailable. Add an image instead.");
	}
	try {
		return await getUserMedia.call(devices, {
			audio: false,
			video: { facingMode: { ideal: "environment" } },
		});
	} catch (error) {
		if (errorName(error) === "NotAllowedError") {
			throw error;
		}
		try {
			return await getUserMedia.call(devices, { audio: false, video: true });
		} catch (retryError) {
			if (errorName(error) === "NotFoundError") {
				throw error;
			}
			throw retryError;
		}
	}
}

export function scaledSize(width: number, height: number, maxEdge: number) {
	if (!(width > 0) || !(height > 0) || !(maxEdge >= 2)) {
		return null;
	}
	const longEdge = Math.max(width, height);
	const scale = Math.min(1, maxEdge / longEdge);
	const nextWidth = Math.round(width * scale);
	const nextHeight = Math.round(height * scale);
	if (nextWidth < 2 || nextHeight < 2) {
		return null;
	}
	return { width: nextWidth, height: nextHeight };
}

export function scanOutputSize(
	quad: Quad,
	sourceWidth: number,
	sourceHeight: number,
	maxEdge: number,
) {
	if (sourceWidth < 2 || sourceHeight < 2) {
		return null;
	}
	const pixels = quadPixels(quad, sourceWidth, sourceHeight);
	const top = distance(pointAt(pixels, 0), pointAt(pixels, 1));
	const right = distance(pointAt(pixels, 1), pointAt(pixels, 2));
	const bottom = distance(pointAt(pixels, 2), pointAt(pixels, 3));
	const left = distance(pointAt(pixels, 3), pointAt(pixels, 0));
	return scaledSize((top + bottom) / 2, (left + right) / 2, maxEdge);
}

export function scanPagePoints(width: number, height: number) {
	const longEdge = Math.max(width, height);
	if (!(longEdge > 0) || !Number.isFinite(width) || !Number.isFinite(height)) {
		return null;
	}
	const scale = SCAN_PDF_LONG_EDGE / longEdge;
	return { width: width * scale, height: height * scale };
}

/** Maps `from` coordinates onto `to`. Null when the four points do not solve. */
export function homographyFromQuads(from: Quad, to: Quad): Mat3 | null {
	const fromNorm = normalizeQuad(from);
	const toNorm = normalizeQuad(to);
	if (!fromNorm || !toNorm) {
		return null;
	}
	const rows = new Float64Array(8 * 9);
	for (let index = 0; index < 4; index += 1) {
		const source = fromNorm.points[index];
		const destination = toNorm.points[index];
		if (!source || !destination) {
			return null;
		}
		writeCorrespondence(rows, index * 2, source, destination);
	}
	const solved = solve8(rows);
	if (!solved) {
		return null;
	}
	const h0 = solved[0];
	const h1 = solved[1];
	const h2 = solved[2];
	const h3 = solved[3];
	const h4 = solved[4];
	const h5 = solved[5];
	const h6 = solved[6];
	const h7 = solved[7];
	if (
		h0 === undefined ||
		h1 === undefined ||
		h2 === undefined ||
		h3 === undefined ||
		h4 === undefined ||
		h5 === undefined ||
		h6 === undefined ||
		h7 === undefined
	) {
		return null;
	}
	const normalized: Mat3 = [
		[h0, h1, h2],
		[h3, h4, h5],
		[h6, h7, 1],
	];
	const toInverse = invert3(toNorm.matrix);
	if (!toInverse) {
		return null;
	}
	return multiply3(multiply3(toInverse, normalized), fromNorm.matrix);
}

export function applyHomography(matrix: Mat3, point: Point): Point | null {
	const weight =
		(matrix[2][0] ?? 0) * point.x +
		(matrix[2][1] ?? 0) * point.y +
		(matrix[2][2] ?? 0);
	if (!(Math.abs(weight) > 1e-12)) {
		return null;
	}
	const x =
		((matrix[0][0] ?? 0) * point.x +
			(matrix[0][1] ?? 0) * point.y +
			(matrix[0][2] ?? 0)) /
		weight;
	const y =
		((matrix[1][0] ?? 0) * point.x +
			(matrix[1][1] ?? 0) * point.y +
			(matrix[1][2] ?? 0)) /
		weight;
	if (!Number.isFinite(x) || !Number.isFinite(y)) {
		return null;
	}
	return { x, y };
}

export async function warpRaster(
	source: Raster,
	quad: Quad,
	maxEdge: number,
): Promise<Raster | null> {
	const size = scanOutputSize(quad, source.width, source.height, maxEdge);
	if (!size) {
		return null;
	}
	const homography = homographyFromQuads(
		[
			{ x: 0, y: 0 },
			{ x: size.width, y: 0 },
			{ x: size.width, y: size.height },
			{ x: 0, y: size.height },
		],
		quadPixels(quad, source.width, source.height),
	);
	if (!homography) {
		return null;
	}
	const data = new Uint8ClampedArray(size.width * size.height * 4);
	for (let y = 0; y < size.height; y += 1) {
		if (y > 0 && y % 32 === 0) {
			await yieldToMain();
		}
		for (let x = 0; x < size.width; x += 1) {
			const offset = (y * size.width + x) * 4;
			const mapped = applyHomography(homography, {
				x: x + 0.5,
				y: y + 0.5,
			});
			if (!mapped) {
				data[offset] = 255;
				data[offset + 1] = 255;
				data[offset + 2] = 255;
				data[offset + 3] = 255;
				continue;
			}
			sampleInto(source, mapped.x, mapped.y, data, offset);
		}
	}
	return { width: size.width, height: size.height, data };
}

export function applyFilter(raster: Raster, filter: ScanFilter): Raster {
	if (filter === "original") {
		return raster;
	}
	const luma = lumaPlane(raster);
	if (filter === "grayscale") {
		return grayRaster(raster, luma);
	}
	const stretched = stretchLuma(luma);
	if (filter === "lighter") {
		return grayRaster(raster, stretched);
	}
	const threshold = otsuThreshold(histogram(stretched));
	const ink = new Uint8Array(stretched.length);
	for (let index = 0; index < stretched.length; index += 1) {
		ink[index] = (stretched[index] ?? 0) > threshold ? 255 : 0;
	}
	return grayRaster(raster, ink);
}

export function otsuThreshold(histogram: ArrayLike<number>) {
	let total = 0;
	let sumAll = 0;
	for (let value = 0; value < 256; value += 1) {
		const count = histogram[value] ?? 0;
		total += count;
		sumAll += value * count;
	}
	if (total <= 0) {
		return 0;
	}
	let sumBackground = 0;
	let weightBackground = 0;
	let best = -1;
	let threshold = 0;
	for (let value = 0; value < 256; value += 1) {
		weightBackground += histogram[value] ?? 0;
		if (weightBackground === 0) {
			continue;
		}
		const weightForeground = total - weightBackground;
		if (weightForeground === 0) {
			break;
		}
		sumBackground += value * (histogram[value] ?? 0);
		const meanBackground = sumBackground / weightBackground;
		const meanForeground = (sumAll - sumBackground) / weightForeground;
		const variance =
			weightBackground *
			weightForeground *
			(meanBackground - meanForeground) ** 2;
		if (variance > best) {
			best = variance;
			threshold = value;
		}
	}
	return threshold;
}

export function rotateRaster(raster: Raster, turn: QuarterTurn): Raster {
	if (turn === 0) {
		return raster;
	}
	const { width, height, data } = raster;
	if (turn === 180) {
		const out = new Uint8ClampedArray(data.length);
		for (let y = 0; y < height; y += 1) {
			for (let x = 0; x < width; x += 1) {
				copyPixel(
					data,
					(y * width + x) * 4,
					out,
					((height - 1 - y) * width + (width - 1 - x)) * 4,
				);
			}
		}
		return { width, height, data: out };
	}
	const outWidth = height;
	const outHeight = width;
	const out = new Uint8ClampedArray(data.length);
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const nx = turn === 90 ? height - 1 - y : y;
			const ny = turn === 90 ? x : width - 1 - x;
			copyPixel(data, (y * width + x) * 4, out, (ny * outWidth + nx) * 4);
		}
	}
	return { width: outWidth, height: outHeight, data: out };
}

export function compositeOnWhite(raster: Raster): Raster {
	const data = new Uint8ClampedArray(raster.data.length);
	for (let index = 0; index < raster.data.length; index += 4) {
		const alpha = (raster.data[index + 3] ?? 255) / 255;
		const rest = 1 - alpha;
		data[index] = Math.round((raster.data[index] ?? 0) * alpha + 255 * rest);
		data[index + 1] = Math.round(
			(raster.data[index + 1] ?? 0) * alpha + 255 * rest,
		);
		data[index + 2] = Math.round(
			(raster.data[index + 2] ?? 0) * alpha + 255 * rest,
		);
		data[index + 3] = 255;
	}
	return { width: raster.width, height: raster.height, data };
}

export function nextQuarterTurn(rotation: number): QuarterTurn {
	return normalizeQuarterTurn(rotation + 90);
}

export function swapAdjacent<T>(
	items: readonly T[],
	index: number,
	delta: -1 | 1,
): readonly T[] {
	const nextIndex = index + delta;
	const current = items[index];
	const neighbor = items[nextIndex];
	if (current === undefined || neighbor === undefined) {
		return items;
	}
	const copy = items.slice();
	copy[index] = neighbor;
	copy[nextIndex] = current;
	return copy;
}

function pointAt(quad: Quad, index: CornerIndex): Point {
	return quad[index] ?? { x: 0, y: 0 };
}

function quadIsFinite(quad: Quad) {
	return quad.every(
		(point) => Number.isFinite(point.x) && Number.isFinite(point.y),
	);
}

function fileExtension(name: string) {
	const dot = name.lastIndexOf(".");
	if (dot < 0) {
		return "";
	}
	return name.slice(dot + 1).toLowerCase();
}

function errorName(error: unknown) {
	if (typeof error === "object" && error !== null && "name" in error) {
		const { name } = error;
		return typeof name === "string" ? name : "";
	}
	return "";
}

function distance(a: Point, b: Point) {
	return Math.hypot(b.x - a.x, b.y - a.y);
}

function segmentsCross(a: Point, b: Point, c: Point, d: Point) {
	const abC = orient(a, b, c);
	const abD = orient(a, b, d);
	const cdA = orient(c, d, a);
	const cdB = orient(c, d, b);
	return abC * abD < 0 && cdA * cdB < 0;
}

function orient(a: Point, b: Point, c: Point) {
	return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function quadPixels(quad: Quad, width: number, height: number): Quad {
	return [
		{ x: pointAt(quad, 0).x * width, y: pointAt(quad, 0).y * height },
		{ x: pointAt(quad, 1).x * width, y: pointAt(quad, 1).y * height },
		{ x: pointAt(quad, 2).x * width, y: pointAt(quad, 2).y * height },
		{ x: pointAt(quad, 3).x * width, y: pointAt(quad, 3).y * height },
	];
}

function normalizeQuad(quad: Quad) {
	let cx = 0;
	let cy = 0;
	for (const point of quad) {
		cx += point.x;
		cy += point.y;
	}
	cx /= 4;
	cy /= 4;
	let mean = 0;
	for (const point of quad) {
		mean += Math.hypot(point.x - cx, point.y - cy);
	}
	mean /= 4;
	if (!(mean > 1e-8)) {
		return null;
	}
	const scale = Math.SQRT2 / mean;
	const matrix: Mat3 = [
		[scale, 0, -scale * cx],
		[0, scale, -scale * cy],
		[0, 0, 1],
	];
	const points: Quad = [
		{
			x: (pointAt(quad, 0).x - cx) * scale,
			y: (pointAt(quad, 0).y - cy) * scale,
		},
		{
			x: (pointAt(quad, 1).x - cx) * scale,
			y: (pointAt(quad, 1).y - cy) * scale,
		},
		{
			x: (pointAt(quad, 2).x - cx) * scale,
			y: (pointAt(quad, 2).y - cy) * scale,
		},
		{
			x: (pointAt(quad, 3).x - cx) * scale,
			y: (pointAt(quad, 3).y - cy) * scale,
		},
	];
	return { matrix, points };
}

function writeCorrespondence(
	rows: Float64Array,
	row: number,
	source: Point,
	destination: Point,
) {
	const stride = 9;
	const first = row * stride;
	rows[first] = source.x;
	rows[first + 1] = source.y;
	rows[first + 2] = 1;
	rows[first + 6] = -destination.x * source.x;
	rows[first + 7] = -destination.x * source.y;
	rows[first + 8] = destination.x;
	const second = (row + 1) * stride;
	rows[second + 3] = source.x;
	rows[second + 4] = source.y;
	rows[second + 5] = 1;
	rows[second + 6] = -destination.y * source.x;
	rows[second + 7] = -destination.y * source.y;
	rows[second + 8] = destination.y;
}

const AUG_SIZE = 8;
const AUG_STRIDE = 9;

function augAt(matrix: Float64Array, row: number, col: number) {
	return matrix[row * AUG_STRIDE + col] ?? 0;
}

function augSet(matrix: Float64Array, row: number, col: number, value: number) {
	matrix[row * AUG_STRIDE + col] = value;
}

function choosePivot(matrix: Float64Array, col: number) {
	let pivot = col;
	let best = Math.abs(augAt(matrix, col, col));
	for (let row = col + 1; row < AUG_SIZE; row += 1) {
		const value = Math.abs(augAt(matrix, row, col));
		if (value > best) {
			best = value;
			pivot = row;
		}
	}
	if (!(best > 1e-10)) {
		return null;
	}
	return pivot;
}

function swapPivot(matrix: Float64Array, col: number, pivot: number) {
	if (pivot === col) {
		return;
	}
	for (let index = col; index <= AUG_SIZE; index += 1) {
		const swap = augAt(matrix, col, index);
		augSet(matrix, col, index, augAt(matrix, pivot, index));
		augSet(matrix, pivot, index, swap);
	}
}

function clearBelow(matrix: Float64Array, col: number) {
	const diagonal = augAt(matrix, col, col);
	for (let row = col + 1; row < AUG_SIZE; row += 1) {
		const factor = augAt(matrix, row, col) / diagonal;
		if (factor === 0) {
			continue;
		}
		for (let index = col; index <= AUG_SIZE; index += 1) {
			augSet(
				matrix,
				row,
				index,
				augAt(matrix, row, index) - factor * augAt(matrix, col, index),
			);
		}
	}
}

function backSubstitute(matrix: Float64Array) {
	const solution: number[] = [];
	for (let row = AUG_SIZE - 1; row >= 0; row -= 1) {
		let value = augAt(matrix, row, AUG_SIZE);
		for (let col = row + 1; col < AUG_SIZE; col += 1) {
			value -= augAt(matrix, row, col) * (solution[col] ?? 0);
		}
		const diagonal = augAt(matrix, row, row);
		if (!(Math.abs(diagonal) > 1e-10)) {
			return null;
		}
		solution[row] = value / diagonal;
	}
	return solution.every((value) => Number.isFinite(value)) ? solution : null;
}

function solve8(matrix: Float64Array) {
	for (let col = 0; col < AUG_SIZE; col += 1) {
		const pivot = choosePivot(matrix, col);
		if (pivot === null) {
			return null;
		}
		swapPivot(matrix, col, pivot);
		clearBelow(matrix, col);
	}
	return backSubstitute(matrix);
}

function multiply3(a: Mat3, b: Mat3): Mat3 {
	const cell = (row: number, col: number) =>
		(a[row]?.[0] ?? 0) * (b[0]?.[col] ?? 0) +
		(a[row]?.[1] ?? 0) * (b[1]?.[col] ?? 0) +
		(a[row]?.[2] ?? 0) * (b[2]?.[col] ?? 0);
	return [
		[cell(0, 0), cell(0, 1), cell(0, 2)],
		[cell(1, 0), cell(1, 1), cell(1, 2)],
		[cell(2, 0), cell(2, 1), cell(2, 2)],
	];
}

type Row3 = { x: number; y: number; z: number };

function matRow(matrix: Mat3, index: 0 | 1 | 2): Row3 | null {
	const row = matrix[index];
	if (!row) {
		return null;
	}
	const x = row[0];
	const y = row[1];
	const z = row[2];
	if (x === undefined || y === undefined || z === undefined) {
		return null;
	}
	return { x, y, z };
}

function invert3(matrix: Mat3): Mat3 | null {
	const a = matRow(matrix, 0);
	const b = matRow(matrix, 1);
	const c = matRow(matrix, 2);
	if (!a || !b || !c) {
		return null;
	}
	const c00 = b.y * c.z - b.z * c.y;
	const c01 = b.z * c.x - b.x * c.z;
	const c02 = b.x * c.y - b.y * c.x;
	const c10 = a.z * c.y - a.y * c.z;
	const c11 = a.x * c.z - a.z * c.x;
	const c12 = a.y * c.x - a.x * c.y;
	const c20 = a.y * b.z - a.z * b.y;
	const c21 = a.z * b.x - a.x * b.z;
	const c22 = a.x * b.y - a.y * b.x;
	const determinant = a.x * c00 + a.y * c01 + a.z * c02;
	if (!(Math.abs(determinant) > 1e-12)) {
		return null;
	}
	return [
		[c00 / determinant, c10 / determinant, c20 / determinant],
		[c01 / determinant, c11 / determinant, c21 / determinant],
		[c02 / determinant, c12 / determinant, c22 / determinant],
	];
}

function clamp(value: number, min: number, max: number) {
	if (value < min) {
		return min;
	}
	if (value > max) {
		return max;
	}
	return value;
}

function sampleInto(
	source: Raster,
	x: number,
	y: number,
	target: Uint8ClampedArray,
	offset: number,
) {
	const maxX = source.width - 1;
	const maxY = source.height - 1;
	const cx = clamp(x, 0, maxX);
	const cy = clamp(y, 0, maxY);
	const x0 = Math.floor(cx);
	const y0 = Math.floor(cy);
	const x1 = Math.min(x0 + 1, maxX);
	const y1 = Math.min(y0 + 1, maxY);
	const tx = cx - x0;
	const ty = cy - y0;
	const width = source.width;
	const i00 = (y0 * width + x0) * 4;
	const i10 = (y0 * width + x1) * 4;
	const i01 = (y1 * width + x0) * 4;
	const i11 = (y1 * width + x1) * 4;
	for (let channel = 0; channel < 4; channel += 1) {
		const v00 = source.data[i00 + channel] ?? 0;
		const v10 = source.data[i10 + channel] ?? 0;
		const v01 = source.data[i01 + channel] ?? 0;
		const v11 = source.data[i11 + channel] ?? 0;
		const top = v00 + (v10 - v00) * tx;
		const bottom = v01 + (v11 - v01) * tx;
		target[offset + channel] = Math.round(top + (bottom - top) * ty);
	}
}

function lumaOf(red: number, green: number, blue: number) {
	return Math.round(0.299 * red + 0.587 * green + 0.114 * blue);
}

function lumaPlane(raster: Raster) {
	const luma = new Uint8Array(raster.width * raster.height);
	for (let index = 0; index < luma.length; index += 1) {
		const offset = index * 4;
		luma[index] = lumaOf(
			raster.data[offset] ?? 0,
			raster.data[offset + 1] ?? 0,
			raster.data[offset + 2] ?? 0,
		);
	}
	return luma;
}

function histogram(values: Uint8Array) {
	const bins = new Uint32Array(256);
	for (const value of values) {
		bins[value] = (bins[value] ?? 0) + 1;
	}
	return bins;
}

function percentile(bins: Uint32Array, total: number, fraction: number) {
	if (total <= 0) {
		return 0;
	}
	const target = total * fraction;
	let seen = 0;
	for (let value = 0; value < 256; value += 1) {
		seen += bins[value] ?? 0;
		if (seen >= target) {
			return value;
		}
	}
	return 255;
}

function stretchLuma(luma: Uint8Array) {
	const bins = histogram(luma);
	const low = percentile(bins, luma.length, 0.02);
	const high = percentile(bins, luma.length, 0.98);
	const out = new Uint8Array(luma.length);
	const span = high - low;
	if (span <= 0) {
		out.set(luma);
		return out;
	}
	for (let index = 0; index < luma.length; index += 1) {
		const value = Math.round((((luma[index] ?? 0) - low) / span) * 255);
		if (value < 0) {
			out[index] = 0;
		} else if (value > 255) {
			out[index] = 255;
		} else {
			out[index] = value;
		}
	}
	return out;
}

function grayRaster(raster: Raster, luma: Uint8Array): Raster {
	const data = new Uint8ClampedArray(raster.data.length);
	for (let index = 0; index < luma.length; index += 1) {
		const offset = index * 4;
		const value = luma[index] ?? 0;
		data[offset] = value;
		data[offset + 1] = value;
		data[offset + 2] = value;
		data[offset + 3] = raster.data[offset + 3] ?? 255;
	}
	return { width: raster.width, height: raster.height, data };
}

function copyPixel(
	source: Uint8ClampedArray,
	from: number,
	target: Uint8ClampedArray,
	to: number,
) {
	target[to] = source[from] ?? 0;
	target[to + 1] = source[from + 1] ?? 0;
	target[to + 2] = source[from + 2] ?? 0;
	target[to + 3] = source[from + 3] ?? 0;
}
