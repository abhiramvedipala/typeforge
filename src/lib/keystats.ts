// Per-key and per-bigram personal statistics persisted to localStorage.
// Tracks attempts, errors, and avg time-per-keystroke (ms).

import type { Keystroke } from "@/hooks/use-typing-engine";

export interface KeyStat {
  attempts: number;
  errors: number;
  totalMs: number; // sum of inter-keystroke intervals when this key was expected
  intervals: number; // count of intervals contributing to totalMs
}

export type KeyStatsMap = Record<string, KeyStat>;
export type BigramStatsMap = Record<string, KeyStat>;

export interface StatsBundle {
  keys: KeyStatsMap;
  bigrams: BigramStatsMap;
  testCount: number;
}

const STORAGE_KEY = "typeforge-keystats-v1";
const BUNDLE_KEY = "typeforge-stats-v2";

export function loadKeyStats(): KeyStatsMap {
  return loadStats().keys;
}

export function loadStats(): StatsBundle {
  try {
    const raw = localStorage.getItem(BUNDLE_KEY);
    if (raw) return JSON.parse(raw) as StatsBundle;
  } catch {}
  // Migrate from v1 key-only store
  try {
    const v1 = localStorage.getItem(STORAGE_KEY);
    if (v1) {
      return { keys: JSON.parse(v1) as KeyStatsMap, bigrams: {}, testCount: 0 };
    }
  } catch {}
  return { keys: {}, bigrams: {}, testCount: 0 };
}

export function saveStats(bundle: StatsBundle) {
  try {
    localStorage.setItem(BUNDLE_KEY, JSON.stringify(bundle));
    // Keep legacy key for any consumer still using loadKeyStats
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bundle.keys));
  } catch {}
}

export function saveKeyStats(keys: KeyStatsMap) {
  const cur = loadStats();
  saveStats({ ...cur, keys });
}

export function resetStats() {
  try {
    localStorage.removeItem(BUNDLE_KEY);
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

function mergeStat(prev: KeyStat | undefined, correct: boolean, interval: number | null): KeyStat {
  const s = prev ?? { attempts: 0, errors: 0, totalMs: 0, intervals: 0 };
  s.attempts += 1;
  if (!correct) s.errors += 1;
  if (interval != null && interval > 0 && interval < 2000) {
    s.totalMs += interval;
    s.intervals += 1;
  }
  return s;
}

// Merge a finished test's keystrokes into the stored map (keys only, legacy).
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
    const interval = i > 0 ? k.t - lastT : null;
    next[expected] = mergeStat(next[expected], k.correct, interval);
    lastT = k.t;
  }
  return next;
}

