/**
 * Diagnostics are produced by the parser and carried all the way through to the
 * editor gutter, so they live above both `lang` and `ir` rather than inside
 * either one.
 *
 * Positions are 0-indexed; `from`/`to` are columns within `line`, end-exclusive.
 */

export type DiagnosticSeverity = "error" | "warning";

export interface Diagnostic {
  severity: DiagnosticSeverity;
  message: string;
  line: number;
  from: number;
  to: number;
}
