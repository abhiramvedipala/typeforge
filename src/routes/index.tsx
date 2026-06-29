import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Toaster } from "sonner";
import { useTypingEngine, type TypingResult } from "@/hooks/use-typing-engine";
import { TypingDisplay } from "@/components/typing/TypingDisplay";
import { Results } from "@/components/typing/Results";
import { ThemeSwitcher } from "@/components/typing/ThemeSwitcher";
import { ModeBar } from "@/components/typing/ModeBar";
import { AIPrompt } from "@/components/typing/AIPrompt";
import { DrillSelector } from "@/components/typing/DrillSelector";
import { CustomTextInput } from "@/components/typing/CustomTextInput";
import { LiveStats } from "@/components/typing/LiveStats";
import { drillWords, randomQuote, randomWords } from "@/lib/words";
import type { Mode, TimeOption, WordsOption } from "@/components/typing/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TypeForge — typing practice with AI-generated text" },
      {
        name: "description",
        content:
          "A minimal, distraction-free typing trainer. Time, words, quote and zen modes, plus AI-generated practice text and per-key drills.",
      },
      { property: "og:title", content: "TypeForge — typing practice" },
      {
        property: "og:description",
        content: "AI-generated practice text and per-key drills for serious typists.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [mode, setMode] = useState<Mode>("time");
  const [timeValue, setTimeValue] = useState<TimeOption>(30);
  const [wordsValue, setWordsValue] = useState<WordsOption>(25);
  const [drillLetters, setDrillLetters] = useState<string[]>([]);
  const [text, setText] = useState<string>("");
  const [result, setResult] = useState<TypingResult | null>(null);
  const [restartTick, setRestartTick] = useState(0);

  // Build text from mode
  const newText = useCallback(() => {
    setResult(null);
    setRestartTick((n) => n + 1);
    if (mode === "time") {
      setText(randomWords(80).join(" "));
    } else if (mode === "words") {
      setText(randomWords(wordsValue).join(" "));
    } else if (mode === "quote") {
      setText(randomQuote());
    } else if (mode === "zen") {
      // Zen: provide some words so the display has content, but engine wont auto-finish
      setText(randomWords(200).join(" "));
    } else if (mode === "drill") {
      setText(drillWords(drillLetters.length ? drillLetters : ["a", "s", "d", "f"], 40).join(" "));
    }
    // ai & custom: text stays until user generates
  }, [mode, wordsValue, drillLetters]);

  // Regenerate when mode/value changes (except for ai/custom which require user input)
  useEffect(() => {
    if (mode === "ai" || mode === "custom") {
      // Keep existing text if any; otherwise clear
      return;
    }
    newText();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, timeValue, wordsValue]);

  const onComplete = useCallback((r: TypingResult) => setResult(r), []);

  const engine = useTypingEngine({
    text,
    timeLimit: mode === "time" ? timeValue : undefined,
    zen: mode === "zen",
    onComplete,
  });

  // Re-key the engine on restart by varying text via key on component
  // Already handled: changing `text` resets engine.

  const restart = useCallback(() => {
    setResult(null);
    // Re-trigger the engine reset by re-setting same text via a tick-suffix workaround:
    // Append a no-op trailing space toggling won't work; instead generate new text.
    newText();
  }, [newText]);

  const restartSame = useCallback(() => {
    setResult(null);
    // Force reset by setting text to same — engine resets on text change only.
    // Trick: set to empty then back.
    const cur = text;
    setText("");
    setTimeout(() => setText(cur), 0);
  }, [text]);

  // Tab+Enter restart shortcut
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

  return (
    <div className="min-h-screen bg-[color:var(--type-bg)] text-[color:var(--type-text)] flex flex-col">
      <Toaster position="top-center" />
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto w-full">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xl font-bold text-[color:var(--type-accent)]">
            type<span className="text-[color:var(--type-text)]">forge</span>
          </span>
          <span className="text-xs text-[color:var(--type-muted)] hidden sm:inline">
            // typing practice
          </span>
        </div>
        <ThemeSwitcher />
      </header>

      {/* Main content */}
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

            {/* Live stats — only show after typing started */}
            <div className="h-12 flex items-center">
              {engine.started && !engine.finished && (
                <LiveStats
                  wpm={engine.live.wpm}
                  accuracy={engine.live.accuracy}
                  timer={timerDisplay}
                />
              )}
            </div>

            {/* Typing display */}
            {needsTextInput ? (
              <div className="h-[10.5rem] flex items-center text-[color:var(--type-muted)] font-mono text-sm">
                {mode === "ai" ? "enter a topic above to generate text" : "paste text above to begin"}
              </div>
            ) : (
              <TypingDisplay key={restartTick + text.length} text={text} input={engine.input} />
            )}
          </>
        )}

        {result && (
          <Results
            result={result}
            onRestart={restartSame}
            onNew={restart}
          />
        )}
      </main>

      {/* Footer shortcuts */}
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
