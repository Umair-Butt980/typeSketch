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

const source = require.resolve("elkjs/lib/elk-worker.min.js");
const destination = join(root, "public", "elk-worker.min.js");

mkdirSync(join(root, "public"), { recursive: true });
copyFileSync(source, destination);

console.log("vendored elk-worker.min.js -> public/");
