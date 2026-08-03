import { describe, expect, it } from "vitest";
import { parse } from "@/core/lang";
import { registryResolver } from "@/core/registry";
import { buildIR } from "./builder";
import { diffGraphs, needsRelayout } from "./diff";

const build = (source: string) => buildIR(parse(source), registryResolver);
const diff = (before: string, after: string) =>
  diffGraphs(build(before), build(after));

describe("diffGraphs", () => {
  it("reports no change for identical documents", () => {
    expect(diff("user -> api", "user -> api")).toBe("none");
  });

  it("treats an added node as topological", () => {
    expect(diff("user -> api", "user -> api\napi -> db")).toBe("topological");
  });

  it("treats a removed node as topological", () => {
    expect(diff("user -> api\napi -> db", "user -> api")).toBe("topological");
  });

  it("treats a changed archetype as topological, since the footprint changes", () => {
    expect(diff("sessions:redis", "sessions:s3")).toBe("topological");
  });

  /**
   * The documented guarantee: flipping `->` to `<>` adds an arrowhead to an
   * existing spline. If this ever returned "topological" the diagram would
   * jump while the user was typing.
   */
  it("treats a direction change as cosmetic", () => {
    expect(diff("user -> api", "user <> api")).toBe("cosmetic");
    expect(diff("user -> api", "user -- api")).toBe("cosmetic");
  });

  /**
   * The guarantee that makes recolouring feel instant: adding or changing a
   * colour repaints, it does not relayout, so nothing on the canvas moves.
   */
  it("treats adding a colour as cosmetic", () => {
    expect(diff("user -> api", "user -> api #blue")).toBe("cosmetic");
  });

  it("treats changing a colour as cosmetic", () => {
    expect(diff("user -> api #blue", "user -> api #red")).toBe("cosmetic");
  });

  it("treats removing a colour as cosmetic", () => {
    expect(diff("user -> api #blue", "user -> api")).toBe("cosmetic");
  });

  it("treats an edge label as cosmetic", () => {
    expect(diff("user -> api", 'user -"logs in"-> api')).toBe("cosmetic");
  });

  it("treats a title as cosmetic", () => {
    expect(diff("user -> api", 'title "Hello"\nuser -> api')).toBe("cosmetic");
  });

  it("ignores a statement moving to a different line", () => {
    expect(diff("user -> api\napi -> db", "api -> db\nuser -> api")).toBe("none");
  });

  it("ignores comments and blank lines entirely", () => {
    expect(diff("user -> api", "// a note\n\nuser -> api")).toBe("none");
  });

  it("notices a rewired edge even when the node set is unchanged", () => {
    expect(diff("user -> api\napi -> db", "user -> api\nuser -> db")).toBe(
      "topological",
    );
  });
});

describe("needsRelayout", () => {
  it("runs ELK only for topological change", () => {
    expect(needsRelayout("topological")).toBe(true);
    expect(needsRelayout("cosmetic")).toBe(false);
    expect(needsRelayout("none")).toBe(false);
  });
});
