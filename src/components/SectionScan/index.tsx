import { useCallback, useEffect, useRef, useState } from "react";

import ButtonFile from "@/lib/ui/ButtonFile";
import Card from "@/lib/ui/Card";
import Dropzone from "@/lib/ui/Dropzone";
import Icon from "@/lib/ui/Icon";
import { toError } from "@/lib/utils/pdf-geometry";
import type { Quad, ScanFilter } from "@/lib/utils/scan";
import {
	type CornerIndex,
	cameraErrorMessage,
	copyQuad,
	FULL_FRAME,
	MAX_SCAN_PAGES,
	moveCorner,
	nextQuarterTurn,
	type Point,
	quadProblem,
	requestRearCamera,
	SCAN_ACCEPT,
	scanFileProblem,
	swapAdjacent,
} from "@/lib/utils/scan";
import { yieldToMain } from "@/lib/utils/schedule";

import ScanCamera from "./camera";
import ScanEditor from "./editor";
import ScanPages, { type ScanPageItem } from "./pages";
import styles from "./styles.module.scss";

type ScanPhase = "idle" | "reading" | "preview" | "saving";

type Draft = {
	id: string;
	file: File;
	url: string;
	corners: Quad;
	editing: boolean;
	pageId?: string;
	note: string | null;
};

function createId() {
	if (globalThis.crypto?.randomUUID) {
		return globalThis.crypto.randomUUID();
	}
	return Math.random().toString(36).slice(2, 10);
}

function releaseUrl(urls: Set<string>, url: string) {
	URL.revokeObjectURL(url);
	urls.delete(url);
}

function phaseMessage(phase: ScanPhase, starting: boolean) {
	if (phase === "reading") {
		return "Reading the photo…";
	}
	if (phase === "preview") {
		return "Updating the preview…";
	}
	if (phase === "saving") {
		return "Saving…";
	}
	if (starting) {
		return "Starting the camera…";
	}
	return null;
}

function acceptScanFiles(files: readonly File[], room: number) {
	const accepted: File[] = [];
	let problem: string | null = null;
	for (const file of files) {
		const next = scanFileProblem(file);
		if (next) {
			problem = next;
			continue;
		}
		accepted.push(file);
	}
	if (accepted.length > room) {
		accepted.splice(Math.max(0, room));
		problem = "You can add up to 30 pages.";
	}
	return { accepted, problem };
}

function scanFlags(input: {
	phase: ScanPhase;
	hasDraft: boolean;
	hasStream: boolean;
	starting: boolean;
	pageCount: number;
}) {
	const busy = input.phase !== "idle" || input.starting;
	const controlsDisabled = busy || input.hasDraft || input.hasStream;
	const showEmpty =
		input.pageCount === 0 && !input.hasDraft && !input.hasStream && !busy;
	const showReset = input.pageCount > 0 || input.hasDraft || input.hasStream;
	const showEditor = input.hasDraft && !input.hasStream;
	return {
		busy,
		controlsDisabled,
		showEmpty,
		showReset,
		showEditor,
		message: phaseMessage(input.phase, input.starting),
	};
}

function pageFilter(pages: readonly ScanPageItem[], draft: Draft): ScanFilter {
	if (!draft.pageId) {
		return "original";
	}
	const existing = pages.find((page) => page.id === draft.pageId);
	return existing?.filter ?? "original";
}

function pageStillThere(pages: readonly ScanPageItem[], draft: Draft) {
	if (!draft.editing) {
		return true;
	}
	return pages.some((page) => page.id === draft.pageId);
}

function replaceEditedPage(
	page: ScanPageItem,
	draft: Draft,
	corners: Quad,
	previewUrl: string,
	urls: Set<string>,
) {
	if (page.id !== draft.pageId) {
		return page;
	}
	releaseUrl(urls, page.previewUrl);
	return { ...page, corners, previewUrl, file: draft.file };
}

