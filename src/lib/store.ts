"use client";

import type { Backend, StoredDocument } from "./document";

/**
 * Document storage with a deliberate two-tier design.
 *
 * MongoDB when it is there; the browser's localStorage when it is not. The app
 * is a diagramming tool, not a database client — refusing to save because
 * nobody has started `mongod` would be a poor trade. Which tier was used is
 * returned rather than hidden, so the UI can say so instead of implying a
 * durability it does not have.
 */

const LOCAL_KEY = "typesketch.documents.v1";

function readLocal(): StoredDocument[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as StoredDocument[]) : [];
  } catch {
    // Corrupt or unparseable storage should not take the app down with it.
    return [];
  }
}

function writeLocal(documents: StoredDocument[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(documents));
  } catch {
    // Quota exceeded, or storage disabled in a private window.
  }
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `local-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export interface ListResult {
  backend: Backend;
  documents: StoredDocument[];
}

export async function listDocuments(): Promise<ListResult> {
  try {
    const response = await fetch("/api/documents", { cache: "no-store" });
    if (response.ok) {
      const data = (await response.json()) as { documents: StoredDocument[] };
      return { backend: "mongodb", documents: data.documents };
    }
  } catch {
    // Network failure is treated the same as no database.
  }

  return {
    backend: "local",
    documents: readLocal().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  };
}

export interface SaveInput {
  id?: string;
  title: string;
  source: string;
  overrides?: Record<string, unknown>;
  renderMode?: "sketch" | "clean";
}

export async function saveDocument(
  input: SaveInput,
): Promise<{ backend: Backend; document: StoredDocument }> {
  try {
    const response = await fetch("/api/documents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });

    if (response.ok) {
      const data = (await response.json()) as { document: StoredDocument };
      return { backend: "mongodb", document: data.document };
    }
  } catch {
    // Fall through to local storage.
  }

  const documents = readLocal();
  const document: StoredDocument = {
    id: input.id ?? newId(),
    title: input.title,
    source: input.source,
    overrides: input.overrides ?? {},
    renderMode: input.renderMode ?? "sketch",
    updatedAt: new Date().toISOString(),
  };

  const existing = documents.findIndex((d) => d.id === document.id);
  if (existing >= 0) documents[existing] = document;
  else documents.unshift(document);

  writeLocal(documents);
  return { backend: "local", document };
}

export async function deleteDocument(id: string): Promise<void> {
  try {
    const response = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (response.ok) return;
  } catch {
    // Fall through.
  }
  writeLocal(readLocal().filter((d) => d.id !== id));
}
