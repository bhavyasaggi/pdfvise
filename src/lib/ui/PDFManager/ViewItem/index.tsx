import type { CSSProperties } from "preact";
import React, { useContext, useEffect, useId, useState } from "react";
import { SortableKnob } from "react-easy-sort";
import { useIntersectionObserver } from "@/lib/hooks/use-intersection-observer";
import Icon from "@/lib/ui/Icon";
import { normalizeQuarterTurn } from "@/lib/utils/pdf-geometry";
import { PDFManagerActionContext, PDFManagerValueContext } from "../context";
import PageEditDialog from "../PageEdit";
import styles from "../styles.module.scss";
import type { PDFPageDataType } from "../types";

type PreviewPhase = "waiting" | "loading" | "ready" | "empty" | "error";

const PREVIEW_FRAME = 128;

function clampedPair(first: number, second: number, limit: number) {
	const safeFirst = Math.max(0, first);
	const safeSecond = Math.max(0, second);
	const sum = safeFirst + safeSecond;
	if (sum <= limit || sum === 0) {
		return { first: safeFirst, second: safeSecond };
	}
	const fit = limit / sum;
	return { first: safeFirst * fit, second: safeSecond * fit };
}

function previewFrameStyle(page: PDFPageDataType): CSSProperties {
	const scale = PREVIEW_FRAME / Math.max(page.width, page.height, 1);
	const vertical = clampedPair(
		(page.marginTop ?? 0) * scale,
		(page.marginBottom ?? 0) * scale,
		PREVIEW_FRAME,
	);
	const horizontal = clampedPair(
		(page.marginLeft ?? 0) * scale,
		(page.marginRight ?? 0) * scale,
		PREVIEW_FRAME,
	);
	return {
		paddingTop: vertical.first,
		paddingRight: horizontal.second,
		paddingBottom: vertical.second,
		paddingLeft: horizontal.first,
	};
}

function previewTransform(page: PDFPageDataType) {
	const flipX = page.flipHorizontal === true ? -1 : 1;
	const flipY = page.flipVertical === true ? -1 : 1;
	const turn = normalizeQuarterTurn(page.rotation);
	return `rotate(${turn}deg) scale(${flipX}, ${flipY})`;
}

function placeholderTitle(phase: PreviewPhase) {
	if (phase === "loading") {
		return "Loading preview";
	}
	if (phase === "error") {
		return "Preview failed";
	}
	if (phase === "empty") {
		return "No preview";
	}
	return "Preview pending";
}

function PageThumbnail(props: {
	phase: PreviewPhase;
	thumbnail?: string;
	pageString: string;
	pdfPage: PDFPageDataType;
	pageEditor?: boolean;
}) {
	if (props.phase === "ready" && props.thumbnail && props.pageEditor) {
		return (
			<div
				className={styles.cardViewItemFrame}
				style={previewFrameStyle(props.pdfPage)}
			>
				<img
					src={props.thumbnail}
					alt={props.pageString}
					className={`${styles.cardViewItemThumbnail} ${styles.cardViewItemThumbnailFit}`}
					style={{ transform: previewTransform(props.pdfPage) }}
				/>
			</div>
		);
	}
	if (props.phase === "ready" && props.thumbnail) {
		return (
			<img
				src={props.thumbnail}
				alt={props.pageString}
				width={PREVIEW_FRAME}
				height={PREVIEW_FRAME}
				className={styles.cardViewItemThumbnail}
			/>
		);
	}
	return (
		<Icon
			icon={props.phase === "loading" ? "loader" : "file"}
			height={PREVIEW_FRAME}
			width={PREVIEW_FRAME}
			title={placeholderTitle(props.phase)}
			className={styles.cardViewItemThumbnail}
		/>
	);
}

