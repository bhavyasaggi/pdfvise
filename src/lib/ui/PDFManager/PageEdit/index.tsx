import { useId, useRef, useState } from "react";

import { MARGIN_UNIT_OPTIONS } from "@/lib/pdf-tools";
import { normalizeQuarterTurn } from "@/lib/utils/pdf-geometry";

import styles from "../styles.module.scss";
import type { PDFPageDataType } from "../types";

const INCHES = "72";

const ROTATIONS = [
	{ value: "0", label: "0°" },
	{ value: "90", label: "90°" },
	{ value: "180", label: "180°" },
	{ value: "270", label: "270°" },
] as const;

const MARGIN_FIELDS = [
	{ side: "marginTop", label: "Top" },
	{ side: "marginRight", label: "Right" },
	{ side: "marginBottom", label: "Bottom" },
	{ side: "marginLeft", label: "Left" },
] as const;

type MarginSide = (typeof MARGIN_FIELDS)[number]["side"];

type MarginText = Record<MarginSide, string>;

function formatAmount(points: number, unit: number) {
	const scale = unit > 0 ? unit : Number(INCHES);
	const amount = Math.max(0, points) / scale;
	const rounded = Math.round(amount * 1000) / 1000;
	return String(Object.is(rounded, -0) ? 0 : rounded);
}

function marginTextFor(page: PDFPageDataType, unit: string): MarginText {
	const scale = Number(unit);
	return {
		marginTop: formatAmount(page.marginTop ?? 0, scale),
		marginRight: formatAmount(page.marginRight ?? 0, scale),
		marginBottom: formatAmount(page.marginBottom ?? 0, scale),
		marginLeft: formatAmount(page.marginLeft ?? 0, scale),
	};
}

function commitAmount(raw: string, unit: string) {
	const amount = Number(raw);
	const scale = Number(unit);
	if (!Number.isFinite(amount) || !(scale > 0)) {
		return undefined;
	}
	return Math.max(0, amount) * scale;
}

function PageEditDialog(props: {
	dialogId: string;
	titleId: string;
	index: number;
	pdfPage: PDFPageDataType;
	onAdjust: (patch: Partial<PDFPageDataType>) => void;
}) {
	const hintId = useId();
	const closed = useRef(false);
	const [unit, setUnit] = useState(INCHES);
	const [marginText, setMarginText] = useState<MarginText>(() =>
		marginTextFor(props.pdfPage, INCHES),
	);

	return (
		<dialog
			id={props.dialogId}
			className={styles.pageEditDialog}
			aria-labelledby={props.titleId}
			onToggle={(event) => {
				if (event.target !== event.currentTarget) {
					return;
				}
				closed.current = event.newState === "closed";
				if (!closed.current) {
					return;
				}
				setUnit(INCHES);
				setMarginText(marginTextFor(props.pdfPage, INCHES));
			}}
		>
			<h2 id={props.titleId} className={styles.pageEditTitle}>
				Edit page {props.index + 1}
			</h2>
			<label className={styles.pageEditField}>
				<span>Rotation</span>
				<select
					value={String(normalizeQuarterTurn(props.pdfPage.rotation))}
					onChange={(event) => {
						if (event.currentTarget instanceof HTMLSelectElement) {
							props.onAdjust({
								rotation: normalizeQuarterTurn(
									Number(event.currentTarget.value),
								),
							});
						}
					}}
				>
					{ROTATIONS.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
			</label>
			<fieldset className={styles.pageEditFieldset}>
				<legend>Flip</legend>
				<div className={styles.pageEditChecks}>
					<label className={styles.pageEditCheck}>
						<input
							type="checkbox"
							checked={props.pdfPage.flipHorizontal === true}
							onChange={(event) => {
								if (event.currentTarget instanceof HTMLInputElement) {
									props.onAdjust({
										flipHorizontal: event.currentTarget.checked,
									});
								}
							}}
						/>
						Flip horizontal
					</label>
					<label className={styles.pageEditCheck}>
						<input
							type="checkbox"
							checked={props.pdfPage.flipVertical === true}
							onChange={(event) => {
								if (event.currentTarget instanceof HTMLInputElement) {
									props.onAdjust({
										flipVertical: event.currentTarget.checked,
									});
								}
							}}
						/>
						Flip vertical
					</label>
				</div>
			</fieldset>
			<fieldset className={styles.pageEditFieldset} aria-describedby={hintId}>
				<legend>Margin</legend>
				<div className={styles.pageEditMargins}>
					{MARGIN_FIELDS.map((field) => (
						<label key={field.side} className={styles.pageEditField}>
							<span>{field.label}</span>
							<input
								type="number"
								min="0"
								step="any"
								inputMode="decimal"
								autoComplete="off"
								value={marginText[field.side]}
								onChange={(event) => {
									if (!(event.currentTarget instanceof HTMLInputElement)) {
										return;
									}
									const raw = event.currentTarget.value;
									setMarginText((prev) => ({ ...prev, [field.side]: raw }));
									const points = commitAmount(raw, unit);
									if (points !== undefined) {
										props.onAdjust({ [field.side]: points });
									}
								}}
								onBlur={(event) => {
									if (!(event.currentTarget instanceof HTMLInputElement)) {
										return;
									}
									const points = commitAmount(event.currentTarget.value, unit);
									if (points !== undefined) {
										props.onAdjust({ [field.side]: points });
									}
									if (closed.current) {
										return;
									}
									const next = points ?? props.pdfPage[field.side] ?? 0;
									setMarginText((prev) => ({
										...prev,
										[field.side]: formatAmount(next, Number(unit)),
									}));
								}}
							/>
						</label>
					))}
				</div>
				<label className={styles.pageEditField}>
					<span>Unit</span>
					<select
						value={unit}
						onChange={(event) => {
							if (!(event.currentTarget instanceof HTMLSelectElement)) {
								return;
							}
							const next = event.currentTarget.value;
							setUnit(next);
							setMarginText(marginTextFor(props.pdfPage, next));
						}}
					>
						{MARGIN_UNIT_OPTIONS.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</label>
				<p id={hintId} className={styles.pageEditHint}>
					These margins apply to this page only.
				</p>
			</fieldset>
			<button
				type="button"
				className={`outline secondary ${styles.pageEditClose}`}
				commandfor={props.dialogId}
				command="close"
			>
				Close
			</button>
		</dialog>
	);
}

export default PageEditDialog;