function placePreview(
	pages: readonly ScanPageItem[],
	draft: Draft,
	corners: Quad,
	filter: ScanFilter,
	previewUrl: string,
	urls: Set<string>,
	existed: boolean,
): { pages: ScanPageItem[] } | { error: string } {
	if (draft.editing) {
		if (!existed) {
			releaseUrl(urls, previewUrl);
			return { error: "That page is no longer in the list." };
		}
		return {
			pages: pages.map((page) =>
				replaceEditedPage(page, draft, corners, previewUrl, urls),
			),
		};
	}
	if (pages.length >= MAX_SCAN_PAGES) {
		releaseUrl(urls, previewUrl);
		return { error: "You can add up to 30 pages." };
	}
	return {
		pages: [
			...pages,
			{
				id: createId(),
				file: draft.file,
				corners,
				rotation: 0,
				filter,
				previewUrl,
			},
		],
	};
}

async function bakePreview(
	file: File,
	corners: Quad,
	filter: ScanFilter,
	urls: Set<string>,
	isCurrent: () => boolean,
) {
	const { renderScanPreview } = await import("@/lib/utils/scan-raster");
	const blob = await renderScanPreview(file, corners, filter);
	if (!isCurrent()) {
		return null;
	}
	const previewUrl = URL.createObjectURL(blob);
	urls.add(previewUrl);
	return previewUrl;
}

function ScanStatus(props: {
	message: string | null;
	notice: string | undefined;
	error: string | undefined;
}) {
	return (
		<>
			{props.message ? (
				<output aria-live="polite" aria-busy="true">
					{props.message}
				</output>
			) : null}
			{props.notice ? <output aria-live="polite">{props.notice}</output> : null}
			{props.error ? (
				<div role="alert" style={{ color: "var(--pico-del-color)" }}>
					{props.error}
				</div>
			) : null}
		</>
	);
}

function ScanToolbar(props: {
	controlsDisabled: boolean;
	starting: boolean;
	saving: boolean;
	hasPages: boolean;
	showReset: boolean;
	resetDisabled: boolean;
	captureRef: { current: HTMLInputElement | null };
	onSave: () => void;
	onUseCamera: () => void;
	onFiles: (files: File[]) => void;
	onReset: () => void;
	onCloseCamera: () => void;
}) {
	return (
		<div className={styles.toolbar}>
			<button
				type="button"
				onClick={props.onSave}
				disabled={props.controlsDisabled}
			>
				{props.saving ? "Saving…" : "Save & Download"}
			</button>
			<button
				type="button"
				onClick={props.onUseCamera}
				disabled={props.controlsDisabled}
			>
				Use camera
			</button>
			<ButtonFile
				accept={SCAN_ACCEPT}
				capture="environment"
				disabled={props.controlsDisabled}
				onChange={props.onFiles}
				inputRef={props.captureRef}
			>
				Add an image
			</ButtonFile>
			{props.hasPages ? (
				<ButtonFile
					accept={SCAN_ACCEPT}
					multiple
					disabled={props.controlsDisabled}
					onChange={props.onFiles}
				>
					Add images
				</ButtonFile>
			) : null}
			{props.showReset ? (
				<button
					type="button"
					className="secondary"
					onClick={props.onReset}
					disabled={props.resetDisabled}
				>
					Reset
				</button>
			) : null}
			{props.starting ? (
				<button
					type="button"
					className="secondary"
					onClick={props.onCloseCamera}
				>
					Close camera
				</button>
			) : null}
		</div>
	);
}

