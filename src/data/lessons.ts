// The touch-typing curriculum: 30 lessons across 3 stages, letters only.
//
// Design notes
// ------------
// Keys are introduced strongest-finger-first (index → middle → ring → pinky)
// and in left/right mirrored pairs so both hands develop together. The inward
// index stretches (g/h, t/y, b) come last within each row because they are the
// hardest reach.
//
// Adding a Stage 4 (numbers) or Stage 5 (punctuation) means appending a STAGES
// entry and more SPEC rows — nothing else in this file is stage-specific.

export type StageId = "home" | "top" | "bottom";

export type FingerId =
  | "left-pinky"
  | "left-ring"
  | "left-middle"
  | "left-index"
  | "right-index"
  | "right-middle"
  | "right-ring"
  | "right-pinky"
  | "thumb";

/** Which phase of a lesson a chunk of generated text belongs to. */
export type PhaseId = "isolate" | "alternate" | "cluster" | "blend" | "words";

export type PhaseWeights = Record<PhaseId, number>;

export interface Stage {
  id: StageId;
  label: string;
  /** Default phase mix for lessons in this stage. */
  weights: PhaseWeights;
}

export interface Lesson {
  id: string;
  /** 1-based position in the whole course. */
  number: number;
  stage: StageId;
  title: string;
  /** Keys introduced by this lesson (empty for review / words lessons). */
  newKeys: string[];
  /** Keys this lesson drills hardest — phases A–C draw only from these. */
  focusKeys: string[];
  /** Everything learned so far, including this lesson's new keys. */
  pool: string[];
  /** Short label shown large on the lesson card. */
  glyph: string;
  /** Words-per-minute the lesson is pitched at; also the 5-star threshold. */
  targetWpm: number;
  /** How many characters of practice text to generate. */
  charCount: number;
  weights: PhaseWeights;
}

// --- finger assignment (letters + space) ------------------------------------

export const FINGER_LABELS: Record<FingerId, string> = {
  "left-pinky": "left pinky",
  "left-ring": "left ring finger",
  "left-middle": "left middle finger",
  "left-index": "left index finger",
  "right-index": "right index finger",
  "right-middle": "right middle finger",
  "right-ring": "right ring finger",
  "right-pinky": "right pinky",
  thumb: "thumb",
};

const FINGER_KEYS: Record<FingerId, string[]> = {
  "left-pinky": ["q", "a", "z"],
  "left-ring": ["w", "s", "x"],
  "left-middle": ["e", "d", "c"],
  "left-index": ["r", "f", "v", "t", "g", "b"],
  "right-index": ["y", "h", "n", "u", "j", "m"],
  "right-middle": ["i", "k"],
  "right-ring": ["o", "l"],
  "right-pinky": ["p"],
  thumb: [" "],
};

export const FINGER_FOR_KEY: Readonly<Record<string, FingerId>> = (() => {
  const map: Record<string, FingerId> = {};
  for (const finger of Object.keys(FINGER_KEYS) as FingerId[]) {
    for (const key of FINGER_KEYS[finger]) map[key] = finger;
  }
  return map;
})();

export function fingerForKey(key: string): FingerId | undefined {
  return FINGER_FOR_KEY[key.toLowerCase()];
}

/** Human-readable finger name for a key, e.g. "left index finger". */
export function fingerLabelForKey(key: string): string {
  const finger = fingerForKey(key);
  return finger ? FINGER_LABELS[finger] : "";
}

/** Home-row resting key for each finger — used by the pre-start hint. */
export const HOME_KEY_FOR_FINGER: Record<FingerId, string> = {
  "left-pinky": "a",
  "left-ring": "s",
  "left-middle": "d",
  "left-index": "f",
  "right-index": "j",
  "right-middle": "k",
  "right-ring": "l",
  "right-pinky": "p",
  thumb: " ",
};

// --- keyboard geometry (shared by the finger keyboard) ----------------------

export const KEY_ROWS: readonly (readonly string[])[] = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

// --- phase mixes ------------------------------------------------------------

