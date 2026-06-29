export interface HeatmapSettings {
  /** Health score (0..1) below which a key is shown red. */
  redThreshold: number;
  /** Health score (0..1) below which a key is shown yellow (and above red). */
  yellowThreshold: number;
  /** Weight given to accuracy in the health score (0..1). Speed weight = 1 - accuracyWeight. */
  accuracyWeight: number;
}

export const DEFAULT_HEATMAP_SETTINGS: HeatmapSettings = {
  redThreshold: 0.4,
  yellowThreshold: 0.7,
  accuracyWeight: 0.65,
};

const KEY = "typeforge:heatmap-settings:v1";

export function loadHeatmapSettings(): HeatmapSettings {
  if (typeof window === "undefined") return DEFAULT_HEATMAP_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_HEATMAP_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<HeatmapSettings>;
    return {
      redThreshold: clamp01(parsed.redThreshold ?? DEFAULT_HEATMAP_SETTINGS.redThreshold),
      yellowThreshold: clamp01(parsed.yellowThreshold ?? DEFAULT_HEATMAP_SETTINGS.yellowThreshold),
      accuracyWeight: clamp01(parsed.accuracyWeight ?? DEFAULT_HEATMAP_SETTINGS.accuracyWeight),
    };
  } catch {
    return DEFAULT_HEATMAP_SETTINGS;
  }
}

export function saveHeatmapSettings(s: HeatmapSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
