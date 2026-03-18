"use client";

import { useState } from "react";
import { Headphones, Wand2, Loader2, ChevronDown, Volume2 } from "lucide-react";
import { RECITER_EDITIONS } from "@/lib/constants";
import type { AyahAudioEntry } from "@/lib/audio-api";

interface ReciterPanelProps {
  selectedReciter: string;
  onReciterChange: (reciterId: string) => void;
  onLoadAudio: () => void;
  onAutoSync: () => void;
  audioLoading: boolean;
  audioProgress: { loaded: number; total: number } | null;
  ayahAudios: AyahAudioEntry[];
  subtitlesExist: boolean;
  surahSelected: boolean;
}

export default function ReciterPanel({
  selectedReciter,
  onReciterChange,
  onLoadAudio,
  onAutoSync,
  audioLoading,
  audioProgress,
  ayahAudios,
  subtitlesExist,
  surahSelected,
}: ReciterPanelProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const selectedEdition = RECITER_EDITIONS.find((r) => r.id === selectedReciter);
  const audioReady = ayahAudios.length > 0 && ayahAudios.every((a) => a.duration !== null);
  const hasAudio = ayahAudios.length > 0;

  return (
    <div className="border-b border-[var(--border)] bg-[var(--surface)]/70 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Reciter Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            disabled={!surahSelected}
            className={[
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
              surahSelected
                ? "border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text)] hover:border-[var(--border-light)]"
                : "cursor-not-allowed border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text-dim)] opacity-60",
            ].join(" ")}
          >
            <Headphones className="h-4 w-4 text-[var(--emerald)]" />
            <span className="max-w-[180px] truncate">
              {selectedEdition?.name ?? "Select Reciter"}
            </span>
            <ChevronDown
              className={[
                "h-3.5 w-3.5 text-[var(--text-dim)] transition-transform",
                dropdownOpen ? "rotate-180" : "",
              ].join(" ")}
            />
          </button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute left-0 top-full z-40 mt-1 w-72 rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 shadow-xl shadow-black/30">
                {RECITER_EDITIONS.map((reciter) => (
                  <button
                    key={reciter.id}
                    type="button"
                    onClick={() => {
                      onReciterChange(reciter.id);
                      setDropdownOpen(false);
                    }}
                    className={[
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                      selectedReciter === reciter.id
                        ? "bg-[var(--gold)]/10 text-[var(--gold)]"
                        : "text-[var(--text-muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]",
                    ].join(" ")}
                  >
                    {selectedReciter === reciter.id && (
                      <Volume2 className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className={selectedReciter === reciter.id ? "" : "pl-[22px]"}>
                      {reciter.name}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Load Audio Button */}
        <button
          type="button"
          onClick={onLoadAudio}
          disabled={!surahSelected || audioLoading}
          className={[
            "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
            surahSelected && !audioLoading
              ? "bg-[var(--emerald)] text-white hover:bg-[var(--emerald-light)]"
              : "cursor-not-allowed bg-[var(--surface-alt)] text-[var(--text-dim)]",
          ].join(" ")}
        >
          {audioLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Headphones className="h-4 w-4" />
          )}
          <span>
            {audioLoading && audioProgress
              ? `Loading ${audioProgress.loaded}/${audioProgress.total}...`
              : hasAudio
                ? "Reload Audio"
                : "Load Audio"}
          </span>
        </button>

        {/* Audio status */}
        {hasAudio && !audioLoading && (
          <span className="font-mono-ui text-[11px] uppercase tracking-wider text-[var(--emerald-light)]">
            {ayahAudios.length} ayahs loaded
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Auto-Sync Button */}
        {subtitlesExist && audioReady && (
          <button
            type="button"
            onClick={onAutoSync}
            className="flex items-center gap-2 rounded-lg bg-[var(--gold)] px-3.5 py-2 text-sm font-semibold text-[var(--bg)] shadow-lg shadow-[var(--gold)]/20 transition-all hover:bg-[var(--gold-light)] active:scale-[0.98]"
            title="Sets each subtitle's duration to match the reciter's actual audio timing"
          >
            <Wand2 className="h-4 w-4" />
            <span>Auto-Sync Timing</span>
          </button>
        )}
      </div>

      {/* Loading progress bar */}
      {audioLoading && audioProgress && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--surface-alt)]">
          <div
            className="h-full rounded-full bg-[var(--gold)] transition-all duration-300"
            style={{
              width: `${(audioProgress.loaded / audioProgress.total) * 100}%`,
            }}
          />
        </div>
      )}

      {!surahSelected && (
        <p className="mt-2 text-xs text-[var(--text-dim)]">
          Select a surah first to load recitation audio.
        </p>
      )}
    </div>
  );
}
