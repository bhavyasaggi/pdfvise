import type React from "react";
import { useContext } from "react";
import SortableList, { SortableItem } from "react-easy-sort";

import SuspenseErrorBoundary from "@/lib/ui/SuspenseErrorBoundary";

import { PDFManagerActionContext, PDFManagerValueContext } from "../context";
import styles from "../styles.module.scss";

import ViewImage from "../ViewImage";
import ViewItem from "../ViewItem";

// TODO: Replace with proper fallback
const fallback = (error?: Error) => {
	return error ? <div>Error: {error.message}</div> : <div>Loading...</div>;
};

export default function PDFManagerView(props: {
	onChange?: (index: number) => void;
	className?: string;
	style?: React.CSSProperties;
}) {
	const { mode, data, isLoading, error } = useContext(PDFManagerValueContext);
	const { setMeta } = useContext(PDFManagerActionContext);

	return (
		<div
			className={[styles.cardViewContainer, props.className]
				.filter(Boolean)
				.join(" ")}
			style={props.style}
		>
			{isLoading ? fallback() : null}
			{error ? fallback(error) : null}
			<SortableList
				onSortEnd={(oldIndex, newIndex) => {
					setMeta((prev) => {
						if (!prev.data || prev.isLoading) {
							return prev;
						}
						const data = [...prev.data];
						const startIndex = oldIndex < 0 ? data.length + oldIndex : oldIndex;
						const endIndex = newIndex < 0 ? data.length + newIndex : newIndex;
						if (
							startIndex >= 0 &&
							startIndex < data.length &&
							endIndex >= 0 &&
							endIndex < data.length
						) {
							const [item] = data.splice(oldIndex, 1);
							data.splice(endIndex, 0, item);
						}

						return {
							...prev,
							data: data,
						};
					});
				}}
				className={styles.cardViewItemGroup}
			>
				{(data || []).map((item, itemIndex) => (
					<SuspenseErrorBoundary
						fallback={fallback}
						key={`__${item.id}-${item.index}-${item.opIndex || 0}_${itemIndex}`}
					>
						<SortableItem
							key={`__${item.id}-${item.index}-${item.opIndex || 0}_${itemIndex}`}
						>
							{mode === "imagesOnly" &&
							item.opIndex != null &&
							item.opIndex !== undefined ? (
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
								/>
							)}
						</SortableItem>
					</SuspenseErrorBoundary>
				))}
			</SortableList>
			{!isLoading && !error && (!data || !data.length) ? (
				<p style={{ textAlign: "center" }}>Add a File to continue.</p>
			) : null}
		</div>
	);
}
