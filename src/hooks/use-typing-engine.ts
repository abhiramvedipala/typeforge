import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type CharState = "pending" | "correct" | "incorrect" | "extra";

export interface WpmSample {
  t: number; // seconds since start
  wpm: number;
  raw: number;
}

export interface TypingResult {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  correctChars: number;
  incorrectChars: number;
  extraChars: number;
  missedChars: number;
  elapsed: number;
  samples: WpmSample[];
}

interface Options {
  text: string;
  // For time mode: stop test after timeLimit seconds. If undefined => ends when text complete.
  timeLimit?: number;
  // If true, no time limit and no completion - manual stop only (zen)
  zen?: boolean;
  onComplete?: (result: TypingResult) => void;
}

export function useTypingEngine({ text, timeLimit, zen, onComplete }: Options) {
  const [input, setInput] = useState("");
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [now, setNow] = useState(0); // ms elapsed
  const startTimeRef = useRef<number | null>(null);
  const samplesRef = useRef<WpmSample[]>([]);
  const lastSampleSecondRef = useRef<number>(-1);
  // Track all keystrokes for raw wpm
  const totalKeystrokesRef = useRef(0);
  const incorrectKeystrokesRef = useRef(0);

  const reset = useCallback(() => {
    setInput("");
    setStarted(false);
    setFinished(false);
    setNow(0);
    startTimeRef.current = null;
    samplesRef.current = [];
    lastSampleSecondRef.current = -1;
    totalKeystrokesRef.current = 0;
    incorrectKeystrokesRef.current = 0;
  }, []);

  // Reset when text changes
  useEffect(() => {
    reset();
  }, [text, reset]);

  const computeStats = useCallback(
    (elapsedMs: number) => {
      const elapsed = elapsedMs / 1000;
      let correct = 0;
      let incorrect = 0;
      let extra = 0;
      for (let i = 0; i < input.length; i++) {
        if (i >= text.length) {
          extra++;
        } else if (input[i] === text[i]) {
          correct++;
        } else {
          incorrect++;
        }
      }
      const missed = Math.max(0, text.length - input.length - 0); // chars not yet typed (only used at end of test)
      const minutes = Math.max(elapsed / 60, 1 / 60);
      const wpm = Math.max(0, Math.round((correct / 5) / minutes));
      const rawWpm = Math.max(
        0,
        Math.round((totalKeystrokesRef.current / 5) / minutes),
      );
      const typedTotal = correct + incorrect + extra;
      const accuracy =
        totalKeystrokesRef.current === 0
          ? 100
          : Math.max(
              0,
              Math.min(
                100,
                ((totalKeystrokesRef.current - incorrectKeystrokesRef.current) /
                  totalKeystrokesRef.current) *
                  100,
              ),
            );
      return {
        wpm,
        rawWpm,
        accuracy,
        correctChars: correct,
        incorrectChars: incorrect,
        extraChars: extra,
        missedChars: missed,
        typedTotal,
        elapsed,
      };
    },
    [input, text],
  );

  // Live ticker
  useEffect(() => {
    if (!started || finished) return;
    const id = setInterval(() => {
      const elapsed = Date.now() - (startTimeRef.current ?? Date.now());
      setNow(elapsed);
      const sec = Math.floor(elapsed / 1000);
      if (sec !== lastSampleSecondRef.current && sec > 0) {
        lastSampleSecondRef.current = sec;
        const s = computeStats(elapsed);
        samplesRef.current.push({ t: sec, wpm: s.wpm, raw: s.rawWpm });
      }
      if (timeLimit && elapsed >= timeLimit * 1000) {
        finishTest(timeLimit * 1000);
      }
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, finished, timeLimit, computeStats]);

  const finishTest = useCallback(
    (elapsedMs?: number) => {
      if (finished) return;
      setFinished(true);
      const finalElapsed = elapsedMs ?? Date.now() - (startTimeRef.current ?? Date.now());
      const s = computeStats(finalElapsed);
      const result: TypingResult = {
        wpm: s.wpm,
        rawWpm: s.rawWpm,
        accuracy: Math.round(s.accuracy * 10) / 10,
        correctChars: s.correctChars,
        incorrectChars: s.incorrectChars,
        extraChars: s.extraChars,
        missedChars: s.missedChars,
        elapsed: s.elapsed,
        samples: samplesRef.current,
      };
      onComplete?.(result);
    },
    [computeStats, finished, onComplete],
  );

  // Keyboard handler
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (finished) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Ignore when user is typing in an input/textarea/select
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      )
        return;

      if (e.key === "Backspace") {
        e.preventDefault();
        setInput((prev) => prev.slice(0, -1));
        return;
      }

      // Only count printable single chars and space
      if (e.key.length !== 1) return;
      e.preventDefault();

      if (!started) {
        setStarted(true);
        startTimeRef.current = Date.now();
      }

      const idx = input.length;
      const expected = text[idx];
      totalKeystrokesRef.current += 1;
      if (e.key !== expected) {
        incorrectKeystrokesRef.current += 1;
      }
      setInput((prev) => {
        const next = prev + e.key;
        if (!zen && !timeLimit && next.length >= text.length) {
          // text mode completion
          setTimeout(() => finishTest(), 0);
        }
        return next;
      });
    },
    [finished, started, input.length, text, zen, timeLimit, finishTest],
  );

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  const live = useMemo(() => computeStats(now), [computeStats, now]);

  return {
    input,
    started,
    finished,
    elapsedMs: now,
    reset,
    finishTest,
    live,
  };
}
