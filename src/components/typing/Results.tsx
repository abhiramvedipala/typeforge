import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import type { TypingResult } from "@/hooks/use-typing-engine";

interface Props {
  result: TypingResult;
  onRestart: () => void;
  onNew: () => void;
}

export function Results({ result, onRestart, onNew }: Props) {
  const data = result.samples.length
    ? result.samples
    : [{ t: 0, wpm: result.wpm, raw: result.rawWpm }];

  return (
    <div className="w-full max-w-5xl mx-auto py-12 px-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        <Stat label="wpm" value={result.wpm} big />
        <Stat label="accuracy" value={`${result.accuracy}%`} big />
        <Stat label="raw" value={result.rawWpm} />
        <Stat label="time" value={`${result.elapsed.toFixed(1)}s`} />
      </div>

      <div className="h-64 w-full mb-8 border border-[color:var(--type-border)] rounded-lg p-4 bg-[color:var(--type-surface)]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--type-border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="t"
              stroke="var(--type-muted)"
              tick={{ fontSize: 12 }}
              label={{ value: "seconds", position: "insideBottom", offset: -2, fill: "var(--type-muted)" }}
            />
            <YAxis stroke="var(--type-muted)" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                background: "var(--type-surface)",
                border: "1px solid var(--type-border)",
                color: "var(--type-text)",
              }}
            />
            <Line
              type="monotone"
              dataKey="wpm"
              stroke="var(--type-accent)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="raw"
              stroke="var(--type-muted)"
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8 text-sm">
        <Stat label="correct" value={result.correctChars} />
        <Stat label="incorrect" value={result.incorrectChars} />
        <Stat label="extra" value={result.extraChars} />
        <Stat label="missed" value={result.missedChars} />
      </div>

      <div className="flex gap-3 justify-center">
        <button
          onClick={onRestart}
          className="px-5 py-2 rounded-md border border-[color:var(--type-border)] text-[color:var(--type-text)] hover:bg-[color:var(--type-surface)] transition"
        >
          restart (same text)
        </button>
        <button
          onClick={onNew}
          className="px-5 py-2 rounded-md bg-[color:var(--type-accent)] text-[color:var(--type-bg)] hover:opacity-90 transition"
        >
          next test (Tab + Enter)
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, big }: { label: string; value: string | number; big?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wider text-[color:var(--type-muted)]">{label}</span>
      <span
        className={`font-mono text-[color:var(--type-accent)] ${big ? "text-5xl" : "text-2xl"} leading-tight`}
      >
        {value}
      </span>
    </div>
  );
}
