import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { DIFFICULTIES } from "./difficulty";

const InputSchema = z.object({
  charset: z.string().min(1).max(60),
  difficulty: z.enum(["easy", "medium", "hard"]),
  wordCount: z.number().int().min(5).max(80),
  minLength: z.number().int().min(1).max(12),
  maxLength: z.number().int().min(1).max(12),
  weakKeys: z.array(z.string().min(1).max(1)).max(12).default([]),
  seedPrompt: z.string().max(200).default(""),
});

type Input = z.infer<typeof InputSchema>;

// 30-day TTL cache keyed by the request shape. Identical requests cost nothing
// twice within a server instance's lifetime.
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; words: string[] }>();

// Crude in-memory rate limit: 15 generations/hour per caller bucket.
const RATE_LIMIT = 15;
const WINDOW_MS = 60 * 60 * 1000;
const hits = new Map<string, number[]>();

function cacheKey(data: Input): string {
  return [data.charset, data.difficulty, data.wordCount, data.seedPrompt.trim().toLowerCase()].join(
    "|",
  );
}

function rateLimited(bucket: string): boolean {
  const now = Date.now();
  const recent = (hits.get(bucket) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(bucket, recent);
    return true;
  }
  recent.push(now);
  hits.set(bucket, recent);
  return false;
}

function stripFences(text: string): string {
  return text
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

/**
 * Stage 2 only. This returns raw candidate words — the caller ALWAYS runs them
 * through the validation + top-up pipeline, so a bad model response degrades to
 * a dictionary drill instead of an error.
 */
export const generateLessonWords = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    if (!DIFFICULTIES.includes(data.difficulty)) return { words: [] as string[] };

    const key = cacheKey(data);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < TTL_MS) {
      return { words: cached.words, cached: true };
    }

    if (rateLimited(data.charset)) return { words: [] as string[], rateLimited: true };

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { words: [] as string[] };

    const gateway = createLovableAiGatewayProvider(apiKey);

    const system = [
      "You generate typing-practice drills.",
      "",
      `ALLOWED CHARACTERS: ${data.charset}`,
      "",
      "Hard rules:",
      "- Every word uses ONLY allowed characters. No exceptions.",
      "- If a real English word is not possible, emit pronounceable pseudo-words.",
      '- Output raw JSON only, no markdown fences, no prose: {"words": ["...", "..."]}',
    ].join("\n");

    const prompt = [
      `difficulty: ${data.difficulty}`,
      `word length: ${data.minLength}-${data.maxLength} characters`,
      `exactly ${data.wordCount} words`,
      data.weakKeys.length
        ? `emphasize these keys more often than others: ${data.weakKeys.join(", ")}`
        : "",
      data.seedPrompt
        ? `theme (soft preference, never overrides the charset rule): ${data.seedPrompt}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const { text } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system,
        prompt,
        temperature: 0.7,
        maxOutputTokens: 600,
      });

      const parsed: unknown = JSON.parse(stripFences(text));
      const words =
        parsed && typeof parsed === "object" && Array.isArray((parsed as { words?: unknown }).words)
          ? ((parsed as { words: unknown[] }).words.filter(
              (w) => typeof w === "string",
            ) as string[])
          : [];

      if (words.length > 0) cache.set(key, { at: Date.now(), words });
      return { words };
    } catch {
      // Malformed JSON, model error, API down — caller falls back to dictionary.
      return { words: [] as string[] };
    }
  });
