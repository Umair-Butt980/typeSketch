import type { Archetype } from "@/core/registry/types";

/**
 * Node sizing must be **isomorphic**: layout runs in a Web Worker and again on
 * the server for `/api/render`, neither of which has a DOM to measure text
 * with. So text width is estimated from character count rather than measured.
 *
 * The estimate is deliberately generous. Being slightly too wide leaves a
 * little air around a label; being too narrow clips it, which is the failure
 * users actually notice.
 */

export const LABEL_FONT_SIZE = 14;
export const LABEL_LINE_HEIGHT = 18;
/** Gap between an actor's feet and its label. */
export const LABEL_BELOW_GAP = 8;
/** Horizontal breathing room either side of an inside label. */
export const LABEL_PADDING_X = 22;

/** Average glyph width as a fraction of font size, for the faces we ship. */
const GLYPH_RATIO = 0.58;

export function estimateTextWidth(text: string, fontSize = LABEL_FONT_SIZE): number {
  return Math.ceil(text.length * fontSize * GLYPH_RATIO);
}

export interface NodeBox {
  /** Total footprint handed to the layout engine. */
  w: number;
  h: number;
  /** The drawn shape, which for a `below` label is shorter than the footprint. */
  shapeW: number;
  shapeH: number;
}

/**
 * An inside label grows its shape horizontally; a below label grows the
 * footprint vertically and leaves the shape alone. That difference is exactly
 * why `labelSlot` exists — an actor is a fixed-size stick figure with text
 * underneath, not a box with text in it.
 */
export function measureNode(archetype: Archetype, label: string): NodeBox {
  const { w, h } = archetype.defaultSize;

  if (archetype.labelSlot === "below") {
    const textWidth = estimateTextWidth(label);
    return {
      shapeW: w,
      shapeH: h,
      w: Math.max(w, textWidth),
      h: h + LABEL_BELOW_GAP + LABEL_LINE_HEIGHT,
    };
  }

  const needed = estimateTextWidth(label) + LABEL_PADDING_X * 2;
  const width = Math.max(w, needed);
  return { w: width, h, shapeW: width, shapeH: h };
}

/** Where the label's baseline block sits within the node's footprint. */
export function labelPosition(archetype: Archetype, box: NodeBox) {
  return archetype.labelSlot === "below"
    ? { x: box.w / 2, y: box.shapeH + LABEL_BELOW_GAP + LABEL_FONT_SIZE }
    : { x: box.w / 2, y: box.shapeH / 2 + LABEL_FONT_SIZE * 0.35 };
}

/** A `below` label leaves the shape centred horizontally in a wider footprint. */
export function shapeOffset(box: NodeBox): { x: number; y: number } {
  return { x: (box.w - box.shapeW) / 2, y: 0 };
}
