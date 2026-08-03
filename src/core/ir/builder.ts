import type { Diagnostic } from "@/core/diagnostics";
import type { ChainLink, NodeRef, ParseResult } from "@/core/lang";
import { colorByName } from "@/core/registry/palette";
import { FALLBACK_ARCHETYPE, type ShapeResolver } from "@/core/registry/types";
import type { Direction, IREdge, IRGraph, IRNode } from "./types";

/**
 * Words that read badly under plain title-casing. `user-db` should display as
 * "User DB", not "User Db".
 */
const ACRONYMS = new Set([
  "api", "db", "ui", "ux", "id", "io", "cdn", "sql", "jwt", "s3", "sqs", "sns",
  "http", "https", "rpc", "grpc", "cli", "dns", "vpc", "iam", "ssl", "tls",
  "aws", "gcp", "cdn", "cms", "crm", "sdk", "ci", "cd", "os", "vm", "lb",
]);

/**
 * The stable identity rule.
 *
 * An id is a pure function of what the user typed — never of where they typed
 * it. Insert twenty lines above a node and its id is unchanged, which is what
 * keeps the canvas from reshuffling mid-keystroke, keeps a dragged node's pin
 * attached, and keeps its hand-drawn wobble identical across renders.
 */
export function nodeId(name: string): string {
  return name.trim().toLowerCase();
}

/** Display text derived from the identifier: `login-page` -> `Login Page`. */
export function humanize(name: string): string {
  return name
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) =>
      ACRONYMS.has(word.toLowerCase())
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

/** `${source}->${target}#${ordinal}`; the ordinal separates parallel edges. */
export function edgeId(source: string, target: string, ordinal: number): string {
  return `${source}->${target}#${ordinal}`;
}

/**
 * `<-` is normalised away here rather than carried through the pipeline: an
 * edge always points from `source` to `target`, so layout and rendering never
 * have to think about which way the user happened to type it.
 */
function orient(
  arrow: ChainLink["arrow"],
  left: string,
  right: string,
): { source: string; target: string; direction: Direction } {
  switch (arrow) {
    case "<-":
      return { source: right, target: left, direction: "forward" };
    case "<>":
      return { source: left, target: right, direction: "both" };
    case "--":
      return { source: left, target: right, direction: "none" };
    case "->":
      return { source: left, target: right, direction: "forward" };
  }
}

export function buildIR(
  parsed: ParseResult,
  resolver: ShapeResolver,
): IRGraph {
  const nodes = new Map<string, IRNode>();
  const edges: IREdge[] = [];
  const diagnostics: Diagnostic[] = [...parsed.diagnostics];
  /** Per source->target pair, how many edges we have already emitted. */
  const parallel = new Map<string, number>();
  let title: string | undefined;

  /**
   * `cache:redis` names a *shape*, and `redis` is an alias rather than an
   * archetype name, so the override goes through the same resolver as the
   * label. Otherwise the IR would carry `redis` and the renderer would have
   * nothing to look up.
   */
  function explicitArchetype(ref: NodeRef, line: number): string | undefined {
    if (!ref.archetype) return undefined;

    const hit = resolver.resolve(ref.archetype);
    if (hit) return hit.name;

    diagnostics.push({
      severity: "warning",
      message: `Unknown shape \`${ref.archetype}\`; drawing \`${ref.name}\` from its name instead.`,
      line,
      from: ref.from,
      to: ref.to,
    });
    return undefined;
  }

  /**
   * `api #blue`. Unknown colours warn and leave the node untinted rather than
   * failing, the same way an unrecognised shape word degrades to a plain box.
   */
  function explicitColor(ref: NodeRef, line: number): string | undefined {
    if (!ref.color) return undefined;

    const hit = colorByName(ref.color);
    if (hit) return hit.name;

    diagnostics.push({
      severity: "warning",
      message: `Unknown colour \`${ref.color}\`; drawing \`${ref.name}\` untinted.`,
      line,
      from: ref.from,
      to: ref.to,
    });
    return undefined;
  }

  function declare(ref: NodeRef, line: number): string {
    const id = nodeId(ref.name);
    const explicit = explicitArchetype(ref, line);
    const color = explicitColor(ref, line);
    const existing = nodes.get(id);

    if (!existing) {
      const archetype =
        explicit ?? resolver.resolve(ref.name)?.name ?? FALLBACK_ARCHETYPE;
      const node: IRNode = { id, label: humanize(ref.name), archetype, line };
      nodes.set(id, color === undefined ? node : { ...node, style: { color } });
      return id;
    }

    // A later `cache:memcached` should not silently retype a node already drawn
    // as something else — say so rather than letting the diagram flip-flop.
    if (explicit && explicit !== existing.archetype) {
      diagnostics.push({
        severity: "warning",
        message: `\`${ref.name}\` is already drawn as \`${existing.archetype}\`; ignoring \`${ref.archetype}\`.`,
        line,
        from: ref.from,
        to: ref.to,
      });
    }

    /**
     * Colour is **last-wins**, unlike the archetype above.
     *
     * A contradicted archetype is almost certainly a mistake — one node cannot
     * be two shapes. A restated colour is almost certainly intentional: writing
     * `billing-api #red` further down is how you recolour something without
     * hunting for where you first named it. First-wins would make that
     * statement silently do nothing.
     */
    if (color !== undefined) {
      existing.style = { ...existing.style, color };
    }

    return id;
  }

  for (const statement of parsed.statements) {
    if (statement.kind === "title") {
      if (title === undefined) {
        title = statement.text;
      } else {
        diagnostics.push({
          severity: "warning",
          message: "The diagram already has a title; this one is ignored.",
          line: statement.line,
          from: 0,
          to: statement.text.length + 8,
        });
      }
      continue;
    }

    let left = declare(statement.head, statement.line);

    for (const link of statement.links) {
      const right = declare(link.target, statement.line);
      const { source, target, direction } = orient(link.arrow, left, right);

      const pair = `${source}->${target}`;
      const ordinal = parallel.get(pair) ?? 0;
      parallel.set(pair, ordinal + 1);

      const edge: IREdge = {
        id: edgeId(source, target, ordinal),
        source,
        target,
        direction,
        line: statement.line,
      };
      edges.push(link.label === undefined ? edge : { ...edge, label: link.label });

      // Chaining is left-associative: `a -> b -> c` is a->b and b->c.
      left = right;
    }
  }

  const graph: IRGraph = {
    nodes: [...nodes.values()],
    edges,
    groups: [],
    diagnostics,
  };
  return title === undefined ? graph : { ...graph, title };
}
