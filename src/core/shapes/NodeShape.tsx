import {
  drawShape,
  labelPosition,
  LABEL_FONT_SIZE,
  measureNode,
  shapeOffset,
  type RenderMode,
} from "@/core/render";
import { archetypeByName } from "@/core/registry";
import { ShapePaths } from "./ShapePaths";

export interface NodeShapeProps {
  /** The node's stable IR id — this is what seeds the hand-drawn wobble. */
  id: string;
  label: string;
  archetype: string;
  mode: RenderMode;
  /** Drawn dimmer when another node is selected. */
  muted?: boolean;
}

/**
 * One diagram node, drawn from its archetype's geometry.
 *
 * Sketch and clean differ only in path data and typeface — never in size or
 * position. Toggling between them must not move anything, which is why
 * measurement lives outside the renderer entirely.
 */
export function NodeShape({ id, label, archetype, mode, muted }: NodeShapeProps) {
  const shape = archetypeByName(archetype);
  const box = measureNode(shape, label);
  const offset = shapeOffset(box);
  const paths = drawShape(
    shape.geometry(box.shapeW, box.shapeH),
    mode,
    id,
    box.shapeW,
    box.shapeH,
  );
  const text = labelPosition(shape, box);

  return (
    <svg
      width={box.w}
      height={box.h}
      viewBox={`0 0 ${box.w} ${box.h}`}
      className={muted ? "opacity-40 transition-opacity" : "transition-opacity"}
      aria-label={label}
      role="img"
    >
      <g transform={`translate(${offset.x} ${offset.y})`}>
        <ShapePaths paths={paths} />
      </g>
      <text
        x={text.x}
        y={text.y}
        textAnchor="middle"
        fill="var(--ink)"
        fontSize={LABEL_FONT_SIZE}
        style={{
          fontFamily:
            mode === "sketch"
              ? "var(--font-hand), ui-rounded, sans-serif"
              : "var(--font-sans), system-ui, sans-serif",
        }}
      >
        {label}
      </text>
    </svg>
  );
}
