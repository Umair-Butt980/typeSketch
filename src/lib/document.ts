export interface StoredDocument {
  id: string;
  title: string;
  source: string;
  overrides: Record<string, unknown>;
  renderMode: "sketch" | "clean";
  updatedAt: string;
}

/** Where a document actually ended up. Shown in the UI rather than guessed at. */
export type Backend = "mongodb" | "local";

/** The file extension for a saved TypeSketch source file. */
export const SOURCE_EXTENSION = "sketch";
