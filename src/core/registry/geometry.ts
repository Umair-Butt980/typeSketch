import type { Prim } from "./types";

/**
 * Shared geometry builders. Everything is expressed in local coordinates with
 * the origin at the shape's top-left, so an archetype never has to know where
 * on the canvas it ended up.
 */

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Vertical radius of a cylinder's cap, as a fraction of its height. */
const CAP = 0.18;

export function roundedRect(w: number, h: number, radius = 6): Prim[] {
  return [{ k: "rect", x: 0, y: 0, w, h, r: radius, filled: true }];
}

export function sharpRect(w: number, h: number): Prim[] {
  return [{ k: "rect", x: 0, y: 0, w, h, filled: true }];
}

export function dashedRect(w: number, h: number): Prim[] {
  return [{ k: "rect", x: 0, y: 0, w, h, r: 6, filled: true, dashed: true }];
}

/** A database: an elliptical cap, two straight sides, an elliptical base. */
export function cylinder(w: number, h: number): Prim[] {
  const ry = r2(h * CAP);
  const rx = r2(w / 2);
  const cx = rx;
  return [
    {
      k: "path",
      filled: true,
      d: [
        `M 0 ${ry}`,
        `A ${rx} ${ry} 0 0 1 ${w} ${ry}`,
        `L ${w} ${r2(h - ry)}`,
        `A ${rx} ${ry} 0 0 1 0 ${r2(h - ry)}`,
        "Z",
      ].join(" "),
    },
    // The visible lip — drawn separately so it strokes but does not fill.
    {
      k: "path",
      d: `M 0 ${ry} A ${rx} ${ry} 0 0 0 ${w} ${ry}`,
    },
    { k: "ellipse", cx, cy: ry, rx, ry, filled: false },
  ];
}

/** A cache: a cylinder with a second lip, suggesting layered storage. */
export function doubleCylinder(w: number, h: number): Prim[] {
  const ry = r2(h * CAP * 0.8);
  const rx = r2(w / 2);
  return [
    ...cylinder(w, h),
    { k: "path", d: `M 0 ${r2(ry * 2.4)} A ${rx} ${ry} 0 0 0 ${w} ${r2(ry * 2.4)}` },
  ];
}

/** Object storage: a drum lying on its side. */
export function drum(w: number, h: number): Prim[] {
  const rx = r2(w * 0.16);
  const ry = r2(h / 2);
  return [
    {
      k: "path",
      filled: true,
      d: [
        `M ${rx} 0`,
        `L ${r2(w - rx)} 0`,
        `A ${rx} ${ry} 0 0 1 ${r2(w - rx)} ${h}`,
        `L ${rx} ${h}`,
        `A ${rx} ${ry} 0 0 1 ${rx} 0`,
        "Z",
      ].join(" "),
    },
    { k: "path", d: `M ${r2(w - rx)} 0 A ${rx} ${ry} 0 0 0 ${r2(w - rx)} ${h}` },
  ];
}

/** A queue or topic: an open-ended bar divided into slots. */
export function queueBar(w: number, h: number): Prim[] {
  const slot = r2(w / 4);
  return [
    { k: "rect", x: 0, y: 0, w, h, filled: true },
    { k: "line", x1: slot, y1: 0, x2: slot, y2: h },
    { k: "line", x1: r2(slot * 2), y1: 0, x2: r2(slot * 2), y2: h },
    { k: "line", x1: r2(slot * 3), y1: 0, x2: r2(slot * 3), y2: h },
  ];
}

export function hexagon(w: number, h: number): Prim[] {
  const inset = r2(w * 0.16);
  const mid = r2(h / 2);
  return [
    {
      k: "path",
      filled: true,
      d: [
        `M ${inset} 0`,
        `L ${r2(w - inset)} 0`,
        `L ${w} ${mid}`,
        `L ${r2(w - inset)} ${h}`,
        `L ${inset} ${h}`,
        `L 0 ${mid}`,
        "Z",
      ].join(" "),
    },
  ];
}

export function diamond(w: number, h: number): Prim[] {
  return [
    {
      k: "path",
      filled: true,
      d: `M ${r2(w / 2)} 0 L ${w} ${r2(h / 2)} L ${r2(w / 2)} ${h} L 0 ${r2(h / 2)} Z`,
    },
  ];
}

/** A start or end terminal: a stadium. */
export function stadium(w: number, h: number): Prim[] {
  return [{ k: "rect", x: 0, y: 0, w, h, r: r2(h / 2), filled: true }];
}

