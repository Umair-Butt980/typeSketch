import { describe, expect, it } from "vitest";
import { buildIR } from "@/core/ir";
import { parse } from "@/core/lang";
import { registryResolver } from "@/core/registry";
import {
  layoutGraph,
  nodeBoxes,
  pinOverrides,
  toElkGraph,
  type LaidOutNode,
} from "./elk-strategy";
import type { OverrideMap } from "./overrides";

const build = (source: string) => buildIR(parse(source), registryResolver);
const byId = (nodes: LaidOutNode[], id: string) => nodes.find((n) => n.id === id)!;

describe("nodeBoxes", () => {
  it("measures every node", () => {
    const boxes = nodeBoxes(build("user -> auth-api"));
    expect([...boxes.keys()].sort()).toEqual(["auth-api", "user"]);
  });

  it("gives an actor a different footprint from a service", () => {
    const boxes = nodeBoxes(build("user -> api"));
    expect(boxes.get("user")).not.toEqual(boxes.get("api"));
  });
});

describe("toElkGraph", () => {
  it("carries every node with a positive size", () => {
    const elk = toElkGraph(build("user -> api -> db"));
    expect(elk.children).toHaveLength(3);
    for (const child of elk.children!) {
      expect(child.width).toBeGreaterThan(0);
      expect(child.height).toBeGreaterThan(0);
    }
  });

  /**
   * A self-loop carries no layout information — it is drawn from the node's own
   * box — and ELK routes them poorly, so it must never reach the solver.
   */
  it("excludes self-loops", () => {
    const elk = toElkGraph(build('api -"verify"-> api\napi -> db'));
    expect(elk.edges?.map((e) => e.id)).toEqual(["api->db#0"]);
  });

  it("does not turn on interactive layout when nothing is pinned", () => {
    const elk = toElkGraph(build("user -> api"));
    expect(elk.layoutOptions?.["elk.interactiveLayout"]).toBeUndefined();
  });

  it("turns on interactive layout and passes hints when something is pinned", () => {
    const overrides: OverrideMap = {
      user: { kind: "node", x: 40, y: 80, pinned: true },
    };
    const elk = toElkGraph(build("user -> api"), overrides);
    expect(elk.layoutOptions?.["elk.interactiveLayout"]).toBe("true");
    expect(elk.children?.find((c) => c.id === "user")).toMatchObject({ x: 40, y: 80 });
  });

  it("ignores an edge override when placing nodes", () => {
    const overrides: OverrideMap = {
      "user->api#0": { kind: "edge", cp1: { x: 1, y: 1 }, cp2: { x: 2, y: 2 } },
    };
    const elk = toElkGraph(build("user -> api"), overrides);
    expect(elk.layoutOptions?.["elk.interactiveLayout"]).toBeUndefined();
  });
});

describe("pinOverrides", () => {
  const nodes: LaidOutNode[] = [
    { id: "user", x: 0, y: 0, w: 50, h: 70 },
    { id: "api", x: 200, y: 0, w: 150, h: 64 },
  ];

  /** The guarantee: a dragged node does not move, unconditionally. */
  it("forces a pinned node to its exact coordinates", () => {
    const pinned = pinOverrides(nodes, {
      user: { kind: "node", x: 999, y: 42, pinned: true },
    });
    expect(byId(pinned, "user")).toMatchObject({ x: 999, y: 42 });
  });

  it("leaves unpinned nodes where the solver put them", () => {
    const pinned = pinOverrides(nodes, {
      user: { kind: "node", x: 999, y: 42, pinned: true },
    });
    expect(byId(pinned, "api")).toMatchObject({ x: 200, y: 0 });
  });

  it("ignores overrides for nodes that are not present", () => {
    expect(pinOverrides(nodes, { ghost: { kind: "node", x: 1, y: 1, pinned: true } })).toEqual(nodes);
  });

  it("ignores edge overrides", () => {
    expect(
      pinOverrides(nodes, {
        user: { kind: "edge", cp1: { x: 1, y: 1 }, cp2: { x: 2, y: 2 } },
      }),
    ).toEqual(nodes);
  });
});

describe("layoutGraph", () => {
  it("returns nothing for an empty document", async () => {
    const result = await layoutGraph(build(""));
    expect(result).toEqual({ nodes: [], width: 0, height: 0 });
  });

  it("places every node with a size", async () => {
    const { nodes } = await layoutGraph(build("user -> api -> db"));
    expect(nodes).toHaveLength(3);
    for (const node of nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      expect(node.w).toBeGreaterThan(0);
    }
  });

  it("flows left to right", async () => {
    const { nodes } = await layoutGraph(build("user -> api -> db"));
    expect(byId(nodes, "user").x).toBeLessThan(byId(nodes, "api").x);
    expect(byId(nodes, "api").x).toBeLessThan(byId(nodes, "db").x);
  });

  it("does not overlap nodes in the same layer", async () => {
    const { nodes } = await layoutGraph(build("user -> api\nuser -> db\nuser -> queue"));
    const layer = nodes.filter((n) => n.id !== "user").sort((a, b) => a.y - b.y);
    for (let i = 1; i < layer.length; i++) {
      const above = layer[i - 1]!;
      expect(layer[i]!.y).toBeGreaterThanOrEqual(above.y + above.h);
    }
  });

  it("lays out a lone node with a self-loop", async () => {
    const { nodes } = await layoutGraph(build('api -"verify"-> api'));
    expect(nodes).toHaveLength(1);
  });

  it("reports an extent covering every node", async () => {
    const { nodes, width, height } = await layoutGraph(build("user -> api -> db"));
    for (const node of nodes) {
      expect(node.x + node.w).toBeLessThanOrEqual(width);
      expect(node.y + node.h).toBeLessThanOrEqual(height);
    }
  });

  it("honours a pin end to end", async () => {
    const { nodes } = await layoutGraph(build("user -> api"), {
      api: { kind: "node", x: 777, y: 333, pinned: true },
    });
    expect(byId(nodes, "api")).toMatchObject({ x: 777, y: 333 });
  });

  it("is deterministic for the same document", async () => {
    const a = await layoutGraph(build("user -> api -> db\napi <> cache"));
    const b = await layoutGraph(build("user -> api -> db\napi <> cache"));
    expect(b).toEqual(a);
  });

  /**
   * Direction is a cosmetic change, so the differ will not even ask for a
   * relayout — but if it ever did, the positions must be identical anyway.
   */
  it("places nodes identically whatever the arrow direction", async () => {
    const forward = await layoutGraph(build("user -> api"));
    const both = await layoutGraph(build("user <> api"));
    expect(both.nodes).toEqual(forward.nodes);
  });
});
