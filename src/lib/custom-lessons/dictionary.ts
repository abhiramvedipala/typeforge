// Stage 1 of generation: the dictionary filter. Free, instant, provably correct.

import ENGLISH_WORDS from "an-array-of-english-words";
import { legalRegex } from "./charset";

const WORDS: readonly string[] = (() => {
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

export function allWords(): readonly string[] {
  return WORDS;
}

export interface FilterOptions {
  minLength?: number;
  maxLength?: number;
}

/** Every dictionary word spellable with only the charset, within length bounds. */
export function dictionaryWords(charset: string, opts: FilterOptions = {}): string[] {
  if (!charset) return [];
  const { minLength = 2, maxLength = 8 } = opts;
  const re = legalRegex(charset);
  const out: string[] = [];
  for (const w of WORDS) {
    if (w.length < minLength || w.length > maxLength) continue;
    if (re.test(w)) out.push(w);
  }
  return out;
}
