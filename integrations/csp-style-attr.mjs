import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const DIRECTIVE = "style-src-attr 'unsafe-inline'";

function patchHtml(html) {
	return html.replace(
		/(<meta http-equiv="content-security-policy" content=")([^"]*)(")/i,
		(_, open, content, close) => {
			if (content.includes("style-src-attr")) {
				return `${open}${content}${close}`;
			}
			const separator = content.trim().endsWith(";") ? " " : "; ";
			return `${open}${content}${separator}${DIRECTIVE}${close}`;
		},
	);
}

async function htmlFiles(dir, found = []) {
	const entries = await readdir(dir, { withFileTypes: true });
	for (const entry of entries) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			await htmlFiles(path, found);
		} else if (entry.name.endsWith(".html")) {
			found.push(path);
		}
	}
	return found;
}

export function cspStyleAttr() {
	return {
		name: "csp-style-attr",
		hooks: {
			"astro:config:setup": ({ updateConfig }) => {
				updateConfig({
					vite: {
						plugins: [
							{
								name: "csp-style-attr-html",
								transformIndexHtml: {
									order: "post",
									handler(html) {
										return patchHtml(html);
									},
								},
							},
						],
					},
				});
			},
			"astro:build:done": async ({ dir }) => {
				const root = fileURLToPath(dir);
				for (const file of await htmlFiles(root)) {
					const html = await readFile(file, "utf8");
					const next = patchHtml(html);
					if (next !== html) {
						await writeFile(file, next);
					}
				}
			},
		},
	};
}