/** A browser window: a frame with a chrome bar and three dots. */
export function windowFrame(w: number, h: number): Prim[] {
  const bar = r2(Math.min(16, h * 0.24));
  const dot = 2.2;
  return [
    { k: "rect", x: 0, y: 0, w, h, r: 4, filled: true },
    { k: "line", x1: 0, y1: bar, x2: w, y2: bar },
    { k: "ellipse", cx: 9, cy: r2(bar / 2), rx: dot, ry: dot, filled: false },
    { k: "ellipse", cx: 18, cy: r2(bar / 2), rx: dot, ry: dot, filled: false },
    { k: "ellipse", cx: 27, cy: r2(bar / 2), rx: dot, ry: dot, filled: false },
  ];
}

export function phone(w: number, h: number): Prim[] {
  const inset = r2(w * 0.2);
  return [
    { k: "rect", x: inset, y: 0, w: r2(w - inset * 2), h, r: 8, filled: true },
    {
      k: "line",
      x1: r2(w / 2 - 8),
      y1: 7,
      x2: r2(w / 2 + 8),
      y2: 7,
    },
    {
      k: "line",
      x1: r2(w / 2 - 10),
      y1: r2(h - 7),
      x2: r2(w / 2 + 10),
      y2: r2(h - 7),
    },
  ];
}

/** A document: a rectangle with a wavy bottom edge. */
export function documentShape(w: number, h: number): Prim[] {
  const wave = r2(h * 0.16);
  const body = r2(h - wave);
  return [
    {
      k: "path",
      filled: true,
      d: [
        "M 0 0",
        `L ${w} 0`,
        `L ${w} ${body}`,
        `C ${r2(w * 0.72)} ${r2(body + wave * 1.6)} ${r2(w * 0.28)} ${r2(body - wave * 1.2)} 0 ${r2(body + wave * 0.5)}`,
        "Z",
      ].join(" "),
    },
  ];
}

/** A shield: authentication, firewalls, anything gatekeeping. */
export function shield(w: number, h: number): Prim[] {
  const shoulder = r2(h * 0.28);
  return [
    {
      k: "path",
      filled: true,
      d: [
        `M ${r2(w / 2)} 0`,
        `L ${w} ${shoulder}`,
        `L ${w} ${r2(h * 0.55)}`,
        `Q ${w} ${h} ${r2(w / 2)} ${h}`,
        `Q 0 ${h} 0 ${r2(h * 0.55)}`,
        `L 0 ${shoulder}`,
        "Z",
      ].join(" "),
    },
  ];
}

export function cloud(w: number, h: number): Prim[] {
  const base = r2(h * 0.78);
  return [
    {
      k: "path",
      filled: true,
      d: [
        `M ${r2(w * 0.24)} ${base}`,
        `A ${r2(h * 0.24)} ${r2(h * 0.24)} 0 0 1 ${r2(w * 0.24)} ${r2(h * 0.34)}`,
        `A ${r2(h * 0.3)} ${r2(h * 0.3)} 0 0 1 ${r2(w * 0.62)} ${r2(h * 0.24)}`,
        `A ${r2(h * 0.26)} ${r2(h * 0.26)} 0 0 1 ${r2(w * 0.84)} ${base}`,
        "Z",
      ].join(" "),
    },
  ];
}

/** A load balancer or proxy: a triangle fanning traffic outward. */
export function fan(w: number, h: number): Prim[] {
  return [
    {
      k: "path",
      filled: true,
      d: `M 0 0 L ${w} 0 L ${r2(w * 0.62)} ${h} L ${r2(w * 0.38)} ${h} Z`,
    },
  ];
}

/**
 * The actor. Its label sits *below* the figure rather than inside it, which is
 * why `labelSlot` exists at all.
 */
export function stickFigure(w: number, h: number): Prim[] {
  const cx = r2(w / 2);
  const headR = r2(Math.min(w, h) * 0.18);
  const headCy = headR;
  const neck = r2(headCy + headR);
  const hip = r2(h * 0.62);
  const shoulder = r2(neck + (hip - neck) * 0.3);
  const arm = r2(w * 0.34);
  const foot = r2(w * 0.28);

  return [
    { k: "ellipse", cx, cy: headCy, rx: headR, ry: headR, filled: true },
    { k: "line", x1: cx, y1: neck, x2: cx, y2: hip },
    { k: "line", x1: r2(cx - arm), y1: shoulder, x2: r2(cx + arm), y2: shoulder },
    { k: "line", x1: cx, y1: hip, x2: r2(cx - foot), y2: h },
    { k: "line", x1: cx, y1: hip, x2: r2(cx + foot), y2: h },
  ];
}
