import assert from "node:assert/strict";
import test from "node:test";

import { PDFDocument } from "pdf-lib";
import type { Quad, Raster } from "./scan.ts";
import {
	applyFilter,
	applyHomography,
	cameraErrorMessage,
	compositeOnWhite,
	copyQuad,
	FULL_FRAME,
	homographyFromQuads,
	moveCorner,
	nextQuarterTurn,
	otsuThreshold,
	quadArea,
	quadProblem,
	rotateRaster,
	SCAN_PDF_LONG_EDGE,
	scanFileProblem,
	scanOutputSize,
	scanPagePoints,
	swapAdjacent,
	warpRaster,
} from "./scan.ts";
import { buildScanPdf } from "./scan-pdf.ts";

const RED_JPEG = Uint8Array.from(
	Buffer.from(
		"/9j/4AAQSkZJRgABAgAAAQABAAD//gAQTGF2YzYwLjMxLjEwMgD/2wBDAAgGBgcGBwgICAgICAkJCQoKCgkJCQkKCgoKCgoMDAwKCgoKCgoKDAwMDA0ODQ0NDA0ODg8PDxISEREVFRUZGR//xABMAAEBAAAAAAAAAAAAAAAAAAAABgEBAQAAAAAAAAAAAAAAAAAABgcQAQAAAAAAAAAAAAAAAAAAAAARAQAAAAAAAAAAAAAAAAAAAAD/wAARCAAEAAgDASIAAhEAAxEA/9oADAMBAAIRAxEAPwCLAFF/f//Z",
		"base64",
	),
);

function solid(
	width: number,
	height: number,
	channels: readonly [number, number, number, number],
): Raster {
	const data = new Uint8ClampedArray(width * height * 4);
	for (let index = 0; index < data.length; index += 4) {
		data[index] = channels[0];
		data[index + 1] = channels[1];
		data[index + 2] = channels[2];
		data[index + 3] = channels[3];
	}
	return { width, height, data };
}

function pixel(raster: Raster, x: number, y: number) {
	const offset = (y * raster.width + x) * 4;
	return [
		raster.data[offset],
		raster.data[offset + 1],
		raster.data[offset + 2],
		raster.data[offset + 3],
	];
}

function close(actual: number, expected: number) {
	assert.ok(
		Math.abs(actual - expected) < 1e-4,
		`${actual} should be near ${expected}`,
	);
}

test("full frame has area 1 and can be flattened", () => {
	assert.equal(quadArea(FULL_FRAME), 1);
	assert.equal(quadProblem(FULL_FRAME), null);
});

test("a crossed outline is rejected and a short edge is rejected", () => {
	const bowtie: Quad = [
		{ x: 0, y: 0 },
		{ x: 1, y: 1 },
		{ x: 0, y: 1 },
		{ x: 1, y: 0 },
	];
	assert.match(quadProblem(bowtie) ?? "", /crosses itself/);
	const shortEdge: Quad = [
		{ x: 0, y: 0 },
		{ x: 1, y: 0 },
		{ x: 1, y: 0.01 },
		{ x: 0, y: 0.5 },
	];
	assert.match(quadProblem(shortEdge) ?? "", /too short/);
	const tiny: Quad = [
		{ x: 0, y: 0 },
		{ x: 0.01, y: 0 },
		{ x: 0.01, y: 0.01 },
		{ x: 0, y: 0.01 },
	];
	assert.match(quadProblem(tiny) ?? "", /too small/);
});

test("homography maps destination corners onto source corners", () => {
	const destination: Quad = [
		{ x: 0, y: 0 },
		{ x: 200, y: 0 },
		{ x: 200, y: 300 },
		{ x: 0, y: 300 },
	];
	const source: Quad = [
		{ x: 10, y: 20 },
		{ x: 180, y: 15 },
		{ x: 170, y: 250 },
		{ x: 20, y: 240 },
	];
	const matrix = homographyFromQuads(destination, source);
	assert.ok(matrix);
	for (let index = 0; index < 4; index += 1) {
		const from = destination[index];
		const to = source[index];
		assert.ok(from && to);
		const mapped = applyHomography(matrix, from);
		assert.ok(mapped);
		close(mapped.x, to.x);
		close(mapped.y, to.y);
	}
	const identity = homographyFromQuads(destination, destination);
	assert.ok(identity);
	const center = applyHomography(identity, { x: 100, y: 150 });
	assert.ok(center);
	close(center.x, 100);
	close(center.y, 150);
});

test("a solid warp stays solid and the long edge is capped", async () => {
	const warped = await warpRaster(
		solid(8, 6, [10, 20, 30, 255]),
		FULL_FRAME,
		2000,
	);
	assert.ok(warped);
	assert.deepEqual([warped.width, warped.height], [8, 6]);
	assert.deepEqual(pixel(warped, 0, 0), [10, 20, 30, 255]);
	assert.deepEqual(pixel(warped, 7, 5), [10, 20, 30, 255]);

	const capped = scanOutputSize(FULL_FRAME, 4000, 2000, 2000);
	assert.deepEqual(capped, { width: 2000, height: 1000 });
});

test("a full-frame warp keeps the two halves of the picture", async () => {
	const source = solid(8, 4, [0, 0, 255, 255]);
	for (let y = 0; y < 4; y += 1) {
		for (let x = 0; x < 4; x += 1) {
			const offset = (y * 8 + x) * 4;
			source.data[offset] = 255;
			source.data[offset + 2] = 0;
		}
	}
	const warped = await warpRaster(source, FULL_FRAME, 2000);
	assert.ok(warped);
	assert.deepEqual(pixel(warped, 0, 1), [255, 0, 0, 255]);
	assert.deepEqual(pixel(warped, 7, 1), [0, 0, 255, 255]);
});

