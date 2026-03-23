import Icon from "@/lib/ui/Icon";
import type { QuarterTurn } from "@/lib/utils/pdf-geometry";
import {
	isScanFilter,
	type Quad,
	SCAN_FILTERS,
	type ScanFilter,
} from "@/lib/utils/scan";

import styles from "./styles.module.scss";

export type ScanPageItem = {
	id: string;
	file: File;
	corners: Quad;
	rotation: QuarterTurn;
	filter: ScanFilter;
	previewUrl: string;
};

export default function ScanPages(props: {
	pages: readonly ScanPageItem[];
	disabled: boolean;
	onMove: (index: number, delta: -1 | 1) => void;
	onRotate: (pageId: string) => void;
	onRemove: (pageId: string) => void;
	onAdjust: (pageId: string) => void;
	onFilter: (pageId: string, filter: ScanFilter) => void;
}) {
	return (
		<ul className={styles.pages}>
			{props.pages.map((page, index) => (
				<li key={page.id} className={styles.card}>
					<figure className={styles.figure}>
						<img
							src={page.previewUrl}
							alt={`Scanned page ${index + 1}`}
							className={styles.preview}
							style={{ transform: `rotate(${page.rotation}deg)` }}
						/>
						<figcaption className={styles.caption}>Page {index + 1}</figcaption>
					</figure>
					<label className={styles.filter}>
						Filter
						<select
							aria-label={`Filter for scanned page ${index + 1}`}
							value={page.filter}
							disabled={props.disabled}
							onChange={(event) => {
								const target = event.currentTarget;
								if (!(target instanceof HTMLSelectElement)) {
									return;
								}
								if (!isScanFilter(target.value)) {
									return;
								}
								props.onFilter(page.id, target.value);
							}}
						>
							{SCAN_FILTERS.map((filter) => (
								<option key={filter.id} value={filter.id}>
									{filter.label}
								</option>
							))}
						</select>
					</label>
					<button
						type="button"
						className={`secondary ${styles.adjust}`}
						disabled={props.disabled}
						onClick={() => {
							props.onAdjust(page.id);
						}}
					>
						Adjust crop
					</button>
					<div className={styles.iconRow}>
						<button
							type="button"
							className="outline secondary"
							aria-label="Move earlier"
							disabled={props.disabled || index === 0}
							onClick={() => {
								props.onMove(index, -1);
							}}
						>
							<Icon
								icon="chevron-up"
								height={16}
								width={16}
								title="Move earlier"
								decorative
							/>
						</button>
						<button
							type="button"
							className="outline secondary"
							aria-label="Move later"
							disabled={props.disabled || index === props.pages.length - 1}
							onClick={() => {
								props.onMove(index, 1);
							}}
						>
							<Icon
								icon="chevron-down"
								height={16}
								width={16}
								title="Move later"
								decorative
							/>
						</button>
						<button
							type="button"
							className="outline secondary"
							aria-label="Rotate"
							disabled={props.disabled}
							onClick={() => {
								props.onRotate(page.id);
							}}
						>
							<Icon
								icon="rotate-cw"
								height={16}
								width={16}
								title="Rotate"
								decorative
							/>
						</button>
						<button
							type="button"
							className={`outline secondary ${styles.remove}`}
							aria-label="Remove"
							disabled={props.disabled}
							onClick={() => {
								props.onRemove(page.id);
							}}
						>
							<Icon
								icon="trash-2"
								height={16}
								width={16}
								title="Remove"
								decorative
							/>
						</button>
					</div>
				</li>
			))}
		</ul>
	);
}
