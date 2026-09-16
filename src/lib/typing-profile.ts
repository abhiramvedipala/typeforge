// A rolling record of the user's recent finished-run speeds, used to scale
// lesson pass gates to real typing ability instead of fixed numbers.

const KEY = "typeforge:recent-wpm-v1";
const MAX_SAMPLES = 30;

export function loadWpmSamples(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n) && n > 0 && n < 400)
      .slice(-MAX_SAMPLES);
  } catch {
    return [];
  }
}

export function recordWpm(wpm: number): void {
  if (typeof window === "undefined") return;
  if (!Number.isFinite(wpm) || wpm <= 0) return;
  try {
    const next = [...loadWpmSamples(), Math.round(wpm)].slice(-MAX_SAMPLES);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // best-effort
  }
}

/** Average of recent runs; 0 when there isn't enough history to trust. */
export function averageWpm(minSamples = 3): number {
  const s = loadWpmSamples();
  if (s.length < minSamples) return 0;
  return s.reduce((a, b) => a + b, 0) / s.length;
}
