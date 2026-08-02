import { describe, expect, it } from "vitest";
import { ARCHETYPES } from "./archetypes";
import { archetypeByName, registryResolver, vocabulary } from "./resolver";
import { FALLBACK_ARCHETYPE } from "./types";

const resolve = (label: string) => registryResolver.resolve(label)?.name ?? null;

describe("the alias table", () => {
  /**
   * A word resolving to two archetypes would make the drawn shape depend on
   * iteration order — exactly the non-determinism the registry-only design
   * exists to avoid.
   */
  it("maps every alias to exactly one archetype", () => {
    const seen = new Map<string, string>();
    for (const archetype of ARCHETYPES) {
      for (const alias of archetype.aliases) {
        const owner = seen.get(alias);
        expect(owner, `\`${alias}\` is claimed by both ${owner} and ${archetype.name}`).toBeUndefined();
        seen.set(alias, archetype.name);
      }
    }
  });

  it("does not let an alias collide with a different archetype's name", () => {
    const names = new Map(ARCHETYPES.map((a) => [a.name, a]));
    for (const archetype of ARCHETYPES) {
      for (const alias of archetype.aliases) {
        const clash = names.get(alias);
        if (clash && clash !== archetype) {
          throw new Error(`\`${alias}\` aliases ${archetype.name} but names ${clash.name}`);
        }
      }
    }
  });

  it("gives every archetype a non-empty alias list and a positive size", () => {
    for (const archetype of ARCHETYPES) {
      expect(archetype.aliases.length, archetype.name).toBeGreaterThan(0);
      expect(archetype.defaultSize.w, archetype.name).toBeGreaterThan(0);
      expect(archetype.defaultSize.h, archetype.name).toBeGreaterThan(0);
    }
  });

  it("includes a fallback archetype", () => {
    expect(ARCHETYPES.some((a) => a.name === FALLBACK_ARCHETYPE)).toBe(true);
  });
});

describe("registryResolver", () => {
  it("resolves an exact alias", () => {
    expect(resolve("user")).toBe("actor");
    expect(resolve("postgres")).toBe("database");
    expect(resolve("kafka")).toBe("queue");
    expect(resolve("lambda")).toBe("function");
  });

  it("resolves an archetype by its own name", () => {
    expect(resolve("balancer")).toBe("balancer");
  });

  it("is case- and whitespace-insensitive", () => {
    expect(resolve("  PostgreSQL ")).toBe("database");
  });

  it("falls back to the trailing segment of a compound name", () => {
    expect(resolve("user-db")).toBe("database");
    expect(resolve("auth-api")).toBe("service");
    expect(resolve("session-store")).toBe("storage");
    expect(resolve("login-page")).toBe("browser");
  });

  it("falls back to the leading segment when the trailing one is unknown", () => {
    expect(resolve("api-thingamajig")).toBe("service");
  });

  it("prefers an exact match over segment matching", () => {
    // `load-balancer` is a literal alias; it must not resolve via `balancer`
    // by accident, and must not resolve via `load`.
    expect(resolve("load-balancer")).toBe("balancer");
  });

  it("returns null for genuinely unknown words", () => {
    expect(resolve("flibbertigibbet")).toBeNull();
    expect(resolve("")).toBeNull();
  });

  it("handles underscores as segment separators", () => {
    expect(resolve("user_db")).toBe("database");
  });
});

describe("archetypeByName", () => {
  it("returns the named archetype", () => {
    expect(archetypeByName("database").name).toBe("database");
  });

  it("resolves aliases too, so IR written by hand still renders", () => {
    expect(archetypeByName("redis").name).toBe("cache");
  });

  it("never throws for an unknown name", () => {
    expect(archetypeByName("nonsense").name).toBe(FALLBACK_ARCHETYPE);
  });
});

describe("vocabulary", () => {
  it("lists every alias and name, sorted, for autocomplete", () => {
    const words = vocabulary();
    expect(words).toContain("postgres");
    expect(words).toContain("balancer");
    expect([...words].sort()).toEqual(words);
  });
});
