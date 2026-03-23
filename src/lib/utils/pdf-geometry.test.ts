import assert from "node:assert/strict";
import test from "node:test";

import {
	cropBoxFromInsets,
	cropInsetsFromBoxes,
	drawAnchor,
	fitPageInSlot,
	normalizeQuarterTurn,
	padIndex,
	visualSize,
	withOrientation,
} from "./pdf-geometry.ts";

test("full-page crop insets round-trip to the media box", () => {
	const media = { x: 0, y: 0, width: 612, height: 792 };
	const insets = cropInsetsFromBoxes(media, media);
	assert.deepEqual(insets, {
		cropLeft: 0,
		cropBottom: 0,
		cropRight: 0,
		cropTop: 0,
	});
	assert.deepEqual(cropBoxFromInsets(media, insets), media);
});

test("partial crop insets describe the clipped edges", () => {
	const media = { x: 10, y: 20, width: 200, height: 400 };
	const crop = { x: 30, y: 50, width: 150, height: 300 };
	const insets = cropInsetsFromBoxes(media, crop);
	assert.deepEqual(insets, {
		cropLeft: 20,
		cropBottom: 30,
		cropRight: 30,
		cropTop: 70,
	});
	assert.deepEqual(cropBoxFromInsets(media, insets), crop);
});

test("quarter turns wrap to 0, 90, 180, or 270", () => {
	assert.equal(normalizeQuarterTurn(0), 0);
	assert.equal(normalizeQuarterTurn(90), 90);
	assert.equal(normalizeQuarterTurn(360), 0);
	assert.equal(normalizeQuarterTurn(-90), 270);
	assert.equal(normalizeQuarterTurn(44), 0);
	assert.equal(normalizeQuarterTurn(46), 90);
});

test("draw anchors keep a rotated page inside its slot", () => {
	assert.deepEqual(drawAnchor(10, 20, 50, 40, 0), { x: 10, y: 20 });
	assert.deepEqual(drawAnchor(10, 20, 50, 40, 180), { x: 60, y: 60 });
	assert.deepEqual(drawAnchor(10, 20, 50, 40, 90), { x: 50, y: 20 });
	assert.deepEqual(drawAnchor(10, 20, 50, 40, 270), { x: 10, y: 70 });
});

test("a rotated page fits inside the slot without stretching", () => {
	const fit = fitPageInSlot(200, 100, 90, 100, 100);
	assert.equal(fit.rotation, 90);
	assert.equal(fit.drawnWidth, 100);
	assert.equal(fit.drawnHeight, 50);
	assert.equal(fit.offsetX, 25);
	assert.equal(fit.offsetY, 0);
	const visual = visualSize(fit.drawnWidth, fit.drawnHeight, fit.rotation);
	assert.equal(visual.width, 50);
	assert.equal(visual.height, 100);
});

test("orientation turns portrait pages sideways only when asked", () => {
	const pages = [{ width: 200, height: 400, rotation: 0, id: "a" }];
	assert.equal(withOrientation(pages, "landscape")[0]?.rotation, 90);
	assert.equal(withOrientation(pages, "portrait")[0]?.rotation, 0);
	assert.equal(withOrientation(pages, "")[0]?.rotation, 0);
});

test("page numbers pad to the width of the page count", () => {
	assert.equal(padIndex(1, 100), "001");
	assert.equal(padIndex(12, 100), "012");
	assert.equal(padIndex(3, 8), "3");
});
