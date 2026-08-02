import { RoughGenerator } from "roughjs/bin/generator";
import type { Prim } from "@/core/registry/types";
import { seedForPart } from "./seed";

export type RenderMode = "sketch" | "clean";

/** Fills paint first, strokes on top. */
export type PaintRole = "fill" | "stroke";

export interface DrawPath {
  d: string;
  role: PaintRole;
  dashed?: boolean;
}

/**
 * Tuned against the reference: enough wobble to read as hand-drawn, not so much
 * that a 60-node diagram looks unstable.
 */
export const SKETCH = {
  roughness: 1.2,
  bowing: 1.5,
  strokeWidth: 1.6,
  curveFitting: 0.96,
} as const;

/**
 * Rough.js only emits a fill path when it is given a fill colour, but the real
 * colour is a CSS variable applied at paint time. This placeholder exists only
 * to make the filler run; nothing downstream reads it.
 */
const FILL_TRIGGER = "#000000";

const generator = new RoughGenerator();

const round = (n: number) => Math.round(n * 100) / 100;

function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  if (radius === 0) {
    return `M ${x} ${y} H ${round(x + w)} V ${round(y + h)} H ${x} Z`;
  }
  const right = round(x + w);
  const bottom = round(y + h);
  return [
    `M ${round(x + radius)} ${y}`,
    `H ${round(right - radius)}`,
    `A ${radius} ${radius} 0 0 1 ${right} ${round(y + radius)}`,
    `V ${round(bottom - radius)}`,
    `A ${radius} ${radius} 0 0 1 ${round(right - radius)} ${bottom}`,
    `H ${round(x + radius)}`,
    `A ${radius} ${radius} 0 0 1 ${x} ${round(bottom - radius)}`,
    `V ${round(y + radius)}`,
    `A ${radius} ${radius} 0 0 1 ${round(x + radius)} ${y}`,
    "Z",
  ].join(" ");
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  return [
    `M ${round(cx - rx)} ${cy}`,
    `A ${rx} ${ry} 0 1 0 ${round(cx + rx)} ${cy}`,
    `A ${rx} ${ry} 0 1 0 ${round(cx - rx)} ${cy}`,
    "Z",
  ].join(" ");
}

/** Is this primitive an area (paint it) or a stroke (outline only)? */
function encloses(prim: Prim): boolean {
  if (prim.filled !== undefined) return prim.filled;
  return prim.k === "rect" || prim.k === "ellipse";
}

function cleanPaths(prim: Prim): DrawPath[] {
  let d: string;
  switch (prim.k) {
    case "rect":
      d = roundedRectPath(prim.x, prim.y, prim.w, prim.h, prim.r ?? 0);
      break;
    case "ellipse":
      d = ellipsePath(prim.cx, prim.cy, prim.rx, prim.ry);
      break;
    case "line":
      d = `M ${prim.x1} ${prim.y1} L ${prim.x2} ${prim.y2}`;
      break;
    case "path":
      d = prim.d;
      break;
  }

  const stroke: DrawPath = prim.dashed ? { d, role: "stroke", dashed: true } : { d, role: "stroke" };
  return encloses(prim) ? [{ d, role: "fill" }, stroke] : [stroke];
}

function sketchPaths(prim: Prim, seed: number): DrawPath[] {
  const filled = encloses(prim);
  const options = {
    ...SKETCH,
    seed,
    ...(filled ? { fill: FILL_TRIGGER, fillStyle: "solid" as const } : {}),
  };

  let drawable;
  switch (prim.k) {
    case "rect":
      // Rough.js has no rounded rectangle. At this roughness the corner radius
      // is invisible anyway, so the sharp variant is used deliberately.
      drawable = generator.rectangle(prim.x, prim.y, prim.w, prim.h, options);
      break;
    case "ellipse":
      drawable = generator.ellipse(prim.cx, prim.cy, prim.rx * 2, prim.ry * 2, options);
      break;
    case "line":
      drawable = generator.line(prim.x1, prim.y1, prim.x2, prim.y2, options);
      break;
    case "path":
      drawable = generator.path(prim.d, options);
      break;
  }

  const fills: DrawPath[] = [];
  const strokes: DrawPath[] = [];

  for (const set of drawable.sets) {
    const d = generator.opsToPath(set);
    if (d === "") continue;
    if (set.type === "fillPath") {
      fills.push({ d, role: "fill" });
    } else {
      strokes.push(prim.dashed ? { d, role: "stroke", dashed: true } : { d, role: "stroke" });
    }
  }

  // Fills first so strokes sit on top, whatever order Rough.js returned them in.
  return [...fills, ...strokes];
}

/**
 * Turn a shape's geometry into paint instructions.
 *
 * Pure: for a given (prims, mode, key) it always returns identical path data.
 * That is the property the anti-shimmer test pins down, and the reason server
 * render matches the canvas byte for byte.
 */
export function primsToPaths(prims: Prim[], mode: RenderMode, key: string): DrawPath[] {
  return prims.flatMap((prim, index) =>
    mode === "clean" ? cleanPaths(prim) : sketchPaths(prim, seedForPart(key, index)),
  );
}

/**
 * Path generation is cheap but not free, and it must never run per keystroke.
 * Keyed on everything that can change the output, so a cache hit is always
 * correct rather than merely likely.
 */
const CACHE_LIMIT = 2000;
const cache = new Map<string, DrawPath[]>();

export function drawShape(
  prims: Prim[],
  mode: RenderMode,
  key: string,
  w: number,
  h: number,
): DrawPath[] {
  const cacheKey = `${key}|${mode}|${w}x${h}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  const paths = primsToPaths(prims, mode, key);

  // Crude eviction: the working set is one document's worth of shapes, so
  // clearing wholesale on overflow is cheaper than tracking recency.
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(cacheKey, paths);
  return paths;
}

/** Test seam. */
export function clearShapeCache(): void {
  cache.clear();
}
