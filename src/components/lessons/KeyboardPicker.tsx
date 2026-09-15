import { KEY_PRESETS, PICKER_ROWS } from "@/lib/custom-lessons/charset";

interface Props {
  selected: string[];
  onToggle: (key: string) => void;
  onPreset: (chars: string) => void;
  weakKeys: string[];
}

export function KeyboardPicker({ selected, onToggle, onPreset, weakKeys }: Props) {
  const set = new Set(selected);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {KEY_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPreset(p.chars)}
            className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border border-[color:var(--type-border)] text-[color:var(--type-muted)] hover:text-[color:var(--type-text)] transition"
          >
            {p.label}
          </button>
        ))}
        {weakKeys.length > 0 && (
          <button
            type="button"
            onClick={() => onPreset(weakKeys.join(""))}
            className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border border-[color:var(--type-accent)] text-[color:var(--type-accent)] transition"
          >
            my weak keys
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1 overflow-x-auto">
        {PICKER_ROWS.map((row, i) => (
          <div key={i} className="flex gap-1" style={{ paddingLeft: `${i * 10}px` }}>
            {row.map((k) => {
              const on = set.has(k);
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  aria-label={`toggle key ${k}`}
                  onClick={() => onToggle(k)}
                  className={`w-8 h-8 shrink-0 rounded font-mono text-xs border transition ${
                    on
                      ? "border-[color:var(--type-accent)] text-[color:var(--type-bg)] bg-[color:var(--type-accent)]"
                      : "border-[color:var(--type-border)] text-[color:var(--type-muted)] hover:text-[color:var(--type-text)]"
                  }`}
                >
                  {k}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
