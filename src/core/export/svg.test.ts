import { describe, expect, it } from "vitest";
import { buildIR } from "@/core/ir";
import { parse } from "@/core/lang";
import { layoutGraph } from "@/core/layout";
import { registryResolver } from "@/core/registry";
import { escapeXml, toSVG } from "./svg";
import { toJSON } from "./json";

const build = (source: string) => buildIR(parse(source), registryResolver);

async function svgFor(source: string, mode: "sketch" | "clean" = "sketch") {
  const graph = build(source);
  const layout = await layoutGraph(graph);
  return { svg: toSVG(graph, layout, { mode }), graph, layout };
}

describe("escapeXml", () => {
  it("escapes the characters that would break the document", () => {
    expect(escapeXml('a & b < c > d "e"')).toBe(
      "a &amp; b &lt; c &gt; d &quot;e&quot;",
    );
  });
});

describe("toSVG", () => {
  it("emits a well-formed root element", async () => {
    const { svg } = await svgFor("user -> api");
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg.endsWith("</svg>")).toBe(true);
  });

  it("sizes the canvas to fit the diagram plus padding", async () => {
    const { svg, layout } = await svgFor("user -> api -> db");
    const width = Number(/width="([\d.]+)"/.exec(svg)![1]);
    expect(width).toBeGreaterThan(layout.width);
  });

  it("draws a path for every node and edge", async () => {
    const { svg } = await svgFor("user -> api -> db");
    const paths = svg.match(/<path /g) ?? [];
    expect(paths.length).toBeGreaterThan(6);
  });

  it("includes node labels as text", async () => {
    const { svg } = await svgFor("user -> auth-api");
    expect(svg).toContain(">User<");
    expect(svg).toContain(">Auth API<");
  });

  it("includes edge labels", async () => {
    const { svg } = await svgFor('api -"publishes"-> queue');
    expect(svg).toContain(">publishes<");
  });

  it("renders the title", async () => {
    const { svg } = await svgFor('title "Auth Service"\nuser -> api');
    expect(svg).toContain("Auth Service");
  });

  it("escapes text rather than letting it break the document", async () => {
    const { svg } = await svgFor('title "A & B"\nuser -> api');
    expect(svg).toContain("A &amp; B");
    expect(svg).not.toContain("A & B");
  });

  it("contains no NaN or undefined coordinates", async () => {
    const { svg } = await svgFor(
      'title "T"\nuser -> auth-api\nauth-api -"loop"-> auth-api\nauth-api <> user-db\napi -- cdn',
    );
    expect(svg).not.toMatch(/NaN|undefined/);
  });

  /** A self-loop arcs above its node, so a tight extent would clip it. */
  it("leaves headroom for a self-loop", async () => {
    const plain = await svgFor("api -> db");
    const looped = await svgFor('api -"x"-> api\napi -> db');

    const heightOf = (svg: string) => Number(/height="([\d.]+)"/.exec(svg)![1]);
    expect(heightOf(looped.svg)).toBeGreaterThan(heightOf(plain.svg));
  });

  it("is deterministic — the same diagram exports byte-identically", async () => {
    const a = await svgFor('title "T"\nuser -> auth-api <> user-db');
    const b = await svgFor('title "T"\nuser -> auth-api <> user-db');
    expect(b.svg).toBe(a.svg);
  });

  /**
   * The point of keeping `render/` free of React: the export is the same code,
   * so sketch and clean differ in stroke and nothing else.
   */
  it("differs between modes without changing the canvas size", async () => {
    const sketch = await svgFor("user -> api", "sketch");
    const clean = await svgFor("user -> api", "clean");

    const dimensions = (svg: string) =>
      /width="([\d.]+)" height="([\d.]+)"/.exec(svg)!.slice(1, 3);

    expect(dimensions(clean.svg)).toEqual(dimensions(sketch.svg));
    expect(clean.svg).not.toBe(sketch.svg);
  });

  it("paints a background unless asked not to", async () => {
    const graph = build("user -> api");
    const layout = await layoutGraph(graph);
    expect(toSVG(graph, layout, { mode: "sketch" })).toContain("<rect");
    expect(
      toSVG(graph, layout, { mode: "sketch", transparent: true }),
    ).not.toContain("<rect");
  });

  it("handles an empty document without throwing", async () => {
    const { svg } = await svgFor("");
    expect(svg).toContain("<svg");
  });
});

describe("toJSON", () => {
  it("carries the source, since that is the only authoritative part", async () => {
    const source = "user -> api";
    const graph = build(source);
    const json = toJSON(graph, await layoutGraph(graph), source);
    expect(json.source).toBe(source);
    expect(json.version).toBe(1);
  });

  it("flattens nodes with their positions", async () => {
    const graph = build("user -> api");
    const json = toJSON(graph, await layoutGraph(graph), "user -> api");
    expect(json.nodes).toHaveLength(2);
    expect(json.nodes[0]).toMatchObject({ id: "user", archetype: "actor" });
  });

  it("round-trips through JSON.stringify", async () => {
    const graph = build('title "T"\napi -"x"-> db');
    const json = toJSON(graph, await layoutGraph(graph), "…");
    expect(() => JSON.parse(JSON.stringify(json))).not.toThrow();
  });
});
