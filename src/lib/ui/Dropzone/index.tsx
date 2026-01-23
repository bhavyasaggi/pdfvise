import type React from "react";

export default function Dropzone(props: {
	id?: string;
	name?: string;
	disabled?: boolean;
	onChange?: (files: File[]) => Promise<void> | void;
	children?: React.ReactNode;
	className?: string;
	style?: React.CSSProperties;
}) {
	return (
		<label
			onDragOver={(e) => {
				const hasNonFileItems = Array.prototype.some.call(
					e.dataTransfer.items,
					(item) => item.kind !== "file",
				);
				if (!hasNonFileItems) {
					e.preventDefault();
					e.dataTransfer.dropEffect = "copy";
				}
			}}
			onDrop={async (e) => {
				e.preventDefault();
				// e.dataTransfer.dropEffect = "copy";

				const fileItems: File[] = [];
				Array.prototype.forEach.call(e.dataTransfer.items, (item) => {
					if (item.kind === "file") {
						const itemFile = item.getAsFile();
						if (itemFile) {
							fileItems.push(itemFile);
						}
					}
				});
				await props.onChange?.(fileItems);
			}}
			className={props.className}
			style={props.style}
		>
			{props.children}
			<input
				id={props.id}
				name={props.name}
				type="file"
				disabled={props.disabled}
				onChange={async (e) => {
					const files = Array.from(e.target.files || []).map(
						(file) => new File([file], file.name, { type: file.type }),
					);
					await props.onChange?.(files);
					e.target.value = "";
				}}
				style={{
					display: "none",
					position: "absolute",
					zIndex: -1,
					top: 0,
					left: 0,
					height: 0,
					width: 0,
					opacity: 0,
				}}
			/>
		</label>
	);
}
