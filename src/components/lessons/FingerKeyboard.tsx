import { useMemo } from "react";
import {
  FINGER_LABELS,
  KEY_ROWS,
  fingerForKey,
  fingerLabelForKey,
  type FingerId,
} from "@/data/lessons";

interface Props {
  /** Keys this lesson currently drills — everything else is dimmed near-invisible. */
  pool: readonly string[];
  /** The single character the learner should type next (lowercased); null once finished. */
  nextKey: string | null;
}

// Fixed categorical palette, one hue per finger. Deliberately theme-invariant —
// the same pattern the existing heatmap keyboard uses for its red/yellow/green
// buckets — so finger identity stays legible no matter which of the five
// themes is active. Checked for contrast against both the darkest (matrix)
// and lightest (paper) backgrounds.
const FINGER_COLORS: Record<FingerId, string> = {
  "left-pinky": "oklch(0.64 0.16 245)", // blue
  "left-ring": "oklch(0.64 0.15 290)", // violet
  "left-middle": "oklch(0.66 0.18 335)", // magenta
  "left-index": "oklch(0.66 0.18 20)", // red-orange
  "right-index": "oklch(0.74 0.16 65)", // gold
  "right-middle": "oklch(0.72 0.16 110)", // yellow-green
  "right-ring": "oklch(0.68 0.15 155)", // green
  "right-pinky": "oklch(0.68 0.13 200)", // cyan
  thumb: "oklch(0.55 0.01 250)", // neutral — the space bar isn't finger-specific
};

// Dark, low-chroma text reads cleanly on every swatch above (all are mid-to-high
// lightness), independent of which app theme is active.
const SWATCH_TEXT = "oklch(0.16 0.02 250)";

const FINGER_ORDER: FingerId[] = [
  "left-pinky",
  "left-ring",
  "left-middle",
  "left-index",
  "right-index",
  "right-middle",
  "right-ring",
  "right-pinky",
];

export function FingerKeyboard({ pool, nextKey }: Props) {
  const poolSet = useMemo(() => new Set(pool.map((k) => k.toLowerCase())), [pool]);
  const next = nextKey?.toLowerCase() ?? null;
  const nextFinger = next != null ? fingerForKey(next) : undefined;

  function renderKey(key: string) {
    const inPool = poolSet.has(key);
    const finger = fingerForKey(key);
    const isNext = next !== null && key === next;
    const color = finger ? FINGER_COLORS[finger] : undefined;

    return (
      <div
        key={key}
        title={finger ? `${key} · ${FINGER_LABELS[finger]}` : key}
        className="w-9 h-9 rounded-md flex items-center justify-center transition-all duration-150 font-mono text-xs"
        style={{
          background: inPool ? (color ?? "var(--type-surface)") : "var(--type-surface)",
          color: inPool ? SWATCH_TEXT : "var(--type-muted)",
          opacity: inPool ? 1 : 0.28,
          border: isNext ? "2px solid var(--type-accent)" : "1px solid var(--type-border)",
          boxShadow: isNext ? "0 0 0 3px var(--type-accent), var(--type-glow)" : "none",
          transform: isNext ? "scale(1.08)" : "scale(1)",
        }}
      >
        {key}
      </div>
    );
  }

  return (
    <div
      className="mx-auto select-none"
      role="img"
      aria-label="On-screen keyboard with finger guidance"
    >
      <div className="flex flex-col items-center gap-1.5">
        {KEY_ROWS.map((row, i) => (
          <div key={i} className="flex gap-1.5" style={{ paddingLeft: i * 14 }}>
            {row.map((key) => renderKey(key))}
          </div>
        ))}
        <div
          title={next === " " ? "space · thumb" : "space"}
          className="w-[19rem] h-9 mt-0.5 rounded-md flex items-center justify-center font-mono text-xs transition-all duration-150"
          style={{
            background: poolSet.has(" ") ? FINGER_COLORS.thumb : "var(--type-surface)",
            color: poolSet.has(" ") ? SWATCH_TEXT : "var(--type-muted)",
            opacity: poolSet.has(" ") ? 1 : 0.28,
            border: next === " " ? "2px solid var(--type-accent)" : "1px solid var(--type-border)",
            boxShadow: next === " " ? "0 0 0 3px var(--type-accent), var(--type-glow)" : "none",
          }}
        >
          space
        </div>
      </div>

      <p className="text-center mt-2 text-[10px] font-mono text-[color:var(--type-muted)] min-h-[1.2em]">
        {next != null
          ? next === " "
            ? "next: space · thumb"
            : `next: ${next} · ${fingerLabelForKey(next)}`
          : "lesson complete"}
      </p>

      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-3 max-w-sm mx-auto">
        {FINGER_ORDER.map((finger) => (
          <div key={finger} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-sm inline-block"
              style={{
                background: FINGER_COLORS[finger],
                opacity: nextFinger && nextFinger !== finger ? 0.45 : 1,
              }}
              aria-hidden
            />
            <span
              className="text-[9px] font-mono text-[color:var(--type-muted)]"
              style={{ opacity: nextFinger && nextFinger !== finger ? 0.6 : 1 }}
            >
              {FINGER_LABELS[finger].replace(" finger", "")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
