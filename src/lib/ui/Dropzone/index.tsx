import type { CSSProperties, TargetedDragEvent } from "preact";
import type { ReactNode } from "react";

function filesFromList(
	list: FileList | DataTransferItemList | null | undefined,
) {
	if (!list) {
		return [];
	}
	const files: File[] = [];
	if (list instanceof FileList) {
		for (const file of Array.from(list)) {
			files.push(file);
		}
		return files;
	}
	for (const item of Array.from(list)) {
		if (item.kind !== "file") {
			continue;
		}
		const file = item.getAsFile();
		if (file) {
			files.push(file);
		}
	}
	return files;
}

export default function Dropzone(props: {
	id?: string;
	name?: string;
	disabled?: boolean;
	accept?: string;
	multiple?: boolean;
	onChange?: (files: File[]) => Promise<void> | void;
	label?: string;
	children?: ReactNode;
	className?: string;
	style?: CSSProperties;
}) {
	const accept = props.accept ?? "application/pdf";
	const multiple = props.multiple ?? true;

	const onDragOver = (event: TargetedDragEvent<HTMLLabelElement>) => {
		if (props.disabled || !event.dataTransfer) {
			return;
		}
		const hasNonFileItems = Array.from(event.dataTransfer.items).some(
			(item) => item.kind !== "file",
		);
		if (!hasNonFileItems) {
			event.preventDefault();
			event.dataTransfer.dropEffect = "copy";
		}
	};

	const onDrop = async (event: TargetedDragEvent<HTMLLabelElement>) => {
		if (props.disabled) {
			return;
		}
		event.preventDefault();
		const files = filesFromList(event.dataTransfer?.items);
		if (files.length > 0) {
			await props.onChange?.(multiple ? files : files.slice(0, 1));
		}
	};

	return (
		<label
			onDragOver={onDragOver}
			onDrop={onDrop}
			className={props.className}
			style={{ position: "relative", ...props.style }}
		>
			{props.children}
			<input
				id={props.id}
				name={props.name}
				type="file"
				accept={accept}
				multiple={multiple}
				disabled={props.disabled}
				aria-label={
					props.label ?? (multiple ? "Add PDF files" : "Add a PDF file")
				}
				onChange={async (event) => {
					const input = event.currentTarget;
					if (!(input instanceof HTMLInputElement)) {
						return;
					}
					const files = filesFromList(input.files);
					input.value = "";
					await props.onChange?.(files);
				}}
				style={{
					position: "absolute",
					width: "1px",
					height: "1px",
					padding: 0,
					margin: "-1px",
					overflow: "hidden",
					clip: "rect(0, 0, 0, 0)",
					whiteSpace: "nowrap",
					border: 0,
				}}
			/>
		</label>
	);
}
