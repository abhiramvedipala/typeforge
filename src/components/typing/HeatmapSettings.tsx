import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_HEATMAP_SETTINGS,
  saveHeatmapSettings,
  type HeatmapSettings as Settings,
} from "@/lib/heatmap-settings";

interface Props {
  value: Settings;
  onChange: (next: Settings) => void;
  onResetStats?: () => void;
}

export function HeatmapSettings({ value, onChange, onResetStats }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function update(patch: Partial<Settings>) {
    let next = { ...value, ...patch };
    // Keep red <= yellow with a small gap.
    if (next.redThreshold > next.yellowThreshold - 0.05) {
      if (patch.redThreshold != null) {
        next.yellowThreshold = Math.min(1, next.redThreshold + 0.05);
      } else if (patch.yellowThreshold != null) {
        next.redThreshold = Math.max(0, next.yellowThreshold - 0.05);
      }
    }
    onChange(next);
    saveHeatmapSettings(next);
  }

  function reset() {
    onChange(DEFAULT_HEATMAP_SETTINGS);
    saveHeatmapSettings(DEFAULT_HEATMAP_SETTINGS);
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="px-2 py-1 text-[11px] rounded border border-[color:var(--type-border)] text-[color:var(--type-muted)] hover:text-[color:var(--type-text)] hover:border-[color:var(--type-text)] transition-colors font-mono"
        aria-expanded={open}
      >
        heatmap settings
      </button>
      {open && (
        <div
          className="absolute right-0 mt-2 w-72 z-50 p-3 rounded-md border border-[color:var(--type-border)] bg-[color:var(--type-surface)] text-[color:var(--type-text)] shadow-lg font-mono text-[11px]"
          role="dialog"
        >
          <Slider
            label="red below"
            suffix={`${Math.round(value.redThreshold * 100)}%`}
            min={0}
            max={1}
            step={0.01}
            value={value.redThreshold}
            onChange={(v) => update({ redThreshold: v })}
          />
          <Slider
            label="yellow below"
            suffix={`${Math.round(value.yellowThreshold * 100)}%`}
            min={0}
            max={1}
            step={0.01}
            value={value.yellowThreshold}
            onChange={(v) => update({ yellowThreshold: v })}
          />
          <Slider
            label="weighting"
            suffix={`acc ${Math.round(value.accuracyWeight * 100)}% / spd ${Math.round(
              (1 - value.accuracyWeight) * 100,
            )}%`}
            min={0}
            max={1}
            step={0.05}
            value={value.accuracyWeight}
            onChange={(v) => update({ accuracyWeight: v })}
          />
          <div className="flex justify-between items-center mt-2 pt-2 border-t border-[color:var(--type-border)]">
            <span className="text-[color:var(--type-muted)]">
              keys above yellow = green
            </span>
            <button
              type="button"
              onClick={reset}
              className="text-[color:var(--type-muted)] hover:text-[color:var(--type-text)] underline"
            >
              reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Slider({
  label,
  suffix,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  suffix: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block mb-2 last:mb-0">
      <div className="flex justify-between mb-1">
        <span>{label}</span>
        <span className="text-[color:var(--type-muted)]">{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-[color:var(--type-text)]"
      />
    </label>
  );
}