const ViewItem = React.forwardRef(function ViewItemRaw(
	props: {
		pdfPage: PDFPageDataType;
		disabled?: boolean;
		index: number;
		pageEditor?: boolean;
	},
	ref,
) {
	const [phase, setPhase] = useState<PreviewPhase>("waiting");
	const [thumbnail, setThumbnail] = useState<string | undefined>(undefined);
	const pageEditId = useId();
	const pageEditTitleId = useId();

	const [refIntersectionObserver, isIntersecting] = useIntersectionObserver();

	const { data } = useContext(PDFManagerValueContext);
	const { get, extractThumbnail, setMeta } = useContext(
		PDFManagerActionContext,
	);
	const isLast = !data || props.index >= data.length - 1;

	useEffect(() => {
		if (!isIntersecting) {
			setPhase("waiting");
			return;
		}
		let isStale = false;
		setPhase("loading");
		extractThumbnail(props.pdfPage, {
			maxDimension: PREVIEW_FRAME,
			quality: 0.6,
			rotation: props.pageEditor ? 0 : props.pdfPage.rotation,
		})
			.then((thumbnailBlob) => {
				if (isStale) {
					return;
				}
				setThumbnail(
					thumbnailBlob ? URL.createObjectURL(thumbnailBlob) : undefined,
				);
				setPhase(thumbnailBlob ? "ready" : "empty");
			})
			.catch((error: unknown) => {
				console.error(error);
				if (!isStale) {
					setThumbnail(undefined);
					setPhase("error");
				}
			});
		return () => {
			isStale = true;
		};
	}, [extractThumbnail, isIntersecting, props.pageEditor, props.pdfPage]);

	useEffect(() => {
		return () => {
			if (thumbnail) {
				URL.revokeObjectURL(thumbnail);
			}
		};
	}, [thumbnail]);

	const { file, pdfDocumentProxy } = get(props.pdfPage.id) || {};

	const pageString = `${props.pdfPage.index + 1}/${pdfDocumentProxy?.numPages}`;

	const onAdjust = (patch: Partial<PDFPageDataType>) => {
		setMeta((prev) => {
			const data = [...(prev.data || [])];
			const current = data[props.index];
			if (!current) {
				return prev;
			}
			data[props.index] = { ...current, ...patch };
			return { ...prev, data };
		});
	};

	return (
		<div ref={ref as React.Ref<HTMLDivElement>} className={styles.cardViewItem}>
			<div className={styles.cardViewItemHeaderGroup}>
				<Icon
					icon="info"
					height={16}
					width={16}
					title={file?.name || "File"}
					decorative
					className={styles.cardViewItemHeaderIcon}
				/>
				<small
					className={styles.cardViewItemHeader}
					title={file?.name || "File"}
				>
					{file?.name || "-"}
				</small>
			</div>
			<figure
				ref={refIntersectionObserver}
				className={styles.cardViewItemThumbnailFigure}
			>
				<PageThumbnail
					phase={phase}
					thumbnail={thumbnail}
					pageString={pageString}
					pdfPage={props.pdfPage}
					pageEditor={props.pageEditor}
				/>
				<figcaption className={styles.cardViewItemThumbnailFigureCaption}>
					<code>{pageString}</code>
				</figcaption>
			</figure>
			<div className={styles.cardViewItemButtonGroup}>
				<button
					type="button"
					disabled={props.disabled || props.index === 0}
					className={`outline secondary ${styles.cardViewItemButton}`}
					aria-label="Move earlier"
					onClick={() => {
						setMeta((prev) => {
							const data = [...(prev.data || [])];
							const nextIndex = props.index - 1;
							const current = data[props.index];
							const neighbor = data[nextIndex];
							if (current === undefined || neighbor === undefined) {
								return prev;
							}
							data[props.index] = neighbor;
							data[nextIndex] = current;
							return { ...prev, data };
						});
					}}
				>
					<Icon
						icon="chevron-up"
						height={16}
						width={16}
						title="Move earlier"
						decorative
					/>
				</button>
				<button
					type="button"
					disabled={props.disabled || isLast}
					className={`outline secondary ${styles.cardViewItemButton}`}
					aria-label="Move later"
					onClick={() => {
						setMeta((prev) => {
							const data = [...(prev.data || [])];
							const nextIndex = props.index + 1;
							const current = data[props.index];
							const neighbor = data[nextIndex];
							if (current === undefined || neighbor === undefined) {
								return prev;
							}
							data[props.index] = neighbor;
							data[nextIndex] = current;
							return { ...prev, data };
						});
					}}
				>
					<Icon
						icon="chevron-down"
						height={16}
						width={16}
						title="Move later"
						decorative
					/>
				</button>
				<SortableKnob>
					<button
						type="button"
						disabled={props.disabled}
						className={`outline secondary ${styles.cardViewItemButton}`}
						aria-label="Drag to reorder"
						onKeyDown={(event) => {
							if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
								return;
							}
							event.preventDefault();
							const delta = event.key === "ArrowUp" ? -1 : 1;
							setMeta((prev) => {
								const data = [...(prev.data || [])];
								const nextIndex = props.index + delta;
								const current = data[props.index];
								const neighbor = data[nextIndex];
								if (current === undefined || neighbor === undefined) {
									return prev;
								}
								data[props.index] = neighbor;
								data[nextIndex] = current;
								return { ...prev, data };
							});
						}}
					>
						<Icon
							icon="move"
							height={16}
							width={16}
							title="Drag to reorder"
							decorative
						/>
					</button>
				</SortableKnob>
				{props.pageEditor ? (
					<button
						type="button"
						disabled={props.disabled}
						className={`outline secondary ${styles.cardViewItemButton}`}
						aria-label="Edit page"
						aria-haspopup="dialog"
						aria-controls={pageEditId}
						commandfor={pageEditId}
						command="show-modal"
					>
						<Icon
							icon="edit-2"
							height={16}
							width={16}
							title="Edit page"
							decorative
						/>
					</button>
				) : (
					<button
						type="button"
						disabled={props.disabled}
						className={`outline secondary ${styles.cardViewItemButton}`}
						aria-label="Rotate"
						onClick={() => {
							setMeta((prev) => {
								const data = [...(prev.data || [])];
								data.splice(props.index, 1, {
									...props.pdfPage,
									rotation: (props.pdfPage.rotation + 90) % 360,
								});
								return {
									...prev,
									data,
								};
							});
						}}
					>
						<Icon
							icon="rotate-cw"
							height={16}
							width={16}
							title="Rotate"
							decorative
						/>
					</button>
				)}
				<button
					type="button"
					disabled={props.disabled}
					className={`outline secondary ${styles.cardViewItemButton}`}
					aria-label="Duplicate"
					onClick={() => {
						setMeta((prev) => {
							const data = [...(prev.data || [])];
							data.splice(props.index, 0, { ...props.pdfPage });
							return {
								...prev,
								data,
							};
						});
					}}
				>
					<Icon
						icon="copy"
						height={16}
						width={16}
						title="Duplicate"
						decorative
					/>
				</button>
				<button
					type="button"
					disabled={props.disabled}
					className={`outline secondary ${styles.cardViewItemButton} ${styles.cardViewItemButtonDel}`}
					aria-label="Remove"
					onClick={() => {
						setMeta((prev) => {
							const data = [...(prev.data || [])];
							data.splice(props.index, 1);
							return {
								...prev,
								data,
							};
						});
					}}
				>
					<Icon
						icon="trash-2"
						height={16}
						width={16}
						title="Remove"
						decorative
					/>
				</button>
			</div>
			{props.pageEditor ? (
				<PageEditDialog
					dialogId={pageEditId}
					titleId={pageEditTitleId}
					index={props.index}
					pdfPage={props.pdfPage}
					onAdjust={onAdjust}
				/>
			) : null}
		</div>
	);
});

export default ViewItem;
