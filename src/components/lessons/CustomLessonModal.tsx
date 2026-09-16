import { useEffect, useMemo, useState } from "react";
import { KeyboardPicker } from "./KeyboardPicker";
import { buildCharset } from "@/lib/custom-lessons/charset";
import { DIFFICULTIES, type Difficulty } from "@/lib/custom-lessons/difficulty";
import { loadStats, weakKeysWeighted } from "@/lib/keystats";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (input: {
    title: string;
    charset: string;
    seedPrompt: string;
    startLevel: Difficulty;
  }) => void;
}

export function CustomLessonModal({ open, onClose, onCreate }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [seedPrompt, setSeedPrompt] = useState("");
  const [startLevel, setStartLevel] = useState<Difficulty>("easy");
  const [weakKeys, setWeakKeys] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    try {
      // Slowest / most-fumbled keys straight from the live heatmap.
      setWeakKeys(weakKeysWeighted(loadStats(), 8));
    } catch {
      setWeakKeys([]);
    }
  }, [open]);

  useEffect(() => {
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);

  const charset = useMemo(() => buildCharset(selected), [selected]);

  if (!open) return null;

  function toggle(key: string) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function submit() {
    if (!charset) return;
    onCreate({ title: title.trim() || `${charset} focus`, charset, seedPrompt, startLevel });
    setSelected([]);
    setTitle("");
    setSeedPrompt("");
    setStartLevel("easy");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="build your lesson"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded border border-[color:var(--type-border)] bg-[color:var(--type-bg)] p-5 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-sm text-[color:var(--type-text)]">build your lesson</h2>
          <button
            type="button"
            aria-label="close"
            onClick={onClose}
            className="text-xs font-mono text-[color:var(--type-muted)] hover:text-[color:var(--type-text)]"
          >
            ✕
          </button>
        </div>

        <KeyboardPicker
          selected={selected}
          onToggle={toggle}
          onPreset={(chars) => setSelected(buildCharset(chars).split(""))}
          weakKeys={weakKeys}
        />

        <p className="text-[11px] font-mono text-[color:var(--type-muted)]">
          selected: {charset ? charset.split("").join(" ") : "none yet — tap keys above"}
        </p>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--type-muted)]">
            name (optional)
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="home row focus"
            className="bg-transparent border border-[color:var(--type-border)] rounded px-2 py-1.5 text-xs font-mono text-[color:var(--type-text)] focus:outline-none focus:border-[color:var(--type-accent)]"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--type-muted)]">
            theme (optional)
          </span>
          <input
            value={seedPrompt}
            onChange={(e) => setSeedPrompt(e.target.value)}
            placeholder="medical-ish words"
            className="bg-transparent border border-[color:var(--type-border)] rounded px-2 py-1.5 text-xs font-mono text-[color:var(--type-text)] focus:outline-none focus:border-[color:var(--type-accent)]"
          />
        </label>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--type-muted)]">
            start at
          </span>
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={startLevel === d}
              onClick={() => setStartLevel(d)}
              className={`text-[11px] font-mono px-2 py-1 rounded border transition ${
                startLevel === d
                  ? "border-[color:var(--type-accent)] text-[color:var(--type-accent)]"
                  : "border-[color:var(--type-border)] text-[color:var(--type-muted)] hover:text-[color:var(--type-text)]"
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={!charset}
          className="mt-1 text-xs font-mono px-3 py-2 rounded border border-[color:var(--type-accent)] text-[color:var(--type-accent)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[color:var(--type-accent)] hover:text-[color:var(--type-bg)] transition"
        >
          generate
        </button>
      </div>
    </div>
  );
}
