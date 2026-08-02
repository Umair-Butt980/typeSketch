"use client";

import { useState } from "react";
import { Canvas } from "@/components/Canvas";
import { Editor } from "@/components/Editor";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { RenderMode } from "@/core/render";
import { useDiagram } from "@/lib/useDiagram";

const SAMPLE = `title "Authentication Service"

user -"enter credentials"-> login-page
login-page -"POST /auth/login"-> auth-api
auth-api -"verify password hash"-> auth-api
auth-api -"fetch user record"-> user-db
auth-api -"create session token"-> session-store
session-store -"user data"-> auth-api
auth-api -"set JWT cookie"-> login-page
login-page -"redirect to dashboard"-> user
`;

export default function EditorPage() {
  const [source, setSource] = useState(SAMPLE);
  const [mode, setMode] = useState<RenderMode>("sketch");
  const { graph, layout, laidOut, layoutError } = useDiagram(source);

  const errors = graph.diagnostics.filter((d) => d.severity === "error");
  const warnings = graph.diagnostics.filter((d) => d.severity === "warning");

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex shrink-0 items-center justify-between border-b px-4 py-2">
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-semibold">TypeSketch</span>
          <span className="text-muted-foreground text-xs">
            {graph.nodes.length} node{graph.nodes.length === 1 ? "" : "s"} ·{" "}
            {graph.edges.length} edge{graph.edges.length === 1 ? "" : "s"}
          </span>
        </div>

        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(next) => next && setMode(next as RenderMode)}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="sketch">Sketch</ToggleGroupItem>
          <ToggleGroupItem value="clean">Clean</ToggleGroupItem>
        </ToggleGroup>
      </header>

      {/* Panels default to horizontal. In v4 bare numbers mean pixels, so
          percentages must be strings. */}
      <ResizablePanelGroup className="min-h-0 flex-1">
        <ResizablePanel defaultSize="36%" minSize="20%">
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1">
              <Editor value={source} onChange={setSource} />
            </div>

            {/*
              Until the language mode lands in P2 and can underline the offending
              span inline, diagnostics live here. Errors never block the canvas —
              every other line still renders.
            */}
            <div className="text-muted-foreground max-h-40 shrink-0 overflow-auto border-t px-3 py-2 text-xs">
              {graph.diagnostics.length === 0 ? (
                <span className="opacity-60">No problems</span>
              ) : (
                <ul className="space-y-1">
                  {[...errors, ...warnings].map((d, i) => (
                    <li key={i} className="flex gap-2">
                      <span
                        className={
                          d.severity === "error"
                            ? "text-destructive font-mono"
                            : "font-mono opacity-70"
                        }
                      >
                        {d.line + 1}:{d.from + 1}
                      </span>
                      <span>{d.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize="64%" minSize="30%">
          <div className="relative h-full">
            <Canvas graph={graph} layout={layout} mode={mode} />

            {layoutError ? (
              <div className="bg-destructive/10 text-destructive absolute inset-x-0 top-0 z-20 px-4 py-2 text-xs">
                Layout failed: {layoutError}
              </div>
            ) : !laidOut && graph.nodes.length > 0 ? (
              <div className="text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center text-sm">
                Laying out…
              </div>
            ) : null}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
