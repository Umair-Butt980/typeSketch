import { describe, expect, it } from "vitest";
import { parse } from "@/core/lang";
import { registryResolver } from "@/core/registry";
import type { Archetype, ShapeResolver } from "@/core/registry/types";
import { buildIR, humanize, nodeId } from "./builder";

function build(source: string) {
  return buildIR(parse(source), registryResolver);
}

describe("humanize", () => {
  it("title-cases dashed identifiers", () => {
    expect(humanize("login-page")).toBe("Login Page");
  });

  it("uppercases known acronyms", () => {
    expect(humanize("user-db")).toBe("User DB");
    expect(humanize("auth-api")).toBe("Auth API");
  });
});

describe("buildIR — nodes", () => {
  it("creates a node from a bare declaration", () => {
    const graph = build("user");
    expect(graph.nodes).toEqual([
      { id: "user", label: "User", archetype: "actor", line: 0 },
    ]);
  });

  it("resolves archetypes through the registry", () => {
    const graph = build("user -> database");
    expect(graph.nodes.map((n) => n.archetype)).toEqual(["actor", "database"]);
  });

  /**
   * Resolution is injected rather than imported, which is what lets the v2 LLM
   * tier become a second implementation instead of a rewrite.
   */
  it("takes resolution from whatever resolver it is given", () => {
    const everythingIsAQueue: ShapeResolver = {
      resolve: () => ({ name: "queue" }) as Archetype,
    };
    const graph = buildIR(parse("user -> database"), everythingIsAQueue);
    expect(graph.nodes.map((n) => n.archetype)).toEqual(["queue", "queue"]);
  });

  it("falls back to a box for unknown words rather than erroring", () => {
    const graph = build("flibbertigibbet");
    expect(graph.nodes[0]?.archetype).toBe("box");
    expect(graph.diagnostics).toEqual([]);
  });

  it("resolves an explicit archetype override through the registry", () => {
    // `redis` is an alias, not an archetype name — the IR must carry `cache`
    // or the renderer would have nothing to look up.
    expect(build("sessions:redis").nodes[0]?.archetype).toBe("cache");
  });

  it("warns and falls back when the override names no known shape", () => {
    const graph = build("api:squiggle");
    expect(graph.nodes[0]?.archetype).toBe("service");
    expect(graph.diagnostics[0]).toMatchObject({ severity: "warning" });
  });

  it("resolves compound names by their trailing segment", () => {
    const graph = build("user-db -> auth-api -> session-store");
    expect(graph.nodes.map((n) => n.archetype)).toEqual([
      "database",
      "service",
      "storage",
    ]);
  });

  it("declares each node once however often it is referenced", () => {
    const graph = build(["user -> api", "user -> db", "api -> db"].join("\n"));
    expect(graph.nodes.map((n) => n.id)).toEqual(["user", "api", "db"]);
  });

  it("records the line where a node was first declared", () => {
    const graph = build(["user -> api", "api -> db"].join("\n"));
    expect(graph.nodes.map((n) => [n.id, n.line])).toEqual([
      ["user", 0],
      ["api", 0],
      ["db", 1],
    ]);
  });

  it("warns rather than flip-flopping when an archetype is contradicted", () => {
    const graph = build(["sessions:redis", "sessions:s3"].join("\n"));
    expect(graph.nodes[0]?.archetype).toBe("cache");
    expect(graph.diagnostics).toHaveLength(1);
    expect(graph.diagnostics[0]).toMatchObject({ severity: "warning", line: 1 });
  });

  it("does not warn when two overrides agree", () => {
    const graph = build(["sessions:redis", "sessions:memcached"].join("\n"));
    expect(graph.diagnostics).toEqual([]);
  });

  it("treats identifiers case-insensitively", () => {
    const graph = build(["User -> api", "user -> db"].join("\n"));
    expect(graph.nodes.map((n) => n.id)).toEqual(["user", "api", "db"]);
  });
});

