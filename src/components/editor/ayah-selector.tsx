"use client";

import { ArrowLeft, Clock, CheckSquare, XSquare, Sparkles, Info } from "lucide-react";
import type { Ayah, TranslationAyah } from "@/types";
import AyahCard from "./ayah-card";

interface AyahSelectorProps {
  surahName: string;
  ayahs: Ayah[];
  translations: TranslationAyah[];
  selectedIndices: Set<number>;
  onToggle: (index: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBack: () => void;
  onGenerate: () => void;
  defaultDuration: number;
  onDurationChange: (duration: number) => void;
}

export default function AyahSelector({
  surahName,
  ayahs,
  translations,
  selectedIndices,
  onToggle,
  onSelectAll,
  onDeselectAll,
  onBack,
  onGenerate,
  defaultDuration,
  onDurationChange,
}: AyahSelectorProps) {
  const selectedCount = selectedIndices.size;

  return (
    <div className="flex h-full flex-col animate-fade-in">
      {/* Header: Back + Surah Name */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-[var(--text-muted)] transition-all duration-200 hover:bg-[var(--surface-alt)] hover:text-[var(--text)] active:scale-[0.97]"
          aria-label="Back to surah list"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>

        <h2 className="font-arabic-ui text-lg font-bold text-[var(--gold)]">
          {surahName}
        </h2>
      </div>

      {/* Duration Setting */}
      <div className="px-4 py-2">
        <div
          className="tooltip-trigger flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 transition-colors duration-200 focus-within:border-[var(--gold-dim)]"
          data-tooltip="Default seconds per ayah when no audio is detected"
        >
          <Clock className="h-4 w-4 shrink-0 text-[var(--text-dim)]" />
          <label
            htmlFor="duration-input"
            className="font-mono-ui shrink-0 text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]"
          >
            Sec / Ayah
          </label>
          <input
            id="duration-input"
            type="number"
            min={3}
            max={30}
            value={defaultDuration}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) {
                onDurationChange(Math.min(30, Math.max(3, val)));
              }
            }}
            className="font-mono-ui w-16 rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-2 py-1 text-center text-sm text-[var(--text)] transition-colors duration-200 focus:border-[var(--gold-dim)] focus:outline-none"
          />
          <span className="font-mono-ui text-[11px] text-[var(--text-dim)]">
            seconds
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 px-4 py-2">
        {/* Select / Deselect All */}
        <button
          type="button"
          onClick={selectedCount === ayahs.length ? onDeselectAll : onSelectAll}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-muted)] transition-all duration-200 hover:border-[var(--border-light)] hover:text-[var(--text)] active:scale-[0.97]"
          aria-label={selectedCount === ayahs.length ? "Deselect all ayahs" : "Select all ayahs"}
        >
          {selectedCount === ayahs.length ? (
            <>
              <XSquare className="h-3.5 w-3.5" />
              <span>Deselect All</span>
            </>
          ) : (
            <>
              <CheckSquare className="h-3.5 w-3.5" />
              <span>Select All</span>
            </>
          )}
        </button>

        {/* Generate Button */}
        <button
          type="button"
          onClick={onGenerate}
          disabled={selectedCount === 0}
          aria-label={
            selectedCount > 0
              ? `Generate subtitles for ${selectedCount} ayahs`
              : "Select ayahs to generate subtitles"
          }
          className={`ml-auto flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${
            selectedCount > 0
              ? "bg-[var(--gold)] text-[var(--bg)] shadow-lg shadow-[var(--gold)]/20 hover:bg-[var(--gold-light)] active:scale-[0.98] animate-pulse-gold"
              : "bg-[var(--border)] text-[var(--text-dim)] cursor-not-allowed"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>
            Generate
            {selectedCount > 0 && (
              <span className="ml-1">({selectedCount})</span>
            )}
          </span>
        </button>
      </div>

      {/* Ayah Count + hint */}
      <div className="px-4 py-1 flex items-center justify-between">
        <span className="font-mono-ui text-[11px] uppercase tracking-wider text-[var(--text-dim)]">
          {selectedCount} of {ayahs.length} ayah
          {ayahs.length !== 1 ? "s" : ""} selected
        </span>
        {selectedCount === 0 && (
          <span className="flex items-center gap-1 text-[11px] text-[var(--text-dim)] animate-fade-in">
            <Info className="h-3 w-3" />
            Tap ayahs to select
          </span>
        )}
      </div>

      {/* Ayah List */}
      <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-4">
        {ayahs.map((ayah, index) => {
          const translationAyah = translations.find(
            (t) => t.numberInSurah === ayah.numberInSurah
          );
          return (
            <AyahCard
              key={ayah.number}
              ayahNumber={ayah.numberInSurah}
              arabicText={ayah.text}
              translation={translationAyah?.text}
              isSelected={selectedIndices.has(index)}
              onToggle={() => onToggle(index)}
            />
          );
        })}
      </div>
    </div>
  );
}
