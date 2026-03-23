import preact from "@astrojs/preact";
import sitemap from "@astrojs/sitemap";

import { defineConfig } from "astro/config";
import { loadEnv } from "vite";
import { cspStyleAttr } from "./integrations/csp-style-attr.mjs";

const { PUBLIC_SITE_URL } = loadEnv(process.env.NODE_ENV, process.cwd(), "");

export default defineConfig({
	site: PUBLIC_SITE_URL,
	integrations: [
		preact({
			compat: true,
			devtools: process.env.NODE_ENV === "development",
		}),
		sitemap({
			filter: (page) =>
				!page.includes("shipping-label") && !page.includes("qr-barcode"),
		}),
		cspStyleAttr(),
	],
	trailingSlash: "never",
	experimental: {
		csp: {
			scriptDirective: {
				resources: ["'self'", "'wasm-unsafe-eval'"],
			},
			styleDirective: {
				resources: ["'self'", "'unsafe-inline'"],
			},
			directives: [
				"default-src 'self'",
				"img-src 'self' blob: data:",
				"font-src 'self'",
				"connect-src 'self'",
				"worker-src 'self' blob:",
				"object-src 'none'",
				"base-uri 'self'",
				"form-action 'self'",
			],
		},
	},
});