export default function SectionScan() {
	const [pages, setPages] = useState<ScanPageItem[]>([]);
	const [draft, setDraft] = useState<Draft | null>(null);
	const [phase, setPhase] = useState<ScanPhase>("idle");
	const [error, setError] = useState<string | undefined>(undefined);
	const [notice, setNotice] = useState<string | undefined>(undefined);
	const [stream, setStream] = useState<MediaStream | null>(null);
	const [starting, setStarting] = useState(false);
	const pagesRef = useRef(pages);
	const draftRef = useRef(draft);
	const phaseRef = useRef(phase);
	const streamRef = useRef(stream);
	const startingRef = useRef(starting);
	const queueRef = useRef<File[]>([]);
	const batchRef = useRef({ seen: 0, total: 0 });
	const urlsRef = useRef(new Set<string>());
	const generationRef = useRef(0);
	const bakeToken = useRef(0);
	const drainRef = useRef(false);
	const cameraTicket = useRef(0);
	const captureRef = useRef<HTMLInputElement>(null);
	const drainQueueRef = useRef<() => Promise<void>>(async () => {});

	pagesRef.current = pages;
	draftRef.current = draft;
	phaseRef.current = phase;
	streamRef.current = stream;
	startingRef.current = starting;

	const setPhaseNow = useCallback((next: ScanPhase) => {
		phaseRef.current = next;
		setPhase(next);
	}, []);

	const setDraftNow = useCallback((next: Draft | null) => {
		draftRef.current = next;
		setDraft(next);
	}, []);

	const commitPages = useCallback((next: ScanPageItem[]) => {
		pagesRef.current = next;
		setPages(next);
	}, []);

	const stopStream = useCallback((next: MediaStream | null) => {
		next?.getTracks().forEach((track) => {
			track.stop();
		});
	}, []);

	const stopCamera = useCallback(() => {
		cameraTicket.current += 1;
		startingRef.current = false;
		setStarting(false);
		const current = streamRef.current;
		streamRef.current = null;
		setStream(null);
		stopStream(current);
	}, [stopStream]);

	useEffect(() => {
		const urls = urlsRef.current;
		return () => {
			generationRef.current += 1;
			cameraTicket.current += 1;
			stopStream(streamRef.current);
			for (const url of urls) {
				URL.revokeObjectURL(url);
			}
			urls.clear();
		};
	}, [stopStream]);

	const openFile = useCallback(
		async (file: File, countInBatch: boolean) => {
			const problem = scanFileProblem(file);
			if (problem) {
				setError(problem);
				return false;
			}
			if (pagesRef.current.length >= MAX_SCAN_PAGES) {
				setError("You can add up to 30 pages.");
				return false;
			}
			const url = URL.createObjectURL(file);
			urlsRef.current.add(url);
			const generation = generationRef.current;
			setPhaseNow("reading");
			setNotice(undefined);
			await yieldToMain();
			if (generation !== generationRef.current) {
				releaseUrl(urlsRef.current, url);
				return false;
			}
			try {
				const { measureImage } = await import("@/lib/utils/scan-raster");
				await measureImage(url);
				if (generation !== generationRef.current) {
					releaseUrl(urlsRef.current, url);
					return false;
				}
				if (countInBatch) {
					batchRef.current = {
						seen: batchRef.current.seen + 1,
						total: batchRef.current.total,
					};
				}
				const remaining = queueRef.current.length;
				const note =
					countInBatch && remaining > 0
						? `Photo ${batchRef.current.seen}. ${remaining} more after this one.`
						: null;
				setDraftNow({
					id: createId(),
					file,
					url,
					corners: copyQuad(FULL_FRAME),
					editing: false,
					note,
				});
				setPhaseNow("idle");
				return true;
			} catch (caught) {
				releaseUrl(urlsRef.current, url);
				if (generation !== generationRef.current) {
					return false;
				}
				setPhaseNow("idle");
				setError(toError(caught).message);
				return false;
			}
		},
		[setDraftNow, setPhaseNow],
	);

	const drainQueue = useCallback(async () => {
		if (drainRef.current) {
			return;
		}
		drainRef.current = true;
		const generation = generationRef.current;
		try {
			while (queueRef.current.length > 0) {
				if (generation !== generationRef.current) {
					return;
				}
				if (
					draftRef.current ||
					streamRef.current ||
					startingRef.current ||
					phaseRef.current !== "idle"
				) {
					return;
				}
				const file = queueRef.current.shift();
				if (!file) {
					return;
				}
				const opened = await openFile(file, true);
				if (opened) {
					return;
				}
			}
		} finally {
			drainRef.current = false;
		}
	}, [openFile]);

	drainQueueRef.current = drainQueue;

	const onFiles = useCallback((files: File[]) => {
		if (files.length === 0) {
			return;
		}
		const pending = draftRef.current && !draftRef.current.editing ? 1 : 0;
		const room = Math.max(
			0,
			MAX_SCAN_PAGES -
				pagesRef.current.length -
				pending -
				queueRef.current.length,
		);
		const { accepted, problem } = acceptScanFiles(files, room);
		if (problem) {
			setError(problem);
		} else {
			setError(undefined);
		}
		if (accepted.length === 0) {
			return;
		}
		const fresh = queueRef.current.length === 0 && !draftRef.current;
		batchRef.current = fresh
			? { seen: 0, total: accepted.length }
			: {
					seen: batchRef.current.seen,
					total: batchRef.current.total + accepted.length,
				};
		queueRef.current.push(...accepted);
		if (
			!draftRef.current &&
			!streamRef.current &&
			!startingRef.current &&
			phaseRef.current === "idle"
		) {
			void drainQueueRef.current();
		}
	}, []);

	const onUseCamera = useCallback(async () => {
		if (
			phaseRef.current !== "idle" ||
			draftRef.current ||
			streamRef.current ||
			startingRef.current
		) {
			return;
		}
		setNotice(undefined);
		if (
			!globalThis.isSecureContext ||
			typeof navigator.mediaDevices?.getUserMedia !== "function"
		) {
			setError("The camera is unavailable. Add an image instead.");
			captureRef.current?.click();
			return;
		}
		const ticket = cameraTicket.current + 1;
		cameraTicket.current = ticket;
		startingRef.current = true;
		setStarting(true);
		try {
			const next = await requestRearCamera();
			if (ticket !== cameraTicket.current) {
				stopStream(next);
				return;
			}
			streamRef.current = next;
			setStream(next);
			setError(undefined);
		} catch (caught) {
			if (ticket === cameraTicket.current) {
				setError(cameraErrorMessage(caught));
			}
		} finally {
			if (ticket === cameraTicket.current) {
				startingRef.current = false;
				setStarting(false);
			}
		}
	}, [stopStream]);

	const onCapture = useCallback(
		(file: File) => {
			stopCamera();
			void openFile(file, false);
		},
		[openFile, stopCamera],
	);

	const onCloseCamera = useCallback(() => {
		stopCamera();
		void drainQueue();
	}, [drainQueue, stopCamera]);

	const onConfirm = useCallback(async () => {
		const current = draftRef.current;
		if (
			!current ||
			phaseRef.current !== "idle" ||
			quadProblem(current.corners)
		) {
			return;
		}
		const generation = generationRef.current;
		const token = bakeToken.current + 1;
		bakeToken.current = token;
		setPhaseNow("preview");
		setNotice(undefined);
		await yieldToMain();
		if (generation !== generationRef.current || token !== bakeToken.current) {
			return;
		}
		try {
			const existed = pageStillThere(pagesRef.current, current);
			const filter = pageFilter(pagesRef.current, current);
			const corners = copyQuad(current.corners);
			const previewUrl = await bakePreview(
				current.file,
				corners,
				filter,
				urlsRef.current,
				() =>
					generation === generationRef.current && token === bakeToken.current,
			);
			if (!previewUrl) {
				return;
			}
			const placed = placePreview(
				pagesRef.current,
				current,
				corners,
				filter,
				previewUrl,
				urlsRef.current,
				existed,
			);
			if ("error" in placed) {
				setPhaseNow("idle");
				setError(placed.error);
				return;
			}
			commitPages(placed.pages);
			releaseUrl(urlsRef.current, current.url);
			setDraftNow(null);
			setError(undefined);
			setPhaseNow("idle");
			void drainQueue();
		} catch (caught) {
			if (generation !== generationRef.current) {
				return;
			}
			const next = toError(caught);
			console.error(next);
			setPhaseNow("idle");
			setError(next.message);
		}
	}, [commitPages, drainQueue, setDraftNow, setPhaseNow]);

	const rebake = useCallback(
		async (
			pageId: string,
			file: File,
			corners: Quad,
			filter: ScanFilter,
			previous: ScanFilter,
		) => {
			const generation = generationRef.current;
			const token = bakeToken.current + 1;
			bakeToken.current = token;
			setPhaseNow("preview");
			setNotice(undefined);
			await yieldToMain();
			if (generation !== generationRef.current || token !== bakeToken.current) {
				return;
			}
			try {
				const { renderScanPreview } = await import("@/lib/utils/scan-raster");
				const blob = await renderScanPreview(file, corners, filter);
				if (
					generation !== generationRef.current ||
					token !== bakeToken.current
				) {
					return;
				}
				const previewUrl = URL.createObjectURL(blob);
				urlsRef.current.add(previewUrl);
				const page = pagesRef.current.find((item) => item.id === pageId);
				if (!page) {
					releaseUrl(urlsRef.current, previewUrl);
					setPhaseNow("idle");
					return;
				}
				releaseUrl(urlsRef.current, page.previewUrl);
				commitPages(
					pagesRef.current.map((item) =>
						item.id === pageId ? { ...item, filter, previewUrl } : item,
					),
				);
				setPhaseNow("idle");
			} catch (caught) {
				if (
					generation !== generationRef.current ||
					token !== bakeToken.current
				) {
					return;
				}
				const next = toError(caught);
				console.error(next);
				commitPages(
					pagesRef.current.map((item) =>
						item.id === pageId ? { ...item, filter: previous } : item,
					),
				);
				setPhaseNow("idle");
				setError(next.message);
			}
		},
		[commitPages, setPhaseNow],
	);

	const onSkip = useCallback(() => {
		const current = draftRef.current;
		if (!current || current.editing || phaseRef.current !== "idle") {
			return;
		}
		releaseUrl(urlsRef.current, current.url);
		setDraftNow(null);
		void drainQueue();
	}, [drainQueue, setDraftNow]);

	const onCancel = useCallback(() => {
		const current = draftRef.current;
		if (!current || phaseRef.current !== "idle") {
			return;
		}
		releaseUrl(urlsRef.current, current.url);
		setDraftNow(null);
	}, [setDraftNow]);

	const onCorner = useCallback(
		(index: CornerIndex, point: Point) => {
			const current = draftRef.current;
			if (!current || phaseRef.current !== "idle") {
				return;
			}
			setDraftNow({
				...current,
				corners: moveCorner(current.corners, index, point),
			});
		},
		[setDraftNow],
	);

	const onAdjust = useCallback(
		(pageId: string) => {
			if (
				phaseRef.current !== "idle" ||
				draftRef.current ||
				streamRef.current ||
				startingRef.current
			) {
				return;
			}
			const page = pagesRef.current.find((item) => item.id === pageId);
			if (!page) {
				return;
			}
			const url = URL.createObjectURL(page.file);
			urlsRef.current.add(url);
			setDraftNow({
				id: createId(),
				file: page.file,
				url,
				corners: copyQuad(page.corners),
				editing: true,
				pageId: page.id,
				note: null,
			});
		},
		[setDraftNow],
	);

	const onFilter = useCallback(
		(pageId: string, filter: ScanFilter) => {
			const page = pagesRef.current.find((item) => item.id === pageId);
			if (!page || page.filter === filter || phaseRef.current !== "idle") {
				return;
			}
			const previous = page.filter;
			commitPages(
				pagesRef.current.map((item) =>
					item.id === pageId ? { ...item, filter } : item,
				),
			);
			void rebake(pageId, page.file, page.corners, filter, previous);
		},
		[commitPages, rebake],
	);

	const onSave = useCallback(async () => {
		if (
			phaseRef.current !== "idle" ||
			draftRef.current ||
			streamRef.current ||
			startingRef.current
		) {
			return;
		}
		const current = pagesRef.current.slice();
		if (current.length === 0) {
			setNotice(undefined);
			setError("Add a page before saving.");
			return;
		}
		const generation = generationRef.current;
		setPhaseNow("saving");
		setError(undefined);
		setNotice(undefined);
		await yieldToMain();
		if (generation !== generationRef.current) {
			return;
		}
		try {
			const [{ renderScanExport }, { buildScanPdf }, download] =
				await Promise.all([
					import("@/lib/utils/scan-raster"),
					import("@/lib/utils/scan-pdf"),
					import("@/lib/utils/download"),
				]);
			const jpegs: Uint8Array[] = [];
			for (const page of current) {
				await yieldToMain();
				if (generation !== generationRef.current) {
					return;
				}
				jpegs.push(
					await renderScanExport(
						page.file,
						page.corners,
						page.filter,
						page.rotation,
					),
				);
			}
			const bytes = await buildScanPdf(jpegs);
			if (generation !== generationRef.current) {
				return;
			}
			download.downloadBlob(
				download.pdfBytesToBlob(bytes),
				`scan-${Date.now().toString(36)}.pdf`,
			);
			setPhaseNow("idle");
			setNotice("Saved. The download has started.");
		} catch (caught) {
			const next = toError(caught);
			console.error(next);
			if (generation !== generationRef.current) {
				return;
			}
			setPhaseNow("idle");
			setError(next.message);
		}
	}, [setPhaseNow]);

	const onReset = useCallback(() => {
		if (phaseRef.current !== "idle" || startingRef.current) {
			return;
		}
		generationRef.current += 1;
		bakeToken.current += 1;
		stopCamera();
		queueRef.current = [];
		batchRef.current = { seen: 0, total: 0 };
		const currentDraft = draftRef.current;
		if (currentDraft) {
			releaseUrl(urlsRef.current, currentDraft.url);
		}
		setDraftNow(null);
		for (const page of pagesRef.current) {
			releaseUrl(urlsRef.current, page.previewUrl);
		}
		commitPages([]);
		setError(undefined);
		setNotice(undefined);
	}, [commitPages, setDraftNow, stopCamera]);

	const flags = scanFlags({
		phase,
		hasDraft: draft !== null,
		hasStream: stream !== null,
		starting,
		pageCount: pages.length,
	});

	return (
		<section className={styles.section} aria-busy={flags.busy}>
			<ScanStatus message={flags.message} notice={notice} error={error} />
			{stream ? (
				<ScanCamera
					stream={stream}
					onCapture={onCapture}
					onError={setError}
					onClose={onCloseCamera}
				/>
			) : (
				<ScanToolbar
					controlsDisabled={flags.controlsDisabled}
					starting={starting}
					saving={phase === "saving"}
					hasPages={pages.length > 0}
					showReset={flags.showReset}
					resetDisabled={flags.busy}
					captureRef={captureRef}
					onSave={() => {
						void onSave();
					}}
					onUseCamera={() => {
						void onUseCamera();
					}}
					onFiles={onFiles}
					onReset={onReset}
					onCloseCamera={stopCamera}
				/>
			)}
			{flags.showEditor && draft ? (
				<ScanEditor
					key={draft.id}
					url={draft.url}
					corners={draft.corners}
					problem={quadProblem(draft.corners)}
					note={draft.note}
					confirmLabel={draft.editing ? "Update crop" : "Use this photo"}
					busy={phase !== "idle"}
					showSkip={!draft.editing}
					onCorner={onCorner}
					onConfirm={() => {
						void onConfirm();
					}}
					onSkip={onSkip}
					onCancel={onCancel}
					onImageError={() => {
						setError("This photo could not be read.");
					}}
				/>
			) : null}
			{flags.showEmpty ? (
				<Dropzone
					className={styles.drop}
					accept={SCAN_ACCEPT}
					multiple
					label="Add images"
					disabled={flags.controlsDisabled}
					onChange={onFiles}
				>
					<Card>
						<Icon
							icon="camera"
							width={32}
							height={32}
							title="Scan"
							decorative
						/>
						<p>Use the camera, or add JPEG, PNG, or WebP images.</p>
					</Card>
				</Dropzone>
			) : null}
			{pages.length > 0 ? (
				<ScanPages
					pages={pages}
					disabled={flags.controlsDisabled}
					onMove={(index, delta) => {
						const next = swapAdjacent(pagesRef.current, index, delta);
						if (next !== pagesRef.current) {
							commitPages([...next]);
						}
					}}
					onRotate={(pageId) => {
						commitPages(
							pagesRef.current.map((page) =>
								page.id === pageId
									? { ...page, rotation: nextQuarterTurn(page.rotation) }
									: page,
							),
						);
					}}
					onRemove={(pageId) => {
						const page = pagesRef.current.find((item) => item.id === pageId);
						if (!page) {
							return;
						}
						releaseUrl(urlsRef.current, page.previewUrl);
						commitPages(pagesRef.current.filter((item) => item.id !== pageId));
					}}
					onAdjust={onAdjust}
					onFilter={onFilter}
				/>
			) : null}
		</section>
	);
}
