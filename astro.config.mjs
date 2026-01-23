import preact from "@astrojs/preact";
import sitemap from "@astrojs/sitemap";

import { defineConfig } from "astro/config";
import { loadEnv } from "vite";

const { PUBLIC_SITE_URL } = loadEnv(process.env.NODE_ENV, process.cwd(), "");

export default defineConfig({
	site: PUBLIC_SITE_URL,
	integrations: [preact({ compat: true }), sitemap()],
	trailingSlash: "never",
});
