import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Toaster } from "sonner";
import { useTypingEngine, type TypingResult } from "@/hooks/use-typing-engine";
import { TypingDisplay } from "@/components/typing/TypingDisplay";
import { Results } from "@/components/typing/Results";
import { LiveStats } from "@/components/typing/LiveStats";
import { ThemeSwitcher } from "@/components/typing/ThemeSwitcher";
import { AccountMenu } from "@/components/typing/AccountMenu";
import { SoundToggle, useSoundProfile } from "@/components/typing/SoundToggle";
import { playKeySound } from "@/lib/sounds";
import { useAuth } from "@/hooks/use-auth";
import {
  LESSONS,
  lessonText,
  loadCompleted,
  markCompleted,
  type Lesson,
  type LessonGroup,
  type LessonRecord,
} from "@/lib/lessons";

export const Route = createFileRoute("/lessons")({
  head: () => ({
    meta: [
      { title: "Lessons — TypeForge" },
      {
        name: "description",
        content:
          "Structured touch-typing lessons — home row, top row and bottom row exercises that gradually increase in difficulty.",
      },
      { property: "og:title", content: "TypeForge Lessons — learn touch typing" },
      {
        property: "og:description",
        content:
          "Progressive home / top / bottom row typing exercises. Practice one row at a time and unlock the whole keyboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/lessons" }],
  }),
  component: LessonsPage,
});

const GROUPS: { key: LessonGroup; label: string }[] = [
  { key: "home", label: "home row" },
  { key: "top", label: "top row" },
  { key: "bottom", label: "bottom row" },
];

function LessonsPage() {
  const [activeId, setActiveId] = useState<string>(LESSONS[0].id);
  const [text, setText] = useState<string>("");
  const [restartTick, setRestartTick] = useState(0);
  const [result, setResult] = useState<TypingResult | null>(null);
  const [completed, setCompleted] = useState<Record<string, LessonRecord>>({});
  const [soundProfile, setSoundProfile] = useSoundProfile();
  const { user, loading: authLoading } = useAuth();

  const active = useMemo(
    () => LESSONS.find((l) => l.id === activeId) ?? LESSONS[0],
    [activeId],
  );

  useEffect(() => {
    setCompleted(loadCompleted());
  }, []);

  useEffect(() => {
    setText(lessonText(active));
    setResult(null);
    setRestartTick((t) => t + 1);
  }, [activeId, active]);

  const onComplete = useCallback(
    (r: TypingResult) => {
      setResult(r);
      const next = markCompleted(active.id, r.wpm, r.accuracy);
      setCompleted(next);
    },
    [active.id],
  );

  const engine = useTypingEngine({
    text,
    onComplete,
    onKeystroke: (k) => playKeySound(soundProfile, !k.correct),
  });

  const restart = useCallback(() => {
    setResult(null);
    setText(lessonText(active));
    setRestartTick((t) => t + 1);
  }, [active]);

  // Tab+Enter restart, same behaviour as practice page.
  useEffect(() => {
    let tabHeld = false;
    function down(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      )
        return;
      if (e.key === "Tab") {
        e.preventDefault();
        tabHeld = true;
      }
      if (e.key === "Enter" && tabHeld) {
        e.preventDefault();
        restart();
      }
    }
    function up(e: KeyboardEvent) {
      if (e.key === "Tab") tabHeld = false;
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [restart]);

  return (
    <div className="min-h-screen bg-[color:var(--type-bg)] text-[color:var(--type-text)] flex flex-col">
      <Toaster position="top-center" />
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 sm:px-6 py-4 max-w-6xl mx-auto w-full">
        <div className="flex items-baseline gap-4 min-w-0">
          <Link to="/" className="font-mono text-xl font-bold text-[color:var(--type-accent)]">
            type<span className="text-[color:var(--type-text)]">forge</span>
          </Link>
          <nav aria-label="Primary" className="flex items-center gap-3 text-xs font-mono">
            <Link
              to="/"
              className="text-[color:var(--type-muted)] hover:text-[color:var(--type-text)] transition"
            >
              practice
            </Link>
            <Link to="/lessons" className="text-[color:var(--type-accent)]">
              lessons
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-end">
          <SoundToggle value={soundProfile} onChange={setSoundProfile} />
          <ThemeSwitcher />
          <AccountMenu user={user} loading={authLoading} />
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row gap-6 px-4 sm:px-6 max-w-6xl mx-auto w-full pb-10">
        <aside className="md:w-64 shrink-0 md:sticky md:top-4 md:self-start">
          <div className="space-y-5">
            {GROUPS.map((g) => (
              <div key={g.key}>
                <h3 className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--type-muted)] mb-2">
                  {g.label}
                </h3>
                <ul className="space-y-1">
                  {LESSONS.filter((l) => l.group === g.key).map((l, idx) => {
                    const done = completed[l.id];
                    const isActive = l.id === activeId;
                    return (
                      <li key={l.id}>
                        <button
                          onClick={() => setActiveId(l.id)}
                          aria-pressed={isActive}
                          className={`w-full text-left px-3 py-2 rounded font-mono text-xs border transition ${
                            isActive
                              ? "border-[color:var(--type-accent)] text-[color:var(--type-accent)] bg-[color:var(--type-surface)]"
                              : "border-[color:var(--type-border)] text-[color:var(--type-muted)] hover:text-[color:var(--type-text)] hover:border-[color:var(--type-accent)]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate">
                              {idx + 1}. {l.title}
                            </span>
                            {done && (
                              <span
                                aria-label="completed"
                                className="text-[color:var(--type-accent)] shrink-0"
                              >
                                ✓
                              </span>
                            )}
                          </div>
                          {done && (
                            <div className="mt-1 text-[10px] text-[color:var(--type-muted)]">
                              best {done.wpm} wpm · {Math.round(done.accuracy)}%
                            </div>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        <section className="flex-1 flex flex-col items-center gap-5">
          <div className="text-center max-w-xl">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--type-muted)]">
              {active.group} row
            </div>
            <h2 className="font-mono text-lg text-[color:var(--type-text)] mt-1">
              {active.title}
            </h2>
            <p className="text-xs text-[color:var(--type-muted)] mt-1">{active.description}</p>
            <p className="text-[10px] text-[color:var(--type-muted)] mt-2 font-mono">
              keys:{" "}
              <span className="text-[color:var(--type-accent)]">{active.letters.join(" ")}</span>
            </p>
          </div>

          {!result && (
            <>
              <div className="h-10 flex items-center">
                {engine.started && !engine.finished && (
                  <LiveStats
                    wpm={engine.live.wpm}
                    accuracy={engine.live.accuracy}
                    timer={`${(engine.elapsedMs / 1000).toFixed(1)}s`}
                  />
                )}
              </div>
              <TypingDisplay
                key={restartTick}
                text={text}
                input={engine.input}
                ghostIdx={null}
              />
              <button
                onClick={restart}
                className="text-xs font-mono px-3 py-1.5 rounded border border-[color:var(--type-border)] text-[color:var(--type-muted)] hover:text-[color:var(--type-text)] transition"
              >
                new text
              </button>
            </>
          )}

          {result && (
            <Results
              result={result}
              onRestart={restart}
              onNew={restart}
              isPersonalRecord={false}
              previousBestWpm={null}
              smartTargets={null}
            />
          )}
        </section>
      </main>

      <footer className="px-6 py-4 text-center text-xs text-[color:var(--type-muted)] font-mono">
        <span className="kbd">tab</span> + <span className="kbd">enter</span> restart · pick a
        lesson and just start typing
      </footer>
    </div>
  );
}
