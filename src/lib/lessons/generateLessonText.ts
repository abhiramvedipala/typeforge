import { COMMON_WORDS, drillWords } from "@/lib/words";
import type { Lesson, PhaseId, PhaseWeights } from "@/data/lessons";
import { pick, randInt, rngFromKey, shuffled } from "./prng";

// Every lesson ramps through five phases, easiest first. The opening of a
// lesson must feel almost too easy — that is the whole point.
//
//   A · isolate    single key repeated              ffff jjjj
//   B · alternate  the two new keys alternating     fj fj jf jf
//   C · cluster    3-4 char groups of new keys      fjf jfj ffj
//   D · blend      new keys mixed with everything   fjd kfj dkf
//   E · words      real words from the pool         add all had ask
//
// Text is deterministic: seeded from the lesson id, so a retry is directly
// comparable to the first attempt.

export const PHASE_ORDER: readonly PhaseId[] = [
  "isolate",
  "alternate",
  "cluster",
  "blend",
  "words",
];

export const PHASE_LABELS: Record<PhaseId, string> = {
  isolate: "isolate",
  alternate: "alternate",
  cluster: "cluster",
  blend: "blend",
  words: "words",
};

export interface PhaseChunk {
  phase: PhaseId;
  /** Character offset of this phase within the full lesson text. */
  start: number;
  end: number;
}

export interface LessonText {
  text: string;
  chunks: PhaseChunk[];
}

const VOWELS = new Set(["a", "e", "i", "o", "u", "y"]);

/** Build tokens until their combined length (plus joining spaces) hits budget. */
function fill(budget: number, next: () => string): string[] {
  const tokens: string[] = [];
  let used = 0;
  // Guard against a generator that only ever returns "" (impossible for a
  // non-empty pool, but cheap insurance against an infinite loop).
  let guard = 0;
  while (used < budget && guard++ < budget * 4 + 50) {
    const token = next();
    if (!token) continue;
    tokens.push(token);
    used += token.length + 1;
  }
  return tokens;
}

/** Phase A — one key at a time, repeated in even blocks. */
function isolatePhase(keys: string[], budget: number, rng: () => number): string[] {
  if (keys.length === 0) return [];
  let i = 0;
  return fill(budget, () => {
    const key = keys[i++ % keys.length];
    return key.repeat(randInt(3, 4, rng));
  });
}

/** Phase B — the lesson's keys alternating within a token. */
function alternatePhase(keys: string[], budget: number, rng: () => number): string[] {
  if (keys.length === 0) return [];
  if (keys.length === 1) return isolatePhase(keys, budget, rng);
  return fill(budget, () => {
    const pair = shuffled(keys, rng).slice(0, 2);
    const len = randInt(2, 3, rng) * 2;
    let out = "";
    for (let i = 0; i < len; i++) out += pair[i % 2];
    return out;
  });
}

/** Phase C — 3-4 character clusters drawn from the lesson's keys. */
function clusterPhase(keys: string[], budget: number, rng: () => number): string[] {
  if (keys.length === 0) return [];
  return fill(budget, () => {
    const len = randInt(3, 4, rng);
    let out = "";
    let run = 0;
    let last = "";
    for (let i = 0; i < len; i++) {
      let ch = pick(keys, rng);
      // Never three identical characters in a row.
      let guard = 0;
      while (keys.length > 1 && ch === last && run >= 1 && guard++ < 6) ch = pick(keys, rng);
      run = ch === last ? run + 1 : 0;
      last = ch;
      out += ch;
    }
    return out;
  });
}

/** Phase D — new keys blended with everything learned so far. */
function blendPhase(
  focusKeys: string[],
  pool: string[],
  budget: number,
  rng: () => number,
): string[] {
  const keys = pool.length > 0 ? pool : focusKeys;
  if (keys.length === 0) return [];
  return fill(budget, () => {
    const len = randInt(3, 5, rng);
    let out = "";
    let last = "";
    for (let i = 0; i < len; i++) {
      // Bias toward the keys this lesson is teaching, but keep the rest present.
      const source = focusKeys.length > 0 && rng() < 0.55 ? focusKeys : keys;
      let ch = pick(source, rng);
      let guard = 0;
      while (source.length > 1 && ch === last && guard++ < 4) ch = pick(source, rng);
      last = ch;
      out += ch;
    }
    return out;
  });
}

