"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import {
  BookOpen,
  Layers,
  Star,
  Download,
  Upload,
  Link2,
  X,
  Monitor,
  Smartphone,
  Square,
  Sparkles,
} from "lucide-react";
import type {
  Surah,
  AyahDetectionMatch,
  SubtitlePlacement,
  SidebarTab,
  AspectRatioPreset,
  PlaybackMode,
} from "@/types";
import { MAX_AYAH_DETECT_UPLOAD_MB } from "@/lib/ayah-detection-config";
import {
  ARABIC_FONT_OPTIONS,
  resolveSubtitleColors,
  TRANSLATION_FONT_OPTIONS,
} from "@/lib/subtitle-formatting";
import { MAX_YOUTUBE_IMPORT_MB } from "@/lib/youtube-import";
import { SUBTITLE_STYLES, RECITERS } from "@/lib/constants";
import {
  fetchAllSurahs,
  fetchBasmalaTranslation,
  fetchSurahWithTranslation,
} from "@/lib/quran-api";
import { buildSubtitlesFromAyahRange } from "@/lib/subtitle-generation";
import { useQuranData } from "@/hooks/useQuranData";
import { useMediaState } from "@/hooks/useMediaState";
import { usePlayback, useSimulationTimer } from "@/hooks/usePlayback";
import { useSubtitles } from "@/hooks/useSubtitles";
import { useDetectionState } from "@/hooks/useDetectionState";
import AudioWaveform from "@/components/audio/audio-waveform";
import SurahBrowser from "@/components/editor/surah-browser";
import AyahSelector from "@/components/editor/ayah-selector";
import VideoPreview from "@/components/preview/video-preview";
import TimelineTrack from "@/components/timeline/timeline-track";
import SubtitleEditor from "@/components/subtitle/subtitle-editor";
import ExportPanel from "@/components/export/export-panel";

const ASPECT_RATIO_OPTIONS: {
  id: AspectRatioPreset;
  label: string;
  hint: string;
  icon: typeof Monitor;
}[] = [
  {
    id: "landscape",
    label: "16:9",
    hint: "YouTube",
    icon: Monitor,
  },
  {
    id: "portrait",
    label: "9:16",
    hint: "Reels",
    icon: Smartphone,
  },
  {
    id: "square",
    label: "1:1",
    hint: "Feed",
    icon: Square,
  },
];

const SUBTITLE_POSITION_PRESETS: {
  id: string;
  label: string;
  description: string;
  placement: SubtitlePlacement;
}[] = [
  {
    id: "upper-third",
    label: "Upper 1/3",
    description: "For clips with clean space above the reciter.",
    placement: { x: 0.5, y: 0.34 },
  },
  {
    id: "center",
    label: "Center",
    description: "Useful when the bottom already has baked-in text.",
    placement: { x: 0.5, y: 0.5 },
  },
  {
    id: "lower-third",
    label: "Lower 1/3",
    description: "Classic Quran short-form subtitle placement.",
    placement: { x: 0.5, y: 0.78 },
  },
];

