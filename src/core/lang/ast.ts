import type { Diagnostic } from "@/core/diagnostics";

/** The four connector forms. `<-` is normalised away by the IR builder. */
export type ArrowOp = "->" | "<-" | "<>" | "--";

export interface NodeRef {
  /** Identifier exactly as typed, e.g. `login-page`. */
  name: string;
  /** Explicit archetype from `cache:redis`, overriding registry lookup. */
  archetype?: string;
  /** Column range of the reference within its line, for editor linking. */
  from: number;
  to: number;
}

export interface ChainLink {
  arrow: ArrowOp;
  label?: string;
  target: NodeRef;
}

export type Statement =
  | { kind: "title"; text: string; line: number }
  /**
   * One or more node references joined by arrows. A chain of length one is a
   * bare declaration (`user`), which is how a node comes into existence without
   * being connected to anything.
   */
  | { kind: "chain"; head: NodeRef; links: ChainLink[]; line: number };

export interface ParseResult {
  statements: Statement[];
  diagnostics: Diagnostic[];
}
