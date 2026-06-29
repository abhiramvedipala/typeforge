// Persist the user's best run per mode for ghost-replay & PR detection.

import type { Keystroke } from "@/hooks/use-typing-engine";
import type { Mode, TimeOption, WordsOption } from "@/components/typing/types";

export interface BestRun {
  wpm: number;
  accuracy: number;
  elapsed: number;
  keystrokes: Keystroke[];
  text: string;
  recordedAt: number;
}

const STORAGE_KEY = "typeforge-bests-v1";

export function ghostKey(mode: Mode, time: TimeOption, words: WordsOption): string {
  if (mode === "time") return `time-${time}`;
  if (mode === "words") return `words-${words}`;
  return mode;
}

type Store = Record<string, BestRun>;

function load(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function save(s: Store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

export function getBest(key: string): BestRun | null {
  return load()[key] ?? null;
}

export function setBest(key: string, run: BestRun) {
  const s = load();
  s[key] = run;
  save(s);
}

// Returns true if `wpm` beats the stored best (or no stored best yet).
export function isPersonalRecord(key: string, wpm: number): boolean {
  const cur = getBest(key);
  return !cur || wpm > cur.wpm;
}

// Compute the ghost's input index at a given ms-since-start.
// Returns the count of correct-or-not keystrokes whose timestamp <= t.
export function ghostIndexAt(keystrokes: Keystroke[], elapsedMs: number): number {
  if (!keystrokes.length) return 0;
  // binary search for last keystroke with t <= elapsedMs
  let lo = 0;
  let hi = keystrokes.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (keystrokes[mid].t <= elapsedMs) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  // ans is index of last keystroke; idx field is position-at-time, so position after = ans+1 if forward,
  // but to account for backspaces we should compute net input length. Approximation: use keystroke idx + 1.
  if (ans === -1) return 0;
  return keystrokes[ans].idx + (keystrokes[ans].correct ? 1 : 1);
}
