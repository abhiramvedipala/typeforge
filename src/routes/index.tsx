import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toaster } from "sonner";
import { useTypingEngine, type Keystroke, type TypingResult } from "@/hooks/use-typing-engine";
import { TypingDisplay } from "@/components/typing/TypingDisplay";
import { Results } from "@/components/typing/Results";
import { ThemeSwitcher } from "@/components/typing/ThemeSwitcher";
import { ModeBar } from "@/components/typing/ModeBar";
import { AIPrompt } from "@/components/typing/AIPrompt";
import { DrillSelector } from "@/components/typing/DrillSelector";
import { CustomTextInput } from "@/components/typing/CustomTextInput";
import { LiveStats } from "@/components/typing/LiveStats";
import { Keyboard } from "@/components/typing/Keyboard";
import { SoundToggle, useSoundProfile } from "@/components/typing/SoundToggle";
import { drillWords, randomQuote, randomWords } from "@/lib/words";
import {
  ingestKeystrokes,
  loadKeyStats,
  saveKeyStats,
  type KeyStatsMap,
} from "@/lib/keystats";
import { playKeySound } from "@/lib/sounds";
import {
  getBest,
  ghostIndexAt,
  ghostKey,
  isPersonalRecord,
  setBest,
  type BestRun,
} from "@/lib/ghost";
import type { Mode, TimeOption, WordsOption } from "@/components/typing/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TypeForge — typing practice with AI-generated text" },
      {
        name: "description",
        content:
          "A minimal, distraction-free typing trainer. Time, words, quote and zen modes, plus AI-generated practice text, per-key drills, live keyboard heatmap and ghost replay.",
      },
      { property: "og:title", content: "TypeForge — typing practice" },
      {
        property: "og:description",
        content:
          "AI-generated practice text, per-key drills, live keyboard heatmap and race-your-ghost replay.",
      },
    ],
  }),
  component: Index,
});

const GHOST_TOGGLE_KEY = "typeforge-ghost-enabled-v1";

function Index() {
  const [mode, setMode] = useState<Mode>("time");
  const [timeValue, setTimeValue] = useState<TimeOption>(30);
  const [wordsValue, setWordsValue] = useState<WordsOption>(25);
  const [drillLetters, setDrillLetters] = useState<string[]>([]);
  const [text, setText] = useState<string>("");
  const [result, setResult] = useState<TypingResult | null>(null);
  const [restartTick, setRestartTick] = useState(0);

  const [keyStats, setKeyStats] = useState<KeyStatsMap>({});
  const [soundProfile, setSoundProfile] = useSoundProfile();
  const [ghostEnabled, setGhostEnabled] = useState(false);
  const [bestForMode, setBestForMode] = useState<BestRun | null>(null);
  const [prResult, setPrResult] = useState<{ isPR: boolean; prevBest: number | null }>({
    isPR: false,
    prevBest: null,
  });
  const [ghostIdx, setGhostIdx] = useState<number | null>(null);

  // Hydrate persisted state
  useEffect(() => {
    setKeyStats(loadKeyStats());
    try {
      const v = localStorage.getItem(GHOST_TOGGLE_KEY);
      if (v === "1") setGhostEnabled(true);
    } catch {}
  }, []);

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
  }, [mode, wordsValue, drillLetters]);

  useEffect(() => {
    if (mode === "ai" || mode === "custom") return;
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
      // Ingest per-key stats
      const merged = ingestKeystrokes(keyStats, r.keystrokes);
      setKeyStats(merged);
      saveKeyStats(merged);

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
    [keyStats, mode, timeValue, wordsValue],
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

  const needsTextInput = (mode === "ai" || mode === "custom") && !text;

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
      <header className="flex items-center justify-between gap-4 px-6 py-4 max-w-6xl mx-auto w-full">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xl font-bold text-[color:var(--type-accent)]">
            type<span className="text-[color:var(--type-text)]">forge</span>
          </span>
          <span className="text-xs text-[color:var(--type-muted)] hidden sm:inline">
            // typing practice
          </span>
        </div>
        <div className="flex items-center gap-4 flex-wrap justify-end">
          <SoundToggle value={soundProfile} onChange={setSoundProfile} />
          <ThemeSwitcher />
        </div>
      </header>

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
            <div className="mt-4">
              <Keyboard stats={keyStats} />
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
