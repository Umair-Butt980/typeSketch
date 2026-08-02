import type { Direction } from "@/core/ir/types";

/**
 * Edge geometry, as pure maths.
 *
 * React Flow's built-in edges give none of what the reference needs — no
 * control-point handles, no self-loops, no hand-drawn stroke — so edges are
 * drawn from scratch. Keeping the maths here rather than in the component means
 * the server exporter draws exactly the same curves.
 */

export interface Point {
  x: number;
  y: number;
}

export interface EdgeGeometry {
  /** The cubic bezier, as SVG path data. */
  d: string;
  cp1: Point;
  cp2: Point;
  start: Point;
  end: Point;
  /** Outgoing tangent at `start`, in radians. */
  startAngle: number;
  /** Incoming tangent at `end`, in radians — where a forward arrowhead points. */
  endAngle: number;
  /** Bezier midpoint, where the label sits. */
  mid: Point;
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * How far control points reach along the flow axis. Long edges bow more, but
 * the reach is capped so a very long edge does not swing wildly out of the
 * diagram.
 */
function reach(dx: number, dy: number): number {
  const distance = Math.hypot(dx, dy);
  return Math.min(Math.max(distance * 0.42, 40), 220);
}

function cubicAt(t: number, a: Point, b: Point, c: Point, d: Point): Point {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
}

function pathOf(start: Point, cp1: Point, cp2: Point, end: Point): string {
  return [
    `M ${round(start.x)} ${round(start.y)}`,
    `C ${round(cp1.x)} ${round(cp1.y)}`,
    `${round(cp2.x)} ${round(cp2.y)}`,
    `${round(end.x)} ${round(end.y)}`,
  ].join(" ");
}

/**
 * A normal edge between two anchor points.
 *
 * Control points extend horizontally by default, matching the left-to-right
 * flow ELK lays out — that is what produces the long, calm curves in the
 * reference rather than taut diagonals. A caller-supplied override replaces
 * them wholesale, which is how dragged control handles persist.
 */
export function edgeGeometry(
  start: Point,
  end: Point,
  override?: { cp1: Point; cp2: Point },
): EdgeGeometry {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const r = reach(dx, dy);

  const cp1 = override?.cp1 ?? { x: start.x + r, y: start.y };
  const cp2 = override?.cp2 ?? { x: end.x - r, y: end.y };

  return {
    d: pathOf(start, cp1, cp2, end),
    cp1,
    cp2,
    start,
    end,
    startAngle: Math.atan2(cp1.y - start.y, cp1.x - start.x),
    endAngle: Math.atan2(end.y - cp2.y, end.x - cp2.x),
    mid: cubicAt(0.5, start, cp1, cp2, end),
  };
}

/**
 * A self-loop, which ELK does not route usefully.
 *
 * The arc leaves the top of the node and re-enters it a little to the right,
 * exactly like the `verify password hash` loop in the reference. Because it is
 * derived from the node's own box it needs no layout information at all.
 */
export function selfLoopGeometry(
  node: { x: number; y: number; w: number; h: number },
  override?: { cp1: Point; cp2: Point },
): EdgeGeometry {
  const spread = Math.min(node.w * 0.34, 46);
  const height = Math.max(46, node.h * 0.72);

  const start: Point = { x: node.x + node.w / 2 - spread, y: node.y };
  const end: Point = { x: node.x + node.w / 2 + spread, y: node.y };

  const cp1 = override?.cp1 ?? { x: start.x - spread * 0.5, y: node.y - height };
  const cp2 = override?.cp2 ?? { x: end.x + spread * 0.5, y: node.y - height };

  return {
    d: pathOf(start, cp1, cp2, end),
    cp1,
    cp2,
    start,
    end,
    startAngle: Math.atan2(cp1.y - start.y, cp1.x - start.x),
    endAngle: Math.atan2(end.y - cp2.y, end.x - cp2.x),
    mid: cubicAt(0.5, start, cp1, cp2, end),
  };
}

/** Half-angle of the arrowhead's spread, and the length of each barb. */
const BARB_ANGLE = 0.42;
const BARB_LENGTH = 11;

/**
 * An arrowhead as two short strokes rather than an SVG `marker`.
 *
 * A marker would render as a crisp filled triangle and look pasted onto a
 * hand-drawn line. Two lines go through Rough.js with everything else.
 */
export function arrowheadPaths(tip: Point, angle: number): string[] {
  return [angle + Math.PI - BARB_ANGLE, angle + Math.PI + BARB_ANGLE].map((a) =>
    [
      `M ${round(tip.x)} ${round(tip.y)}`,
      `L ${round(tip.x + Math.cos(a) * BARB_LENGTH)} ${round(tip.y + Math.sin(a) * BARB_LENGTH)}`,
    ].join(" "),
  );
}

/**
 * Which ends of an edge get an arrowhead.
 *
 * `both` is one edge with two heads, never two opposing edges — two edges would
 * route as two separate splines and read as two relationships.
 */
export function arrowheadsFor(geometry: EdgeGeometry, direction: Direction): string[] {
  switch (direction) {
    case "none":
      return [];
    case "forward":
      return arrowheadPaths(geometry.end, geometry.endAngle);
    case "both":
      return [
        ...arrowheadPaths(geometry.end, geometry.endAngle),
        // The tail head points back the way the curve came.
        ...arrowheadPaths(geometry.start, geometry.startAngle + Math.PI),
      ];
  }
}
