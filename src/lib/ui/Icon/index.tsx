import type { FeatherIconNames } from "feather-icons";
import FeatherSprite from "feather-icons/dist/feather-sprite.svg?url";
import type { CSSProperties } from "preact";

export interface IconProps {
	readonly title: string;
	readonly icon: FeatherIconNames;
	readonly decorative?: boolean;
	readonly width?: string | number;
	readonly height?: string | number;
	readonly viewBox?: string;
	readonly fill?: string;
	readonly stroke?: string;
	readonly strokeWidth?: string | number;
	readonly strokeLinecap?: "round" | "square";
	readonly strokeLinejoin?: "bevel" | "miter" | "round";
	readonly className?: string;
	readonly style?: CSSProperties;
}

export default function Icon({
	title,
	icon,
	decorative,
	width,
	height,
	viewBox,
	fill,
	stroke,
	strokeWidth,
	strokeLinecap,
	strokeLinejoin,
	className,
	style,
}: IconProps) {
	return (
		<svg
			aria-hidden={decorative ? true : undefined}
			className={className}
			fill={fill ?? "none"}
			focusable="false"
			height={height ?? 24}
			stroke={stroke ?? "currentColor"}
			strokeLinecap={strokeLinecap ?? "round"}
			strokeLinejoin={strokeLinejoin ?? "round"}
			strokeWidth={strokeWidth ?? 2}
			style={style}
			viewBox={viewBox ?? "0 0 24 24"}
			width={width ?? 24}
		>
			<title>{title || `icon ${icon || "??"}`}</title>
			<use href={`${FeatherSprite}#${icon}`} />
		</svg>
	);
}
