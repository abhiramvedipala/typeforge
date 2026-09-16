import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { loadTracks, type CustomTrack } from "@/lib/custom-lessons/tracks";
import { planForTrack, type TrackPlan } from "@/lib/custom-lessons/plan";
import { syncProgress } from "@/lib/progress-sync";
import { averageWpm } from "@/lib/typing-profile";
import { useAuth } from "@/hooks/use-auth";
import { PASSES_TO_ADVANCE } from "@/lib/custom-lessons/difficulty";

export const Route = createFileRoute("/lessons/plan")({
  head: () => ({
    meta: [
      { title: "Lesson plan — TypeForge" },
      {
        name: "description",
        content:
          "See how many drills are left in each level of your custom typing lessons and when you should finish each tier at your current pace.",
      },
      { property: "og:title", content: "Your TypeForge lesson plan" },
      {
        property: "og:description",
        content:
          "Drills remaining per level, pass gates tuned to your real speed, and target dates for each tier of your custom typing lessons.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LessonPlanPage,
});

function prettyDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function LessonPlanPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [plans, setPlans] = useState<TrackPlan[] | null>(null);

  function build(tracks: CustomTrack[]) {
    const avg = averageWpm();
    setPlans(tracks.map((t) => planForTrack(t, { avgWpm: avg })));
  }

  useEffect(() => {
    build(loadTracks());
  }, []);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void syncProgress(user.id).then((merged) => {
      if (alive) build(merged);
    });
    return () => {
      alive = false;
    };
  }, [user]);

  const avg = averageWpm();

  return (
    <div className="flex flex-col gap-6 py-6">
      <div>
        <h1 className="font-mono text-lg text-[color:var(--type-text)]">lesson plan</h1>
        <p className="text-xs text-[color:var(--type-muted)] mt-1">
          drills left in each level and the date you'd finish at your current pace
        </p>
        {avg > 0 && (
          <p className="text-[11px] font-mono text-[color:var(--type-muted)] mt-1">
            your recent average: {Math.round(avg)} wpm — pass bars scale with it
          </p>
        )}
      </div>

      {plans && plans.length === 0 && (
        <p className="text-xs font-mono text-[color:var(--type-muted)]">
          no custom lessons yet —{" "}
          <Link to="/lessons" className="text-[color:var(--type-accent)]">
            build one
          </Link>
        </p>
      )}

      <div className="flex flex-col gap-4">
        {(plans ?? []).map((p) => (
          <section
            key={p.track.id}
            className="rounded border border-[color:var(--type-border)] p-4 flex flex-col gap-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <button
                type="button"
                onClick={() =>
                  navigate({
                    to: "/lessons/custom/$trackId",
                    params: { trackId: p.track.id },
                  })
                }
                className="font-mono text-sm text-[color:var(--type-text)] hover:text-[color:var(--type-accent)] transition text-left"
              >
                {p.track.title}
                <span className="block text-[11px] text-[color:var(--type-muted)]">
                  {p.track.charset.split("").join(" ")}
                </span>
              </button>
              <span className="text-[11px] font-mono text-[color:var(--type-muted)]">
                {p.completed
                  ? "complete"
                  : `${p.drillsLeft} drills left · target ${prettyDate(p.finishBy)}`}
              </span>
            </div>

            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="text-[color:var(--type-muted)] text-left">
                  <th className="font-normal py-1">level</th>
                  <th className="font-normal py-1">passes left</th>
                  <th className="font-normal py-1">drills left</th>
                  <th className="font-normal py-1">pass bar</th>
                  <th className="font-normal py-1">finish by</th>
                </tr>
              </thead>
              <tbody>
                {p.levels.map((l) => (
                  <tr
                    key={l.level}
                    className={
                      l.status === "current"
                        ? "text-[color:var(--type-accent)]"
                        : l.status === "done"
                          ? "text-[color:var(--type-muted)] line-through"
                          : "text-[color:var(--type-muted)]"
                    }
                  >
                    <td className="py-1">{l.level}</td>
                    <td className="py-1">
                      {l.status === "done" ? "—" : `${l.passesLeft} / ${PASSES_TO_ADVANCE}`}
                    </td>
                    <td className="py-1">{l.drillsLeft || "—"}</td>
                    <td className="py-1">
                      {l.gate.wpm} wpm · {l.gate.accuracy}%
                    </td>
                    <td className="py-1">{prettyDate(l.finishBy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="text-[10px] font-mono text-[color:var(--type-muted)]">
              pace: {p.drillsPerDay.toFixed(1)} drills/day · pass rate{" "}
              {Math.round(p.passRate * 100)}%
            </p>
          </section>
        ))}
      </div>

      <Link to="/lessons" className="text-xs font-mono text-[color:var(--type-muted)] hover:text-[color:var(--type-text)] transition">
        ← back to lessons
      </Link>
    </div>
  );
}
