"use client";

import { ArrowLeft, Layers } from "lucide-react";
import type { Subtitle } from "@/types";
import SubtitleEditor from "@/components/subtitle/subtitle-editor";

interface SubtitlePanelProps {
  subtitles: Subtitle[];
  selectedIdx: number | null;
  onSelect: (idx: number) => void;
  onDeselect: () => void;
  onTimeSeek: (time: number) => void;
  currentTime: number;
  translationEdition: string;
  onSubtitleChange: (updated: Subtitle) => void;
  onSubtitleDelete: () => void;
  onSetStartToPlayhead: () => void;
  onSetEndToPlayhead: () => void;
}

export default function SubtitlePanel({
  subtitles,
  selectedIdx,
  onSelect,
  onDeselect,
  onTimeSeek,
  currentTime,
  translationEdition,
  onSubtitleChange,
  onSubtitleDelete,
  onSetStartToPlayhead,
  onSetEndToPlayhead,
}: SubtitlePanelProps) {
  const selectedSub =
    selectedIdx !== null ? subtitles[selectedIdx] ?? null : null;

  // Edit mode — show SubtitleEditor with back button
  if (selectedSub) {
    return (
      <div className="flex h-full flex-col">
        <button
          type="button"
          onClick={onDeselect}
          className="flex items-center gap-2 border-b border-[var(--border)]/60 px-4 py-3 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>
            {subtitles.length} subtitle{subtitles.length !== 1 ? "s" : ""}
          </span>
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SubtitleEditor
            subtitle={selectedSub}
            currentTime={currentTime}
            translationEdition={translationEdition}
            onChange={onSubtitleChange}
            onDelete={onSubtitleDelete}
            onSetStartToPlayhead={onSetStartToPlayhead}
            onSetEndToPlayhead={onSetEndToPlayhead}
          />
        </div>
      </div>
    );
  }

  // List mode — show subtitle cards
  if (subtitles.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-[var(--border-light)] bg-[var(--surface)]">
          <Layers className="h-6 w-6 text-[var(--text-dim)]" />
        </div>
        <p className="text-sm font-medium text-[var(--text-muted)]">
          No subtitles yet
        </p>
        <p className="mt-1.5 max-w-[220px] text-xs leading-relaxed text-[var(--text-dim)]">
          Upload a recitation and Ayah Studio will detect the surah and generate
          timed subtitles automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--border)]/60 px-4 py-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)] font-[family-name:var(--font-ibm-plex)]">
          {subtitles.length} subtitle{subtitles.length !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="space-y-2">
          {subtitles.map((sub, idx) => (
            <button
              key={`sub-${sub.ayahNum}-${idx}`}
              type="button"
              onClick={() => {
                onSelect(idx);
                onTimeSeek(sub.start);
              }}
              aria-label={`Edit ${sub.label ?? `Ayah ${sub.ayahNum}`}, ${sub.start.toFixed(1)}s to ${sub.end.toFixed(1)}s`}
              className={[
                "w-full rounded-2xl border p-3 text-left transition-all duration-200 active:scale-[0.99]",
                selectedIdx === idx
                  ? "border-[var(--gold-dim)] bg-[var(--surface-alt)] shadow-[0_14px_34px_rgba(212,168,83,0.08)]"
                  : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-light)] hover:bg-[var(--surface-alt)]/50",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--gold)] font-[family-name:var(--font-ibm-plex)]">
                  {sub.label ?? `Ayah ${sub.ayahNum}`}
                  {sub.chunkCount && sub.chunkCount > 1
                    ? ` · ${sub.chunkIndex ?? 1}/${sub.chunkCount}`
                    : ""}
                </span>
                <span className="text-[10px] text-[var(--text-dim)] font-[family-name:var(--font-ibm-plex)]">
                  {sub.start.toFixed(1)}s &ndash; {sub.end.toFixed(1)}s
                </span>
              </div>
              <p
                dir="rtl"
                className="mt-1.5 truncate text-sm text-[var(--text-muted)] font-[family-name:var(--font-arabic)]"
              >
                {sub.arabic}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
