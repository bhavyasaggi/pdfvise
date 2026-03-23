import type { CSSProperties } from "preact";
import { useContext } from "react";
import SortableList, { SortableItem } from "react-easy-sort";

import SuspenseErrorBoundary from "@/lib/ui/SuspenseErrorBoundary";

import { PDFManagerActionContext, PDFManagerValueContext } from "../context";
import styles from "../styles.module.scss";
import type { PDFPageDataType } from "../types";
import ViewImage from "../ViewImage";
import ViewItem from "../ViewItem";

function arrayMove(
	data: PDFPageDataType[],
	fromIndex: number,
	toIndex: number,
) {
	const next = data.slice();
	const startIndex = fromIndex < 0 ? next.length + fromIndex : fromIndex;
	const endIndex = toIndex < 0 ? next.length + toIndex : toIndex;
	if (
		startIndex < 0 ||
		endIndex < 0 ||
		startIndex >= next.length ||
		endIndex >= next.length
	) {
		return next;
	}
	const [item] = next.splice(startIndex, 1);
	if (item) {
		next.splice(endIndex, 0, item);
	}
	return next;
}

function fallback(error?: Error) {
	if (error) {
		return <div role="alert">Error: {error.message}</div>;
	}
	return <output aria-live="polite">Loading…</output>;
}

export default function PDFManagerView(props: {
	className?: string;
	style?: CSSProperties;
	pageEditor?: boolean;
}) {
	const { mode, data, isUninitialized, isLoading, error, notice } = useContext(
		PDFManagerValueContext,
	);
	const { setMeta } = useContext(PDFManagerActionContext);

	return (
		<div
			className={[styles.cardViewContainer, props.className]
				.filter(Boolean)
				.join(" ")}
			style={props.style}
		>
			{isLoading ? fallback() : null}
			{!isLoading && error ? fallback(error) : null}
			{!isLoading && !error && notice ? (
				<output aria-live="polite">{notice}</output>
			) : null}
			{!isLoading && !error && isUninitialized ? (
				<output>Preparing the PDF…</output>
			) : null}
			<SortableList
				onSortEnd={(oldIndex, newIndex) => {
					setMeta((prev) => {
						if (!prev.data || prev.isLoading) {
							return prev;
						}
						return { ...prev, data: arrayMove(prev.data, oldIndex, newIndex) };
					});
				}}
				className={styles.cardViewItemGroup}
			>
				{(data ?? []).map((item, itemIndex) => (
					<SuspenseErrorBoundary
						fallback={fallback}
						key={`${item.id}-${item.index}-${item.opIndex ?? 0}-${itemIndex}`}
					>
						<SortableItem>
							{mode === "imagesOnly" && item.opIndex !== undefined ? (
								<ViewImage
									index={itemIndex}
									imageIndex={item.opIndex}
									pdfPage={item}
									disabled={isLoading}
								/>
							) : (
								<ViewItem
									index={itemIndex}
									pdfPage={item}
									disabled={isLoading}
									pageEditor={props.pageEditor}
								/>
							)}
						</SortableItem>
					</SuspenseErrorBoundary>
				))}
			</SortableList>
			{!isLoading && !error && !isUninitialized && !data?.length ? (
				<output style={{ textAlign: "center" }}>Add a file to continue.</output>
			) : null}
		</div>
	);
}
