import { useEffect, useState } from "react";

const THEMES = [
  { id: "minimal", label: "minimal" },
  { id: "terminal", label: "terminal" },
  { id: "synthwave", label: "synthwave" },
  { id: "paper", label: "paper" },
  { id: "matrix", label: "matrix" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const STORAGE_KEY = "typeforge-theme";

export function applyTheme(id: ThemeId) {
  const root = document.documentElement;
  THEMES.forEach((t) => root.classList.remove(`theme-${t.id}`));
  root.classList.add(`theme-${id}`);
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
    <div className="flex items-center gap-1 text-xs">
      {THEMES.map((t) => (
        <button
          key={t.id}
          onClick={() => {
            setTheme(t.id);
            applyTheme(t.id);
          }}
          className={`px-2 py-1 rounded transition ${
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
