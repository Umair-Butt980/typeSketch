import { classifyLine, type ClassifiedToken } from "@/core/lang/classify";

/**
 * Where the cursor is, in grammatical terms.
 *
 * No parser is involved. The grammar is line-scoped, so the text before the
 * cursor fully determines what may legally come next — and a scanner over the
 * prefix works on half-typed lines, which is the only state that matters here.
 */
export type CursorContext =
  /** Beginning of a statement: a node name, or `title`. */
  | { kind: "statementStart"; prefix: string; from: number }
  /** After a node name: a connector must follow. */
  | { kind: "connector"; prefix: string; from: number; afterLabel: boolean }
  /** After a connector: the node being pointed at. */
  | { kind: "target"; prefix: string; from: number }
  /** After `name:` — an explicit shape. */
  | { kind: "archetype"; prefix: string; from: number }
  /** Inside prose or mid-token: offering anything here would obstruct. */
  | { kind: "suppressed" };

const SUPPRESSED: CursorContext = { kind: "suppressed" };

export function contextAt(line: string, column: number): CursorContext {
  const clamped = Math.max(0, Math.min(column, line.length));
  const tokens = classifyLine(line.slice(0, clamped));

  const last = tokens.at(-1);

  /**
   * Inside a comment or an unterminated string the user is writing prose. This
   * is the case that makes the difference between helpful and obstructive:
   * offering `elasticsearch` in the middle of `-"enter credentials"` is worse
   * than offering nothing at all.
   */
  if (last?.kind === "comment" || last?.kind === "unterminatedString") {
    return SUPPRESSED;
  }

  // The word being typed, if the cursor is sitting at the end of one.
  const typing =
    last && (last.kind === "identifier" || last.kind === "keyword") && last.to === clamped
      ? last
      : null;

  const prefix = typing ? line.slice(typing.from, typing.to) : "";
  const from = typing ? typing.from : clamped;

  const preceding = tokens
    .slice(0, typing ? tokens.length - 1 : tokens.length)
    .filter((token) => token.kind !== "whitespace");

  const previous = preceding.at(-1);

  if (!previous) return { kind: "statementStart", prefix, from };

  return classifyByPrevious(previous, prefix, from);
}

function classifyByPrevious(
  previous: ClassifiedToken,
  prefix: string,
  from: number,
): CursorContext {
  switch (previous.kind) {
    case "colon":
      return { kind: "archetype", prefix, from };

    case "arrow":
      return { kind: "target", prefix, from };

    case "identifier":
      return { kind: "connector", prefix, from, afterLabel: false };

    /**
     * `api -"publishes"` — the label is closed, so an arrow must come next. The
     * labelled-connector snippet is withheld because one is already written.
     */
    case "string":
      return { kind: "connector", prefix, from, afterLabel: true };

    /**
     * `title` wants a quoted string and `-` wants a label. Neither is something
     * a word list can usefully complete.
     */
    case "keyword":
    case "dash":
    case "unknown":
    case "comment":
    case "unterminatedString":
    case "whitespace":
      return SUPPRESSED;
  }
}
