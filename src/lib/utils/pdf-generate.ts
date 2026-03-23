import type { PDFDocument, PDFFont, PDFPage, RGB } from "pdf-lib";
import {
	PDFDocument as createPDFDocument,
	PageSizes,
	rgb,
	StandardFonts,
} from "pdf-lib";

import { readFiniteNumber } from "./pdf-geometry";

export type GenerateKind = "invoice" | "rent" | "salary" | "expense" | "resume";

type Pen = {
	doc: PDFDocument;
	font: PDFFont;
	bold: PDFFont;
	page: PDFPage;
	y: number;
};

const LEFT = 48;
const BOTTOM = 48;
const INK = rgb(0.12, 0.14, 0.18);
const MUTED = rgb(0.35, 0.38, 0.42);

function textOf(formData: FormData, name: string) {
	const value = formData.get(name);
	return typeof value === "string" ? value.trim() : "";
}

function localISODate() {
	const date = new Date();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

function dateOf(formData: FormData, name: string) {
	return textOf(formData, name) || localISODate();
}

function amountOf(formData: FormData, name: string) {
	return readFiniteNumber(formData.get(name)) ?? 0;
}

function money(currency: string, value: number) {
	const amount = Number.isFinite(value) ? value : 0;
	return `${currency}${amount.toFixed(2)}`;
}

async function openPen(title: string): Promise<Pen> {
	const doc = await createPDFDocument.create({ updateMetadata: false });
	doc.setTitle(title);
	doc.setCreator("PDFvise");
	doc.setProducer("PDFvise");
	doc.setCreationDate(new Date());
	const font = await doc.embedFont(StandardFonts.Helvetica);
	const bold = await doc.embedFont(StandardFonts.HelveticaBold);
	const page = doc.addPage(PageSizes.A4);
	return { doc, font, bold, page, y: page.getHeight() - 56 };
}

function contentWidth(pen: Pen) {
	return pen.page.getWidth() - LEFT * 2;
}

function ensure(pen: Pen, needed: number) {
	if (pen.y - needed >= BOTTOM) {
		return;
	}
	pen.page = pen.doc.addPage(PageSizes.A4);
	pen.y = pen.page.getHeight() - 56;
}

function draw(
	pen: Pen,
	value: string,
	size: number,
	options?: { bold?: boolean; color?: RGB; x?: number; advance?: boolean },
) {
	ensure(pen, size + 8);
	const font = options?.bold ? pen.bold : pen.font;
	pen.page.drawText(value, {
		x: options?.x ?? LEFT,
		y: pen.y - size,
		size,
		font,
		color: options?.color ?? INK,
	});
	if (options?.advance !== false) {
		pen.y -= size + 6;
	}
}

function wrapLine(
	font: PDFFont,
	value: string,
	size: number,
	maxWidth: number,
) {
	const words = value.split(/\s+/).filter(Boolean);
	const lines: string[] = [];
	let current = "";
	for (const word of words) {
		const next = current ? `${current} ${word}` : word;
		if (font.widthOfTextAtSize(next, size) <= maxWidth) {
			current = next;
			continue;
		}
		if (current) {
			lines.push(current);
		}
		current = word;
	}
	if (current) {
		lines.push(current);
	}
	return lines.length > 0 ? lines : [];
}

function paragraph(pen: Pen, value: string, size = 11) {
	if (!value.trim()) {
		return;
	}
	for (const raw of value.split(/\r?\n/)) {
		const lines = wrapLine(pen.font, raw, size, contentWidth(pen));
		if (lines.length === 0) {
			pen.y -= size;
			continue;
		}
		for (const line of lines) {
			draw(pen, line, size);
		}
	}
}

function heading(pen: Pen, value: string) {
	draw(pen, value, 22, { bold: true });
	pen.y -= 4;
}

function rule(pen: Pen) {
	ensure(pen, 12);
	pen.page.drawLine({
		start: { x: LEFT, y: pen.y },
		end: { x: pen.page.getWidth() - LEFT, y: pen.y },
		thickness: 0.6,
		color: MUTED,
	});
	pen.y -= 14;
}

function labeled(pen: Pen, label: string, value: string) {
	paragraph(pen, `${label}: ${value || "—"}`);
}

function gap(pen: Pen, amount = 8) {
	pen.y -= amount;
}

type TableRow = {
	cells: string[];
	bold?: boolean;
};

function fitText(font: PDFFont, value: string, size: number, width: number) {
	if (font.widthOfTextAtSize(value, size) <= width) {
		return value;
	}
	let next = value;
	while (next.length > 1 && font.widthOfTextAtSize(`${next}…`, size) > width) {
		next = next.slice(0, -1);
	}
	return `${next}…`;
}

function drawTable(pen: Pen, rows: TableRow[], widths: number[]) {
	const size = 10;
	for (const row of rows) {
		ensure(pen, size + 8);
		let x = LEFT;
		const font = row.bold ? pen.bold : pen.font;
		row.cells.forEach((cell, index) => {
			const width = (widths[index] ?? 80) - 8;
			draw(pen, fitText(font, cell, size, width), size, {
				bold: row.bold,
				x,
				advance: false,
			});
			x += widths[index] ?? 80;
		});
		pen.y -= size + 8;
	}
}

function invoiceRows(raw: string) {
	const rows: { label: string; qty: number; rate: number }[] = [];
	for (const line of raw.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed) {
			continue;
		}
		const parts = trimmed.split(",").map((part) => part.trim());
		const label = parts[0] || "Item";
		if (parts.length >= 3) {
			rows.push({
				label,
				qty: readFiniteNumber(parts[1]) ?? 1,
				rate: readFiniteNumber(parts[2]) ?? 0,
			});
			continue;
		}
		if (parts.length === 2) {
			rows.push({
				label,
				qty: 1,
				rate: readFiniteNumber(parts[1]) ?? 0,
			});
			continue;
		}
		rows.push({ label, qty: 1, rate: 0 });
	}
	return rows;
}

