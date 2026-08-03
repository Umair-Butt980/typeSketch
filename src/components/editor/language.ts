import {
  HighlightStyle,
  StreamLanguage,
  syntaxHighlighting,
  type StreamParser,
  type StringStream,
} from "@codemirror/language";
import { tags } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";
import { classifyLine, type ClassifiedToken, type TokenKind } from "@/core/lang/classify";

/**
 * Syntax highlighting over the *same* classifier the completion engine uses,
 * which is itself tested against the Chevrotain lexer. Hand-written editor modes
 * classically drift from the real grammar until the colours start lying about
 * what the parser sees; there is only one tokenizer here, so they cannot.
 *
 * `StreamLanguage` rather than a Lezer grammar: a Lezer grammar needs a build
 * step and a generated parser, and buys incremental reparsing that a language of
 * single-line statements has no use for.
 */

/** CodeMirror's standard style names, so no `tokenTable` is needed. */
const STYLES: Record<TokenKind, string | null> = {
  keyword: "keyword",
  string: "string",
  unterminatedString: "string",
  comment: "comment",
  arrow: "operator",
  dash: "punctuation",
  colon: "punctuation",
  color: "atom",
  identifier: "variableName",
  unknown: "invalid",
  whitespace: null,
};

/**
 * `classifyLine` runs per token rather than per line, so one line's worth of
 * results is memoised. Lines are short and this is called on every repaint.
 */
let cachedLine: string | null = null;
let cachedTokens: ClassifiedToken[] = [];

function tokensFor(line: string): ClassifiedToken[] {
  if (line !== cachedLine) {
    cachedLine = line;
    cachedTokens = classifyLine(line);
  }
  return cachedTokens;
}

const parser: StreamParser<unknown> = {
  name: "typesketch",
  token(stream: StringStream): string | null {
    const token = tokensFor(stream.string).find((t) => t.from === stream.pos);

    if (!token) {
      // Should not happen — the classifier covers every character — but a
      // tokenizer that can stall would freeze the editor, so it always advances.
      stream.next();
      return null;
    }

    stream.pos = token.to;
    return STYLES[token.kind];
  },
};

export const typeSketchLanguage = StreamLanguage.define(parser);

const highlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--syn-keyword)", fontWeight: "600" },
  { tag: tags.operator, color: "var(--syn-arrow)", fontWeight: "600" },
  { tag: tags.string, color: "var(--syn-string)" },
  { tag: tags.comment, color: "var(--syn-comment)", fontStyle: "italic" },
  { tag: tags.punctuation, color: "var(--syn-arrow)" },
  { tag: tags.variableName, color: "var(--foreground)" },
  { tag: tags.atom, color: "var(--syn-color-tag)", fontWeight: "600" },
  { tag: tags.invalid, color: "var(--syn-invalid)" },
]);

export function typeSketchHighlighting(): Extension {
  return [typeSketchLanguage, syntaxHighlighting(highlightStyle)];
}
