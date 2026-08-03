import { describe, expect, it } from "vitest";
import { buildIR } from "@/core/ir";
import { parse } from "@/core/lang";
import { registryResolver } from "@/core/registry";
import { completionsAt, ghostFor, type CompletionRequest } from "./engine";

const DOCUMENT = `title "Authentication Service"
user -> login-page
login-page -> auth-api
auth-api <> user-db
auth-api -> session-store`;

const graph = buildIR(parse(DOCUMENT), registryResolver);

/** `ask("user -> ap|", 6)` — the pipe marks the cursor, the number the line. */
function ask(spec: string, lineIndex = 99): CompletionRequest {
  const column = spec.indexOf("|");
  if (column < 0) throw new Error("mark the cursor with |");
  return { line: spec.replace("|", ""), column, graph, lineIndex };
}

const labels = (spec: string, lineIndex?: number) =>
  completionsAt(ask(spec, lineIndex)).suggestions.map((s) => s.label);

describe("ranking", () => {
  it("puts nodes already in the document above registry words", () => {
    const result = labels("user -> au|");
    expect(result[0]).toBe("auth-api");
    expect(result).toContain("auth");
    expect(result.indexOf("auth-api")).toBeLessThan(result.indexOf("auth"));
  });

  it("suggests registry words when nothing in the document matches", () => {
    expect(labels("user -> postg|")).toEqual(["postgres", "postgresql"]);
  });

  it("prefers prefix matches over substring matches", () => {
    const result = labels("user -> db|");
    // `db` itself is filtered out as already complete; `user-db` contains it.
    expect(result).toContain("user-db");
  });

  it("explains what an alias resolves to", () => {
    const redis = completionsAt(ask("sessions:red|")).suggestions[0];
    expect(redis).toMatchObject({ label: "redis", detail: "cache" });
  });

  it("does not add a redundant detail to an archetype's own name", () => {
    const cache = completionsAt(ask("sessions:cach|")).suggestions.find(
      (s) => s.label === "cache",
    );
    expect(cache?.detail).toBeUndefined();
  });

  it("marks document nodes so they are distinguishable in the popup", () => {
    const top = completionsAt(ask("user -> auth|")).suggestions[0];
    expect(top).toMatchObject({ kind: "node", detail: "in this diagram" });
  });
});

describe("context sensitivity", () => {
  it("offers connectors, and only connectors, after a node name", () => {
    const result = labels("user |");
    expect(result).toEqual(["->", "<>", "<-", "--", '-"label"->']);
  });

  it("withholds the labelled connector when a label is already written", () => {
    expect(labels('api -"publishes"|')).toEqual(["->", "<>", "<-", "--"]);
  });

  it("offers the title snippet at the start of a line", () => {
    expect(labels("tit|")).toContain('title "…"');
  });

  it("does not offer the title snippet as a target", () => {
    expect(labels("user -> tit|")).not.toContain('title "…"');
  });

  it("offers only shapes after a colon", () => {
    const result = completionsAt(ask("sessions:re|")).suggestions;
    expect(result.every((s) => s.kind === "shape")).toBe(true);
  });

  it("reports the replace range so the popup overwrites the right text", () => {
    expect(completionsAt(ask("user -> au|")).from).toBe(8);
  });
});

/** The obstructive cases — the ones that make autocomplete hated. */
describe("suppression", () => {
  it("suggests nothing inside a label", () => {
    expect(labels('api -"enter cred|')).toEqual([]);
  });

  it("suggests nothing inside a comment", () => {
    expect(labels("user -> api // conn|")).toEqual([]);
  });

  it("suggests nothing after the title keyword", () => {
    expect(labels("title |")).toEqual([]);
  });
});

describe("the self-suggestion trap", () => {
  /**
   * The graph is built from source that includes the half-typed line, so the
   * word being typed exists as a node. Without the line check it would be
   * offered as a completion of itself.
   */
  it("does not suggest the node declared on the line being typed", () => {
    const halfTyped = buildIR(parse("auth"), registryResolver);
    const result = completionsAt({
      line: "auth",
      column: 4,
      graph: halfTyped,
      lineIndex: 0,
    });
    expect(result.suggestions.map((s) => s.label)).not.toContain("auth");
  });

  it("still suggests a node first declared on a different line", () => {
    expect(labels("au|", 4)).toContain("auth-api");
  });
});

describe("determinism", () => {
  it("returns an identical list for an identical request", () => {
    expect(completionsAt(ask("user -> a|"))).toEqual(
      completionsAt(ask("user -> a|")),
    );
  });

  it("orders by rank, then match quality, then alphabetically", () => {
    const suggestions = completionsAt(ask("user -> s|")).suggestions;
    const kinds = suggestions.map((s) => s.kind);

    // Rank: document nodes before registry words.
    expect(kinds.indexOf("node")).toBeLessThan(kinds.indexOf("shape"));

    const shapes = suggestions.filter((s) => s.kind === "shape").map((s) => s.label);
    const split = shapes.findIndex((l) => !l.toLowerCase().startsWith("s"));

    const startsWith = split < 0 ? shapes : shapes.slice(0, split);
    const contains = split < 0 ? [] : shapes.slice(split);

    // Match quality: everything starting with "s" precedes everything merely
    // containing it, and each group is sorted so nothing reshuffles.
    expect([...startsWith].sort()).toEqual(startsWith);
    expect([...contains].sort()).toEqual(contains);
    expect(contains.every((l) => !l.toLowerCase().startsWith("s"))).toBe(true);
    expect(contains.every((l) => l.toLowerCase().includes("s"))).toBe(true);
  });

  it("handles an empty document", () => {
    const empty = buildIR(parse(""), registryResolver);
    const result = completionsAt({ line: "da", column: 2, graph: empty, lineIndex: 0 });
    expect(result.suggestions.map((s) => s.label)).toContain("database");
  });
});

/**
 * Ghost text must only ever *extend* what was typed. A ghost that would rewrite
 * your own characters makes Tab unpredictable.
 */
describe("ghostFor", () => {
  it("completes the rest of the top suggestion", () => {
    expect(ghostFor(ask("user -> auth|"))).toMatchObject({ insert: "-api" });
  });

  it("anchors the ghost at the cursor", () => {
    expect(ghostFor(ask("user -> auth|"))?.from).toBe(12);
  });

  it("shows nothing when nothing has been typed", () => {
    expect(ghostFor(ask("user -> |"))).toBeNull();
  });

  it("shows nothing when the word is already complete", () => {
    expect(ghostFor(ask("user -> auth-api|"))).toBeNull();
  });

  it("shows nothing where suggestions are suppressed", () => {
    expect(ghostFor(ask('api -"enter cred|'))).toBeNull();
  });

  it("never ghosts a connector, since nothing typed implies which one", () => {
    expect(ghostFor(ask("user |"))).toBeNull();
  });

  it("never ghosts a snippet that would move the cursor", () => {
    // `title "…"` carries a cursorOffset, so it must not be offered inline.
    expect(ghostFor(ask("titl|"))).toBeNull();
  });

  it("only ever extends — the ghost is always a pure suffix", () => {
    for (const spec of ["user -> au|", "us|", "sessions:red|", "user -> log|"]) {
      const request = ask(spec);
      const ghost = ghostFor(request);
      if (!ghost) continue;

      const { from, suggestions } = completionsAt(request);
      const typed = request.line.slice(from, request.column);
      expect(suggestions[0]!.insert, spec).toBe(typed + ghost.insert);
    }
  });
});
