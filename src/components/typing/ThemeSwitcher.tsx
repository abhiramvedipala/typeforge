import { useEffect, useState } from "react";

const THEMES = [
  { id: "minimal", label: "minimal" },
  { id: "terminal", label: "terminal" },
  { id: "synthwave", label: "synthwave" },
  { id: "paper", label: "paper" },
  { id: "matrix", label: "matrix" },
  { id: "pixel", label: "pixel" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const STORAGE_KEY = "typeforge-theme";

const PIXEL_FONT_LINK_ID = "pixel-theme-font";
const PIXEL_FONT_HREF = "https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap";

// The pixel theme's display font is loaded on first use rather than as a
// render-blocking <link> in the document head, so the other five themes
// never pay for it. Idempotent — safe to call on every theme switch.
function ensurePixelFontLoaded() {
  if (document.getElementById(PIXEL_FONT_LINK_ID)) return;
  const link = document.createElement("link");
  link.id = PIXEL_FONT_LINK_ID;
  link.rel = "stylesheet";
  link.href = PIXEL_FONT_HREF;
  document.head.appendChild(link);
}

export function applyTheme(id: ThemeId) {
  const root = document.documentElement;
  THEMES.forEach((t) => root.classList.remove(`theme-${t.id}`));
  root.classList.add(`theme-${id}`);
  if (id === "pixel") ensurePixelFontLoaded();
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {}
}

export function loadInitialTheme(): ThemeId {
  try {
    const v = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    if (v && THEMES.some((t) => t.id === v)) return v;
  } catch {}
  return "minimal";
}

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeId>("minimal");

  useEffect(() => {
    const t = loadInitialTheme();
    setTheme(t);
    applyTheme(t);
  }, []);

  return (
    <div role="radiogroup" aria-label="Theme" className="flex items-center gap-1 text-xs flex-wrap justify-end">
      {THEMES.map((t) => (
        <button
          key={t.id}
          role="radio"
          aria-checked={theme === t.id}
          aria-label={`Theme: ${t.label}`}
          onClick={() => {
            setTheme(t.id);
            applyTheme(t.id);
          }}
          className={`px-2 py-1 rounded transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--type-accent)] ${
            theme === t.id
              ? "text-[color:var(--type-accent)] bg-[color:var(--type-surface)]"
              : "text-[color:var(--type-muted)] hover:text-[color:var(--type-text)]"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

