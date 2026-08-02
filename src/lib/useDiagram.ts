"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildIR, diffGraphs, EMPTY_GRAPH, needsRelayout, type IRGraph } from "@/core/ir";
import { parse } from "@/core/lang";
import {
  createLayoutClient,
  type LayoutClient,
  type LayoutResult,
  type OverrideMap,
} from "@/core/layout";
import { registryResolver } from "@/core/registry";

/**
 * Long enough that a burst of typing produces one layout rather than twenty;
 * short enough that the diagram feels like it is keeping up.
 */
const LAYOUT_DEBOUNCE_MS = 120;

const NO_OVERRIDES: OverrideMap = {};
const NO_LAYOUT: LayoutResult = { nodes: [], width: 0, height: 0 };

export interface Diagram {
  graph: IRGraph;
  layout: LayoutResult;
  laidOut: boolean;
  /** Surfaced rather than swallowed: a silent stall is indistinguishable from a hang. */
  layoutError: string | null;
}

/**
 * The pipeline, wired up.
 *
 * Parsing and IR construction run **synchronously on every keystroke** — they
 * are sub-millisecond, and diagnostics need to be immediate. Layout is the
 * expensive stage, so it is debounced *and* skipped entirely unless the change
 * was topological. Renaming a node or flipping an arrowhead therefore never
 * moves anything, which is the guarantee the differ exists to provide.
 */
export function useDiagram(
  source: string,
  overrides: OverrideMap = NO_OVERRIDES,
): Diagram {
  const graph = useMemo(() => buildIR(parse(source), registryResolver), [source]);

  const [layout, setLayout] = useState<LayoutResult>(NO_LAYOUT);
  const [laidOut, setLaidOut] = useState(false);
  const [layoutError, setLayoutError] = useState<string | null>(null);

  const clientRef = useRef<LayoutClient | null>(null);
  /**
   * The graph currently *on screen* — not merely the last one seen.
   *
   * This distinction matters more than it looks. Advancing it on sight would
   * make the effect non-idempotent: React re-invokes effects (StrictMode does
   * so deliberately), and a second run would compare the graph against itself,
   * conclude nothing changed, and skip the layout the first run had just had
   * cancelled. The canvas would sit on "Laying out…" forever — in development
   * only, since production does not double-invoke.
   *
   * Advancing it only on success keeps the effect safe to run any number of
   * times: until a layout actually lands, the work is still outstanding.
   */
  const renderedGraph = useRef<IRGraph>(EMPTY_GRAPH);
  const latestRequest = useRef(0);

  useEffect(() => {
    clientRef.current = createLayoutClient();
    return () => {
      clientRef.current?.dispose();
      clientRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!needsRelayout(diffGraphs(renderedGraph.current, graph))) return;

    const token = ++latestRequest.current;
    const timer = setTimeout(() => {
      const client = clientRef.current;
      if (!client) return;

      void client
        .layout(graph, overrides)
        .then((result) => {
          // Drop results for edits the user has already typed past.
          if (token !== latestRequest.current) return;
          renderedGraph.current = graph;
          setLayout(result);
          setLaidOut(true);
          setLayoutError(null);
        })
        .catch((error: unknown) => {
          if (token !== latestRequest.current) return;
          // The previous layout stays on screen — far better than blanking the
          // canvas — but the failure is reported rather than hidden.
          setLayoutError(error instanceof Error ? error.message : String(error));
        });
    }, LAYOUT_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [graph, overrides]);

  return { graph, layout, laidOut, layoutError };
}
