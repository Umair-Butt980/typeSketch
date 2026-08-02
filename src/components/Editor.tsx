"use client";

import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { useEffect, useRef } from "react";

/**
 * The typing surface.
 *
 * P1c ships a plain CodeMirror. The TypeSketch language mode — arrow
 * highlighting, inline diagnostic underlines, autocomplete over the alias
 * table — is P2; diagnostics show in the strip below the pane until then.
 */
export function Editor({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  // Kept in a ref so the editor is created once and never torn down on
  // re-render — recreating it would drop the cursor on every keystroke.
  const notify = useRef(onChange);
  useEffect(() => {
    notify.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!host.current) return;

    const editor = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          EditorView.lineWrapping,
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
            ".cm-activeLine, .cm-activeLineGutter": { background: "transparent" },
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
