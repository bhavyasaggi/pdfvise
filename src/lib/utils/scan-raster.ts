import type { QuarterTurn } from "./pdf-geometry";
import {
	applyFilter,
	compositeOnWhite,
	type Quad,
	type Raster,
	rotateRaster,
	SCAN_EXPORT_LONG_EDGE,
	SCAN_JPEG_QUALITY,
	SCAN_PREVIEW_JPEG_QUALITY,
	SCAN_PREVIEW_LONG_EDGE,
	SCAN_SOURCE_LONG_EDGE,
	type ScanFilter,
	scaledSize,
	warpRaster,
} from "./scan";

const READ_ERROR = "This photo could not be read.";

export async function measureImage(url: string) {
	const image = new Image();
	image.src = url;
	try {
		await image.decode();
	} catch {
		throw new Error(READ_ERROR);
	}
	if (image.naturalWidth < 2 || image.naturalHeight < 2) {
		throw new Error(READ_ERROR);
	}
	return { width: image.naturalWidth, height: image.naturalHeight };
}

export async function rasterFromBlob(blob: Blob): Promise<Raster> {
	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
	} catch {
		throw new Error(READ_ERROR);
	}
	try {
		if (bitmap.width < 2 || bitmap.height < 2) {
			throw new Error(READ_ERROR);
		}
		const size = scaledSize(bitmap.width, bitmap.height, SCAN_SOURCE_LONG_EDGE);
		if (!size) {
			throw new Error(READ_ERROR);
		}
		const canvas = document.createElement("canvas");
		canvas.width = size.width;
		canvas.height = size.height;
		const context = canvas.getContext("2d", { willReadFrequently: true });
		if (!context) {
			throw new Error(READ_ERROR);
		}
		context.fillStyle = "#ffffff";
		context.fillRect(0, 0, size.width, size.height);
		context.imageSmoothingEnabled = true;
		context.imageSmoothingQuality = "high";
		context.drawImage(bitmap, 0, 0, size.width, size.height);
		const image = context.getImageData(0, 0, size.width, size.height);
		return { width: size.width, height: size.height, data: image.data };
	} finally {
		bitmap.close();
	}
}

export async function rasterToJpeg(raster: Raster, quality: number) {
	const opaque = compositeOnWhite(raster);
	const canvas = document.createElement("canvas");
	canvas.width = opaque.width;
	canvas.height = opaque.height;
	const context = canvas.getContext("2d");
	if (!context) {
		throw new Error(READ_ERROR);
	}
	context.fillStyle = "#ffffff";
	context.fillRect(0, 0, opaque.width, opaque.height);
	const image = context.createImageData(opaque.width, opaque.height);
	image.data.set(opaque.data);
	context.putImageData(image, 0, 0);
	const blob = await new Promise<Blob | null>((resolve) => {
		canvas.toBlob(
			(next) => {
				resolve(next);
			},
			"image/jpeg",
			quality,
		);
	});
	if (!blob) {
		throw new Error(READ_ERROR);
	}
	return blob;
}

async function renderScanJpeg(
	file: Blob,
	corners: Quad,
	filter: ScanFilter,
	rotation: QuarterTurn,
	maxEdge: number,
	quality: number,
	rotate: boolean,
) {
	const source = await rasterFromBlob(file);
	const warped = await warpRaster(source, corners, maxEdge);
	if (!warped) {
		throw new Error("The outline could not be flattened.");
	}
	const filtered = applyFilter(warped, filter);
	const raster = rotate ? rotateRaster(filtered, rotation) : filtered;
	return rasterToJpeg(raster, quality);
}

export function renderScanPreview(
	file: Blob,
	corners: Quad,
	filter: ScanFilter,
) {
	return renderScanJpeg(
		file,
		corners,
		filter,
		0,
		SCAN_PREVIEW_LONG_EDGE,
		SCAN_PREVIEW_JPEG_QUALITY,
		false,
	);
}

export async function renderScanExport(
	file: Blob,
	corners: Quad,
	filter: ScanFilter,
	rotation: QuarterTurn,
) {
	const blob = await renderScanJpeg(
		file,
		corners,
		filter,
		rotation,
		SCAN_EXPORT_LONG_EDGE,
		SCAN_JPEG_QUALITY,
		true,
	);
	return new Uint8Array(await blob.arrayBuffer());
}
