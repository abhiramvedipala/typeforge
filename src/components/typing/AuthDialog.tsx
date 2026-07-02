import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AuthDialog({ open, onClose }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("account created");
        onClose();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("signed in");
        onClose();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "auth failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message || "google sign-in failed");
        return;
      }
      if (result.redirected) return;
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-[color:var(--type-border)] bg-[color:var(--type-bg)] p-6 font-mono shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-lg text-[color:var(--type-accent)]">
            {mode === "signin" ? "// sign in" : "// sign up"}
          </h2>
          <button
            onClick={onClose}
            className="text-[color:var(--type-muted)] hover:text-[color:var(--type-text)] text-sm"
          >
            esc
          </button>
        </div>

        <button
          onClick={handleGoogle}
          disabled={busy}
          className="w-full mb-3 px-3 py-2 rounded border border-[color:var(--type-border)] text-sm text-[color:var(--type-text)] hover:border-[color:var(--type-accent)] hover:text-[color:var(--type-accent)] transition disabled:opacity-50"
        >
          continue with google
        </button>

        <div className="flex items-center gap-2 my-3 text-xs text-[color:var(--type-muted)]">
          <div className="flex-1 h-px bg-[color:var(--type-border)]" />
          <span>or</span>
          <div className="flex-1 h-px bg-[color:var(--type-border)]" />
        </div>

        <form onSubmit={handleEmail} className="space-y-2">
          <input
            type="email"
            required
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded bg-[color:var(--type-surface)] border border-[color:var(--type-border)] text-sm text-[color:var(--type-text)] placeholder:text-[color:var(--type-muted)] focus:outline-none focus:border-[color:var(--type-accent)]"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded bg-[color:var(--type-surface)] border border-[color:var(--type-border)] text-sm text-[color:var(--type-text)] placeholder:text-[color:var(--type-muted)] focus:outline-none focus:border-[color:var(--type-accent)]"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full px-3 py-2 rounded bg-[color:var(--type-accent)] text-[color:var(--type-bg)] text-sm font-bold hover:opacity-90 transition disabled:opacity-50"
          >
            {busy ? "..." : mode === "signin" ? "sign in" : "create account"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-3 w-full text-center text-xs text-[color:var(--type-muted)] hover:text-[color:var(--type-text)]"
        >
          {mode === "signin" ? "need an account? sign up" : "already have an account? sign in"}
        </button>

        <p className="mt-4 text-[10px] text-[color:var(--type-muted)] text-center">
          typeforge works fully without an account — sign in only to sync across devices.
        </p>
      </div>
    </div>
  );
}
