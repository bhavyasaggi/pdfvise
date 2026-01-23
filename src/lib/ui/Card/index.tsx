import type React from "react";

export default function Card(props: {
	children?: React.ReactNode;
	className?: string;
	style?: React.CSSProperties;
}) {
	return (
		<div
			className={props.className}
			style={{
				borderRadius: "var(--pico-border-radius)",
				border: "var(--pico-border-width) solid var(--pico-muted-border-color)",
				padding: "calc(3 * var(--pico-spacing)) var(--pico-spacing)",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				textAlign: "center",
				color: "var(--pico-muted-color)",
				background: "var(--pico-background-color)",
				...props.style,
			}}
		>
			{props.children}
		</div>
	);
}