// Stage 1 leans on the easy phases; stage 3 is mostly blend + real words.
export const STAGES: readonly Stage[] = [
  {
    id: "home",
    label: "home row",
    weights: { isolate: 0.2, alternate: 0.25, cluster: 0.3, blend: 0.15, words: 0.1 },
  },
  {
    id: "top",
    label: "top row",
    weights: { isolate: 0.1, alternate: 0.15, cluster: 0.3, blend: 0.3, words: 0.15 },
  },
  {
    id: "bottom",
    label: "bottom row",
    weights: { isolate: 0.05, alternate: 0.1, cluster: 0.2, blend: 0.35, words: 0.3 },
  },
];

// Overrides for lessons whose whole point is real words rather than key drills.
const WORDS_WEIGHTS: PhaseWeights = {
  isolate: 0,
  alternate: 0,
  cluster: 0.15,
  blend: 0.25,
  words: 0.6,
};

const MASTERY_WEIGHTS: PhaseWeights = {
  isolate: 0.05,
  alternate: 0.1,
  cluster: 0.2,
  blend: 0.3,
  words: 0.35,
};

const ALL_WORDS_WEIGHTS: PhaseWeights = {
  isolate: 0,
  alternate: 0,
  cluster: 0,
  blend: 0,
  words: 1,
};

// --- the curriculum ---------------------------------------------------------

interface SpecRow {
  stage: StageId;
  title: string;
  newKeys: string;
  /** Defaults to newKeys when omitted (review lessons name their own focus). */
  focus?: string;
  glyph: string;
  weights?: PhaseWeights;
}

const SPEC: readonly SpecRow[] = [
  // Stage 1 — home row.
  // Note: `;` is the right-pinky home key in a standard course, but this MVP is
  // letters only, so lesson 6 introduces `a` alone.
  { stage: "home", title: "keys f & j", newKeys: "fj", glyph: "fj" },
  { stage: "home", title: "keys d & k", newKeys: "dk", glyph: "dk" },
  { stage: "home", title: "review: f j d k", newKeys: "", focus: "fjdk", glyph: "fjdk" },
  { stage: "home", title: "keys s & l", newKeys: "sl", glyph: "sl" },
  { stage: "home", title: "review: s d f j k l", newKeys: "", focus: "sdfjkl", glyph: "sdfjkl" },
  { stage: "home", title: "key a", newKeys: "a", glyph: "a" },
  { stage: "home", title: "review: home row", newKeys: "", focus: "asdfjkl", glyph: "asdf" },
  { stage: "home", title: "keys g & h", newKeys: "gh", glyph: "gh" },
  {
    stage: "home",
    title: "home row words",
    newKeys: "",
    focus: "asdfghjkl",
    glyph: "asdfgh",
    weights: WORDS_WEIGHTS,
  },
  {
    stage: "home",
    title: "home row mastery",
    newKeys: "",
    focus: "asdfghjkl",
    glyph: "asdfghjkl",
    weights: MASTERY_WEIGHTS,
  },

  // Stage 2 — top row.
  { stage: "top", title: "keys e & i", newKeys: "ei", glyph: "ei" },
  { stage: "top", title: "keys r & u", newKeys: "ru", glyph: "ru" },
  { stage: "top", title: "review: e i r u", newKeys: "", focus: "eiru", glyph: "eiru" },
  { stage: "top", title: "keys t & y", newKeys: "ty", glyph: "ty" },
  { stage: "top", title: "keys w & o", newKeys: "wo", glyph: "wo" },
  { stage: "top", title: "review: w o t y", newKeys: "", focus: "woty", glyph: "woty" },
  { stage: "top", title: "keys q & p", newKeys: "qp", glyph: "qp" },
  {
    stage: "top",
    title: "top row words",
    newKeys: "",
    focus: "qwertyuiop",
    glyph: "qwerty",
    weights: WORDS_WEIGHTS,
  },
  {
    stage: "top",
    title: "home + top mixed",
    newKeys: "",
    focus: "qwertyuiopasdfghjkl",
    glyph: "qwer/asdf",
    weights: MASTERY_WEIGHTS,
  },
  {
    stage: "top",
    title: "top row mastery",
    newKeys: "",
    focus: "qwertyuiop",
    glyph: "qwertyuiop",
    weights: MASTERY_WEIGHTS,
  },

  // Stage 3 — bottom row.
  { stage: "bottom", title: "keys v & n", newKeys: "vn", glyph: "vn" },
  { stage: "bottom", title: "keys c & m", newKeys: "cm", glyph: "cm" },
  { stage: "bottom", title: "review: v n c m", newKeys: "", focus: "vncm", glyph: "vncm" },
  { stage: "bottom", title: "keys x & z", newKeys: "xz", glyph: "xz" },
  { stage: "bottom", title: "key b", newKeys: "b", glyph: "b" },
  { stage: "bottom", title: "review: bottom row", newKeys: "", focus: "zxcvbnm", glyph: "zxcvbnm" },
  {
    stage: "bottom",
    title: "bottom row words",
    newKeys: "",
    focus: "zxcvbnm",
    glyph: "zxcvb",
    weights: WORDS_WEIGHTS,
  },
  {
    stage: "bottom",
    title: "all rows mixed",
    newKeys: "",
    focus: "abcdefghijklmnopqrstuvwxyz",
    glyph: "a–z",
    weights: MASTERY_WEIGHTS,
  },
  {
    stage: "bottom",
    title: "common words sprint",
    newKeys: "",
    focus: "abcdefghijklmnopqrstuvwxyz",
    glyph: "words",
    weights: ALL_WORDS_WEIGHTS,
  },
  {
    stage: "bottom",
    title: "full keyboard mastery",
    newKeys: "",
    focus: "abcdefghijklmnopqrstuvwxyz",
    glyph: "★",
    weights: ALL_WORDS_WEIGHTS,
  },
];

