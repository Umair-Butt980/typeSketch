import type { DrawPath } from "@/core/render";
import type { Tint } from "@/core/registry";

/**
 * Paints a shape's path data. Colour comes from CSS variables rather than being
 * baked into the path, so light and dark themes — and a node's tint — need no
 * re-generation. The geometry is identical; only the ink changes.
 */
export function ShapePaths({
  paths,
  tint,
  strokeWidth = 1.6,
}: {
  paths: readonly DrawPath[];
  /** A palette tint. Without one the shape uses the default paper and ink. */
  tint?: Tint | undefined;
  strokeWidth?: number;
}) {
  const fill = tint?.fill ?? "var(--paper)";
  const stroke = tint?.stroke ?? "var(--ink)";

  return (
    <>
      {paths.map((path, i) =>
        path.role === "fill" ? (
          <path key={i} d={path.d} fill={fill} stroke="none" />
        ) : (
          <path
            key={i}
            d={path.d}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            {...(path.dashed ? { strokeDasharray: "7 5" } : {})}
          />
        ),
      )}
    </>
  );
}
