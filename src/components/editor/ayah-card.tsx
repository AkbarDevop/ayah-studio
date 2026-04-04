"use client";

import { Check } from "lucide-react";

interface AyahCardProps {
  ayahNumber: number;
  arabicText: string;
  translation?: string;
  isSelected: boolean;
  onToggle: () => void;
}

export default function AyahCard({
  ayahNumber,
  arabicText,
  translation,
  isSelected,
  onToggle,
}: AyahCardProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`group w-full rounded-lg border p-3 text-left transition-all md:p-4 ${
        isSelected
          ? "border-[var(--gold)] bg-[var(--gold)]/[0.06] shadow-lg shadow-[var(--gold)]/[0.05]"
          : "border-[var(--border)] bg-[var(--surface-alt)] hover:border-[var(--border-light)]"
      }`}
    >
      <div className="flex items-start gap-2.5 md:gap-3">
        {/* Number Badge */}
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
            isSelected
              ? "bg-[var(--gold)] text-[var(--bg)]"
              : "border border-[var(--border-light)] bg-[var(--surface)] text-[var(--text-muted)] group-hover:border-[var(--gold-dim)] group-hover:text-[var(--gold)]"
          }`}
        >
          {ayahNumber}
        </div>

        {/* Text Content */}
        <div className="min-w-0 flex-1">
          {/* Selected Badge */}
          {isSelected && (
            <div className="mb-2 flex items-center gap-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--emerald)]/20 px-2 py-0.5">
                <Check className="h-3 w-3 text-[var(--emerald-light)]" />
                <span className="font-mono-ui text-[10px] font-medium uppercase tracking-wider text-[var(--emerald-light)]">
                  Selected
                </span>
              </span>
            </div>
          )}

          {/* Arabic Text */}
          <p
            dir="rtl"
            className="font-arabic-ui text-lg leading-loose text-[var(--gold)] md:text-[22px]"
          >
            {arabicText}
          </p>

          {/* Translation */}
          {translation && (
            <p className="mt-1.5 text-xs italic leading-relaxed text-[var(--text-muted)] md:mt-2 md:text-sm">
              {translation}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
