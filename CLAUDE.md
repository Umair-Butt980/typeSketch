# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
pnpm dev            # http://localhost:3000 — the editor
                    # /gallery renders all 30 archetypes in both render modes
pnpm build
pnpm test           # vitest, all projects
pnpm test:watch
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint .
```

Vitest is split into two projects. `core` runs under Node
(`src/core/{lang,ir,registry,layout,render,export}`); `dom` runs under jsdom
(`src/core/shapes`, `src/{app,components,lib}`).

```sh
npx vitest run src/core/ir/builder.test.ts     # one file
npx vitest run -t "stability guarantee"        # one test by name
npx vitest run --project core                  # one project
```

`predev` and `prebuild` run `scripts/vendor-elk-worker.mjs`, which copies ELK's
worker and the handwriting woff2 from `node_modules` into `public/`. Both copies
are gitignored. If layout or export breaks after a fresh clone, run
`pnpm vendor:elk`.

MongoDB is optional — see Storage below. Copy `.env.example` to `.env.local` to
point at one.

## Core principle

**The typed source is the single source of truth.** Shapes and positions are
always derived, never stored as authoritative state. Almost every design
decision below follows from this, and a change that violates it is a change to
the product, not just the code.

The one qualification, drawn precisely:

- **The text owns structure** — which nodes exist, which edges connect them,
  direction, labels.
- **The canvas owns presentation** — where things sit, how edges bow.

So React Flow runs with `nodesDraggable` on and `nodesConnectable` **off**. You
cannot drag a connection into existence; that is what typing is for.

## Architecture

```
text ──► lex/parse ──► AST ──► IR builder ──► resolve ──► diff ──► layout ──► render
```

Each stage is a pure function that knows nothing about the next. Parsing runs
synchronously on every keystroke; layout is debounced ~120ms **and skipped
entirely unless the diff was topological**. `src/lib/useDiagram.ts` drives the
whole thing and is the best single file for orienting yourself.

### The isomorphic core

`src/core/{lang,ir,registry,render,layout,export}` must run unchanged in the
browser and on the server. **They may not import React, Next, or Node built-ins.**
This is enforced by a `no-restricted-imports` zone in `eslint.config.mjs`, not by
convention — do not weaken it to make an import convenient.

`src/core/shapes` is the single deliberate exception: it is where React enters.

### Invariants that are load-bearing

**Node ids come from what was typed, never from where.** `nodeId(name)` is
`name.trim().toLowerCase()`. Edge ids are `${source}->${target}#${ordinal}`.
This one rule delivers three separate guarantees — the canvas does not reshuffle
while typing, a dragged node's pin stays attached, and each shape's hand-drawn
wobble stays identical between renders. Break it and all three fail subtly.

**Direction change is cosmetic, not topological.** `->` becoming `<>` adds an
arrowhead to an existing spline and must not move any node. Archetype change *is*
topological, because a different shape has a different footprint. Any new IR
field must be classified deliberately in `src/core/ir/diff.ts`.

**Archetypes declare geometry, not markup** (`src/core/registry/types.ts`). A
cylinder is "two arcs and two sides", not an SVG string and not a component.
That split is what lets the sketch and clean renderers share one definition.
Adding a shape means adding primitives and aliases, nothing else. A test asserts
every alias belongs to exactly one archetype.

**Rough.js must be seeded.** It randomises per call, so unseeded output makes
every shape jitter on every React render and the whole diagram visibly crawls
while typing. `seedFor()` hashes the node id; each primitive within a shape uses
`${id}#${index}`. This also makes server render byte-identical to the canvas,
which is what makes export trustworthy. `src/core/render/paths.test.ts` guards it.

**Sizing is estimated, not measured.** The same code runs on the server, where
there is no DOM. Measuring in the browser would fit labels better but make
exports disagree with the canvas. Sketch and clean must be position-identical —
measurement lives outside both renderers so this holds by construction.

**Canvas positions reset on the layout result, not the graph.** The effect in
`src/components/Canvas.tsx` is keyed on `layout` alone; a cosmetic edit produces
no new layout, so positions survive. A second effect updates labels and render
mode in place.

**One lexical truth.** `src/core/lang/classify.ts` is shared by syntax
highlighting and by the completion engine's cursor-context scanner, and there is
a test asserting it agrees with the Chevrotain lexer. Do not add a second
tokenizer — that is how editor colours start lying about what the parser sees.
It diverges from the lexer in exactly one intended way: an unterminated string is
classified rather than rejected, because that is the normal state of a line being
typed.

**Completion lives in `src/core/complete`, not `src/core/lang`.** It needs node
names from the IR, and `ir` already imports `lang`; putting it there creates a
directory-level cycle. `CompletionRequest.lineIndex` is required rather than
optional because the graph includes the half-typed line — without it, the word
being typed is suggested as a completion of itself.

### Parser

`src/core/lang/parser.ts` splits the document on newlines and lexes **and parses
each line in isolation**. There is no document-level parse that can fail. This is
what makes `user -> ` mid-keystroke yield one diagnostic instead of blanking the
canvas.

Consequence: **statements cannot span lines**, which `group backend { ... }` will
need. Extending to a bounded multi-line mode is preferable to abandoning per-line
recovery.

### Layout

ELK is constructed with an explicit `workerFactory` pointing at
`/elk-worker.min.js` (`src/core/layout/elk-strategy.ts`). Without it, elkjs
reaches for its solver through an internal browserify require that Turbopack
rewrites into a module exporting no `Worker`, and every browser layout throws
`_Worker is not a constructor`. Do not "simplify" this to `new ELK()`.

Self-loops are filtered out of the solver input — ELK routes them poorly and they
carry no layout information, since a loop is drawn from its own node's box.

Pinned nodes are passed as hints *and* overwritten in a post-pass, because ELK
treats hints as advisory and "the node I dragged does not move" must hold
unconditionally.

### Storage

Two-tier by design (`src/lib/store.ts`). MongoDB when `MONGODB_URI` is reachable,
`localStorage` when it is not; the API returns `503` with `backend: "none"` to
signal the fallback. **Which tier was used is surfaced in the UI** rather than
hidden — never imply a durability the app does not have.

Version history is best-effort: atomic document+version writes need a
transaction, which needs a replica set. A failed history write must never block a
save.

## Toolchain pins — read before bumping

Three dependencies are held below `latest` because `latest` broke:

- **typescript 6.0.3**, not 7.x — TS 7 is the native port; `typescript-eslint`
  refuses to load against it and Next cannot use its compiler API.
- **eslint 9.39.5**, not 10.x — `eslint-config-next` advertises `>=9` but pulls
  `eslint-plugin-react`, which uses a context API ESLint 10 removed.
- **chevrotain 12.0.0**, not 13.x — the 13 line was days old at install time.

Also: `react-resizable-panels` v4 reads a bare `defaultSize={36}` as **36 pixels**.
Percentages must be strings (`"36%"`). It typechecks either way.

shadcn components are copy-in source under `src/components/ui` and are ours to
edit. Two needed fixes for `exactOptionalPropertyTypes`, which their generator
does not account for.

## Testing hazard

**Node and the browser take different paths through elkjs.** Node has no
`Worker`, so it uses the bundled in-process solver; the browser spawns a real
one. The full suite once passed while every browser layout threw. Anything
touching ELK construction needs checking in a real browser, not just under
Vitest.

Browser E2E (Playwright) is deliberately deferred; pointer-drag mechanics, page
reload and cross-browser stroke rendering are the real gaps.

## Further reading

- `docs/ARCHITECTURE.md` — the full design rationale
- `docs/LANGUAGE.md` — syntax reference and the shape table
