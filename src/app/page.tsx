"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Canvas } from "@/components/Canvas";
import { Editor } from "@/components/Editor";
import { Header, type DownloadFormat } from "@/components/Header";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { toJSON } from "@/core/export";
import type { RenderMode } from "@/core/render";
import type { Backend, StoredDocument } from "@/lib/document";
import {
  copyImage,
  downloadBlob,
  downloadText,
  fileStem,
  renderPNG,
  renderSVG,
} from "@/lib/exporters";
import { saveDocument } from "@/lib/store";
import { useDiagram } from "@/lib/useDiagram";

const SAMPLE = `title "Authentication Service"

user -"enter credentials"-> login-page #blue
login-page -"POST /auth/login"-> auth-api #blue
auth-api -"verify password hash"-> auth-api
auth-api -"fetch user record"-> user-db #green
auth-api -"create session token"-> session-store #green
session-store -"user data"-> auth-api
auth-api -"set JWT cookie"-> login-page
login-page -"redirect to dashboard"-> user
`;

const BLANK = `title "Untitled"

user -> api
`;

export default function EditorPage() {
  const [source, setSource] = useState(SAMPLE);
  const [title, setTitle] = useState("Authentication Service");
  const [mode, setMode] = useState<RenderMode>("sketch");
  const [documentId, setDocumentId] = useState<string | undefined>(undefined);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [backend, setBackend] = useState<Backend | null>(null);

  const { graph, layout, laidOut, layoutError } = useDiagram(source);

  const errors = graph.diagnostics.filter((d) => d.severity === "error");
  const warnings = graph.diagnostics.filter((d) => d.severity === "warning");

  const edit = useCallback((next: string) => {
    setSource(next);
    setDirty(true);
  }, []);

  const handleNew = useCallback(() => {
    if (dirty && !confirm("Discard unsaved changes?")) return;
    setSource(BLANK);
    setTitle("Untitled");
    setDocumentId(undefined);
    setDirty(false);
  }, [dirty]);

  const handleOpen = useCallback((document: StoredDocument) => {
    setSource(document.source);
    setTitle(document.title);
    setDocumentId(document.id);
    setMode(document.renderMode);
    setDirty(false);
  }, []);

  const handleImport = useCallback((name: string, text: string) => {
    setSource(text);
    setTitle(name);
    setDocumentId(undefined);
    setDirty(true);
    toast.success(`Imported ${name}`);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const result = await saveDocument({
        ...(documentId === undefined ? {} : { id: documentId }),
        title,
        source,
        renderMode: mode,
      });
      setDocumentId(result.document.id);
      setBackend(result.backend);
      setDirty(false);
      toast.success(
        result.backend === "mongodb"
          ? "Saved to MongoDB"
          : "Saved in this browser — no database connected",
      );
    } catch {
      toast.error("Could not save");
    } finally {
      setSaving(false);
    }
  }, [documentId, mode, source, title]);

  const handleDownload = useCallback(
    async (format: DownloadFormat) => {
      if (!laidOut && format !== "source") {
        toast.error("The diagram is still laying out");
        return;
      }

      const stem = fileStem(title);
      const options = { mode };

      try {
        switch (format) {
          case "png":
            downloadBlob(await renderPNG(graph, layout, options), `${stem}.png`);
            break;
          case "svg":
            downloadText(
              await renderSVG(graph, layout, options),
              `${stem}.svg`,
              "image/svg+xml",
            );
            break;
          case "source":
            downloadText(source, `${stem}.sketch`, "text/plain");
            break;
          case "json":
            downloadText(
              JSON.stringify(toJSON(graph, layout, source), null, 2),
              `${stem}.json`,
              "application/json",
            );
            break;
        }
        toast.success(`Downloaded ${stem}.${format === "source" ? "sketch" : format}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Download failed");
      }
    },
    [graph, laidOut, layout, mode, source, title],
  );

  const handleCopyImage = useCallback(async () => {
    if (!laidOut) {
      toast.error("The diagram is still laying out");
      return;
    }
    try {
      await copyImage(graph, layout, { mode });
      toast.success("Image copied — paste it anywhere");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not copy the image",
      );
    }
  }, [graph, laidOut, layout, mode]);

  /** ⌘S / Ctrl+S, because this is a document editor and people expect it. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave]);

  return (
    <div className="flex h-dvh flex-col">
      <div className="relative">
        <Header
          title={title}
          onTitleChange={(next) => {
            setTitle(next);
            setDirty(true);
          }}
          mode={mode}
          onModeChange={setMode}
          onNew={handleNew}
          onOpen={handleOpen}
          onImport={handleImport}
          onSave={() => void handleSave()}
          onDownload={(format) => void handleDownload(format)}
          onCopyImage={() => void handleCopyImage()}
          saving={saving}
          dirty={dirty}
          backend={backend}
        />
      </div>

      {/* Panels default to horizontal. In v4 bare numbers mean pixels, so
          percentages must be strings. */}
      <ResizablePanelGroup className="min-h-0 flex-1">
        <ResizablePanel defaultSize="36%" minSize="20%">
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1">
              <Editor value={source} onChange={edit} graph={graph} />
            </div>

            {/*
              Until the language mode lands in P2 and can underline the offending
              span inline, diagnostics live here. Errors never block the canvas —
              every other line still renders.
            */}
            <div className="text-muted-foreground max-h-40 shrink-0 overflow-auto border-t px-3 py-2 text-xs">
              <div className="mb-1 flex items-center gap-2 opacity-60">
                <span>
                  {graph.nodes.length} node{graph.nodes.length === 1 ? "" : "s"}
                </span>
                <span>·</span>
                <span>
                  {graph.edges.length} edge{graph.edges.length === 1 ? "" : "s"}
                </span>
              </div>
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
