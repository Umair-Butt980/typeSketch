import { describe, expect, it } from "vitest";
import { parse } from "./parser";

describe("parse — statements", () => {
  it("reads a bare node declaration", () => {
    const { statements, diagnostics } = parse("user");
    expect(diagnostics).toEqual([]);
    expect(statements).toHaveLength(1);
    expect(statements[0]).toMatchObject({
      kind: "chain",
      head: { name: "user" },
      links: [],
      line: 0,
    });
  });

  it("reads a title", () => {
    const { statements } = parse('title "Authentication Service"');
    expect(statements[0]).toMatchObject({
      kind: "title",
      text: "Authentication Service",
    });
  });

  it("reads each arrow form", () => {
    const source = ["a -> b", "a <- b", "a <> b", "a -- b"].join("\n");
    const { statements, diagnostics } = parse(source);
    expect(diagnostics).toEqual([]);
    expect(
      statements.map((s) => (s.kind === "chain" ? s.links[0]?.arrow : null)),
    ).toEqual(["->", "<-", "<>", "--"]);
  });

  it("reads an edge label", () => {
    const { statements } = parse('api -"publishes"-> queue');
    expect(statements[0]).toMatchObject({
      kind: "chain",
      head: { name: "api" },
      links: [{ arrow: "->", label: "publishes", target: { name: "queue" } }],
    });
  });

  it("reads an explicit archetype override", () => {
    const { statements } = parse("cache:redis");
    expect(statements[0]).toMatchObject({
      kind: "chain",
      head: { name: "cache", archetype: "redis" },
    });
  });

  it("reads a chain of three", () => {
    const { statements } = parse("user -> api -> database");
    const statement = statements[0];
    expect(statement?.kind).toBe("chain");
    if (statement?.kind !== "chain") return;
    expect(statement.head.name).toBe("user");
    expect(statement.links.map((l) => l.target.name)).toEqual([
      "api",
      "database",
    ]);
  });

  it("reads a self-loop", () => {
    const { statements, diagnostics } = parse('api -"verify"-> api');
    expect(diagnostics).toEqual([]);
    expect(statements[0]).toMatchObject({
      kind: "chain",
      head: { name: "api" },
      links: [{ target: { name: "api" } }],
    });
  });
});

describe("parse — lexing edge cases", () => {
  it("does not swallow the arrow into a dashed identifier", () => {
    const { statements, diagnostics } = parse("login-page->auth-api");
    expect(diagnostics).toEqual([]);
    expect(statements[0]).toMatchObject({
      head: { name: "login-page" },
      links: [{ arrow: "->", target: { name: "auth-api" } }],
    });
  });

  it("distinguishes an undirected connector from a dashed identifier", () => {
    const { statements } = parse("a-b--c-d");
    expect(statements[0]).toMatchObject({
      head: { name: "a-b" },
      links: [{ arrow: "--", target: { name: "c-d" } }],
    });
  });

  it("treats `title` as an identifier when it is part of a longer word", () => {
    const { statements } = parse("titlebar -> screen");
    expect(statements[0]).toMatchObject({ head: { name: "titlebar" } });
  });

  it("ignores comments and blank lines", () => {
    const { statements, diagnostics } = parse(
      ["// the front door", "", "user -> api // inline", ""].join("\n"),
    );
    expect(diagnostics).toEqual([]);
    expect(statements).toHaveLength(1);
  });

  it("records column ranges for editor linking", () => {
    const { statements } = parse("user -> api");
    const statement = statements[0];
    if (statement?.kind !== "chain") throw new Error("expected a chain");
    expect(statement.head).toMatchObject({ from: 0, to: 4 });
    expect(statement.links[0]?.target).toMatchObject({ from: 8, to: 11 });
  });
});

describe("parse — error tolerance", () => {
  it("does not throw on a half-typed arrow", () => {
    expect(() => parse("user -> ")).not.toThrow();
  });

  it("reports a diagnostic instead of failing", () => {
    const { statements, diagnostics } = parse("user -> ");
    expect(statements).toEqual([]);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ severity: "error", line: 0 });
    expect(diagnostics[0]?.message).toMatch(/incomplete/i);
  });

  it("keeps every other line rendering when one line is broken", () => {
    const source = ["user -> api", "api -> ", "api <> database"].join("\n");
    const { statements, diagnostics } = parse(source);

    expect(statements).toHaveLength(2);
    expect(statements.map((s) => s.line)).toEqual([0, 2]);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.line).toBe(1);
  });

  it("reports an unrecognised character without losing the document", () => {
    const { statements, diagnostics } = parse(["user -> api", "%%%"].join("\n"));
    expect(statements).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ line: 1, severity: "error" });
  });

  it("recovers on the next keystroke", () => {
    expect(parse("user -> ").statements).toEqual([]);
    expect(parse("user -> d").statements).toHaveLength(1);
  });
});
