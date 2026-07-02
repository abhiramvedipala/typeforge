import { useEffect, useState } from "react";
import { loadSoundProfile, saveSoundProfile, type SoundProfile } from "@/lib/sounds";

const OPTS: { id: SoundProfile; label: string }[] = [
  { id: "off", label: "off" },
  { id: "mechanical", label: "mech" },
  { id: "typewriter", label: "type" },
  { id: "soft", label: "soft" },
];

interface Props {
  value: SoundProfile;
  onChange: (p: SoundProfile) => void;
}

export function SoundToggle({ value, onChange }: Props) {
  // hydrate from storage on mount in parent; this just renders.
  return (
    <div role="radiogroup" aria-label="Keystroke sound profile" className="flex items-center gap-1 text-xs">
      <span className="text-[color:var(--type-muted)] hidden md:inline mr-1" aria-hidden="true">sound</span>
      {OPTS.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={value === o.id}
          aria-label={`Sound: ${o.label}`}
          onClick={() => {
            onChange(o.id);
            saveSoundProfile(o.id);
          }}
          className={`px-2 py-1 rounded transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--type-accent)] ${
            value === o.id
              ? "text-[color:var(--type-accent)] bg-[color:var(--type-surface)]"
              : "text-[color:var(--type-muted)] hover:text-[color:var(--type-text)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>

  );
}

export function useSoundProfile(): [SoundProfile, (p: SoundProfile) => void] {
  const [profile, setProfile] = useState<SoundProfile>("off");
  useEffect(() => {
    setProfile(loadSoundProfile());
  }, []);
  return [profile, setProfile];
}
