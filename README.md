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

Pre-alpha, built in phases. **It runs** — `pnpm dev` gives you a split pane you
can type a diagram into.

| Phase | |
|---|---|
| P0 — Skeleton | ✅ |
| P1a — Grammar and IR | ✅ |
| P1b — Registry and renderers | ✅ |
| P1c — Layout and canvas | ✅ |
| P1d — Header, save/open, export, help | ✅ |
| P1e — Autocomplete + syntax highlighting | ✅ |
| P1f — Colour | ✅ |
| P2 — Full DSL (groups, aliases, styles) | next |
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
cp .env.example .env.local   # optional — MongoDB connection
pnpm dev          # http://localhost:3000 — the editor
                  # /gallery renders all 30 archetypes in both modes
pnpm test         # vitest
pnpm typecheck
pnpm lint
```

### Storage

Documents save to MongoDB when `MONGODB_URI` points at a reachable server, and
to the browser's localStorage when it does not. The app never refuses to save;
it tells you which of the two it used.

```sh
docker run -d -p 27017:27017 --name typesketch-mongo mongo:7
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
