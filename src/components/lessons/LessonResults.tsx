import { useEffect, useState } from "react";
import type { Lesson } from "@/data/lessons";
import { MAX_STARS_PER_LESSON } from "@/data/lessons";
import type { LessonOutcome } from "@/lib/lessons/scoring";

interface Props {
  lesson: Lesson;
  outcome: LessonOutcome;
  isNewBest: boolean;
  onRetry: () => void;
  onNext?: () => void;
  onBack: () => void;
}

function AnimatedStars({ count }: { count: number }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    setShown(0);
    const timers = Array.from({ length: count }, (_, i) =>
      setTimeout(() => setShown((s) => Math.max(s, i + 1)), 150 * i + 100),
    );
    return () => timers.forEach(clearTimeout);
  }, [count]);

  return (
    <div
      className="flex gap-1 text-3xl justify-center"
      aria-label={`${count} of ${MAX_STARS_PER_LESSON} stars`}
    >
      {Array.from({ length: MAX_STARS_PER_LESSON }).map((_, i) => (
        <span
          key={i}
          className="transition-all duration-200"
          style={{
            color: i < shown ? "var(--type-accent)" : "var(--type-border)",
            transform: i < shown ? "scale(1)" : "scale(0.7)",
            opacity: i < shown ? 1 : 0.5,
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

export function LessonResults({ lesson, outcome, isNewBest, onRetry, onNext, onBack }: Props) {
  return (
    <div className="w-full max-w-xl mx-auto py-8 px-4 font-mono text-center">
      {isNewBest && (
        <div className="mb-4 inline-block px-3 py-1.5 rounded-md border border-[color:var(--type-accent)] text-[color:var(--type-accent)] text-xs tracking-wider">
          ★ new best
        </div>
      )}

      <AnimatedStars count={outcome.stars} />

      <h2 className="mt-4 text-lg text-[color:var(--type-text)]">
        lesson {lesson.number} · {lesson.title}
      </h2>

      <div className="mt-6 grid grid-cols-4 gap-3 text-sm">
        <Stat label="wpm" value={outcome.wpm} />
        <Stat label="accuracy" value={`${outcome.accuracy.toFixed(1)}%`} />
        <Stat label="time" value={`${outcome.elapsed.toFixed(1)}s`} />
        <Stat label="errors" value={outcome.errors} />
      </div>

      {outcome.problems.length > 0 && (
        <div className="mt-8 rounded-lg border border-[color:var(--type-border)] bg-[color:var(--type-surface)] p-4 text-left">
          <div className="text-[10px] uppercase tracking-wider text-[color:var(--type-muted)] mb-3">
            problem keys
          </div>
          <div className="flex flex-col gap-2">
            {outcome.problems.map((p) => (
              <div key={p.key} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="kbd">{p.key === " " ? "space" : p.key}</span>
                  <span className="text-[color:var(--type-muted)]">{p.finger}</span>
                </div>
                <span className="text-[color:var(--type-error)]">
                  missed {p.misses}/{p.attempts}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {outcome.shouldSuggestRetry && (
        <p className="mt-6 text-xs text-[color:var(--type-muted)]">
          a retry could push this past{" "}
          {MAX_STARS_PER_LESSON === outcome.stars ? "perfect" : "3 stars"} — totally optional.
        </p>
      )}

      <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
        <button
          onClick={onRetry}
          className="text-xs px-4 py-2 rounded border border-[color:var(--type-border)] text-[color:var(--type-muted)] hover:text-[color:var(--type-text)] hover:border-[color:var(--type-accent)] transition"
        >
          retry
        </button>
        {onNext && (
          <button
            onClick={onNext}
            className="text-xs px-4 py-2 rounded border border-[color:var(--type-accent)] text-[color:var(--type-accent)] hover:brightness-110 transition"
          >
            next lesson
          </button>
        )}
        <button
          onClick={onBack}
          className="text-xs px-4 py-2 rounded border border-[color:var(--type-border)] text-[color:var(--type-muted)] hover:text-[color:var(--type-text)] transition"
        >
          back to lessons
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[10px] text-[color:var(--type-muted)]">{label}</span>
      <span className="text-xl text-[color:var(--type-accent)]">{value}</span>
    </div>
  );
}
