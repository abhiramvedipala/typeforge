import { useEffect, useMemo, useRef, useState } from "react";

interface Props {
  text: string;
  input: string;
}

// Renders the words with per-char coloring and an animated caret.
export function TypingDisplay({ text, input }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const [caretStyle, setCaretStyle] = useState<{ left: number; top: number; height: number } | null>(
    null,
  );

  // Split text into words preserving positions
  const tokens = useMemo(() => {
    const out: { char: string; index: number }[] = [];
    for (let i = 0; i < text.length; i++) out.push({ char: text[i], index: i });
    // Add an extra slot for caret-at-end
    return out;
  }, [text]);

  // After render, position caret based on the current char
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const idx = input.length;
    const target = container.querySelector<HTMLElement>(`[data-i="${idx}"]`);
    if (target) {
      const cRect = container.getBoundingClientRect();
      const tRect = target.getBoundingClientRect();
      setCaretStyle({
        left: tRect.left - cRect.left,
        top: tRect.top - cRect.top,
        height: tRect.height,
      });
    } else {
      // caret at end
      const last = container.querySelector<HTMLElement>(`[data-i="${idx - 1}"]`);
      if (last) {
        const cRect = container.getBoundingClientRect();
        const tRect = last.getBoundingClientRect();
        setCaretStyle({
          left: tRect.right - cRect.left,
          top: tRect.top - cRect.top,
          height: tRect.height,
        });
      }
    }
  }, [input, text]);

  // Scroll active line into view roughly by translating container vertically
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    if (!caretStyle) return;
    const lineH = caretStyle.height;
    // Keep caret around the second visible line
    const desired = Math.max(0, caretStyle.top - lineH * 1);
    setScrollY(desired);
  }, [caretStyle]);

  return (
    <div className="relative w-full max-w-5xl mx-auto h-[10.5rem] overflow-hidden font-mono">
      <div
        ref={containerRef}
        className="absolute inset-0 text-3xl leading-[3.5rem] tracking-wide select-none transition-transform duration-150"
        style={{ transform: `translateY(${-scrollY}px)` }}
      >
        <div className="flex flex-wrap">
          {tokens.map(({ char, index }) => {
            let cls = "text-[color:var(--type-pending)]";
            const typed = input[index];
            if (typed !== undefined) {
              if (typed === char) cls = "text-[color:var(--type-correct)]";
              else
                cls =
                  char === " "
                    ? "text-[color:var(--type-error)] underline decoration-[color:var(--type-error)]"
                    : "text-[color:var(--type-error)]";
            }
            return (
              <span
                key={index}
                data-i={index}
                className={cls}
                style={{ whiteSpace: "pre" }}
              >
                {char}
              </span>
            );
          })}
          {/* Extra typed chars beyond text */}
          {input.length > text.length && (
            <span className="text-[color:var(--type-error)] opacity-60">
              {input.slice(text.length)}
            </span>
          )}
        </div>

        {caretStyle && (
          <span
            ref={caretRef}
            aria-hidden
            className="absolute w-[2px] bg-[color:var(--type-caret)] caret-blink rounded-sm"
            style={{
              left: caretStyle.left - 1,
              top: caretStyle.top,
              height: caretStyle.height * 0.85,
              transition: "left 80ms ease, top 120ms ease",
            }}
          />
        )}
      </div>
    </div>
  );
}
