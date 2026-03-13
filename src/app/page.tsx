"use client";

import {
  BookOpen,
  Layers,
  Star,
  Download,
  Upload,
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
import { SUBTITLE_STYLES, RECITERS } from "@/lib/constants";
import { fetchAllSurahs } from "@/lib/quran-api";
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
  const bestDetection = detection.detectionResult?.matches[0] ?? null;
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

  /* ------------------------------------------------------------------ */
  /* Subtitle generation                                                 */
  /* ------------------------------------------------------------------ */
  function generateSubtitles() {
    subtitlesState.generateSubtitles(
      quran.ayahs,
      quran.translations,
      quran.selectedAyahIndices
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

  async function applyDetectedMatch(match: AyahDetectionMatch) {
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
      subtitlesState.applyDetectedSubtitles(rangeAyahs, content.translations, {
          detectedTimings: match.timings,
          clipDuration: detectedMediaDuration > 0 ? detectedMediaDuration : undefined,
        });
      detection.setAppliedDetectionKey(getDetectionKey(match));
    } catch (err) {
      detection.setDetectionError(
        err instanceof Error ? err.message : "Failed to apply the detected ayahs."
      );
    }
  }

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
    <div className="flex flex-col min-h-screen">
      {/* ============================================================ */}
      {/* HEADER                                                        */}
      {/* ============================================================ */}
      <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3">
        <div className="flex items-center gap-3">
          {/* Logo */}
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

          {/* Title */}
          <div>
            <h1 className="text-[22px] font-semibold leading-tight text-[var(--gold)]">
              Ayah Studio
            </h1>
            <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--text-muted)] font-[family-name:var(--font-ibm-plex)]">
              Quran Video Editor
            </p>
          </div>
        </div>

        {/* Export Button */}
        {subtitlesState.subtitles.length > 0 && (
          <button
            type="button"
            onClick={() => subtitlesState.setShowExport(true)}
            className="flex items-center gap-2 rounded-lg bg-[var(--gold)] px-4 py-2 text-sm font-semibold text-[var(--bg)] shadow-lg shadow-[var(--gold)]/20 transition-all hover:bg-[var(--gold-light)] active:scale-[0.98]"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ============================================================ */}
        {/* SIDEBAR                                                      */}
        {/* ============================================================ */}
        <aside className="flex w-[340px] flex-col border-r border-[var(--border)] bg-[var(--surface)]">
          {/* Tab Buttons */}
          <div className="flex border-b border-[var(--border)]">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => subtitlesState.setTab(id)}
                className={[
                  "flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-medium uppercase tracking-wider transition-colors font-[family-name:var(--font-ibm-plex)]",
                  subtitlesState.tab === id
                    ? "border-b-2 border-[var(--gold)] bg-[var(--surface-alt)] text-[var(--gold)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]",
                ].join(" ")}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">
            {/* ------ Browse Tab ------ */}
            {subtitlesState.tab === "browse" && (
              <>
                {quran.loading && (
                  <div className="flex items-center justify-center py-16">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--gold-dim)] border-t-[var(--gold)]" />
                  </div>
                )}

                {quran.error && (
                  <div className="mx-4 mt-4 rounded-lg border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-3 text-sm text-[var(--accent)]">
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

            {/* ------ Subtitles Tab ------ */}
            {subtitlesState.tab === "subtitles" && (
              <div className="p-4">
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
                          "w-full rounded-lg border p-3 text-left transition-all",
                          subtitlesState.selectedSubIdx === idx
                            ? "border-[var(--gold-dim)] bg-[var(--surface-alt)]"
                            : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-light)]",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[var(--gold)] font-[family-name:var(--font-ibm-plex)]">
                            Ayah {sub.ayahNum}
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

            {/* ------ Style Tab ------ */}
            {subtitlesState.tab === "style" && (
              <div className="p-4">
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
                          "w-full rounded-lg border p-3 text-left transition-all",
                          isActive
                            ? "border-[var(--gold-dim)] bg-[var(--surface-alt)]"
                            : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-light)]",
                        ].join(" ")}
                      >
                        {/* Label + Active badge */}
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

                        {/* Preview */}
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

                {/* Reciter Reference */}
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
                      X {Math.round(subtitlesState.subtitlePlacement.x * 100)}% · Y{" "}
                      {Math.round(subtitlesState.subtitlePlacement.y * 100)}%
                    </span>
                  </div>
                  <p className="mb-3 text-xs leading-relaxed text-[var(--text-muted)]">
                    Drag the live subtitle in the preview to fine-tune, or jump
                    to a preset below.
                  </p>
                  <div className="space-y-2">
                    {SUBTITLE_POSITION_PRESETS.map((preset) => {
                      const isActive =
                        Math.abs(subtitlesState.subtitlePlacement.x - preset.placement.x) <
                          0.01 &&
                        Math.abs(subtitlesState.subtitlePlacement.y - preset.placement.y) <
                          0.01;

                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() =>
                            subtitlesState.setSubtitlePlacement(preset.placement)
                          }
                          className={[
                            "w-full rounded-lg border p-3 text-left transition-colors",
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

        {/* ============================================================ */}
        {/* WORKSPACE                                                    */}
        {/* ============================================================ */}
        <main className="flex flex-1 flex-col overflow-hidden bg-[var(--bg)]">
          <div className="border-b border-[var(--border)] bg-[var(--surface)]/70 px-4 py-3">
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

            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-[240px] flex-1">
                <p className="font-mono-ui text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
                  Video Source
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => media.videoInputRef.current?.click()}
                    className="flex items-center gap-2 rounded-lg bg-[var(--gold)] px-3.5 py-2 text-sm font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--gold-light)]"
                  >
                    <Upload className="h-4 w-4" />
                    <span>{media.videoSrc ? "Replace Clip" : "Upload Clip"}</span>
                  </button>

                  {media.videoSrc && (
                    <button
                      type="button"
                      onClick={media.clearVideo}
                      className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--border-light)] hover:text-[var(--text)]"
                    >
                      <X className="h-4 w-4" />
                      <span>Clear</span>
                    </button>
                  )}

                  <span className="text-sm text-[var(--text-muted)]">
                    {media.videoName ??
                      "No clip loaded yet. Preview uses the design canvas."}
                  </span>
                </div>

                {(media.videoDuration > 0 || media.videoError) && (
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                    {media.videoDuration > 0 && (
                      <span className="font-mono-ui text-[var(--text-dim)]">
                        Duration {media.videoDuration.toFixed(1)}s
                      </span>
                    )}
                    {media.videoError && (
                      <span className="rounded-full bg-[var(--accent)]/12 px-2.5 py-1 text-[var(--accent)]">
                        {media.videoError}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="min-w-[240px] flex-1">
                <p className="font-mono-ui text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
                  Audio Track
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => media.audioInputRef.current?.click()}
                    className="flex items-center gap-2 rounded-lg bg-[var(--emerald)] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--emerald-light)]"
                  >
                    <Upload className="h-4 w-4" />
                    <span>{media.audioSrc ? "Replace Override" : "Override Audio"}</span>
                  </button>

                  {media.audioSrc && (
                    <button
                      type="button"
                      onClick={media.clearAudio}
                      className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--border-light)] hover:text-[var(--text)]"
                    >
                      <X className="h-4 w-4" />
                      <span>Clear Override</span>
                    </button>
                  )}

                  <span className="text-sm text-[var(--text-muted)]">
                    {media.audioSrc
                      ? `Override track: ${media.audioName}`
                      : media.videoName
                        ? `Using clip audio from ${media.videoName}`
                        : "Clip audio is used automatically. Override is optional."}
                  </span>
                </div>

                {(media.audioDuration > 0 || media.audioError) && (
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                    {media.audioDuration > 0 && (
                      <span className="font-mono-ui text-[var(--text-dim)]">
                        Duration {media.audioDuration.toFixed(1)}s
                      </span>
                    )}
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
                )}
              </div>

              <div className="w-full max-w-[360px]">
                <p className="font-mono-ui text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
                  Canvas Ratio
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {ASPECT_RATIO_OPTIONS.map(({ id, label, hint, icon: Icon }) => {
                    const isActive = subtitlesState.aspectRatio === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => subtitlesState.setAspectRatio(id)}
                        className={[
                          "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors",
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
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="border-b border-[var(--border)] bg-[var(--surface)]/45 px-4 py-3">
            <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-mono-ui text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-dim)]">
                    Ayah Detection
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">
                    {detectionSourceLabel
                      ? `Run Quran-aware ayah detection on ${detectionSourceLabel}.`
                      : "Upload a reciter clip first, then detect the ayah range from its audio track."}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--text-dim)]">
                    Uses local ffmpeg extraction plus the Tarteel Whisper Quran model
                    through Hugging Face when a token is configured.
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--text-dim)]">
                    Applying a detected range now auto-generates subtitles across the
                    current clip duration instead of using the fixed seconds-per-ayah
                    guess.
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--text-dim)]">
                    Detection upload limit: {MAX_AYAH_DETECT_UPLOAD_MB} MB per
                    request.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDetectAyahs}
                  disabled={!detectionSourceFile || detection.detectingAyahs}
                  className={[
                    "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors",
                    detectionSourceFile && !detection.detectingAyahs
                      ? "bg-[var(--gold)] text-[var(--bg)] hover:bg-[var(--gold-light)]"
                      : "cursor-not-allowed bg-[var(--border)] text-[var(--text-dim)]",
                  ].join(" ")}
                >
                  <Sparkles className="h-4 w-4" />
                  <span>
                    {detection.detectingAyahs ? "Detecting..." : "Detect Ayah Range"}
                  </span>
                </button>
              </div>

              {detection.detectingAyahs && (
                <div className="mt-4 flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--gold-dim)] border-t-[var(--gold)]" />
                  <p className="text-sm text-[var(--text-muted)]">
                    Extracting clip audio, transcribing the recitation, and matching the ayah range...
                  </p>
                </div>
              )}

              {detection.detectionError && (
                <div className="mt-4 rounded-lg border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-3 text-sm text-[var(--accent)]">
                  {detection.detectionError}
                </div>
              )}

              {detection.detectionResult && (
                <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono-ui text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-dim)]">
                        Transcript
                      </p>
                      {bestDetection && (
                        <span className="rounded-full bg-[var(--gold)]/12 px-2.5 py-1 text-[11px] text-[var(--gold-light)]">
                          {Math.round(bestDetection.score * 100)}% match confidence
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
                    <p className="font-mono-ui text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-dim)]">
                      Suggested Ranges
                    </p>
                    <div className="mt-3 space-y-2">
                      {detection.detectionResult.matches.length === 0 ? (
                        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3 text-sm text-[var(--text-muted)]">
                          No confident ayah match yet. Try a cleaner clip or upload a dedicated recitation audio track.
                        </div>
                      ) : (
                        detection.detectionResult.matches.map((match) => {
                          const matchKey = getDetectionKey(match);
                          const isApplied =
                            detection.appliedDetectionKey === matchKey;

                          return (
                            <div
                              key={matchKey}
                              className="rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3"
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
                                    "shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
                                    isApplied
                                      ? "bg-[var(--gold)] text-[var(--bg)]"
                                      : "bg-[var(--emerald)] text-white hover:bg-[var(--emerald-light)]",
                                  ].join(" ")}
                                >
                                  {isApplied ? "Applied + Timed" : "Apply + Auto-time"}
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
          </div>

          {/* Video Preview */}
          <div className="p-4 pb-2">
            <VideoPreview
              subtitles={subtitlesState.subtitles}
              currentTime={currentTime}
              subtitleStyleId={subtitlesState.subtitleStyle}
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
          </div>

          <div className="px-4 py-2">
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
          </div>

          {/* Timeline */}
          <div className="px-4 py-2">
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
            />
          </div>

          {/* Subtitle Editor or Empty State */}
          <div className="flex-1 overflow-y-auto px-4 py-2">
            {subtitlesState.selectedSubIdx !== null &&
            subtitlesState.subtitles[subtitlesState.selectedSubIdx] ? (
              <SubtitleEditor
                subtitle={subtitlesState.subtitles[subtitlesState.selectedSubIdx]}
                onChange={subtitlesState.handleSubtitleChange}
                onDelete={subtitlesState.handleSubtitleDelete}
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-[var(--text-dim)] font-[family-name:var(--font-ibm-plex)]">
                  {subtitlesState.subtitles.length > 0
                    ? "Select a subtitle on the timeline or sidebar to edit"
                    : "Select ayahs from the sidebar to get started"}
                </p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ============================================================ */}
      {/* EXPORT MODAL                                                  */}
      {/* ============================================================ */}
      {subtitlesState.showExport && (
        <ExportPanel
          subtitles={subtitlesState.subtitles}
          subtitleStyleId={subtitlesState.subtitleStyle}
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

function getTimingSourceLabel(source: NonNullable<AyahDetectionMatch["timingSource"]>) {
  switch (source) {
    case "silence":
      return "Audio-aligned from detected pauses";
    case "hybrid":
      return "Audio-aligned with silence + fallback";
    default:
      return "Duration-matched fallback timing";
  }
}
