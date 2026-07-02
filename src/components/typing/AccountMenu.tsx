import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { signOut } from "@/hooks/use-auth";
import { AuthDialog } from "./AuthDialog";

interface Props {
  user: User | null;
  loading: boolean;
}

export function AccountMenu({ user, loading }: Props) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);

  if (loading) {
    return <div className="w-6 h-6 rounded-full bg-[color:var(--type-surface)] animate-pulse" />;
  }

  if (!user) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="text-xs font-mono text-[color:var(--type-muted)] hover:text-[color:var(--type-accent)] px-2 py-1 rounded border border-[color:var(--type-border)] hover:border-[color:var(--type-accent)] transition"
        >
          sign in
        </button>
        <AuthDialog open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  const label = user.email ?? user.user_metadata?.name ?? "account";
  const initial = (user.email?.[0] ?? "?").toUpperCase();
  const avatar = user.user_metadata?.avatar_url as string | undefined;

  return (
    <div className="relative">
      <button
        onClick={() => setMenu((m) => !m)}
        className="flex items-center gap-2 text-xs font-mono text-[color:var(--type-muted)] hover:text-[color:var(--type-text)] transition"
        title={label}
      >
        {avatar ? (
          <img src={avatar} alt="" className="w-6 h-6 rounded-full" />
        ) : (
          <span className="w-6 h-6 rounded-full bg-[color:var(--type-accent)] text-[color:var(--type-bg)] flex items-center justify-center text-[11px] font-bold">
            {initial}
          </span>
        )}
        <span className="hidden md:inline max-w-[160px] truncate">{label}</span>
      </button>
      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
          <div className="absolute right-0 mt-2 z-50 min-w-[200px] rounded border border-[color:var(--type-border)] bg-[color:var(--type-bg)] font-mono text-xs shadow-xl">
            <div className="px-3 py-2 text-[color:var(--type-muted)] border-b border-[color:var(--type-border)] truncate">
              {label}
            </div>
            <button
              onClick={async () => {
                setMenu(false);
                await signOut();
              }}
              className="w-full text-left px-3 py-2 text-[color:var(--type-text)] hover:text-[color:var(--type-accent)] hover:bg-[color:var(--type-surface)]"
            >
              sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
