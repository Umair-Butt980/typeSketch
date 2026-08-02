import type { IRGraph } from "@/core/ir/types";
import type { LayoutResult } from "./elk-strategy";
import type { OverrideMap } from "./overrides";
import type { LayoutRequest, LayoutResponse } from "./protocol";

export interface LayoutClient {
  layout(graph: IRGraph, overrides: OverrideMap): Promise<LayoutResult>;
  dispose(): void;
}

type Pending = {
  resolve: (result: LayoutResult) => void;
  reject: (error: Error) => void;
  /** Retained so a request can be retried on the main thread if the worker dies. */
  request: LayoutRequest;
};

async function layoutHere(request: LayoutRequest): Promise<LayoutResult> {
  const { layoutGraph } = await import("./elk-strategy");
  return layoutGraph(request.graph, request.overrides);
}

/**
 * Main-thread handle on the layout worker.
 *
 * The worker is created lazily on first use, so ELK — which is a large bundle —
 * never lands in the initial page chunk. Where there is no `Worker` at all
 * (server render, jsdom), layout falls back to a dynamic import on the calling
 * thread so behaviour is identical, just not concurrent.
 */
export function createLayoutClient(): LayoutClient {
  let worker: Worker | null = null;
  let disposed = false;
  let nextId = 1;
  const pending = new Map<number, Pending>();

  let workerUnavailable = false;

  function ensureWorker(): Worker | null {
    if (disposed || workerUnavailable || typeof Worker === "undefined") return null;
    if (worker) return worker;

    try {
      worker = new Worker(new URL("./layout.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      // A bundler that cannot resolve the worker would otherwise leave the
      // canvas permanently empty. Degrading to main-thread layout costs a
      // frame or two of jank and keeps the app working.
      workerUnavailable = true;
      return null;
    }

    worker.onmessage = (event: MessageEvent<LayoutResponse>) => {
      const response = event.data;
      const waiting = pending.get(response.id);
      if (!waiting) return;
      pending.delete(response.id);

      if (response.ok) waiting.resolve(response.result);
      else waiting.reject(new Error(response.error));
    };

    worker.onerror = () => {
      // Do not strand the caller: fall back permanently and finish the work
      // that was in flight, so a dead worker never shows as an empty canvas.
      workerUnavailable = true;
      worker?.terminate();
      worker = null;

      const stranded = [...pending.values()];
      pending.clear();
      for (const waiting of stranded) {
        layoutHere(waiting.request).then(waiting.resolve, waiting.reject);
      }
    };

    return worker;
  }

  return {
    async layout(graph, overrides) {
      const active = ensureWorker();
      const request: LayoutRequest = { id: nextId++, graph, overrides };

      if (!active) return layoutHere(request);

      return new Promise<LayoutResult>((resolve, reject) => {
        pending.set(request.id, { resolve, reject, request });
        active.postMessage(request);
      });
    },

    dispose() {
      disposed = true;
      worker?.terminate();
      worker = null;
      pending.clear();
    },
  };
}
