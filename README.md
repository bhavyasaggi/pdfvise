# PDFvise

Browser tools for everyday PDF work, published at [pdfvise.com](https://pdfvise.com). Files are read and written on the device. Bhavya Saggi. License: AGPL-3.0-only (`LICENSE`).

## Run

Node `>=22` and Yarn `1.22.22` (the `packageManager` field in `package.json`).

```bash
yarn
yarn dev
yarn check
yarn build && yarn preview
```

`yarn dev` is the Astro dev server. `PUBLIC_SITE_URL` in `.env.development` and `.env.production` is the `site` value for canonical URLs and the sitemap.

`yarn check` runs Biome, `astro check`, and the Node tests in `src/lib/utils`. Husky runs Biome on staged files.

## Considerations

Static Astro site. Tools are Preact (React compat), styled with Pico CSS. `pdf-lib` writes documents, `pdfjs-dist` reads and paints them, and JSZip packs a multi-file download.

Processing stays in the browser. The site stays static: a tool has no upload, no account, and no server runtime.

Page tools share one imposition pipeline (`src/lib/pdf-tools.ts`, `src/lib/utils/pdf-impose.ts`). A new page tool is a preset of that pipeline. A page is a ribbon, the tool, a short how-to, and an FAQ. The nav is `src/json/nav-links.json`.

Scan PDF (`/pdf-scan`) builds a PDF from camera photos or images. You place four corners, the page is flattened in the browser, and the download is a picture of each page.

TypeScript extends `astro/tsconfigs/strict`, plus the flags in `tsconfig.json`. Biome uses tabs and double quotes. Dependencies stay small. An OCR runtime, a barcode package, or another PDF engine waits until a published tool needs it, and it has to run in the browser.

Unpublished routes set `Astro.response.status = 503`, `noindex`, and stay out of `nav-links.json` and out of the sitemap filter in `astro.config.mjs`. A static host can still return those HTML files with status 200. Leave the 503 in the page source so dev reports them as unavailable.

Astro emits a Content-Security-Policy meta tag (`experimental.csp` in `astro.config.mjs`). It allows the PDF.js worker and Wasm. `style-src-attr` stays `'unsafe-inline'` because pages use style attributes. `frame-ancestors` is not valid in a meta policy, so the host should also send `Content-Security-Policy: frame-ancestors 'none'` and `X-Content-Type-Options: nosniff`.

A single PDF can be up to 100 MB. `public/sw.js` is empty and is not registered. Imports in `src` stay extensionless. Tests load TypeScript through `scripts/register-ts.mjs`.

## Known limitations

`/pdf-crop-shipping-label-*` (Ajio, Amazon, Flipkart, GlowRoad, JioMart, LimeRoad, Meesho, Myntra, Shopsy, Snapdeal) and `/pdf-generate-qr-barcode` are coming-soon pages. They are reachable by URL only.

Seller label layouts differ by marketplace and change over time. This repo has no label fixture from an account it controls, so those routes have no crop preset. Coordinates published elsewhere, including other crop sites, stay out of the presets.

PDF Crop applies one inset on every page, stacked on any crop the file already has. A uniform margin, an absolute crop box, and a detected label region are different operations. This tool is the uniform margin.

Extract Text (`/extract-text-ocr-from-pdf`) reads the text layer already in the file. A scanned page with no text layer is empty in the download. The path still says `ocr`.

Scan PDF does not find the page on its own and does not read text off the photo.

Letterhead and watermark draw a line of text. Page cards can be reordered with earlier/later buttons or by dragging. There is no page preview beyond the thumbnail.

pdf-lib still saves on the main thread. The loading state is painted first, and PDF.js parses on a worker. A large file can still pause the tab during save.

Tests cover geometry and imposition. They leave the pages untested. The pre-commit hook runs Biome and does not run `astro check`.

## Inspiration / prior art

N-up and zine follow the imposition style of [Sejda](https://www.sejda.com/) and [pdfimpose](https://www.pdfimpose.it/).

The shipping-label routes follow marketplace crop tools, including [pdfcropper.in](https://www.pdfcropper.in/). Their behavior was reviewed and their crop boxes were left behind: several of those flows upload the PDF, and the boxes track a layout sellers later change. Seller help describes print sizes, such as a thermal label beside an A4 invoice, and does not include a dummy label this project can vendor.

`pdf-lib` and PDF.js are the libraries the tools are built on.

Scan PDF follows the capture, crop, and filter flow of [scan](https://github.com/addyosmani/scan) and [FairScan](https://github.com/pynicolas/FairScan). It does not port their code.

## Future work

Shipping-label presets, one marketplace at a time, after a fixture from an account this project controls. Redact the buyer before committing the file. Crop the label as vectors. A PDF found on the public web is someone else's order, and it is outside this repo's sample data. Revisit a preset when that marketplace changes the label.

QR and barcode PDFs, with a small in-browser encoder drawn through `pdf-lib`.

Text recognition for scans, by painting the page in the browser and reading that image. The extract-text path can drop `ocr` once the behavior and the URL agree.

Move imposition off the main thread. Letterhead from an embedded image, and a page preview larger than the thumbnail.
