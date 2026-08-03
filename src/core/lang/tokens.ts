import { createToken, Lexer } from "chevrotain";

/**
 * Token order is significant: Chevrotain tries these in sequence, so every
 * multi-character operator must precede the single-character one it starts
 * with, or `--` would lex as two `-` and `<>` would never match.
 */

export const WhiteSpace = createToken({
  name: "WhiteSpace",
  pattern: /[ \t]+/,
  group: Lexer.SKIPPED,
});

export const Comment = createToken({
  name: "Comment",
  pattern: /\/\/[^\n]*/,
  group: Lexer.SKIPPED,
});

export const StringLiteral = createToken({
  name: "StringLiteral",
  pattern: /"(?:[^"\\]|\\.)*"/,
});

export const ArrowBoth = createToken({ name: "ArrowBoth", pattern: /<>/ });
export const ArrowLeft = createToken({ name: "ArrowLeft", pattern: /<-/ });
export const ArrowRight = createToken({ name: "ArrowRight", pattern: /->/ });
export const ArrowNone = createToken({ name: "ArrowNone", pattern: /--/ });

/** Only ever the lead-in of a labelled arrow: `-"publishes"->`. */
export const Dash = createToken({ name: "Dash", pattern: /-/ });
export const Colon = createToken({ name: "Colon", pattern: /:/ });

/**
 * An inline colour, `#blue`. `#` is otherwise unused — comments are `//` — and a
 * `#` inside a quoted label is already swallowed by the string token, so there
 * is nothing to disambiguate.
 */
export const ColorTag = createToken({
  name: "ColorTag",
  pattern: /#[A-Za-z][A-Za-z0-9-]*/,
});

/**
 * Identifiers may contain interior dashes (`login-page`) but a dash must be
 * followed by a word character. That is what lets `user->api` lex correctly
 * without requiring spaces: the `-` of `->` cannot be absorbed into `user`.
 */
export const Identifier = createToken({
  name: "Identifier",
  pattern: /[A-Za-z_][A-Za-z0-9_]*(?:-[A-Za-z0-9_]+)*/,
});

/** `longer_alt` keeps `titlebar` lexing as an identifier rather than `title` + `bar`. */
export const Title = createToken({
  name: "Title",
  pattern: /title/,
  longer_alt: Identifier,
});

export const allTokens = [
  WhiteSpace,
  Comment,
  StringLiteral,
  ArrowBoth,
  ArrowLeft,
  ArrowRight,
  ArrowNone,
  Dash,
  Colon,
  ColorTag,
  Title,
  Identifier,
];

export const lexer = new Lexer(allTokens, { positionTracking: "onlyOffset" });
