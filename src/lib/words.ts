// Common English words for word/time modes
export const COMMON_WORDS = [
  "the","be","to","of","and","a","in","that","have","I","it","for","not","on","with","he","as","you","do","at",
  "this","but","his","by","from","they","we","say","her","she","or","an","will","my","one","all","would","there",
  "their","what","so","up","out","if","about","who","get","which","go","me","when","make","can","like","time","no",
  "just","him","know","take","people","into","year","your","good","some","could","them","see","other","than",
  "then","now","look","only","come","its","over","think","also","back","after","use","two","how","our","work",
  "first","well","way","even","new","want","because","any","these","give","day","most","us","is","are","was",
  "were","been","has","had","said","made","find","place","where","much","through","before","right","while",
  "great","little","still","should","such","under","never","same","another","again","off","without","being",
  "those","might","each","might","between","both","life","world","hand","part","child","eye","woman","man",
  "thing","name","story","number","point","home","water","room","mother","area","money","fact","month","lot",
  "book","line","car","city","family","night","head","side","door","health","problem","year","game","question",
  "school","state","group","country","system","program","week","company","power","minute","kind","study","since",
  "must","try","need","feel","leave","call","keep","let","begin","seem","help","talk","turn","start","show",
];

export const QUOTES = [
  "The only way to do great work is to love what you do. If you haven't found it yet, keep looking. Don't settle.",
  "Be yourself; everyone else is already taken. The world is a book and those who do not travel read only one page.",
  "In three words I can sum up everything I've learned about life: it goes on. Live as if you were to die tomorrow.",
  "The future belongs to those who believe in the beauty of their dreams. Do not go where the path may lead.",
  "Success is not final, failure is not fatal: it is the courage to continue that counts. Stay hungry, stay foolish.",
  "Two roads diverged in a wood, and I took the one less traveled by, and that has made all the difference.",
  "The greatest glory in living lies not in never falling, but in rising every time we fall. Hope is the thing with feathers.",
];

export function randomWords(count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(COMMON_WORDS[Math.floor(Math.random() * COMMON_WORDS.length)]);
  }
  return out;
}

export function randomQuote(): string {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

import ENGLISH_WORDS from "an-array-of-english-words";

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
function pseudoWord(letters: string[]): string {
  if (letters.length === 0) return "";
  const vowels = letters.filter((l) => VOWELS.has(l));
  const consonants = letters.filter((l) => !VOWELS.has(l));

  // No vowels at all — emit short 2-4 letter consonant burst, no repeats 3x.
  if (vowels.length === 0) {
    const len = 2 + Math.floor(Math.random() * 3); // 2-4
    let out = "";
    let last = "";
    let run = 0;
    for (let i = 0; i < len; i++) {
      let ch = consonants[Math.floor(Math.random() * consonants.length)];
      let guard = 0;
      while (consonants.length > 1 && ch === last && run >= 1 && guard++ < 6) {
        ch = consonants[Math.floor(Math.random() * consonants.length)];
      }
      run = ch === last ? run + 1 : 0;
      last = ch;
      out += ch;
    }
    return out;
  }

  // No consonants — just vowels; short chunk.
  if (consonants.length === 0) {
    const len = 2 + Math.floor(Math.random() * 3);
    let out = "";
    for (let i = 0; i < len; i++) {
      out += vowels[Math.floor(Math.random() * vowels.length)];
    }
    return out;
  }

  // Mixed: alternate C/V with occasional doubles. Length 3-6.
  const len = 3 + Math.floor(Math.random() * 4);
  const startWithVowel = Math.random() < 0.35;
  let out = "";
  let wantVowel = startWithVowel;
  let last = "";
  let consonantRun = 0;
  for (let i = 0; i < len; i++) {
    const pool = wantVowel ? vowels : consonants;
    let ch = pool[Math.floor(Math.random() * pool.length)];
    // Avoid same char twice in a row (single doubles like "ll" happen only ~15%).
    let guard = 0;
    while (pool.length > 1 && ch === last && Math.random() > 0.15 && guard++ < 4) {
      ch = pool[Math.floor(Math.random() * pool.length)];
    }
    // Never 3+ consonants in a row.
    if (!wantVowel) {
      consonantRun++;
      if (consonantRun >= 2 && vowels.length > 0) {
        wantVowel = true;
        ch = vowels[Math.floor(Math.random() * vowels.length)];
        consonantRun = 0;
      }
    } else {
      consonantRun = 0;
    }
    out += ch;
    last = ch;
    // Alternate most of the time, occasionally repeat class.
    wantVowel = Math.random() < 0.8 ? !wantVowel : wantVowel;
  }
  return out;
}

// Generate words composed ONLY of the chosen drill letters.
// Prefers real English words that fit the set (aiming for ~70% real when
// possible); pads with pronounceable pseudo-words for variety and coverage.
export function drillWords(letters: string[], count: number): string[] {
  const normalized = [...new Set(letters.map((l) => l.toLowerCase()).filter(Boolean))];
  const set = new Set(normalized);
  if (set.size === 0) return randomWords(count);

  const realPool = DRILL_DICT.filter((w) => {
    for (let i = 0; i < w.length; i++) if (!set.has(w[i])) return false;
    return true;
  });

  const out: string[] = [];
  const REAL_MIN = 10;
  if (realPool.length >= REAL_MIN) {
    // ~70% real words, ~30% pseudo-word fillers.
    for (let i = 0; i < count; i++) {
      const usePseudo = Math.random() < 0.3;
      out.push(
        usePseudo ? pseudoWord(normalized) : realPool[Math.floor(Math.random() * realPool.length)],
      );
    }
    return out;
  }

  // Tiny real-word pool — use everything we have, then pad with pseudo-words.
  const shuffled = [...new Set(realPool)].sort(() => Math.random() - 0.5);
  for (const w of shuffled) {
    if (out.length >= count) break;
    out.push(w);
  }
  while (out.length < count) {
    out.push(pseudoWord(normalized));
  }
  return out;
}

