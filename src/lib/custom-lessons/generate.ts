// Orchestrates the four generation stages. Pure and injectable so the AI call
// can be mocked in tests — the validation layer is the part that must never
// regress.

import { buildCharset } from "./charset";
import { dictionaryWords } from "./dictionary";
import { buildDrill, TIERS, type Difficulty } from "./difficulty";
import { filterLegal, topUp, type Rng } from "./validate";

/** Minimum real words before we consider the dictionary "enough". */
export const DICTIONARY_THRESHOLD = 25;

export type DrillSource = "dictionary" | "ai" | "mixed";

export interface GeneratedDrill {
  words: string[];
  source: DrillSource;
  charset: string;
  difficulty: Difficulty;
}

export type AiGenerator = (req: {
  charset: string;
  difficulty: Difficulty;
  wordCount: number;
  minLength: number;
  maxLength: number;
  weakKeys: string[];
  seedPrompt: string;
}) => Promise<{ words: unknown[] }>;

export interface GenerateOptions {
  charset: string;
  difficulty: Difficulty;
  weakKeys?: readonly string[];
  seedPrompt?: string;
  rng?: Rng;
  /** Omit to stay purely offline (Stage 1 + Stage 4 only). */
  ai?: AiGenerator;
}

export async function generateDrill(opts: GenerateOptions): Promise<GeneratedDrill> {
  const charset = buildCharset(opts.charset);
  const difficulty = opts.difficulty;
  const tier = TIERS[difficulty];
  const rng = opts.rng ?? Math.random;
  const weakKeys = (opts.weakKeys ?? []).filter((k) => charset.includes(k));
  const seedPrompt = (opts.seedPrompt ?? "").trim();

  const empty: GeneratedDrill = { words: [], source: "dictionary", charset, difficulty };
  if (!charset) return empty;

  // ---- Stage 1: dictionary filter (free, instant, provably correct) --------
  const dict = dictionaryWords(charset, {
    minLength: tier.minLength,
    maxLength: tier.maxLength,
  });

  const weighted = weightPool(dict, weakKeys, rng);
  const wantsAi = Boolean(opts.ai) && (dict.length < DICTIONARY_THRESHOLD || seedPrompt.length > 0);

  if (!wantsAi) {
    const pool = weighted.length > 0 ? weighted : [];
    const words = buildDrill(
      topUp(pool, {
        charset,
        count: Math.max(tier.wordCount, 12),
        minLength: tier.minLength,
        maxLength: tier.maxLength,
        rng,
        weakKeys,
      }),
      difficulty,
      rng,
    );
    return { words, source: "dictionary", charset, difficulty };
  }

  // ---- Stage 2: AI generation (themed / exotic charsets only) --------------
  let aiWords: string[] = [];
  try {
    const res = await opts.ai!({
      charset,
      difficulty,
      wordCount: tier.wordCount,
      minLength: tier.minLength,
      maxLength: tier.maxLength,
      weakKeys: [...weakKeys],
      seedPrompt,
    });
    // ---- Stage 3: hard validation — discard, never "fix" ------------------
    aiWords = filterLegal(Array.isArray(res?.words) ? res.words : [], charset);
  } catch {
    aiWords = []; // model down or malformed — the dictionary path serves the drill
  }

  // ---- Stage 4: top-up to the exact word count ----------------------------
  const pool = topUp([...aiWords, ...weighted], {
    charset,
    count: Math.max(tier.wordCount, 12),
    minLength: tier.minLength,
    maxLength: tier.maxLength,
    rng,
    weakKeys,
  });

  const legalAi = aiWords.length;
  const source: DrillSource = legalAi === 0 ? "dictionary" : legalAi >= pool.length ? "ai" : "mixed";
  return { words: buildDrill(pool, difficulty, rng), source, charset, difficulty };
}

/** Move words containing weak keys to the front so they get drilled more. */
function weightPool(words: readonly string[], weakKeys: readonly string[], rng: Rng): string[] {
  if (weakKeys.length === 0) return shuffle(words, rng);
  const hot: string[] = [];
  const cold: string[] = [];
  for (const w of words) {
    (weakKeys.some((k) => w.includes(k)) ? hot : cold).push(w);
  }
  return [...shuffle(hot, rng), ...shuffle(cold, rng)];
}

function shuffle(words: readonly string[], rng: Rng): string[] {
  const out = [...words];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Cache key for identical requests. */
export function drillCacheKey(
  charset: string,
  difficulty: Difficulty,
  wordCount: number,
  seedPrompt = "",
): string {
  return `${buildCharset(charset)}|${difficulty}|${wordCount}|${seedPrompt.trim().toLowerCase()}`;
}
