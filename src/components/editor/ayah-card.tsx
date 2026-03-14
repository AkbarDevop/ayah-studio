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
      aria-pressed={isSelected}
      aria-label={`Ayah ${ayahNumber}${isSelected ? " (selected)" : ""}`}
      className={`group w-full rounded-lg border p-4 text-left transition-all duration-200 ${
        isSelected
          ? "border-[var(--gold)] bg-[var(--gold)]/[0.06] shadow-lg shadow-[var(--gold)]/[0.05]"
          : "border-[var(--border)] bg-[var(--surface-alt)] hover:border-[var(--border-light)] hover:bg-[var(--surface-alt)]/80"
      } active:scale-[0.99]`}
    >
      <div className="flex items-start gap-3">
        {/* Number Badge / Checkbox */}
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-200 ${
            isSelected
              ? "bg-[var(--gold)] text-[var(--bg)] shadow-[0_0_16px_rgba(212,168,83,0.2)]"
              : "border border-[var(--border-light)] bg-[var(--surface)] text-[var(--text-muted)] group-hover:border-[var(--gold-dim)] group-hover:text-[var(--gold)]"
          }`}
        >
          {isSelected ? (
            <Check className="h-4 w-4" />
          ) : (
            ayahNumber
          )}
        </div>

        {/* Text Content */}
        <div className="min-w-0 flex-1">
          {/* Selected Badge */}
          {isSelected && (
            <div className="mb-2 flex items-center gap-1.5 animate-fade-in">
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--emerald)]/20 px-2 py-0.5">
                <Check className="h-3 w-3 text-[var(--emerald-light)]" />
                <span className="font-mono-ui text-[10px] font-medium uppercase tracking-wider text-[var(--emerald-light)]">
                  Selected
                </span>
              </span>
              <span className="font-mono-ui text-[10px] text-[var(--text-dim)]">
                Ayah {ayahNumber}
              </span>
            </div>
          )}

          {/* Arabic Text */}
          <p
            dir="rtl"
            className="font-arabic-ui text-[22px] leading-loose text-[var(--gold)]"
          >
            {arabicText}
          </p>

          {/* Translation */}
          {translation && (
            <p className="mt-2 text-sm italic leading-relaxed text-[var(--text-muted)]">
              {translation}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
