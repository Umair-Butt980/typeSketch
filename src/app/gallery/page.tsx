"use client";

import { useState } from "react";
import type { RenderMode } from "@/core/render";
import { ARCHETYPES } from "@/core/registry";
import { NodeShape } from "@/core/shapes";
import { humanize } from "@/core/ir";

/**
 * A visual index of every archetype in both render modes.
 *
 * Thirty hand-written geometries are exactly the kind of thing that typechecks,
 * passes its tests, and still looks wrong — this page is how you check.
 */
export default function Gallery() {
  const [mode, setMode] = useState<RenderMode>("sketch");

  return (
    <main className="min-h-full bg-[var(--canvas-bg)] p-8">
      <header className="mx-auto mb-8 flex max-w-6xl items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Archetype gallery</h1>
          <p className="text-muted-foreground text-sm">
            {ARCHETYPES.length} archetypes · toggling must not change any size
          </p>
        </div>
        <div className="flex gap-1 rounded-full border p-1">
          {(["sketch", "clean"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-full px-4 py-1.5 text-sm capitalize transition-colors ${
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
        {ARCHETYPES.map((archetype) => (
          <figure
            key={archetype.name}
            className="bg-[var(--paper)] flex flex-col items-center gap-3 rounded-lg border p-4"
          >
            <div className="flex min-h-[130px] items-center justify-center">
              <NodeShape
                id={archetype.name}
                label={humanize(archetype.name)}
                archetype={archetype.name}
                mode={mode}
              />
            </div>
            <figcaption className="text-center">
              <div className="font-mono text-xs">{archetype.name}</div>
              <div className="text-muted-foreground mt-1 text-[11px] leading-tight">
                {archetype.aliases.slice(0, 4).join(" · ")}
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}
