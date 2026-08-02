import { describe, expect, it } from "vitest";
import {
  arrowheadsFor,
  edgeGeometry,
  selfLoopGeometry,
  type Point,
} from "./edges";

const A: Point = { x: 0, y: 100 };
const B: Point = { x: 300, y: 100 };

describe("edgeGeometry", () => {
  it("starts and ends where it is told", () => {
    const g = edgeGeometry(A, B);
    expect(g.start).toEqual(A);
    expect(g.end).toEqual(B);
  });

  it("emits a cubic bezier", () => {
    expect(edgeGeometry(A, B).d).toMatch(/^M [\d.-]+ [\d.-]+ C /);
  });

  it("bows horizontally, matching the left-to-right flow", () => {
    const g = edgeGeometry(A, B);
    expect(g.cp1.x).toBeGreaterThan(A.x);
    expect(g.cp2.x).toBeLessThan(B.x);
    expect(g.cp1.y).toBe(A.y);
  });

  it("puts the midpoint between the endpoints, for the label", () => {
    const g = edgeGeometry(A, B);
    expect(g.mid.x).toBeGreaterThan(A.x);
    expect(g.mid.x).toBeLessThan(B.x);
  });

  it("caps how far control points reach on a very long edge", () => {
    const long = edgeGeometry({ x: 0, y: 0 }, { x: 5000, y: 0 });
    expect(long.cp1.x).toBeLessThanOrEqual(220);
  });

  it("keeps a short edge from collapsing", () => {
    const short = edgeGeometry({ x: 0, y: 0 }, { x: 10, y: 0 });
    expect(short.cp1.x).toBeGreaterThanOrEqual(40);
  });

  it("is deterministic", () => {
    expect(edgeGeometry(A, B)).toEqual(edgeGeometry(A, B));
  });

  /** This is what makes a dragged control handle persist in P2.5. */
  it("honours a control-point override", () => {
    const override = { cp1: { x: 10, y: 10 }, cp2: { x: 20, y: 20 } };
    const g = edgeGeometry(A, B, override);
    expect(g.cp1).toEqual(override.cp1);
    expect(g.cp2).toEqual(override.cp2);
    expect(g.d).toContain("C 10 10 20 20");
  });

  it("points its end tangent along the direction of travel", () => {
    // Straight left-to-right: the arrowhead should point right, angle ~0.
    expect(Math.abs(edgeGeometry(A, B).endAngle)).toBeLessThan(0.01);
  });
});

describe("selfLoopGeometry", () => {
  const node = { x: 100, y: 200, w: 150, h: 64 };

  it("leaves and re-enters the top of the node", () => {
    const g = selfLoopGeometry(node);
    expect(g.start.y).toBe(node.y);
    expect(g.end.y).toBe(node.y);
    expect(g.start.x).toBeLessThan(g.end.x);
  });

  it("arcs above the node", () => {
    const g = selfLoopGeometry(node);
    expect(g.cp1.y).toBeLessThan(node.y);
    expect(g.mid.y).toBeLessThan(node.y);
  });

  it("stays within a sensible horizontal span of the node", () => {
    const g = selfLoopGeometry(node);
    expect(g.start.x).toBeGreaterThan(node.x - node.w);
    expect(g.end.x).toBeLessThan(node.x + node.w * 2);
  });

  it("needs no layout information beyond the node's own box", () => {
    expect(selfLoopGeometry(node)).toEqual(selfLoopGeometry({ ...node }));
  });

  it("honours a control-point override", () => {
    const override = { cp1: { x: 1, y: 2 }, cp2: { x: 3, y: 4 } };
    expect(selfLoopGeometry(node, override).cp1).toEqual(override.cp1);
  });
});

describe("arrowheadsFor", () => {
  const g = edgeGeometry(A, B);

  it("draws nothing for an undirected connector", () => {
    expect(arrowheadsFor(g, "none")).toEqual([]);
  });

  it("draws two barbs for a forward arrow", () => {
    expect(arrowheadsFor(g, "forward")).toHaveLength(2);
  });

  it("draws four barbs for a bidirectional edge — two heads on one edge", () => {
    expect(arrowheadsFor(g, "both")).toHaveLength(4);
  });

  it("anchors the forward head at the edge's end", () => {
    const [barb] = arrowheadsFor(g, "forward");
    expect(barb).toContain(`M ${B.x} ${B.y}`);
  });

  it("anchors the second head of a bidirectional edge at the start", () => {
    const barbs = arrowheadsFor(g, "both");
    expect(barbs.slice(2).every((b) => b.startsWith(`M ${A.x} ${A.y}`))).toBe(true);
  });

  it("emits line segments, not a filled marker", () => {
    for (const barb of arrowheadsFor(g, "both")) {
      expect(barb).toMatch(/^M [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+$/);
      expect(barb).not.toContain("Z");
    }
  });
});
