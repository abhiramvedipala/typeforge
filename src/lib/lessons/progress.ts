import { LESSONS, MAX_STARS_PER_LESSON, TOTAL_LESSONS, TOTAL_STARS } from "@/data/lessons";

// Local-only progress store.
//
// This module is the single seam between the lessons UI and persistence. When
// progress moves to an account, replace the bodies of loadProgress /
// saveRecord with server calls (or read-through cache) and nothing else in the
// feature has to change.

const STORAGE_KEY = "typeforge-lessons-progress-v1";
const SCHEMA_VERSION = 1;

export interface LessonRecord {
  stars: number;
  bestWpm: number;
  bestAccuracy: number;
  completedAt: string;
  attempts: number;
}

export type LessonProgressMap = Record<string, LessonRecord>;

interface StoredShape {
  version: number;
  lessons: LessonProgressMap;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function coerceRecord(value: unknown): LessonRecord | null {
  if (!isRecord(value)) return null;
  const stars = Number(value.stars);
  const bestWpm = Number(value.bestWpm);
  const bestAccuracy = Number(value.bestAccuracy);
  const attempts = Number(value.attempts);
  if (!Number.isFinite(stars)) return null;
  return {
    stars: Math.max(0, Math.min(MAX_STARS_PER_LESSON, Math.round(stars))),
    bestWpm: Number.isFinite(bestWpm) ? Math.max(0, bestWpm) : 0,
    bestAccuracy: Number.isFinite(bestAccuracy) ? Math.max(0, Math.min(100, bestAccuracy)) : 0,
    completedAt: typeof value.completedAt === "string" ? value.completedAt : "",
    attempts: Number.isFinite(attempts) ? Math.max(0, Math.round(attempts)) : 0,
  };
}

/**
 * Read stored progress. Any failure — no storage, bad JSON, hand-edited
 * garbage, a future schema — degrades to "no progress" rather than throwing.
 */
export function loadProgress(): LessonProgressMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};

    // Unknown future schema: ignore rather than misread it.
    const version = Number(parsed.version);
    if (Number.isFinite(version) && version > SCHEMA_VERSION) return {};

    const lessons = isRecord(parsed.lessons) ? parsed.lessons : {};
    const valid = new Set(LESSONS.map((l) => l.id));
    const out: LessonProgressMap = {};
    for (const [id, value] of Object.entries(lessons)) {
      if (!valid.has(id)) continue;
      const record = coerceRecord(value);
      if (record) out[id] = record;
    }
    return out;
  } catch {
    return {};
  }
}

function persist(map: LessonProgressMap): void {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredShape = { version: SCHEMA_VERSION, lessons: map };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Private mode / quota exhausted — progress is best-effort, never fatal.
  }
}

export interface AttemptInput {
  stars: number;
  wpm: number;
  accuracy: number;
}

export interface SaveOutcome {
  progress: LessonProgressMap;
  record: LessonRecord;
  /** True when this attempt improved on the stored best wpm. */
  isNewBest: boolean;
}

/** Record an attempt, keeping the best stars / wpm / accuracy seen so far. */
export function saveAttempt(lessonId: string, attempt: AttemptInput): SaveOutcome {
  const progress = loadProgress();
  const prev = progress[lessonId];
  const isNewBest = !prev || attempt.wpm > prev.bestWpm;

  const record: LessonRecord = {
    stars: Math.max(prev?.stars ?? 0, attempt.stars),
    bestWpm: Math.max(prev?.bestWpm ?? 0, attempt.wpm),
    bestAccuracy: Math.max(prev?.bestAccuracy ?? 0, attempt.accuracy),
    completedAt: new Date().toISOString(),
    attempts: (prev?.attempts ?? 0) + 1,
  };

  const next: LessonProgressMap = { ...progress, [lessonId]: record };
  persist(next);
  return { progress: next, record, isNewBest };
}

export function resetProgress(): LessonProgressMap {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  return {};
}

export interface ProgressSummary {
  completed: number;
  totalLessons: number;
  stars: number;
  totalStars: number;
}

export function summarize(progress: LessonProgressMap): ProgressSummary {
  let completed = 0;
  let stars = 0;
  for (const lesson of LESSONS) {
    const record = progress[lesson.id];
    if (!record) continue;
    if (record.stars > 0) completed++;
    stars += record.stars;
  }
  return { completed, totalLessons: TOTAL_LESSONS, stars, totalStars: TOTAL_STARS };
}