async function buildInvoice(formData: FormData) {
	const currency = textOf(formData, "currency") || "$";
	const pen = await openPen(
		`Invoice ${textOf(formData, "number") || ""}`.trim(),
	);
	heading(pen, "Invoice");
	labeled(pen, "Number", textOf(formData, "number"));
	labeled(pen, "Date", dateOf(formData, "date"));
	gap(pen);
	draw(pen, "From", 12, { bold: true });
	paragraph(pen, textOf(formData, "from"));
	draw(pen, "Bill to", 12, { bold: true });
	paragraph(pen, textOf(formData, "to"));
	gap(pen);
	rule(pen);
	const widths = [250, 70, 80, 90];
	drawTable(
		pen,
		[{ cells: ["Description", "Qty", "Rate", "Amount"], bold: true }],
		widths,
	);
	let subtotal = 0;
	for (const row of invoiceRows(textOf(formData, "items"))) {
		const lineTotal = row.qty * row.rate;
		subtotal += lineTotal;
		drawTable(
			pen,
			[
				{
					cells: [
						row.label,
						String(row.qty),
						money(currency, row.rate),
						money(currency, lineTotal),
					],
				},
			],
			widths,
		);
	}
	rule(pen);
	const taxRate = amountOf(formData, "tax");
	const tax = subtotal * (taxRate / 100);
	labeled(pen, "Subtotal", money(currency, subtotal));
	labeled(pen, `Tax (${taxRate}%)`, money(currency, tax));
	draw(pen, `Total: ${money(currency, subtotal + tax)}`, 14, { bold: true });
	gap(pen);
	paragraph(pen, textOf(formData, "notes"));
	return pen.doc.save({ addDefaultPage: false });
}

async function buildRent(formData: FormData) {
	const currency = textOf(formData, "currency") || "$";
	const pen = await openPen("Rent receipt");
	heading(pen, "Rent receipt");
	labeled(pen, "Receipt date", dateOf(formData, "date"));
	labeled(pen, "Landlord", textOf(formData, "landlord"));
	labeled(pen, "Received from", textOf(formData, "tenant"));
	labeled(pen, "Property", textOf(formData, "property"));
	labeled(pen, "Period", textOf(formData, "period"));
	labeled(pen, "Amount", money(currency, amountOf(formData, "amount")));
	labeled(pen, "Payment mode", textOf(formData, "mode"));
	gap(pen);
	paragraph(
		pen,
		"This receipt confirms that the amount above was received for the period stated. It was created in your browser and was not sent to a server.",
	);
	gap(pen, 28);
	paragraph(pen, "Landlord signature: ______________________________");
	return pen.doc.save({ addDefaultPage: false });
}

