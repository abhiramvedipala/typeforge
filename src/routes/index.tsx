import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast, Toaster } from "sonner";
import { useTypingEngine, type Keystroke, type TypingResult } from "@/hooks/use-typing-engine";
import { TypingDisplay } from "@/components/typing/TypingDisplay";
import { Results } from "@/components/typing/Results";
import { ThemeSwitcher, applyTheme, type ThemeId } from "@/components/typing/ThemeSwitcher";
import { ModeBar } from "@/components/typing/ModeBar";
import { AIPrompt } from "@/components/typing/AIPrompt";
import { DrillSelector } from "@/components/typing/DrillSelector";
import { CustomTextInput } from "@/components/typing/CustomTextInput";
import { LiveStats } from "@/components/typing/LiveStats";
import { Keyboard } from "@/components/typing/Keyboard";
import { HeatmapSettings } from "@/components/typing/HeatmapSettings";
import { SoundToggle, useSoundProfile } from "@/components/typing/SoundToggle";
import { SmartDrill } from "@/components/typing/SmartDrill";
import { AccountMenu } from "@/components/typing/AccountMenu";
import { useAuth } from "@/hooks/use-auth";
import {
  DEFAULT_HEATMAP_SETTINGS,
  loadHeatmapSettings,
  saveHeatmapSettings,
  type HeatmapSettings as HeatmapSettingsType,
} from "@/lib/heatmap-settings";
import { drillWords, randomQuote, randomWords } from "@/lib/words";
import {
  ingestRun,
  loadStats,
  resetStats,
  saveStats,
  type StatsBundle,
  type TargetSnapshot,
} from "@/lib/keystats";
import { playKeySound, saveSoundProfile } from "@/lib/sounds";
import {
  getBest,
  ghostIndexAt,
  ghostKey,
  isPersonalRecord,
  setBest,
  type BestRun,
} from "@/lib/ghost";
import {
  debounced,
  fetchCloudSettings,
  fetchCloudStats,
  insertTestHistory,
  mergeStats,
  saveCloudSettings,
  saveCloudStats,
} from "@/lib/cloud-sync";
import type { Mode, TimeOption, WordsOption } from "@/components/typing/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TypeForge — minimal typing practice" },
      {
        name: "description",
        content:
          "A minimal, distraction-free typing trainer. Time, words, quote and zen modes, plus AI-generated practice text, per-key drills, live keyboard heatmap and ghost replay.",
      },
      { property: "og:title", content: "TypeForge — minimal typing practice" },
      {
        property: "og:description",
        content:
          "AI-generated practice text, per-key drills, live keyboard heatmap and race-your-ghost replay.",
      },
      { property: "og:image", content: "/og-image.png" },
      { name: "twitter:image", content: "/og-image.png" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Index,
});

const GHOST_TOGGLE_KEY = "typeforge-ghost-enabled-v1";
const HINT_DISMISSED_KEY = "typeforge-hint-dismissed-v1";


