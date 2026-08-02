import type { IRGraph } from "@/core/ir/types";
import type { LayoutResult } from "@/core/layout";

/**
 * The machine-readable export.
 *
 * Deliberately includes the source text alongside the resolved graph: the
 * source is the only authoritative part, and anyone consuming this can either
 * read the flattened graph or re-run the pipeline themselves and get the same
 * answer.
 */
export interface DiagramJSON {
  version: 1;
  title?: string;
  source: string;
  nodes: { id: string; label: string; archetype: string; x: number; y: number; w: number; h: number }[];
  edges: { id: string; source: string; target: string; direction: string; label?: string }[];
}

export function toJSON(
  graph: IRGraph,
  layout: LayoutResult,
  source: string,
): DiagramJSON {
  const placed = new Map(layout.nodes.map((n) => [n.id, n]));

  return {
    version: 1,
    ...(graph.title === undefined ? {} : { title: graph.title }),
    source,
    nodes: graph.nodes.map((node) => {
      const box = placed.get(node.id);
      return {
        id: node.id,
        label: node.label,
        archetype: node.archetype,
        x: box?.x ?? 0,
        y: box?.y ?? 0,
        w: box?.w ?? 0,
        h: box?.h ?? 0,
      };
    }),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      direction: edge.direction,
      ...(edge.label === undefined ? {} : { label: edge.label }),
    })),
  };
}
