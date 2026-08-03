import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vitest";
import { buildIR } from "@/core/ir";
import { parse } from "@/core/lang";
import { registryResolver } from "@/core/registry";
import { ghostText } from "./ghostText";
import { typeSketchHighlighting } from "./language";

const DOCUMENT_SO_FAR = "user -> auth-api\nauth-api <> user-db";
const graph = buildIR(parse(DOCUMENT_SO_FAR), registryResolver);

let view: EditorView | null = null;

afterEach(() => {
  view?.destroy();
  view = null;
});

/** Opens an editor with the caret placed where `|` appears. */
function open(spec: string): EditorView {
  const cursor = spec.indexOf("|");
  const doc = spec.replace("|", "");

  const parent = document.createElement("div");
  document.body.append(parent);

  view = new EditorView({
    state: EditorState.create({
      doc,
      selection: { anchor: cursor },
      extensions: [typeSketchHighlighting(), ghostText(() => graph)],
    }),
    parent,
  });

  return view;
}

const ghost = (editor: EditorView) =>
  editor.dom.querySelector(".cm-ghostText")?.textContent ?? null;

function pressTab(editor: EditorView) {
  editor.contentDOM.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }),
  );
}

describe("ghost text", () => {
  it("completes a node already in the document", () => {
    expect(ghost(open(`${DOCUMENT_SO_FAR}\nuser -> auth|`))).toBe("-api");
  });

  it("shows nothing once the word is complete", () => {
    expect(ghost(open(`${DOCUMENT_SO_FAR}\nuser -> auth-api|`))).toBeNull();
  });

  it("shows nothing with an empty prefix", () => {
    expect(ghost(open(`${DOCUMENT_SO_FAR}\nuser -> |`))).toBeNull();
  });

  it("shows nothing inside a label, where the user is writing prose", () => {
    expect(ghost(open(`${DOCUMENT_SO_FAR}\napi -"enter cred|`))).toBeNull();
  });

  it("shows nothing while text is selected", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    view = new EditorView({
      state: EditorState.create({
        doc: `${DOCUMENT_SO_FAR}\nuser -> auth`,
        selection: { anchor: DOCUMENT_SO_FAR.length + 9, head: DOCUMENT_SO_FAR.length + 13 },
        extensions: [ghostText(() => graph)],
      }),
      parent,
    });
    expect(ghost(view)).toBeNull();
  });

  it("hides the ghost from assistive technology", () => {
    const editor = open(`${DOCUMENT_SO_FAR}\nuser -> auth|`);
    expect(
      editor.dom.querySelector(".cm-ghostText")?.getAttribute("aria-hidden"),
    ).toBe("true");
  });

  it("updates as more is typed", () => {
    const editor = open(`${DOCUMENT_SO_FAR}\nuser -> a|`);
    const before = ghost(editor);

    editor.dispatch({
      changes: { from: editor.state.selection.main.head, insert: "u" },
      selection: { anchor: editor.state.selection.main.head + 1 },
    });

    expect(ghost(editor)).not.toBe(before);
    expect(ghost(editor)).toBe("th-api");
  });
});

describe("accepting with Tab", () => {
  it("inserts the remainder and leaves the caret after it", () => {
    const editor = open(`${DOCUMENT_SO_FAR}\nuser -> auth|`);
    pressTab(editor);

    expect(editor.state.doc.toString().endsWith("user -> auth-api")).toBe(true);
    expect(editor.state.selection.main.head).toBe(editor.state.doc.length);
  });

  it("clears the ghost once accepted", () => {
    const editor = open(`${DOCUMENT_SO_FAR}\nuser -> auth|`);
    pressTab(editor);
    expect(ghost(editor)).toBeNull();
  });

  it("does not insert a tab character when there is no ghost", () => {
    const editor = open(`${DOCUMENT_SO_FAR}\nuser -> |`);
    const before = editor.state.doc.toString();
    pressTab(editor);
    expect(editor.state.doc.toString()).toBe(before);
  });

  /** Tab must never rewrite what was typed — only extend it. */
  it("only ever appends", () => {
    const editor = open(`${DOCUMENT_SO_FAR}\nuser -> auth|`);
    const before = editor.state.doc.toString();
    pressTab(editor);
    expect(editor.state.doc.toString().startsWith(before)).toBe(true);
  });
});