/**
 * Phase E — real words. Reuses the drill-mode generator so there is exactly one
 * dictionary-filtering / pseudo-word implementation in the codebase.
 */
function wordsPhase(pool: string[], budget: number, rng: () => number): string[] {
  if (pool.length === 0) return [];
  // Roughly 5 characters per word including the trailing space.
  const wanted = Math.max(1, Math.ceil(budget / 5));
  const words = drillWords(pool, wanted, rng);
  const out: string[] = [];
  let used = 0;
  for (const w of words) {
    if (used >= budget) break;
    out.push(w);
    used += w.length + 1;
  }
  return out;
}

/**
 * Lesson 29/30 — sentence-like runs of the most common English words. The MVP
 * has no capitals or punctuation, so "sentences" here means natural word
 * sequences rather than fully punctuated prose.
 */
function commonWordsPhase(budget: number, rng: () => number): string[] {
  const dict = COMMON_WORDS.filter((w) => /^[a-z]+$/.test(w));
  return fill(budget, () => pick(dict, rng));
}

/**
 * Generate the full practice text for a lesson, phase by phase.
 * Deterministic for a given lesson id.
 */
export function generateLessonText(lesson: Lesson): LessonText {
  const rng = rngFromKey(`typeforge-lesson-${lesson.id}-v1`);
  const weights = normalizeWeights(lesson);

  const chunks: PhaseChunk[] = [];
  const parts: string[] = [];
  let offset = 0;

  for (const phase of PHASE_ORDER) {
    const budget = Math.round(lesson.charCount * weights[phase]);
    if (budget <= 0) continue;

    const tokens = generatePhase(phase, lesson, budget, rng);
    if (tokens.length === 0) continue;

    const body = tokens.join(" ");
    // Phases are separated by a single space, same as any other word boundary.
    const start = offset === 0 ? 0 : offset + 1;
    parts.push(body);
    offset = start + body.length;
    chunks.push({ phase, start, end: offset });
  }

  return { text: parts.join(" "), chunks };
}

function generatePhase(
  phase: PhaseId,
  lesson: Lesson,
  budget: number,
  rng: () => number,
): string[] {
  const isFullAlphabet = lesson.pool.length >= 26;
  switch (phase) {
    case "isolate":
      return isolatePhase(lesson.focusKeys, budget, rng);
    case "alternate":
      return alternatePhase(lesson.focusKeys, budget, rng);
    case "cluster":
      return clusterPhase(lesson.focusKeys, budget, rng);
    case "blend":
      return blendPhase(lesson.focusKeys, lesson.pool, budget, rng);
    case "words":
      // Once every letter is available, drill against real high-frequency English
      // rather than dictionary-filtered words — that is what lessons 29/30 want.
      return isFullAlphabet ? commonWordsPhase(budget, rng) : wordsPhase(lesson.pool, budget, rng);
  }
}

/**
 * A pool with no vowels cannot produce words, so that phase's share is folded
 * into cluster work instead. Weights are then renormalized to sum to 1.
 */
function normalizeWeights(lesson: Lesson): PhaseWeights {
  const w: PhaseWeights = { ...lesson.weights };
  const hasVowel = lesson.pool.some((k) => VOWELS.has(k));
  if (!hasVowel && w.words > 0) {
    w.cluster += w.words;
    w.words = 0;
  }
  const total = PHASE_ORDER.reduce((sum, p) => sum + w[p], 0);
  if (total <= 0) return { isolate: 0, alternate: 0, cluster: 1, blend: 0, words: 0 };
  for (const p of PHASE_ORDER) w[p] = w[p] / total;
  return w;
}

/** Which phase a character index falls in — drives the phase indicator. */
export function phaseAt(chunks: readonly PhaseChunk[], index: number): PhaseId | null {
  for (const c of chunks) {
    if (index >= c.start && index < c.end) return c.phase;
  }
  return chunks.length > 0 ? chunks[chunks.length - 1].phase : null;
}
