import { describe, expect, it } from "vitest";
import { buildIR } from "@/core/ir";
import { parse } from "@/core/lang";
import { registryResolver } from "@/core/registry";
import { createLayoutClient } from "./client";

const build = (source: string) => buildIR(parse(source), registryResolver);

/**
 * These run under Node, where there is no `Worker`, so they exercise the
 * fallback path. That path exists for server render and for tests, and it must
 * produce exactly what the worker would — otherwise `/api/render` and the
 * canvas would disagree, which is the whole thing the isomorphic core prevents.
 */
describe("createLayoutClient without a Worker", () => {
  it("falls back to laying out on the calling thread", async () => {
    const client = createLayoutClient();
    const result = await client.layout(build("user -> api -> db"), {});
    expect(result.nodes).toHaveLength(3);
    client.dispose();
  });

  it("produces the same result as calling the strategy directly", async () => {
    const { layoutGraph } = await import("./elk-strategy");
    const graph = build("user -> auth-api\nauth-api <> user-db");

    const client = createLayoutClient();
    const viaClient = await client.layout(graph, {});
    const direct = await layoutGraph(graph, {});

    expect(viaClient).toEqual(direct);
    client.dispose();
  });

  it("honours pins through the client", async () => {
    const client = createLayoutClient();
    const result = await client.layout(build("user -> api"), {
      api: { kind: "node", x: 500, y: 250, pinned: true },
    });
    expect(result.nodes.find((n) => n.id === "api")).toMatchObject({
      x: 500,
      y: 250,
    });
    client.dispose();
  });

  it("handles concurrent requests", async () => {
    const client = createLayoutClient();
    const [a, b] = await Promise.all([
      client.layout(build("user -> api"), {}),
      client.layout(build("user -> api -> db"), {}),
    ]);
    expect(a.nodes).toHaveLength(2);
    expect(b.nodes).toHaveLength(3);
    client.dispose();
  });

  it("can be disposed without pending work leaking", () => {
    const client = createLayoutClient();
    expect(() => client.dispose()).not.toThrow();
    expect(() => client.dispose()).not.toThrow();
  });
});
