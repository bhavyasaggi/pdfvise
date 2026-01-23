import type React from "react";

function InputSelectOptions(props: {
	data?: Array<string | { value: string; label: string }>;
}) {
	return (props.data || []).map((option) =>
		typeof option === "string" ? (
			<option key={option} value={option}>
				{option}
			</option>
		) : (
			<option key={option.value} value={option.value}>
				{option.label}
			</option>
		),
	);
}

export default function InputSelect(props: {
	id?: string;
	name?: string;
	label?: string;
	defaultValue?: string;
	onChange?: (value: string) => void;
	data?: Array<string | { value: string; label: string }>;
	className?: string;
	style?: React.CSSProperties;
}) {
	if (!props.label) {
		return (
			<select
				id={props.id}
				name={props.name}
				defaultValue={props.defaultValue}
				onChange={(e) => props.onChange?.(e.target.value)}
				className={props.className}
				style={props.style}
			>
				<InputSelectOptions data={props.data} />
			</select>
		);
	}

	return (
		<label className={props.className} style={props.style}>
			<span>{props.label || ""}</span>
			<select
				id={props.id}
				name={props.name}
				defaultValue={props.defaultValue}
				onChange={(e) => props.onChange?.(e.target.value)}
			>
				<InputSelectOptions data={props.data} />
			</select>
		</label>
	);
}
