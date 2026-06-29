import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type CharState = "pending" | "correct" | "incorrect" | "extra";

export interface WpmSample {
  t: number; // seconds since start
  wpm: number;
  raw: number;
  errors: number; // cumulative incorrect keystrokes
}

export interface Keystroke {
  t: number; // ms since start
  idx: number; // expected index at moment of keystroke (input.length before push)
  key: string;
  expected: string | undefined;
  correct: boolean;
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
  keystrokes: Keystroke[];
  text: string;
}

interface Options {
  text: string;
  timeLimit?: number;
  zen?: boolean;
  onComplete?: (result: TypingResult) => void;
  onKeystroke?: (k: Keystroke) => void;
}

export function useTypingEngine({ text, timeLimit, zen, onComplete, onKeystroke }: Options) {
  const [input, setInput] = useState("");
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [now, setNow] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const samplesRef = useRef<WpmSample[]>([]);
  const keystrokesRef = useRef<Keystroke[]>([]);
  const lastSampleSecondRef = useRef<number>(-1);
  const totalKeystrokesRef = useRef(0);
  const incorrectKeystrokesRef = useRef(0);

  const reset = useCallback(() => {
    setInput("");
    setStarted(false);
    setFinished(false);
    setNow(0);
    startTimeRef.current = null;
    samplesRef.current = [];
    keystrokesRef.current = [];
    lastSampleSecondRef.current = -1;
    totalKeystrokesRef.current = 0;
    incorrectKeystrokesRef.current = 0;
  }, []);

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
        if (i >= text.length) extra++;
        else if (input[i] === text[i]) correct++;
        else incorrect++;
      }
      const missed = Math.max(0, text.length - input.length);
      const minutes = Math.max(elapsed / 60, 1 / 60);
      const wpm = Math.max(0, Math.round((correct / 5) / minutes));
      const rawWpm = Math.max(0, Math.round((totalKeystrokesRef.current / 5) / minutes));
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
        elapsed,
      };
    },
    [input, text],
  );

  useEffect(() => {
    if (!started || finished) return;
    const id = setInterval(() => {
      const elapsed = Date.now() - (startTimeRef.current ?? Date.now());
      setNow(elapsed);
      const sec = Math.floor(elapsed / 1000);
      if (sec !== lastSampleSecondRef.current && sec > 0) {
        lastSampleSecondRef.current = sec;
        const s = computeStats(elapsed);
        samplesRef.current.push({
          t: sec,
          wpm: s.wpm,
          raw: s.rawWpm,
          errors: incorrectKeystrokesRef.current,
        });
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
        keystrokes: keystrokesRef.current,
        text,
      };
      onComplete?.(result);
    },
    [computeStats, finished, onComplete, text],
  );

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (finished) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
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

      if (e.key.length !== 1) return;
      e.preventDefault();

      if (!started) {
        setStarted(true);
        startTimeRef.current = Date.now();
      }

      const idx = input.length;
      const expected = text[idx];
      const correct = e.key === expected;
      totalKeystrokesRef.current += 1;
      if (!correct) incorrectKeystrokesRef.current += 1;

      const ks: Keystroke = {
        t: Date.now() - (startTimeRef.current ?? Date.now()),
        idx,
        key: e.key,
        expected,
        correct,
      };
      keystrokesRef.current.push(ks);
      onKeystroke?.(ks);

      setInput((prev) => {
        const next = prev + e.key;
        if (!zen && !timeLimit && next.length >= text.length) {
          setTimeout(() => finishTest(), 0);
        }
        return next;
      });
    },
    [finished, started, input.length, text, zen, timeLimit, finishTest, onKeystroke],
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
