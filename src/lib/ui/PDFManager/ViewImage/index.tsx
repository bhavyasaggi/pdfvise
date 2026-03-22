import React, { useContext, useEffect, useState } from "react";
import { SortableKnob } from "react-easy-sort";
import { useIntersectionObserver } from "@/lib/hooks/use-intersection-observer";
import Icon from "@/lib/ui/Icon";
import { PDFManagerActionContext } from "../context";
import styles from "../styles.module.scss";
import type { PDFPageDataType } from "../types";

const ViewImage = React.forwardRef(function ViewImageRaw(
	props: {
		pdfPage: PDFPageDataType;
		disabled?: boolean;
		index: number;
		imageIndex: number;
	},
	ref,
) {
	const [loading, setLoading] = useState(true);
	const [thumbnail, setThumbnail] = useState<string | undefined>(undefined);

	const [refIntersectionObserver, isIntersecting] = useIntersectionObserver();

	const { get, extractImage, setMeta } = useContext(PDFManagerActionContext);

	useEffect(() => {
		let isStale = false;
		if (isIntersecting) {
			extractImage(props.pdfPage, {
				maxDimension: 128,
				quality: 0.6,
				imageIndex: props.imageIndex,
			})
				.then((thumbnailBlob) => {
					if (!isStale) {
						setThumbnail(
							thumbnailBlob ? URL.createObjectURL(thumbnailBlob) : undefined,
						);
						setLoading(false);
					}
				})
				.catch((error) => {
					console.error(error);
					if (!isStale) {
						setThumbnail(undefined);
						setLoading(false);
					}
				});
		}
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
				{loading ? (
					<Icon
						icon="loader"
						height={128}
						width={128}
						title="Loading"
						className={styles.cardViewItemThumbnail}
					/>
				) : (
					<img
						src={thumbnail || ""}
						alt={pageString}
						width={128}
						height={128}
						className={styles.cardViewItemThumbnail}
						style={{
							transform: `rotate(${props.pdfPage.rotation || 0}deg)`,
						}}
					/>
				)}
				<figcaption className={styles.cardViewItemThumbnailFigureCaption}>
					<code>{pageString}</code>
				</figcaption>
			</figure>
			<div className={styles.cardViewItemButtonGroup}>
				<SortableKnob>
					<button
						type="button"
						disabled={props.disabled}
						className={`outline secondary ${styles.cardViewItemButton}`}
						aria-label="Move"
					>
						<Icon icon="move" height={16} width={16} title="Move" />
					</button>
				</SortableKnob>
				<div />
				<div />
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
					<Icon icon="trash-2" height={16} width={16} title="Remove" />
				</button>
			</div>
		</div>
	);
});

export default ViewImage;
