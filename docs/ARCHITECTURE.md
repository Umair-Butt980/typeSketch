# TypeSketch — Architecture

## What this is

Diagramming tools built around direct manipulation (tldraw, Excalidraw, Lucidchart) make developers drag rectangles to express something they could say in eight characters. **TypeSketch removes the dragging.** You type `user -> database` and a stick-figure actor and a database cylinder appear, already connected, already laid out, drawn in a hand-sketched style.

The primary user is an internal dev team documenting systems — architecture diagrams for design docs, PRs and onboarding — where the bottleneck is the effort of drawing, not the difficulty of thinking.

**Core principle: the typed source is the single source of truth.** Structure is always derived from text, never stored as authoritative state. Only *presentation* — where a node was dragged, how an arrow was bowed — is stored alongside it.

This one decision is what makes the product coherent. It gives diagrams-as-code semantics (diffable, reviewable, version-controllable), makes persistence a string column, makes v2 collaboration a matter of syncing one text buffer rather than a shape graph, and makes v2 voice input a pure front-end concern (speech produces text; nothing downstream changes).

## Decisions

| Area | Choice |
|---|---|
| Structure | **Single Next.js app**, isomorphic core in `src/core/` |
| Language | TypeScript — grammar written once, runs in browser, worker and server |
| Shape resolution | Predefined registry only; LLM parked behind `ShapeResolver` for v2 |
| Canvas | React Flow (`@xyflow/react`) + ELK (`elkjs`) |
| Rendering | Rough.js sketch mode + crisp Clean mode, both from v1 |
| Edge editing | Draggable bezier control points, persisted per edge |
| Syntax | Full DSL with grouping |
| Diagram family | Architecture (boxes and arrows) only |
| Database | MongoDB via Mongoose |
| UI | Split pane — CodeMirror 6 editor left, canvas right |
| UI kit | shadcn/ui + Tailwind for chrome only |
| Testing | Unit + component tests (Vitest). Playwright deferred. |
| Deployment | Internal dev tool first |

### Why one app rather than a workspace

TypeSketch has exactly one deployable, so "monolith vs monorepo" is really a question about code organisation, not deployment topology. Workspace packages would buy enforced module boundaries and reuse by a future VS Code extension — but a package boundary does not actually enforce isomorphism (nothing stops you importing React into a package), and the extension is speculative v2 work.

Folders plus a lint rule give the same guarantee at a fraction of the friction: no `workspace:*` protocol, no `transpilePackages`, no six `package.json` files, no split test config. If the extension ever ships, promoting folders to packages is mechanical.

### Why TypeScript everywhere

The parser, graph IR and layout engine are all JavaScript libraries. The grammar is written **once** and the identical code runs in three places: the browser for sub-millisecond feedback on every keystroke, a Web Worker for layout, and the server for `/api/render`. A Python backend would still leave the browser needing a JS parser, so two grammars would exist and would inevitably drift — producing the bug class where the canvas and the exported PNG disagree.

Python's genuine advantage is ML. v1 has none, and the v2 LLM tier is API calls rather than model hosting.

## Pipeline

One unidirectional pass, re-run as the user types. Each stage is a pure function ignorant of the next.

```
text ──► lex/parse ──► AST ──► IR builder ──► resolve ──► layout ──► render
                        │                                    │          │
                   diagnostics                          Web Worker   Sketch│Clean
```

This is what keeps the v2 extensions cheap: voice replaces the input to stage 1, an LLM resolver slots into `resolve`, and a sequence-diagram engine is a second implementation of `layout`.

## Layout

