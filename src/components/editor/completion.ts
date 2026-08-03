import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";
import { completionsAt, type Suggestion, type SuggestionKind } from "@/core/complete";
import type { IRGraph } from "@/core/ir";

/** Only affects the icon and CSS class CodeMirror attaches to each row. */
const CM_TYPE: Record<SuggestionKind, string> = {
  node: "variable",
  shape: "type",
  connector: "keyword",
  snippet: "text",
  color: "enum",
};

function toCompletion(suggestion: Suggestion): Completion {
  return {
    label: suggestion.label,
    type: CM_TYPE[suggestion.kind],
    ...(suggestion.detail === undefined ? {} : { detail: suggestion.detail }),
    apply: (view, _completion, from, to) => {
      view.dispatch({
        changes: { from, to, insert: suggestion.insert },
        // A snippet such as `-"label"->` drops the caret between the quotes;
        // everything else lands after the inserted text.
        selection: {
          anchor: from + (suggestion.cursorOffset ?? suggestion.insert.length),
        },
        userEvent: "input.complete",
      });
    },
  };
}

/**
 * Adapts the deterministic engine to CodeMirror.
 *
 * `filter: false` is deliberate: the engine already ranks and filters, and
 * letting CodeMirror re-score would make the popup disagree with the inline
 * ghost text about which suggestion is best. One ordering, two surfaces.
 *
 * The graph is read through a getter rather than captured, because completions
 * are pull-based — reading at call time is always current, and avoids
 * reconfiguring the editor on every keystroke.
 */
export function typeSketchCompletion(getGraph: () => IRGraph): Extension {
  function source(context: CompletionContext): CompletionResult | null {
    const line = context.state.doc.lineAt(context.pos);
    const { from, suggestions } = completionsAt({
      line: line.text,
      column: context.pos - line.from,
      graph: getGraph(),
      lineIndex: line.number - 1,
    });

    if (suggestions.length === 0) return null;

    return {
      from: line.from + from,
      to: context.pos,
      filter: false,
      options: suggestions.map(toCompletion),
    };
  }

  return autocompletion({
    override: [source],
    activateOnTyping: true,
    closeOnBlur: true,
    // The popup teaches vocabulary; a one-item list has nothing to teach and
    // would just cover the next line.
    maxRenderedOptions: 12,
  });
}
