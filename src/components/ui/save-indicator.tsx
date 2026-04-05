"use client";

import Link from "next/link";
import { Cloud, CloudOff, Loader2, Check } from "lucide-react";
import type { SaveStatus } from "@/hooks/useProjectSync";

interface SaveIndicatorProps {
  status: SaveStatus;
  isSignedIn: boolean;
}

export default function SaveIndicator({ status, isSignedIn }: SaveIndicatorProps) {
  if (!isSignedIn) {
    return (
      <Link
        href="/sign-in"
        className="flex items-center gap-1.5 rounded-lg border border-[var(--border)]/60 bg-[var(--surface)] px-2.5 py-1.5 text-[11px] text-[var(--text-dim)] transition-colors hover:border-[var(--gold)]/40 hover:text-[var(--text-muted)]"
      >
        <CloudOff className="h-3.5 w-3.5" />
        <span>Sign in to save</span>
      </Link>
    );
  }

  if (status === "saving") {
    return (
      <span className="flex items-center gap-1.5 rounded-lg border border-[var(--border)]/60 bg-[var(--surface)] px-2.5 py-1.5 text-[11px] text-[var(--text-muted)]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Saving...</span>
      </span>
    );
  }

  if (status === "saved") {
    return (
      <span className="flex items-center gap-1.5 rounded-lg border border-[var(--emerald)]/30 bg-[var(--surface)] px-2.5 py-1.5 text-[11px] text-[var(--emerald)]">
        <Check className="h-3.5 w-3.5" />
        <span>Saved</span>
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-[var(--surface)] px-2.5 py-1.5 text-[11px] text-red-400">
        <CloudOff className="h-3.5 w-3.5" />
        <span>Save failed</span>
      </span>
    );
  }

  // idle — show a subtle cloud icon when signed in
  return (
    <span className="flex items-center gap-1.5 rounded-lg border border-[var(--border)]/40 bg-[var(--surface)] px-2.5 py-1.5 text-[11px] text-[var(--text-dim)]">
      <Cloud className="h-3.5 w-3.5" />
      <span>Cloud</span>
    </span>
  );
}
