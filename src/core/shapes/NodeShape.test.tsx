import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearShapeCache, type RenderMode } from "@/core/render";
import { NodeShape } from "./NodeShape";

afterEach(cleanup);
beforeEach(clearShapeCache);

function draw(props: {
  id: string;
  label: string;
  archetype: string;
  mode: RenderMode;
  color?: string;
}) {
  const { container } = render(<NodeShape {...props} />);
  const svg = container.querySelector("svg")!;
  const shapePaths = [...svg.querySelectorAll("path")];
  return {
    svg,
    size: { w: svg.getAttribute("width"), h: svg.getAttribute("height") },
    paths: shapePaths.map((p) => p.getAttribute("d")),
    fills: shapePaths.map((p) => p.getAttribute("fill")).filter((f) => f !== "none"),
    strokes: shapePaths
      .map((p) => p.getAttribute("stroke"))
      .filter((s) => s && s !== "none"),
    text: svg.querySelector("text")?.textContent,
  };
}

describe("NodeShape", () => {
  it("draws an actor with its label", () => {
    const { paths, text } = draw({
      id: "user",
      label: "User",
      archetype: "actor",
      mode: "sketch",
    });
    expect(text).toBe("User");
    expect(paths.length).toBeGreaterThan(0);
  });

  it("falls back to a box for an unknown archetype instead of crashing", () => {
    const { paths } = draw({
      id: "x",
      label: "Whatever",
      archetype: "nonsense",
      mode: "sketch",
    });
    expect(paths.length).toBeGreaterThan(0);
  });

  it("renders identical path data on a re-render", () => {
    const first = draw({ id: "auth-api", label: "Auth API", archetype: "service", mode: "sketch" });
    cleanup();
    const second = draw({ id: "auth-api", label: "Auth API", archetype: "service", mode: "sketch" });
    expect(second.paths).toEqual(first.paths);
  });

  it("gives two nodes of the same archetype different strokes", () => {
    const a = draw({ id: "auth-api", label: "API", archetype: "service", mode: "sketch" });
    cleanup();
    const b = draw({ id: "user-api", label: "API", archetype: "service", mode: "sketch" });
    expect(b.paths).not.toEqual(a.paths);
  });
});

describe("colour", () => {
  it("paints the palette variables when tinted", () => {
    const { fills, strokes } = draw({
      id: "auth-api",
      label: "Auth API",
      archetype: "service",
      mode: "sketch",
      color: "blue",
    });
    expect(fills).toContain("var(--tint-blue-fill)");
    expect(strokes).toContain("var(--tint-blue-stroke)");
  });

  it("falls back to paper and ink without a colour", () => {
    const { fills, strokes } = draw({
      id: "auth-api",
      label: "Auth API",
      archetype: "service",
      mode: "sketch",
    });
    expect(fills).toContain("var(--paper)");
    expect(strokes).toContain("var(--ink)");
  });

  it("draws untinted for an unknown colour rather than breaking", () => {
    const { fills } = draw({
      id: "x",
      label: "X",
      archetype: "service",
      mode: "sketch",
      color: "chartreuse",
    });
    expect(fills).toContain("var(--paper)");
  });

  /** Colour is paint, not geometry — it must not move anything. */
  it("does not change the node's footprint", () => {
    const plain = draw({ id: "a", label: "API", archetype: "service", mode: "sketch" });
    cleanup();
    const tinted = draw({
      id: "a",
      label: "API",
      archetype: "service",
      mode: "sketch",
      color: "amber",
    });
    expect(tinted.size).toEqual(plain.size);
    expect(tinted.paths).toEqual(plain.paths);
  });

  it("survives the Clean toggle at the same size", () => {
    const sketch = draw({
      id: "a",
      label: "API",
      archetype: "service",
      mode: "sketch",
      color: "teal",
    });
    cleanup();
    const clean = draw({
      id: "a",
      label: "API",
      archetype: "service",
      mode: "clean",
      color: "teal",
    });
    expect(clean.size).toEqual(sketch.size);
    expect(clean.fills).toContain("var(--tint-teal-fill)");
  });
});

/**
 * The guarantee behind the Sketch/Clean toggle: it must repaint, never relayout.
 * If these sizes ever diverge the whole diagram would shift when the user
 * flipped the switch.
 */
describe("Sketch and Clean agree on geometry", () => {
  const cases = [
    { id: "user", label: "User", archetype: "actor" },
    { id: "auth-api", label: "Auth API", archetype: "service" },
    { id: "user-db", label: "User DB", archetype: "database" },
    { id: "q", label: "Events", archetype: "queue" },
  ];

  for (const node of cases) {
    it(`is position-identical for ${node.archetype}`, () => {
      const sketch = draw({ ...node, mode: "sketch" });
      cleanup();
      const clean = draw({ ...node, mode: "clean" });

      expect(clean.size).toEqual(sketch.size);
      expect(clean.text).toBe(sketch.text);
      // Same footprint, different ink.
      expect(clean.paths).not.toEqual(sketch.paths);
    });
  }

  it("uses the handwritten face only in sketch mode", () => {
    const sketch = draw({ id: "a", label: "A", archetype: "service", mode: "sketch" });
    expect(sketch.svg.querySelector("text")?.getAttribute("style")).toContain("--font-hand");
    cleanup();
    const clean = draw({ id: "a", label: "A", archetype: "service", mode: "clean" });
    expect(clean.svg.querySelector("text")?.getAttribute("style")).toContain("--font-sans");
  });
});
