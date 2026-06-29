import { useState } from "react";

interface Props {
  onText: (text: string) => void;
}

export function CustomTextInput({ onText }: Props) {
  const [val, setVal] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const t = val.trim().replace(/\s+/g, " ");
        if (t) onText(t);
      }}
      className="w-full max-w-2xl mx-auto flex flex-col gap-2"
    >
      <textarea
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="paste your own text to type..."
        rows={4}
        className="w-full px-3 py-2 rounded-md bg-[color:var(--type-surface)] border border-[color:var(--type-border)] text-[color:var(--type-text)] placeholder:text-[color:var(--type-muted)] font-mono text-sm outline-none focus:border-[color:var(--type-accent)] resize-none"
      />
      <button
        type="submit"
        className="self-end px-4 py-1.5 rounded-md bg-[color:var(--type-accent)] text-[color:var(--type-bg)] font-mono text-sm hover:opacity-90 transition"
      >
        load
      </button>
    </form>
  );
}
