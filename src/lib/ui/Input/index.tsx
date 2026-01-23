import type { HTMLInputTypeAttribute } from "react";

export default function Input(props: {
	id?: string;
	name?: string;
	type?: HTMLInputTypeAttribute;
	step?: string;
	min?: string;
	max?: string;
	label?: string;
	defaultValue?: string;
	onChange?: (value: string) => void;
	className?: string;
	style?: React.CSSProperties;
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
				defaultValue={props.defaultValue}
				onChange={(e) => props.onChange?.(e.target.value)}
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
				onChange={(e) => props.onChange?.(e.target.value)}
			/>
		</label>
	);
}
