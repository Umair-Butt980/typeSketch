# TypeSketch

Type a diagram. Stop dragging shapes.

```
title "Authentication Service"

user -"enter credentials"-> login-page
login-page -"POST /auth/login"-> auth-api
auth-api -"verify password hash"-> auth-api
auth-api <> user-db
```

Every other diagramming tool makes you drag a rectangle, drop it, drag another,
then draw a connector between them. TypeSketch draws the diagram as you type it,
in a hand-sketched style, and lays it out for you. You can still drag things
around afterwards — but you never have to draw them.

## Status

Pre-alpha, built in phases. The parser and graph model are done; rendering and
the canvas are next.

| Phase | |
|---|---|
| P0 — Skeleton | ✅ |
| P1a — Grammar and IR | ✅ |
| P1b — Registry and renderers | next |
| P1c — Layout and canvas | |
| P2 — Full DSL (groups, aliases, styles) | |
| P2.5 — Manual layout | |
| P3 — Persistence | |
| P4 — Export and embed | |

## Docs

- [**LANGUAGE.md**](docs/LANGUAGE.md) — the syntax, with a worked example
- [**ARCHITECTURE.md**](docs/ARCHITECTURE.md) — how it works and why

## Development

Requires Node ≥22 and pnpm.

```sh
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # vitest
pnpm typecheck
pnpm lint
```

### Layout

`src/core/` holds the isomorphic core — the parser, graph model, registry,
layout and exporters. It must run unchanged in the browser, in a Web Worker and
on the server, so it may not import React, Next, or Node built-ins. That is
enforced by a lint zone in `eslint.config.mjs`, not by convention.

`src/core/shapes/` is the deliberate exception: it is where React enters.

### Dependency pins

Several dependencies are held below `latest` on purpose — see the Toolchain
notes in [ARCHITECTURE.md](docs/ARCHITECTURE.md#toolchain-notes) before bumping
TypeScript, ESLint or Chevrotain.
