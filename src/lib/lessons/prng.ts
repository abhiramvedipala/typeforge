// Tiny deterministic PRNG so a lesson always renders the same text.
// A retry must be comparable to the first attempt, which rules out Math.random.

/** Hash an arbitrary string into a 32-bit seed (FNV-1a). */
export function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — returns a function producing floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Convenience: seeded RNG from any string key. */
export function rngFromKey(key: string): () => number {
  return mulberry32(seedFromString(key));
}

/** Pick one element using the supplied RNG. */
export function pick<T>(items: readonly T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)];
}

/** Integer in [min, max] inclusive. */
export function randInt(min: number, max: number, rng: () => number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Fisher-Yates on a copy, using the supplied RNG. */
export function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
