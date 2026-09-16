// Cloud persistence for custom lesson tracks. localStorage stays the source of
// truth for the running UI (so guests work unchanged); when signed in we mirror
// tracks/attempts to Supabase and merge on load.

import { supabase } from "@/integrations/supabase/client";
import { DIFFICULTIES, type Difficulty } from "./difficulty";
import { loadTracks, saveTracks, type CustomAttempt, type CustomTrack } from "./tracks";

function asDifficulty(v: unknown): Difficulty {
  return DIFFICULTIES.includes(v as Difficulty) ? (v as Difficulty) : "easy";
}

/** Pick the further-along version of the same track. */
function pickBetter(a: CustomTrack, b: CustomTrack): CustomTrack {
  const rank = (t: CustomTrack) =>
    DIFFICULTIES.indexOf(t.currentLevel) * 1000 + t.stars * 10 + t.streak;
  const winner = rank(b) > rank(a) ? b : a;
  const attempts = [...a.attempts, ...b.attempts]
    .filter(
      (x, i, arr) => arr.findIndex((y) => y.createdAt === x.createdAt && y.wpm === x.wpm) === i,
    )
    .sort((x, y) => x.createdAt.localeCompare(y.createdAt))
    .slice(-50);
  return { ...winner, attempts };
}

/**
 * Fetch cloud tracks, merge with local ones, persist locally and push anything
 * the cloud is missing. Returns the merged list (local list on any failure).
 */
export async function syncTracks(userId: string): Promise<CustomTrack[]> {
  const local = loadTracks();
  try {
    const [{ data: rows, error }, { data: attemptRows }] = await Promise.all([
      supabase
        .from("custom_track")
        .select("id,title,charset,seed_prompt,current_level,stars,streak,created_at")
        .eq("user_id", userId),
      supabase
        .from("custom_attempt")
        .select("track_id,wpm,accuracy,errors_by_key,passed,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
    ]);
    if (error || !rows) return local;

    const attemptsByTrack = new Map<string, CustomAttempt[]>();
    for (const a of attemptRows ?? []) {
      const list = attemptsByTrack.get(a.track_id) ?? [];
      list.push({
        wpm: Number(a.wpm),
        accuracy: Number(a.accuracy),
        errorsByKey: (a.errors_by_key as Record<string, number>) ?? {},
        passed: Boolean(a.passed),
        createdAt: a.created_at,
      });
      attemptsByTrack.set(a.track_id, list);
    }

    const remote: CustomTrack[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      charset: r.charset,
      seedPrompt: r.seed_prompt ?? "",
      currentLevel: asDifficulty(r.current_level),
      stars: r.stars ?? 0,
      streak: r.streak ?? 0,
      attempts: (attemptsByTrack.get(r.id) ?? []).slice(-50),
      createdAt: r.created_at,
    }));

    const byId = new Map<string, CustomTrack>();
    for (const t of remote) byId.set(t.id, t);
    const needsPush: CustomTrack[] = [];
    for (const t of local) {
      const existing = byId.get(t.id);
      if (!existing) {
        byId.set(t.id, t);
        needsPush.push(t);
      } else {
        byId.set(t.id, pickBetter(existing, t));
      }
    }

    const merged = [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    saveTracks(merged);
    await Promise.all(needsPush.map((t) => pushTrack(userId, t)));
    return merged;
  } catch {
    return local;
  }
}

/** Upsert a track's current progress. */
export async function pushTrack(userId: string, track: CustomTrack): Promise<void> {
  try {
    await supabase.from("custom_track").upsert(
      {
        id: track.id,
        user_id: userId,
        title: track.title,
        charset: track.charset,
        seed_prompt: track.seedPrompt,
        current_level: track.currentLevel,
        stars: track.stars,
        streak: track.streak,
        created_at: track.createdAt,
      },
      { onConflict: "id" },
    );
  } catch {
    // non-blocking
  }
}

export async function removeTrack(userId: string, trackId: string): Promise<void> {
  try {
    await supabase.from("custom_track").delete().eq("id", trackId).eq("user_id", userId);
  } catch {
    // non-blocking
  }
}

export async function pushAttempt(
  userId: string,
  trackId: string,
  difficulty: Difficulty,
  attempt: CustomAttempt,
): Promise<void> {
  try {
    await supabase.from("custom_attempt").insert({
      track_id: trackId,
      user_id: userId,
      difficulty,
      wpm: attempt.wpm,
      accuracy: attempt.accuracy,
      errors_by_key: attempt.errorsByKey,
      passed: attempt.passed,
      created_at: attempt.createdAt,
    });
  } catch {
    // non-blocking
  }
}
