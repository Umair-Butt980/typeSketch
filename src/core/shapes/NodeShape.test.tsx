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
}) {
  const { container } = render(<NodeShape {...props} />);
  const svg = container.querySelector("svg")!;
  return {
    svg,
    size: { w: svg.getAttribute("width"), h: svg.getAttribute("height") },
    paths: [...svg.querySelectorAll("path")].map((p) => p.getAttribute("d")),
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
