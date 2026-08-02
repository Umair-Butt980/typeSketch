import type { DrawPath } from "@/core/render";

/**
 * Paints a shape's path data. Colour comes from CSS variables rather than being
 * baked into the path, so light and dark themes need no re-generation — the
 * geometry is identical, only the ink changes.
 */
export function ShapePaths({
  paths,
  strokeWidth = 1.6,
}: {
  paths: readonly DrawPath[];
  strokeWidth?: number;
}) {
  return (
    <>
      {paths.map((path, i) =>
        path.role === "fill" ? (
          <path key={i} d={path.d} fill="var(--paper)" stroke="none" />
        ) : (
          <path
            key={i}
            d={path.d}
            fill="none"
            stroke="var(--ink)"
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
