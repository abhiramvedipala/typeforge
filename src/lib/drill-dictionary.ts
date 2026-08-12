// The dictionary-backed half of drill word generation, split out of words.ts
// so it can be code-split and fetched on demand — see the lazy import in
// words.ts. `an-array-of-english-words` alone is ~760KB gzipped; nothing in
// this file should be imported statically from a route that loads on every
// visit (the practice page and the lessons pages both need it, but only once
// the learner actually reaches a drill/word phase).

import ENGLISH_WORDS from "an-array-of-english-words";
import type { Rng } from "./words";

const VOWELS = new Set(["a", "e", "i", "o", "u", "y"]);

// Precompute a pool of common-ish English words, lowercased, length 2-8.
// This gives ~90k real words to filter against — enough that most drill
// letter sets (even small ones) yield a healthy pool of pronounceable words.
const DRILL_DICT: readonly string[] = (() => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of ENGLISH_WORDS as readonly string[]) {
    if (w.length < 2 || w.length > 8) continue;
    if (!/^[a-z]+$/.test(w)) continue;
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
  }
  return out;
})();

// Build a pronounceable pseudo-word using only the given letters.
// Alternates vowels and consonants where possible; falls back to short
// rhythmic chunks for consonant-only sets.
function pseudoWord(letters: string[], rng: Rng = Math.random): string {
  if (letters.length === 0) return "";
  const vowels = letters.filter((l) => VOWELS.has(l));
  const consonants = letters.filter((l) => !VOWELS.has(l));

  // No vowels at all — emit short 2-4 letter consonant burst, no repeats 3x.
  if (vowels.length === 0) {
    const len = 2 + Math.floor(rng() * 3); // 2-4
    let out = "";
    let last = "";
    let run = 0;
    for (let i = 0; i < len; i++) {
      let ch = consonants[Math.floor(rng() * consonants.length)];
      let guard = 0;
      while (consonants.length > 1 && ch === last && run >= 1 && guard++ < 6) {
        ch = consonants[Math.floor(rng() * consonants.length)];
      }
      run = ch === last ? run + 1 : 0;
      last = ch;
      out += ch;
    }
    return out;
  }

  // No consonants — just vowels; short chunk.
  if (consonants.length === 0) {
    const len = 2 + Math.floor(rng() * 3);
    let out = "";
    for (let i = 0; i < len; i++) {
      out += vowels[Math.floor(rng() * vowels.length)];
    }
    return out;
  }

  // Mixed: alternate C/V with occasional doubles. Length 3-6.
  const len = 3 + Math.floor(rng() * 4);
  const startWithVowel = rng() < 0.35;
  let out = "";
  let wantVowel = startWithVowel;
  let last = "";
  let consonantRun = 0;
  for (let i = 0; i < len; i++) {
    const pool = wantVowel ? vowels : consonants;
    let ch = pool[Math.floor(rng() * pool.length)];
    // Avoid same char twice in a row (single doubles like "ll" happen only ~15%).
    let guard = 0;
    while (pool.length > 1 && ch === last && rng() > 0.15 && guard++ < 4) {
      ch = pool[Math.floor(rng() * pool.length)];
    }
    // Never 3+ consonants in a row.
    if (!wantVowel) {
      consonantRun++;
      if (consonantRun >= 2 && vowels.length > 0) {
        wantVowel = true;
        ch = vowels[Math.floor(rng() * vowels.length)];
        consonantRun = 0;
      }
    } else {
      consonantRun = 0;
    }
    out += ch;
    last = ch;
    // Alternate most of the time, occasionally repeat class.
    wantVowel = rng() < 0.8 ? !wantVowel : wantVowel;
  }
  return out;
}

export { pseudoWord };

// Generate words composed ONLY of the chosen drill letters. Synchronous —
// the async boundary lives in words.ts's drillWords(), which lazily imports
// this module once and calls straight through to this on every subsequent
// call. `normalized` is expected already lowercased, deduped and non-empty
// (words.ts handles the empty-set case itself, without needing this module).
// Prefers real English words that fit the set (aiming for ~70% real when
// possible); pads with pronounceable pseudo-words for variety and coverage.
export function drillWordsSync(
  normalized: string[],
  count: number,
  rng: Rng = Math.random,
): string[] {
  const set = new Set(normalized);

  const realPool = DRILL_DICT.filter((w) => {
    for (let i = 0; i < w.length; i++) if (!set.has(w[i])) return false;
    return true;
  });

  const out: string[] = [];
  const REAL_MIN = 10;
  if (realPool.length >= REAL_MIN) {
    // ~70% real words, ~30% pseudo-word fillers.
    for (let i = 0; i < count; i++) {
      const usePseudo = rng() < 0.3;
      out.push(
        usePseudo ? pseudoWord(normalized, rng) : realPool[Math.floor(rng() * realPool.length)],
      );
    }
    return out;
  }

  // Tiny real-word pool — use everything we have, then pad with pseudo-words.
  const shuffled = [...new Set(realPool)].sort(() => rng() - 0.5);
  for (const w of shuffled) {
    if (out.length >= count) break;
    out.push(w);
  }
  while (out.length < count) {
    out.push(pseudoWord(normalized, rng));
  }
  return out;
}
