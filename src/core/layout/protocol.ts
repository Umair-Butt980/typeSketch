import type { IRGraph } from "@/core/ir/types";
import type { LayoutResult } from "./elk-strategy";
import type { OverrideMap } from "./overrides";

/**
 * The worker contract, kept in its own module so the main thread can import the
 * types without pulling in the worker body (and with it, all of ELK).
 */

export interface LayoutRequest {
  id: number;
  graph: IRGraph;
  overrides: OverrideMap;
}

export type LayoutResponse =
  | { id: number; ok: true; result: LayoutResult }
  | { id: number; ok: false; error: string };
