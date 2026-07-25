import type { Lesson } from "@/data/lessons";
import { MAX_STARS_PER_LESSON } from "@/data/lessons";
import type { LessonRecord } from "@/lib/lessons/progress";

interface Props {
  lesson: Lesson;
  record: LessonRecord | undefined;
  locked: boolean;
  recommended: boolean;
  onSelect: (lesson: Lesson) => void;
}

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${count} of ${MAX_STARS_PER_LESSON} stars`}>
      {Array.from({ length: MAX_STARS_PER_LESSON }).map((_, i) => (
        <span
          key={i}
          aria-hidden
          className={
            i < count ? "text-[color:var(--type-accent)]" : "text-[color:var(--type-border)]"
          }
        >
          ★
        </span>
      ))}
    </div>
  );
}

export function LessonCard({ lesson, record, locked, recommended, onSelect }: Props) {
  const stars = record?.stars ?? 0;

  return (
    <button
      type="button"
      disabled={locked}
      onClick={() => !locked && onSelect(lesson)}
      title={locked ? `complete lesson ${lesson.number - 1} to unlock` : undefined}
      aria-disabled={locked}
      className={`group relative text-left w-full rounded-lg border p-4 font-mono transition ${
        locked
          ? "cursor-not-allowed border-[color:var(--type-border)] opacity-40"
          : recommended
            ? "border-[color:var(--type-accent)] bg-[color:var(--type-surface)] hover:brightness-110"
            : "border-[color:var(--type-border)] hover:border-[color:var(--type-accent)] hover:bg-[color:var(--type-surface)]"
      }`}
    >
      {locked && (
        <span aria-hidden className="absolute top-3 right-3 text-[color:var(--type-muted)] text-sm">
          🔒
        </span>
      )}
      {!locked && stars > 0 && (
        <span
          aria-label="completed"
          className="absolute top-3 right-3 text-[color:var(--type-accent)] text-sm"
        >
          ✓
        </span>
      )}

      <div className="text-[10px] uppercase tracking-wider text-[color:var(--type-muted)]">
        lesson {lesson.number}
      </div>
      <div className="text-xl mt-1 text-[color:var(--type-text)] truncate" title={lesson.glyph}>
        {lesson.glyph}
      </div>
      <div className="text-xs mt-1 text-[color:var(--type-muted)] truncate">{lesson.title}</div>

      <div className="mt-3 flex items-center justify-between">
        <Stars count={stars} />
        {record && (
          <span className="text-[10px] text-[color:var(--type-muted)]">{record.bestWpm} wpm</span>
        )}
      </div>

      {recommended && !locked && (
        <div className="mt-2 text-[9px] uppercase tracking-wider text-[color:var(--type-accent)]">
          next up
        </div>
      )}
    </button>
  );
}
