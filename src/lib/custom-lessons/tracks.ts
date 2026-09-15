// Custom-track persistence. localStorage-backed for everyone (signed in or
// not); this module is the single seam if the tracks later move to the cloud.

import {
  DIFFICULTIES,
  MAX_TRACK_STARS,
  PASSES_TO_ADVANCE,
  STARS_PER_LEVEL,
  nextDifficulty,
  passed,
  type Difficulty,
} from "./difficulty";

const STORAGE_KEY = "typeforge:custom_tracks";

export interface CustomAttempt {
  wpm: number;
  accuracy: number;
  errorsByKey: Record<string, number>;
  passed: boolean;
  createdAt: string;
}

export interface CustomTrack {
  id: string;
  title: string;
  charset: string;
  seedPrompt: string;
  currentLevel: Difficulty;
  stars: number;
  /** Consecutive passes at the current level. */
  streak: number;
  attempts: CustomAttempt[];
  createdAt: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function coerce(value: unknown): CustomTrack | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === "string" ? value.id : "";
  const charset = typeof value.charset === "string" ? value.charset : "";
  if (!id || !charset) return null;
  const level = DIFFICULTIES.includes(value.currentLevel as Difficulty)
    ? (value.currentLevel as Difficulty)
    : "easy";
  return {
    id,
    title: typeof value.title === "string" ? value.title : charset,
    charset,
    seedPrompt: typeof value.seedPrompt === "string" ? value.seedPrompt : "",
    currentLevel: level,
    stars: Number.isFinite(Number(value.stars))
      ? Math.max(0, Math.min(MAX_TRACK_STARS, Math.round(Number(value.stars))))
      : 0,
    streak: Number.isFinite(Number(value.streak)) ? Math.max(0, Number(value.streak)) : 0,
    attempts: Array.isArray(value.attempts) ? (value.attempts as CustomAttempt[]).slice(-50) : [],
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString(),
  };
}

export function loadTracks(): CustomTrack[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(coerce).filter((t): t is CustomTrack => t !== null);
  } catch {
    return [];
  }
}

function persist(tracks: CustomTrack[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tracks));
  } catch {
    // best-effort
  }
}

export function getTrack(id: string): CustomTrack | undefined {
  return loadTracks().find((t) => t.id === id);
}

export function createTrack(input: {
  title: string;
  charset: string;
  seedPrompt?: string;
  startLevel?: Difficulty;
}): CustomTrack {
  const track: CustomTrack = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `t${Date.now()}${Math.random().toString(36).slice(2, 8)}`,
    title: input.title.trim() || input.charset,
    charset: input.charset,
    seedPrompt: (input.seedPrompt ?? "").trim(),
    currentLevel: input.startLevel ?? "easy",
    stars: 0,
    streak: 0,
    attempts: [],
    createdAt: new Date().toISOString(),
  };
  persist([track, ...loadTracks()]);
  return track;
}

export function deleteTrack(id: string): CustomTrack[] {
  const next = loadTracks().filter((t) => t.id !== id);
  persist(next);
  return next;
}

export interface RecordOutcome {
  track: CustomTrack;
  passed: boolean;
  leveledUp: boolean;
  completed: boolean;
  streak: number;
}

/** Record an attempt, applying pass gates, streaks, stars and level-ups. */
export function recordAttempt(
  trackId: string,
  result: { wpm: number; accuracy: number; errorsByKey: Record<string, number> },
  userAvgWpm = 0,
): RecordOutcome | null {
  const tracks = loadTracks();
  const idx = tracks.findIndex((t) => t.id === trackId);
  if (idx === -1) return null;
  const track = { ...tracks[idx] };

  const ok = passed(track.currentLevel, result, userAvgWpm);
  const attempt: CustomAttempt = {
    wpm: result.wpm,
    accuracy: result.accuracy,
    errorsByKey: result.errorsByKey,
    passed: ok,
    createdAt: new Date().toISOString(),
  };
  track.attempts = [...track.attempts, attempt].slice(-50);
  track.streak = ok ? track.streak + 1 : 0;

  let leveledUp = false;
  let completed = false;
  const levelIndex = DIFFICULTIES.indexOf(track.currentLevel);

  if (ok) {
    // Stars scale with progress through the level (2 passes = full 5 stars).
    const earned = Math.min(STARS_PER_LEVEL, Math.round((track.streak / PASSES_TO_ADVANCE) * STARS_PER_LEVEL));
    track.stars = Math.max(track.stars, levelIndex * STARS_PER_LEVEL + earned);
  }

  if (ok && track.streak >= PASSES_TO_ADVANCE) {
    const next = nextDifficulty(track.currentLevel);
    if (next) {
      track.currentLevel = next;
      track.streak = 0;
      leveledUp = true;
    } else {
      completed = true;
      track.stars = MAX_TRACK_STARS;
    }
  }

  tracks[idx] = track;
  persist(tracks);
  return { track, passed: ok, leveledUp, completed, streak: track.streak };
}

/** Keys the user missed most in this track's recent attempts. */
export function weakKeysForTrack(track: CustomTrack, limit = 6): string[] {
  const totals: Record<string, number> = {};
  for (const a of track.attempts.slice(-5)) {
    for (const [k, n] of Object.entries(a.errorsByKey ?? {})) {
      totals[k] = (totals[k] ?? 0) + n;
    }
  }
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k)
    .filter((k) => track.charset.includes(k));
}
