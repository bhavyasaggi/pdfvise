import { useEffect, useRef, useState } from "react";

import type { GenerateKind } from "@/lib/utils/pdf-generate";
import { toError } from "@/lib/utils/pdf-geometry";
import { yieldToMain } from "@/lib/utils/schedule";

import styles from "../SectionPDFPages/styles.module.scss";

type Field = {
	name: string;
	label: string;
	defaultValue?: string;
	type?: string;
	rows?: number;
	min?: string;
	step?: string;
};

function localISODate() {
	const date = new Date();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

const FORMS: Record<
	GenerateKind,
	{ downloadName: string; hint: string; fields: Field[] }
> = {
	invoice: {
		downloadName: "invoice",
		hint: "One item per line: description, quantity, rate.",
		fields: [
			{
				name: "from",
				label: "From",
				defaultValue: "Northwind Studio",
				rows: 3,
			},
			{ name: "to", label: "Bill to", defaultValue: "Ada Lovelace", rows: 3 },
			{ name: "number", label: "Invoice number", defaultValue: "1001" },
			{ name: "date", label: "Date", type: "date" },
			{ name: "currency", label: "Currency", defaultValue: "$" },
			{
				name: "items",
				label: "Items",
				rows: 6,
				defaultValue: "Design, 2, 150\nHosting, 1, 40",
			},
			{
				name: "tax",
				label: "Tax percent",
				type: "number",
				min: "0",
				step: "0.1",
				defaultValue: "0",
			},
			{ name: "notes", label: "Notes", rows: 3 },
		],
	},
	rent: {
		downloadName: "rent-receipt",
		hint: "The receipt is created in your browser.",
		fields: [
			{ name: "landlord", label: "Landlord", defaultValue: "Northwind Studio" },
			{ name: "tenant", label: "Tenant", defaultValue: "Ada Lovelace" },
			{
				name: "property",
				label: "Property",
				defaultValue: "12 Market Street",
				rows: 2,
			},
			{ name: "period", label: "Period", defaultValue: "October 2026" },
			{ name: "date", label: "Date", type: "date" },
			{ name: "currency", label: "Currency", defaultValue: "$" },
			{
				name: "amount",
				label: "Amount",
				type: "number",
				min: "0",
				step: "0.01",
				defaultValue: "1200",
			},
			{ name: "mode", label: "Payment mode", defaultValue: "Bank transfer" },
		],
	},
	salary: {
		downloadName: "salary-slip",
		hint: "Amounts use the currency symbol as typed.",
		fields: [
			{ name: "employer", label: "Employer", defaultValue: "Northwind Studio" },
			{ name: "employee", label: "Employee", defaultValue: "Ada Lovelace" },
			{ name: "period", label: "Period", defaultValue: "October 2026" },
			{ name: "currency", label: "Currency", defaultValue: "$" },
			{
				name: "basic",
				label: "Basic",
				type: "number",
				min: "0",
				step: "0.01",
				defaultValue: "3000",
			},
			{
				name: "hra",
				label: "HRA",
				type: "number",
				min: "0",
				step: "0.01",
				defaultValue: "800",
			},
			{
				name: "allowance",
				label: "Allowances",
				type: "number",
				min: "0",
				step: "0.01",
				defaultValue: "200",
			},
			{
				name: "deduction",
				label: "Deductions",
				type: "number",
				min: "0",
				step: "0.01",
				defaultValue: "150",
			},
		],
	},
	expense: {
		downloadName: "expense-report",
		hint: "One expense per line: description, amount.",
		fields: [
			{ name: "title", label: "Title", defaultValue: "October expenses" },
			{ name: "name", label: "Prepared by", defaultValue: "Ada Lovelace" },
			{ name: "date", label: "Date", type: "date" },
			{ name: "currency", label: "Currency", defaultValue: "$" },
			{
				name: "lines",
				label: "Lines",
				rows: 8,
				defaultValue: "Train, 42.50\nMeals, 18",
			},
		],
	},
	resume: {
		downloadName: "resume",
		hint: "Use a blank line between roles or schools.",
		fields: [
			{ name: "name", label: "Name", defaultValue: "Ada Lovelace" },
			{ name: "role", label: "Role", defaultValue: "Mathematician" },
			{ name: "email", label: "Email", defaultValue: "ada@example.com" },
			{ name: "phone", label: "Phone", defaultValue: "+1 555 0100" },
			{ name: "location", label: "Location", defaultValue: "London" },
			{
				name: "summary",
				label: "Summary",
				rows: 3,
				defaultValue: "Writes clear notes on analytical engines.",
			},
			{
				name: "experience",
				label: "Experience",
				rows: 5,
				defaultValue: "Analyst, Analytical Engines\n1843 — Notes on the engine",
			},
			{
				name: "education",
				label: "Education",
				rows: 3,
				defaultValue: "Private study, mathematics",
			},
			{
				name: "skills",
				label: "Skills",
				rows: 2,
				defaultValue: "Mathematics, writing",
			},
		],
	},
};

function textValue(formData: FormData, name: string) {
	const value = formData.get(name);
	return typeof value === "string" ? value.trim() : "";
}

function initialValues(fields: Field[]) {
	const values: Record<string, string> = {};
	for (const field of fields) {
		values[field.name] =
			field.type === "date" ? "" : (field.defaultValue ?? "");
	}
	return values;
}

export default function SectionGenerate(props: { kind: GenerateKind }) {
	const form = FORMS[props.kind];
	const formRef = useRef<HTMLFormElement>(null);
	const [values, setValues] = useState(() => initialValues(form.fields));
	const [phase, setPhase] = useState<
		"ready" | "saving" | "success" | "error" | "empty"
	>("ready");
	const [error, setError] = useState<string | undefined>(undefined);

	useEffect(() => {
		const today = localISODate();
		setValues((prev) => {
			let changed = false;
			const next = { ...prev };
			for (const field of form.fields) {
				if (field.type === "date" && !next[field.name]) {
					next[field.name] = today;
					changed = true;
				}
			}
			return changed ? next : prev;
		});
	}, [form.fields]);

	return (
		<form
			ref={formRef}
			className={styles.optionsContainer}
			aria-busy={phase === "saving"}
			onSubmit={async (event) => {
				event.preventDefault();
				const formElement = formRef.current;
				if (!formElement) {
					return;
				}
				const formData = new FormData(formElement);
				const blank = form.fields.every((field) => {
					if (field.type === "date" || field.type === "number") {
						return true;
					}
					return textValue(formData, field.name).length === 0;
				});
				if (blank) {
					setPhase("empty");
					setError("Enter the details to include in the PDF.");
					return;
				}
				setPhase("saving");
				setError(undefined);
				await yieldToMain();
				try {
					const { buildGeneratedPdf } = await import(
						"@/lib/utils/pdf-generate"
					);
					const { downloadBlob, pdfBytesToBlob } = await import(
						"@/lib/utils/download"
					);
					const bytes = await buildGeneratedPdf(props.kind, formData);
					downloadBlob(
						pdfBytesToBlob(bytes),
						`${form.downloadName}-${Date.now().toString(36)}.pdf`,
					);
					setPhase("success");
				} catch (caught) {
					const nextError = toError(caught);
					console.error(nextError);
					setPhase("error");
					setError(nextError.message);
				}
			}}
		>
			<small>{form.hint}</small>
			{form.fields.map((field) => (
				<label
					key={field.name}
					className={styles.optionsItem}
					htmlFor={field.name}
				>
					<span>{field.label}</span>
					{field.rows ? (
						<textarea
							id={field.name}
							name={field.name}
							rows={field.rows}
							value={values[field.name] ?? ""}
							disabled={phase === "saving"}
							onInput={(event) => {
								const target = event.currentTarget;
								if (!(target instanceof HTMLTextAreaElement)) {
									return;
								}
								setPhase("ready");
								setError(undefined);
								setValues((prev) => ({
									...prev,
									[field.name]: target.value,
								}));
							}}
						/>
					) : (
						<input
							id={field.name}
							name={field.name}
							type={field.type ?? "text"}
							min={field.min}
							step={field.step}
							disabled={phase === "saving"}
							value={values[field.name] ?? ""}
							onInput={(event) => {
								const target = event.currentTarget;
								if (!(target instanceof HTMLInputElement)) {
									return;
								}
								setPhase("ready");
								setError(undefined);
								setValues((prev) => ({
									...prev,
									[field.name]: target.value,
								}));
							}}
						/>
					)}
				</label>
			))}
			{phase === "saving" ? <output aria-live="polite">Saving…</output> : null}
			{phase === "success" ? (
				<output aria-live="polite">Saved. The download has started.</output>
			) : null}
			{error ? (
				<small role="alert" style={{ color: "var(--pico-del-color)" }}>
					{error}
				</small>
			) : null}
			<button type="submit" disabled={phase === "saving"}>
				{phase === "saving" ? "Saving…" : "Save & Download"}
			</button>
		</form>
	);
}
