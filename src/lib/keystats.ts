// Per-key personal statistics persisted to localStorage.
// Tracks attempts, errors, and avg time-per-keystroke (ms) for each expected character.

import type { Keystroke } from "@/hooks/use-typing-engine";

export interface KeyStat {
  attempts: number;
  errors: number;
  totalMs: number; // sum of inter-keystroke intervals when this key was expected
  intervals: number; // count of intervals contributing to totalMs
}

export type KeyStatsMap = Record<string, KeyStat>;

const STORAGE_KEY = "typeforge-keystats-v1";

export function loadKeyStats(): KeyStatsMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as KeyStatsMap;
  } catch {
    return {};
  }
}

export function saveKeyStats(map: KeyStatsMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

export function resetKeyStats() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

// Merge a finished test's keystrokes into the stored map.
export function ingestKeystrokes(prev: KeyStatsMap, keystrokes: Keystroke[]): KeyStatsMap {
  const next: KeyStatsMap = { ...prev };
  let lastT = 0;
  for (let i = 0; i < keystrokes.length; i++) {
    const k = keystrokes[i];
    const expected = k.expected;
    if (!expected) {
      lastT = k.t;
      continue;
    }
    const key = expected;
    const s = next[key] ?? { attempts: 0, errors: 0, totalMs: 0, intervals: 0 };
    s.attempts += 1;
    if (!k.correct) s.errors += 1;
    // interval from previous keystroke (cap to ignore long pauses > 2s)
    const interval = k.t - lastT;
    if (i > 0 && interval > 0 && interval < 2000) {
      s.totalMs += interval;
      s.intervals += 1;
    }
    next[key] = s;
    lastT = k.t;
  }
  return next;
}

export interface KeyScore {
  accuracy: number; // 0..1
  avgMs: number | null; // null if no data
  attempts: number;
}

export function scoreForKey(map: KeyStatsMap, key: string): KeyScore | null {
  const s = map[key];
  if (!s || s.attempts === 0) return null;
  return {
    accuracy: (s.attempts - s.errors) / s.attempts,
    avgMs: s.intervals > 0 ? s.totalMs / s.intervals : null,
    attempts: s.attempts,
  };
}
