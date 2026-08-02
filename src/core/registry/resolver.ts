import { ARCHETYPES, FALLBACK } from "./archetypes";
import type { Archetype, ShapeResolver } from "./types";

/** Lookup key for a label or alias: identity is case- and whitespace-insensitive. */
export function normalize(label: string): string {
  return label.trim().toLowerCase();
}

const BY_KEY = new Map<string, Archetype>();
for (const archetype of ARCHETYPES) {
  BY_KEY.set(archetype.name, archetype);
  for (const alias of archetype.aliases) BY_KEY.set(alias, archetype);
}

/**
 * Deterministic, offline, sub-millisecond resolution.
 *
 * Exact match first. Failing that, compound names fall back to their trailing
 * then leading segment, which is what makes real-world naming work without a
 * combinatorial alias table: `user-db` finds `db`, `auth-api` finds `api`,
 * `session-store` finds `store`. Trailing wins because English compounds are
 * head-final — the last word is the noun.
 *
 * Unknown words return `null` and the caller falls back to a labelled box.
 * Never an error, never a block.
 */
export const registryResolver: ShapeResolver = {
  resolve(label: string): Archetype | null {
    const key = normalize(label);
    if (key === "") return null;

    const exact = BY_KEY.get(key);
    if (exact) return exact;

    const segments = key.split(/[-_]+/).filter(Boolean);
    if (segments.length > 1) {
      const trailing = BY_KEY.get(segments[segments.length - 1]!);
      if (trailing) return trailing;

      const leading = BY_KEY.get(segments[0]!);
      if (leading) return leading;
    }

    return null;
  },
};

/** Look up a resolved archetype by name, for the render path. */
export function archetypeByName(name: string): Archetype {
  return BY_KEY.get(normalize(name)) ?? FALLBACK;
}

/** Every alias and archetype name, for editor autocomplete in P2. */
export function vocabulary(): string[] {
  return [...BY_KEY.keys()].sort();
}