export default function Home() {
  /* ------------------------------------------------------------------ */
  /* State                                                               */
  /* ------------------------------------------------------------------ */
  const quran = useQuranData();
  const {
    currentTime,
    setCurrentTime,
    playing,
    setPlaying,
    reset: resetPlayback,
  } = usePlayback();
  const detection = useDetectionState();

  function resetMediaSession() {
    detection.reset();
    resetPlayback();
  }

  const media = useMediaState(resetMediaSession);
  const subtitlesState = useSubtitles(resetPlayback);

  /* ------------------------------------------------------------------ */
  /* Derived                                                             */
  /* ------------------------------------------------------------------ */
  const activeAudioSrc = media.activeAudioSrc;
  const activeAudioName = media.activeAudioName;
  const usingClipAudio = media.usingClipAudio;
  const detectionSourceFile = media.audioFile ?? media.videoFile;
  const detectionSourceLabel = media.audioFile
    ? media.audioName ?? media.audioFile.name
    : media.videoFile
      ? media.videoName ?? media.videoFile.name
      : null;
  const detectionSourceKey = detectionSourceFile
    ? [
        detectionSourceFile.name,
        detectionSourceFile.size,
        detectionSourceFile.lastModified,
      ].join(":")
    : null;
  const bestDetection = detection.detectionResult?.matches[0] ?? null;
  const nextBestDetection = detection.detectionResult?.matches[1] ?? null;
  const appliedDetection = detection.detectionResult?.matches.find(
    (match) => getDetectionKey(match) === detection.appliedDetectionKey
  ) ?? null;
  const detectedMediaDuration = Math.max(
    media.audioDuration,
    media.videoDuration
  );
  const playbackMode: PlaybackMode =
    activeAudioSrc && !media.audioError
      ? "audio"
      : media.videoSrc
        ? "video"
        : "simulation";
  const totalDuration =
    media.audioDuration > 0 || media.videoDuration > 0
      ? Math.max(
          media.audioDuration,
          media.videoDuration,
          subtitlesState.subtitleDuration
        )
      : subtitlesState.subtitleDuration > 0
        ? subtitlesState.subtitleDuration
        : 60;
  const previewSubtitle = subtitlesState.previewSubtitle;
  const resolvedSubtitleColors = resolveSubtitleColors(
    subtitlesState.subtitleStyle,
    subtitlesState.subtitleFormatting
  );
  const selectedAyahCount = quran.selectedAyahIndices.size;
  const activeSubtitleStyle =
    SUBTITLE_STYLES.find(
      (candidate) => candidate.id === subtitlesState.subtitleStyle
    )?.label ?? SUBTITLE_STYLES[0]?.label ?? "Classic Gold";
  const activeRatioOption =
    ASPECT_RATIO_OPTIONS.find(
      (option) => option.id === subtitlesState.aspectRatio
    ) ?? ASPECT_RATIO_OPTIONS[0];
  const detectionProviderLabel = detection.detectionResult
    ? detection.detectionResult.provider.startsWith("local:")
      ? "Local Whisper"
      : "Remote ASR"
    : detection.detectingAyahs
      ? "Analyzing"
      : "Idle";
  const hasMedia = Boolean(media.videoSrc || media.audioSrc);
  const autoDetectedSourceKeyRef = useRef<string | null>(null);
  const autoAppliedDetectionKeyRef = useRef<string | null>(null);

  /* ------------------------------------------------------------------ */
  /* Subtitle generation                                                 */
  /* ------------------------------------------------------------------ */
  function generateSubtitles() {
    subtitlesState.generateSubtitles(
      quran.ayahs,
      quran.translations,
      quran.selectedAyahIndices,
      quran.selectedSurah?.englishName
    );
  }

  function handleSubtitleBoundaryChange(
    idx: number,
    edge: "start" | "end",
    seconds: number
  ) {
    const subtitle = subtitlesState.subtitles[idx];
    if (!subtitle) {
      return;
    }

    subtitlesState.updateSubtitleAtIndex(idx, {
      ...subtitle,
      [edge]: seconds,
    });
  }

  function handleSetSelectedBoundaryToPlayhead(edge: "start" | "end") {
    if (subtitlesState.selectedSubIdx === null) {
      return;
    }

    handleSubtitleBoundaryChange(
      subtitlesState.selectedSubIdx,
      edge,
      currentTime
    );
  }

  /* ------------------------------------------------------------------ */
  /* Playback simulation                                                 */
  /* ------------------------------------------------------------------ */
  useSimulationTimer(
    playbackMode,
    playing,
    totalDuration,
    setCurrentTime,
    setPlaying
  );

  function togglePlayPause() {
    if (!activeAudioSrc && !media.videoSrc && subtitlesState.subtitles.length === 0) return;
    setPlaying((prev) => !prev);
  }

  async function handleDetectAyahs() {
    await detection.detectAyahs(detectionSourceFile);
  }

  async function applyDetectedMatch(
    match: AyahDetectionMatch,
    mode: "auto" | "manual" = "manual"
  ) {
    try {
      detection.setDetectionError(null);

      let targetSurah: Surah | undefined = quran.surahs.find(
        (surah) => surah.number === match.surahNumber
      );
      if (!targetSurah) {
        const allSurahs = await fetchAllSurahs();
        quran.setSurahs(allSurahs);
        targetSurah = allSurahs.find(
          (surah) => surah.number === match.surahNumber
        );
      }

      if (!targetSurah) {
        throw new Error("The detected surah could not be loaded.");
      }

      const existingSurahIsLoaded =
        quran.selectedSurah?.number === targetSurah.number;
      const content = existingSurahIsLoaded
        ? { ayahs: quran.ayahs, translations: quran.translations }
        : await quran.fetchSurahContent(targetSurah);
      const rangeIndices = new Set(
        Array.from(
          { length: match.endAyah - match.startAyah + 1 },
          (_, offset) => match.startAyah - 1 + offset
        )
      );
      const rangeAyahs = content.ayahs.filter(
        (ayah) =>
          ayah.numberInSurah >= match.startAyah && ayah.numberInSurah <= match.endAyah
      );

      quran.setAyahs(content.ayahs);
      quran.setTranslations(content.translations);
      quran.setSelectedSurah(targetSurah);
      quran.setSelectedAyahIndices(rangeIndices);
      const leadingSubtitles = await buildLeadingSubtitles(
        match,
        quran.translationEdition,
        subtitlesState.defaultDuration,
        subtitlesState.subtitleFormatting
      );
      subtitlesState.applyDetectedSubtitles(rangeAyahs, content.translations, {
        surahLabel: targetSurah.englishName,
        detectedTimings: match.timings,
        clipDuration: detectedMediaDuration > 0 ? detectedMediaDuration : undefined,
        leadingSubtitles,
      });
      detection.setAppliedDetectionMode(mode);
      detection.setAppliedDetectionKey(getDetectionKey(match));
    } catch (err) {
      detection.setDetectionError(
        err instanceof Error ? err.message : "Failed to apply the detected ayahs."
      );
    }
  }

  const runAutoDetection = useEffectEvent(async (sourceFile: File) => {
    await detection.detectAyahs(sourceFile);
  });

  const runAutoApplyBestMatch = useEffectEvent(async (match: AyahDetectionMatch) => {
    await applyDetectedMatch(match, "auto");
  });

  useEffect(() => {
    if (!detectionSourceFile || !detectionSourceKey) {
      autoDetectedSourceKeyRef.current = null;
      autoAppliedDetectionKeyRef.current = null;
      return;
    }

    if (detection.detectingAyahs) {
      return;
    }

    if (autoDetectedSourceKeyRef.current === detectionSourceKey) {
      return;
    }

    autoDetectedSourceKeyRef.current = detectionSourceKey;
    autoAppliedDetectionKeyRef.current = null;
    void runAutoDetection(detectionSourceFile);
  }, [detectionSourceFile, detectionSourceKey, detection.detectingAyahs]);

  useEffect(() => {
    if (
      !bestDetection ||
      !detectionSourceKey ||
      detection.detectingAyahs ||
      !shouldAutoApplyDetection(bestDetection, nextBestDetection)
    ) {
      return;
    }

    const matchKey = getDetectionKey(bestDetection);
    const autoApplyKey = `${detectionSourceKey}:${matchKey}`;

    if (
      autoAppliedDetectionKeyRef.current === autoApplyKey ||
      detection.appliedDetectionKey === matchKey
    ) {
      autoAppliedDetectionKeyRef.current = autoApplyKey;
      return;
    }

    autoAppliedDetectionKeyRef.current = autoApplyKey;
    void runAutoApplyBestMatch(bestDetection);
  }, [
    bestDetection,
    nextBestDetection,
    detectionSourceKey,
    detection.detectingAyahs,
    detection.appliedDetectionKey,
  ]);

  /* ------------------------------------------------------------------ */
  /* Sidebar tab config                                                  */
  /* ------------------------------------------------------------------ */
  const tabs: { id: SidebarTab; label: string; icon: typeof BookOpen }[] = [
    { id: "browse", label: "Browse", icon: BookOpen },
    { id: "subtitles", label: "Subtitles", icon: Layers },
    { id: "style", label: "Style", icon: Star },
  ];

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */
  return (
    <div className="studio-shell flex min-h-screen flex-col">
      <header className="border-b border-[var(--border)]/80 bg-[rgba(12,15,20,0.8)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1800px] flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="text-[var(--gold)]">
              <svg width="30" height="30" viewBox="0 0 30 30">
                <circle
                  cx="15"
                  cy="15"
                  r="13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
                <polygon
                  points="15,4 18,12 15,10 12,12"
                  fill="currentColor"
                  opacity="0.6"
                />
                <polygon
                  points="15,26 18,18 15,20 12,18"
                  fill="currentColor"
                  opacity="0.6"
                />
                <polygon
                  points="4,15 12,12 10,15 12,18"
                  fill="currentColor"
                  opacity="0.6"
                />
                <polygon
                  points="26,15 18,12 20,15 18,18"
                  fill="currentColor"
                  opacity="0.6"
                />
                <circle
                  cx="15"
                  cy="15"
                  r="3"
                  fill="currentColor"
                  opacity="0.3"
                />
              </svg>
            </div>

            <div>
              <h1 className="text-[24px] font-semibold leading-tight text-[var(--gold)]">
                Ayah Studio
              </h1>
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)] font-[family-name:var(--font-ibm-plex)]">
                Quran video editor
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="metric-pill">{activeRatioOption.label}</span>
            <span className="metric-pill">{detectionProviderLabel}</span>
            {subtitlesState.subtitles.length > 0 && (
              <button
                type="button"
                onClick={() => subtitlesState.setShowExport(true)}
                className="flex items-center gap-2 rounded-xl bg-[var(--gold)] px-4 py-2.5 text-sm font-semibold text-[var(--bg)] shadow-[0_16px_34px_rgba(212,168,83,0.22)] transition-all hover:bg-[var(--gold-light)] active:scale-[0.98]"
              >
                <Download className="h-4 w-4" />
                <span>Export</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden px-4 pb-4 pt-4">
        <div className="mx-auto grid h-full max-w-[1800px] gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="studio-panel flex min-h-0 flex-col overflow-hidden">
            <div className="border-b border-[var(--border)]/80 p-4">
              <div className="rounded-[1.1rem] border border-[var(--border)]/55 bg-black/5 p-4">
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-[var(--text)]">
                      Library
                    </h2>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      Browse ayahs, blocks, and styling.
                    </p>
                  </div>
                  <span className="metric-pill">
                    {quran.selectedSurah?.englishName ?? "No Surah Loaded"}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-alt)]/60 p-1">
                  {tabs.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => subtitlesState.setTab(id)}
                      className={[
                        "flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors font-[family-name:var(--font-ibm-plex)]",
                        subtitlesState.tab === id
                          ? "bg-[var(--gold)] text-[var(--bg)] shadow-[0_12px_30px_rgba(212,168,83,0.22)]"
                          : "text-[var(--text-muted)] hover:bg-black/15 hover:text-[var(--text)]",
                      ].join(" ")}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="metric-pill">{selectedAyahCount} selected</span>
                  <span className="metric-pill">
                    {subtitlesState.subtitles.length} blocks
                  </span>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {subtitlesState.tab === "browse" && (
                <>
                  {quran.loading && (
                    <div className="flex items-center justify-center py-16">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--gold-dim)] border-t-[var(--gold)]" />
                    </div>
                  )}

                  {quran.error && (
                    <div className="mb-4 rounded-xl border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-3 text-sm text-[var(--accent)]">
                      {quran.error}
                    </div>
                  )}

                  {!quran.loading && !quran.selectedSurah && (
                    <SurahBrowser
                      surahs={quran.surahs}
                      searchQuery={quran.searchQuery}
                      onSearchChange={quran.setSearchQuery}
                      onSelect={quran.loadSurah}
                      translationEdition={quran.translationEdition}
                      onTranslationChange={quran.setTranslationEdition}
                    />
                  )}

                  {!quran.loading && quran.selectedSurah && (
                    <AyahSelector
                      surahName={quran.selectedSurah.name}
                      ayahs={quran.ayahs}
                      translations={quran.translations}
                      selectedIndices={quran.selectedAyahIndices}
                      onToggle={quran.toggleAyahIndex}
                      onSelectAll={quran.selectAllAyahs}
                      onDeselectAll={quran.deselectAllAyahs}
                      onBack={quran.clearSelection}
                      onGenerate={generateSubtitles}
                      defaultDuration={subtitlesState.defaultDuration}
                      onDurationChange={subtitlesState.setDefaultDuration}
                    />
                  )}
                </>
              )}

              {subtitlesState.tab === "subtitles" && (
                <div className="p-1">
                  {subtitlesState.subtitles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <Layers className="mb-3 h-8 w-8 text-[var(--text-dim)]" />
                      <p className="text-sm text-[var(--text-muted)]">
                        No subtitles yet
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-dim)]">
                        Browse a surah and generate subtitles
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)] font-[family-name:var(--font-ibm-plex)]">
                        {subtitlesState.subtitles.length} subtitle
                        {subtitlesState.subtitles.length !== 1 ? "s" : ""}
                      </p>
                      {subtitlesState.subtitles.map((sub, idx) => (
                        <button
                          key={`sub-${sub.ayahNum}-${idx}`}
                          type="button"
                          onClick={() => {
                            subtitlesState.setSelectedSubIdx(idx);
                            setCurrentTime(sub.start);
                          }}
                          className={[
                            "w-full rounded-2xl border p-3 text-left transition-all",
                            subtitlesState.selectedSubIdx === idx
                              ? "border-[var(--gold-dim)] bg-[var(--surface-alt)] shadow-[0_14px_34px_rgba(212,168,83,0.08)]"
                              : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-light)]",
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
                              {sub.start.toFixed(1)}s &ndash;{" "}
                              {sub.end.toFixed(1)}s
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
                  )}
                </div>
              )}

              {subtitlesState.tab === "style" && (
                <div className="p-1">
                  <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)] font-[family-name:var(--font-ibm-plex)]">
                    Subtitle Style
                  </p>

                  <div className="space-y-3">
                    {SUBTITLE_STYLES.map((style) => {
                      const isActive = subtitlesState.subtitleStyle === style.id;
                      return (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => subtitlesState.setSubtitleStyle(style.id)}
                          className={[
                            "w-full rounded-2xl border p-3 text-left transition-all",
                            isActive
                              ? "border-[var(--gold-dim)] bg-[var(--surface-alt)] shadow-[0_14px_34px_rgba(212,168,83,0.08)]"
                              : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-light)]",
                          ].join(" ")}
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-medium text-[var(--text)]">
                              {style.label}
                            </span>
                            {isActive && (
                              <span className="rounded-full bg-[var(--gold)] px-2 py-0.5 text-[10px] font-semibold text-[var(--bg)]">
                                Active
                              </span>
                            )}
                          </div>

                          <div
                            data-subtitle-theme={style.id}
                            className="subtitle-theme-surface rounded-md px-4 py-3 text-center"
                          >
                            <p
                              dir="rtl"
                              className="subtitle-theme-arabic text-lg leading-relaxed"
                            >
                              {"\u0628\u0650\u0633\u0652\u0645\u0650 \u0671\u0644\u0644\u0651\u064E\u0647\u0650 \u0671\u0644\u0631\u0651\u064E\u062D\u0652\u0645\u064E\u0640\u0670\u0646\u0650 \u0671\u0644\u0631\u0651\u064E\u062D\u0650\u064A\u0645\u0650"}
                            </p>
                            <p className="subtitle-theme-translation mt-1 text-xs italic">
                              In the name of God, the Most Gracious, the Most
                              Merciful
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-6">
                    <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)] font-[family-name:var(--font-ibm-plex)]">
                      Formatting
                    </p>
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="block">
                          <span className="font-mono-ui mb-1 block text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                            Arabic Font
                          </span>
                          <select
                            value={subtitlesState.subtitleFormatting.arabicFontFamily}
                            onChange={(event) =>
                              subtitlesState.updateSubtitleFormatting({
                                arabicFontFamily: event.target.value as "amiri" | "naskh",
                              })
                            }
                            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--gold-dim)]"
                          >
                            {ARABIC_FONT_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block">
                          <span className="font-mono-ui mb-1 block text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                            Translation Font
                          </span>
                          <select
                            value={subtitlesState.subtitleFormatting.translationFontFamily}
                            onChange={(event) =>
                              subtitlesState.updateSubtitleFormatting({
                                translationFontFamily: event.target.value as "ui" | "mono",
                              })
                            }
                            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--gold-dim)]"
                          >
                            {TRANSLATION_FONT_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <label className="mt-4 block">
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <span className="font-mono-ui block text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                            Arabic Size
                          </span>
                          <span className="font-mono-ui text-[11px] text-[var(--text-dim)]">
                            {subtitlesState.subtitleFormatting.arabicFontSize}px
                          </span>
                        </div>
                        <input
                          type="range"
                          min={20}
                          max={44}
                          step={1}
                          value={subtitlesState.subtitleFormatting.arabicFontSize}
                          onChange={(event) =>
                            subtitlesState.updateSubtitleFormatting({
                              arabicFontSize: Number.parseInt(event.target.value, 10),
                            })
                          }
                          className="w-full accent-[var(--gold)]"
                        />
                      </label>

                      <label className="mt-4 block">
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <span className="font-mono-ui block text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                            Translation Size
                          </span>
                          <span className="font-mono-ui text-[11px] text-[var(--text-dim)]">
                            {subtitlesState.subtitleFormatting.translationFontSize}px
                          </span>
                        </div>
                        <input
                          type="range"
                          min={12}
                          max={28}
                          step={1}
                          value={subtitlesState.subtitleFormatting.translationFontSize}
                          onChange={(event) =>
                            subtitlesState.updateSubtitleFormatting({
                              translationFontSize: Number.parseInt(event.target.value, 10),
                            })
                          }
                          className="w-full accent-[var(--gold)]"
                        />
                      </label>

                      <label className="mt-4 block">
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <span className="font-mono-ui block text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                            Arabic Color
                          </span>
                          <span className="font-mono-ui text-[11px] text-[var(--text-dim)]">
                            {resolvedSubtitleColors.arabicColor}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={resolvedSubtitleColors.arabicColor}
                            onChange={(event) =>
                              subtitlesState.updateSubtitleFormatting({
                                arabicColorOverride: event.target.value,
                              })
                            }
                            className="h-10 w-14 cursor-pointer rounded border border-[var(--border)] bg-[var(--surface-alt)]"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              subtitlesState.updateSubtitleFormatting({
                                arabicColorOverride: null,
                              })
                            }
                            className="font-mono-ui rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 py-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)] transition-colors hover:border-[var(--gold-dim)] hover:text-[var(--text)]"
                          >
                            Use Style Color
                          </button>
                        </div>
                      </label>

                      <label className="mt-4 block">
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <span className="font-mono-ui block text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                            Translation Color
                          </span>
                          <span className="font-mono-ui text-[11px] text-[var(--text-dim)]">
                            {resolvedSubtitleColors.translationColor}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={resolvedSubtitleColors.translationColor}
                            onChange={(event) =>
                              subtitlesState.updateSubtitleFormatting({
                                translationColorOverride: event.target.value,
                              })
                            }
                            className="h-10 w-14 cursor-pointer rounded border border-[var(--border)] bg-[var(--surface-alt)]"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              subtitlesState.updateSubtitleFormatting({
                                translationColorOverride: null,
                              })
                            }
                            className="font-mono-ui rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 py-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)] transition-colors hover:border-[var(--gold-dim)] hover:text-[var(--text)]"
                          >
                            Use Style Color
                          </button>
                        </div>
                      </label>

                      <label className="mt-4 flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={subtitlesState.subtitleFormatting.translationItalic}
                          onChange={(event) =>
                            subtitlesState.updateSubtitleFormatting({
                              translationItalic: event.target.checked,
                            })
                          }
                          className="mt-0.5 h-4 w-4 rounded border-[var(--border)] bg-[var(--surface-alt)] accent-[var(--gold)]"
                        />
                        <span>
                          <span className="block text-sm text-[var(--text)]">
                            Italicize translation text
                          </span>
                          <span className="mt-1 block text-xs leading-relaxed text-[var(--text-dim)]">
                            Applies to the preview and styled `.ASS` export.
                          </span>
                        </span>
                      </label>

                      <label className="mt-4 block">
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <span className="font-mono-ui block text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                            Background Opacity
                          </span>
                          <span className="font-mono-ui text-[11px] text-[var(--text-dim)]">
                            {subtitlesState.subtitleFormatting.backgroundOpacity}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={subtitlesState.subtitleFormatting.backgroundOpacity}
                          onChange={(event) =>
                            subtitlesState.updateSubtitleFormatting({
                              backgroundOpacity: Number.parseInt(event.target.value, 10),
                            })
                          }
                          className="w-full accent-[var(--gold)]"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="mt-6">
                    <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)] font-[family-name:var(--font-ibm-plex)]">
                      Long Ayah Handling
                    </p>
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={subtitlesState.subtitleFormatting.splitLongAyahs}
                          onChange={(event) =>
                            subtitlesState.updateSubtitleFormatting({
                              splitLongAyahs: event.target.checked,
                            })
                          }
                          className="mt-0.5 h-4 w-4 rounded border-[var(--border)] bg-[var(--surface-alt)] accent-[var(--gold)]"
                        />
                        <span>
                          <span className="block text-sm text-[var(--text)]">
                            Split long ayahs into multiple timed subtitle chunks
                          </span>
                          <span className="mt-1 block text-xs leading-relaxed text-[var(--text-dim)]">
                            Applies to new subtitle generation and detected ayah
                            ranges.
                          </span>
                        </span>
                      </label>

                      <label className="mt-4 block">
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <span className="font-mono-ui block text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                            Max Arabic Words Per Chunk
                          </span>
                          <span className="font-mono-ui text-[11px] text-[var(--text-dim)]">
                            {subtitlesState.subtitleFormatting.maxWordsPerChunk}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={6}
                          max={22}
                          step={1}
                          value={subtitlesState.subtitleFormatting.maxWordsPerChunk}
                          onChange={(event) =>
                            subtitlesState.updateSubtitleFormatting({
                              maxWordsPerChunk: Number.parseInt(event.target.value, 10),
                            })
                          }
                          className="w-full accent-[var(--gold)]"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="mt-6">
                    <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)] font-[family-name:var(--font-ibm-plex)]">
                      Reciter Reference
                    </p>
                    <div className="space-y-1">
                      {RECITERS.map((name) => (
                        <div
                          key={name}
                          className="rounded-md px-3 py-2 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-alt)] hover:text-[var(--text)]"
                        >
                          {name}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)] font-[family-name:var(--font-ibm-plex)]">
                        Subtitle Position
                      </p>
                      <span className="font-mono-ui text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
                        X {Math.round(subtitlesState.subtitlePlacement.x * 100)}%
                        · Y {Math.round(subtitlesState.subtitlePlacement.y * 100)}%
                      </span>
                    </div>
                    <p className="mb-3 text-xs leading-relaxed text-[var(--text-muted)]">
                      Drag the live subtitle in the preview to fine-tune, or
                      jump to a preset below.
                    </p>
                    <div className="space-y-2">
                      {SUBTITLE_POSITION_PRESETS.map((preset) => {
                        const isActive =
                          Math.abs(
                            subtitlesState.subtitlePlacement.x - preset.placement.x
                          ) < 0.01 &&
                          Math.abs(
                            subtitlesState.subtitlePlacement.y - preset.placement.y
                          ) < 0.01;

                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() =>
                              subtitlesState.setSubtitlePlacement(preset.placement)
                            }
                            className={[
                              "w-full rounded-2xl border p-3 text-left transition-colors",
                              isActive
                                ? "border-[var(--gold-dim)] bg-[var(--surface-alt)]"
                                : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-light)]",
                            ].join(" ")}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-mono-ui text-xs font-semibold uppercase tracking-[0.12em] text-[var(--gold)]">
                                {preset.label}
                              </span>
                              {isActive && (
                                <span className="rounded-full bg-[var(--gold)] px-2 py-0.5 text-[10px] font-semibold text-[var(--bg)]">
                                  Active
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                              {preset.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>

          <main className="min-h-0 overflow-y-auto pr-1">
            <div className="space-y-4 pb-1">
              <section className="studio-panel-soft flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <span className="metric-pill">
                    {hasMedia ? "Source Ready" : "No Source"}
                  </span>
                  <span className="metric-pill">
                    {selectedAyahCount} selected
                  </span>
                  <span className="metric-pill">
                    {subtitlesState.subtitles.length} blocks
                  </span>
                  <span className="metric-pill">{activeSubtitleStyle}</span>
                </div>
                {appliedDetection && (
                  <span className="metric-pill">
                    {appliedDetection.surahName} {appliedDetection.startAyah}
                    {appliedDetection.endAyah !== appliedDetection.startAyah
                      ? `-${appliedDetection.endAyah}`
                      : ""}
                  </span>
                )}
              </section>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_360px]">
                <div className="min-h-0 space-y-4">
                  <section className="studio-panel p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h2 className="text-base font-semibold text-[var(--text)]">
                          Source
                        </h2>
                      </div>
                      <span className="metric-pill">Auto-detect on upload</span>
                    </div>

                    <input
                      ref={media.videoInputRef}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={media.handleVideoUpload}
                    />
                    <input
                      ref={media.audioInputRef}
                      type="file"
                      accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.ogg,.webm"
                      className="hidden"
                      onChange={media.handleAudioUpload}
                    />

                    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_320px]">
                      <div className="studio-panel-soft p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="section-kicker">Video</p>
                            <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                              {media.videoName
                                ? media.videoName
                                : "No clip loaded yet. Preview uses the design canvas."}
                            </p>
                          </div>
                          {media.videoDuration > 0 && (
                            <span className="metric-pill">
                              {media.videoDuration.toFixed(1)}s
                            </span>
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => media.videoInputRef.current?.click()}
                            className="flex items-center gap-2 rounded-xl bg-[var(--gold)] px-3.5 py-2.5 text-sm font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--gold-light)]"
                          >
                            <Upload className="h-4 w-4" />
                            <span>
                              {media.videoSrc ? "Replace Clip" : "Upload Clip"}
                            </span>
                          </button>

                          {media.videoSrc && (
                            <button
                              type="button"
                              onClick={media.clearVideo}
                              className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5 text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--border-light)] hover:text-[var(--text)]"
                            >
                              <X className="h-4 w-4" />
                              <span>Clear</span>
                            </button>
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <input
                            type="url"
                            value={media.youtubeUrl}
                            onChange={(event) =>
                              media.setYoutubeUrl(event.target.value)
                            }
                            placeholder="Paste a YouTube link"
                            className="min-w-[220px] flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--gold-dim)]"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              void media.importFromYouTube();
                            }}
                            disabled={media.youtubeImporting}
                            className={[
                              "flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors",
                              media.youtubeImporting
                                ? "cursor-wait bg-[var(--border)] text-[var(--text-dim)]"
                                : "bg-[var(--emerald)] text-white hover:bg-[var(--emerald-light)]",
                            ].join(" ")}
                          >
                            <Link2 className="h-4 w-4" />
                            <span>
                              {media.youtubeImporting
                                ? "Importing..."
                                : "Import Link"}
                            </span>
                          </button>
                        </div>

                        <p className="mt-3 text-xs text-[var(--text-dim)]">
                          Single YouTube URL. Limit: {MAX_YOUTUBE_IMPORT_MB} MB.
                        </p>

                        {(media.videoError || media.youtubeImportError) && (
                          <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            {media.videoError && (
                              <span className="rounded-full bg-[var(--accent)]/12 px-2.5 py-1 text-[var(--accent)]">
                                {media.videoError}
                              </span>
                            )}
                            {media.youtubeImportError && (
                              <span className="rounded-full bg-[var(--accent)]/12 px-2.5 py-1 text-[var(--accent)]">
                                {media.youtubeImportError}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="studio-panel-soft p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="section-kicker">Audio</p>
                            <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                              {media.audioSrc
                                ? `Override track: ${media.audioName}`
                                : media.videoName
                                  ? `Using clip audio from ${media.videoName}`
                                  : "Clip audio is used automatically. Override is optional."}
                            </p>
                          </div>
                          {media.audioDuration > 0 && (
                            <span className="metric-pill">
                              {media.audioDuration.toFixed(1)}s
                            </span>
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => media.audioInputRef.current?.click()}
                            className="flex items-center gap-2 rounded-xl bg-[var(--emerald)] px-3.5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--emerald-light)]"
                          >
                            <Upload className="h-4 w-4" />
                            <span>
                              {media.audioSrc
                                ? "Replace Override"
                                : "Override Audio"}
                            </span>
                          </button>

                          {media.audioSrc && (
                            <button
                              type="button"
                              onClick={media.clearAudio}
                              className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5 text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--border-light)] hover:text-[var(--text)]"
                            >
                              <X className="h-4 w-4" />
                              <span>Clear Override</span>
                            </button>
                          )}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                          {media.audioError && (
                            <span className="rounded-full bg-[var(--accent)]/12 px-2.5 py-1 text-[var(--accent)]">
                              {media.audioError}
                            </span>
                          )}
                          {usingClipAudio && !media.audioError && (
                            <span className="rounded-full bg-[var(--emerald)]/12 px-2.5 py-1 text-[var(--emerald-light)]">
                              Using clip audio automatically
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="studio-panel-soft p-4">
                        <p className="section-kicker">Format</p>
                        <div className="mt-4 grid grid-cols-3 gap-2">
                          {ASPECT_RATIO_OPTIONS.map(
                            ({ id, label, hint, icon: Icon }) => {
                              const isActive = subtitlesState.aspectRatio === id;
                              return (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => subtitlesState.setAspectRatio(id)}
                                  className={[
                                    "flex items-center gap-2 rounded-xl border px-3 py-3 text-left transition-colors",
                                    isActive
                                      ? "border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--gold)]"
                                      : "border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text-muted)] hover:border-[var(--border-light)] hover:text-[var(--text)]",
                                  ].join(" ")}
                                >
                                  <Icon className="h-4 w-4 shrink-0" />
                                  <span className="min-w-0">
                                    <span className="font-mono-ui block text-xs font-semibold uppercase tracking-wider">
                                      {label}
                                    </span>
                                    <span className="block text-[11px] opacity-70">
                                      {hint}
                                    </span>
                                  </span>
                                </button>
                              );
                            }
                          )}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="studio-panel p-4">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h2 className="text-base font-semibold text-[var(--text)]">
                          Preview
                        </h2>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="metric-pill">
                          {activeRatioOption.label} · {activeRatioOption.hint}
                        </span>
                        <span className="metric-pill">
                          {playing ? "Playing" : "Paused"}
                        </span>
                        {previewSubtitle && (
                          <span className="metric-pill">
                            {previewSubtitle.label ?? `Ayah ${previewSubtitle.ayahNum}`}
                          </span>
                        )}
                      </div>
                    </div>

                    <VideoPreview
                      subtitles={subtitlesState.subtitles}
                      currentTime={currentTime}
                      subtitleStyleId={subtitlesState.subtitleStyle}
                      subtitleFormatting={subtitlesState.subtitleFormatting}
                      subtitlePlacement={subtitlesState.subtitlePlacement}
                      playbackMode={playbackMode}
                      aspectRatio={subtitlesState.aspectRatio}
                      videoSrc={media.videoSrc}
                      videoName={media.videoName}
                      videoError={media.videoError}
                      playing={playing}
                      onPlayPause={togglePlayPause}
                      onTimeChange={setCurrentTime}
                      onDurationChange={media.setVideoDuration}
                      onPlayingChange={setPlaying}
                      onVideoError={media.setVideoError}
                      onSubtitlePlacementChange={subtitlesState.setSubtitlePlacement}
                      previewSubtitle={previewSubtitle}
                    />
                  </section>

                  <AudioWaveform
                    audioSrc={activeAudioSrc}
                    audioName={activeAudioName}
                    audioDuration={media.audioDuration}
                    usingClipAudio={usingClipAudio}
                    hasOverride={Boolean(media.audioSrc)}
                    currentTime={currentTime}
                    playing={playing}
                    onTimeChange={setCurrentTime}
                    onDurationChange={media.setAudioDuration}
                    onPlayingChange={setPlaying}
                    onAudioError={media.setAudioError}
                  />

                  <section className="studio-panel-soft p-4">
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="text-base font-semibold text-[var(--text)]">
                          Timeline
                        </h3>
                      </div>
                      <p className="max-w-xs text-right text-xs text-[var(--text-dim)]">
                        Drag edges or snap to playhead.
                      </p>
                    </div>

                    <TimelineTrack
                      subtitles={subtitlesState.subtitles}
                      currentTime={currentTime}
                      totalDuration={totalDuration}
                      selectedIdx={subtitlesState.selectedSubIdx}
                      onSelect={(idx) => {
                        subtitlesState.setSelectedSubIdx(idx);
                        setCurrentTime(subtitlesState.subtitles[idx].start);
                      }}
                      onSeek={setCurrentTime}
                      onResizeSubtitle={handleSubtitleBoundaryChange}
                    />
                  </section>
                </div>

                <div className="min-h-0 space-y-4">
                  <section className="studio-panel p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-base font-semibold text-[var(--text)]">
                          Ayah Detection
                        </h2>
                        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                          {detectionSourceLabel
                            ? `Ayah detection runs automatically on ${detectionSourceLabel}.`
                            : "Upload a reciter clip first and Ayah Studio will detect the ayah range from its audio track automatically."}
                        </p>
                        <p className="mt-2 text-xs text-[var(--text-dim)]">
                          Upload limit: {MAX_AYAH_DETECT_UPLOAD_MB} MB.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleDetectAyahs}
                        disabled={!detectionSourceFile || detection.detectingAyahs}
                        className={[
                          "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
                          detectionSourceFile && !detection.detectingAyahs
                            ? "bg-[var(--gold)] text-[var(--bg)] hover:bg-[var(--gold-light)]"
                            : "cursor-not-allowed bg-[var(--border)] text-[var(--text-dim)]",
                        ].join(" ")}
                      >
                        <Sparkles className="h-4 w-4" />
                        <span>
                          {detection.detectingAyahs
                            ? "Detecting..."
                            : "Re-run Detection"}
                        </span>
                      </button>
                    </div>

                    {detection.detectingAyahs && (
                      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--gold-dim)] border-t-[var(--gold)]" />
                        <p className="text-sm text-[var(--text-muted)]">
                          Extracting clip audio, transcribing the recitation, and
                          matching the ayah range...
                        </p>
                      </div>
                    )}

                    {detection.detectionError && (
                      <div className="mt-4 rounded-2xl border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-3 text-sm text-[var(--accent)]">
                        {detection.detectionError}
                      </div>
                    )}

                    {appliedDetection && (
                      <div className="mt-4 rounded-2xl border border-[var(--emerald)]/35 bg-[var(--emerald)]/10 px-4 py-3">
                        <p className="text-sm font-semibold text-[var(--emerald-light)]">
                          {detection.appliedDetectionMode === "auto"
                            ? "Auto-detected and applied"
                            : "Detected and applied"}
                          : {appliedDetection.surahName}{" "}
                          {appliedDetection.startAyah}
                          {appliedDetection.endAyah !== appliedDetection.startAyah
                            ? `-${appliedDetection.endAyah}`
                            : ""}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--text-dim)]">
                          {detection.appliedDetectionMode === "auto"
                            ? "Ayah Studio picked the top match automatically because the confidence was clearly stronger than the alternatives."
                            : "You selected this detected range and Ayah Studio generated timed subtitles from it."}
                        </p>
                      </div>
                    )}

                    {detection.detectionResult && (
                      <div className="mt-4 space-y-4">
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="section-kicker">Transcript</p>
                            {bestDetection && (
                              <span className="rounded-full bg-[var(--gold)]/12 px-2.5 py-1 text-[11px] text-[var(--gold-light)]">
                                {Math.round(bestDetection.score * 100)}% match
                              </span>
                            )}
                          </div>
                          <p
                            dir="rtl"
                            className="mt-3 font-arabic-ui text-lg leading-loose text-[var(--text)]"
                          >
                            {detection.detectionResult.transcript}
                          </p>
                          {detection.detectionResult.warning && (
                            <p className="mt-3 text-xs leading-relaxed text-[var(--text-dim)]">
                              {detection.detectionResult.warning}
                            </p>
                          )}
                        </div>

                        <div>
                          <p className="section-kicker">Suggested Ranges</p>
                          <div className="mt-3 space-y-2">
                            {detection.detectionResult.matches.length === 0 ? (
                              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3 text-sm text-[var(--text-muted)]">
                                No confident ayah match yet. Try a cleaner clip
                                or upload a dedicated recitation audio track.
                              </div>
                            ) : (
                              detection.detectionResult.matches.map((match) => {
                                const matchKey = getDetectionKey(match);
                                const isApplied =
                                  detection.appliedDetectionKey === matchKey;

                                return (
                                  <div
                                    key={matchKey}
                                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="text-sm font-semibold text-[var(--text)]">
                                          {match.surahName}
                                        </p>
                                        <p className="font-arabic-ui mt-0.5 text-base text-[var(--gold)]">
                                          {match.surahArabicName}
                                        </p>
                                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                                          Ayah {match.startAyah}
                                          {match.endAyah !== match.startAyah
                                            ? `-${match.endAyah}`
                                            : ""}{" "}
                                          · {Math.round(match.score * 100)}%
                                        </p>
                                        {match.timingSource && (
                                          <p className="mt-1 text-[11px] text-[var(--emerald-light)]">
                                            {getTimingSourceLabel(match.timingSource)}
                                          </p>
                                        )}
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          void applyDetectedMatch(match);
                                        }}
                                        className={[
                                          "shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
                                          isApplied
                                            ? "bg-[var(--gold)] text-[var(--bg)]"
                                            : "bg-[var(--emerald)] text-white hover:bg-[var(--emerald-light)]",
                                        ].join(" ")}
                                      >
                                        {isApplied
                                          ? "Applied + Timed"
                                          : "Apply + Auto-time"}
                                      </button>
                                    </div>

                                    <p
                                      dir="rtl"
                                      className="mt-3 line-clamp-3 font-arabic-ui text-sm leading-loose text-[var(--text-muted)]"
                                    >
                                      {match.matchedText}
                                    </p>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </section>

                  {subtitlesState.selectedSubIdx !== null &&
                  subtitlesState.subtitles[subtitlesState.selectedSubIdx] ? (
                    <SubtitleEditor
                      subtitle={
                        subtitlesState.subtitles[subtitlesState.selectedSubIdx]
                      }
                      currentTime={currentTime}
                      onChange={subtitlesState.handleSubtitleChange}
                      onDelete={subtitlesState.handleSubtitleDelete}
                      onSetStartToPlayhead={() =>
                        handleSetSelectedBoundaryToPlayhead("start")
                      }
                      onSetEndToPlayhead={() =>
                        handleSetSelectedBoundaryToPlayhead("end")
                      }
                    />
                  ) : (
                    <section className="studio-panel-soft px-5 py-6">
                      <h3 className="text-base font-semibold text-[var(--text)]">
                        Inspector
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                        {subtitlesState.subtitles.length > 0
                          ? "Select a subtitle on the timeline or sidebar to edit timing and text."
                          : "Generate subtitles first, then use the inspector for timing and wording cleanup."}
                      </p>
                    </section>
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* ============================================================ */}
      {/* EXPORT MODAL                                                  */}
      {/* ============================================================ */}
      {subtitlesState.showExport && (
        <ExportPanel
          subtitles={subtitlesState.subtitles}
          subtitleStyleId={subtitlesState.subtitleStyle}
          subtitleFormatting={subtitlesState.subtitleFormatting}
          subtitlePlacement={subtitlesState.subtitlePlacement}
          aspectRatio={subtitlesState.aspectRatio}
          onClose={() => subtitlesState.setShowExport(false)}
        />
      )}
    </div>
  );
}

function getDetectionKey(match: AyahDetectionMatch): string {
  return `${match.surahNumber}:${match.startAyah}:${match.endAyah}`;
}

function shouldAutoApplyDetection(
  bestMatch: AyahDetectionMatch,
  nextBestMatch: AyahDetectionMatch | null
) {
  if (bestMatch.score < 0.72) {
    return false;
  }

  if (!nextBestMatch) {
    return true;
  }

  return bestMatch.score - nextBestMatch.score >= 0.08;
}

async function buildLeadingSubtitles(
  match: AyahDetectionMatch,
  translationEdition: string,
  fallbackDuration: number,
  formatting: Parameters<typeof buildSubtitlesFromAyahRange>[2]["formatting"]
) {
  const segments = match.leadingSegments ?? [];
  if (segments.length === 0) {
    return undefined;
  }

  const subtitles = [];

  for (const segment of segments) {
    if (segment.kind === "basmala") {
      subtitles.push({
        ayahNum: 0,
        label: "Basmala",
        arabic: segment.arabic ?? "",
        translation: await fetchBasmalaTranslation(translationEdition).catch(() => ""),
        start: segment.start,
        end: segment.end,
      });
      continue;
    }

    if (segment.kind === "istiadha") {
      subtitles.push({
        ayahNum: 0,
        label: "A'udhu Billah",
        arabic: segment.arabic ?? "",
        translation: "",
        start: segment.start,
        end: segment.end,
      });
      continue;
    }

    if (segment.kind === "ameen") {
      subtitles.push({
        ayahNum: 0,
        label: "Ameen",
        arabic: segment.arabic ?? "",
        translation: "",
        start: segment.start,
        end: segment.end,
      });
      continue;
    }

    if (segment.kind === "fatiha") {
      const fatihaContent = await fetchSurahWithTranslation(1, translationEdition);
      subtitles.push(
        ...buildSubtitlesFromAyahRange(
          fatihaContent.ayahs,
          fatihaContent.translations,
          {
            surahLabel: "Al-Faatiha",
            detectedTimings: segment.timings,
            clipDuration: Math.max(segment.end - segment.start, 0.1),
            timeOffset: segment.timings?.length ? 0 : segment.start,
            fallbackDuration,
            formatting,
          }
        )
      );
    }
  }

  return subtitles.length > 0 ? subtitles : undefined;
}

function getTimingSourceLabel(source: NonNullable<AyahDetectionMatch["timingSource"]>) {
  switch (source) {
    case "chunks":
      return "Aligned from transcript chunk timestamps";
    case "silence":
      return "Audio-aligned from detected pauses";
    case "hybrid":
      return "Audio-aligned with silence + fallback";
    default:
      return "Duration-matched fallback timing";
  }
}
