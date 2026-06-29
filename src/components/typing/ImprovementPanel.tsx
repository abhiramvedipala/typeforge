import type { Keystroke } from "@/hooks/use-typing-engine";
import { runStatsForTargets, type TargetSnapshot } from "@/lib/keystats";

interface Props {
  keystrokes: Keystroke[];
  targets: { keys: string[]; bigrams: string[] };
  snapshot: TargetSnapshot;
}

export function ImprovementPanel({ keystrokes, targets, snapshot }: Props) {
  const run = runStatsForTargets(keystrokes, targets.keys, targets.bigrams);

  const keyRows = targets.keys.map((k) => {
    const lo = k.toLowerCase();
    const prev = snapshot.keys[lo];
    const cur = run.keys[lo];
    return {
      token: lo,
      prevAcc: prev?.accuracy ?? null,
      prevMs: prev?.avgMs ?? null,
      runAcc: cur?.hits ? cur.runAcc : null,
      runMs: cur?.runMs ?? null,
      hits: cur?.hits ?? 0,
    };
  });
  const bgRows = targets.bigrams.map((b) => {
    const lo = b.toLowerCase();
    const prev = snapshot.bigrams[lo];
    const cur = run.bigrams[lo];
    return {
      token: lo,
      prevAcc: prev?.accuracy ?? null,
      prevMs: prev?.avgMs ?? null,
      runAcc: cur?.hits ? cur.runAcc : null,
      runMs: cur?.runMs ?? null,
      hits: cur?.hits ?? 0,
    };
  });

  return (
    <div className="border border-[color:var(--type-border)] rounded-lg p-4 mb-8 bg-[color:var(--type-surface)]">
      <div className="text-xs uppercase tracking-wider text-[color:var(--type-muted)] mb-3 font-mono">
        smart drill · target improvement
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <Section title="keys" rows={keyRows} />
        <Section title="bigrams" rows={bgRows} />
      </div>
    </div>
  );
}

interface Row {
  token: string;
  prevAcc: number | null;
  prevMs: number | null;
  runAcc: number | null;
  runMs: number | null;
  hits: number;
}

function Section({ title, rows }: { title: string; rows: Row[] }) {
  if (!rows.length) return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[color:var(--type-muted)] mb-2 font-mono">
        {title}
      </div>
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="text-[color:var(--type-muted)]">
            <th className="text-left font-normal pb-1">key</th>
            <th className="text-right font-normal pb-1">acc</th>
            <th className="text-right font-normal pb-1">ms</th>
            <th className="text-right font-normal pb-1">hits</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.token} className="border-t border-[color:var(--type-border)]/40">
              <td className="py-1 text-[color:var(--type-text)]">{r.token}</td>
              <td className="py-1 text-right">{formatDelta(r.prevAcc, r.runAcc, "acc")}</td>
              <td className="py-1 text-right">{formatDelta(r.prevMs, r.runMs, "ms")}</td>
              <td className="py-1 text-right text-[color:var(--type-muted)]">{r.hits}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatDelta(prev: number | null, cur: number | null, kind: "acc" | "ms") {
  if (cur == null) return <span className="text-[color:var(--type-muted)]">—</span>;
  const curStr = kind === "acc" ? `${Math.round(cur * 100)}%` : `${Math.round(cur)}`;
  if (prev == null) {
    return <span className="text-[color:var(--type-text)]">{curStr}</span>;
  }
  // For acc, up is good. For ms, down is good.
  const delta = cur - prev;
  const better = kind === "acc" ? delta > 0.005 : delta < -2;
  const worse = kind === "acc" ? delta < -0.005 : delta > 2;
  const color = better
    ? "text-[color:var(--type-accent)]"
    : worse
      ? "text-[color:var(--type-error)]"
      : "text-[color:var(--type-muted)]";
  const sign = kind === "acc"
    ? `${delta >= 0 ? "+" : ""}${Math.round(delta * 100)}%`
    : `${delta >= 0 ? "+" : ""}${Math.round(delta)}ms`;
  return (
    <span className={color}>
      {curStr} <span className="text-[10px] opacity-70">({sign})</span>
    </span>
  );
}
