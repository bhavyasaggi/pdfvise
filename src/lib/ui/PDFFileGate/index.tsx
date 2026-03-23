import type { ReactNode } from "react";
import { useCallback, useState } from "react";

import Card from "@/lib/ui/Card";
import Dropzone from "@/lib/ui/Dropzone";
import Icon from "@/lib/ui/Icon";
import type { PDFManagerStoreType } from "@/lib/ui/PDFManager";
import SuspenseErrorBoundary from "@/lib/ui/SuspenseErrorBoundary";
import { toError } from "@/lib/utils/pdf-geometry";
import { yieldToMain } from "@/lib/utils/schedule";

function fallback(error?: Error) {
	return (
		<Card style={{ minHeight: "240px" }}>
			{error ? (
				<div role="alert" style={{ color: "var(--pico-del-color)" }}>
					<Icon
						icon="alert-octagon"
						height={24}
						width={24}
						title="Error"
						decorative
					/>
					<div>
						<strong>{error.name || "Error"}</strong>
						{error.message ? (
							<>
								<br />
								<small>{error.message}</small>
							</>
						) : null}
					</div>
					<button
						type="button"
						onClick={() => {
							globalThis.location.reload();
						}}
						style={{ margin: "var(--pico-spacing)" }}
					>
						Reload & Retry
					</button>
				</div>
			) : (
				<output aria-live="polite" aria-busy="true">
					<Icon
						icon="loader"
						height={24}
						width={24}
						title="Loading"
						decorative
					/>
					<br />
					<span>Loading ...</span>
				</output>
			)}
		</Card>
	);
}

export default function PDFFileGate(props: {
	children: (store: PDFManagerStoreType) => ReactNode;
}) {
	const [meta, setMeta] = useState<{
		data: PDFManagerStoreType | undefined;
		loading: boolean;
		error: Error | undefined;
	}>({
		data: undefined,
		loading: false,
		error: undefined,
	});

	const updateInitStore = useCallback(async (files: File[]) => {
		if (files.length === 0) {
			return;
		}
		setMeta((prev) => ({ ...prev, loading: true, error: undefined }));
		await yieldToMain();
		try {
			const { parsePDFDocument } = await import("@/lib/utils/pdf");
			const filesData = await Promise.all(
				files.map((file) => parsePDFDocument(file)),
			);
			const data: PDFManagerStoreType = {};
			for (const fileData of filesData) {
				data[fileData.id] = {
					file: fileData.file,
					pdfDocument: fileData.pdfDocument,
					pdfDocumentProxy: fileData.pdfDocumentProxy,
				};
			}
			setMeta({ data, loading: false, error: undefined });
		} catch (error) {
			setMeta({
				data: undefined,
				loading: false,
				error: toError(error),
			});
		}
	}, []);

	return (
		<SuspenseErrorBoundary fallback={fallback}>
			{meta.loading ? fallback() : null}
			{!meta.loading && meta.error ? fallback(meta.error) : null}
			{!meta.loading && !meta.error && meta.data
				? props.children(meta.data)
				: null}
			{!meta.loading && !meta.error && !meta.data ? (
				<Dropzone disabled={meta.loading} onChange={updateInitStore}>
					<Card className="hover" style={{ minHeight: "240px" }}>
						<div style={{ margin: "auto", cursor: "pointer" }}>
							<div
								style={{
									display: "flex",
									placeItems: "center",
									padding: "var(--pico-spacing)",
									background: "var(--pico-primary-background)",
									color: "var(--pico-primary-inverse)",
								}}
							>
								<Icon
									icon="file-plus"
									height={24}
									width={24}
									title="Add File"
									decorative
								/>
								&nbsp;
								<span>
									Click to <strong>Add Files</strong>
								</span>
							</div>
							<small>
								or <em>drag and drop PDF files</em> here
							</small>
						</div>
					</Card>
				</Dropzone>
			) : null}
		</SuspenseErrorBoundary>
	);
}
