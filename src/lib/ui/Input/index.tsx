import type { CSSProperties, HTMLInputTypeAttribute } from "preact";

export default function Input(props: {
	id?: string;
	name?: string;
	type?: HTMLInputTypeAttribute;
	step?: string;
	min?: string;
	max?: string;
	label?: string;
	ariaLabel?: string;
	defaultValue?: string;
	onChange?: (value: string) => void;
	className?: string;
	style?: CSSProperties;
}) {
	if (!props.label) {
		return (
			<input
				id={props.id}
				name={props.name}
				type={props.type}
				step={props.step}
				min={props.min}
				max={props.max}
				aria-label={props.ariaLabel}
				defaultValue={props.defaultValue}
				onChange={(event) => {
					if (event.currentTarget instanceof HTMLInputElement) {
						props.onChange?.(event.currentTarget.value);
					}
				}}
				className={props.className}
				style={props.style}
			/>
		);
	}

	return (
		<label className={props.className} style={props.style}>
			<span>{props.label || ""}</span>
			<input
				id={props.id}
				name={props.name}
				type={props.type}
				step={props.step}
				min={props.min}
				max={props.max}
				defaultValue={props.defaultValue}
				onChange={(event) => {
					if (event.currentTarget instanceof HTMLInputElement) {
						props.onChange?.(event.currentTarget.value);
					}
				}}
			/>
		</label>
	);
}
