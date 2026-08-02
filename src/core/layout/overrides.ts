import type { IRGraph } from "@/core/ir/types";

/**
 * Presentation state — the one thing the typed source does *not* own.
 *
 * The text says which nodes exist and how they connect; this says where the
 * user dragged them and how they bowed the arrows. Keyed by stable IR id, so a
 * pin survives arbitrary edits elsewhere in the document.
 */

export interface Point {
  x: number;
  y: number;
}

export interface NodeOverride {
  kind: "node";
  x: number;
  y: number;
  pinned: true;
}

export interface EdgeOverride {
  kind: "edge";
  cp1: Point;
  cp2: Point;
}

export type Override = NodeOverride | EdgeOverride;
export type OverrideMap = Record<string, Override>;

export function isNodeOverride(o: Override): o is NodeOverride {
  return o.kind === "node";
}

export function isEdgeOverride(o: Override): o is EdgeOverride {
  return o.kind === "edge";
}

/**
 * Drop overrides whose node or edge no longer exists in the document.
 *
 * Without this, deleting a line and later re-adding it would resurrect a stale
 * pin and drop the node somewhere the user last left it months ago rather than
 * where layout wants it now.
 */
export function collectGarbage(
  overrides: OverrideMap,
  graph: IRGraph,
): OverrideMap {
  const live = new Set<string>([
    ...graph.nodes.map((n) => n.id),
    ...graph.edges.map((e) => e.id),
  ]);

  const kept: OverrideMap = {};
  for (const [id, override] of Object.entries(overrides)) {
    if (live.has(id)) kept[id] = override;
  }
  return kept;
}
