import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const InputSchema = z.object({
  topic: z.string().min(1).max(500),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
});

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

    // Sanitize: replace smart quotes/dashes etc.
    const cleaned = text
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/\u2026/g, "...")
      .replace(/\s+/g, " ")
      .trim();

    return { text: cleaned };
  });