// Ingest both keys and bigrams + increment test count.
export function ingestRun(prev: StatsBundle, keystrokes: Keystroke[]): StatsBundle {
  const keys: KeyStatsMap = { ...prev.keys };
  const bigrams: BigramStatsMap = { ...prev.bigrams };
  let lastT = 0;
  let lastExpected: string | undefined;
  let lastCorrect = true;
  for (let i = 0; i < keystrokes.length; i++) {
    const k = keystrokes[i];
    const expected = k.expected;
    if (!expected) {
      lastT = k.t;
      lastExpected = undefined;
      continue;
    }
    const interval = i > 0 ? k.t - lastT : null;
    keys[expected] = mergeStat(keys[expected], k.correct, interval);

    // bigram: previous expected -> current expected, both visible (non-space optional)
    if (lastExpected && /\S/.test(lastExpected) && /\S/.test(expected)) {
      const bg = (lastExpected + expected).toLowerCase();
      const bgCorrect = k.correct && lastCorrect;
      bigrams[bg] = mergeStat(bigrams[bg], bgCorrect, interval);
    }

    lastT = k.t;
    lastExpected = expected;
    lastCorrect = k.correct;
  }
  return { keys, bigrams, testCount: prev.testCount + 1 };
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

// --- Weakness diagnosis ---

export interface Weakness {
  token: string;
  accuracy: number;
  avgMs: number | null;
  attempts: number;
  badness: number; // higher = worse
}

function badness(stat: KeyStat, refMs: number): number {
  const acc = (stat.attempts - stat.errors) / stat.attempts;
  const speed = stat.intervals > 0 ? stat.totalMs / stat.intervals : refMs;
  // normalize speed against reference (refMs ~= median). higher = slower.
  const speedFactor = Math.min(2, speed / Math.max(60, refMs));
  // 70% weight accuracy, 30% speed
  return (1 - acc) * 0.7 + (speedFactor - 0.5) * 0.3;
}

function medianMs(map: KeyStatsMap): number {
  const arr: number[] = [];
  for (const k of Object.keys(map)) {
    const s = map[k];
    if (s.intervals > 0) arr.push(s.totalMs / s.intervals);
  }
  if (!arr.length) return 200;
  arr.sort((a, b) => a - b);
  return arr[Math.floor(arr.length / 2)];
}

export function diagnoseWeaknesses(
  bundle: StatsBundle,
  opts: { keyMinAttempts?: number; bigramMinAttempts?: number; topN?: number } = {},
): { keys: Weakness[]; bigrams: Weakness[] } {
  const { keyMinAttempts = 6, bigramMinAttempts = 3, topN = 5 } = opts;
  const refKey = medianMs(bundle.keys);
  const refBg = medianMs(bundle.bigrams);

  const keys: Weakness[] = [];
  for (const k of Object.keys(bundle.keys)) {
    if (!/^[a-zA-Z]$/.test(k)) continue; // letters only for clarity
    const s = bundle.keys[k];
    if (s.attempts < keyMinAttempts) continue;
    const acc = (s.attempts - s.errors) / s.attempts;
    keys.push({
      token: k,
      accuracy: acc,
      avgMs: s.intervals > 0 ? s.totalMs / s.intervals : null,
      attempts: s.attempts,
      badness: badness(s, refKey),
    });
  }

  const bigrams: Weakness[] = [];
  for (const b of Object.keys(bundle.bigrams)) {
    if (!/^[a-z]{2}$/.test(b)) continue;
    const s = bundle.bigrams[b];
    if (s.attempts < bigramMinAttempts) continue;
    const acc = (s.attempts - s.errors) / s.attempts;
    bigrams.push({
      token: b,
      accuracy: acc,
      avgMs: s.intervals > 0 ? s.totalMs / s.intervals : null,
      attempts: s.attempts,
      badness: badness(s, refBg),
    });
  }

  keys.sort((a, b) => b.badness - a.badness);
  bigrams.sort((a, b) => b.badness - a.badness);
  return { keys: keys.slice(0, topN), bigrams: bigrams.slice(0, topN) };
}

// Snapshot for measuring improvement after a smart drill.
export interface TargetSnapshot {
  keys: Record<string, { accuracy: number; avgMs: number | null; attempts: number }>;
  bigrams: Record<string, { accuracy: number; avgMs: number | null; attempts: number }>;
}

export function snapshotTargets(
  bundle: StatsBundle,
  targetKeys: string[],
  targetBigrams: string[],
): TargetSnapshot {
  const snap: TargetSnapshot = { keys: {}, bigrams: {} };
  for (const k of targetKeys) {
    const s = bundle.keys[k.toLowerCase()];
    snap.keys[k.toLowerCase()] = s
      ? {
          accuracy: (s.attempts - s.errors) / Math.max(1, s.attempts),
          avgMs: s.intervals > 0 ? s.totalMs / s.intervals : null,
          attempts: s.attempts,
        }
      : { accuracy: 1, avgMs: null, attempts: 0 };
  }
  for (const b of targetBigrams) {
    const s = bundle.bigrams[b.toLowerCase()];
    snap.bigrams[b.toLowerCase()] = s
      ? {
          accuracy: (s.attempts - s.errors) / Math.max(1, s.attempts),
          avgMs: s.intervals > 0 ? s.totalMs / s.intervals : null,
          attempts: s.attempts,
        }
      : { accuracy: 1, avgMs: null, attempts: 0 };
  }
  return snap;
}

export interface ImprovementRow {
  token: string;
  prevAcc: number;
  prevMs: number | null;
  runAcc: number;
  runMs: number | null;
  hits: number;
}

// Compute per-target stats from a single run's keystrokes.
export function runStatsForTargets(
  keystrokes: Keystroke[],
  targetKeys: string[],
  targetBigrams: string[],
): { keys: Record<string, ImprovementRow>; bigrams: Record<string, ImprovementRow> } {
  const keyAgg: Record<string, { att: number; err: number; ms: number; iv: number }> = {};
  const bgAgg: Record<string, { att: number; err: number; ms: number; iv: number }> = {};
  const tk = new Set(targetKeys.map((k) => k.toLowerCase()));
  const tb = new Set(targetBigrams.map((b) => b.toLowerCase()));

  let lastT = 0;
  let lastExpected: string | undefined;
  let lastCorrect = true;
  for (let i = 0; i < keystrokes.length; i++) {
    const k = keystrokes[i];
    const exp = k.expected;
    if (!exp) {
      lastT = k.t;
      lastExpected = undefined;
      continue;
    }
    const interval = i > 0 ? k.t - lastT : 0;
    const expLower = exp.toLowerCase();
    if (tk.has(expLower)) {
      const a = (keyAgg[expLower] ??= { att: 0, err: 0, ms: 0, iv: 0 });
      a.att++;
      if (!k.correct) a.err++;
      if (interval > 0 && interval < 2000) {
        a.ms += interval;
        a.iv++;
      }
    }
    if (lastExpected && /\S/.test(lastExpected) && /\S/.test(exp)) {
      const bg = (lastExpected + exp).toLowerCase();
      if (tb.has(bg)) {
        const a = (bgAgg[bg] ??= { att: 0, err: 0, ms: 0, iv: 0 });
        a.att++;
        if (!k.correct || !lastCorrect) a.err++;
        if (interval > 0 && interval < 2000) {
          a.ms += interval;
          a.iv++;
        }
      }
    }
    lastT = k.t;
    lastExpected = exp;
    lastCorrect = k.correct;
  }

  const keys: Record<string, ImprovementRow> = {};
  for (const t of targetKeys) {
    const lo = t.toLowerCase();
    const a = keyAgg[lo];
    keys[lo] = {
      token: lo,
      prevAcc: 0,
      prevMs: null,
      runAcc: a ? (a.att - a.err) / Math.max(1, a.att) : 0,
      runMs: a && a.iv > 0 ? a.ms / a.iv : null,
      hits: a?.att ?? 0,
    };
  }
  const bigrams: Record<string, ImprovementRow> = {};
  for (const t of targetBigrams) {
    const lo = t.toLowerCase();
    const a = bgAgg[lo];
    bigrams[lo] = {
      token: lo,
      prevAcc: 0,
      prevMs: null,
      runAcc: a ? (a.att - a.err) / Math.max(1, a.att) : 0,
      runMs: a && a.iv > 0 ? a.ms / a.iv : null,
      hits: a?.att ?? 0,
    };
  }
  return { keys, bigrams };
}
