import { describe, expect, it } from "vitest";
import { classifyLine, tokenAt, type TokenKind } from "./classify";
import { lexer } from "./tokens";

const kinds = (line: string): TokenKind[] =>
  classifyLine(line)
    .filter((t) => t.kind !== "whitespace")
    .map((t) => t.kind);

const images = (line: string): string[] =>
  classifyLine(line)
    .filter((t) => t.kind !== "whitespace")
    .map((t) => line.slice(t.from, t.to));

describe("classifyLine", () => {
  it("classifies a plain connection", () => {
    expect(kinds("user -> api")).toEqual(["identifier", "arrow", "identifier"]);
  });

  it("recognises every connector form", () => {
    for (const arrow of ["->", "<-", "<>", "--"]) {
      expect(kinds(`a ${arrow} b`), arrow).toEqual([
        "identifier",
        "arrow",
        "identifier",
      ]);
    }
  });

  it("classifies a labelled connector", () => {
    expect(kinds('api -"publishes"-> queue')).toEqual([
      "identifier",
      "dash",
      "string",
      "arrow",
      "identifier",
    ]);
  });

  it("treats `title` as a keyword but `titlebar` as an identifier", () => {
    expect(kinds('title "X"')).toEqual(["keyword", "string"]);
    expect(kinds("titlebar -> x")).toEqual(["identifier", "arrow", "identifier"]);
  });

  it("classifies an archetype override", () => {
    expect(kinds("sessions:redis")).toEqual(["identifier", "colon", "identifier"]);
  });

  it("classifies a comment to end of line", () => {
    expect(kinds("user -> api // a note")).toEqual([
      "identifier",
      "arrow",
      "identifier",
      "comment",
    ]);
  });

  it("does not let a dashed identifier swallow the arrow", () => {
    expect(images("login-page->auth-api")).toEqual([
      "login-page",
      "->",
      "auth-api",
    ]);
  });

  it("distinguishes an undirected connector from dashed identifiers", () => {
    expect(images("a-b--c-d")).toEqual(["a-b", "--", "c-d"]);
  });

  it("handles escaped quotes inside a label", () => {
    expect(kinds('a -"say \\"hi\\""-> b')).toEqual([
      "identifier",
      "dash",
      "string",
      "arrow",
      "identifier",
    ]);
  });

  it("classifies an inline colour", () => {
    expect(kinds("api #blue")).toEqual(["identifier", "color"]);
    expect(images("api #blue")).toEqual(["api", "#blue"]);
  });

  it("classifies a colour on both ends of a connection", () => {
    expect(kinds("a #blue -> b #green")).toEqual([
      "identifier",
      "color",
      "arrow",
      "identifier",
      "color",
    ]);
  });

  it("classifies a colour after an archetype override", () => {
    expect(kinds("sessions:redis #amber")).toEqual([
      "identifier",
      "colon",
      "identifier",
      "color",
    ]);
  });

  it("leaves a # inside a label as part of the string", () => {
    expect(kinds('a -"POST #1"-> b')).toEqual([
      "identifier",
      "dash",
      "string",
      "arrow",
      "identifier",
    ]);
  });

  it("treats a lone # as unknown, since it is not yet a colour", () => {
    expect(kinds("api #")).toEqual(["identifier", "unknown"]);
  });

  it("consumes an unrecognised character without losing the rest of the line", () => {
    expect(kinds("a % b")).toEqual(["identifier", "unknown", "identifier"]);
  });

  it("returns nothing for an empty line", () => {
    expect(classifyLine("")).toEqual([]);
  });

  it("covers the whole line with no gaps or overlaps", () => {
    const line = 'title "T" // x';
    let at = 0;
    for (const token of classifyLine(line)) {
      expect(token.from).toBe(at);
      at = token.to;
    }
    expect(at).toBe(line.length);
  });
});

/**
 * The test that keeps the colours honest. If these two ever disagree, the editor
 * is painting something the parser does not believe.
 */
describe("agreement with the Chevrotain lexer", () => {
  const CORPUS = [
    "user -> api",
    "api <- worker",
    "api <> database",
    "api -- cdn",
    'api -"publishes"-> queue',
    'api -"verify password hash"-> api',
    "user -> api -> database",
    "sessions:redis",
    'title "Authentication Service"',
    "login-page->auth-api",
    "a-b--c-d",
    "titlebar -> screen",
    "user_db -> s3",
    'a -"say \\"hi\\""-> b',
    "  user   ->   api  ",
    "api #blue",
    "user -> auth-api #green",
    "auth-api #blue -> user-db #amber",
    "sessions:redis #purple",
  ];

  it("produces the same token boundaries as the lexer", () => {
    for (const line of CORPUS) {
      const lexed = lexer.tokenize(line);
      expect(lexed.errors, line).toEqual([]);

      const mine = classifyLine(line).filter(
        (t) => t.kind !== "whitespace" && t.kind !== "comment",
      );

      expect(
        mine.map((t) => [t.from, line.slice(t.from, t.to)]),
        line,
      ).toEqual(lexed.tokens.map((t) => [t.startOffset, t.image]));
    }
  });

  it("agrees that `title` is its own token type", () => {
    const [first] = lexer.tokenize('title "X"').tokens;
    expect(first?.tokenType.name).toBe("Title");
    expect(classifyLine('title "X"')[0]?.kind).toBe("keyword");
  });
});

/**
 * Where the two deliberately part company: this runs on half-typed text, and an
 * unterminated string is the normal state of a line someone is writing.
 */
describe("incomplete input", () => {
  it("classifies an unterminated string rather than rejecting it", () => {
    expect(kinds('api -"enter cred')).toEqual([
      "identifier",
      "dash",
      "unterminatedString",
    ]);
  });

  it("runs an unterminated string to the end of the line", () => {
    const line = 'a -"abc';
    const last = classifyLine(line).at(-1)!;
    expect(last.to).toBe(line.length);
  });

  it("handles a line ending mid-arrow", () => {
    expect(kinds("user -")).toEqual(["identifier", "dash"]);
  });

  it("is exactly the case the lexer errors on", () => {
    expect(lexer.tokenize('api -"enter cred').errors.length).toBeGreaterThan(0);
    expect(() => classifyLine('api -"enter cred')).not.toThrow();
  });
});

describe("tokenAt", () => {
  const line = "user -> api";

  it("finds the token under the cursor", () => {
    expect(tokenAt(line, 2)?.kind).toBe("identifier");
    expect(tokenAt(line, 6)?.kind).toBe("arrow");
  });

  it("treats the end of a token as still inside it", () => {
    // Cursor sits right after "user" — you are still typing that word.
    expect(tokenAt(line, 4)).toMatchObject({ from: 0, to: 4 });
  });

  it("returns null past the end of the line", () => {
    expect(tokenAt(line, 99)).toBeNull();
  });

  it("returns null for an empty line", () => {
    expect(tokenAt("", 0)).toBeNull();
  });
});
