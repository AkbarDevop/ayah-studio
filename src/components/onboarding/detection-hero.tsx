"use client";

import { Sparkles, CheckCircle2, Search, Loader2, RotateCcw } from "lucide-react";
import type { AyahDetectionMatch, AyahDetectionResult } from "@/types";

interface DetectionHeroProps {
  result: AyahDetectionResult | null;
  detecting: boolean;
  videoSrc: string | null;
  videoName: string | null;
  onApply: (match: AyahDetectionMatch) => void;
  onPickManually: () => void;
  onRerun: () => void;
}

export default function DetectionHero({
  result,
  detecting,
  videoSrc,
  videoName,
  onApply,
  onPickManually,
  onRerun,
}: DetectionHeroProps) {
  const bestMatch = result?.matches[0] ?? null;
  const otherMatches = result?.matches.slice(1, 4) ?? [];
  const hasMatches = (result?.matches.length ?? 0) > 0;

  if (detecting) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--gold)]/10">
            <Loader2 className="h-7 w-7 animate-spin text-[var(--gold)]" />
          </div>
          <div>
            <p className="text-lg font-semibold text-[var(--text)]">
              Analyzing recitation...
            </p>
            <p className="mt-1.5 text-sm text-[var(--text-muted)]">
              Transcribing audio and matching against the Quran
            </p>
          </div>
          {videoName && (
            <p className="text-xs text-[var(--text-dim)]">{videoName}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-8">
      <div className="w-full max-w-3xl">
        <div className="grid gap-6 md:grid-cols-[1fr_1.1fr]">
          {/* Left: Video preview thumbnail */}
          <div className="studio-panel overflow-hidden rounded-2xl">
            {videoSrc ? (
              <video
                src={videoSrc}
                className="aspect-video w-full object-cover"
                muted
                playsInline
              />
            ) : (
              <div className="flex aspect-video items-center justify-center bg-[var(--surface-alt)]">
                <p className="text-sm text-[var(--text-dim)]">Audio only</p>
              </div>
            )}
            {videoName && (
              <div className="border-t border-[var(--border)]/60 px-4 py-2.5">
                <p className="truncate text-xs text-[var(--text-muted)]">
                  {videoName}
                </p>
              </div>
            )}
          </div>

          {/* Right: Detection result */}
          <div className="space-y-4">
            {bestMatch ? (
              <>
                {/* Best match card */}
                <div className="studio-panel rounded-2xl p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--gold)]/10">
                      <Sparkles className="h-5 w-5 text-[var(--gold)]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--gold)] font-[family-name:var(--font-ibm-plex)]">
                        Detected Surah
                      </p>
                      <p className="mt-1 text-xl font-semibold text-[var(--text)]">
                        {bestMatch.surahName}
                      </p>
                      <p className="mt-0.5 text-sm text-[var(--text-muted)]" dir="rtl">
                        {bestMatch.surahArabicName}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="metric-pill">
                          Ayahs {bestMatch.startAyah}
                          {bestMatch.endAyah !== bestMatch.startAyah
                            ? `–${bestMatch.endAyah}`
                            : ""}
                        </span>
                        <span className="metric-pill">
                          {Math.round(bestMatch.score * 100)}% match
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onApply(bestMatch)}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--gold)] px-4 py-3 text-sm font-semibold text-[var(--bg)] shadow-[0_16px_34px_rgba(212,168,83,0.22)] transition-all duration-200 hover:bg-[var(--gold-light)] active:scale-[0.98]"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Generate Subtitles
                  </button>
                </div>

                {/* Other matches */}
                {otherMatches.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--text-dim)] font-[family-name:var(--font-ibm-plex)]">
                      Other matches
                    </p>
                    {otherMatches.map((match, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => onApply(match)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--border)]/60 bg-[var(--surface)]/50 px-4 py-2.5 text-left text-sm transition-all hover:border-[var(--gold)]/30 hover:bg-[var(--surface)]"
                      >
                        <span className="text-[var(--text)]">
                          {match.surahName} {match.startAyah}
                          {match.endAyah !== match.startAyah
                            ? `–${match.endAyah}`
                            : ""}
                        </span>
                        <span className="text-xs text-[var(--text-dim)]">
                          {Math.round(match.score * 100)}%
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              /* No matches found */
              <div className="studio-panel rounded-2xl p-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface-alt)]">
                  <Search className="h-5 w-5 text-[var(--text-dim)]" />
                </div>
                <p className="text-base font-semibold text-[var(--text)]">
                  No surah detected
                </p>
                <p className="mt-1.5 text-sm text-[var(--text-muted)]">
                  The audio couldn&apos;t be matched to a Quran passage.
                  Try a clearer recitation or pick the surah manually.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onPickManually}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]/50 px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] transition-all hover:border-[var(--gold)]/30 hover:text-[var(--text)]"
              >
                <Search className="h-3.5 w-3.5" />
                Pick surah manually
              </button>
              <button
                type="button"
                onClick={onRerun}
                className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]/50 px-3 py-2.5 text-sm text-[var(--text-dim)] transition-all hover:border-[var(--gold)]/30 hover:text-[var(--text)]"
                title="Re-run detection"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>

            {result?.warning && (
              <p className="text-xs text-amber-400/80">{result.warning}</p>
            )}
            {!hasMatches && result?.transcript && (
              <details className="text-xs text-[var(--text-dim)]">
                <summary className="cursor-pointer hover:text-[var(--text-muted)]">
                  Debug: raw transcript ({result.provider})
                </summary>
                <p className="mt-1 whitespace-pre-wrap rounded-lg bg-[var(--surface-alt)] p-2 font-mono" dir="rtl">
                  {result.transcript}
                </p>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
