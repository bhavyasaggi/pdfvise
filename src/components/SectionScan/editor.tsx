import { useEffect, useRef } from "react";

import {
	type CornerIndex,
	cornerLabel,
	type Point,
	type Quad,
} from "@/lib/utils/scan";

import styles from "./styles.module.scss";

const CORNERS: readonly CornerIndex[] = [0, 1, 2, 3];

const HANDLE_STYLE = {
	position: "absolute",
	width: "24px",
	height: "24px",
	minWidth: "24px",
	minHeight: "24px",
	margin: 0,
	padding: 0,
	borderRadius: "50%",
	boxSizing: "border-box",
	transform: "translate(-50%, -50%)",
	touchAction: "none",
	zIndex: 1,
} as const;

function arrowNudge(event: {
	altKey: boolean;
	metaKey: boolean;
	ctrlKey: boolean;
	shiftKey: boolean;
	key: string;
}) {
	if (event.altKey || event.metaKey || event.ctrlKey) {
		return null;
	}
	const step = event.shiftKey ? 0.05 : 0.01;
	if (event.key === "ArrowLeft") {
		return { x: -step, y: 0 };
	}
	if (event.key === "ArrowRight") {
		return { x: step, y: 0 };
	}
	if (event.key === "ArrowUp") {
		return { x: 0, y: -step };
	}
	if (event.key === "ArrowDown") {
		return { x: 0, y: step };
	}
	return null;
}

function dragPoint(
	handle: EventTarget | null,
	frame: HTMLDivElement | null,
	event: { pointerId: number; clientX: number; clientY: number },
) {
	if (
		!(handle instanceof HTMLButtonElement) ||
		!frame ||
		!handle.hasPointerCapture(event.pointerId)
	) {
		return null;
	}
	const rect = frame.getBoundingClientRect();
	if (rect.width < 1 || rect.height < 1) {
		return null;
	}
	return {
		x: (event.clientX - rect.left) / rect.width,
		y: (event.clientY - rect.top) / rect.height,
	};
}

function CornerHandle(props: {
	index: CornerIndex;
	point: Point | undefined;
	busy: boolean;
	frameRef: { current: HTMLDivElement | null };
	buttonRef?: { current: HTMLButtonElement | null };
	onCorner: (index: CornerIndex, point: Point) => void;
}) {
	const x = props.point?.x ?? 0;
	const y = props.point?.y ?? 0;
	return (
		<button
			type="button"
			ref={props.buttonRef}
			className={styles.handle}
			aria-label={cornerLabel(props.index)}
			disabled={props.busy}
			style={{
				...HANDLE_STYLE,
				left: `${x * 100}%`,
				top: `${y * 100}%`,
			}}
			onPointerDown={(event) => {
				const handle = event.currentTarget;
				if (handle instanceof HTMLButtonElement) {
					handle.setPointerCapture(event.pointerId);
				}
			}}
			onPointerMove={(event) => {
				const point = dragPoint(
					event.currentTarget,
					props.frameRef.current,
					event,
				);
				if (!point) {
					return;
				}
				props.onCorner(props.index, point);
			}}
			onKeyDown={(event) => {
				const nudge = arrowNudge(event);
				if (!nudge || !props.point) {
					return;
				}
				event.preventDefault();
				props.onCorner(props.index, {
					x: props.point.x + nudge.x,
					y: props.point.y + nudge.y,
				});
			}}
		/>
	);
}

export default function ScanEditor(props: {
	url: string;
	corners: Quad;
	problem: string | null;
	note: string | null;
	confirmLabel: string;
	busy: boolean;
	showSkip: boolean;
	onCorner: (index: CornerIndex, point: Point) => void;
	onConfirm: () => void;
	onSkip: () => void;
	onCancel: () => void;
	onImageError: () => void;
}) {
	const frameRef = useRef<HTMLDivElement>(null);
	const firstRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		firstRef.current?.focus();
	}, []);

	return (
		<fieldset className={styles.editor} aria-label="Page corners">
			<div className={styles.stage}>
				<div className={styles.frame} ref={frameRef}>
					<img
						src={props.url}
						alt=""
						draggable={false}
						className={styles.photo}
						onError={props.onImageError}
					/>
					<svg
						className={
							props.problem
								? `${styles.overlay} ${styles.overlayInvalid}`
								: styles.overlay
						}
						viewBox="0 0 1 1"
						preserveAspectRatio="none"
						aria-hidden="true"
					>
						<title>Page outline</title>
						<polygon
							points={props.corners
								.map((point) => `${point.x},${point.y}`)
								.join(" ")}
							fill={
								props.problem
									? "rgba(196, 60, 60, 0.18)"
									: "rgba(218, 47, 71, 0.16)"
							}
							stroke="currentColor"
							strokeWidth={3}
							vectorEffect="non-scaling-stroke"
						/>
					</svg>
					{CORNERS.map((index) => (
						<CornerHandle
							key={cornerLabel(index)}
							index={index}
							point={props.corners[index]}
							busy={props.busy}
							frameRef={frameRef}
							buttonRef={index === 0 ? firstRef : undefined}
							onCorner={props.onCorner}
						/>
					))}
				</div>
			</div>
			<output id="scan-quad-hint" aria-live="polite">
				{props.note ? `${props.note} ` : null}
				{props.problem ??
					"Drag each corner to the page. Arrow keys move the focused corner."}
			</output>
			<div className={styles.toolbar}>
				<button
					type="button"
					onClick={props.onConfirm}
					disabled={props.busy || props.problem !== null}
					aria-describedby="scan-quad-hint"
				>
					{props.confirmLabel}
				</button>
				{props.showSkip ? (
					<button
						type="button"
						className="secondary"
						onClick={props.onSkip}
						disabled={props.busy}
					>
						Skip photo
					</button>
				) : (
					<button
						type="button"
						className="secondary"
						onClick={props.onCancel}
						disabled={props.busy}
					>
						Cancel
					</button>
				)}
			</div>
		</fieldset>
	);
}