```
src/
├── app/                     Next.js App Router — routes, layouts, API handlers
├── components/              React UI; shadcn primitives land in components/ui
├── lib/                     app-level helpers (cn, client utils)
└── core/                    the isomorphic core — no DOM, no React, no Node
    ├── diagnostics.ts       Diagnostic — shared by lang and ir
    ├── lang/                tokens.ts · ast.ts · parser.ts · classify.ts
    ├── ir/                  types.ts · builder.ts · diff.ts
    ├── complete/            context.ts · engine.ts
    ├── registry/            geometry.ts · archetypes.ts · resolver.ts
    ├── render/              seed.ts · paths.ts · measure.ts
    ├── layout/              ELK adapter, override map
    ├── shapes/              React node/edge components  ← the React boundary
    └── export/              SVG / PNG / JSON emitters
```

`render/` turns geometry into path data and is deliberately **not** React: the
same code runs in the browser and on the server for `/api/render`. `shapes/` is
the thin React layer that paints what `render/` produced.

`Diagnostic` sits at the core root rather than inside either package: the parser
produces diagnostics and `IRGraph` carries them, so putting the type in `ir`
would force `lang` to depend on `ir` for no reason.

**`src/core/{lang,ir,registry,layout,export}` must stay isomorphic** — no DOM, no React, no Node built-ins — so the browser, the worker and the server run identical code. This is enforced by a `no-restricted-imports` zone in `eslint.config.mjs`, not by convention. `src/core/shapes` is the deliberate exception: it is where React enters.

## The grammar (`src/core/lang`)

Built with Chevrotain. The full syntax reference is [`LANGUAGE.md`](./LANGUAGE.md); this section covers only the implementation decisions.

**Error-tolerant, statement-scoped parsing is non-negotiable.** While typing `user -> `, that line is incomplete, and a parser that throws would blank the canvas mid-keystroke.

The implementation is deliberately blunt about this: `parse()` splits the document on newlines and lexes *and parses each line in isolation*. A line that fails produces a `Diagnostic` and is skipped; every other line still builds. There is no document-level parse to fail. The cost is that statements cannot span lines — which `group { ... }` will need in P2, and is the one place this design will have to bend.

Implemented in v1: `title`, the four connectors (`->`, `<-`, `<>`, `--`), chaining, edge labels, explicit archetype (`cache:redis`), self-loops, and `//` comments. Groups, aliases and `style` blocks are P2.

Three lexer details that are load-bearing:

- **Token order.** Multi-character operators must precede the single characters they start with, or `--` lexes as two `-` and `<>` never matches at all.
- **Identifiers allow interior dashes** (`login-page`) via `[A-Za-z_][A-Za-z0-9_]*(?:-[A-Za-z0-9_]+)*` — a dash must be followed by a word character. That is precisely what lets `user->api` lex correctly without spaces: the `-` of `->` cannot be absorbed into the identifier.
- **`title` carries `longer_alt: Identifier`**, so `titlebar` stays one identifier rather than becoming the keyword plus `bar`.

Column ranges come from `startOffset + image.length`, not from `endOffset`. Chevrotain's `positionTracking: "onlyOffset"` records start offsets only; the alternative, `"full"`, adds line/column tracking we do not need (each line is lexed separately, so offsets *are* columns) plus a spurious LINE_BREAKS warning.

`<>` is **one** edge with `direction: 'both'`, never two opposing edges — two edges route as two separate splines and look visibly wrong.

## The IR and the stability guarantee (`src/core/ir`)

**Node IDs derive from the normalised label plus group path — never from line number or ordinal position.** `api` inside `group backend` is always `backend.api`, wherever that line sits in the document.

Consequence: inserting a line at the top does not renumber nodes, so the differ sees an unchanged graph plus one addition and the canvas does not reshuffle under the user's cursor. Getting this wrong is the single most common way live-diagram tools feel broken.

It is load-bearing three times over — it is also what keeps a dragged node's pin attached to the right node, and what keeps each shape's hand-drawn wobble identical across renders.

Concretely: `nodeId(name)` is `name.trim().toLowerCase()` and nothing else. Display text is a separate concern — `humanize()` turns `login-page` into `Login Page`, uppercasing a small acronym list so `user-db` reads `User DB` rather than `User Db`.

