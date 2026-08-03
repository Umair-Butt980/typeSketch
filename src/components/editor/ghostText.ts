import { Prec, StateField, type EditorState, type Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  WidgetType,
  keymap,
  type DecorationSet,
} from "@codemirror/view";
import { ghostFor } from "@/core/complete";
import type { IRGraph } from "@/core/ir";

/**
 * Copilot-style inline suggestion.
 *
 * CodeMirror has no built-in inline completion, so this is a small extension: a
 * `StateField` deriving the ghost from each new state, a widget decoration
 * painting it after the cursor, and Tab to accept.
 *
 * The field derives its value **synchronously from the transaction's state**
 * rather than watching the view and dispatching back into it. A plugin that
 * dispatches during `update` has to defer the dispatch to avoid re-entrancy,
 * which puts the ghost one frame behind the cursor — visible as a flicker on
 * every keystroke.
 */

interface Ghost {
  insert: string;
  from: number;
}

class GhostWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }

  override eq(other: GhostWidget): boolean {
    return other.text === this.text;
  }

  override toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-ghostText";
    span.textContent = this.text;
    // A visual hint only. A screen reader announcing text that is not in the
    // document would be a bug, not a feature.
    span.setAttribute("aria-hidden", "true");
    return span;
  }

  /** Not editable content — clicks should fall through to the line beneath. */
  override ignoreEvent(): boolean {
    return false;
  }
}

function computeGhost(state: EditorState, getGraph: () => IRGraph): Ghost | null {
  const selection = state.selection.main;
  // Nothing to extend while text is selected, and a ghost beside a multi-cursor
  // would be ambiguous about which cursor it belongs to.
  if (!selection.empty || state.selection.ranges.length > 1) return null;

  const line = state.doc.lineAt(selection.head);
  const ghost = ghostFor({
    line: line.text,
    column: selection.head - line.from,
    graph: getGraph(),
    lineIndex: line.number - 1,
  });

  if (!ghost) return null;
  return { insert: ghost.insert, from: line.from + ghost.from };
}

export function ghostText(getGraph: () => IRGraph): Extension {
  const field = StateField.define<Ghost | null>({
    create: (state) => computeGhost(state, getGraph),

    update(value, transaction) {
      if (!transaction.docChanged && !transaction.selection) return value;
      return computeGhost(transaction.state, getGraph);
    },

    provide: (self) =>
      EditorView.decorations.from(self, (ghost): DecorationSet =>
        ghost
          ? Decoration.set([
              Decoration.widget({
                widget: new GhostWidget(ghost.insert),
                side: 1,
              }).range(ghost.from),
            ])
          : Decoration.none,
      ),
  });

  const accept = keymap.of([
    {
      key: "Tab",
      run: (view) => {
        const ghost = view.state.field(field);
        // Returning false lets Tab keep whatever meaning it otherwise has.
        if (!ghost) return false;

        view.dispatch({
          changes: { from: ghost.from, insert: ghost.insert },
          selection: { anchor: ghost.from + ghost.insert.length },
          userEvent: "input.complete",
        });
        return true;
      },
    },
  ]);

  const theme = EditorView.theme({
    ".cm-ghostText": {
      color: "var(--syn-ghost)",
      opacity: "0.85",
      pointerEvents: "none",
    },
  });

  // Ahead of any other Tab binding, so accepting a suggestion is never
  // intercepted by indentation.
  return [field, Prec.high(accept), theme];
}
