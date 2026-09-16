import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { useTypingEngine, type TypingResult } from "@/hooks/use-typing-engine";
import { TypingDisplay } from "@/components/typing/TypingDisplay";
import { LiveStats } from "@/components/typing/LiveStats";
import { generateDrill, type GeneratedDrill } from "@/lib/custom-lessons/generate";
import { generateLessonWords } from "@/lib/custom-lessons/generate-lesson.functions";
import { MAX_TRACK_STARS, PASSES_TO_ADVANCE, passGate } from "@/lib/custom-lessons/difficulty";
import {
  getTrack,
  recordAttempt,
  weakKeysForTrack,
  type CustomTrack,
} from "@/lib/custom-lessons/tracks";
import { loadSoundProfile, playKeySound } from "@/lib/sounds";
import { pushAttempt, pushTrack, syncTracks } from "@/lib/custom-lessons/cloud";
import { useAuth } from "@/hooks/use-auth";
import { ingestRun, loadStats, saveStats, weakKeysWeighted } from "@/lib/keystats";
import { debounced, saveCloudStats } from "@/lib/cloud-sync";
import { averageWpm, recordWpm } from "@/lib/typing-profile";

export const Route = createFileRoute("/lessons/custom/$trackId")({
  component: CustomTrackPage,
});

interface Outcome {
  wpm: number;
  accuracy: number;
  passed: boolean;
  leveledUp: boolean;
  completed: boolean;
  errorsByKey: Record<string, number>;
  gate: { wpm: number; accuracy: number };
}

