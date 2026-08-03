"use client";

import { closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { EditorState } from "@codemirror/state";
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { useEffect, useRef } from "react";
import { typeSketchCompletion } from "@/components/editor/completion";
import { ghostText } from "@/components/editor/ghostText";
import { typeSketchHighlighting } from "@/components/editor/language";
import { EMPTY_GRAPH, type IRGraph } from "@/core/ir";

/**
 * The typing surface.
 *
 * Composed explicitly rather than with `basicSetup`, which bundles its own
 * `autocompletion()` and highlight style — both of which would compete with the
 * TypeSketch ones — along with code folding and search that a language of
 * single-line statements has no use for.
 */
export function Editor({
  value,
  onChange,
  graph,
}: {
  value: string;
  onChange: (next: string) => void;
  graph: IRGraph;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);

  // Kept in refs so the editor is created once and never torn down on
  // re-render — recreating it would drop the cursor on every keystroke.
  const notify = useRef(onChange);
  const latestGraph = useRef<IRGraph>(graph);

  useEffect(() => {
    notify.current = onChange;
  }, [onChange]);

  /**
   * Completions are pull-based, so a ref is enough: whenever the engine asks,
   * it gets the current graph. Reconfiguring the editor on every keystroke to
   * push a new graph in would be far more work for the same answer.
   */
  useEffect(() => {
    latestGraph.current = graph;
  }, [graph]);

  useEffect(() => {
    if (!host.current) return;

    const getGraph = () => latestGraph.current ?? EMPTY_GRAPH;

    const editor = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          history(),
          drawSelection(),
          dropCursor(),
          closeBrackets(),
          EditorView.lineWrapping,

          typeSketchHighlighting(),
          typeSketchCompletion(getGraph),
          ghostText(getGraph),

          // Ghost text binds Tab at high precedence, so it is resolved before
          // anything here.
          keymap.of([
            ...closeBracketsKeymap,
            ...completionKeymap,
            ...historyKeymap,
            ...defaultKeymap,
          ]),

          EditorView.updateListener.of((update) => {
            if (update.docChanged) notify.current(update.state.doc.toString());
          }),

          EditorView.theme({
            "&": { height: "100%", fontSize: "14px", background: "transparent" },
            ".cm-scroller": {
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              lineHeight: "1.7",
            },
            ".cm-content": { padding: "16px 8px" },
            "&.cm-focused": { outline: "none" },
            ".cm-gutters": {
              background: "transparent",
              border: "none",
              color: "var(--muted-foreground)",
            },
            ".cm-activeLine": { background: "color-mix(in oklch, var(--accent) 45%, transparent)" },
            ".cm-activeLineGutter": { background: "transparent" },
            ".cm-tooltip": {
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
            },
            ".cm-tooltip-autocomplete ul li": {
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              fontSize: "12.5px",
              padding: "4px 8px",
            },
            ".cm-tooltip-autocomplete ul li[aria-selected]": {
              background: "var(--accent)",
              color: "var(--accent-foreground)",
            },
            ".cm-completionDetail": {
              fontStyle: "normal",
              opacity: "0.6",
              marginLeft: "10px",
            },
          }),
        ],
      }),
      parent: host.current,
    });

    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
    // Mount once: `value` is synced by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Only push external changes in — echoing our own edits would fight the cursor. */
  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    const current = editor.state.doc.toString();
    if (current === value) return;
    editor.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    });
  }, [value]);

  return <div ref={host} className="h-full overflow-auto" />;
}
