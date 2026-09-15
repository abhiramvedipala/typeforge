import { MAX_TRACK_STARS, PASSES_TO_ADVANCE } from "@/lib/custom-lessons/difficulty";
import type { CustomTrack } from "@/lib/custom-lessons/tracks";

interface Props {
  track: CustomTrack;
  onOpen: (track: CustomTrack) => void;
  onDelete: (track: CustomTrack) => void;
}

export function CustomTrackCard({ track, onOpen, onDelete }: Props) {
  return (
    <div className="relative group rounded border border-[color:var(--type-border)] hover:border-[color:var(--type-accent)] transition">
      <button
        type="button"
        onClick={() => onOpen(track)}
        className="w-full text-left p-3 flex flex-col gap-2"
      >
        <span className="font-mono text-sm text-[color:var(--type-text)] truncate">
          {track.title}
        </span>
        <span className="font-mono text-[11px] text-[color:var(--type-muted)] truncate">
          {track.charset}
        </span>
        <span className="flex items-center justify-between text-[11px] font-mono">
          <span aria-label={`${track.stars} of ${MAX_TRACK_STARS} stars`}>
            <span className="text-[color:var(--type-accent)]">{"★".repeat(Math.min(5, Math.round(track.stars / 3)))}</span>
            <span className="text-[color:var(--type-border)]">
              {"★".repeat(5 - Math.min(5, Math.round(track.stars / 3)))}
            </span>
          </span>
          <span className="text-[color:var(--type-muted)]">
            {track.currentLevel} {track.streak}/{PASSES_TO_ADVANCE}
          </span>
        </span>
      </button>
      <button
        type="button"
        aria-label={`delete ${track.title}`}
        onClick={() => onDelete(track)}
        className="absolute top-1.5 right-1.5 text-[10px] font-mono text-[color:var(--type-muted)] opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-[color:var(--type-text)] transition"
      >
        ✕
      </button>
    </div>
  );
}
