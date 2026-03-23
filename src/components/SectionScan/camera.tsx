import { useEffect, useRef, useState } from "react";

import { toError } from "@/lib/utils/pdf-geometry";
import { SCAN_SOURCE_LONG_EDGE, scaledSize } from "@/lib/utils/scan";

import styles from "./styles.module.scss";

async function takePhoto(video: HTMLVideoElement) {
	const size = scaledSize(
		video.videoWidth,
		video.videoHeight,
		SCAN_SOURCE_LONG_EDGE,
	);
	if (!size) {
		throw new Error("This photo could not be read.");
	}
	const canvas = document.createElement("canvas");
	canvas.width = size.width;
	canvas.height = size.height;
	const context = canvas.getContext("2d");
	if (!context) {
		throw new Error("This photo could not be read.");
	}
	context.fillStyle = "#ffffff";
	context.fillRect(0, 0, size.width, size.height);
	context.drawImage(video, 0, 0, size.width, size.height);
	const blob = await new Promise<Blob | null>((resolve) => {
		canvas.toBlob(
			(next) => {
				resolve(next);
			},
			"image/jpeg",
			0.92,
		);
	});
	if (!blob) {
		throw new Error("This photo could not be read.");
	}
	return new File([blob], "scan-photo.jpg", { type: "image/jpeg" });
}

export default function ScanCamera(props: {
	stream: MediaStream;
	onCapture: (file: File) => void;
	onError: (message: string) => void;
	onClose: () => void;
}) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const shutterRef = useRef<HTMLButtonElement>(null);
	const [ready, setReady] = useState(false);
	const [shot, setShot] = useState(false);

	useEffect(() => {
		const video = videoRef.current;
		if (!video) {
			return;
		}
		video.srcObject = props.stream;
		const mark = () => {
			if (video.videoWidth > 0) {
				setReady(true);
			}
		};
		video.addEventListener("canplay", mark);
		video.addEventListener("loadeddata", mark);
		void video.play().catch(() => undefined);
		return () => {
			video.removeEventListener("canplay", mark);
			video.removeEventListener("loadeddata", mark);
			video.srcObject = null;
		};
	}, [props.stream]);

	useEffect(() => {
		if (ready) {
			shutterRef.current?.focus();
		}
	}, [ready]);

	return (
		<div>
			<video
				ref={videoRef}
				className={styles.viewfinder}
				playsInline
				muted
				autoPlay
				aria-label="Camera preview"
			>
				<track kind="captions" srcLang="en" label="Live camera" />
			</video>
			<div className={styles.toolbar}>
				<button
					ref={shutterRef}
					type="button"
					disabled={!ready || shot}
					onClick={() => {
						const video = videoRef.current;
						if (!video || shot) {
							return;
						}
						setShot(true);
						void takePhoto(video).then(
							(file) => {
								props.onCapture(file);
							},
							(error: unknown) => {
								setShot(false);
								props.onError(toError(error).message);
							},
						);
					}}
				>
					Take photo
				</button>
				<button type="button" className="secondary" onClick={props.onClose}>
					Close camera
				</button>
			</div>
		</div>
	);
}
