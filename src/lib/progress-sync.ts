// One entry point for pulling a signed-in user's progress down to this device
// and pushing anything the account is missing: custom lesson tracks + attempts,
// the keyboard heatmap stats, and the recent-speed history that scales gates.

import { supabase } from "@/integrations/supabase/client";
import { fetchCloudStats, saveCloudStats } from "./cloud-sync";
import { loadStats, saveStats, type StatsBundle } from "./keystats";
import { loadWpmSamples, setWpmSamples } from "./typing-profile";
import { syncTracks } from "./custom-lessons/cloud";
import type { CustomTrack } from "./custom-lessons/tracks";

/**
 * Adopt the heatmap the account holds when it is ahead of this device, and push
 * this device's up when it is ahead. Deliberately not additive: the one-time
 * guest merge already ran on the practice page, so merging again on every load
 * would double-count keystrokes.
 */
export async function syncHeatmap(userId: string): Promise<StatsBundle> {
  const local = loadStats();
  try {
    const cloud = await fetchCloudStats(userId);
    if (!cloud) {
      if (local.testCount > 0) await saveCloudStats(userId, local);
      return local;
    }
    if (cloud.testCount >= local.testCount) {
      saveStats(cloud);
      return cloud;
    }
    await saveCloudStats(userId, local);
    return local;
  } catch {
    return local;
  }
}

/** Recent finished-run speeds from the account: normal tests + lesson drills. */
export async function syncWpmHistory(userId: string): Promise<number[]> {
  const local = loadWpmSamples();
  try {
    const [tests, drills] = await Promise.all([
      supabase
        .from("test_history")
        .select("wpm,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("custom_attempt")
        .select("wpm,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    const cloud = [...(tests.data ?? []), ...(drills.data ?? [])]
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      .map((r) => Number(r.wpm))
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(-30);
    if (cloud.length > local.length) {
      setWpmSamples(cloud);
      return cloud;
    }
    return local;
  } catch {
    return local;
  }
}

/** Pull everything at once; never throws, always returns usable tracks. */
export async function syncProgress(userId: string): Promise<CustomTrack[]> {
  const [tracks] = await Promise.all([
    syncTracks(userId),
    syncHeatmap(userId),
    syncWpmHistory(userId),
  ]);
  return tracks;
}
