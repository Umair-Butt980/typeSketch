import type { IRGraph } from "./types";

/**
 * How much work a change actually costs.
 *
 * `topological` means the graph's shape changed, so ELK has to run again.
 * `cosmetic` means it did not — the same boxes are in the same places and only
 * their painted detail differs, so the existing layout is reused verbatim.
 *
 * This distinction is the whole reason typing feels instant: most keystrokes
 * while editing a label or flipping an arrowhead are cosmetic, and a relayout
 * on each of them would visibly shift the diagram under the cursor.
 */
export type DiffKind = "none" | "cosmetic" | "topological";

/**
 * Deliberately **not** topological:
 *
 * - `direction` — `a -> b` becoming `a <> b` adds an arrowhead to an existing
 *   spline. The nodes must not move; that is a documented guarantee.
 * - `label`, `title`, `style` — painted detail only.
 * - `line` — moving a statement changes nothing the canvas can see.
 *
 * Archetype **is** topological, because a different shape has a different
 * footprint and everything around it has to make room.
 */
function topologyOf(graph: IRGraph): string {
  const nodes = graph.nodes
    .map((n) => `${n.id}:${n.archetype}:${n.group ?? ""}`)
    .sort()
    .join("|");
  const edges = graph.edges.map((e) => e.id).sort().join("|");
  const groups = graph.groups
    .map((g) => `${g.id}:${g.parent ?? ""}`)
    .sort()
    .join("|");
  return `${nodes}\n${edges}\n${groups}`;
}

function appearanceOf(graph: IRGraph): string {
  const nodes = graph.nodes
    .map((n) => `${n.id}:${n.label}:${JSON.stringify(n.style ?? null)}`)
    .sort()
    .join("|");
  const edges = graph.edges
    .map((e) => `${e.id}:${e.direction}:${e.label ?? ""}`)
    .sort()
    .join("|");
  return `${graph.title ?? ""}\n${nodes}\n${edges}`;
}

export function diffGraphs(prev: IRGraph, next: IRGraph): DiffKind {
  if (topologyOf(prev) !== topologyOf(next)) return "topological";
  if (appearanceOf(prev) !== appearanceOf(next)) return "cosmetic";
  return "none";
}

/** Convenience for the render loop: does this change require running ELK? */
export function needsRelayout(kind: DiffKind): boolean {
  return kind === "topological";
}
