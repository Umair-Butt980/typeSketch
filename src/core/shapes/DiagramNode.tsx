import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { RenderMode } from "@/core/render";
import { NodeShape } from "./NodeShape";

export interface DiagramNodeData extends Record<string, unknown> {
  label: string;
  archetype: string;
  mode: RenderMode;
}

export type DiagramNodeType = Node<DiagramNodeData, "diagram">;

/**
 * A node on the canvas.
 *
 * The handles exist only so React Flow has anchor points to route edges
 * between — they are invisible and non-connectable. You cannot drag a
 * connection into being; connections come from the grammar alone. That
 * restriction is the product, not an oversight.
 */
export function DiagramNode({ id, data, selected }: NodeProps<DiagramNodeType>) {
  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        style={{ opacity: 0, width: 1, height: 1, border: 0, minWidth: 0, minHeight: 0 }}
      />
      <div className={selected ? "drop-shadow-[0_0_0_2px_var(--ring)]" : undefined}>
        <NodeShape
          id={id}
          label={data.label}
          archetype={data.archetype}
          mode={data.mode}
        />
      </div>
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        style={{ opacity: 0, width: 1, height: 1, border: 0, minWidth: 0, minHeight: 0 }}
      />
    </>
  );
}
