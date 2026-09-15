// Stages 3 and 4: hard validation and top-up.
//
// Nothing the model returns is trusted. Illegal words are DISCARDED, never
// "fixed" — a repaired word is a word the user didn't ask to practise.

import { consonantsIn, legalRegex, vowelsIn } from "./charset";
import { dictionaryWords } from "./dictionary";

export type Rng = () => number;

/** Drop every word containing a character outside the charset, and dedupe. */
export function filterLegal(words: readonly unknown[], charset: string): string[] {
  const re = legalRegex(charset);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of words) {
    if (typeof raw !== "string") continue;
    const w = raw.trim().toLowerCase();
    if (!w || w.length > 12) continue;
    if (!re.test(w)) continue;
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
  }
  return out;
}

/**
 * Build one pronounceable pseudo-word from the charset. Alternates
 * consonant/vowel where the charset allows, never repeats a character 3+ times,
 * never runs 4+ consonants, and degrades safely for degenerate charsets
 * (single character, vowel-only, digits/symbols only).
 */
export function synthesize(
  charset: string,
  minLen: number,
  maxLen: number,
  rng: Rng = Math.random,
  weight: readonly string[] = [],
): string {
  const chars = charset.split("");
  if (chars.length === 0) return "";
  const lo = Math.max(1, Math.min(minLen, maxLen));
  const hi = Math.max(lo, maxLen);
  const len = lo + Math.floor(rng() * (hi - lo + 1));

  const vowels = vowelsIn(charset);
  const consonants = consonantsIn(charset);
  const weighted = weight.filter((c) => chars.includes(c));

  const pickFrom = (pool: readonly string[]): string => {
    // Bias toward weak keys when they are available in the pool.
    const hot = weighted.filter((c) => pool.includes(c));
    if (hot.length > 0 && rng() < 0.5) return hot[Math.floor(rng() * hot.length)];
    return pool[Math.floor(rng() * pool.length)];
  };

  let out = "";
  let last = "";
  let repeat = 0;
  let consonantRun = 0;
  let wantVowel = vowels.length > 0 && rng() < 0.4;

  for (let i = 0; i < len; i++) {
    let pool: readonly string[];
    if (vowels.length === 0 || consonants.length === 0) {
      pool = chars;
    } else if (wantVowel || consonantRun >= 2) {
      pool = vowels;
    } else {
      pool = consonants;
    }

    let ch = pickFrom(pool);
    let guard = 0;
    while (pool.length > 1 && ch === last && repeat >= 1 && guard++ < 6) {
      ch = pickFrom(pool);
    }

    repeat = ch === last ? repeat + 1 : 0;
    last = ch;
    out += ch;

    const isVowel = vowels.includes(ch);
    consonantRun = isVowel ? 0 : consonantRun + 1;
    wantVowel = vowels.length > 0 && (consonantRun >= 2 || rng() < 0.55);
  }

  return out;
}

export interface TopUpOptions {
  charset: string;
  count: number;
  minLength: number;
  maxLength: number;
  rng?: Rng;
  weakKeys?: readonly string[];
}

/**
 * Pad a word list up to `count`, preferring real dictionary words and falling
 * back to synthesized pseudo-words. Always returns exactly `count` legal words
 * (or an empty list when the charset itself is empty) and never loops forever.
 */
export function topUp(words: readonly string[], opts: TopUpOptions): string[] {
  const { charset, count, minLength, maxLength, rng = Math.random, weakKeys = [] } = opts;
  if (!charset || count <= 0) return [];

  const out = filterLegal(words, charset).slice(0, count);
  if (out.length >= count) return out;

  const pool = dictionaryWords(charset, { minLength, maxLength }).filter((w) => !out.includes(w));
  while (out.length < count && pool.length > 0) {
    const i = Math.floor(rng() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }

  // Bounded synthesis: attempt limit guarantees termination even for a charset
  // like "a" where distinct words run out almost immediately.
  let attempts = 0;
  const attemptCap = count * 40;
  while (out.length < count && attempts++ < attemptCap) {
    const w = synthesize(charset, minLength, maxLength, rng, weakKeys);
    if (w && !out.includes(w)) out.push(w);
  }
  // Degenerate charsets (e.g. "a") legitimately have few distinct words —
  // repeat what we have rather than returning a short drill.
  let i = 0;
  while (out.length < count) {
    const src = out.length > 0 ? out : [synthesize(charset, minLength, maxLength, rng)];
    out.push(src[i % src.length]);
    i++;
  }
  return out.slice(0, count);
}