Edge IDs are `${source}->${target}#${ordinal}`, where the ordinal disambiguates parallel edges. `<-` is normalised away at build time by swapping the endpoints, so nothing downstream ever has to think about which way the user typed it.

**Resolution is injected, not imported.** `buildIR(parsed, resolver)` takes a `ShapeResolver`, which is what makes the builder testable before the registry exists and what makes the v2 LLM tier a second implementation rather than a rewrite.

### What counts as a relayout

The differ classifies every change, and only `topological` runs ELK.

| Change | Kind | Why |
|---|---|---|
| Node added or removed | topological | graph shape changed |
| Edge added, removed or rewired | topological | routing changed |
| Archetype changed | topological | a different shape has a different footprint |
| **Direction (`->` → `<>`)** | **cosmetic** | adds an arrowhead to an existing spline — nodes must not move |
| Node or edge label | cosmetic | painted detail |
| Title, style | cosmetic | painted detail |
| Statement moved to another line | none | invisible to the canvas |

Direction being cosmetic is a guarantee, not an optimisation: `user -> api` becoming `user <> api` must leave every node exactly where it was. It has a test.

## Archetypes are geometry, not markup (`src/core/registry`)

This is the key decision that makes two render modes affordable. An archetype declares *what it is geometrically*; the renderers decide how to stroke it. A cylinder is "two arcs and two sides" — not an SVG string, not a React component.

```ts
type Prim =
  | { k: "rect";    x: number; y: number; w: number; h: number; r?: number }
  | { k: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { k: "line";    x1: number; y1: number; x2: number; y2: number }
  | { k: "path";    d: string }
```

Without this split, every one of ~120 archetypes would have to be authored twice.

| Archetype | Aliases | Geometry |
|---|---|---|
| `actor` | user, customer, client, person, admin | ellipse + 4 lines, label **below** |
| `database` | db, postgres, mysql, rds, sql | cylinder path |
| `service` | api, backend, microservice, server | rounded rect |
| `queue` | kafka, sqs, rabbitmq, pubsub, topic | open-ended bar |
| `cache` | redis, memcached | double cylinder |
| `storage` | s3, bucket, blob, disk | drum |
| `function` | lambda, fn, worker, job | hexagon |
| `browser` | web, frontend, spa, ui | window frame |
| `mobile` | app, ios, android | phone outline |
| `external` | third-party, vendor, saas | dashed rect |

Unknown labels fall back to a plain labelled rectangle — never an error, never a block. Resolution sits behind `ShapeResolver` so the v2 LLM tier is additive rather than a rewrite.

**Compound names resolve by segment.** Exact match first, then the trailing dash-segment, then the leading one: `user-db` finds `db`, `auth-api` finds `api`, `session-store` finds `store`. Trailing wins because English compounds are head-final. Without this the alias table would have to be combinatorial, and the reference diagram — which is entirely compound names — would render as a wall of plain boxes.

Every alias belongs to exactly one archetype, asserted by a test: a word resolving two ways would make the drawn shape depend on iteration order, which is precisely the non-determinism the registry-only design exists to avoid.

