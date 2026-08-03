/**
 * The colour vocabulary.
 *
 * Shape already says *what a thing is*; colour is the axis for *which group it
 * belongs to* — these three are the payments team, those two are third-party.
 *
 * Curated rather than open, for the same reason the shape aliases are: an
 * arbitrary hex has no dark-theme counterpart and no contrast guarantee, whereas
 * a hand-tuned name is legible on both grounds by construction.
 *
 * In every entry the **stroke carries the hue and the fill only hints at it**.
 * A saturated fill would fight the label sitting on top of it, and label
 * legibility matters more than colour intensity in a diagram people read.
 */

export interface Tint {
  fill: string;
  stroke: string;
}

export interface PaletteColor {
  name: string;
  light: Tint;
  dark: Tint;
}

export const PALETTE: readonly PaletteColor[] = [
  {
    name: "blue",
    light: { fill: "oklch(0.94 0.035 245)", stroke: "oklch(0.52 0.15 245)" },
    dark: { fill: "oklch(0.32 0.05 245)", stroke: "oklch(0.75 0.12 245)" },
  },
  {
    name: "green",
    light: { fill: "oklch(0.94 0.04 155)", stroke: "oklch(0.5 0.13 155)" },
    dark: { fill: "oklch(0.31 0.05 155)", stroke: "oklch(0.75 0.12 155)" },
  },
  {
    name: "amber",
    light: { fill: "oklch(0.945 0.05 85)", stroke: "oklch(0.55 0.13 75)" },
    dark: { fill: "oklch(0.33 0.05 80)", stroke: "oklch(0.79 0.12 85)" },
  },
  {
    name: "red",
    light: { fill: "oklch(0.94 0.035 25)", stroke: "oklch(0.53 0.18 25)" },
    dark: { fill: "oklch(0.32 0.06 25)", stroke: "oklch(0.73 0.15 25)" },
  },
  {
    name: "purple",
    light: { fill: "oklch(0.94 0.035 300)", stroke: "oklch(0.52 0.16 300)" },
    dark: { fill: "oklch(0.32 0.06 300)", stroke: "oklch(0.75 0.13 300)" },
  },
  {
    name: "teal",
    light: { fill: "oklch(0.94 0.04 195)", stroke: "oklch(0.5 0.11 195)" },
    dark: { fill: "oklch(0.31 0.045 195)", stroke: "oklch(0.76 0.1 195)" },
  },
  {
    name: "pink",
    light: { fill: "oklch(0.945 0.035 350)", stroke: "oklch(0.55 0.16 350)" },
    dark: { fill: "oklch(0.33 0.055 350)", stroke: "oklch(0.76 0.13 350)" },
  },
  {
    name: "orange",
    light: { fill: "oklch(0.945 0.045 55)", stroke: "oklch(0.56 0.16 45)" },
    dark: { fill: "oklch(0.33 0.055 50)", stroke: "oklch(0.77 0.13 55)" },
  },
  {
    name: "grey",
    light: { fill: "oklch(0.94 0.003 285)", stroke: "oklch(0.55 0.01 285)" },
    dark: { fill: "oklch(0.32 0.005 285)", stroke: "oklch(0.72 0.01 285)" },
  },
];

const BY_NAME = new Map(PALETTE.map((color) => [color.name, color]));

export function colorByName(name: string): PaletteColor | null {
  return BY_NAME.get(name.trim().toLowerCase()) ?? null;
}

/** For autocomplete and the help sheet. */
export function paletteNames(): string[] {
  return PALETTE.map((color) => color.name);
}

/** CSS custom property names for a colour, so callers never build them by hand. */
export function tintVars(name: string): Tint {
  return { fill: `var(--tint-${name}-fill)`, stroke: `var(--tint-${name}-stroke)` };
}

/**
 * The CSS variables, generated from `PALETTE` rather than hand-written
 * alongside it.
 *
 * The canvas needs variables so switching theme repaints without re-rendering,
 * but a second hand-maintained list in `globals.css` would be free to drift from
 * this one. Generating removes the possibility. Export does not use these — a
 * downloaded file has no stylesheet to inherit from — and resolves the same
 * objects to literals instead.
 */
export function paletteCss(): string {
  const declarations = (theme: "light" | "dark") =>
    PALETTE.map(
      (color) =>
        `--tint-${color.name}-fill:${color[theme].fill};--tint-${color.name}-stroke:${color[theme].stroke};`,
    ).join("");

  return `:root{${declarations("light")}}.dark{${declarations("dark")}}`;
}
