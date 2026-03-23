import type { CSSProperties } from "preact";

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
	ariaLabel?: string;
	defaultValue?: string;
	onChange?: (value: string) => void;
	data?: Array<string | { value: string; label: string }>;
	className?: string;
	style?: CSSProperties;
}) {
	if (!props.label) {
		return (
			<select
				id={props.id}
				name={props.name}
				aria-label={props.ariaLabel}
				defaultValue={props.defaultValue}
				onChange={(event) => {
					if (event.currentTarget instanceof HTMLSelectElement) {
						props.onChange?.(event.currentTarget.value);
					}
				}}
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
				onChange={(event) => {
					if (event.currentTarget instanceof HTMLSelectElement) {
						props.onChange?.(event.currentTarget.value);
					}
				}}
			>
				<InputSelectOptions data={props.data} />
			</select>
		</label>
	);
}