The full table is in [`LANGUAGE.md`](./LANGUAGE.md#shapes), and `/gallery` renders all 30 in both modes.

## Colour (`src/core/registry/palette.ts`)

Shape encodes *what a thing is*; colour encodes *which group it belongs to*.
Written inline as `api #blue`, so the colour rides on the node reference and no
new statement type was needed — nothing about the line-scoped parser changed.

Nine curated names rather than open hex, for the same reason the shape aliases
are curated: an arbitrary hex has no dark-theme counterpart and no contrast
guarantee. **The stroke carries the hue and the fill only hints at it**, so the
label sitting on top keeps its contrast — there are tests asserting the
lightness relationship in both themes.

**One source of truth.** The canvas needs CSS variables so a theme switch
repaints without re-rendering, but hand-writing those in `globals.css` next to
the TypeScript values would be two lists free to drift. `paletteCss()` generates
them from `PALETTE`, and the root layout injects it. Export resolves the same
objects to literals, because a downloaded file has no stylesheet to inherit
from — an exported SVG never contains a `var()`.

### Colour is last-wins; archetype is first-wins

A contradicted archetype is almost certainly a mistake, so `sessions:redis`
followed by `sessions:s3` keeps the first and warns. A restated colour is almost
certainly intentional — writing `billing-api #red` further down is how you
recolour something without hunting for where you first named it, and first-wins
would make that statement silently do nothing.

Same-shaped situation, opposite intent, so deliberately different rules. Both are
documented in `LANGUAGE.md` and both have tests.

Colour is **cosmetic** in the differ, so recolouring repaints without moving
anything. That fell out of the existing classification rather than needing new
code, but it has its own test because it is the guarantee that makes recolouring
feel instant.

## Rendering (`src/core/shapes`)

Two renderers over one geometry:

- **`CleanRenderer`** emits `<rect>`, `<ellipse>`, `<path>` directly. Crisp, UI font.
- **`SketchRenderer`** feeds each primitive through Rough.js and emits the resulting path sets. Handwritten font.

### The shimmer problem

Rough.js output is randomised. Called fresh on every React render, the same box jitters differently each frame and the whole diagram visibly crawls while typing. Two mitigations, both mandatory:

1. Pass an explicit **`seed` derived from a hash of the stable node/edge ID**. Same node, same wobble — forever, across reloads, and across client and server render.
2. Generate through `rough.generator()` (not the canvas/SVG wrappers) and **memoize the drawable on `[id, w, h, mode]`**, so typing an unrelated line does not regenerate paths.

Seeding also buys server/client parity for free: `/api/render` produces byte-identical output to the canvas. `seedFor()` is FNV-1a over the node id, and each primitive within a shape is seeded from `${id}#${index}` so a stick figure's five strokes wobble differently without any of them being random.

Path generation is additionally memoized on `${id}|${mode}|${w}x${h}` — every input that can change the output, so a cache hit is always correct rather than merely likely.

### Sizing is isomorphic, so it cannot measure text

The same sizing code runs in the browser and again on the server for `/api/render`, where there is no DOM to measure text with. Node sizing therefore *estimates* text width from character count (`measureNode` in `render/measure.ts`) rather than measuring it — measuring in the browser would give a better fit but make the two disagree, and an export that does not match the canvas is worse than a slightly loose label. The estimate is deliberately generous: too wide leaves air around a label, too narrow clips it, and clipping is the failure users notice.

`labelSlot` is why this is not one formula: an inside label grows its shape horizontally, while a `below` label grows the footprint vertically and leaves the shape untouched. An actor is a fixed-size stick figure with text underneath, not a box with text in it.

**Sketch and Clean differ only in path data and typeface — never in size or position.** Measurement lives outside the renderers entirely so this holds by construction, and there is a component test per archetype asserting it.

Sketch parameters: `roughness: 1.2`, `bowing: 1.5`, `strokeWidth: 1.6`, ink `--ink`, fill `--paper`, `fillStyle: 'solid'`.

**Fonts** — sketch mode uses **Architects Daughter** (`@fontsource/architects-daughter`, OFL-1.1, self-hosted). Excalifont, the face in the reference screenshot, is not published to npm; Architects Daughter is the closest upright hand-lettering available under a redistributable licence. Caveat is too script-like and Kalam too marker-pen for technical diagrams. Clean mode uses the system UI stack. Both are wired through `--font-hand` / `--font-sans`, so the face is a CSS concern and never reaches the geometry.

### Edges

React Flow's built-in edges provide none of what is needed here — no control-point handles, no self-loops, no rough stroke — so edges are a custom component:

- **Path** — cubic bezier. Control points come from the override map when present, otherwise derived from the ELK-routed polyline.
- **Self-loops** (`source === target`) — ELK does not route these usefully; a dedicated arc path leaves and re-enters the node's top edge.
- **Sketch stroke** — the bezier `d` goes through `rough.generator().path(d, { seed })`, same seeding rule as nodes.
- **Arrowheads** — hand-drawn as two short Rough.js lines rather than an SVG `marker`, so they match the stroke. `both` draws them at both ends, `none` at neither.
- **Labels** — via React Flow's `EdgeLabelRenderer` at bezier `t=0.5` with a small normal offset, kept **horizontal** rather than rotated along the path.
- **Control handles** — hidden until the edge is selected, then two draggable dots writing to the override map.

## Autocomplete (`src/core/complete`)

Suggestions are **deterministic** — ranked from the document, the shape registry
and the grammar. No model, no API key, no latency. The same reasoning as the
registry, and it applies more strongly here: completions fire on every keystroke
against a canvas that updates in under a millisecond. Measured at 0.023ms per
call on a 200-node document.

**It cannot live in `src/core/lang`.** It needs node names from the current
document, so it depends on `ir` — and `ir` already imports `lang`. That would be
a directory-level cycle, so it is its own module, depended on by nothing.

Ranking, highest first: nodes already in the document → connectors (only in
connector position) → the 183-word registry vocabulary → snippets. Within a
rank: prefix matches before substring matches, each alphabetical. The
alphabetical tiebreak is not cosmetic — without a total order the list can
reshuffle between keystrokes, and a popup whose first entry moves under your
fingers is worse than no popup.

**`src/core/lang/classify.ts` is the single lexical truth**, shared by
completion and highlighting and **tested for agreement with the Chevrotain
lexer**. Hand-written editor modes classically drift from the real grammar until
the colours start lying about what the parser sees; one tested classifier is what
prevents that. It diverges deliberately in exactly one way: an unterminated
string is classified rather than rejected, because `-"enter cred` is the normal
state of a line someone is typing.

### Two rules that make it tolerable rather than irritating

**Nothing is suggested inside a label or a comment.** Offering `elasticsearch`
in the middle of `-"enter credentials"` is worse than offering nothing. The
context scanner returns `suppressed` there, and it has tests.

**Ghost text only ever extends what was typed.** If the top suggestion would
rewrite any typed character, no ghost appears. A Tab key that sometimes inserts
and sometimes rewrites is unpredictable, and unpredictability is the one thing an
accept key cannot afford.

The engine sits behind a `CompletionSource` interface, so a model-backed tier is
a second implementation in a chain rather than a rewrite — the same seam as
`ShapeResolver`.

**The word being typed is excluded from its own suggestions.** The graph is
derived from source that includes the half-typed line, so `au` exists as a node
while you are typing it; `CompletionRequest.lineIndex` is required, not optional,
so this cannot be forgotten.

The editor is composed explicitly rather than with `basicSetup`, which bundles
its own `autocompletion()` and highlight style — both would compete with the
TypeSketch ones.

## Layout (`src/core/layout`)

`elkjs` with `layered`, direction `RIGHT`, hierarchy enabled so `group` blocks are real nested containers.

- **Layout runs off the main thread** — in ELK's own worker. Layout of a 60-node graph is tens of milliseconds; on the main thread that is a visible stutter on every keystroke.
- **Previous positions feed back in as hints**, so adding a node nudges the diagram rather than re-solving from scratch and teleporting everything.
- Parse runs synchronously per keystroke; layout is debounced ~120ms and skipped entirely for cosmetic diffs.
- **Self-loops never reach ELK.** It routes them poorly, and they carry no layout information anyway: a node's loop is drawn from that node's own box, so it cannot influence where anything sits.

### Feeding ELK a worker, and why it needs help

`elkjs` finds its solver through an internal browserify `require('./elk-worker.min.js')`. Turbopack resolves that to the real file and inlines it — and that file, evaluated on its own, exports no `Worker`. The result is `TypeError: _Worker is not a constructor` on the very first layout, in the browser only.

So ELK is constructed with an explicit `workerFactory` pointing at `/elk-worker.min.js`, served as a plain asset. A URL fetched at runtime gives a bundler nothing to rewrite. `scripts/vendor-elk-worker.mjs` copies the file out of `node_modules` on `predev`/`prebuild`, and the copy is gitignored so it cannot drift from the installed elkjs.

Under Node and jsdom there is no `Worker` at all, so elkjs uses its bundled in-process solver instead. **That difference is a live testing hazard**: the whole suite passed while every browser layout threw, because Node and the browser take different paths through elkjs and only one is covered. Anything touching layout construction needs checking in a browser, not just under Vitest.

TypeSketch does **not** wrap this in a worker of its own. An earlier version did, and it bought nothing: ELK already works off-thread, so the extra layer added a second hop of message passing and made ELK's worker a *nested* one — which Safari only supports from 16.4.

`useDiagram` surfaces a `layoutError` rather than swallowing it. A silently failed layout is indistinguishable from a hang, and reads to the user as "the app is broken" with nothing to go on.

### How positions survive typing

The canvas holds node positions in React Flow's own state, and the effect that resets them is keyed on the **layout result**, not on the graph. A cosmetic edit produces no new layout, so nothing resets and a node stays exactly where it was put. A second effect updates labels, archetypes and render mode in place without touching position.

That is what makes the Sketch/Clean toggle and label edits free, and it is the same mechanism P2.5 extends to persist drags.

### The override layer

Presentation state the typed source does not own, keyed by stable IR id:

```ts
interface NodeOverride { kind: "node"; x: number; y: number; pinned: true }
interface EdgeOverride { kind: "edge"; cp1: Point; cp2: Point }
type OverrideMap = Record<string, NodeOverride | EdgeOverride>
```

Pinned nodes are passed to ELK as position hints with `interactiveLayout: true` so unpinned nodes flow *around* them. ELK treats hints as advisory, so a post-pass **overwrites pinned nodes to their exact coordinates** — "a node I dragged does not move" must hold unconditionally.

Orphaned overrides are garbage-collected on save (`collectGarbage`), so deleting a line and later re-adding it does not resurrect a stale pin. A **Reset layout** action clears the map.

## Interaction model — typed structure, dragged presentation

- **The text owns structure**: which nodes exist, which edges connect them, direction, labels. You cannot drag a node into existence or drag a connection between two nodes — that is what typing is for, and it is the product thesis. React Flow runs `nodesDraggable` **on**, `nodesConnectable` **off**.
- **The canvas owns presentation**: where things sit, how edges bow.

## UI

```
┌──────────────────────────┬──────────────────────────────────────┐
│  EDITOR (left)           │  CANVAS (right)   [ Sketch │ Clean ] │
│                          │                                      │
│  title "Auth Service"    │      Authentication Service          │
│  user -> login-page      │                                      │
│  login-page -"POST"-> api│        ○       ╭~~~~~~~~~╮           │
│  api -"verify"-> api     │       /|\  ──► ╎ Auth API ╎ ⟲        │
│  api <> user-db          │       / \      ╰~~~~~~~~~╯           │
│                          │       User          │                │
│  ▸ autocomplete: dat…    │                     ▼                │
│  ▸ inline diagnostics    │                ⌒⌒⌒⌒⌒⌒⌒⌒               │
│                          │                ╎ User DB ╎           │
└──────────────────────────┴──────────────────────────────────────┘
        ▲ draggable divider          dotted grid · pan · zoom · drag
```

Left: CodeMirror 6 with a custom TypeSketch language mode — arrow and keyword highlighting, inline diagnostic underlines, autocomplete over the alias table (`dat` → `database`). Right: React Flow with a dotted-grid background, zoom control and the Sketch/Clean toggle.

**Chrome is shadcn/ui + Tailwind**, deliberately small: `Resizable` for the divider, `ToggleGroup` for Sketch/Clean, plus `Button`, `DropdownMenu`, `Dialog`, `Tooltip`, `Sonner`. Everything *inside* the two panes is custom.

Clean chrome around a hand-drawn canvas is intentional — the contrast is what makes the sketch read as *content*. Chrome that was also wobbly would read as a broken stylesheet.

The panes are **bidirectionally linked by node ID**: cursor on a line highlights its node, selecting a node scrolls the editor to its declaring line. Cheap once IDs are stable, and what makes a large diagram navigable.

## Backend

Because the source text is authoritative, the server does almost nothing interesting. That is the point, and it is why this scales: parsing, layout and rendering all happen on the user's machine.

- Next.js route handlers, MongoDB via Mongoose, Auth.js (P3).
- `POST /api/render` takes source text plus an override map, runs the identical core pipeline, returns SVG or PNG (P4).

### Storage degrades rather than refusing

`GET`/`POST /api/documents` return `503` with `backend: "none"` when `MONGODB_URI` is unset or unreachable, and the client store falls back to `localStorage`. This is a diagramming tool, not a database client — refusing to save because nobody started `mongod` would be a poor trade. **Which tier was used is returned rather than hidden**, so the UI can say "saved in this browser only" instead of implying a durability it does not have.

The connection is cached on `globalThis` (Next re-evaluates modules on every edit, so an uncached pool leaks connections within minutes) and uses a 2-second server-selection timeout — Mongo's 30-second default would make every save appear to hang when nothing is listening.

Version history is best-effort: writing `documents` and `versions` atomically needs a transaction, and transactions need a replica set, which a plain local `mongod` is not. Losing a history entry beats refusing to save the user's work, so that failure is swallowed deliberately.

### Export is the same code, different sink

`core/export/svg.ts` reuses `render/` verbatim, which is the payoff for keeping it free of React and the DOM: an export is not a second renderer to keep in step. Rough.js seeding makes it exact — a downloaded file has byte-identical strokes to the canvas.

Two details worth keeping: an SVG rasterised inside an `<img>` cannot fetch external resources, so the handwriting woff2 is inlined as a base64 `@font-face` or PNG text would silently fall back; and `ClipboardItem` is handed a *promise* rather than an awaited blob, because Safari drops the user-gesture permission across an `await`.

```js
documents       { _id, teamId, title, source, overrides, renderMode, updatedAt }
versions        { _id, documentId, source, overrides, authorId, createdAt }
                  // append-only; index { documentId, createdAt: -1 }
teams           { _id, name, memberIds }
registryAliases { _id, teamId, alias, archetype }
                  // UNIQUE compound index { teamId, alias }
```

Two Mongo-specific notes, since it will not enforce for free what a relational store would:

1. `{ teamId, alias }` **must** carry a unique index, or a team can define the same alias twice and resolution becomes non-deterministic — precisely the bug the registry-only design exists to prevent.
2. Saving writes both `documents` and `versions`; wrap that in a transaction (needs a replica set, which Atlas provides by default) so history cannot diverge from current state.

`overrides` is where Mongo's schemalessness genuinely pays: an open-ended map keyed by user-defined node IDs, stored as-is with no migration.

## Scalability

- Next.js is stateless → scale horizontally behind a load balancer.
- MongoDB is the only stateful component; the workload is small documents fetched by ID.
- Redis caches rendered exports keyed by a hash of source text — the same diagram renders once, ever.
- Server-side rendering is the one CPU-bound path. If `/api/render` gets hot, move it to a queue-backed worker pool; nothing else changes, because it is already a pure function of its input.

## Designed-in v2 seams

| v2 feature | Seam | Impact on v1 |
|---|---|---|
| Voice input | speech → text, upstream of the parser | none |
| LLM shape inference | second `ShapeResolver` in the chain | none |
| Real-time collaboration | source text becomes a Yjs `Y.Text` | editor only |
| Sequence / ER diagrams | second `LayoutStrategy` + parser mode | additive |
| VS Code extension | reuses `lang` + `layout` + `export` verbatim | none |

## Build phases

- **P0 — Skeleton.** ✅ Next.js app, Tailwind + shadcn wiring, `src/core` boundaries with the lint zone, Vitest, IR/registry/override contracts.
- **P1a — Grammar and IR.** ✅ Chevrotain lexer and parser with per-line error tolerance, AST, IR builder with stable ids, differ. 56 tests including the ID-stability property test.
- **P1b — Registry and renderers.** ✅ 30 archetypes as geometry, both render modes over seeded Rough.js, isomorphic sizing, `NodeShape`, and `/gallery`. 112 tests including the anti-shimmer guarantee.
- **P1c — Layout and canvas.** ✅ Off-thread ELK layout, custom `SketchEdge` (bezier, self-loop arcs, hand-drawn arrowheads, labels), React Flow canvas, split-pane shell with CodeMirror and a diagnostics strip.
- **P1d — Chrome, persistence and export.** ✅ Two-row header, New/Open/Save with a MongoDB-or-localStorage store, SVG/PNG/source/JSON download, copy-to-clipboard, and a Help sheet documenting the syntax. 179 tests.
  *Known gaps, deliberately deferred:* dragging works but is not persisted (P2.5), the editor has no TypeSketch language mode so diagnostics sit in a strip rather than underlining inline (P2), and edge control points are not yet draggable (P2.5).
- **P2 — Full DSL.** Groups, aliases, `style`, hierarchical layout, ~120 archetypes, editor autocomplete and diagnostics, cursor ↔ node linking.
- **P2.5 — Manual layout.** Node dragging, pinned-node handling, edge control points, orphan GC, Reset layout. Before persistence, so the override shape is settled first.
- **P3 — Persistence.** Mongoose models and indexes, Auth.js, CRUD, version history, team aliases.
- **P4 — Export and embed.** Render endpoint, SVG/PNG/JSON, share links, README embeds.
- **P5 — Polish.** Layout stability tuning, shortcuts, templates, onboarding that teaches syntax by example.

## Verification

| Scope | What it proves |
|---|---|
| `lang` | Golden-file AST tests, including partial input (`user -> `, unclosed `group`) producing diagnostics rather than throwing |
| `ir` | Property test: prepending a line leaves every pre-existing node ID unchanged |
| `registry` | Every alias resolves to exactly one archetype; no duplicates |
| `shapes` | **Anti-shimmer:** rendering the same node twice yields byte-identical path data |
| `layout` | Pinned nodes emerge at exactly their given coordinates; orphan GC drops dead overrides |
| persistence | `documents` + `versions` write in one transaction; unique alias index rejects duplicates |
| isomorphism | Same fixtures through the client pipeline and `/api/render` produce identical geometry |

**Component/pipeline tests (Vitest + Testing Library)** cover the behavioural guarantees one level below the browser — including that a pinned node's coordinates are *exactly* unchanged after ten more lines of typing, and that Sketch↔Clean is position-identical.

**Deferred to Playwright:** real pointer-drag mechanics, actual page reload, cross-browser stroke rendering. Worth adding once the interaction model stops changing.

**Performance.** 200-node document: parse under 5ms, layout under 300ms off-thread, no dropped frames while typing. Rough.js generation must appear only on mount and resize in a React profile, never per keystroke.

## Toolchain notes

Versions are pinned deliberately, not optimistically — several `latest` tags are ahead of what the ecosystem supports:

- **TypeScript 6.0.3**, not 7.0.2. TS 7 (the native port) is rejected outright by `typescript-eslint`, and Next cannot use its compiler API.
- **ESLint 9.39.5**, not 10.8.0. `eslint-config-next` claims `>=9` but pulls `eslint-plugin-react`, which uses a context API ESLint 10 removed.
- **Chevrotain 12.0.0**, not 13.2.0. The entire 13.x line was under a week old; 12.0.0 has months of soak. The parser is the foundation of the app — not the place to be first.

Node ≥22 (developed on 24.16), pnpm 11.
