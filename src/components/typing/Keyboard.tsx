import { useMemo } from "react";
import { scoreForKey, type KeyStatsMap } from "@/lib/keystats";
import {
  DEFAULT_HEATMAP_SETTINGS,
  type HeatmapSettings,
} from "@/lib/heatmap-settings";

interface Props {
  stats: KeyStatsMap;
  settings?: HeatmapSettings;
}

const ROWS: string[][] = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

// Bucket a 0..1 health score into red / yellow / green based on the user's thresholds.
function bucketColor(health: number, s: HeatmapSettings): string {
  const h = Math.max(0, Math.min(1, health));
  if (h < s.redThreshold) return "oklch(0.62 0.19 25)"; // red
  if (h < s.yellowThreshold) return "oklch(0.78 0.16 90)"; // yellow
  return "oklch(0.68 0.17 145)"; // green
}

export function Keyboard({ stats, settings = DEFAULT_HEATMAP_SETTINGS }: Props) {
  // Compute the slowest and fastest avgMs across all tracked keys to normalize speed scoring.
  const { minMs, maxMs } = useMemo(() => {
    let mn = Infinity;
    let mx = -Infinity;
    for (const k of Object.keys(stats)) {
      const s = scoreForKey(stats, k);
      if (s?.avgMs != null) {
        if (s.avgMs < mn) mn = s.avgMs;
        if (s.avgMs > mx) mx = s.avgMs;
      }
    }
    if (!isFinite(mn) || !isFinite(mx) || mn === mx) {
      return { minMs: 80, maxMs: 400 };
    }
    return { minMs: mn, maxMs: mx };
  }, [stats]);

  function keyColor(letter: string): string | undefined {
    const s = scoreForKey(stats, letter);
    if (!s) return undefined;
    const acc = s.accuracy; // 0..1
    let speed = 0.5;
    if (s.avgMs != null) {
      const norm = (s.avgMs - minMs) / Math.max(1, maxMs - minMs); // 0 fast .. 1 slow
      speed = 1 - norm;
    }
    const accW = settings.accuracyWeight;
    const health = acc * accW + speed * (1 - accW);
    return bucketColor(health, settings);
  }

  function keyTitle(letter: string): string {
    const s = scoreForKey(stats, letter);
    if (!s) return `${letter}: no data yet`;
    return `${letter}: ${Math.round(s.accuracy * 100)}% acc${
      s.avgMs != null ? `, ${Math.round(s.avgMs)}ms` : ""
    } (${s.attempts} tries)`;
  }

  return (
    <div
      className="mx-auto select-none font-mono text-xs"
      role="img"
      aria-label="Per-key accuracy and speed heatmap"
    >
      <div className="flex flex-col items-center gap-1.5">
        {ROWS.map((row, i) => (
          <div
            key={i}
            className="flex gap-1.5"
            style={{ paddingLeft: i * 14 }}
          >
            {row.map((letter) => {
              const bg = keyColor(letter);
              return (
                <div
                  key={letter}
                  title={keyTitle(letter)}
                  className="w-9 h-9 rounded-md border border-[color:var(--type-border)] flex items-center justify-center transition-colors"
                  style={{
                    background: bg ?? "var(--type-surface)",
                    color: bg ? "oklch(0.18 0.02 250)" : "var(--type-muted)",
                  }}
                >
                  {letter}
                </div>
              );
            })}
          </div>
        ))}
        <div
          className="w-[19rem] h-9 mt-0.5 rounded-md border border-[color:var(--type-border)] flex items-center justify-center"
          title={keyTitle(" ")}
          style={(() => {
            const bg = keyColor(" ");
            return {
              background: bg ?? "var(--type-surface)",
              color: bg ? "oklch(0.18 0.02 250)" : "var(--type-muted)",
            };
          })()}
        >
          space
        </div>
      </div>
      <p className="text-center text-[color:var(--type-muted)] mt-2 text-[10px]">
        heatmap: green = fast & accurate · red = slow or error-prone
      </p>
    </div>
  );
}
