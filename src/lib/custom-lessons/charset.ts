// Charset handling for custom AI lessons.
//
// The whole feature rests on one invariant: generated text may contain ONLY
// characters from the selected charset. Everything here is about making that
// invariant cheap to state and impossible to bypass.

export interface KeyPreset {
  id: string;
  label: string;
  chars: string;
}

export const KEY_PRESETS: readonly KeyPreset[] = [
  { id: "home", label: "home", chars: "asdfghjkl" },
  { id: "top", label: "top", chars: "qwertyuiop" },
  { id: "bottom", label: "bottom", chars: "zxcvbnm" },
  { id: "nums", label: "nums", chars: "1234567890" },
  { id: "symbols", label: "symbols", chars: "-=[];',./" },
];

export const PICKER_ROWS: readonly (readonly string[])[] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";"],
  ["z", "x", "c", "v", "b", "n", "m", ",", ".", "/"],
  ["-", "=", "[", "]", "'"],
];

/** Normalize an arbitrary selection into a stable, deduped charset string. */
export function buildCharset(input: string | readonly string[]): string {
  const chars = typeof input === "string" ? input.split("") : input.join("").split("");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of chars) {
    const c = raw.toLowerCase();
    if (!c.trim()) continue; // spaces are added between words, never selectable
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out.join("");
}

function escapeForClass(charset: string): string {
  return charset.replace(/[\\\]^-]/g, (m) => `\\${m}`);
}

/** Anchored regex matching only words made entirely of charset characters. */
export function legalRegex(charset: string): RegExp {
  return new RegExp(`^[${escapeForClass(charset)}]+$`);
}

/** True when every character of `word` is in the charset (and word is non-empty). */
export function isLegal(word: string, charset: string): boolean {
  if (!word) return false;
  const set = new Set(charset.split(""));
  for (const c of word) if (!set.has(c)) return false;
  return true;
}

const VOWELS = "aeiouy";

export function vowelsIn(charset: string): string[] {
  return charset.split("").filter((c) => VOWELS.includes(c));
}

export function consonantsIn(charset: string): string[] {
  return charset.split("").filter((c) => /[a-z]/.test(c) && !VOWELS.includes(c));
}

/** A short human label, e.g. "asdfghjkl". */
export function charsetLabel(charset: string): string {
  return charset.split("").join(" ");
}
