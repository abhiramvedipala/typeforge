import { useState } from "react";

interface Props {
  selected: string[];
  onChange: (letters: string[]) => void;
  onGenerate: () => void;
}

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

export function DrillSelector({ selected, onChange, onGenerate }: Props) {
  const [custom, setCustom] = useState("");
  const set = new Set(selected);

  function toggle(letter: string) {
    const next = new Set(set);
    if (next.has(letter)) next.delete(letter);
    else next.add(letter);
    onChange([...next]);
  }

  function applyCustom() {
    const letters = custom
      .toLowerCase()
      .split("")
      .filter((ch) => /[a-z0-9]/.test(ch));
    onChange([...new Set(letters)]);
  }

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-3">
      <div className="flex flex-col items-center gap-1.5">
        {ROWS.map((row, i) => (
          <div key={i} className="flex gap-1.5" style={{ marginLeft: i * 14 }}>
            {row.split("").map((ch) => {
              const active = set.has(ch);
              return (
                <button
                  key={ch}
                  onClick={() => toggle(ch)}
                  className={`w-9 h-9 rounded-md font-mono text-sm transition border ${
                    active
                      ? "bg-[color:var(--type-accent)] text-[color:var(--type-bg)] border-[color:var(--type-accent)]"
                      : "bg-[color:var(--type-surface)] text-[color:var(--type-text)] border-[color:var(--type-border)] hover:border-[color:var(--type-accent)]"
                  }`}
                >
                  {ch}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="custom letters (e.g. qzx)"
          className="px-2 py-1.5 rounded-md bg-[color:var(--type-surface)] border border-[color:var(--type-border)] text-[color:var(--type-text)] font-mono text-xs outline-none w-48"
        />
        <button
          onClick={applyCustom}
          className="px-3 py-1.5 rounded-md border border-[color:var(--type-border)] text-[color:var(--type-text)] text-xs hover:bg-[color:var(--type-surface)] transition"
        >
          apply
        </button>
        <button
          onClick={() => onChange([])}
          className="px-3 py-1.5 rounded-md text-[color:var(--type-muted)] text-xs hover:text-[color:var(--type-text)] transition"
        >
          clear
        </button>
        <button
          onClick={onGenerate}
          disabled={selected.length === 0}
          className="px-3 py-1.5 rounded-md bg-[color:var(--type-accent)] text-[color:var(--type-bg)] text-xs disabled:opacity-50 hover:opacity-90 transition"
        >
          new drill
        </button>
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-[color:var(--type-muted)]">
          drilling: <span className="text-[color:var(--type-accent)] font-mono">{selected.join(" ")}</span>
        </p>
      )}
    </div>
  );
}