function Index() {
  const [mode, setMode] = useState<Mode>("time");
  const [timeValue, setTimeValue] = useState<TimeOption>(30);
  const [wordsValue, setWordsValue] = useState<WordsOption>(25);
  const [drillLetters, setDrillLetters] = useState<string[]>([]);
  const [text, setText] = useState<string>("");
  const [result, setResult] = useState<TypingResult | null>(null);
  const [restartTick, setRestartTick] = useState(0);

  const [stats, setStats] = useState<StatsBundle>({ keys: {}, bigrams: {}, testCount: 0 });
  const [soundProfile, setSoundProfile] = useSoundProfile();
  const [ghostEnabled, setGhostEnabled] = useState(false);
  const [bestForMode, setBestForMode] = useState<BestRun | null>(null);
  const [prResult, setPrResult] = useState<{ isPR: boolean; prevBest: number | null }>({
    isPR: false,
    prevBest: null,
  });
  const [ghostIdx, setGhostIdx] = useState<number | null>(null);
  const [smartTargets, setSmartTargets] =
    useState<{ keys: string[]; bigrams: string[]; snapshot: TargetSnapshot } | null>(null);
  const activeSmartTargetsRef = useRef<{ keys: string[]; bigrams: string[]; snapshot: TargetSnapshot } | null>(null);
  const [heatmapSettings, setHeatmapSettings] = useState<HeatmapSettingsType>(DEFAULT_HEATMAP_SETTINGS);
  const [showHint, setShowHint] = useState(false);


  const { user, loading: authLoading } = useAuth();
  const userIdRef = useRef<string | null>(null);
  const hydratedFromCloudRef = useRef(false);

  // Hydrate persisted state (localStorage — used always for guests, and as initial for signed-in until cloud loads)
  useEffect(() => {
    setStats(loadStats());
    setHeatmapSettings(loadHeatmapSettings());
    try {
      const v = localStorage.getItem(GHOST_TOGGLE_KEY);
      if (v === "1") setGhostEnabled(true);
      if (localStorage.getItem(HINT_DISMISSED_KEY) !== "1") setShowHint(true);
    } catch {}
  }, []);


  // Cloud hydrate on sign-in / clear on sign-out
  useEffect(() => {
    const uid = user?.id ?? null;
    const prevUid = userIdRef.current;
    userIdRef.current = uid;
    if (!uid) {
      hydratedFromCloudRef.current = false;
      return;
    }
    if (prevUid === uid && hydratedFromCloudRef.current) return;
    (async () => {
      try {
        const [cloudStats, cloudSettings] = await Promise.all([
          fetchCloudStats(uid),
          fetchCloudSettings(uid),
        ]);
        const localStats = loadStats();
        let finalStats: StatsBundle;
        if (cloudStats) {
          const hasLocal = localStats.testCount > 0 || Object.keys(localStats.keys).length > 0;
          const alreadyMerged = localStorage.getItem(`typeforge-merged-${uid}`) === "1";
          if (hasLocal && !alreadyMerged) {
            if (window.confirm("Merge your guest typing stats into your account?")) {
              finalStats = mergeStats(cloudStats, localStats);
              await saveCloudStats(uid, finalStats);
              toast.success("guest stats merged");
            } else {
              finalStats = cloudStats;
            }
            localStorage.setItem(`typeforge-merged-${uid}`, "1");
          } else {
            finalStats = cloudStats;
          }
        } else {
          // First-time cloud user — seed with whatever local has
          finalStats = localStats;
          if (localStats.testCount > 0 || Object.keys(localStats.keys).length > 0) {
            await saveCloudStats(uid, finalStats);
          }
        }
        setStats(finalStats);
        saveStats(finalStats);

        if (cloudSettings) {
          if (cloudSettings.theme) applyTheme(cloudSettings.theme as ThemeId);
          if (cloudSettings.sound_profile) {
            setSoundProfile(cloudSettings.sound_profile as ReturnType<typeof useSoundProfile>[0]);
            saveSoundProfile(cloudSettings.sound_profile as ReturnType<typeof useSoundProfile>[0]);
          }
          if (
            cloudSettings.heatmap_red != null &&
            cloudSettings.heatmap_yellow != null &&
            cloudSettings.heatmap_accuracy_weight != null
          ) {
            const hs: HeatmapSettingsType = {
              redThreshold: Number(cloudSettings.heatmap_red),
              yellowThreshold: Number(cloudSettings.heatmap_yellow),
              accuracyWeight: Number(cloudSettings.heatmap_accuracy_weight),
            };
            setHeatmapSettings(hs);
            saveHeatmapSettings(hs);
          }
          if (typeof cloudSettings.ghost_enabled === "boolean") {
            setGhostEnabled(cloudSettings.ghost_enabled);
          }
        }
        hydratedFromCloudRef.current = true;
      } catch (e) {
        console.error("cloud sync failed", e);
        toast.error("couldn't sync from cloud");
      }
    })();
  }, [user, setSoundProfile]);

  // Debounced settings sync when signed in
  useEffect(() => {
    const uid = userIdRef.current;
    if (!uid || !hydratedFromCloudRef.current) return;
    const theme =
      typeof document !== "undefined"
        ? (Array.from(document.documentElement.classList)
            .find((c) => c.startsWith("theme-"))
            ?.replace("theme-", "") ?? null)
        : null;
    debounced(`settings-${uid}`, 600, () => {
      saveCloudSettings(uid, {
        theme,
        sound_profile: soundProfile,
        heatmap_red: heatmapSettings.redThreshold,
        heatmap_yellow: heatmapSettings.yellowThreshold,
        heatmap_accuracy_weight: heatmapSettings.accuracyWeight,
        ghost_enabled: ghostEnabled,
      }).catch(() => {});
    });
  }, [soundProfile, heatmapSettings, ghostEnabled, user]);


  useEffect(() => {
    setBestForMode(getBest(ghostKey(mode, timeValue, wordsValue)));
  }, [mode, timeValue, wordsValue, result]);

  // Build text from mode
  const newText = useCallback(() => {
    setResult(null);
    setPrResult({ isPR: false, prevBest: null });
    setRestartTick((n) => n + 1);
    if (mode === "time") setText(randomWords(80).join(" "));
    else if (mode === "words") setText(randomWords(wordsValue).join(" "));
    else if (mode === "quote") setText(randomQuote());
    else if (mode === "zen") setText(randomWords(200).join(" "));
    else if (mode === "drill")
      setText(drillWords(drillLetters.length ? drillLetters : ["a", "s", "d", "f"], 40).join(" "));
    else if (mode === "smart" || mode === "ai" || mode === "custom") {
      // Clear so the input/picker UI shows; user generates next text manually.
      setText("");
      activeSmartTargetsRef.current = null;
      setSmartTargets(null);
    }
  }, [mode, wordsValue, drillLetters]);

  useEffect(() => {
    if (mode === "ai" || mode === "custom" || mode === "smart") return;
    activeSmartTargetsRef.current = null;
    setSmartTargets(null);
    newText();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, timeValue, wordsValue]);

  const profileRef = useRef(soundProfile);
  useEffect(() => {
    profileRef.current = soundProfile;
  }, [soundProfile]);

  const onKeystroke = useCallback((k: Keystroke) => {
    playKeySound(profileRef.current, !k.correct);
  }, []);

  const onComplete = useCallback(
    (r: TypingResult) => {
      setResult(r);
      // Ingest per-key + bigram stats
      let mergedStats: StatsBundle | null = null;
      setStats((prev) => {
        const merged = ingestRun(prev, r.keystrokes);
        saveStats(merged);
        mergedStats = merged;
        return merged;
      });

      // Cloud sync when signed in
      const uid = userIdRef.current;
      if (uid) {
        if (mergedStats) {
          const snapshot = mergedStats;
          debounced(`stats-${uid}`, 800, () => {
            saveCloudStats(uid, snapshot).catch(() => {});
          });
        }
        insertTestHistory(uid, mode, r).catch(() => {});
      }

      // Snapshot of smart-drill targets recorded at generation time
      setSmartTargets(activeSmartTargetsRef.current);

      // PR check (use minimum length so flukes don't count)
      const key = ghostKey(mode, timeValue, wordsValue);
      const cur = getBest(key);
      const prev = cur?.wpm ?? null;
      const pr = isPersonalRecord(key, r.wpm) && r.correctChars >= 20;
      if (pr) {
        setBest(key, {
          wpm: r.wpm,
          accuracy: r.accuracy,
          elapsed: r.elapsed,
          keystrokes: r.keystrokes,
          text: r.text,
          recordedAt: Date.now(),
        });
      }
      setPrResult({ isPR: pr, prevBest: prev });
    },
    [mode, timeValue, wordsValue],
  );

  const engine = useTypingEngine({
    text,
    timeLimit: mode === "time" ? timeValue : undefined,
    zen: mode === "zen",
    onComplete,
    onKeystroke,
  });

  // Ghost-replay live caret index (only when enabled, started, not finished, and best exists)
  useEffect(() => {
    if (!ghostEnabled || !bestForMode || !engine.started || engine.finished) {
      setGhostIdx(null);
      return;
    }
    let raf = 0;
    const tick = () => {
      setGhostIdx(ghostIndexAt(bestForMode.keystrokes, engine.elapsedMs));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ghostEnabled, bestForMode, engine.started, engine.finished, engine.elapsedMs]);

  const restart = useCallback(() => {
    setResult(null);
    setPrResult({ isPR: false, prevBest: null });
    newText();
  }, [newText]);

  const restartSame = useCallback(() => {
    setResult(null);
    setPrResult({ isPR: false, prevBest: null });
    const cur = text;
    setText("");
    setTimeout(() => setText(cur), 0);
  }, [text]);

  useEffect(() => {
    let tabHeld = false;
    function down(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inField =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (inField) return;
      if (e.key === "Tab") {
        e.preventDefault();
        tabHeld = true;
      }
      if (e.key === "Enter" && tabHeld) {
        e.preventDefault();
        restart();
      }
      if (e.key === "Escape" && engine.started && !engine.finished && mode === "zen") {
        engine.finishTest();
      }
    }
    function up(e: KeyboardEvent) {
      if (e.key === "Tab") tabHeld = false;
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [restart, engine, mode]);

  const timerDisplay = useMemo(() => {
    if (mode === "time") {
      const remaining = Math.max(0, timeValue - engine.elapsedMs / 1000);
      return `${remaining.toFixed(1)}s`;
    }
    return `${(engine.elapsedMs / 1000).toFixed(1)}s`;
  }, [engine.elapsedMs, mode, timeValue]);

  const needsTextInput = (mode === "ai" || mode === "custom" || mode === "smart") && !text;

  const toggleGhost = () => {
    setGhostEnabled((g) => {
      const next = !g;
      try {
        localStorage.setItem(GHOST_TOGGLE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[color:var(--type-bg)] text-[color:var(--type-text)] flex flex-col">
      <Toaster position="top-center" />
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 sm:px-6 py-4 max-w-6xl mx-auto w-full">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-mono text-xl font-bold text-[color:var(--type-accent)]">
            type<span className="text-[color:var(--type-text)]">forge</span>
          </span>
          <span className="text-xs text-[color:var(--type-muted)] hidden sm:inline">
            // typing practice
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-end">
          <SoundToggle value={soundProfile} onChange={setSoundProfile} />
          <ThemeSwitcher />
          <AccountMenu user={user} loading={authLoading} />
        </div>
      </header>

      {showHint && !result && (
        <div
          role="status"
          className="mx-auto w-full max-w-6xl px-4 sm:px-6"
        >
          <div className="flex items-center justify-between gap-3 rounded-md border border-[color:var(--type-border)] bg-[color:var(--type-surface)]/60 px-3 py-1.5 font-mono text-[11px] text-[color:var(--type-muted)]">
            <span className="truncate">
              tip · just start typing to begin ·{" "}
              <span className="text-[color:var(--type-text)]">tab</span> +{" "}
              <span className="text-[color:var(--type-text)]">enter</span> to restart
            </span>
            <button
              onClick={() => {
                setShowHint(false);
                try {
                  localStorage.setItem(HINT_DISMISSED_KEY, "1");
                } catch {}
              }}
              aria-label="Dismiss hint"
              className="shrink-0 text-[color:var(--type-muted)] hover:text-[color:var(--type-accent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--type-accent)] rounded px-1"
            >
              ×
            </button>
          </div>
        </div>
      )}


      <main className="flex-1 flex flex-col items-center justify-center px-4 gap-6 w-full">
        {!result && (
          <>
            <ModeBar
              mode={mode}
              setMode={setMode}
              timeValue={timeValue}
              setTimeValue={setTimeValue}
              wordsValue={wordsValue}
              setWordsValue={setWordsValue}
            />

            {mode === "ai" && (
              <AIPrompt
                onText={(t) => {
                  setText(t);
                  setResult(null);
                }}
              />
            )}
            {mode === "custom" && (
              <CustomTextInput
                onText={(t) => {
                  setText(t);
                  setResult(null);
                }}
              />
            )}
            {mode === "drill" && (
              <DrillSelector
                selected={drillLetters}
                onChange={(l) => {
                  setDrillLetters(l);
                  if (l.length) setText(drillWords(l, 40).join(" "));
                }}
                onGenerate={newText}
              />
            )}
            {mode === "smart" && (
              <SmartDrill
                stats={stats}
                onText={(t, targets) => {
                  activeSmartTargetsRef.current = targets;
                  setSmartTargets(null);
                  setText(t);
                  setResult(null);
                  setRestartTick((n) => n + 1);
                }}
              />
            )}

            {/* Ghost-race toggle */}
            <div className="flex items-center gap-4 text-xs font-mono">
              <button
                onClick={toggleGhost}
                disabled={!bestForMode}
                title={
                  bestForMode
                    ? `Race your best ${bestForMode.wpm} wpm`
                    : "Finish a run first to record a ghost"
                }
                className={`px-3 py-1 rounded border transition ${
                  ghostEnabled && bestForMode
                    ? "border-[color:var(--type-accent)] text-[color:var(--type-accent)]"
                    : "border-[color:var(--type-border)] text-[color:var(--type-muted)] hover:text-[color:var(--type-text)]"
                } ${!bestForMode ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                {ghostEnabled && bestForMode ? "◉" : "○"} race ghost
                {bestForMode && (
                  <span className="ml-2 text-[color:var(--type-muted)]">
                    ({bestForMode.wpm} wpm)
                  </span>
                )}
              </button>
            </div>

            <div className="h-12 flex items-center">
              {engine.started && !engine.finished && (
                <LiveStats
                  wpm={engine.live.wpm}
                  accuracy={engine.live.accuracy}
                  timer={timerDisplay}
                />
              )}
            </div>

            {needsTextInput ? (
              <div className="h-[10.5rem] flex items-center text-[color:var(--type-muted)] font-mono text-sm">
                {mode === "ai" ? "enter a topic above to generate text" : "paste text above to begin"}
              </div>
            ) : (
              <TypingDisplay
                key={restartTick + text.length}
                text={text}
                input={engine.input}
                ghostIdx={ghostEnabled && bestForMode ? ghostIdx : null}
              />
            )}

            {/* Heatmap */}
            <div className="mt-4 w-full max-w-3xl mx-auto">
              <div className="flex justify-end mb-2">
                <HeatmapSettings
                  value={heatmapSettings}
                  onChange={setHeatmapSettings}
                  onResetStats={() => {
                    resetStats();
                    const empty: StatsBundle = { keys: {}, bigrams: {}, testCount: 0 };
                    setStats(empty);
                    const uid = userIdRef.current;
                    if (uid) saveCloudStats(uid, empty).catch(() => {});
                  }}
                />
              </div>
              <div className="overflow-x-auto -mx-4 px-4 pb-1">
                <Keyboard stats={stats.keys} settings={heatmapSettings} />
              </div>
            </div>

          </>
        )}

        {result && (
          <Results
            result={result}
            onRestart={restartSame}
            onNew={restart}
            isPersonalRecord={prResult.isPR}
            previousBestWpm={prResult.prevBest}
            smartTargets={smartTargets}
          />
        )}
      </main>

      <footer className="px-6 py-4 text-center text-xs text-[color:var(--type-muted)] font-mono">
        <span className="kbd">tab</span> + <span className="kbd">enter</span> restart
        {mode === "zen" && (
          <>
            {"  ·  "}
            <span className="kbd">esc</span> end zen test
          </>
        )}
        {"  ·  "}just start typing to begin
      </footer>
    </div>
  );
}
