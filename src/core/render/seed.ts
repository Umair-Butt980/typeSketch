/**
 * Rough.js output is randomised. Left to itself it re-randomises on every call,
 * so a box redrawn on each React render jitters differently every frame and the
 * whole diagram visibly crawls while you type.
 *
 * The fix is to make the wobble a pure function of identity: same node, same
 * seed, same strokes — forever, across reloads, and across client and server.
 * That last property is what makes `/api/render` produce output identical to
 * the canvas.
 *
 * FNV-1a: tiny, fast, no dependencies, and well spread for short ASCII keys.
 */
export function seedFor(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Rough.js expects a positive integer; 0 would read as "no seed given".
  return ((hash >>> 0) % 2147483646) + 1;
}

/**
 * A shape is several primitives, and they must not all wobble identically or
 * the result looks stamped rather than drawn. Offsetting by index keeps each
 * primitive distinct while staying a pure function of the node's identity.
 */
export function seedForPart(key: string, index: number): number {
  return seedFor(`${key}#${index}`);
}
