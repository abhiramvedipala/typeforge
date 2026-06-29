// Tiny WebAudio-synthesized keystroke sounds. No assets, three profiles.

export type SoundProfile = "off" | "mechanical" | "typewriter" | "soft";

const STORAGE_KEY = "typeforge-sound-v1";

export function loadSoundProfile(): SoundProfile {
  try {
    const v = localStorage.getItem(STORAGE_KEY) as SoundProfile | null;
    if (v === "mechanical" || v === "typewriter" || v === "soft" || v === "off") return v;
  } catch {}
  return "off";
}

export function saveSoundProfile(p: SoundProfile) {
  try {
    localStorage.setItem(STORAGE_KEY, p);
  } catch {}
}

let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function envelope(
  ac: AudioContext,
  freq: number,
  type: OscillatorType,
  attack: number,
  release: number,
  gain: number,
) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  g.gain.setValueAtTime(0, ac.currentTime);
  g.gain.linearRampToValueAtTime(gain, ac.currentTime + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + attack + release);
  osc.connect(g).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + attack + release + 0.02);
}

function noiseBurst(ac: AudioContext, duration: number, gain: number, filterFreq: number) {
  const len = Math.max(1, Math.floor(ac.sampleRate * duration));
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = filterFreq;
  f.Q.value = 1.2;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(ac.destination);
  src.start();
  src.stop(ac.currentTime + duration + 0.02);
}

export function playKeySound(profile: SoundProfile, isError: boolean) {
  if (profile === "off") return;
  const ac = getCtx();
  if (!ac) return;
  if (isError) {
    // distinct error tone across all profiles
    envelope(ac, 180, "sawtooth", 0.001, 0.12, 0.08);
    return;
  }
  switch (profile) {
    case "mechanical": {
      // sharp click: short noise burst + brief square thud
      noiseBurst(ac, 0.025, 0.12, 2400);
      envelope(ac, 700 + Math.random() * 120, "square", 0.001, 0.04, 0.04);
      break;
    }
    case "typewriter": {
      // mid-warm thunk with longer decay
      noiseBurst(ac, 0.04, 0.1, 1400);
      envelope(ac, 320 + Math.random() * 60, "triangle", 0.002, 0.08, 0.05);
      break;
    }
    case "soft": {
      // gentle muted blip
      envelope(ac, 520 + Math.random() * 40, "sine", 0.003, 0.05, 0.03);
      break;
    }
  }
}
