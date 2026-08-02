/// <reference lib="webworker" />

import { layoutGraph } from "./elk-strategy";
import type { LayoutRequest, LayoutResponse } from "./protocol";

/**
 * Layout runs off the main thread.
 *
 * ELK on a 60-node graph takes tens of milliseconds. On the main thread that is
 * a visible hitch on every keystroke that changes the graph's shape; here,
 * typing stays at 60fps regardless of how big the diagram gets.
 */
self.onmessage = async (event: MessageEvent<LayoutRequest>) => {
  const { id, graph, overrides } = event.data;

  try {
    const result = await layoutGraph(graph, overrides);
    const response: LayoutResponse = { id, ok: true, result };
    self.postMessage(response);
  } catch (error) {
    const response: LayoutResponse = {
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(response);
  }
};
