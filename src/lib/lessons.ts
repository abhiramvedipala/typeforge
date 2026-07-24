import { drillWords } from "./words";

export type LessonGroup = "home" | "top" | "bottom";

export interface Lesson {
  id: string;
  group: LessonGroup;
  title: string;
  description: string;
  letters: string[];
  wordCount: number;
}

const HOME = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
const TOP = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
const BOTTOM = ["z", "x", "c", "v", "b", "n", "m"];

// Word counts scale up gradually so each lesson takes roughly 2–3 minutes at
// beginner speed (~20–30 wpm). Letter sets accumulate to keep difficulty
// increasing smoothly through each group.
export const LESSONS: Lesson[] = [
  // Home row
  { id: "h1", group: "home", title: "f & j", description: "Index fingers on the home keys.", letters: ["f", "j"], wordCount: 90 },
  { id: "h2", group: "home", title: "d & k", description: "Middle fingers join in.", letters: ["f", "j", "d", "k"], wordCount: 110 },
  { id: "h3", group: "home", title: "s & l", description: "Ring fingers reach the home row.", letters: ["f", "j", "d", "k", "s", "l"], wordCount: 130 },
  { id: "h4", group: "home", title: "a & ;", description: "Pinky fingers enter the game.", letters: ["a", "s", "d", "f", "j", "k", "l"], wordCount: 150 },
  { id: "h5", group: "home", title: "g & h", description: "Full home row reach.", letters: HOME, wordCount: 170 },
  { id: "h6", group: "home", title: "home row mastery", description: "Free typing across all home keys.", letters: HOME, wordCount: 200 },

  // Top row
  { id: "t1", group: "top", title: "r & u", description: "Index fingers reach up.", letters: ["r", "u", ...HOME], wordCount: 110 },
  { id: "t2", group: "top", title: "e & i", description: "Middle fingers stretch up.", letters: ["e", "i", "r", "u", ...HOME], wordCount: 130 },
  { id: "t3", group: "top", title: "w & o", description: "Ring fingers stretch up.", letters: ["w", "o", "e", "i", "r", "u", ...HOME], wordCount: 150 },
  { id: "t4", group: "top", title: "q & p", description: "Pinky top-row reach.", letters: ["q", "p", "w", "o", "e", "i", "r", "u", ...HOME], wordCount: 170 },
  { id: "t5", group: "top", title: "t & y", description: "Center top row.", letters: [...TOP, ...HOME], wordCount: 190 },
  { id: "t6", group: "top", title: "top row mastery", description: "Top + home row combined.", letters: [...TOP, ...HOME], wordCount: 220 },

  // Bottom row
  { id: "b1", group: "bottom", title: "v & n", description: "Index fingers reach down.", letters: ["v", "n", ...HOME], wordCount: 110 },
  { id: "b2", group: "bottom", title: "c & m", description: "Middle fingers reach down.", letters: ["c", "m", "v", "n", ...HOME], wordCount: 130 },
  { id: "b3", group: "bottom", title: "x & ,", description: "Ring fingers reach down.", letters: ["x", "c", "m", "v", "n", ...HOME], wordCount: 150 },
  { id: "b4", group: "bottom", title: "z & b", description: "Pinky bottom-row plus b.", letters: ["z", "b", "x", "c", "m", "v", "n", ...HOME], wordCount: 170 },
  { id: "b5", group: "bottom", title: "bottom row mastery", description: "All bottom-row letters.", letters: [...BOTTOM, ...HOME], wordCount: 190 },
  { id: "b6", group: "bottom", title: "all rows", description: "Every letter combined.", letters: [...HOME, ...TOP, ...BOTTOM], wordCount: 240 },
];

export function lessonText(lesson: Lesson): string {
  return drillWords(lesson.letters, lesson.wordCount).join(" ");
}

const PROGRESS_KEY = "typeforge-lesson-progress-v1";

export interface LessonRecord {
  wpm: number;
  accuracy: number;
}

export function loadCompleted(): Record<string, LessonRecord> {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
  } catch {
    return {};
  }
}

export function markCompleted(id: string, wpm: number, accuracy: number): Record<string, LessonRecord> {
  const cur = loadCompleted();
  const prev = cur[id];
  if (!prev || wpm > prev.wpm) cur[id] = { wpm, accuracy };
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(cur));
  } catch {}
  return cur;
}
