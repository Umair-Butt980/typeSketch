/**
 * Lexical classification, shared by syntax highlighting and by the completion
 * engine's cursor-context scanner.
 *
 * It exists so those two features cannot disagree with the parser. Hand-written
 * editor modes classically drift from the real grammar until the colours start
 * lying about what the parser sees; keeping one classifier — tested against the
 * Chevrotain lexer — is what prevents that.
 *
 * **One deliberate divergence.** The lexer runs on committed text and treats an
 * unterminated string as an error. This runs on text someone is halfway through
 * typing, where `-"enter cred` is the completely normal state of a line. So an
 * unterminated string is classified rather than rejected — the highlighter needs
 * to colour it, and completion needs to know the cursor is inside prose.
 */

export type TokenKind =
  | "identifier"
  | "keyword"
  | "string"
  | "unterminatedString"
  | "arrow"
  | "dash"
  | "colon"
  | "color"
  | "comment"
  | "whitespace"
  | "unknown";

export interface ClassifiedToken {
  from: number;
  /** Exclusive. */
  to: number;
  kind: TokenKind;
}

/**
 * Order mirrors `tokens.ts` and is significant: every multi-character operator
 * must precede the single character it starts with, or `--` splits into two
 * dashes and `<>` never matches at all.
 */
const RULES: { re: RegExp; kind: TokenKind }[] = [
  { re: /[ \t]+/y, kind: "whitespace" },
  { re: /\/\/[^\n]*/y, kind: "comment" },
  { re: /"(?:[^"\\]|\\.)*"/y, kind: "string" },
  // Only reachable once the terminated form above has failed.
  { re: /"(?:[^"\\]|\\.)*/y, kind: "unterminatedString" },
  { re: /<>/y, kind: "arrow" },
  { re: /<-/y, kind: "arrow" },
  { re: /->/y, kind: "arrow" },
  { re: /--/y, kind: "arrow" },
  { re: /-/y, kind: "dash" },
  { re: /:/y, kind: "colon" },
  { re: /#[A-Za-z][A-Za-z0-9-]*/y, kind: "color" },
  /**
   * Identifiers may contain interior dashes, but a dash must be followed by a
   * word character — which is exactly what lets `user->api` split correctly
   * without spaces, since the `-` of `->` cannot be absorbed.
   */
  { re: /[A-Za-z_][A-Za-z0-9_]*(?:-[A-Za-z0-9_]+)*/y, kind: "identifier" },
];

/** Matches Chevrotain's `longer_alt`, which keeps `titlebar` a single identifier. */
const KEYWORDS = new Set(["title"]);

export function classifyLine(line: string): ClassifiedToken[] {
  const tokens: ClassifiedToken[] = [];
  let at = 0;

  while (at < line.length) {
    let matched = false;

    for (const rule of RULES) {
      rule.re.lastIndex = at;
      const match = rule.re.exec(line);
      if (!match || match[0] === "") continue;

      const to = at + match[0].length;
      const kind =
        rule.kind === "identifier" && KEYWORDS.has(match[0])
          ? "keyword"
          : rule.kind;

      tokens.push({ from: at, to, kind });
      at = to;
      matched = true;
      break;
    }

    // An unrecognised character is consumed one at a time rather than aborting,
    // so a stray `%` colours as unknown and everything after it still lexes.
    if (!matched) {
      tokens.push({ from: at, to: at + 1, kind: "unknown" });
      at += 1;
    }
  }

  return tokens;
}

/**
 * The token containing `column`, treating the column as a cursor position: a
 * cursor at the end of a token is still "in" it, which is what makes completion
 * work while typing the last character of a word.
 */
export function tokenAt(
  line: string,
  column: number,
): ClassifiedToken | null {
  for (const token of classifyLine(line)) {
    if (column >= token.from && column <= token.to) return token;
  }
  return null;
}
