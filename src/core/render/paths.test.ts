import { beforeEach, describe, expect, it } from "vitest";
import { ARCHETYPES, archetypeByName } from "@/core/registry";
import type { Prim } from "@/core/registry/types";
import { clearShapeCache, drawShape, primsToPaths } from "./paths";
import { seedFor, seedForPart } from "./seed";

const RECT: Prim[] = [{ k: "rect", x: 0, y: 0, w: 120, h: 60, filled: true }];

beforeEach(clearShapeCache);

describe("seedFor", () => {
  it("is deterministic", () => {
    expect(seedFor("auth-api")).toBe(seedFor("auth-api"));
  });

  it("separates different ids", () => {
    expect(seedFor("auth-api")).not.toBe(seedFor("user-db"));
  });

  it("always returns a positive integer, since 0 reads as no seed", () => {
    for (const key of ["", "a", "user", "a-very-long-node-identifier-here"]) {
      const seed = seedFor(key);
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThan(0);
    }
  });

  it("gives each primitive of a shape its own wobble", () => {
    expect(seedForPart("user", 0)).not.toBe(seedForPart("user", 1));
    expect(seedForPart("user", 0)).toBe(seedForPart("user", 0));
  });
});

/**
 * The regression this guards is the one most likely to sneak back in the moment
 * anyone touches the shape components: unseeded Rough.js re-randomises per
 * call, so every box would jitter on every React render and the whole diagram
 * would crawl while typing.
 */
describe("the anti-shimmer guarantee", () => {
  it("produces byte-identical sketch paths for the same node, twice", () => {
    const first = primsToPaths(RECT, "sketch", "auth-api");
    const second = primsToPaths(RECT, "sketch", "auth-api");
    expect(second).toEqual(first);
  });

  it("holds across every archetype", () => {
    for (const archetype of ARCHETYPES) {
      const { w, h } = archetype.defaultSize;
      const prims = archetype.geometry(w, h);
      const a = primsToPaths(prims, "sketch", archetype.name);
      const b = primsToPaths(prims, "sketch", archetype.name);
      expect(b, archetype.name).toEqual(a);
      expect(a.length, archetype.name).toBeGreaterThan(0);
    }
  });

  it("gives different nodes different strokes", () => {
    const a = primsToPaths(RECT, "sketch", "auth-api");
    const b = primsToPaths(RECT, "sketch", "user-db");
    expect(b).not.toEqual(a);
  });

  it("survives the cache: a hit equals a fresh generation", () => {
    const fresh = primsToPaths(RECT, "sketch", "api");
    const cached = drawShape(RECT, "sketch", "api", 120, 60);
    expect(cached).toEqual(fresh);
    expect(drawShape(RECT, "sketch", "api", 120, 60)).toBe(cached);
  });

  it("does not serve a stale cache entry when the size changes", () => {
    const small = drawShape(RECT, "sketch", "api", 120, 60);
    const large = drawShape(
      [{ k: "rect", x: 0, y: 0, w: 240, h: 60, filled: true }],
      "sketch",
      "api",
      240,
      60,
    );
    expect(large).not.toBe(small);
  });

  it("does not serve a sketch entry to clean mode", () => {
    const sketch = drawShape(RECT, "sketch", "api", 120, 60);
    const clean = drawShape(RECT, "clean", "api", 120, 60);
    expect(clean).not.toEqual(sketch);
  });
});

describe("clean mode", () => {
  it("is deterministic too", () => {
    expect(primsToPaths(RECT, "clean", "api")).toEqual(
      primsToPaths(RECT, "clean", "api"),
    );
  });

  it("does not depend on the node id, since nothing is randomised", () => {
    expect(primsToPaths(RECT, "clean", "a")).toEqual(
      primsToPaths(RECT, "clean", "b"),
    );
  });

  it("emits a fill under a stroke for an enclosed shape", () => {
    const paths = primsToPaths(RECT, "clean", "api");
    expect(paths.map((p) => p.role)).toEqual(["fill", "stroke"]);
  });

  it("emits only a stroke for a line", () => {
    const paths = primsToPaths(
      [{ k: "line", x1: 0, y1: 0, x2: 10, y2: 10 }],
      "clean",
      "api",
    );
    expect(paths.map((p) => p.role)).toEqual(["stroke"]);
  });

  it("carries the dashed flag through", () => {
    const paths = primsToPaths(
      [{ k: "rect", x: 0, y: 0, w: 10, h: 10, dashed: true }],
      "clean",
      "api",
    );
    expect(paths.find((p) => p.role === "stroke")?.dashed).toBe(true);
  });
});

describe("both modes", () => {
  it("paints fills before strokes", () => {
    for (const mode of ["sketch", "clean"] as const) {
      const paths = primsToPaths(RECT, mode, "api");
      const lastFill = paths.map((p) => p.role).lastIndexOf("fill");
      const firstStroke = paths.map((p) => p.role).indexOf("stroke");
      expect(lastFill, mode).toBeLessThan(firstStroke);
    }
  });

  it("emits non-empty path data for every archetype in both modes", () => {
    for (const mode of ["sketch", "clean"] as const) {
      for (const archetype of ARCHETYPES) {
        const { w, h } = archetype.defaultSize;
        const paths = primsToPaths(archetype.geometry(w, h), mode, archetype.name);
        for (const path of paths) {
          expect(path.d.length, `${archetype.name}/${mode}`).toBeGreaterThan(0);
          expect(path.d, `${archetype.name}/${mode}`).not.toMatch(/NaN|undefined/);
        }
      }
    }
  });

  it("draws the actor with its label below the figure", () => {
    expect(archetypeByName("user").labelSlot).toBe("below");
    expect(archetypeByName("api").labelSlot).toBe("inside");
  });
});