describe("buildIR — edges", () => {
  it("orients a forward arrow", () => {
    const graph = build("user -> api");
    expect(graph.edges[0]).toMatchObject({
      id: "user->api#0",
      source: "user",
      target: "api",
      direction: "forward",
    });
  });

  it("normalises a reverse arrow by swapping the endpoints", () => {
    const graph = build("api <- user");
    expect(graph.edges[0]).toMatchObject({
      source: "user",
      target: "api",
      direction: "forward",
    });
  });

  it("makes a bidirectional edge one edge with two arrowheads", () => {
    const graph = build("api <> database");
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]?.direction).toBe("both");
  });

  it("makes an undirected connector one edge with no arrowheads", () => {
    const graph = build("api -- cdn");
    expect(graph.edges[0]?.direction).toBe("none");
  });

  it("expands a chain left-associatively", () => {
    const graph = build("user -> api -> database");
    expect(graph.edges.map((e) => [e.source, e.target])).toEqual([
      ["user", "api"],
      ["api", "database"],
    ]);
  });

  it("carries edge labels", () => {
    const graph = build('api -"publishes"-> queue');
    expect(graph.edges[0]?.label).toBe("publishes");
  });

  it("supports a self-loop", () => {
    const graph = build('api -"verify password hash"-> api');
    expect(graph.nodes).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({
      source: "api",
      target: "api",
      label: "verify password hash",
    });
  });

  it("distinguishes parallel edges by ordinal", () => {
    const graph = build(['api -"a"-> db', 'api -"b"-> db'].join("\n"));
    expect(graph.edges.map((e) => e.id)).toEqual(["api->db#0", "api->db#1"]);
  });
});

describe("buildIR — title and diagnostics", () => {
  it("reads the title", () => {
    const graph = build('title "Authentication Service"');
    expect(graph.title).toBe("Authentication Service");
  });

  it("keeps the first title and warns about a second", () => {
    const graph = build(['title "One"', 'title "Two"'].join("\n"));
    expect(graph.title).toBe("One");
    expect(graph.diagnostics[0]).toMatchObject({ severity: "warning", line: 1 });
  });

  it("carries parser diagnostics through", () => {
    const graph = build(["user -> api", "api -> "].join("\n"));
    expect(graph.nodes).toHaveLength(2);
    expect(graph.diagnostics).toHaveLength(1);
    expect(graph.diagnostics[0]?.line).toBe(1);
  });
});

describe("the ID stability guarantee", () => {
  it("keeps ids unchanged when a line is inserted at the top", () => {
    const before = build(["user -> api", "api <> database"].join("\n"));
    const after = build(
      ["browser -> user", "user -> api", "api <> database"].join("\n"),
    );

    for (const node of before.nodes) {
      expect(after.nodes.find((n) => n.id === node.id)).toBeDefined();
    }
    for (const edge of before.edges) {
      expect(after.edges.find((e) => e.id === edge.id)).toBeDefined();
    }
  });

  /**
   * The regression this guards is silent and severe: ids derived from ordinal
   * position would renumber on every insertion, so the canvas would reshuffle
   * under the cursor and every drag-pin would jump to the wrong node.
   */
  it("holds for arbitrary documents (property test)", () => {
    const WORDS = ["user", "api", "db", "queue", "cache", "cdn", "worker"];
    const ARROWS = ["->", "<-", "<>", "--"];

    // Seeded LCG: a failure must be reproducible, so no Math.random here.
    let seed = 0x2f6e2b1;
    const next = () => (seed = (seed * 1664525 + 1013904223) >>> 0);
    const pick = <T,>(xs: readonly T[]) => xs[next() % xs.length]!;

    for (let trial = 0; trial < 200; trial++) {
      const lines = Array.from({ length: 1 + (next() % 6) }, () => {
        const length = 1 + (next() % 3);
        let line = pick(WORDS);
        for (let i = 0; i < length; i++) {
          line += ` ${pick(ARROWS)} ${pick(WORDS)}`;
        }
        return line;
      });

      const original = build(lines.join("\n"));
      const prepended = build(["newcomer -> user", ...lines].join("\n"));

      const ids = new Set(prepended.nodes.map((n) => n.id));
      for (const node of original.nodes) {
        expect(ids, `document:\n${lines.join("\n")}`).toContain(node.id);
      }
    }
  });

  it("derives ids from the text, not from position", () => {
    expect(nodeId("Login-Page")).toBe(nodeId("login-page"));

    // The same statement, once alone and once as the second line. Both the
    // node and the edge keep the identity they would have had in isolation.
    const alone = build("a -> b");
    const shifted = build("x -> y\na -> b");

    expect(alone.nodes.map((n) => n.id)).toEqual(["a", "b"]);
    expect(shifted.nodes.map((n) => n.id)).toEqual(["x", "y", "a", "b"]);
    expect(shifted.edges[1]?.id).toBe(alone.edges[0]?.id);
  });
});
