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

Normally the shape is chosen by looking the name up in the registry — see
[Shapes](#shapes) below. When the name does not imply the shape you want, say so
with a colon.

```
sessions:redis      draw "Sessions" as a cache
audit:document      draw "Audit" as a document
```

The value after the colon is itself looked up in the registry, so any alias
works: `:redis`, `:cache` and `:memcached` all mean the same shape.

An unknown word is never an error — it renders as a plain labelled rectangle.
An unknown *override* is a warning, and the name is used instead.

Contradicting yourself is also a warning, not an error: if `sessions:redis` is
followed by `sessions:s3`, the first wins and the second is flagged. The diagram
never flip-flops.

## Shapes

The shape comes from the name. `database`, `db`, `postgres`, `rds` and `mysql`
all draw a cylinder.

**Compound names resolve by their last word.** This is what makes real naming
work without memorising a vocabulary:

```
user-db          → cylinder     (db)
auth-api         → service      (api)
session-store    → drum         (store)
login-page       → browser      (page)
payment-worker   → hexagon      (worker)
```

If the last word is unknown, the first is tried, so `api-thingamajig` still
draws a service. Trailing wins because English compounds are head-final — the
last word is the noun.

The 30 archetypes, with a few aliases each:

| Shape | Aliases |
|---|---|
| `actor` — stick figure | user, customer, client, person, admin |
| `service` — rounded box | api, backend, server, microservice, app |
| `database` — cylinder | db, postgres, mysql, rds, sql |
| `cache` — double cylinder | redis, memcached, elasticache |
| `queue` — slotted bar | kafka, sqs, rabbitmq, pubsub, topic |
| `storage` — drum | s3, bucket, blob, disk, store |
| `function` — hexagon | lambda, fn, worker, job, task |
| `browser` — window frame | web, frontend, spa, ui, page |
| `mobile` — phone | ios, android, phone, device |
| `external` — dashed box | third-party, vendor, saas, partner |
| `cdn` — cloud | edge, cloudfront |
| `cloud` — cloud | aws, gcp, azure, datacenter |
| `balancer` — fan | lb, proxy, nginx, ingress, gateway |
| `auth` — shield | authentication, oauth, idp, sso |
| `firewall` — shield | waf, security |
| `search` | elasticsearch, opensearch, solr, index |
| `analytics` | metrics, telemetry, tracking, dashboard |
| `monitoring` | prometheus, grafana, alerting, alerts |
| `mail` | email, smtp, sendgrid, notifications |
| `payment` | stripe, billing, checkout |
| `container` — square box | docker, pod, k8s, cluster |
| `logs` — document | logging, elk, splunk, datadog, audit |
| `document` — document | file, doc, report, pdf, spec |
| `config` | settings, env, secrets, vault |
| `scheduler` — hexagon | cron, timer, schedule |
| `decision` — diamond | branch, condition, check |
| `terminal` — stadium | start, end, done, finish |
| `process` — square box | step, action, operation |
| `note` — dashed box | comment, annotation, memo |
| `box` — square box | *(the fallback)* node, component, system |

Every alias belongs to exactly one archetype — there is a test asserting it,
because a word that resolved two ways would make the drawn shape depend on
iteration order.

Browse them all at `/gallery` while the dev server is running.

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

## Autocomplete

The editor suggests as you type, from three places:

- **Nodes already in this diagram**, first — if you wrote `auth-api` on line 3,
  typing `auth` on line 9 offers it back.
- **Connectors**, once you have named a node: `->`, `<>`, `<-`, `--`, and the
  labelled form, which drops the caret between the quotes for you.
- **Shape names**, all 183 of them, each showing what it resolves to — so
  `redis` visibly means `cache`.

Two forms, deliberately:

| | |
|---|---|
| **Popup** | A filtered list. Arrow keys to move, Enter to accept, Escape to dismiss. This is how you find out a word exists. |
| **Ghost text** | Dim grey text completing the word inline. **Tab** accepts. This is how you go fast once you know it. |

Ghost text only ever *extends* what you typed — it will never rewrite your own
characters, so Tab always means the same thing.

**Nothing is suggested inside a `"label"` or after `//`.** You are writing prose
there, and shape names would only get in the way.

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
