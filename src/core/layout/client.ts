import type { IRGraph } from "@/core/ir/types";
import { layoutGraph, type LayoutResult } from "./elk-strategy";
import type { OverrideMap } from "./overrides";

export interface LayoutClient {
  layout(graph: IRGraph, overrides: OverrideMap): Promise<LayoutResult>;
  dispose(): void;
}

/**
 * The caller's handle on layout.
 *
 * There used to be a hand-rolled Web Worker here. It was removed: ELK already
 * runs its solver in a worker of its own, so ours only added a second layer of
 * message passing — and a nested worker at that, which Safari only supports
 * from 16.4. Off-main-thread layout is preserved; the plumbing is ELK's.
 *
 * The interface survives because it is a useful seam. Cancellation and
 * prioritisation belong here if they are ever needed, and the calling hook
 * should not have to care.
 */
export function createLayoutClient(): LayoutClient {
  let disposed = false;

  return {
    async layout(graph, overrides) {
      if (disposed) throw new Error("Layout client has been disposed");
      return layoutGraph(graph, overrides);
    },

    dispose() {
      disposed = true;
    },
  };
}
