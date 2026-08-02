import {
  EdgeLabelRenderer,
  useInternalNode,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import type { Direction } from "@/core/ir/types";
import {
  arrowheadsFor,
  edgeGeometry,
  primsToPaths,
  selfLoopGeometry,
  type RenderMode,
} from "@/core/render";
import type { Prim } from "@/core/registry/types";

export interface DiagramEdgeData extends Record<string, unknown> {
  label?: string;
  direction: Direction;
  mode: RenderMode;
}

export type DiagramEdgeType = Edge<DiagramEdgeData, "diagram">;

/**
 * A hand-drawn edge.
 *
 * React Flow's built-ins are unusable here: they offer no self-loops, no rough
 * stroke, and arrowheads only as SVG markers — which render as crisp filled
 * triangles and look pasted onto a wobbly line. Here the barbs are ordinary
 * strokes and go through Rough.js with everything else.
 *
 * Path data is regenerated on every render rather than cached, which is safe
 * precisely because it is seeded: the same edge always produces the same
 * wobble, so there is nothing to shimmer.
 */
export function SketchEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
}: EdgeProps<DiagramEdgeType>) {
  const mode: RenderMode = data?.mode ?? "sketch";
  const direction: Direction = data?.direction ?? "forward";

  const sourceNode = useInternalNode(source);
  const isSelfLoop = source === target;

  // A self-loop is drawn from the node's own box, so it needs no routing at all.
  const geometry =
    isSelfLoop && sourceNode
      ? selfLoopGeometry({
          x: sourceNode.internals.positionAbsolute.x,
          y: sourceNode.internals.positionAbsolute.y,
          w: sourceNode.measured?.width ?? 140,
          h: sourceNode.measured?.height ?? 62,
        })
      : edgeGeometry({ x: sourceX, y: sourceY }, { x: targetX, y: targetY });

  const prims: Prim[] = [
    { k: "path", d: geometry.d, filled: false },
    ...arrowheadsFor(geometry, direction).map(
      (d): Prim => ({ k: "path", d, filled: false }),
    ),
  ];

  const paths = primsToPaths(prims, mode, id);

  return (
    <>
      {/* A fat transparent stroke, so the edge can be clicked without pixel-hunting. */}
      <path
        d={geometry.d}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        className="react-flow__edge-interaction"
      />
      {paths.map((path, i) => (
        <path
          key={i}
          d={path.d}
          fill="none"
          stroke={selected ? "var(--ring)" : "var(--ink)"}
          strokeWidth={mode === "sketch" ? 1.6 : 1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {data?.label ? (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute whitespace-nowrap px-1.5 py-0.5 text-[13px] leading-none"
            style={{
              transform: `translate(-50%, -50%) translate(${geometry.mid.x}px, ${geometry.mid.y}px)`,
              color: "var(--ink)",
              background: "color-mix(in oklch, var(--canvas-bg) 82%, transparent)",
              borderRadius: 4,
              fontFamily:
                mode === "sketch"
                  ? "var(--font-hand), ui-rounded, sans-serif"
                  : "var(--font-sans), system-ui, sans-serif",
            }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
