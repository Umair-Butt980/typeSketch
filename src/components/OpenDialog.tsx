"use client";

import { FolderOpen, HardDrive, Trash2, Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Backend, StoredDocument } from "@/lib/document";
import { deleteDocument, listDocuments } from "@/lib/store";

function when(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function OpenDialog({
  onOpen,
  onImport,
}: {
  onOpen: (document: StoredDocument) => void;
  onImport: (name: string, source: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [backend, setBackend] = useState<Backend | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await listDocuments();
    setDocuments(result.documents);
    setBackend(result.backend);
    setLoading(false);
  }, []);

  // Loading is triggered by opening the dialog rather than by an effect
  // watching `open` — the fetch is a response to the user's action, not state
  // that needs synchronising.
  const onOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (next) void refresh();
    },
    [refresh],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <FolderOpen className="size-4" />
          Open
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Open a diagram</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5">
            <HardDrive className="size-3.5" />
            {backend === "mongodb"
              ? "Saved in MongoDB"
              : backend === "local"
                ? "Saved in this browser — no database connected"
                : "Loading…"}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 space-y-1 overflow-y-auto">
          {loading ? (
            <p className="text-muted-foreground py-6 text-center text-sm">Loading…</p>
          ) : documents.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Nothing saved yet.
            </p>
          ) : (
            documents.map((document) => (
              <div
                key={document.id}
                className="hover:bg-accent group flex items-center gap-2 rounded-md px-2 py-2"
              >
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    onOpen(document);
                    setOpen(false);
                  }}
                >
                  <div className="truncate text-sm font-medium">{document.title}</div>
                  <div className="text-muted-foreground text-xs">
                    {when(document.updatedAt)}
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100"
                  aria-label={`Delete ${document.title}`}
                  onClick={async () => {
                    await deleteDocument(document.id);
                    void refresh();
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="border-t pt-3">
          <input
            ref={fileInput}
            type="file"
            accept=".sketch,.txt,.md"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              onImport(file.name.replace(/\.[^.]+$/, ""), await file.text());
              event.target.value = "";
              setOpen(false);
            }}
          />
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5"
            onClick={() => fileInput.current?.click()}
          >
            <Upload className="size-4" />
            Import from a file
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
