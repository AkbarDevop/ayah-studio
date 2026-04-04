"use client";

import { BookOpen, Eye, Clock, Download } from "lucide-react";
import type { MobileTab } from "@/types";

interface MobileBottomNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  hasSubtitles: boolean;
}

const MOBILE_TABS: {
  id: MobileTab;
  label: string;
  icon: typeof BookOpen;
}[] = [
  { id: "browse", label: "Browse", icon: BookOpen },
  { id: "preview", label: "Preview", icon: Eye },
  { id: "timeline", label: "Timeline", icon: Clock },
  { id: "export", label: "Export", icon: Download },
];

export default function MobileBottomNav({
  activeTab,
  onTabChange,
  hasSubtitles,
}: MobileBottomNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)]/80 bg-[rgba(12,15,20,0.85)] backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-lg items-stretch">
        {MOBILE_TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          const isDisabled = id === "export" && !hasSubtitles;

          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                if (!isDisabled) onTabChange(id);
              }}
              disabled={isDisabled}
              className={[
                "relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors",
                isActive
                  ? "text-[var(--gold)]"
                  : isDisabled
                    ? "text-[var(--text-dim)]/50 cursor-not-allowed"
                    : "text-[var(--text-muted)] active:text-[var(--text)]",
              ].join(" ")}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium uppercase tracking-[0.1em] font-[family-name:var(--font-ibm-plex)]">
                {label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-[var(--gold)]" />
              )}
            </button>
          );
        })}
      </div>
      {/* Safe area padding for phones with home indicator */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