function CustomTrackPage() {
  const { trackId } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [track, setTrack] = useState<CustomTrack | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [drill, setDrill] = useState<GeneratedDrill | null>(null);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [tick, setTick] = useState(0);
  const [myAvgWpm, setMyAvgWpm] = useState(0);
  const trackRef = useRef<CustomTrack | null>(null);
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = user?.id ?? null;

  useEffect(() => {
    setMyAvgWpm(averageWpm());
  }, [outcome]);

  useEffect(() => {
    if (authLoading) return;
    let alive = true;
    const resolve = async () => {
      let t = getTrack(trackId) ?? null;
      if (!t && user) {
        const merged = await syncTracks(user.id);
        t = merged.find((x) => x.id === trackId) ?? null;
      }
      if (!alive) return;
      setTrack(t);
      trackRef.current = t;
      setLoaded(true);
      if (!t) navigate({ to: "/lessons" });
    };
    void resolve();
    return () => {
      alive = false;
    };
  }, [trackId, navigate, user, authLoading]);

  const makeDrill = useCallback(async (t: CustomTrack) => {
    setGenerating(true);
    setNotice(null);
    setOutcome(null);
    // This track's own misses first, then the global heatmap's slowest keys —
    // both filtered to the track's charset.
    let globalWeak: string[] = [];
    try {
      globalWeak = weakKeysWeighted(loadStats(), 8).filter((k) => t.charset.includes(k));
    } catch {
      globalWeak = [];
    }
    const weak = Array.from(new Set([...weakKeysForTrack(t), ...globalWeak])).slice(0, 8);
    try {
      const d = await generateDrill({
        charset: t.charset,
        difficulty: t.currentLevel,
        weakKeys: weak,
        seedPrompt: t.seedPrompt,
        ai: async (req) => {
          const res = await generateLessonWords({ data: req });
          return {
            words: res.words ?? [],
            rateLimited: "rateLimited" in res ? Boolean(res.rateLimited) : false,
          };
        },
      });
      setDrill(d);
      setTick((n) => n + 1);
      if (d.words.length === 0) {
        setNotice("couldn't build a drill for that key set");
      } else if (d.aiFallbackReason === "rate-limited") {
        setNotice("lots of AI drills generated recently — using the built-in word list for now");
      } else if (d.aiFallbackReason) {
        setNotice("ai text wasn't usable for these keys — built the drill from the dictionary");
      }
    } catch {
      setNotice("generation hiccuped — using the built-in word list");
      const d = await generateDrill({
        charset: t.charset,
        difficulty: t.currentLevel,
      });
      setDrill(d);
      setTick((n) => n + 1);
    } finally {
      setGenerating(false);
    }
  }, []);

  useEffect(() => {
    if (track && !drill) void makeDrill(track);
  }, [track, drill, makeDrill]);

  const text = drill?.words.join(" ") ?? "";

  const onComplete = useCallback(
    (result: TypingResult) => {
      const t = trackRef.current;
      if (!t) return;
      const errorsByKey: Record<string, number> = {};
      for (const k of result.keystrokes) {
        if (k.correct) continue;
        const key = (k.expected ?? k.key).toLowerCase();
        errorsByKey[key] = (errorsByKey[key] ?? 0) + 1;
      }
      // Feed this drill into the shared heatmap so lesson practice shapes the
      // practice-mode keyboard and smart drills too.
      let mergedStats: ReturnType<typeof ingestRun> | null = null;
      try {
        mergedStats = ingestRun(loadStats(), result.keystrokes);
        saveStats(mergedStats);
      } catch {
        mergedStats = null;
      }
      recordWpm(result.wpm);

      const trackAvg =
        t.attempts.length > 0
          ? t.attempts.reduce((s, a) => s + a.wpm, 0) / t.attempts.length
          : 0;
      // Gates scale to real ability: whichever is higher, this track's pace or
      // the user's overall recent speed.
      const avgWpm = Math.max(trackAvg, averageWpm());
      const gate = passGate(t.currentLevel, avgWpm);
      const res = recordAttempt(
        t.id,
        { wpm: result.wpm, accuracy: result.accuracy, errorsByKey },
        avgWpm,
      );
      if (!res) return;
      setTrack(res.track);
      trackRef.current = res.track;
      const uid = userIdRef.current;
      if (uid) {
        const last = res.track.attempts[res.track.attempts.length - 1];
        void pushTrack(uid, res.track);
        if (last) void pushAttempt(uid, res.track.id, t.currentLevel, last);
        if (mergedStats) {
          const snapshot = mergedStats;
          debounced(`stats-${uid}`, 800, () => {
            saveCloudStats(uid, snapshot).catch(() => {});
          });
        }
      }
      setOutcome({
        wpm: result.wpm,
        accuracy: result.accuracy,
        passed: res.passed,
        leveledUp: res.leveledUp,
        completed: res.completed,
        errorsByKey,
        gate,
      });
      if (res.leveledUp || res.completed) {
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
      }
    },
    [],
  );

  const engine = useTypingEngine({
    text,
    onComplete,
    onKeystroke: (k) => playKeySound(loadSoundProfile(), !k.correct),
  });

  const again = useCallback(() => {
    const t = trackRef.current;
    engine.reset();
    if (t) void makeDrill(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [makeDrill]);

  if (!loaded || !track) return null;

  const missed = outcome
    ? Object.entries(outcome.errorsByKey).sort((a, b) => b[1] - a[1]).slice(0, 6)
    : [];

  return (
    <div className="flex-1 flex flex-col items-center gap-6 py-6">
      <div className="text-center">
        <div className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--type-muted)]">
          my lesson · {track.currentLevel} · {track.streak}/{PASSES_TO_ADVANCE} passes
        </div>
        <h1 className="font-mono text-xl text-[color:var(--type-text)] mt-1">{track.title}</h1>
        <p className="text-xs font-mono text-[color:var(--type-muted)] mt-1">
          {track.charset.split("").join(" ")}
        </p>
        <p className="text-[11px] font-mono text-[color:var(--type-muted)] mt-1">
          pass: {passGate(track.currentLevel).wpm} wpm · {passGate(track.currentLevel).accuracy}%
          accuracy
        </p>
      </div>

      {notice && (
        <p className="text-[11px] font-mono text-[color:var(--type-muted)]">{notice}</p>
      )}

      {!outcome && (
        <>
          <div className="h-10 flex items-center gap-4">
            {engine.started && !engine.finished && (
              <LiveStats
                wpm={engine.live.wpm}
                accuracy={engine.live.accuracy}
                timer={`${(engine.elapsedMs / 1000).toFixed(1)}s`}
              />
            )}
          </div>

          {generating ? (
            <p className="text-xs font-mono text-[color:var(--type-muted)]">building your drill…</p>
          ) : (
            <TypingDisplay key={tick} text={text} input={engine.input} ghostIdx={null} />
          )}

          <button
            type="button"
            onClick={again}
            className="text-xs font-mono px-3 py-1.5 rounded border border-[color:var(--type-border)] text-[color:var(--type-muted)] hover:text-[color:var(--type-text)] transition"
          >
            new drill
          </button>
        </>
      )}

      {outcome && (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="font-mono text-3xl text-[color:var(--type-accent)]">
            {outcome.wpm} wpm
          </div>
          <div className="font-mono text-sm text-[color:var(--type-text)]">
            {outcome.accuracy}% accuracy
          </div>
          <div
            className={`font-mono text-xs uppercase tracking-wider ${
              outcome.passed ? "text-[color:var(--type-accent)]" : "text-[color:var(--type-muted)]"
            }`}
          >
            {outcome.completed
              ? "track complete — all levels cleared"
              : outcome.leveledUp
                ? `level up → ${track.currentLevel}`
                : outcome.passed
                  ? `passed · ${track.streak}/${PASSES_TO_ADVANCE} in a row`
                  : `needs ${outcome.gate.wpm} wpm and ${outcome.gate.accuracy}% accuracy`}
          </div>

          {missed.length > 0 && (
            <div className="text-[11px] font-mono text-[color:var(--type-muted)]">
              missed keys: {missed.map(([k, n]) => `${k}×${n}`).join("  ")}
            </div>
          )}

          <div className="text-[11px] font-mono text-[color:var(--type-muted)]">
            {track.stars} / {MAX_TRACK_STARS} stars
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={again}
              className="text-xs font-mono px-3 py-1.5 rounded border border-[color:var(--type-accent)] text-[color:var(--type-accent)] hover:bg-[color:var(--type-accent)] hover:text-[color:var(--type-bg)] transition"
            >
              {outcome.passed ? "next drill" : "try again"}
            </button>
            <button
              type="button"
              onClick={() => navigate({ to: "/lessons" })}
              className="text-xs font-mono px-3 py-1.5 rounded border border-[color:var(--type-border)] text-[color:var(--type-muted)] hover:text-[color:var(--type-text)] transition"
            >
              back to lessons
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
