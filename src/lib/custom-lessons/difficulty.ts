// Difficulty tiers: concrete parameters, not vibes.

export type Difficulty = "easy" | "medium" | "hard";

export const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard"];

export interface Tier {
  id: Difficulty;
  minLength: number;
  maxLength: number;
  /** How many times each distinct word appears (easy drills repeat heavily). */
  repetition: number;
  ordering: "grouped" | "shuffled";
  punctuation: boolean;
  wordCount: number;
  passWpm: number;
  passAccuracy: number;
}

export const TIERS: Record<Difficulty, Tier> = {
  easy: {
    id: "easy",
    minLength: 2,
    maxLength: 3,
    repetition: 3,
    ordering: "grouped",
    punctuation: false,
    wordCount: 15,
    passWpm: 20,
    passAccuracy: 95,
  },
  medium: {
    id: "medium",
    minLength: 3,
    maxLength: 5,
    repetition: 2,
    ordering: "shuffled",
    punctuation: false,
    wordCount: 30,
    passWpm: 30,
    passAccuracy: 96,
  },
  hard: {
    id: "hard",
    minLength: 5,
    maxLength: 8,
    repetition: 1,
    ordering: "shuffled",
    punctuation: true,
    wordCount: 45,
    passWpm: 40,
    passAccuracy: 97,
  },
};

export const PASSES_TO_ADVANCE = 2;
export const STARS_PER_LEVEL = 5;
export const MAX_TRACK_STARS = STARS_PER_LEVEL * DIFFICULTIES.length;

export interface PassGate {
  wpm: number;
  accuracy: number;
}

/**
 * The bar for a tier. If the user's own average speed already clears the
 * default, raise the gate so the drill stays challenging instead of
 * auto-completing.
 */
export function passGate(difficulty: Difficulty, userAvgWpm = 0): PassGate {
  const tier = TIERS[difficulty];
  const scaled = Number.isFinite(userAvgWpm) && userAvgWpm > 0 ? userAvgWpm * 0.9 : 0;
  return {
    wpm: Math.round(Math.max(tier.passWpm, scaled)),
    accuracy: tier.passAccuracy,
  };
}

export function passed(
  difficulty: Difficulty,
  result: { wpm: number; accuracy: number },
  userAvgWpm = 0,
): boolean {
  const gate = passGate(difficulty, userAvgWpm);
  return result.wpm >= gate.wpm && result.accuracy >= gate.accuracy;
}

export function nextDifficulty(difficulty: Difficulty): Difficulty | null {
  const i = DIFFICULTIES.indexOf(difficulty);
  return i >= 0 && i < DIFFICULTIES.length - 1 ? DIFFICULTIES[i + 1] : null;
}

/**
 * Expand a pool of distinct words into the drill sequence for a tier:
 * repetition, ordering, and exact word count.
 */
export function buildDrill(
  pool: readonly string[],
  difficulty: Difficulty,
  rng: () => number = Math.random,
): string[] {
  const tier = TIERS[difficulty];
  if (pool.length === 0) return [];

  const distinctNeeded = Math.max(1, Math.ceil(tier.wordCount / tier.repetition));
  const distinct: string[] = [];
  const available = [...pool];
  while (distinct.length < distinctNeeded) {
    if (available.length === 0) {
      distinct.push(pool[Math.floor(rng() * pool.length)]);
      continue;
    }
    const i = Math.floor(rng() * available.length);
    distinct.push(available.splice(i, 1)[0]);
  }

  const seq: string[] = [];
  for (const w of distinct) {
    for (let r = 0; r < tier.repetition && seq.length < tier.wordCount; r++) seq.push(w);
  }
  while (seq.length < tier.wordCount) seq.push(distinct[seq.length % distinct.length]);
  const words = seq.slice(0, tier.wordCount);

  if (tier.ordering === "shuffled") {
    for (let i = words.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [words[i], words[j]] = [words[j], words[i]];
    }
  }
  return words;
}
