import type { Mode, TimeOption, WordsOption } from "./types";

interface Props {
  mode: Mode;
  setMode: (m: Mode) => void;
  timeValue: TimeOption;
  setTimeValue: (v: TimeOption) => void;
  wordsValue: WordsOption;
  setWordsValue: (v: WordsOption) => void;
}

const TIME_OPTS: TimeOption[] = [15, 30, 60, 120];
const WORD_OPTS: WordsOption[] = [10, 25, 50, 100];

export function ModeBar({
  mode,
  setMode,
  timeValue,
  setTimeValue,
  wordsValue,
  setWordsValue,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 px-3 py-2 rounded-lg bg-[color:var(--type-surface)] border border-[color:var(--type-border)] text-sm">
      <ModeBtn active={mode === "time"} onClick={() => setMode("time")}>time</ModeBtn>
      <ModeBtn active={mode === "words"} onClick={() => setMode("words")}>words</ModeBtn>
      <ModeBtn active={mode === "quote"} onClick={() => setMode("quote")}>quote</ModeBtn>
      <ModeBtn active={mode === "zen"} onClick={() => setMode("zen")}>zen</ModeBtn>
      <ModeBtn active={mode === "ai"} onClick={() => setMode("ai")}>ai</ModeBtn>
      <ModeBtn active={mode === "drill"} onClick={() => setMode("drill")}>drill</ModeBtn>
      <ModeBtn active={mode === "smart"} onClick={() => setMode("smart")}>smart</ModeBtn>
      <ModeBtn active={mode === "custom"} onClick={() => setMode("custom")}>custom</ModeBtn>

      <span className="w-px h-5 bg-[color:var(--type-border)] mx-2" />

      {mode === "time" &&
        TIME_OPTS.map((t) => (
          <ModeBtn key={t} active={timeValue === t} onClick={() => setTimeValue(t)}>
            {t}
          </ModeBtn>
        ))}
      {mode === "words" &&
        WORD_OPTS.map((w) => (
          <ModeBtn key={w} active={wordsValue === w} onClick={() => setWordsValue(w)}>
            {w}
          </ModeBtn>
        ))}
    </div>
  );
}

function ModeBtn({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded transition font-mono ${
        active
          ? "text-[color:var(--type-accent)]"
          : "text-[color:var(--type-muted)] hover:text-[color:var(--type-text)]"
      }`}
    >
      {children}
    </button>
  );
}
