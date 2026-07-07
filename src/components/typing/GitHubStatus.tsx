import { useEffect, useState } from "react";
import { Github } from "lucide-react";

interface CommitInfo {
  sha: string;
  message: string;
  date: string;
}

const REPO = import.meta.env.VITE_GITHUB_REPO as string | undefined;

export function GitHubStatus() {
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "missing">("loading");
  const [commit, setCommit] = useState<CommitInfo | null>(null);

  useEffect(() => {
    if (!REPO || !REPO.includes("/")) {
      setStatus("missing");
      return;
    }

    let cancelled = false;
    fetch(`https://api.github.com/repos/${REPO}/commits?per_page=1`)
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        const c = Array.isArray(data) ? data[0] : null;
        if (c) {
          setCommit({
            sha: c.sha?.slice(0, 7) ?? "",
            message: c.commit?.message?.split("\n")[0] ?? "",
            date: c.commit?.committer?.date ?? "",
          });
          setStatus("ok");
        } else {
          setStatus("error");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const dotColor =
    status === "ok"
      ? "bg-[oklch(0.65_0.18_145)]"
      : status === "error"
        ? "bg-[oklch(0.62_0.20_25)]"
        : "bg-[color:var(--type-muted)]";

  const tooltip =
    status === "ok" && commit
      ? `${REPO} · ${commit.sha} · ${commit.message}`
      : status === "error"
        ? `Could not reach ${REPO}`
        : status === "missing"
          ? "Set VITE_GITHUB_REPO=owner/repo"
          : "Checking…";

  const href = REPO ? `https://github.com/${REPO}` : "https://github.com";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={tooltip}
      className="relative flex items-center justify-center w-6 h-6 rounded text-[color:var(--type-muted)] hover:text-[color:var(--type-text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--type-accent)]"
      aria-label="GitHub repository status"
    >
      <Github className="w-4 h-4" />
      <span className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${dotColor}`} />
    </a>
  );
}
