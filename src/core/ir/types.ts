/**
 * The intermediate representation: what a TypeSketch document *means*, with no
 * opinion about where anything sits on screen or how it is stroked.
 *
 * Layout consumes this. Rendering consumes layout. Neither can reach backwards.
 */

export type Direction = "forward" | "both" | "none";

export interface StyleOverride {
  color?: string;
  fill?: string;
}

export interface IRNode {
  /**
   * Derived from the normalised label plus group path — never from line number
   * or ordinal position. This is what keeps the canvas from reshuffling when a
   * line is inserted above, keeps drag-pins attached to the right node, and
   * keeps each shape's hand-drawn wobble identical across renders.
   */
  id: string;
  label: string;
  archetype: string;
  group?: string;
  style?: StyleOverride;
  /** Line in the source that declared this node, for editor <-> canvas linking. */
  line: number;
}

export interface IREdge {
  /** `${source}->${target}#${ordinal}`; ordinal disambiguates parallel edges. */
  id: string;
  source: string;
  target: string;
  direction: Direction;
  label?: string;
  line: number;
}

export interface IRGroup {
  id: string;
  label: string;
  parent?: string;
  line: number;
}

export type DiagnosticSeverity = "error" | "warning";

export interface Diagnostic {
  severity: DiagnosticSeverity;
  message: string;
  line: number;
  /** Column range within the line, 0-indexed, end-exclusive. */
  from: number;
  to: number;
}

export interface IRGraph {
  title?: string;
  nodes: IRNode[];
  edges: IREdge[];
  groups: IRGroup[];
  diagnostics: Diagnostic[];
}

/** A self-loop: an edge whose source and target are the same node. */
export function isSelfLoop(edge: IREdge): boolean {
  return edge.source === edge.target;
}

export const EMPTY_GRAPH: IRGraph = {
  nodes: [],
  edges: [],
  groups: [],
  diagnostics: [],
};
