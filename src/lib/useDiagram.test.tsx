import { renderHook, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it } from "vitest";
import { useDiagram } from "./useDiagram";

const SOURCE = "user -> auth-api -> user-db";

describe("useDiagram", () => {
  it("lays out the graph", async () => {
    const { result } = renderHook(() => useDiagram(SOURCE));

    expect(result.current.graph.nodes).toHaveLength(3);
    await waitFor(() => expect(result.current.laidOut).toBe(true));
    expect(result.current.layout.nodes).toHaveLength(3);
  });

  /**
   * React re-invokes effects in StrictMode. Any state the layout effect keeps
   * about "what did I already lay out" must therefore survive being run twice
   * for the same graph — otherwise the second run sees no change, skips, and
   * the canvas sits on "Laying out…" forever.
   */
  it("still lays out under StrictMode's double-invoked effects", async () => {
    const { result } = renderHook(() => useDiagram(SOURCE), {
      wrapper: StrictMode,
    });

    await waitFor(() => expect(result.current.laidOut).toBe(true), {
      timeout: 2000,
    });
    expect(result.current.layout.nodes).toHaveLength(3);
  });

  it("relays out when the topology changes", async () => {
    const { result, rerender } = renderHook(
      ({ source }) => useDiagram(source),
      { initialProps: { source: SOURCE } },
    );

    await waitFor(() => expect(result.current.laidOut).toBe(true));
    const before = result.current.layout;

    rerender({ source: `${SOURCE}\nauth-api -> session-store` });
    await waitFor(() => expect(result.current.layout).not.toBe(before));
    expect(result.current.layout.nodes).toHaveLength(4);
  });

  /** The guarantee: a cosmetic edit must not move anything. */
  it("does not relayout for a cosmetic edit", async () => {
    const { result, rerender } = renderHook(
      ({ source }) => useDiagram(source),
      { initialProps: { source: "user -> auth-api" } },
    );

    await waitFor(() => expect(result.current.laidOut).toBe(true));
    const before = result.current.layout;

    // Direction change: same nodes, same edge, one more arrowhead.
    rerender({ source: "user <> auth-api" });
    await new Promise((r) => setTimeout(r, 300));

    expect(result.current.layout).toBe(before);
    expect(result.current.graph.edges[0]?.direction).toBe("both");
  });

  it("surfaces a document with a broken line without stalling", async () => {
    const { result } = renderHook(() => useDiagram("user -> api\napi -> "));

    await waitFor(() => expect(result.current.laidOut).toBe(true));
    expect(result.current.layout.nodes).toHaveLength(2);
    expect(result.current.graph.diagnostics).toHaveLength(1);
  });
});
