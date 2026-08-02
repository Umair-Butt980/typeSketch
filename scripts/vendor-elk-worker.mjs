import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Copy ELK's worker script into `public/` so the browser can load it by URL.
 *
 * It cannot simply be imported. `elk.bundled.js` reaches for its worker with an
 * internal browserify `require('./elk-worker.min.js')`, and Turbopack resolves
 * that to the real file and inlines it — but that file, evaluated on its own,
 * exports no `Worker`, so ELK throws "_Worker is not a constructor" the moment
 * it tries to lay anything out.
 *
 * Serving it as a plain asset sidesteps bundler interop entirely: the URL is
 * fetched at runtime, so there is nothing for a bundler to rewrite.
 *
 * Copied rather than committed so it can never drift from the installed elkjs.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

mkdirSync(join(root, "public"), { recursive: true });
copyFileSync(
  require.resolve("elkjs/lib/elk-worker.min.js"),
  join(root, "public", "elk-worker.min.js"),
);
console.log("vendored elk-worker.min.js -> public/");

/**
 * The handwriting face, copied for a different reason: exports embed it as a
 * base64 `@font-face`.
 *
 * An SVG rasterised through an `<img>` element cannot load external fonts, so a
 * PNG or a clipboard image would silently fall back to a default face — the
 * diagram would stop looking hand-drawn the moment you exported it. Embedding
 * the 13 KB woff2 makes the export match the canvas, and makes a downloaded SVG
 * portable to machines that do not have the font installed.
 */
mkdirSync(join(root, "public", "fonts"), { recursive: true });
copyFileSync(
  require.resolve(
    "@fontsource/architects-daughter/files/architects-daughter-latin-400-normal.woff2",
  ),
  join(root, "public", "fonts", "architects-daughter.woff2"),
);
console.log("vendored architects-daughter.woff2 -> public/fonts/");
