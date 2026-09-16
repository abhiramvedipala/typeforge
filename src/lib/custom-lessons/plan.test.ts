import { describe, expect, it } from "vitest";
import { planForTrack } from "./plan";
import type { CustomTrack } from "./tracks";

const NOW = Date.parse("2026-01-10T00:00:00Z");

function track(over: Partial<CustomTrack> = {}): CustomTrack {
  return {
    id: "t1",
    title: "home row",
    charset: "asdf",
    seedPrompt: "",
    currentLevel: "easy",
    stars: 0,
    streak: 0,
    attempts: [],
    createdAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("planForTrack", () => {
  it("plans every level for a fresh track", () => {
    const p = planForTrack(track(), { now: NOW });
    expect(p.levels.map((l) => l.status)).toEqual(["current", "upcoming", "upcoming"]);
    expect(p.levels.every((l) => l.passesLeft === 2)).toBe(true);
    expect(p.drillsLeft).toBe(12); // 2 passes / 0.5 pass rate, three levels
    expect(p.finishBy).toBe("2026-01-13"); // 12 drills at 4/day
  });

  it("counts cleared levels as done and shrinks the current one by the streak", () => {
    const p = planForTrack(track({ currentLevel: "medium", streak: 1, stars: 6 }), { now: NOW });
    expect(p.levels[0].status).toBe("done");
    expect(p.levels[0].drillsLeft).toBe(0);
    expect(p.levels[1].passesLeft).toBe(1);
    expect(p.drillsLeft).toBe(6);
  });

  it("reports nothing left once the track is complete", () => {
    const p = planForTrack(track({ currentLevel: "hard", stars: 15 }), { now: NOW });
    expect(p.completed).toBe(true);
    expect(p.drillsLeft).toBe(0);
    expect(p.finishBy).toBeNull();
  });

  it("scales estimates with the measured pass rate and pace", () => {
    const attempts = Array.from({ length: 6 }, (_, i) => ({
      wpm: 30,
      accuracy: 96,
      errorsByKey: {},
      passed: i % 3 === 0,
      createdAt: new Date(NOW - (6 - i) * 86_400_000).toISOString(),
    }));
    const p = planForTrack(track({ attempts }), { now: NOW });
    expect(p.passRate).toBeCloseTo(1 / 3, 5);
    expect(p.drillsPerDay).toBeGreaterThan(0.5);
    expect(p.levels[0].drillsLeft).toBe(6); // 2 passes at a 1-in-3 pass rate
  });

  it("raises pass bars with the user's real speed", () => {
    const p = planForTrack(track(), { now: NOW, avgWpm: 80 });
    expect(p.levels[0].gate.wpm).toBe(72);
  });
});
