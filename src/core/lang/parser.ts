import { EmbeddedActionsParser, EOF, type IToken } from "chevrotain";
import type { Diagnostic } from "@/core/diagnostics";
import type { ArrowOp, ChainLink, NodeRef, ParseResult, Statement } from "./ast";
import {
  allTokens,
  ArrowBoth,
  ArrowLeft,
  ArrowNone,
  ArrowRight,
  Colon,
  Dash,
  Identifier,
  lexer,
  StringLiteral,
  Title,
} from "./tokens";

/**
 * Parsing is **statement-scoped**: every line is lexed and parsed on its own.
 *
 * This is not a stylistic choice. Half the time the user is mid-keystroke and
 * the current line reads `user -> ` — a document-wide parser would fail and the
 * canvas would blank on every other keypress. Here that line yields a
 * diagnostic and is skipped, while every other line still renders.
 */
class TypeSketchParser extends EmbeddedActionsParser {
  constructor() {
    super(allTokens, { recoveryEnabled: false });
    this.performSelfAnalysis();
  }

  public statement = this.RULE("statement", (): Statement | undefined =>
    this.OR<Statement | undefined>([
      { ALT: () => this.SUBRULE(this.titleStatement) },
      { ALT: () => this.SUBRULE(this.chainStatement) },
    ]),
  );

  private titleStatement = this.RULE("titleStatement", (): Statement => {
    this.CONSUME(Title);
    const text = this.CONSUME(StringLiteral);
    return { kind: "title", text: unquote(text.image), line: 0 };
  });

  private chainStatement = this.RULE("chainStatement", (): Statement => {
    const head = this.SUBRULE(this.nodeRef);
    const links: ChainLink[] = [];
    this.MANY(() => {
      const connector = this.SUBRULE(this.connector);
      const target = this.SUBRULE2(this.nodeRef);
      links.push(
        connector.label === undefined
          ? { arrow: connector.arrow, target }
          : { arrow: connector.arrow, label: connector.label, target },
      );
    });
    return { kind: "chain", head, links, line: 0 };
  });

  private nodeRef = this.RULE("nodeRef", (): NodeRef => {
    const name = this.CONSUME(Identifier);
    let archetype: string | undefined;
    // `positionTracking: "onlyOffset"` records start offsets only, so ends are
    // derived from the image rather than read off the token.
    let end = endOf(name);

    this.OPTION(() => {
      this.CONSUME(Colon);
      const kind = this.CONSUME2(Identifier);
      archetype = kind.image;
      end = endOf(kind);
    });

    const ref: NodeRef = {
      name: name.image,
      from: name.startOffset,
      to: end,
    };
    return archetype === undefined ? ref : { ...ref, archetype };
  });

  /** `->`, `<-`, `<>`, `--`, each optionally prefixed with `-"a label"`. */
  private connector = this.RULE(
    "connector",
    (): { arrow: ArrowOp; label?: string } => {
      let label: string | undefined;
      this.OPTION(() => {
        this.CONSUME(Dash);
        const text = this.CONSUME(StringLiteral);
        label = unquote(text.image);
      });

      const arrow = this.OR<ArrowOp>([
        { ALT: () => (this.CONSUME(ArrowRight), "->" as const) },
        { ALT: () => (this.CONSUME(ArrowLeft), "<-" as const) },
        { ALT: () => (this.CONSUME(ArrowBoth), "<>" as const) },
        { ALT: () => (this.CONSUME(ArrowNone), "--" as const) },
      ]);

      return label === undefined ? { arrow } : { arrow, label };
    },
  );
}

/** Chevrotain parsers are expensive to build; one instance is reused. */
const parser = new TypeSketchParser();

function unquote(image: string): string {
  return image.slice(1, -1).replace(/\\(["\\])/g, "$1");
}

/** Exclusive end column of a token. */
function endOf(token: IToken): number {
  return token.startOffset + token.image.length;
}

/**
 * Chevrotain's own messages ("Expecting token of type --> Identifier <-- but
 * found...") leak grammar internals into the editor gutter. These read as
 * something a person wrote.
 */
function describe(error: { name: string; token: IToken }, lineText: string) {
  const atEnd = error.token.tokenType === EOF;
  const from = atEnd ? Math.max(0, lineText.trimEnd().length) : error.token.startOffset;
  const to = atEnd ? Math.max(1, lineText.trimEnd().length + 1) : endOf(error.token);

  let message: string;
  if (atEnd) {
    message = "Incomplete statement — expected a node name here.";
  } else if (error.name === "NotAllInputParsedException") {
    message = `Unexpected \`${error.token.image}\` after the end of the statement.`;
  } else {
    message = `Unexpected \`${error.token.image}\`.`;
  }

  return { message, from, to };
}

/**
 * Parse a whole document. Never throws: malformed lines become diagnostics.
 */
export function parse(text: string): ParseResult {
  const statements: Statement[] = [];
  const diagnostics: Diagnostic[] = [];

  text.split(/\r?\n/).forEach((lineText, line) => {
    if (lineText.trim() === "") return;

    const lexed = lexer.tokenize(lineText);

    for (const error of lexed.errors) {
      diagnostics.push({
        severity: "error",
        message: `Unrecognised character \`${lineText.charAt(error.offset)}\`.`,
        line,
        from: error.offset,
        to: error.offset + Math.max(1, error.length),
      });
    }

    // A comment-only line lexes to nothing and is not an error.
    if (lexed.tokens.length === 0) return;

    parser.input = lexed.tokens;
    const statement = parser.statement();

    const failure = parser.errors[0];
    if (failure) {
      const { message, from, to } = describe(failure, lineText);
      diagnostics.push({ severity: "error", message, line, from, to });
      return;
    }

    if (statement) statements.push({ ...statement, line });
  });

  return { statements, diagnostics };
}
