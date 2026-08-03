"use client";

import { CircleQuestionMark } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ARCHETYPES, paletteNames } from "@/core/registry";

function Row({ code, children }: { code: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-baseline gap-3 py-1.5">
      <code className="bg-muted rounded px-1.5 py-1 font-mono text-[12px] break-words">
        {code}
      </code>
      <span className="text-muted-foreground text-[13px]">{children}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t py-4 first:border-t-0">
      <h3 className="mb-1 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

/**
 * The syntax reference, in the app.
 *
 * TypeSketch's whole premise is that typing beats dragging — which only holds
 * if the vocabulary is discoverable. Until the editor gains autocomplete in P2,
 * this is how someone finds out that `<>` exists.
 */
export function HelpSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <CircleQuestionMark className="size-4" />
          Help
        </Button>
      </SheetTrigger>

      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>How to use TypeSketch</SheetTitle>
          <SheetDescription>
            Type on the left, the diagram draws itself on the right. One
            statement per line — order does not matter.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-10">
          <Section title="Connections">
            <Row code="user -> api">Arrow from user to api</Row>
            <Row code="api <- worker">Reversed — same as worker -&gt; api</Row>
            <Row code="api <> database">Both ways: one line, two arrowheads</Row>
            <Row code="api -- cdn">A link with no direction</Row>
            <Row code="user -> api -> db">Chain — makes two connections</Row>
          </Section>

          <Section title="Labels">
            <Row code={`api -"publishes"-> queue`}>Label sits on the arrow</Row>
            <Row code={`api -"retry"-> api`}>
              Pointing at itself draws a loop
            </Row>
            <Row code={`title "Auth Service"`}>Heading above the diagram</Row>
          </Section>

          <Section title="Choosing shapes">
            <p className="text-muted-foreground mb-2 text-[13px]">
              The shape comes from the name. Compound names use their last word,
              so <code className="font-mono">user-db</code> is a cylinder and{" "}
              <code className="font-mono">auth-api</code> is a service.
            </p>
            <Row code="sessions:redis">Force a shape with a colon</Row>
            <Row code="anything-unknown">
              Unrecognised words become a plain box — never an error
            </Row>
          </Section>

          <Section title="Colour">
            <p className="text-muted-foreground mb-3 text-[13px]">
              Shape says what a thing is. Colour says which group it belongs to —
              useful when two services need telling apart. Add{" "}
              <code className="font-mono">#colour</code> wherever you mention a
              node.
            </p>
            <Row code="auth-api #blue">Tint a node</Row>
            <Row code="user -> billing-api #amber">Works on either end</Row>
            <Row code="billing-api #red">
              Written later, this recolours — the last one wins
            </Row>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {paletteNames().map((name) => (
                <span
                  key={name}
                  className="flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px]"
                  style={{
                    background: `var(--tint-${name}-fill)`,
                    borderColor: `var(--tint-${name}-stroke)`,
                  }}
                >
                  #{name}
                </span>
              ))}
            </div>
          </Section>

          <Section title="Notes">
            <Row code="// a comment">Ignored, as are blank lines</Row>
          </Section>

          <Section title="What you can do on the canvas">
            <p className="text-muted-foreground text-[13px]">
              Drag nodes to reposition them, and pan and zoom freely. You cannot
              drag a new connection into being — that is what typing is for, and
              it is the point of the tool. The text owns <em>what exists</em>;
              the canvas owns <em>where it sits</em>.
            </p>
          </Section>

          <Section title={`All ${ARCHETYPES.length} shapes`}>
            <div className="space-y-1.5">
              {ARCHETYPES.map((archetype) => (
                <div key={archetype.name} className="text-[12px] leading-snug">
                  <span className="font-mono font-medium">{archetype.name}</span>
                  <span className="text-muted-foreground">
                    {" — "}
                    {archetype.aliases.slice(0, 6).join(", ")}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
