# The TypeSketch language

A TypeSketch document is a list of statements, one per line. There is no
ordering requirement, no preamble, and no closing anything — the first character
you type is already a valid document.

Everything here marked **v1** is implemented today. Everything marked *P2* parses
as an error for now and is listed so the grammar's shape is clear.

## Statements

### Declaring a node — v1

A bare identifier brings a node into existence.

```
user
```

Identifiers may contain letters, digits, underscores and interior dashes:
`login-page`, `auth_api`, `s3`. A dash must be followed by a word character,
which is what lets `user->api` parse without spaces.

Identifiers are **case-insensitive** for identity but preserve their shape for
display: `Login-Page` and `login-page` are the same node, displayed as
`Login Page`. Known acronyms are uppercased, so `user-db` displays as `User DB`.

### Connecting nodes — v1

```
user -> api        the arrow points from user to api
api <- worker      reverse; normalised to worker -> api
api <> database    bidirectional — one edge, an arrowhead at each end
api -- cdn         undirected — one edge, no arrowheads
```

`<>` is deliberately **one** edge rather than two opposing ones. Two edges would
route as two separate splines and look wrong.

Whitespace around connectors is optional: `user->api` and `user -> api` are
identical.

### Chaining — v1

```
user -> api -> database
```

Expands left-associatively to `user -> api` and `api -> database`. Mixed
connectors chain fine: `user -> api <> database`.

### Edge labels — v1

```
api -"publishes"-> queue
user -"enter credentials"-> login-page
```

The label goes before the connector, in double quotes. It works with every
connector form: `-"replicates"-- `, `-"syncs"<> `, and so on. Use `\"` for a
literal quote.

### Self-loops — v1

A node may point at itself. This is how you show work a component does
internally.

```
api -"verify password hash"-> api
```

### Explicit shape — v1

Normally the shape is chosen by looking the name up in the registry (`database`,
`db`, `postgres` → cylinder). When the name does not imply the shape you want,
say so with a colon.

```
cache:redis
sessions:database
```

An unknown word is never an error — it renders as a plain labelled rectangle.

Contradicting yourself is a warning, not an error: if `cache:redis` is followed
by `cache:memcached`, the first wins and the second is flagged. The diagram
never flip-flops.

### Title — v1

```
title "Authentication Service"
```

Drawn above the diagram. A second `title` is ignored with a warning.

### Comments and blank lines — v1

```
// the front door
user -> login-page   // inline comments work too
```

### Groups — *P2*

```
group backend {
  api -> database
}
user -> backend.api
```

### Aliases and styles — *P2*

```
gateway as gw
style api { color: blue }
```

## Worked example

The reference diagram, in full:

```
title "Authentication Service"

user -"enter credentials"-> login-page
login-page -"POST /auth/login"-> auth-api
auth-api -"verify password hash"-> auth-api
auth-api -"fetch user record"-> user-db
auth-api -"create session token"-> session-store
session-store -"user data"-> auth-api
auth-api -"set JWT cookie"-> login-page
login-page -"redirect to dashboard"-> user
```

## Error handling

**Every line parses on its own.** A broken line produces a diagnostic and is
skipped; every other line still renders. This is not a nicety — half the time
the current line is mid-keystroke and reads `user -> `, and a document-wide
parser would blank the canvas on every other keypress.

```
user -> api        ✅ renders
api ->             ⚠️  "Incomplete statement — expected a node name here."
api <> database    ✅ renders
```

Diagnostics carry a line and a column range, so the editor can underline exactly
the offending span.

## Design rules worth knowing

**The text owns structure; the canvas owns presentation.** Which nodes exist and
how they connect comes from the document alone. You cannot drag a new node into
being or drag a connection between two nodes — that is what typing is for. You
*can* drag nodes around and bow the arrows; that is saved separately and never
rewrites your text.

**Identity comes from what you typed, not where you typed it.** A node's id is
derived from its name (and, from P2, its group path) — never from its line
number. Insert twenty lines above it and it is still the same node, so the
canvas does not reshuffle, your dragged position stays put, and its hand-drawn
wobble stays identical.
