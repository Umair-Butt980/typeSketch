import { describe, expect, it } from "vitest";
import { buildIR } from "@/core/ir";
import { parse } from "@/core/lang";
import { registryResolver } from "@/core/registry";
import { createLayoutClient } from "./client";

const build = (source: string) => buildIR(parse(source), registryResolver);

/**
 * These run under Node, where there is no `Worker`, so ELK uses its bundled
 * in-process solver rather than spawning one.
 *
 * Worth being blunt about the limit: that difference is exactly why this suite
 * stayed green while the browser threw `_Worker is not a constructor` on every
 * layout. Node and the browser take different paths through elkjs, and only one
 * of them is covered here.
 */
describe("createLayoutClient under Node", () => {
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
