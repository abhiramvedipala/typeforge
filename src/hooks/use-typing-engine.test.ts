import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { useTypingEngine, type TypingResult } from "./use-typing-engine";
import { randomWords } from "@/lib/words";

function press(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}

function typeString(s: string) {
  for (const ch of s) press(ch);
}

/** Harness mirrors <Index>'s time-mode append effect */
function useEngineWithAppend(initialText: string, appendThreshold = 80) {
  const [text, setText] = useState(initialText);
  const [finished, setFinished] = useState<TypingResult | null>(null);
  const engine = useTypingEngine({
    text,
    zen: true, // avoid auto-finish on completion so we can test buffer refills
    onComplete: (r) => setFinished(r),
  });
  // mirror the time-mode append effect
  if (!engine.finished && text.length - engine.input.length < appendThreshold) {
    // schedule outside render
    queueMicrotask(() =>
      setText((t) =>
        t.length - engine.input.length < appendThreshold ? t + " " + randomWords(60).join(" ") : t,
      ),
    );
  }
  return { engine, text, setText, finished };
}

describe("useTypingEngine — text extension", () => {
  beforeEach(() => vi.useRealTimers());
  afterEach(() => vi.restoreAllMocks());

  it("does NOT reset input/stats when text is extended (same prefix)", () => {
    const { result, rerender } = renderHook(
      ({ text }) => useTypingEngine({ text, zen: true }),
      { initialProps: { text: "hello world" } },
    );

    typeString("hello");
    expect(result.current.input).toBe("hello");
    expect(result.current.started).toBe(true);

    // extend the text — engine must preserve input/started
    rerender({ text: "hello world foo bar baz" });
    expect(result.current.input).toBe("hello");
    expect(result.current.started).toBe(true);
  });

  it("DOES reset when text is genuinely swapped (different prefix)", () => {
    const { result, rerender } = renderHook(
      ({ text }) => useTypingEngine({ text, zen: true }),
      { initialProps: { text: "hello world" } },
    );
    typeString("hel");
    expect(result.current.input).toBe("hel");

    rerender({ text: "totally different prompt" });
    expect(result.current.input).toBe("");
    expect(result.current.started).toBe(false);
  });
});

describe("useTypingEngine — end-of-text guards", () => {
  it("accepts keystrokes past end of text without throwing (extra chars)", () => {
    const { result } = renderHook(() => useTypingEngine({ text: "hi", zen: true }));
    expect(() => {
      typeString("hixyz");
    }).not.toThrow();
    expect(result.current.input.length).toBe(5);
    expect(result.current.live.correctChars).toBe(2);
    expect(result.current.live.extraChars).toBe(3);
  });

  it("backspace at empty input is a no-op and does not throw", () => {
    const { result } = renderHook(() => useTypingEngine({ text: "abc", zen: true }));
    expect(() => {
      press("Backspace");
      press("Backspace");
    }).not.toThrow();
    expect(result.current.input).toBe("");
  });

  it("finishTest is idempotent — calling twice does not crash or fire onComplete twice", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useTypingEngine({ text: "abc", onComplete }));
    typeString("a");
    act(() => result.current.finishTest());
    act(() => result.current.finishTest());
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("completing non-zen text triggers onComplete exactly once", async () => {
    const onComplete = vi.fn();
    renderHook(() => useTypingEngine({ text: "hi", onComplete }));
    typeString("hi");
    // finishTest is scheduled via setTimeout(..., 0)
    await new Promise((r) => setTimeout(r, 5));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

describe("time-mode buffer append behavior", () => {
  it("appends more text before the buffer runs out and lets typing continue seamlessly", async () => {
    // small initial buffer + small threshold so we exercise the append path fast
    const { result } = renderHook(() => useEngineWithAppend("aaaa bbbb cccc", 8));

    // Type past the point where the append effect should fire
    typeString("aaaa bbbb");
    // let queueMicrotask flush and React re-render
    await act(async () => {
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
    });

    // buffer must have grown, input preserved, engine still running
    expect(result.current.text.length).toBeGreaterThan("aaaa bbbb cccc".length);
    expect(result.current.text.startsWith("aaaa bbbb cccc")).toBe(true);
    expect(result.current.engine.input).toBe("aaaa bbbb");
    expect(result.current.engine.finished).toBe(false);

    // and we can keep typing into the freshly appended region without crashing
    expect(() => typeString(" ")).not.toThrow();
    expect(result.current.engine.input.length).toBe(10);
  });

  it("never fires onComplete just because the (extendable) buffer was consumed in zen mode", async () => {
    const { result } = renderHook(() => useEngineWithAppend("abcd efgh", 6));
    typeString("abcd efgh");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current.finished).toBeNull();
    expect(result.current.text.length).toBeGreaterThan("abcd efgh".length);
  });
});
