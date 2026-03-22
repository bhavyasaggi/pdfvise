import type React from "react";
import { useCallback, useEffect, useRef } from "react";

export default function ButtonFile(props: {
	disabled?: boolean;
	children?: React.ReactNode;
	onChange?: (files: File[]) => Promise<void> | void;
	className?: string;
	style?: React.CSSProperties;
}) {
	const inputRef = useRef<HTMLInputElement>(null);

	const inputAddListener: React.ChangeEventHandler<HTMLInputElement> =
		useCallback(
			async (e) => {
				// @ts-expect-error e.target is not null
				const files: FileList | null | undefined = e.target?.files;
				await props.onChange?.(
					Array.from(files || []).map(
						(file) => new File([file], file.name, { type: file.type }),
					),
				);
				// @ts-expect-error e.target is not null
				e.target.value = "";
			},
			[props.onChange],
		);

	useEffect(() => {
		// biome-ignore lint/suspicious/noExplicitAny: Transformation Error
		const memoryInputListener = inputAddListener as any;
		const memoryInput = document.createElement("input");
		memoryInput.type = "file";
		memoryInput.accept = "application/pdf";
		Object.assign(memoryInput.style, {
			display: "none",
			position: "absolute",
			top: 0,
			left: 0,
			height: 0,
			width: 0,
			opacity: 0,
			zIndex: -1,
		});
		memoryInput.addEventListener("change", memoryInputListener);
		inputRef.current = memoryInput;
		return () => {
			memoryInput.removeEventListener("change", memoryInputListener);
		};
	}, [inputAddListener]);

	return (
		<button
			type="button"
			disabled={props.disabled}
			onClick={() => {
				inputRef.current?.click();
			}}
			className={props.className}
			style={props.style}
		>
			{props.children}
		</button>
	);
}
