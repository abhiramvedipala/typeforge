import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ThemeSwitcher } from "@/components/typing/ThemeSwitcher";
import { AccountMenu } from "@/components/typing/AccountMenu";
import { SoundToggle, useSoundProfile } from "@/components/typing/SoundToggle";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/lessons")({
  head: () => ({
    meta: [
      { title: "Lessons — TypeForge" },
      {
        name: "description",
        content:
          "A structured, TypingClub-style touch-typing course: 30 lessons across the home, top and bottom rows, with finger guidance and progressive difficulty.",
      },
      { property: "og:title", content: "TypeForge Lessons — learn touch typing" },
      {
        property: "og:description",
        content:
          "Learn to touch-type from scratch. Thirty lessons, finger-guided keyboard, and difficulty that ramps within and across lessons.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/lessons" }],
  }),
  component: LessonsLayout,
});

// Shared chrome for the lessons index and player, kept identical to the
// practice page's header so the feature reads as native, not bolted on.
function LessonsLayout() {
  const [soundProfile, setSoundProfile] = useSoundProfile();
  const { user, loading: authLoading } = useAuth();

  return (
    <div className="min-h-screen bg-[color:var(--type-bg)] text-[color:var(--type-text)] flex flex-col">
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

      <main className="flex-1 flex flex-col px-4 sm:px-6 max-w-6xl mx-auto w-full pb-10">
        <Outlet />
      </main>

      <footer className="px-6 py-4 text-center text-xs text-[color:var(--type-muted)] font-mono">
        <span className="kbd">tab</span> + <span className="kbd">enter</span> restart · keep your
        eyes on the screen
      </footer>
    </div>
  );
}