async function buildSalary(formData: FormData) {
	const currency = textOf(formData, "currency") || "$";
	const basic = amountOf(formData, "basic");
	const hra = amountOf(formData, "hra");
	const allowance = amountOf(formData, "allowance");
	const deduction = amountOf(formData, "deduction");
	const gross = basic + hra + allowance;
	const pen = await openPen("Salary slip");
	heading(pen, "Salary slip");
	labeled(pen, "Employer", textOf(formData, "employer"));
	labeled(pen, "Employee", textOf(formData, "employee"));
	labeled(pen, "Period", textOf(formData, "period"));
	gap(pen);
	rule(pen);
	const widths = [300, 140];
	const row = (label: string, value: number, bold = false) =>
		drawTable(pen, [{ cells: [label, money(currency, value)], bold }], widths);
	row("Basic", basic);
	row("House rent allowance", hra);
	row("Other allowances", allowance);
	row("Gross", gross, true);
	row("Deductions", deduction);
	rule(pen);
	draw(pen, `Net pay: ${money(currency, gross - deduction)}`, 14, {
		bold: true,
	});
	return pen.doc.save({ addDefaultPage: false });
}

function expenseRows(raw: string) {
	const rows: { label: string; amount: number }[] = [];
	for (const line of raw.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed) {
			continue;
		}
		const parts = trimmed.split(",").map((part) => part.trim());
		const amount = readFiniteNumber(parts[parts.length - 1]);
		if (parts.length >= 2 && amount !== undefined) {
			rows.push({
				label: parts.slice(0, -1).join(", "),
				amount,
			});
			continue;
		}
		rows.push({ label: trimmed, amount: amount ?? 0 });
	}
	return rows;
}

async function buildExpense(formData: FormData) {
	const currency = textOf(formData, "currency") || "$";
	const pen = await openPen(textOf(formData, "title") || "Expense report");
	heading(pen, textOf(formData, "title") || "Expense report");
	labeled(pen, "Prepared by", textOf(formData, "name"));
	labeled(pen, "Date", dateOf(formData, "date"));
	gap(pen);
	rule(pen);
	const widths = [360, 120];
	drawTable(pen, [{ cells: ["Description", "Amount"], bold: true }], widths);
	let total = 0;
	for (const row of expenseRows(textOf(formData, "lines"))) {
		total += row.amount;
		drawTable(
			pen,
			[{ cells: [row.label, money(currency, row.amount)] }],
			widths,
		);
	}
	rule(pen);
	draw(pen, `Total: ${money(currency, total)}`, 14, { bold: true });
	return pen.doc.save({ addDefaultPage: false });
}

async function buildResume(formData: FormData) {
	const pen = await openPen(textOf(formData, "name") || "Resume");
	heading(pen, textOf(formData, "name") || "Resume");
	draw(pen, textOf(formData, "role") || "—", 12, { color: MUTED });
	paragraph(
		pen,
		[
			textOf(formData, "email"),
			textOf(formData, "phone"),
			textOf(formData, "location"),
		]
			.filter(Boolean)
			.join("  ·  "),
	);
	gap(pen);
	draw(pen, "Summary", 13, { bold: true });
	paragraph(pen, textOf(formData, "summary"));
	draw(pen, "Experience", 13, { bold: true });
	paragraph(pen, textOf(formData, "experience"));
	draw(pen, "Education", 13, { bold: true });
	paragraph(pen, textOf(formData, "education"));
	draw(pen, "Skills", 13, { bold: true });
	paragraph(pen, textOf(formData, "skills"));
	return pen.doc.save({ addDefaultPage: false });
}

export async function buildGeneratedPdf(
	kind: GenerateKind,
	formData: FormData,
) {
	if (kind === "invoice") {
		return buildInvoice(formData);
	}
	if (kind === "rent") {
		return buildRent(formData);
	}
	if (kind === "salary") {
		return buildSalary(formData);
	}
	if (kind === "expense") {
		return buildExpense(formData);
	}
	return buildResume(formData);
}
