import { supabase } from "@/integrations/supabase/client";
import type { StatsBundle } from "./keystats";
import type { HeatmapSettings } from "./heatmap-settings";
import type { TypingResult } from "@/hooks/use-typing-engine";
import type { Mode } from "@/components/typing/types";

export interface CloudSettings {
  theme?: string | null;
  sound_profile?: string | null;
  heatmap_red?: number | null;
  heatmap_yellow?: number | null;
  heatmap_accuracy_weight?: number | null;
  ghost_enabled?: boolean | null;
}

export async function fetchCloudStats(userId: string): Promise<StatsBundle | null> {
  const { data, error } = await supabase
    .from("user_stats")
    .select("keys,bigrams,test_count")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    keys: (data.keys as StatsBundle["keys"]) ?? {},
    bigrams: (data.bigrams as StatsBundle["bigrams"]) ?? {},
    testCount: data.test_count ?? 0,
  };
}

export async function saveCloudStats(userId: string, bundle: StatsBundle): Promise<void> {
  await supabase.from("user_stats").upsert(
    {
      user_id: userId,
      keys: bundle.keys,
      bigrams: bundle.bigrams,
      test_count: bundle.testCount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

export async function fetchCloudSettings(userId: string): Promise<CloudSettings | null> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("theme,sound_profile,heatmap_red,heatmap_yellow,heatmap_accuracy_weight,ghost_enabled")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as CloudSettings;
}

export async function saveCloudSettings(userId: string, s: CloudSettings): Promise<void> {
  await supabase.from("user_settings").upsert(
    { user_id: userId, ...s, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
}

export async function insertTestHistory(
  userId: string,
  mode: Mode,
  result: TypingResult,
): Promise<void> {
  await supabase.from("test_history").insert({
    user_id: userId,
    mode,
    duration: result.elapsed,
    wpm: Math.round(result.wpm),
    raw_wpm: Math.round(result.rawWpm),
    accuracy: result.accuracy,
    correct_chars: result.correctChars,
    incorrect_chars: result.incorrectChars,
  });
}

// Merge two stats bundles (guest local into cloud). Additive on attempts/errors/timings.
export function mergeStats(a: StatsBundle, b: StatsBundle): StatsBundle {
  const mergeMap = (x: StatsBundle["keys"], y: StatsBundle["keys"]) => {
    const out: StatsBundle["keys"] = { ...x };
    for (const k of Object.keys(y)) {
      const p = out[k];
      const q = y[k];
      out[k] = p
        ? {
            attempts: p.attempts + q.attempts,
            errors: p.errors + q.errors,
            totalMs: p.totalMs + q.totalMs,
            intervals: p.intervals + q.intervals,
          }
        : { ...q };
    }
    return out;
  };
  return {
    keys: mergeMap(a.keys, b.keys),
    bigrams: mergeMap(a.bigrams, b.bigrams),
    testCount: a.testCount + b.testCount,
  };
}

// Simple trailing debouncer keyed by string id.
const timers: Record<string, ReturnType<typeof setTimeout>> = {};
export function debounced(key: string, ms: number, fn: () => void) {
  if (timers[key]) clearTimeout(timers[key]);
  timers[key] = setTimeout(fn, ms);
}
