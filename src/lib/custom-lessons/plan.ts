// Turns a custom track's history into a simple plan: how many drills are left
// in each level, and roughly when each tier should be finished at the user's
// current pace.

import { DIFFICULTIES, PASSES_TO_ADVANCE, passGate, type Difficulty } from "./difficulty";
import type { CustomTrack } from "./tracks";

export interface LevelPlan {
  level: Difficulty;
  status: "done" | "current" | "upcoming";
  /** Passing drills still needed at this level. */
  passesLeft: number;
  /** Expected drills (including failed ones) at the user's pass rate. */
  drillsLeft: number;
  gate: { wpm: number; accuracy: number };
  /** ISO date (yyyy-mm-dd) this tier should be cleared by, at current pace. */
  finishBy: string | null;
}

export interface TrackPlan {
  track: CustomTrack;
  levels: LevelPlan[];
  drillsLeft: number;
  /** Passing drills per day, measured from recent history. */
  drillsPerDay: number;
  passRate: number;
  finishBy: string | null;
  completed: boolean;
}

const DEFAULT_PASS_RATE = 0.5;
const DEFAULT_DRILLS_PER_DAY = 4;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Share of attempts that passed, floored so estimates stay finite. */
export function passRateFor(track: CustomTrack): number {
  const recent = track.attempts.slice(-15);
  if (recent.length < 3) return DEFAULT_PASS_RATE;
  const passes = recent.filter((a) => a.passed).length;
  return Math.min(1, Math.max(0.2, passes / recent.length));
}

/** Drills per day, measured across the span of recent attempts. */
export function drillsPerDayFor(track: CustomTrack, now = Date.now()): number {
  const recent = track.attempts.slice(-20);
  if (recent.length < 3) return DEFAULT_DRILLS_PER_DAY;
  const first = Date.parse(recent[0].createdAt);
  if (!Number.isFinite(first)) return DEFAULT_DRILLS_PER_DAY;
  const days = Math.max(0.5, (now - first) / 86_400_000);
  return Math.min(30, Math.max(0.5, recent.length / days));
}

export function planForTrack(
  track: CustomTrack,
  opts: { avgWpm?: number; now?: number } = {},
): TrackPlan {
  const now = opts.now ?? Date.now();
  const avgWpm = opts.avgWpm ?? 0;
  const passRate = passRateFor(track);
  const drillsPerDay = drillsPerDayFor(track, now);
  const currentIndex = DIFFICULTIES.indexOf(track.currentLevel);
  const completed = track.stars >= DIFFICULTIES.length * 5;

  let cumulativeDrills = 0;
  const levels: LevelPlan[] = DIFFICULTIES.map((level, i) => {
    const status: LevelPlan["status"] =
      completed || i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming";
    const passesLeft =
      status === "done" ? 0 : status === "current" ? Math.max(0, PASSES_TO_ADVANCE - track.streak) : PASSES_TO_ADVANCE;
    const drillsLeft = passesLeft === 0 ? 0 : Math.ceil(passesLeft / passRate);
    cumulativeDrills += drillsLeft;
    const finishBy =
      drillsLeft === 0
        ? null
        : isoDate(new Date(now + (cumulativeDrills / drillsPerDay) * 86_400_000));
    return { level, status, passesLeft, drillsLeft, gate: passGate(level, avgWpm), finishBy };
  });

  const withDates = levels.filter((l) => l.finishBy);
  return {
    track,
    levels,
    drillsLeft: cumulativeDrills,
    drillsPerDay,
    passRate,
    finishBy: withDates.length > 0 ? withDates[withDates.length - 1].finishBy : null,
    completed,
  };
}
