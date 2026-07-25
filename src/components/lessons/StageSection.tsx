import type { Lesson } from "@/data/lessons";
import type { LessonProgressMap } from "@/lib/lessons/progress";
import { isUnlocked } from "@/lib/lessons/scoring";
import { LessonCard } from "./LessonCard";

interface Props {
  label: string;
  lessons: readonly Lesson[];
  progress: LessonProgressMap;
  recommendedId: string | undefined;
  onSelect: (lesson: Lesson) => void;
}

export function StageSection({ label, lessons, progress, recommendedId, onSelect }: Props) {
  return (
    <section>
      <h2 className="font-mono text-xs uppercase tracking-wider text-[color:var(--type-muted)] mb-3">
        {label}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {lessons.map((lesson) => (
          <LessonCard
            key={lesson.id}
            lesson={lesson}
            record={progress[lesson.id]}
            locked={!isUnlocked(lesson, progress)}
            recommended={lesson.id === recommendedId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}