export const TOTAL_LESSONS = SPEC.length;
export const MAX_STARS_PER_LESSON = 5;
export const TOTAL_STARS = TOTAL_LESSONS * MAX_STARS_PER_LESSON;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** 12 wpm at lesson 1, rising to 32 wpm at lesson 30. */
export function targetWpmFor(lessonNumber: number): number {
  return 12 + Math.floor(((lessonNumber - 1) * 20) / 29);
}

/** 2.5 minutes of text at the lesson's target speed, bounded to 150–400 chars. */
export function charCountFor(targetWpm: number): number {
  return clamp(Math.round(targetWpm * 5 * 2.5), 150, 400);
}

const chars = (s: string): string[] => [...new Set(s.split(""))];

export const LESSONS: readonly Lesson[] = (() => {
  const out: Lesson[] = [];
  const cumulative: string[] = [];

  SPEC.forEach((row, i) => {
    const number = i + 1;
    for (const key of chars(row.newKeys)) {
      if (!cumulative.includes(key)) cumulative.push(key);
    }
    const focus = chars(row.focus ?? row.newKeys).filter((k) => cumulative.includes(k));
    const targetWpm = targetWpmFor(number);
    out.push({
      id: String(number),
      number,
      stage: row.stage,
      title: row.title,
      newKeys: chars(row.newKeys),
      // A review lesson with no reachable focus keys falls back to everything learned.
      focusKeys: focus.length > 0 ? focus : [...cumulative],
      pool: [...cumulative],
      glyph: row.glyph,
      targetWpm,
      charCount: charCountFor(targetWpm),
      weights: row.weights ?? STAGES.find((s) => s.id === row.stage)!.weights,
    });
  });

  return out;
})();

export function getLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}

export function lessonsForStage(stage: StageId): Lesson[] {
  return LESSONS.filter((l) => l.stage === stage);
}

/**
 * Plain-language finger guidance for the pre-start card, e.g.
 * "left index finger on F, right index finger on J" for a new-key lesson, or
 * a short summary of the pool for a review/mastery lesson.
 */
export function lessonKeyHint(lesson: Lesson): string {
  if (lesson.newKeys.length > 0) {
    return lesson.newKeys
      .map((k) => `${FINGER_LABELS[fingerForKey(k)!]} on ${k.toUpperCase()}`)
      .join(", ");
  }
  return `practicing ${lesson.focusKeys.join(" ")}`;
}

/** The distinct fingers a lesson's new (or focus) keys belong to. */
export function fingersForLesson(lesson: Lesson): FingerId[] {
  const keys = lesson.newKeys.length > 0 ? lesson.newKeys : lesson.focusKeys;
  const seen: FingerId[] = [];
  for (const k of keys) {
    const f = fingerForKey(k);
    if (f && !seen.includes(f)) seen.push(f);
  }
  return seen;
}
