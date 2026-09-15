import { describe, expect, it, vi } from "vitest";
import { legalRegex } from "./charset";
import { drillCacheKey, generateDrill, type AiGenerator } from "./generate";
import { TIERS } from "./difficulty";
import { filterLegal, topUp } from "./validate";
import { mulberry32 } from "@/lib/lessons/prng";

const rng = () => mulberry32(1234);

function allLegal(words: string[], charset: string): boolean {
  const re = legalRegex(charset);
  return words.every((w) => re.test(w));
}

describe("dictionary path (no AI)", () => {
  it("home row: exact word count, all legal", async () => {
    const d = await generateDrill({ charset: "asdfghjkl", difficulty: "medium", rng: rng() });
    expect(d.words).toHaveLength(TIERS.medium.wordCount);
    expect(allLegal(d.words, "asdfghjkl")).toBe(true);
    expect(d.source).toBe("dictionary");
  });

  it("qwzx: 20+ legal pseudo-words, no crash", async () => {
    const d = await generateDrill({ charset: "qwzx", difficulty: "medium", rng: rng() });
    expect(d.words).toHaveLength(TIERS.medium.wordCount);
    expect(allLegal(d.words, "qwzx")).toBe(true);
  });

  it("single character charset degrades legally without looping forever", async () => {
    const d = await generateDrill({ charset: "a", difficulty: "easy", rng: rng() });
    expect(d.words).toHaveLength(TIERS.easy.wordCount);
    expect(allLegal(d.words, "a")).toBe(true);
  });

  it("empty charset returns no words", async () => {
    const d = await generateDrill({ charset: "", difficulty: "easy" });
    expect(d.words).toEqual([]);
  });
});

describe("AI path", () => {
  const ai = (words: unknown[]): AiGenerator => vi.fn(async () => ({ words }));

  it("malformed model output falls back to a dictionary drill", async () => {
    const bad: AiGenerator = vi.fn(async () => {
      throw new Error("bad json");
    });
    const d = await generateDrill({
      charset: "qwzx",
      difficulty: "medium",
      ai: bad,
      rng: rng(),
    });
    expect(bad).toHaveBeenCalled();
    expect(d.words).toHaveLength(TIERS.medium.wordCount);
    expect(allLegal(d.words, "qwzx")).toBe(true);
    expect(d.source).toBe("dictionary");
  });

  it("illegal words are discarded and topped up to the exact count", async () => {
    const legal = Array.from({ length: 18 }, (_, i) => "qwz".slice(0, (i % 3) + 1) + "x");
    const illegal = Array.from({ length: 12 }, (_, i) => `friend${i}`);
    const d = await generateDrill({
      charset: "qwzx",
      difficulty: "medium",
      ai: ai([...legal, ...illegal]),
      rng: rng(),
    });
    expect(d.words).toHaveLength(TIERS.medium.wordCount);
    expect(allLegal(d.words, "qwzx")).toBe(true);
  });

  it("api down (rejected promise) still serves a drill", async () => {
    const down: AiGenerator = vi.fn(async () => Promise.reject(new Error("500")));
    const d = await generateDrill({ charset: "qwzx", difficulty: "hard", ai: down, rng: rng() });
    expect(d.words).toHaveLength(TIERS.hard.wordCount);
    expect(allLegal(d.words, "qwzx")).toBe(true);
  });

  it("does not call the model when the dictionary is rich enough", async () => {
    const spy = ai(["asdf"]);
    await generateDrill({ charset: "asdfghjkl", difficulty: "medium", ai: spy, rng: rng() });
    expect(spy).not.toHaveBeenCalled();
  });

  it("calls the model when a theme is supplied", async () => {
    const spy = ai(["glad", "flask"]);
    await generateDrill({
      charset: "asdfghjkl",
      difficulty: "medium",
      seedPrompt: "medical-ish",
      ai: spy,
      rng: rng(),
    });
    expect(spy).toHaveBeenCalled();
  });
});

describe("validation helpers", () => {
  it("filterLegal drops illegal and duplicate words", () => {
    expect(filterLegal(["asdf", "friend", "asdf", 42, ""], "asdfghjkl")).toEqual(["asdf"]);
  });

  it("topUp always returns the requested count of legal words", () => {
    const out = topUp(["as"], {
      charset: "asdfghjkl",
      count: 30,
      minLength: 3,
      maxLength: 5,
      rng: rng(),
    });
    expect(out).toHaveLength(30);
    expect(allLegal(out, "asdfghjkl")).toBe(true);
  });
});

describe("cache key", () => {
  it("is stable for identical requests and differs on charset", () => {
    expect(drillCacheKey("asdfghjkl", "easy", 15)).toBe(drillCacheKey("asdfghjkl", "easy", 15));
    expect(drillCacheKey("asdfghjkl", "easy", 15)).not.toBe(drillCacheKey("qwzx", "easy", 15));
  });
});
