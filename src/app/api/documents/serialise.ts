import type { StoredDocument } from "@/lib/document";

export type { StoredDocument };

/** Mongo documents carry `_id` and `Date`s; the wire format carries neither. */
export function serialise(document: {
  _id: unknown;
  title?: string;
  source?: string;
  overrides?: unknown;
  renderMode?: string;
  updatedAt?: Date;
}): StoredDocument {
  return {
    id: String(document._id),
    title: document.title ?? "Untitled",
    source: document.source ?? "",
    overrides: (document.overrides as Record<string, unknown>) ?? {},
    renderMode: document.renderMode === "clean" ? "clean" : "sketch",
    updatedAt: (document.updatedAt ?? new Date()).toISOString(),
  };
}
