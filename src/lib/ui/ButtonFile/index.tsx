import type { CSSProperties } from "preact";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef } from "react";

export default function ButtonFile(props: {
	disabled?: boolean;
	accept?: string;
	multiple?: boolean;
	capture?: "environment" | "user";
	inputRef?: { current: HTMLInputElement | null };
	children?: ReactNode;
	onChange?: (files: File[]) => Promise<void> | void;
	className?: string;
	style?: CSSProperties;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const externalRef = props.inputRef;
	const onChange = props.onChange;
	const accept = props.accept ?? "application/pdf";
	const multiple = props.multiple ?? false;
	const capture = props.capture;

	const onInput = useCallback(
		async (event: Event) => {
			const input = event.currentTarget;
			if (!(input instanceof HTMLInputElement)) {
				return;
			}
			const files = Array.from(input.files ?? []);
			input.value = "";
			await onChange?.(files);
		},
		[onChange],
	);

	useEffect(() => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = accept;
		input.multiple = multiple;
		// A camera capture and a multi-file picker do not combine.
		if (capture && !multiple) {
			input.setAttribute("capture", capture);
		}
		input.hidden = true;
		input.addEventListener("change", onInput);
		document.body.append(input);
		inputRef.current = input;
		if (externalRef) {
			externalRef.current = input;
		}
		return () => {
			input.removeEventListener("change", onInput);
			input.remove();
			if (externalRef?.current === input) {
				externalRef.current = null;
			}
		};
	}, [accept, capture, externalRef, multiple, onInput]);

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
