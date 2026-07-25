import type { Keystroke, TypingResult } from "@/hooks/use-typing-engine";
import { LESSONS, fingerLabelForKey, type Lesson } from "@/data/lessons";
import type { LessonProgressMap } from "./progress";

// Accuracy matters far more than speed for a beginner, so the star ladder is
// accuracy-weighted: you cannot buy stars by typing fast and sloppy.
//
//   1 ★  finished the lesson
//   2 ★  ≥ 90% accuracy
//   3 ★  ≥ 95% accuracy
//   4 ★  ≥ 97% accuracy AND ≥ 80% of target wpm
//   5 ★  ≥ 99% accuracy AND ≥ target wpm

export const UNLOCK_STARS = 2;
export const RETRY_SUGGESTION_STARS = 3;

export function starsFor(lesson: Lesson, wpm: number, accuracy: number): number {
  if (accuracy >= 99 && wpm >= lesson.targetWpm) return 5;
  if (accuracy >= 97 && wpm >= lesson.targetWpm * 0.8) return 4;
  if (accuracy >= 95) return 3;
  if (accuracy >= 90) return 2;
  return 1;
}

/** All lessons are always unlocked — learners can pick any lesson freely. */
export function isUnlocked(_lesson: Lesson, _progress: LessonProgressMap): boolean {
  return true;
}

/** The lesson to nudge the learner toward: first unlocked-but-unfinished one. */
export function nextRecommended(progress: LessonProgressMap): Lesson | undefined {
  for (const lesson of LESSONS) {
    if (!isUnlocked(lesson, progress)) return undefined;
    if ((progress[lesson.id]?.stars ?? 0) < UNLOCK_STARS) return lesson;
  }
  return undefined;
}

export function lessonAfter(lesson: Lesson): Lesson | undefined {
  return LESSONS.find((l) => l.number === lesson.number + 1);
}

export interface ProblemKey {
  key: string;
  misses: number;
  attempts: number;
  finger: string;
}

/**
 * The keys missed most in this attempt. Counts a miss against the character the
 * learner *should* have typed, which is what they need to practise — not the
 * wrong key they happened to hit.
 */
export function problemKeys(keystrokes: readonly Keystroke[], limit = 3): ProblemKey[] {
  const misses = new Map<string, number>();
  const attempts = new Map<string, number>();

  for (const k of keystrokes) {
    const expected = k.expected;
    if (expected === undefined) continue;
    attempts.set(expected, (attempts.get(expected) ?? 0) + 1);
    if (!k.correct) misses.set(expected, (misses.get(expected) ?? 0) + 1);
  }

  return [...misses.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => ({
      key,
      misses: count,
      attempts: attempts.get(key) ?? count,
      finger: key === " " ? "thumb" : fingerLabelForKey(key),
    }));
}

export interface LessonOutcome {
  stars: number;
  wpm: number;
  accuracy: number;
  elapsed: number;
  errors: number;
  problems: ProblemKey[];
  unlockedNext: boolean;
  shouldSuggestRetry: boolean;
}

export function evaluate(lesson: Lesson, result: TypingResult): LessonOutcome {
  const accuracy = Math.round(result.accuracy * 10) / 10;
  const stars = starsFor(lesson, result.wpm, accuracy);
  return {
    stars,
    wpm: result.wpm,
    accuracy,
    elapsed: result.elapsed,
    errors: result.keystrokes.filter((k) => !k.correct).length,
    problems: problemKeys(result.keystrokes),
    unlockedNext: stars >= UNLOCK_STARS && lessonAfter(lesson) !== undefined,
    shouldSuggestRetry: stars < RETRY_SUGGESTION_STARS,
  };
}
