import { describe, expect, it } from "vitest";
import { contextAt } from "./context";

/** `at("user -> ap|i")` — the pipe marks the cursor. */
function at(spec: string) {
  const column = spec.indexOf("|");
  if (column < 0) throw new Error("mark the cursor with |");
  return contextAt(spec.replace("|", ""), column);
}

describe("contextAt", () => {
  it("is statement start on an empty line", () => {
    expect(at("|")).toMatchObject({ kind: "statementStart", prefix: "" });
  });

  it("is statement start while typing the first word", () => {
    expect(at("us|")).toMatchObject({ kind: "statementStart", prefix: "us", from: 0 });
  });

  it("is statement start after leading whitespace", () => {
    expect(at("   us|")).toMatchObject({ kind: "statementStart", prefix: "us", from: 3 });
  });

  it("wants a connector after a complete node name", () => {
    expect(at("user |")).toMatchObject({ kind: "connector", afterLabel: false });
  });

  it("wants a connector immediately after a node name with no space", () => {
    // `user|` is still the word being typed, not a finished one.
    expect(at("user|")).toMatchObject({ kind: "statementStart", prefix: "user" });
  });

  it("is a target after an arrow", () => {
    expect(at("user -> |")).toMatchObject({ kind: "target", prefix: "" });
    expect(at("user -> ap|")).toMatchObject({ kind: "target", prefix: "ap", from: 8 });
  });

  it("is a target after every connector form", () => {
    for (const arrow of ["->", "<-", "<>", "--"]) {
      expect(at(`a ${arrow} b|`), arrow).toMatchObject({ kind: "target", prefix: "b" });
    }
  });

  it("is an archetype after a colon", () => {
    expect(at("sessions:|")).toMatchObject({ kind: "archetype", prefix: "" });
    expect(at("sessions:re|")).toMatchObject({ kind: "archetype", prefix: "re", from: 9 });
  });

  it("wants an arrow after a closed label, and knows one is already written", () => {
    expect(at('api -"publishes"|')).toMatchObject({
      kind: "connector",
      afterLabel: true,
    });
  });

  it("is a target after a labelled connector", () => {
    expect(at('api -"publishes"-> qu|')).toMatchObject({
      kind: "target",
      prefix: "qu",
    });
  });

  it("continues to work on the second statement of a chain", () => {
    expect(at("user -> api -> da|")).toMatchObject({ kind: "target", prefix: "da" });
  });
});

describe("colour", () => {
  it("offers the palette the moment # is typed", () => {
    expect(at("api #|")).toMatchObject({ kind: "color", prefix: "" });
  });

  it("narrows as the colour is typed", () => {
    expect(at("api #bl|")).toMatchObject({ kind: "color", prefix: "bl" });
  });

  it("excludes the # from the range being replaced", () => {
    const context = at("api #bl|");
    if (context.kind !== "color") throw new Error("expected a colour context");
    expect(context.from).toBe(5);
  });

  it("works on a target as well as a source", () => {
    expect(at("user -> api #gr|")).toMatchObject({ kind: "color", prefix: "gr" });
  });

  it("works after an archetype override", () => {
    expect(at("sessions:redis #am|")).toMatchObject({ kind: "color", prefix: "am" });
  });

  it("wants a connector once the colour is finished", () => {
    expect(at("api #blue |")).toMatchObject({ kind: "connector" });
  });

  it("does not mistake a # inside a label for a colour", () => {
    expect(at('a -"POST #1|')).toEqual({ kind: "suppressed" });
  });
});

/**
 * The obstructive cases. Offering shape names while someone writes prose is
 * worse than offering nothing, so these are the tests that matter most.
 */
describe("suppression", () => {
  it("suggests nothing inside an unterminated label", () => {
    expect(at('api -"enter cred|')).toEqual({ kind: "suppressed" });
  });

  it("suggests nothing at the very start of a label", () => {
    expect(at('api -"|')).toEqual({ kind: "suppressed" });
  });

  it("suggests nothing inside a comment", () => {
    expect(at("// a no|")).toEqual({ kind: "suppressed" });
    expect(at("user -> api // no|")).toEqual({ kind: "suppressed" });
  });

  it("suggests nothing after a bare dash, which wants a label", () => {
    expect(at("api -|")).toEqual({ kind: "suppressed" });
  });

  it("suggests nothing after the title keyword, which wants a string", () => {
    expect(at("title |")).toEqual({ kind: "suppressed" });
  });

  it("resumes once the label is closed", () => {
    expect(at('api -"done"|').kind).toBe("connector");
  });
});

describe("edge cases", () => {
  it("clamps a column past the end of the line", () => {
    expect(contextAt("user", 999)).toMatchObject({
      kind: "statementStart",
      prefix: "user",
    });
  });

  it("handles a negative column", () => {
    expect(contextAt("user", -5)).toMatchObject({ kind: "statementStart" });
  });

  it("does not treat a dashed identifier as a connector position", () => {
    expect(at("login-pa|")).toMatchObject({
      kind: "statementStart",
      prefix: "login-pa",
      from: 0,
    });
  });
});
