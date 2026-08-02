import { describe, expect, it } from "vitest";
import type { IRGraph } from "@/core/ir/types";
import { collectGarbage, type OverrideMap } from "./overrides";

function graph(nodeIds: string[], edgeIds: string[] = []): IRGraph {
  return {
    nodes: nodeIds.map((id, i) => ({
      id,
      label: id,
      archetype: "service",
      line: i,
    })),
    edges: edgeIds.map((id, i) => ({
      id,
      source: "a",
      target: "b",
      direction: "forward" as const,
      line: i,
    })),
    groups: [],
    diagnostics: [],
  };
}

describe("collectGarbage", () => {
  it("keeps overrides whose node still exists", () => {
    const overrides: OverrideMap = {
      user: { kind: "node", x: 10, y: 20, pinned: true },
    };
    expect(collectGarbage(overrides, graph(["user"]))).toEqual(overrides);
  });

  it("drops overrides for nodes deleted from the source", () => {
    const overrides: OverrideMap = {
      user: { kind: "node", x: 10, y: 20, pinned: true },
      ghost: { kind: "node", x: 99, y: 99, pinned: true },
    };
    const kept = collectGarbage(overrides, graph(["user"]));
    expect(Object.keys(kept)).toEqual(["user"]);
  });

  it("keeps edge overrides keyed by a live edge id", () => {
    const overrides: OverrideMap = {
      "a->b#0": { kind: "edge", cp1: { x: 1, y: 2 }, cp2: { x: 3, y: 4 } },
    };
    const kept = collectGarbage(overrides, graph(["a", "b"], ["a->b#0"]));
    expect(kept["a->b#0"]).toEqual(overrides["a->b#0"]);
  });

  it("does not mutate the input map", () => {
    const overrides: OverrideMap = {
      ghost: { kind: "node", x: 1, y: 1, pinned: true },
    };
    collectGarbage(overrides, graph([]));
    expect(Object.keys(overrides)).toEqual(["ghost"]);
  });
});
