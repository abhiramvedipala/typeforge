import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const InputSchema = z.object({
  topic: z.string().min(1).max(500),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
});

const SmartInputSchema = z.object({
  keys: z.array(z.string().min(1).max(3)).max(20).default([]),
  bigrams: z.array(z.string().min(2).max(3)).max(20).default([]),
});

function sanitize(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\s+/g, " ")
    .trim();
}

export const generatePracticeText = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(key);

    const difficultyHint = {
      easy: "Use simple, common words and short sentences (around 60-80 words).",
      medium: "Use natural language with moderate vocabulary (around 100-140 words).",
      hard: "Use rich vocabulary and varied sentence structure (around 140-200 words).",
    }[data.difficulty];

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system:
        "You generate clean text for typing practice. Output ONLY the practice text with no preamble, no quotes, no markdown, no titles. Use plain ASCII punctuation only (no smart quotes, em-dashes, or special characters). Keep it coherent and meaningful.",
      prompt: `Write a passage for typing practice about: ${data.topic}\n\n${difficultyHint}`,
    });

    return { text: sanitize(text) };
  });

export const generateSmartDrillText = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SmartInputSchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    if (data.keys.length === 0 && data.bigrams.length === 0) {
      throw new Error("Need at least one target key or bigram");
    }

    const gateway = createLovableAiGatewayProvider(key);

    const keyList = data.keys.length ? data.keys.join(", ") : "(none)";
    const bgList = data.bigrams.length ? data.bigrams.join(", ") : "(none)";

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system:
        "You generate natural English prose for typing practice. Output ONLY the practice text — no preamble, no quotes, no markdown, no titles, no explanations. Use plain ASCII punctuation only (no smart quotes, em-dashes, or special characters). The text MUST read like real coherent English sentences a person would actually write — not nonsense, not a list of words, not letter soup.",
      prompt:
        `Write 110-150 words of coherent English prose suitable for typing practice. ` +
        `Heavily weight the vocabulary toward these trouble letters: ${keyList}. ` +
        `Aim for MOST words (roughly 80%+) to contain at least one of those letters. ` +
        `Also include these letter pairs (bigrams) frequently, embedded naturally inside real words: ${bgList}. ` +
        `Do NOT produce text made only of these letters, do NOT list words, and do NOT force nonsense. Write 4-7 real sentences that flow naturally. Keep punctuation simple: periods, commas, apostrophes only.`,
    });

    return { text: sanitize(text) };
  });
