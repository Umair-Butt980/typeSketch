"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useMemo } from "react";
import type { IRGraph } from "@/core/ir";
import type { LayoutResult } from "@/core/layout";
import type { RenderMode } from "@/core/render";
import {
  DiagramNode,
  SketchEdge,
  type DiagramEdgeType,
  type DiagramNodeType,
} from "@/core/shapes";

const nodeTypes = { diagram: DiagramNode };
const edgeTypes = { diagram: SketchEdge };

function toFlowNodes(
  graph: IRGraph,
  layout: LayoutResult,
  mode: RenderMode,
): DiagramNodeType[] {
  const placed = new Map(layout.nodes.map((n) => [n.id, n]));

  // A node with no position yet has been typed but not laid out. Rendering it
  // at the origin would pile new nodes on top of each other for 120ms, so it
  // simply waits for the next layout.
  return graph.nodes.flatMap((node) => {
    const box = placed.get(node.id);
    if (!box) return [];
    return [
      {
        id: node.id,
        type: "diagram" as const,
        position: { x: box.x, y: box.y },
        data: { label: node.label, archetype: node.archetype, mode },
        draggable: true,
        connectable: false,
      },
    ];
  });
}

function toFlowEdges(
  graph: IRGraph,
  layout: LayoutResult,
  mode: RenderMode,
): DiagramEdgeType[] {
  const placed = new Set(layout.nodes.map((n) => n.id));

  return graph.edges
    .filter((edge) => placed.has(edge.source) && placed.has(edge.target))
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: "diagram" as const,
      data: {
        ...(edge.label === undefined ? {} : { label: edge.label }),
        direction: edge.direction,
        mode,
      },
    }));
}

function CanvasInner({
  graph,
  layout,
  mode,
}: {
  graph: IRGraph;
  layout: LayoutResult;
  mode: RenderMode;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<DiagramNodeType>([]);

  /**
   * Positions come from layout, and layout only changes on a topological edit.
   * Keying this effect on `layout` alone is what lets a dragged node survive
   * subsequent typing: a cosmetic edit produces no new layout, so nothing here
   * runs and positions are left exactly as the user left them.
   */
  useEffect(() => {
    setNodes(toFlowNodes(graph, layout, mode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  /** Labels, archetypes and render mode repaint in place, without moving anything. */
  useEffect(() => {
    const current = new Map(graph.nodes.map((n) => [n.id, n]));
    setNodes((previous) =>
      previous.flatMap((node) => {
        const source = current.get(node.id);
        if (!source) return [];
        return [
          {
            ...node,
            data: { label: source.label, archetype: source.archetype, mode },
          },
        ];
      }),
    );
  }, [graph, mode, setNodes]);

  const edges = useMemo(() => toFlowEdges(graph, layout, mode), [graph, layout, mode]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      /* The text owns structure: you may move a node, never wire one up. */
      nodesConnectable={false}
      nodesDraggable
      elementsSelectable
      proOptions={{ hideAttribution: true }}
      fitView
      fitViewOptions={{ padding: 0.25, maxZoom: 1.1 }}
      minZoom={0.2}
      maxZoom={2.5}
      style={{ background: "var(--canvas-bg)" }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={18}
        size={1.4}
        color="var(--canvas-dot)"
      />
      <Controls showInteractive={false} />

      {/* Sits above the canvas rather than in it — the title is not a node. */}
      {graph.title ? (
        <div
          className="pointer-events-none absolute top-6 left-1/2 z-10 -translate-x-1/2 text-2xl"
          style={{
            color: "var(--ink)",
            fontFamily:
              mode === "sketch"
                ? "var(--font-hand), ui-rounded, sans-serif"
                : "var(--font-sans), system-ui, sans-serif",
          }}
        >
          {graph.title}
        </div>
      ) : null}
    </ReactFlow>
  );
}

export function Canvas(props: {
  graph: IRGraph;
  layout: LayoutResult;
  mode: RenderMode;
}) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
