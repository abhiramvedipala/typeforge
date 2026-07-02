import { useEffect, useMemo, useRef, useState } from "react";

interface Props {
  text: string;
  input: string;
  ghostIdx?: number | null;
}

export function TypingDisplay({ text, input, ghostIdx }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [caretStyle, setCaretStyle] = useState<{ left: number; top: number; height: number } | null>(
    null,
  );
  const [ghostStyle, setGhostStyle] = useState<{
    left: number;
    top: number;
    height: number;
  } | null>(null);

  const words = useMemo(() => {
    const out: { chars: { char: string; index: number }[]; isSpace: boolean }[] = [];
    let i = 0;
    while (i < text.length) {
      if (text[i] === " ") {
        out.push({ chars: [{ char: " ", index: i }], isSpace: true });
        i++;
      } else {
        const group: { char: string; index: number }[] = [];
        while (i < text.length && text[i] !== " ") {
          group.push({ char: text[i], index: i });
          i++;
        }
        out.push({ chars: group, isSpace: false });
      }
    }
    return out;
  }, [text]);

  function positionFor(idx: number) {
    const container = containerRef.current;
    if (!container) return null;
    const target = container.querySelector<HTMLElement>(`[data-i="${idx}"]`);
    const cRect = container.getBoundingClientRect();
    if (target) {
      const tRect = target.getBoundingClientRect();
      return {
        left: tRect.left - cRect.left,
        top: tRect.top - cRect.top,
        height: tRect.height,
      };
    }
    const last = container.querySelector<HTMLElement>(`[data-i="${idx - 1}"]`);
    if (last) {
      const tRect = last.getBoundingClientRect();
      return {
        left: tRect.right - cRect.left,
        top: tRect.top - cRect.top,
        height: tRect.height,
      };
    }
    return null;
  }

  useEffect(() => {
    setCaretStyle(positionFor(input.length));
  }, [input, text]);

  useEffect(() => {
    if (ghostIdx == null) {
      setGhostStyle(null);
      return;
    }
    setGhostStyle(positionFor(Math.min(ghostIdx, text.length)));
  }, [ghostIdx, text, input.length]);

  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    if (!caretStyle) return;
    const lineH = caretStyle.height;
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
              <span key={index} data-i={index} className={cls} style={{ whiteSpace: "pre" }}>
                {char}
              </span>
            );
          })}
          {input.length > text.length && (
            <span className="text-[color:var(--type-error)] opacity-60">
              {input.slice(text.length)}
            </span>
          )}
        </div>

        {ghostStyle && (
          <span
            aria-hidden
            className="absolute w-[2px] rounded-sm"
            style={{
              left: ghostStyle.left - 1,
              top: ghostStyle.top,
              height: ghostStyle.height * 0.85,
              background: "var(--type-muted)",
              opacity: 0.55,
              boxShadow: "0 0 6px var(--type-muted)",
              transition: "left 80ms linear, top 120ms linear",
            }}
          />
        )}

        {caretStyle && (
          <span
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
