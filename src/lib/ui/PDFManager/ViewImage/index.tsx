import React, { useContext, useEffect, useState } from "react";
import { SortableKnob } from "react-easy-sort";
import { useIntersectionObserver } from "@/lib/hooks/use-intersection-observer";
import Icon from "@/lib/ui/Icon";
import { PDFManagerActionContext, PDFManagerValueContext } from "../context";
import styles from "../styles.module.scss";
import type { PDFPageDataType } from "../types";

type PreviewPhase = "waiting" | "loading" | "ready" | "empty" | "error";

const ViewImage = React.forwardRef(function ViewImageRaw(
	props: {
		pdfPage: PDFPageDataType;
		disabled?: boolean;
		index: number;
		imageIndex: number;
	},
	ref,
) {
	const [phase, setPhase] = useState<PreviewPhase>("waiting");
	const [thumbnail, setThumbnail] = useState<string | undefined>(undefined);

	const [refIntersectionObserver, isIntersecting] = useIntersectionObserver();

	const { data } = useContext(PDFManagerValueContext);
	const { get, extractImage, setMeta } = useContext(PDFManagerActionContext);
	const isLast = !data || props.index >= data.length - 1;

	useEffect(() => {
		if (!isIntersecting) {
			setPhase("waiting");
			return;
		}
		let isStale = false;
		setPhase("loading");
		extractImage(props.pdfPage, {
			maxDimension: 128,
			quality: 0.6,
			imageIndex: props.imageIndex,
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
	}, [extractImage, isIntersecting, props.pdfPage, props.imageIndex]);

	useEffect(() => {
		return () => {
			if (thumbnail) {
				URL.revokeObjectURL(thumbnail);
			}
		};
	}, [thumbnail]);

	const { file, pdfDocumentProxy } = get(props.pdfPage.id) || {};

	const pageString = `${props.pdfPage.index + 1}/${pdfDocumentProxy?.numPages}`;

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
				{phase === "ready" && thumbnail ? (
					<img
						src={thumbnail}
						alt={pageString}
						width={128}
						height={128}
						className={styles.cardViewItemThumbnail}
					/>
				) : (
					<Icon
						icon={phase === "loading" ? "loader" : "image"}
						height={128}
						width={128}
						title={
							phase === "loading"
								? "Loading preview"
								: phase === "error"
									? "Preview failed"
									: phase === "empty"
										? "No preview"
										: "Preview pending"
						}
						className={styles.cardViewItemThumbnail}
					/>
				)}
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
		</div>
	);
});

export default ViewImage;
