import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { generateSmartDrillText } from "@/lib/generate-text.functions";
import {
  diagnoseWeaknesses,
  snapshotTargets,
  type StatsBundle,
  type TargetSnapshot,
} from "@/lib/keystats";

interface Props {
  stats: StatsBundle;
  onText: (text: string, targets: { keys: string[]; bigrams: string[]; snapshot: TargetSnapshot }) => void;
}

const CACHE_KEY = "typeforge-smart-cache-v1";
const MIN_TESTS = 3;

function readCache(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}
function writeCache(c: Record<string, string>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {}
}

export function SmartDrill({ stats, onText }: Props) {
  const generate = useServerFn(generateSmartDrillText);
  const diag = useMemo(() => diagnoseWeaknesses(stats, { topN: 5 }), [stats]);

  // Selection sets — start with all diagnosed weaknesses selected
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [selectedBigrams, setSelectedBigrams] = useState<Set<string>>(new Set());
  const [extraInput, setExtraInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSelectedKeys(new Set(diag.keys.map((w) => w.token)));
    setSelectedBigrams(new Set(diag.bigrams.map((w) => w.token)));
  }, [diag]);

  function toggle<T>(set: Set<T>, val: T, setter: (s: Set<T>) => void) {
    const next = new Set(set);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    setter(next);
  }

  function parseExtra(): { keys: string[]; bigrams: string[] } {
    const tokens = extraInput
      .toLowerCase()
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const keys: string[] = [];
    const bigrams: string[] = [];
    for (const t of tokens) {
      if (/^[a-z]$/.test(t)) keys.push(t);
      else if (/^[a-z]{2}$/.test(t)) bigrams.push(t);
    }
    return { keys, bigrams };
  }

  async function go() {
    const extra = parseExtra();
    const keys = [...new Set([...selectedKeys, ...extra.keys])];
    const bigrams = [...new Set([...selectedBigrams, ...extra.bigrams])];
    if (!keys.length && !bigrams.length) {
      toast.error("Pick at least one target");
      return;
    }
    const cacheKey = `k:${keys.slice().sort().join("")}|b:${bigrams.slice().sort().join(",")}`;
    const cache = readCache();
    const snapshot = snapshotTargets(stats, keys, bigrams);
    if (cache[cacheKey]) {
      onText(cache[cacheKey], { keys, bigrams, snapshot });
      toast.success("Loaded cached drill");
      return;
    }
    setLoading(true);
    try {
      const res = await generate({ data: { keys, bigrams } });
      cache[cacheKey] = res.text;
      writeCache(cache);
      onText(res.text, { keys, bigrams, snapshot });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate";
      if (msg.includes("429")) toast.error("Rate limited — try again in a moment");
      else if (msg.includes("402")) toast.error("AI credits exhausted");
      else toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  if (stats.testCount < MIN_TESTS) {
    return (
      <div className="w-full max-w-2xl mx-auto text-center text-sm text-[color:var(--type-muted)] font-mono">
        smart drill unlocks after {MIN_TESTS} completed tests · you have {stats.testCount}
      </div>
    );
  }

  if (!diag.keys.length && !diag.bigrams.length) {
    return (
      <div className="w-full max-w-2xl mx-auto text-center text-sm text-[color:var(--type-muted)] font-mono">
        no weak patterns detected yet — type a few more tests
      </div>
    );
  }

  const summary = describeWeaknesses(diag.keys.map((w) => w.token), diag.bigrams.map((w) => w.token));

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-3 text-sm">
      <p className="text-center text-[color:var(--type-muted)] font-mono text-xs">{summary}</p>

      <div className="flex flex-col gap-2">
        <Group label="weak keys">
          {diag.keys.map((w) => (
            <Chip
              key={w.token}
              active={selectedKeys.has(w.token)}
              onClick={() => toggle(selectedKeys, w.token, setSelectedKeys)}
              title={`${Math.round(w.accuracy * 100)}% · ${
                w.avgMs ? Math.round(w.avgMs) + "ms" : "—"
              } · ${w.attempts} tries`}
            >
              {w.token}
            </Chip>
          ))}
        </Group>
        <Group label="weak bigrams">
          {diag.bigrams.map((w) => (
            <Chip
              key={w.token}
              active={selectedBigrams.has(w.token)}
              onClick={() => toggle(selectedBigrams, w.token, setSelectedBigrams)}
              title={`${Math.round(w.accuracy * 100)}% · ${
                w.avgMs ? Math.round(w.avgMs) + "ms" : "—"
              } · ${w.attempts} tries`}
            >
              {w.token}
            </Chip>
          ))}
        </Group>
      </div>

      <div className="flex items-center gap-2 justify-center flex-wrap">
        <input
          value={extraInput}
          onChange={(e) => setExtraInput(e.target.value)}
          placeholder="add targets (e.g. q, th, zx)"
          className="flex-1 min-w-[14rem] max-w-sm px-2 py-1.5 rounded-md bg-[color:var(--type-surface)] border border-[color:var(--type-border)] text-[color:var(--type-text)] font-mono text-xs outline-none focus:border-[color:var(--type-accent)]"
        />
        <button
          onClick={go}
          disabled={loading}
          className="px-4 py-1.5 rounded-md bg-[color:var(--type-accent)] text-[color:var(--type-bg)] font-mono text-xs disabled:opacity-50 hover:opacity-90 transition"
        >
          {loading ? "generating…" : "generate smart drill"}
        </button>
      </div>
      <p className="text-[10px] text-[color:var(--type-muted)] text-center font-mono">
        AI weaves your trouble letters into natural English. Cached locally per target set.
      </p>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 flex-wrap justify-center">
      <span className="text-[10px] uppercase tracking-wider text-[color:var(--type-muted)] font-mono w-24 text-right">
        {label}
      </span>
      <div className="flex gap-1.5 flex-wrap">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-2.5 py-1 rounded-md font-mono text-xs border transition ${
        active
          ? "bg-[color:var(--type-accent)] text-[color:var(--type-bg)] border-[color:var(--type-accent)]"
          : "bg-[color:var(--type-surface)] text-[color:var(--type-muted)] border-[color:var(--type-border)] hover:text-[color:var(--type-text)]"
      }`}
    >
      {children}
    </button>
  );
}

function describeWeaknesses(keys: string[], bigrams: string[]): string {
  const parts: string[] = [];
  if (bigrams.length) parts.push(`bigrams ${bigrams.slice(0, 3).map((b) => `'${b}'`).join(", ")}`);
  if (keys.length) parts.push(`keys ${keys.slice(0, 4).map((k) => `'${k}'`).join(", ")}`);
  if (!parts.length) return "no weak patterns detected";
  return `you're slowest on: ${parts.join(" · ")}`;
}
