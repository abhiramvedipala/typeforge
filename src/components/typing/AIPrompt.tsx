import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generatePracticeText } from "@/lib/generate-text.functions";
import { toast } from "sonner";

interface Props {
  onText: (text: string) => void;
}

const CACHE_KEY = "typeforge-ai-cache";

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

export function AIPrompt({ onText }: Props) {
  const generate = useServerFn(generatePracticeText);
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [loading, setLoading] = useState(false);

  async function go(e?: React.FormEvent) {
    e?.preventDefault();
    const t = topic.trim();
    if (!t) return;
    const cacheKey = `${difficulty}::${t.toLowerCase()}`;
    const cache = readCache();
    if (cache[cacheKey]) {
      onText(cache[cacheKey]);
      toast.success("Loaded from cache");
      return;
    }
    setLoading(true);
    try {
      const res = await generate({ data: { topic: t, difficulty } });
      cache[cacheKey] = res.text;
      writeCache(cache);
      onText(res.text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate";
      if (msg.includes("429")) toast.error("Rate limited — try again in a moment");
      else if (msg.includes("402")) toast.error("AI credits exhausted");
      else toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={go} className="w-full max-w-2xl mx-auto flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="topic: e.g. 'a paragraph about space exploration'"
          className="flex-1 px-3 py-2 rounded-md bg-[color:var(--type-surface)] border border-[color:var(--type-border)] text-[color:var(--type-text)] placeholder:text-[color:var(--type-muted)] font-mono text-sm outline-none focus:border-[color:var(--type-accent)]"
        />
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}
          className="px-2 py-2 rounded-md bg-[color:var(--type-surface)] border border-[color:var(--type-border)] text-[color:var(--type-text)] font-mono text-sm outline-none"
        >
          <option value="easy">easy</option>
          <option value="medium">medium</option>
          <option value="hard">hard</option>
        </select>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-md bg-[color:var(--type-accent)] text-[color:var(--type-bg)] font-mono text-sm hover:opacity-90 disabled:opacity-50 transition"
        >
          {loading ? "generating…" : "generate"}
        </button>
      </div>
      <p className="text-xs text-[color:var(--type-muted)] text-center">
        Generated texts are cached locally so repeat topics load instantly.
      </p>
    </form>
  );
}
