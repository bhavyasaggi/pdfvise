import React, { useCallback, useState } from "react";
import Card from "@/lib/ui/Card";
import Dropzone from "@/lib/ui/Dropzone";
import Icon from "@/lib/ui/Icon";
import type { PDFManagerStoreType } from "@/lib/ui/PDFManager";
import SuspenseErrorBoundary from "@/lib/ui/SuspenseErrorBoundary";

const SectionPDFPages = React.lazy(() => import("./index"));

const fallback = (error?: Error) => {
	return (
		<Card style={{ minHeight: "240px" }}>
			{error ? (
				<div style={{ color: "var(--pico-del-color)" }}>
					<Icon icon="alert-octagon" height={24} width={24} title="Error" />
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
				<div aria-busy="true">
					<Icon icon="loader" height={24} width={24} title="Loading..." />
					<br />
					<span>Loading ...</span>
				</div>
			)}
		</Card>
	);
};

export default function SectionPDFPagesLazy() {
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
		setMeta((prev) => ({ ...prev, loading: true }));
		try {
			const { parsePDFDocument } = await import("@/lib/utils/pdf");
			const filesData = await Promise.all(
				files.map((file) => parsePDFDocument(file)),
			);
			const data = filesData.reduce((acc, fileData, index) => {
				acc[fileData.id] = {
					file: files[index],
					pdfDocument: fileData.pdfDocument,
					pdfDocumentProxy: fileData.pdfDocumentProxy,
				};
				return acc;
			}, {} as PDFManagerStoreType);
			setMeta((prev) => ({ ...prev, data, loading: false }));
		} catch (error) {
			setMeta((prev) => ({ ...prev, loading: false, error: error as Error }));
		}
	}, []);

	return (
		<SuspenseErrorBoundary fallback={fallback}>
			{meta.loading ? fallback() : null}
			{!meta.loading && meta.error ? fallback(meta.error) : null}
			{!meta.loading && !meta.error && meta.data ? (
				<SectionPDFPages initStore={meta.data} />
			) : null}
			{!meta.loading && !meta.error && !meta.data ? (
				<Dropzone onChange={updateInitStore}>
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
								/>
								&nbsp;
								<span>
									Click to <strong>Add Files</strong>
								</span>
							</div>
							<small>
								or
								<em>Drag & Drop files</em> here
							</small>
						</div>
					</Card>
				</Dropzone>
			) : null}
		</SuspenseErrorBoundary>
	);
}