test("filters grayscale, stretch paper, and threshold ink", () => {
	const raster = solid(2, 1, [255, 0, 0, 255]);
	assert.equal(applyFilter(raster, "original"), raster);
	assert.deepEqual(
		pixel(applyFilter(raster, "grayscale"), 0, 0),
		[76, 76, 76, 255],
	);

	const paper = solid(2, 1, [40, 40, 40, 255]);
	paper.data[4] = 80;
	paper.data[5] = 80;
	paper.data[6] = 80;
	const lighter = applyFilter(paper, "lighter");
	assert.deepEqual(pixel(lighter, 0, 0), [0, 0, 0, 255]);
	assert.deepEqual(pixel(lighter, 1, 0), [255, 255, 255, 255]);

	const histogram = new Array<number>(256).fill(0);
	histogram[20] = 50;
	histogram[200] = 50;
	const threshold = otsuThreshold(histogram);
	assert.ok(threshold >= 20 && threshold < 200);

	const split = solid(2, 1, [0, 0, 0, 255]);
	split.data[4] = 255;
	split.data[5] = 255;
	split.data[6] = 255;
	const bw = applyFilter(split, "bw");
	assert.deepEqual(pixel(bw, 0, 0), [0, 0, 0, 255]);
	assert.deepEqual(pixel(bw, 1, 0), [255, 255, 255, 255]);
});

test("rotation moves the top-left pixel clockwise", () => {
	const raster = solid(2, 2, [0, 0, 255, 255]);
	raster.data[0] = 255;
	raster.data[2] = 0;
	assert.equal(rotateRaster(raster, 0), raster);
	const turned = rotateRaster(raster, 90);
	assert.deepEqual([turned.width, turned.height], [2, 2]);
	assert.deepEqual(pixel(turned, 1, 0), [255, 0, 0, 255]);
	assert.equal(nextQuarterTurn(270), 0);
});

test("transparent pixels composite onto white", () => {
	const raster = solid(1, 1, [0, 0, 0, 0]);
	assert.deepEqual(pixel(compositeOnWhite(raster), 0, 0), [255, 255, 255, 255]);
});

test("corner moves clamp and do not change the full frame", () => {
	const moved = moveCorner(FULL_FRAME, 2, { x: 2, y: -1 });
	assert.deepEqual(moved[2], { x: 1, y: 0 });
	assert.deepEqual(copyQuad(FULL_FRAME)[0], { x: 0, y: 0 });
	assert.deepEqual(FULL_FRAME[2], { x: 1, y: 1 });
});

test("page moves swap neighbors and ignore an edge step", () => {
	const items = ["a", "b", "c"];
	assert.deepEqual(swapAdjacent(items, 1, -1), ["b", "a", "c"]);
	assert.equal(swapAdjacent(items, 0, -1), items);
	assert.equal(swapAdjacent(items, 2, 1), items);
});

test("scan files accept jpeg, png, and webp only", () => {
	assert.equal(
		scanFileProblem({ name: "a.jpg", type: "image/jpeg", size: 10 }),
		null,
	);
	assert.equal(
		scanFileProblem({ name: "a.jpg", type: "image/jpg", size: 10 }),
		null,
	);
	assert.equal(
		scanFileProblem({ name: "a.png", type: "image/pjpeg", size: 10 }),
		null,
	);
	assert.equal(scanFileProblem({ name: "a.png", type: "", size: 10 }), null);
	assert.match(
		scanFileProblem({ name: "a.svg", type: "image/svg+xml", size: 10 }) ?? "",
		/JPEG, PNG, or WebP/,
	);
	assert.match(
		scanFileProblem({ name: "a.heic", type: "", size: 10 }) ?? "",
		/JPEG, PNG, or WebP/,
	);
	assert.match(
		scanFileProblem({ name: "a.gif", type: "image/gif", size: 10 }) ?? "",
		/JPEG, PNG, or WebP/,
	);
	assert.match(
		scanFileProblem({ name: "a.jpg", type: "image/jpeg", size: 0 }) ?? "",
		/could not be read/,
	);
	assert.match(
		scanFileProblem({
			name: "a.jpg",
			type: "image/jpeg",
			size: 25 * 1024 * 1024 + 1,
		}) ?? "",
		/25 MB/,
	);
});

test("camera errors keep an upload path in the message", () => {
	assert.match(
		cameraErrorMessage({ name: "NotAllowedError" }),
		/Allow the camera/,
	);
	assert.match(
		cameraErrorMessage({ name: "NotFoundError" }),
		/No camera was found/,
	);
	assert.match(cameraErrorMessage(new Error("nope")), /unavailable/);
});

test("picture pages use the long side of A4 and stay in proportion", () => {
	const landscape = scanPagePoints(2000, 1000);
	assert.ok(landscape);
	close(landscape.width, SCAN_PDF_LONG_EDGE);
	close(landscape.height, SCAN_PDF_LONG_EDGE / 2);
	const portrait = scanPagePoints(1000, 2000);
	assert.ok(portrait);
	assert.ok(portrait.height > portrait.width);
});

test("a scan pdf embeds one jpeg page per picture", async () => {
	await assert.rejects(() => buildScanPdf([]), /Add a page before saving/);
	const bytes = await buildScanPdf([RED_JPEG, RED_JPEG]);
	assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
	const doc = await PDFDocument.load(bytes, { updateMetadata: false });
	assert.equal(doc.getPageCount(), 2);
	assert.equal(doc.getTitle(), "Scan");
	assert.equal(doc.getCreator(), "PDFvise");
	assert.equal(doc.getProducer(), "PDFvise");
	const page = doc.getPage(0);
	assert.ok(page.getWidth() > page.getHeight());
	close(page.getWidth(), SCAN_PDF_LONG_EDGE);
});
