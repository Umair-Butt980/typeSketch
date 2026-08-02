import ELK from "elkjs/lib/elk.bundled.js";
import { isSelfLoop, type IRGraph } from "@/core/ir/types";
import { archetypeByName } from "@/core/registry";
import { measureNode } from "@/core/render";
import { isNodeOverride, type OverrideMap } from "./overrides";

export interface LaidOutNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutResult {
  nodes: LaidOutNode[];
  width: number;
  height: number;
}

/**
 * Layered, left-to-right — the reading order of an architecture diagram.
 * Spacing is generous because hand-drawn strokes need room to breathe; at
 * tighter values the wobble of neighbouring shapes starts to collide.
 */
export const LAYOUT_OPTIONS: Record<string, string> = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.spacing.nodeNode": "70",
  "elk.layered.spacing.nodeNodeBetweenLayers": "120",
  "elk.spacing.edgeNode": "40",
  "elk.spacing.edgeEdge": "25",
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
  // Keep declaration order influential, so the diagram broadly follows the
  // order the user typed rather than being reshuffled by the solver.
  "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
};

/**
 * Node footprints, measured without a DOM so the worker and the server agree.
 * Exported separately because it is pure — the ELK call is the only async part.
 */
export function nodeBoxes(graph: IRGraph): Map<string, { w: number; h: number }> {
  const boxes = new Map<string, { w: number; h: number }>();
  for (const node of graph.nodes) {
    const box = measureNode(archetypeByName(node.archetype), node.label);
    boxes.set(node.id, { w: box.w, h: box.h });
  }
  return boxes;
}

interface ElkNode {
  id: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  children?: ElkNode[];
  edges?: { id: string; sources: string[]; targets: string[] }[];
  layoutOptions?: Record<string, string>;
}

export function toElkGraph(graph: IRGraph, overrides: OverrideMap = {}): ElkNode {
  const boxes = nodeBoxes(graph);
  const hasPins = graph.nodes.some((n) => {
    const o = overrides[n.id];
    return o !== undefined && isNodeOverride(o);
  });

  return {
    id: "root",
    layoutOptions: {
      ...LAYOUT_OPTIONS,
      ...(hasPins ? { "elk.interactiveLayout": "true" } : {}),
    },
    children: graph.nodes.map((node) => {
      const box = boxes.get(node.id)!;
      const override = overrides[node.id];
      const pinned = override && isNodeOverride(override) ? override : null;
      return {
        id: node.id,
        width: box.w,
        height: box.h,
        // Pins are passed as hints. ELK treats them as advisory, which is why
        // there is also a hard post-pass below.
        ...(pinned ? { x: pinned.x, y: pinned.y } : {}),
      };
    }),
    /**
     * Self-loops are excluded deliberately. ELK routes them poorly and they
     * carry no layout information — a node's loop is drawn from the node's own
     * box, so it cannot influence where anything sits.
     */
    edges: graph.edges
      .filter((edge) => !isSelfLoop(edge))
      .map((edge) => ({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
      })),
  };
}

/**
 * ELK honours position hints only when it feels like it. The guarantee users
 * actually care about — "the node I dragged does not move" — has to hold
 * unconditionally, so pinned coordinates are written back afterwards.
 */
export function pinOverrides(
  nodes: LaidOutNode[],
  overrides: OverrideMap,
): LaidOutNode[] {
  return nodes.map((node) => {
    const override = overrides[node.id];
    if (!override || !isNodeOverride(override)) return node;
    return { ...node, x: override.x, y: override.y };
  });
}

function extentOf(nodes: LaidOutNode[]): { width: number; height: number } {
  let width = 0;
  let height = 0;
  for (const node of nodes) {
    width = Math.max(width, node.x + node.w);
    height = Math.max(height, node.y + node.h);
  }
  return { width, height };
}

const elk = new ELK();

export async function layoutGraph(
  graph: IRGraph,
  overrides: OverrideMap = {},
): Promise<LayoutResult> {
  if (graph.nodes.length === 0) {
    return { nodes: [], width: 0, height: 0 };
  }

  const result = (await elk.layout(toElkGraph(graph, overrides))) as ElkNode;

  const laidOut: LaidOutNode[] = (result.children ?? []).map((child) => ({
    id: child.id,
    x: child.x ?? 0,
    y: child.y ?? 0,
    w: child.width ?? 0,
    h: child.height ?? 0,
  }));

  const nodes = pinOverrides(laidOut, overrides);
  return { nodes, ...extentOf(nodes) };
}
