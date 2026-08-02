import { describe, expect, it } from "vitest";
import { archetypeByName } from "@/core/registry";
import { estimateTextWidth, labelPosition, measureNode } from "./measure";

const actor = archetypeByName("user");
const service = archetypeByName("api");

describe("estimateTextWidth", () => {
  it("grows with the label", () => {
    expect(estimateTextWidth("Auth API")).toBeGreaterThan(estimateTextWidth("API"));
  });

  it("is deterministic, since layout runs where there is no DOM to measure in", () => {
    expect(estimateTextWidth("Session Store")).toBe(estimateTextWidth("Session Store"));
  });
});

describe("measureNode", () => {
  it("keeps a short inside label at the archetype's default width", () => {
    const box = measureNode(service, "API");
    expect(box.w).toBe(service.defaultSize.w);
    expect(box.h).toBe(service.defaultSize.h);
  });

  it("widens the shape for a long inside label rather than clipping it", () => {
    const box = measureNode(service, "Authentication and Session Service");
    expect(box.w).toBeGreaterThan(service.defaultSize.w);
    expect(box.shapeW).toBe(box.w);
    expect(box.h).toBe(service.defaultSize.h);
  });

  it("leaves an actor's figure alone and adds height for the label below", () => {
    const box = measureNode(actor, "User");
    expect(box.shapeW).toBe(actor.defaultSize.w);
    expect(box.shapeH).toBe(actor.defaultSize.h);
    expect(box.h).toBeGreaterThan(actor.defaultSize.h);
  });

  it("widens an actor's footprint for a wide label without stretching the figure", () => {
    const box = measureNode(actor, "Authenticated Administrator");
    expect(box.w).toBeGreaterThan(actor.defaultSize.w);
    expect(box.shapeW).toBe(actor.defaultSize.w);
  });

  it("never returns a footprint smaller than the shape", () => {
    for (const label of ["", "a", "a much longer label than usual"]) {
      const box = measureNode(actor, label);
      expect(box.w).toBeGreaterThanOrEqual(box.shapeW);
      expect(box.h).toBeGreaterThanOrEqual(box.shapeH);
    }
  });
});

describe("labelPosition", () => {
  it("puts an inside label within the shape", () => {
    const box = measureNode(service, "API");
    expect(labelPosition(service, box).y).toBeLessThan(box.shapeH);
  });

  it("puts an actor's label below the figure", () => {
    const box = measureNode(actor, "User");
    expect(labelPosition(actor, box).y).toBeGreaterThan(box.shapeH);
  });
});
