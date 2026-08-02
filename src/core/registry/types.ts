/**
 * Archetypes declare **geometry**, not markup.
 *
 * A cylinder is "two arcs and two sides" — it is not an SVG string and not a
 * React component. Both renderers consume the same primitives: the clean one
 * emits crisp paths, the sketch one feeds each primitive through Rough.js.
 * Without this split every shape would have to be authored twice.
 */

interface PrimBase {
  /** Does this primitive enclose an area that should be painted? */
  filled?: boolean;
  dashed?: boolean;
}

export type Prim =
  | (PrimBase & { k: "rect"; x: number; y: number; w: number; h: number; r?: number })
  | (PrimBase & { k: "ellipse"; cx: number; cy: number; rx: number; ry: number })
  | (PrimBase & { k: "line"; x1: number; y1: number; x2: number; y2: number })
  | (PrimBase & { k: "path"; d: string });

/** Where a node's text label sits relative to its geometry. */
export type LabelSlot = "inside" | "below";

export interface Archetype {
  name: string;
  aliases: readonly string[];
  defaultSize: { w: number; h: number };
  labelSlot: LabelSlot;
  /** Primitives in local coordinates, origin at the shape's top-left. */
  geometry(w: number, h: number): Prim[];
}

/**
 * Resolution sits behind an interface so the v2 LLM tier is a second
 * implementation rather than a rewrite.
 */
export interface ShapeResolver {
  resolve(label: string): Archetype | null;
}

/**
 * What an unrecognised word renders as. Unknown vocabulary must never be an
 * error and must never block typing — it degrades to a labelled rectangle.
 */
export const FALLBACK_ARCHETYPE = "box";
