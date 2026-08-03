import { describe, expect, it } from "vitest";
import {
  colorByName,
  PALETTE,
  paletteCss,
  paletteNames,
  tintVars,
} from "./palette";

describe("the palette", () => {
  it("defines both themes for every colour", () => {
    for (const color of PALETTE) {
      expect(color.light.fill, color.name).toBeTruthy();
      expect(color.light.stroke, color.name).toBeTruthy();
      expect(color.dark.fill, color.name).toBeTruthy();
      expect(color.dark.stroke, color.name).toBeTruthy();
    }
  });

  it("has unique names", () => {
    expect(new Set(paletteNames()).size).toBe(PALETTE.length);
  });

  it("uses lowercase names, since lookup is case-insensitive", () => {
    for (const name of paletteNames()) expect(name).toBe(name.toLowerCase());
  });

  /**
   * The stroke carries the hue and the fill only hints at it — otherwise the
   * label sitting on the fill loses contrast. In oklch the first component is
   * lightness, so a pale fill is a high number on light and a low one on dark.
   */
  it("keeps fills pale enough for label text to sit on", () => {
    const lightness = (color: string) =>
      Number(/oklch\(([\d.]+)/.exec(color)![1]);

    for (const color of PALETTE) {
      expect(lightness(color.light.fill), `${color.name} light`).toBeGreaterThan(0.9);
      expect(lightness(color.dark.fill), `${color.name} dark`).toBeLessThan(0.4);
    }
  });

  it("makes the stroke darker than the fill on light, and lighter on dark", () => {
    const lightness = (color: string) =>
      Number(/oklch\(([\d.]+)/.exec(color)![1]);

    for (const color of PALETTE) {
      expect(lightness(color.light.stroke), color.name).toBeLessThan(
        lightness(color.light.fill),
      );
      expect(lightness(color.dark.stroke), color.name).toBeGreaterThan(
        lightness(color.dark.fill),
      );
    }
  });
});

describe("colorByName", () => {
  it("resolves every name in the palette", () => {
    for (const name of paletteNames()) {
      expect(colorByName(name)?.name, name).toBe(name);
    }
  });

  it("is case- and whitespace-insensitive", () => {
    expect(colorByName("  BLUE ")?.name).toBe("blue");
  });

  it("returns null for an unknown name rather than throwing", () => {
    expect(colorByName("chartreuse")).toBeNull();
    expect(colorByName("")).toBeNull();
  });
});

describe("tintVars", () => {
  it("builds the CSS variable references", () => {
    expect(tintVars("blue")).toEqual({
      fill: "var(--tint-blue-fill)",
      stroke: "var(--tint-blue-stroke)",
    });
  });
});

/**
 * Generated rather than hand-written, so this asserts the generator covers
 * everything — a hand-maintained copy in globals.css could silently miss a
 * colour, which is exactly the drift this design removes.
 */
describe("paletteCss", () => {
  const css = paletteCss();

  it("emits both a light and a dark block", () => {
    expect(css).toContain(":root{");
    expect(css).toContain(".dark{");
  });

  it("declares fill and stroke for every colour, in both themes", () => {
    for (const color of PALETTE) {
      const fill = `--tint-${color.name}-fill:`;
      const stroke = `--tint-${color.name}-stroke:`;
      expect(css.split(fill).length - 1, `${color.name} fill`).toBe(2);
      expect(css.split(stroke).length - 1, `${color.name} stroke`).toBe(2);
    }
  });

  it("carries the actual palette values", () => {
    const blue = colorByName("blue")!;
    expect(css).toContain(blue.light.fill);
    expect(css).toContain(blue.dark.stroke);
  });

  it("every variable tintVars can reference is defined", () => {
    for (const name of paletteNames()) {
      const { fill, stroke } = tintVars(name);
      // `var(--x)` -> `--x:`
      expect(css).toContain(`${fill.slice(4, -1)}:`);
      expect(css).toContain(`${stroke.slice(4, -1)}:`);
    }
  });
});
