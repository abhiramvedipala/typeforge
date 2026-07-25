import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTypingEngine, type TypingResult } from "@/hooks/use-typing-engine";
import { TypingDisplay } from "@/components/typing/TypingDisplay";
import { LiveStats } from "@/components/typing/LiveStats";
import { FingerKeyboard } from "@/components/lessons/FingerKeyboard";
import { LessonResults } from "@/components/lessons/LessonResults";
import { getLesson, lessonKeyHint, type Lesson } from "@/data/lessons";
import { generateLessonText } from "@/lib/lessons/generateLessonText";
import { loadProgress, saveAttempt, type LessonProgressMap } from "@/lib/lessons/progress";
import { evaluate, isUnlocked, lessonAfter, type LessonOutcome } from "@/lib/lessons/scoring";
import { loadSoundProfile, playKeySound } from "@/lib/sounds";

export const Route = createFileRoute("/lessons/$lessonId")({
  component: LessonPlayerPage,
});

function LessonPlayerPage() {
  const { lessonId } = Route.useParams();
  const navigate = useNavigate();
  const lesson = getLesson(lessonId);

  const [progress, setProgress] = useState<LessonProgressMap>({});
  const [progressLoaded, setProgressLoaded] = useState(false);

  useEffect(() => {
    setProgress(loadProgress());
    setProgressLoaded(true);
  }, []);

  // Guard against a bad id or a direct link to a still-locked lesson.
  useEffect(() => {
    if (!progressLoaded) return;
    if (!lesson || !isUnlocked(lesson, progress)) {
      navigate({ to: "/lessons" });
    }
  }, [lesson, progress, progressLoaded, navigate]);

  if (!lesson || !progressLoaded || !isUnlocked(lesson, progress)) {
    return null;
  }

  // Keyed by lesson id so navigating straight to the next lesson (no route
  // remount otherwise, since it's the same dynamic segment) still resets all
  // player state — outcome, restart tick, started flag.
  return <LessonPlayer key={lesson.id} lesson={lesson} onProgressChange={setProgress} />;
}

function LessonPlayer({
  lesson,
  onProgressChange,
}: {
  lesson: Lesson;
  onProgressChange: (p: LessonProgressMap) => void;
}) {
  const navigate = useNavigate();
  const [hasStarted, setHasStarted] = useState(false);
  const [restartTick, setRestartTick] = useState(0);
  const [outcome, setOutcome] = useState<LessonOutcome | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);

  // Deterministic per lesson id — a retry sees the exact same text as the
  // first attempt, so results are directly comparable.
  const { text } = useMemo(() => generateLessonText(lesson), [lesson]);

  const onComplete = useCallback(
    (result: TypingResult) => {
      const o = evaluate(lesson, result);
      const saved = saveAttempt(lesson.id, {
        stars: o.stars,
        wpm: o.wpm,
        accuracy: o.accuracy,
      });
      setOutcome(o);
      setIsNewBest(saved.isNewBest);
      onProgressChange(saved.progress);
    },
    [lesson, onProgressChange],
  );

  const engine = useTypingEngine({
    text,
    onComplete,
    onKeystroke: (k) => playKeySound(loadSoundProfile(), !k.correct),
  });

  const restart = useCallback(() => {
    setOutcome(null);
    setHasStarted(false);
    engine.reset();
    setRestartTick((t) => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (engine.started) setHasStarted(true);
  }, [engine.started]);

  const goToLessons = useCallback(() => navigate({ to: "/lessons" }), [navigate]);
  const next = lessonAfter(lesson);
  const goToNext = useCallback(() => {
    if (next) navigate({ to: "/lessons/$lessonId", params: { lessonId: next.id } });
  }, [navigate, next]);

  // Tab+Enter restart, consistent with practice mode.
  useEffect(() => {
    let tabHeld = false;
    function down(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      )
        return;
      if (e.key === "Tab") {
        e.preventDefault();
        tabHeld = true;
      }
      if (e.key === "Enter" && tabHeld) {
        e.preventDefault();
        restart();
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
  }, [restart]);

  const nextKey =
    engine.input.length < text.length ? text[engine.input.length].toLowerCase() : null;

  return (
    <div className="flex-1 flex flex-col items-center gap-6 py-6">
      {!outcome && !hasStarted && (
        <div className="text-center max-w-lg">
          <div className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--type-muted)]">
            {lesson.stage} row · lesson {lesson.number}
          </div>
          <h1 className="font-mono text-xl text-[color:var(--type-text)] mt-1">{lesson.title}</h1>
          <p className="text-xs text-[color:var(--type-muted)] mt-2">{lessonKeyHint(lesson)}</p>
          <p className="text-[11px] text-[color:var(--type-muted)] mt-4 font-mono">
            just start typing to begin
          </p>
        </div>
      )}

      {!outcome && (
        <>
          <div className="h-10 flex items-center gap-4">
            {engine.started && !engine.finished && (
              <>
                <LiveStats
                  wpm={engine.live.wpm}
                  accuracy={engine.live.accuracy}
                  timer={`${(engine.elapsedMs / 1000).toFixed(1)}s`}
                />
                <span className="text-xs font-mono text-[color:var(--type-muted)]">
                  {Math.min(engine.input.length, text.length)} / {text.length}
                </span>
              </>
            )}
          </div>

          <TypingDisplay key={restartTick} text={text} input={engine.input} ghostIdx={null} />

          <FingerKeyboard pool={lesson.pool} nextKey={nextKey} />

          <button
            onClick={restart}
            className="text-xs font-mono px-3 py-1.5 rounded border border-[color:var(--type-border)] text-[color:var(--type-muted)] hover:text-[color:var(--type-text)] transition"
          >
            restart
          </button>
        </>
      )}

      {outcome && (
        <LessonResults
          lesson={lesson}
          outcome={outcome}
          isNewBest={isNewBest}
          onRetry={restart}
          onNext={outcome.unlockedNext && next ? goToNext : undefined}
          onBack={goToLessons}
        />
      )}
    </div>
  );
}
