import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LESSONS, STAGES, lessonsForStage, type Lesson } from "@/data/lessons";
import { loadProgress, summarize, type LessonProgressMap } from "@/lib/lessons/progress";
import { nextRecommended } from "@/lib/lessons/scoring";
import { StageSection } from "@/components/lessons/StageSection";
import { CustomLessonModal } from "@/components/lessons/CustomLessonModal";
import { CustomTrackCard } from "@/components/lessons/CustomTrackCard";
import {
  createTrack,
  deleteTrack,
  loadTracks,
  type CustomTrack,
} from "@/lib/custom-lessons/tracks";

export const Route = createFileRoute("/lessons/")({
  component: LessonsIndexPage,
});

function LessonsIndexPage() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState<LessonProgressMap>({});
  const [tracks, setTracks] = useState<CustomTrack[]>([]);
  const [builderOpen, setBuilderOpen] = useState(false);

  useEffect(() => {
    setProgress(loadProgress());
    setTracks(loadTracks());
  }, []);

  const summary = summarize(progress);
  const recommended = nextRecommended(progress);
  const pct = summary.totalLessons > 0 ? (summary.completed / summary.totalLessons) * 100 : 0;

  function openLesson(lesson: Lesson) {
    navigate({ to: "/lessons/$lessonId", params: { lessonId: lesson.id } });
  }

  return (
    <div className="flex flex-col gap-8 py-6">
      <div>
        <h1 className="font-mono text-lg text-[color:var(--type-text)]">lessons</h1>
        <p className="text-xs text-[color:var(--type-muted)] mt-1">
          a structured touch-typing course — one row of the keyboard at a time
        </p>

        <div className="mt-4 flex items-center justify-between text-xs font-mono text-[color:var(--type-muted)]">
          <span>
            {summary.completed} / {summary.totalLessons} complete
          </span>
          <span>
            {summary.stars} / {summary.totalStars} stars
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full rounded-full bg-[color:var(--type-border)] overflow-hidden">
          <div
            className="h-full bg-[color:var(--type-accent)] transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <section>
        <h2 className="font-mono text-xs uppercase tracking-wider text-[color:var(--type-muted)] mb-3">
          my lessons
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setBuilderOpen(true)}
            className="rounded border border-dashed border-[color:var(--type-border)] hover:border-[color:var(--type-accent)] p-3 text-left font-mono text-sm text-[color:var(--type-muted)] hover:text-[color:var(--type-accent)] transition min-h-[92px]"
          >
            + custom lesson
            <span className="block text-[11px] mt-1">pick your own keys</span>
          </button>
          {tracks.map((t) => (
            <CustomTrackCard
              key={t.id}
              track={t}
              onOpen={(track) =>
                navigate({ to: "/lessons/custom/$trackId", params: { trackId: track.id } })
              }
              onDelete={(track) => setTracks(deleteTrack(track.id))}
            />
          ))}
        </div>
      </section>

      <CustomLessonModal
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        onCreate={(input) => {
          const track = createTrack(input);
          setTracks(loadTracks());
          setBuilderOpen(false);
          navigate({ to: "/lessons/custom/$trackId", params: { trackId: track.id } });
        }}
      />

      {STAGES.map((stage) => (
        <StageSection
          key={stage.id}
          label={stage.label}
          lessons={lessonsForStage(stage.id)}
          progress={progress}
          recommendedId={recommended?.id}
          onSelect={openLesson}
        />
      ))}

      <p className="sr-only">{LESSONS.length} lessons total</p>
    </div>
  );
}
