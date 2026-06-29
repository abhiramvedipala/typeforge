import { useMemo } from "react";
import { scoreForKey, type KeyStatsMap } from "@/lib/keystats";

interface Props {
  stats: KeyStatsMap;
}

const ROWS: string[][] = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

// Map a 0..1 health score (higher = better) onto a green->yellow->red OKLCH color.
// 1 = green, 0.5 = yellow, 0 = red.
function healthColor(health: number): string {
  const h = Math.max(0, Math.min(1, health));
  // hue: 25 (red) -> 90 (yellow) -> 145 (green)
  const hue = 25 + h * 120;
  return `oklch(0.65 0.18 ${hue.toFixed(1)})`;
}

export function Keyboard({ stats }: Props) {
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
    // weight accuracy heavier than speed
    const health = acc * 0.65 + speed * 0.35;
    return healthColor(health);
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
