import { describe, it, expect } from "vitest";
import { LESSONS, TOTAL_LESSONS, targetWpmFor, charCountFor } from "@/data/lessons";
import { generateLessonText } from "./generateLessonText";
import { isUnlocked, starsFor, problemKeys } from "./scoring";
import type { LessonProgressMap } from "./progress";
import type { Keystroke } from "@/hooks/use-typing-engine";

describe("curriculum", () => {
  it("has exactly 30 lessons, numbered and ordered 1..30", () => {
    expect(TOTAL_LESSONS).toBe(30);
    expect(LESSONS.map((l) => l.number)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  it("never introduces punctuation — letters only", () => {
    for (const lesson of LESSONS) {
      for (const key of lesson.pool) {
        expect(key).toMatch(/^[a-z]$/);
      }
    }
  });

  it("accumulates keys monotonically — pool never loses a letter", () => {
    let prevPool = new Set<string>();
    for (const lesson of LESSONS) {
      for (const key of prevPool) {
        expect(lesson.pool).toContain(key);
      }
      prevPool = new Set(lesson.pool);
    }
  });

  it("targetWpm rises from 12 at lesson 1 to its max at lesson 30", () => {
    expect(targetWpmFor(1)).toBe(12);
    expect(targetWpmFor(30)).toBeGreaterThan(targetWpmFor(1));
    // Non-decreasing across the whole course.
    for (let n = 2; n <= 30; n++) {
      expect(targetWpmFor(n)).toBeGreaterThanOrEqual(targetWpmFor(n - 1));
    }
  });

  it("charCount is clamped to 150-400", () => {
    for (let n = 1; n <= 30; n++) {
      const c = charCountFor(targetWpmFor(n));
      expect(c).toBeGreaterThanOrEqual(150);
      expect(c).toBeLessThanOrEqual(400);
    }
  });

  it("lesson 15 targets at least 2 minutes of typing at its own target wpm", () => {
    const lesson = LESSONS.find((l) => l.number === 15)!;
    const minutesAtTarget = lesson.charCount / 5 / lesson.targetWpm;
    expect(minutesAtTarget).toBeGreaterThanOrEqual(2);
  });
});

describe("generateLessonText", () => {
  it("is deterministic for a given lesson id", () => {
    const lesson = LESSONS[0];
    const a = generateLessonText(lesson);
    const b = generateLessonText(lesson);
    expect(a.text).toBe(b.text);
  });

  it("only uses characters from the lesson's pool (plus spaces)", () => {
    for (const lesson of [LESSONS[0], LESSONS[9], LESSONS[19], LESSONS[29]]) {
      const { text } = generateLessonText(lesson);
      const allowed = new Set([...lesson.pool, " "]);
      for (const ch of text) {
        expect(allowed.has(ch)).toBe(true);
      }
    }
  });

  it("produces non-trivial text for every lesson", () => {
    for (const lesson of LESSONS) {
      const { text } = generateLessonText(lesson);
      expect(text.length).toBeGreaterThan(0);
    }
  });
});

describe("scoring", () => {
  const lesson = LESSONS[0];

  it("awards stars by accuracy first, wpm second", () => {
    // Below 90% accuracy: 1 star regardless of speed.
    expect(starsFor(lesson, 0, 50)).toBe(1);
    // 90-95%: 2 stars.
    expect(starsFor(lesson, 0, 91)).toBe(2);
    // 95%+ accuracy alone is enough for 3 stars — there is no wpm gate below tier 4.
    expect(starsFor(lesson, 0, 96)).toBe(3);
    // 4 and 5 stars additionally require hitting the wpm gate.
    expect(starsFor(lesson, 0, 98)).toBe(3); // fast enough accuracy, too slow for 4★
    expect(starsFor(lesson, lesson.targetWpm, 98)).toBe(4);
    expect(starsFor(lesson, lesson.targetWpm, 99.5)).toBe(5);
  });

  it("lesson 1 is always unlocked; lesson 2 requires 2 stars on lesson 1", () => {
    const empty: LessonProgressMap = {};
    expect(isUnlocked(LESSONS[0], empty)).toBe(true);
    expect(isUnlocked(LESSONS[1], empty)).toBe(false);

    const passed: LessonProgressMap = {
      [LESSONS[0].id]: {
        stars: 2,
        bestWpm: 10,
        bestAccuracy: 91,
        completedAt: new Date().toISOString(),
        attempts: 1,
      },
    };
    expect(isUnlocked(LESSONS[1], passed)).toBe(true);
  });

  it("problemKeys ranks the expected characters missed most often", () => {
    const keystrokes: Keystroke[] = [
      { t: 0, idx: 0, key: "j", expected: "f", correct: false },
      { t: 1, idx: 1, key: "f", expected: "f", correct: true },
      { t: 2, idx: 2, key: "f", expected: "j", correct: false },
      { t: 3, idx: 3, key: "x", expected: "j", correct: false },
    ];
    const problems = problemKeys(keystrokes, 3);
    expect(problems[0].key).toBe("j");
    expect(problems[0].misses).toBe(2);
  });
});
