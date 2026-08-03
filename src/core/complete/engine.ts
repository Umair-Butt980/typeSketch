import type { IRGraph } from "@/core/ir/types";
import { archetypeByName, vocabulary } from "@/core/registry";
import { contextAt, type CursorContext } from "./context";

export type SuggestionKind = "node" | "connector" | "shape" | "snippet";

export interface Suggestion {
  /** What the popup shows. */
  label: string;
  /** What is written into the document. Often the label plus a trailing space. */
  insert: string;
  kind: SuggestionKind;
  /** Secondary text: the archetype an alias resolves to, or what a connector means. */
  detail?: string;
  /**
   * Where the cursor should land, as an offset into `insert`. Used by the
   * labelled-connector snippet to drop the caret between the quotes.
   */
  cursorOffset?: number;
}

export interface CompletionRequest {
  line: string;
  column: number;
  graph: IRGraph;
  /**
   * Which line the cursor is on. Required, not optional: the graph is derived
   * from source that *includes the half-typed line*, so without it the word
   * being typed shows up as a node and gets suggested to itself.
   */
  lineIndex: number;
}

export interface CompletionResult {
  /** Start of the range the suggestion replaces. */
  from: number;
  suggestions: Suggestion[];
}

/**
 * The seam. An LLM tier becomes a second implementation in a chain rather than a
 * rewrite — the same shape as `ShapeResolver` in the registry.
 */
export interface CompletionSource {
  suggest(request: CompletionRequest): CompletionResult;
}

const CONNECTORS: Suggestion[] = [
  { label: "->", insert: "-> ", kind: "connector", detail: "points to" },
  { label: "<>", insert: "<> ", kind: "connector", detail: "both ways" },
  { label: "<-", insert: "<- ", kind: "connector", detail: "points from" },
  { label: "--", insert: "-- ", kind: "connector", detail: "no direction" },
];

/** Cursor lands between the quotes, which is where you want to type next. */
const LABELLED_CONNECTOR: Suggestion = {
  label: '-"label"->',
  insert: '-""-> ',
  kind: "connector",
  detail: "labelled",
  cursorOffset: 2,
};

const TITLE_SNIPPET: Suggestion = {
  label: 'title "…"',
  insert: 'title ""',
  kind: "snippet",
  detail: "heading above the diagram",
  cursorOffset: 7,
};

const EMPTY: CompletionResult = { from: 0, suggestions: [] };

/**
 * Prefix matches first, then substring, each alphabetically.
 *
 * The alphabetical tiebreak is not cosmetic: without a total order the list
 * could reshuffle between keystrokes as the underlying arrays are rebuilt, and a
 * popup whose first entry moves under your fingers is worse than no popup.
 */
function rank(candidates: string[], prefix: string): string[] {
  if (prefix === "") return [...candidates].sort();

  const needle = prefix.toLowerCase();
  const starts: string[] = [];
  const contains: string[] = [];

  for (const candidate of candidates) {
    const value = candidate.toLowerCase();
    if (value === needle) continue; // Already typed in full — nothing to add.
    if (value.startsWith(needle)) starts.push(candidate);
    else if (value.includes(needle)) contains.push(candidate);
  }

  return [...starts.sort(), ...contains.sort()];
}

/** Node names already in the document, minus the one being typed right now. */
function documentNodes(request: CompletionRequest): string[] {
  return request.graph.nodes
    .filter((node) => node.line !== request.lineIndex)
    .map((node) => node.id);
}

function shapeSuggestions(prefix: string, exclude: Set<string>): Suggestion[] {
  return rank(vocabulary(), prefix)
    .filter((word) => !exclude.has(word))
    .map((word) => {
      const archetype = archetypeByName(word).name;
      const suggestion: Suggestion = { label: word, insert: word, kind: "shape" };
      // An alias is worth explaining; an archetype's own name is not.
      return archetype === word ? suggestion : { ...suggestion, detail: archetype };
    });
}

function nodeSuggestions(request: CompletionRequest, prefix: string): Suggestion[] {
  return rank(documentNodes(request), prefix).map((id) => ({
    label: id,
    insert: id,
    kind: "node",
    detail: "in this diagram",
  }));
}

function connectorSuggestions(prefix: string, afterLabel: boolean): Suggestion[] {
  const all = afterLabel ? CONNECTORS : [...CONNECTORS, LABELLED_CONNECTOR];
  if (prefix === "") return all;
  // Connectors are punctuation; an identifier prefix cannot match one.
  return [];
}

function suggestionsFor(
  context: Exclude<CursorContext, { kind: "suppressed" }>,
  request: CompletionRequest,
): Suggestion[] {
  const { prefix } = context;

  switch (context.kind) {
    case "statementStart": {
      const nodes = nodeSuggestions(request, prefix);
      const title = rank(["title"], prefix).length > 0 ? [TITLE_SNIPPET] : [];
      const taken = new Set(nodes.map((n) => n.label));
      return [...nodes, ...title, ...shapeSuggestions(prefix, taken)];
    }

    case "target": {
      const nodes = nodeSuggestions(request, prefix);
      const taken = new Set(nodes.map((n) => n.label));
      return [...nodes, ...shapeSuggestions(prefix, taken)];
    }

    case "connector":
      return connectorSuggestions(prefix, context.afterLabel);

    case "archetype":
      return shapeSuggestions(prefix, new Set());
  }
}

/**
 * Pure: the same request always yields the same list, in the same order. That is
 * what lets the popup and the inline ghost text agree without either consulting
 * the other.
 */
export function completionsAt(request: CompletionRequest): CompletionResult {
  const context = contextAt(request.line, request.column);
  if (context.kind === "suppressed") return EMPTY;

  return { from: context.from, suggestions: suggestionsFor(context, request) };
}

export const deterministicSource: CompletionSource = { suggest: completionsAt };

/**
 * The single suggestion to show as inline ghost text, or `null`.
 *
 * Only a **pure extension** of what was typed qualifies — accepting must be an
 * insert, never a rewrite. A ghost that would replace your own characters makes
 * Tab unpredictable, and unpredictability is the one thing an accept key cannot
 * afford.
 */
export function ghostFor(request: CompletionRequest): { insert: string; from: number } | null {
  const context = contextAt(request.line, request.column);
  if (context.kind === "suppressed") return null;

  // Punctuation is offered in the popup but never ghosted: with nothing typed
  // there is no evidence the user wants any particular connector.
  if (context.kind === "connector") return null;

  const { from, suggestions } = completionsAt(request);
  const top = suggestions[0];
  if (!top || top.cursorOffset !== undefined) return null;

  const typed = request.line.slice(from, request.column);
  if (typed === "") return null;
  if (!top.insert.toLowerCase().startsWith(typed.toLowerCase())) return null;

  const remainder = top.insert.slice(typed.length);
  return remainder === "" ? null : { insert: remainder, from: request.column };
}
