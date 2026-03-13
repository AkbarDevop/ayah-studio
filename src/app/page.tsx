"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ChangeEvent,
} from "react";
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
  Ayah,
  TranslationAyah,
  Subtitle,
  AyahDetectionMatch,
  AyahDetectionResult,
  AyahTimingSegment,
  SubtitlePlacement,
  SidebarTab,
  AspectRatioPreset,
  PlaybackMode,
} from "@/types";
import { SUBTITLE_STYLES, RECITERS } from "@/lib/constants";
import { fetchAllSurahs, fetchSurahWithTranslation } from "@/lib/quran-api";
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
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [translations, setTranslations] = useState<TranslationAyah[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translationEdition, setTranslationEdition] = useState("en.asad");
  const [selectedAyahIndices, setSelectedAyahIndices] = useState<Set<number>>(
    new Set()
  );
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [subtitleStyle, setSubtitleStyle] = useState("classic");
  const [selectedSubIdx, setSelectedSubIdx] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [defaultDuration, setDefaultDuration] = useState(8);
  const [tab, setTab] = useState<SidebarTab>("browse");
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoName, setVideoName] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [detectingAyahs, setDetectingAyahs] = useState(false);
  const [detectionError, setDetectionError] = useState<string | null>(null);
  const [detectionResult, setDetectionResult] =
    useState<AyahDetectionResult | null>(null);
  const [appliedDetectionKey, setAppliedDetectionKey] = useState<string | null>(
    null
  );
  const [aspectRatio, setAspectRatio] =
    useState<AspectRatioPreset>("landscape");
  const [subtitlePlacement, setSubtitlePlacement] = useState<SubtitlePlacement>(
    { x: 0.5, y: 0.78 }
  );

  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);

  /* ------------------------------------------------------------------ */
  /* Derived                                                             */
  /* ------------------------------------------------------------------ */
  const subtitleDuration =
    subtitles.length > 0 ? Math.max(...subtitles.map((s) => s.end)) + 2 : 0;
  const activeAudioSrc = audioSrc ?? videoSrc;
  const activeAudioName = audioSrc ? audioName : videoName;
  const usingClipAudio = Boolean(videoSrc) && !audioSrc;
  const detectionSourceFile = audioFile ?? videoFile;
  const detectionSourceLabel = audioFile
    ? audioName ?? audioFile.name
    : videoFile
      ? videoName ?? videoFile.name
      : null;
  const bestDetection = detectionResult?.matches[0] ?? null;
  const detectedMediaDuration = Math.max(audioDuration, videoDuration);
  const playbackMode: PlaybackMode =
    activeAudioSrc && !audioError
      ? "audio"
      : videoSrc
        ? "video"
        : "simulation";
  const totalDuration =
    audioDuration > 0 || videoDuration > 0
      ? Math.max(audioDuration, videoDuration, subtitleDuration)
      : subtitleDuration > 0
        ? subtitleDuration
        : 60;
  const previewSubtitle =
    selectedSubIdx !== null ? subtitles[selectedSubIdx] ?? null : subtitles[0] ?? null;

  useEffect(() => {
    return () => {
      if (videoSrc?.startsWith("blob:")) {
        URL.revokeObjectURL(videoSrc);
      }
    };
  }, [videoSrc]);

  useEffect(() => {
    return () => {
      if (audioSrc?.startsWith("blob:")) {
        URL.revokeObjectURL(audioSrc);
      }
    };
  }, [audioSrc]);

  /* ------------------------------------------------------------------ */
  /* Data fetching                                                       */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    fetchAllSurahs()
      .then(setSurahs)
      .catch((err) => setError(err.message));
  }, []);

  const fetchSurahContent = useCallback(
    (surah: Surah) =>
      fetchSurahWithTranslation(surah.number, translationEdition),
    [translationEdition]
  );

  const loadSurah = useCallback(
    async (surah: Surah) => {
      setLoading(true);
      setError(null);
      try {
        const { ayahs: a, translations: t } = await fetchSurahContent(surah);
        setAyahs(a);
        setTranslations(t);
        setSelectedSurah(surah);
        setSelectedAyahIndices(new Set());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load surah");
      } finally {
        setLoading(false);
      }
    },
    [fetchSurahContent]
  );

  /* Refetch translation when edition changes */
  useEffect(() => {
    if (!selectedSurah) return;
    let cancelled = false;
    setLoading(true);
    fetchSurahContent(selectedSurah)
      .then(({ ayahs: a, translations: t }) => {
        if (cancelled) return;
        setAyahs(a);
        setTranslations(t);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchSurahContent, selectedSurah]);

  /* ------------------------------------------------------------------ */
  /* Subtitle generation                                                 */
  /* ------------------------------------------------------------------ */
  function generateSubtitles() {
    const sorted = Array.from(selectedAyahIndices).sort((a, b) => a - b);
    const newSubs = buildSubtitlesFromAyahRange(
      sorted.map((idx) => ayahs[idx]).filter(Boolean),
      translations,
      {
        fallbackDuration: defaultDuration,
      }
    );
    setSubtitles(newSubs);
    setSelectedSubIdx(null);
    setCurrentTime(0);
    setPlaying(false);
    setTab("subtitles");
  }

  /* ------------------------------------------------------------------ */
  /* Playback simulation                                                 */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (playbackMode !== "simulation") {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
      return;
    }

    if (playing) {
      playIntervalRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + 0.1;
          if (next >= totalDuration) {
            setPlaying(false);
            return 0;
          }
          return next;
        });
      }, 100);
    } else if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [playbackMode, playing, totalDuration]);

  function togglePlayPause() {
    if (!activeAudioSrc && !videoSrc && subtitles.length === 0) return;
    setPlaying((prev) => !prev);
  }

  function handleVideoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setVideoError("Please choose a valid video file.");
      event.target.value = "";
      return;
    }

    setVideoError(null);
    setDetectionError(null);
    setDetectionResult(null);
    setAppliedDetectionKey(null);
    setPlaying(false);
    setCurrentTime(0);
    setVideoDuration(0);
    if (!audioSrc) {
      setAudioDuration(0);
      setAudioError(null);
    }
    setVideoFile(file);
    setVideoName(file.name);
    setVideoSrc(URL.createObjectURL(file));
    event.target.value = "";
  }

  function handleAudioUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const isAudioFile =
      file.type.startsWith("audio/") ||
      file.type.startsWith("video/") ||
      /\.(mp3|wav|m4a|aac|ogg|webm)$/i.test(file.name);

    if (!isAudioFile) {
      setAudioError("Please choose a valid audio file.");
      event.target.value = "";
      return;
    }

    setAudioError(null);
    setDetectionError(null);
    setDetectionResult(null);
    setAppliedDetectionKey(null);
    setPlaying(false);
    setCurrentTime(0);
    setAudioDuration(0);
    setAudioFile(file);
    setAudioName(file.name);
    setAudioSrc(URL.createObjectURL(file));
    event.target.value = "";
  }

  function clearVideo() {
    setPlaying(false);
    setCurrentTime(0);
    setVideoDuration(0);
    setDetectionError(null);
    setDetectionResult(null);
    setAppliedDetectionKey(null);
    if (!audioSrc) {
      setAudioDuration(0);
      setAudioError(null);
    }
    setVideoFile(null);
    setVideoName(null);
    setVideoSrc(null);
    setVideoError(null);
  }

  function clearAudio() {
    setPlaying(false);
    setCurrentTime(0);
    setAudioDuration(0);
    setDetectionError(null);
    setDetectionResult(null);
    setAppliedDetectionKey(null);
    setAudioFile(null);
    setAudioName(null);
    setAudioSrc(null);
    setAudioError(null);
  }

  async function handleDetectAyahs() {
    if (!detectionSourceFile) {
      setDetectionError("Upload a clip or override audio before detecting ayahs.");
      return;
    }

    const formData = new FormData();
    formData.append("media", detectionSourceFile);

    setDetectingAyahs(true);
    setDetectionError(null);
    setAppliedDetectionKey(null);

    try {
      const response = await fetch("/api/ayah-detect", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as
        | AyahDetectionResult
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : "Ayah detection failed."
        );
      }

      setDetectionResult(payload as AyahDetectionResult);
    } catch (err) {
      setDetectionResult(null);
      setDetectionError(
        err instanceof Error ? err.message : "Ayah detection failed."
      );
    } finally {
      setDetectingAyahs(false);
    }
  }

  async function applyDetectedMatch(match: AyahDetectionMatch) {
    try {
      setDetectionError(null);

      let targetSurah: Surah | undefined = surahs.find(
        (surah) => surah.number === match.surahNumber
      );
      if (!targetSurah) {
        const allSurahs = await fetchAllSurahs();
        setSurahs(allSurahs);
        targetSurah = allSurahs.find(
          (surah) => surah.number === match.surahNumber
        );
      }

      if (!targetSurah) {
        throw new Error("The detected surah could not be loaded.");
      }

      const existingSurahIsLoaded = selectedSurah?.number === targetSurah.number;
      const content = existingSurahIsLoaded
        ? { ayahs, translations }
        : await fetchSurahContent(targetSurah);
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

      setAyahs(content.ayahs);
      setTranslations(content.translations);
      setSelectedSurah(targetSurah);
      setSelectedAyahIndices(rangeIndices);
      setSubtitles(
        buildSubtitlesFromAyahRange(rangeAyahs, content.translations, {
          detectedTimings: match.timings,
          clipDuration: detectedMediaDuration > 0 ? detectedMediaDuration : undefined,
          fallbackDuration: defaultDuration,
        })
      );
      setSelectedSubIdx(null);
      setCurrentTime(0);
      setPlaying(false);
      setTab("subtitles");
      setAppliedDetectionKey(getDetectionKey(match));
    } catch (err) {
      setDetectionError(
        err instanceof Error ? err.message : "Failed to apply the detected ayahs."
      );
    }
  }

  /* ------------------------------------------------------------------ */
  /* Subtitle editing helpers                                            */
  /* ------------------------------------------------------------------ */
  function handleSubtitleChange(updated: Subtitle) {
    if (selectedSubIdx === null) return;
    setSubtitles((prev) =>
      prev.map((s, i) => (i === selectedSubIdx ? updated : s))
    );
  }

  function handleSubtitleDelete() {
    if (selectedSubIdx === null) return;
    setSubtitles((prev) => prev.filter((_, i) => i !== selectedSubIdx));
    setSelectedSubIdx(null);
  }

  /* ------------------------------------------------------------------ */
  /* Ayah selection helpers                                              */
  /* ------------------------------------------------------------------ */
  function toggleAyahIndex(index: number) {
    setSelectedAyahIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function selectAllAyahs() {
    setSelectedAyahIndices(new Set(ayahs.map((_, i) => i)));
  }

  function deselectAllAyahs() {
    setSelectedAyahIndices(new Set());
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
        {subtitles.length > 0 && (
          <button
            type="button"
            onClick={() => setShowExport(true)}
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
                onClick={() => setTab(id)}
                className={[
                  "flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-medium uppercase tracking-wider transition-colors font-[family-name:var(--font-ibm-plex)]",
                  tab === id
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
            {tab === "browse" && (
              <>
                {loading && (
                  <div className="flex items-center justify-center py-16">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--gold-dim)] border-t-[var(--gold)]" />
                  </div>
                )}

                {error && (
                  <div className="mx-4 mt-4 rounded-lg border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-3 text-sm text-[var(--accent)]">
                    {error}
                  </div>
                )}

                {!loading && !selectedSurah && (
                  <SurahBrowser
                    surahs={surahs}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    onSelect={loadSurah}
                    translationEdition={translationEdition}
                    onTranslationChange={setTranslationEdition}
                  />
                )}

                {!loading && selectedSurah && (
                  <AyahSelector
                    surahName={selectedSurah.name}
                    ayahs={ayahs}
                    translations={translations}
                    selectedIndices={selectedAyahIndices}
                    onToggle={toggleAyahIndex}
                    onSelectAll={selectAllAyahs}
                    onDeselectAll={deselectAllAyahs}
                    onBack={() => {
                      setSelectedSurah(null);
                      setAyahs([]);
                      setTranslations([]);
                      setSelectedAyahIndices(new Set());
                    }}
                    onGenerate={generateSubtitles}
                    defaultDuration={defaultDuration}
                    onDurationChange={setDefaultDuration}
                  />
                )}
              </>
            )}

            {/* ------ Subtitles Tab ------ */}
            {tab === "subtitles" && (
              <div className="p-4">
                {subtitles.length === 0 ? (
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
                      {subtitles.length} subtitle
                      {subtitles.length !== 1 ? "s" : ""}
                    </p>
                    {subtitles.map((sub, idx) => (
                      <button
                        key={`sub-${sub.ayahNum}-${idx}`}
                        type="button"
                        onClick={() => {
                          setSelectedSubIdx(idx);
                          setCurrentTime(sub.start);
                        }}
                        className={[
                          "w-full rounded-lg border p-3 text-left transition-all",
                          selectedSubIdx === idx
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
            {tab === "style" && (
              <div className="p-4">
                <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)] font-[family-name:var(--font-ibm-plex)]">
                  Subtitle Style
                </p>

                <div className="space-y-3">
                  {SUBTITLE_STYLES.map((style) => {
                    const isActive = subtitleStyle === style.id;
                    return (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => setSubtitleStyle(style.id)}
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
                      X {Math.round(subtitlePlacement.x * 100)}% · Y{" "}
                      {Math.round(subtitlePlacement.y * 100)}%
                    </span>
                  </div>
                  <p className="mb-3 text-xs leading-relaxed text-[var(--text-muted)]">
                    Drag the live subtitle in the preview to fine-tune, or jump
                    to a preset below.
                  </p>
                  <div className="space-y-2">
                    {SUBTITLE_POSITION_PRESETS.map((preset) => {
                      const isActive =
                        Math.abs(subtitlePlacement.x - preset.placement.x) <
                          0.01 &&
                        Math.abs(subtitlePlacement.y - preset.placement.y) <
                          0.01;

                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setSubtitlePlacement(preset.placement)}
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
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleVideoUpload}
            />
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.ogg,.webm"
              className="hidden"
              onChange={handleAudioUpload}
            />

            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-[240px] flex-1">
                <p className="font-mono-ui text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
                  Video Source
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    className="flex items-center gap-2 rounded-lg bg-[var(--gold)] px-3.5 py-2 text-sm font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--gold-light)]"
                  >
                    <Upload className="h-4 w-4" />
                    <span>{videoSrc ? "Replace Clip" : "Upload Clip"}</span>
                  </button>

                  {videoSrc && (
                    <button
                      type="button"
                      onClick={clearVideo}
                      className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--border-light)] hover:text-[var(--text)]"
                    >
                      <X className="h-4 w-4" />
                      <span>Clear</span>
                    </button>
                  )}

                  <span className="text-sm text-[var(--text-muted)]">
                    {videoName ?? "No clip loaded yet. Preview uses the design canvas."}
                  </span>
                </div>

                {(videoDuration > 0 || videoError) && (
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                    {videoDuration > 0 && (
                      <span className="font-mono-ui text-[var(--text-dim)]">
                        Duration {videoDuration.toFixed(1)}s
                      </span>
                    )}
                    {videoError && (
                      <span className="rounded-full bg-[var(--accent)]/12 px-2.5 py-1 text-[var(--accent)]">
                        {videoError}
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
                    onClick={() => audioInputRef.current?.click()}
                    className="flex items-center gap-2 rounded-lg bg-[var(--emerald)] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--emerald-light)]"
                  >
                    <Upload className="h-4 w-4" />
                    <span>{audioSrc ? "Replace Override" : "Override Audio"}</span>
                  </button>

                  {audioSrc && (
                    <button
                      type="button"
                      onClick={clearAudio}
                      className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--border-light)] hover:text-[var(--text)]"
                    >
                      <X className="h-4 w-4" />
                      <span>Clear Override</span>
                    </button>
                  )}

                  <span className="text-sm text-[var(--text-muted)]">
                    {audioSrc
                      ? `Override track: ${audioName}`
                      : videoName
                        ? `Using clip audio from ${videoName}`
                        : "Clip audio is used automatically. Override is optional."}
                  </span>
                </div>

                {(audioDuration > 0 || audioError) && (
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                    {audioDuration > 0 && (
                      <span className="font-mono-ui text-[var(--text-dim)]">
                        Duration {audioDuration.toFixed(1)}s
                      </span>
                    )}
                    {audioError && (
                      <span className="rounded-full bg-[var(--accent)]/12 px-2.5 py-1 text-[var(--accent)]">
                        {audioError}
                      </span>
                    )}
                    {usingClipAudio && !audioError && (
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
                    const isActive = aspectRatio === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setAspectRatio(id)}
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
                </div>

                <button
                  type="button"
                  onClick={handleDetectAyahs}
                  disabled={!detectionSourceFile || detectingAyahs}
                  className={[
                    "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors",
                    detectionSourceFile && !detectingAyahs
                      ? "bg-[var(--gold)] text-[var(--bg)] hover:bg-[var(--gold-light)]"
                      : "cursor-not-allowed bg-[var(--border)] text-[var(--text-dim)]",
                  ].join(" ")}
                >
                  <Sparkles className="h-4 w-4" />
                  <span>{detectingAyahs ? "Detecting..." : "Detect Ayah Range"}</span>
                </button>
              </div>

              {detectingAyahs && (
                <div className="mt-4 flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--gold-dim)] border-t-[var(--gold)]" />
                  <p className="text-sm text-[var(--text-muted)]">
                    Extracting clip audio, transcribing the recitation, and matching the ayah range...
                  </p>
                </div>
              )}

              {detectionError && (
                <div className="mt-4 rounded-lg border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-3 text-sm text-[var(--accent)]">
                  {detectionError}
                </div>
              )}

              {detectionResult && (
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
                      {detectionResult.transcript}
                    </p>
                    {detectionResult.warning && (
                      <p className="mt-3 text-xs leading-relaxed text-[var(--text-dim)]">
                        {detectionResult.warning}
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="font-mono-ui text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-dim)]">
                      Suggested Ranges
                    </p>
                    <div className="mt-3 space-y-2">
                      {detectionResult.matches.length === 0 ? (
                        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3 text-sm text-[var(--text-muted)]">
                          No confident ayah match yet. Try a cleaner clip or upload a dedicated recitation audio track.
                        </div>
                      ) : (
                        detectionResult.matches.map((match) => {
                          const matchKey = getDetectionKey(match);
                          const isApplied = appliedDetectionKey === matchKey;

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
              subtitles={subtitles}
              currentTime={currentTime}
              subtitleStyleId={subtitleStyle}
              subtitlePlacement={subtitlePlacement}
              playbackMode={playbackMode}
              aspectRatio={aspectRatio}
              videoSrc={videoSrc}
              videoName={videoName}
              videoError={videoError}
              playing={playing}
              onPlayPause={togglePlayPause}
              onTimeChange={setCurrentTime}
              onDurationChange={setVideoDuration}
              onPlayingChange={setPlaying}
              onVideoError={setVideoError}
              onSubtitlePlacementChange={setSubtitlePlacement}
              previewSubtitle={previewSubtitle}
            />
          </div>

          <div className="px-4 py-2">
            <AudioWaveform
              audioSrc={activeAudioSrc}
              audioName={activeAudioName}
              audioDuration={audioDuration}
              usingClipAudio={usingClipAudio}
              hasOverride={Boolean(audioSrc)}
              currentTime={currentTime}
              playing={playing}
              onTimeChange={setCurrentTime}
              onDurationChange={setAudioDuration}
              onPlayingChange={setPlaying}
              onAudioError={setAudioError}
            />
          </div>

          {/* Timeline */}
          <div className="px-4 py-2">
            <TimelineTrack
              subtitles={subtitles}
              currentTime={currentTime}
              totalDuration={totalDuration}
              selectedIdx={selectedSubIdx}
              onSelect={(idx) => {
                setSelectedSubIdx(idx);
                setCurrentTime(subtitles[idx].start);
              }}
              onSeek={setCurrentTime}
            />
          </div>

          {/* Subtitle Editor or Empty State */}
          <div className="flex-1 overflow-y-auto px-4 py-2">
            {selectedSubIdx !== null && subtitles[selectedSubIdx] ? (
              <SubtitleEditor
                subtitle={subtitles[selectedSubIdx]}
                onChange={handleSubtitleChange}
                onDelete={handleSubtitleDelete}
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-[var(--text-dim)] font-[family-name:var(--font-ibm-plex)]">
                  {subtitles.length > 0
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
      {showExport && (
        <ExportPanel
          subtitles={subtitles}
          subtitleStyleId={subtitleStyle}
          subtitlePlacement={subtitlePlacement}
          aspectRatio={aspectRatio}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}

function getDetectionKey(match: AyahDetectionMatch): string {
  return `${match.surahNumber}:${match.startAyah}:${match.endAyah}`;
}

function buildSubtitlesFromAyahRange(
  ayahRange: Ayah[],
  translations: TranslationAyah[],
  options: {
    detectedTimings?: AyahTimingSegment[];
    clipDuration?: number;
    fallbackDuration: number;
  }
): Subtitle[] {
  if (ayahRange.length === 0) {
    return [];
  }

  if (options.detectedTimings?.length === ayahRange.length) {
    const timingByAyah = new Map(
      options.detectedTimings.map((timing) => [timing.ayahNum, timing])
    );

    return ayahRange.map((ayah, index) => {
      const translation = translations.find(
        (item) => item.numberInSurah === ayah.numberInSurah
      );
      const timing = timingByAyah.get(ayah.numberInSurah);

      return {
        ayahNum: ayah.numberInSurah,
        arabic: ayah.text,
        translation: translation?.text ?? "",
        start: timing?.start ?? 0,
        end: timing?.end ?? options.fallbackDuration * (index + 1),
      };
    });
  }

  const clipDuration = options.clipDuration ?? 0;

  if (clipDuration > 0) {
    const weights = ayahRange.map((ayah) =>
      Math.max(countTimingUnits(ayah.text), 1)
    );
    const totalWeight = weights.reduce((sum, value) => sum + value, 0);
    let consumedWeight = 0;

    return ayahRange.map((ayah, index) => {
      const translation = translations.find(
        (item) => item.numberInSurah === ayah.numberInSurah
      );
      const start = (consumedWeight / totalWeight) * clipDuration;
      consumedWeight += weights[index];
      const end =
        index === ayahRange.length - 1
          ? clipDuration
          : (consumedWeight / totalWeight) * clipDuration;

      return {
        ayahNum: ayah.numberInSurah,
        arabic: ayah.text,
        translation: translation?.text ?? "",
        start,
        end,
      };
    });
  }

  let offset = 0;
  const gap = 0.5;

  return ayahRange.map((ayah) => {
    const translation = translations.find(
      (item) => item.numberInSurah === ayah.numberInSurah
    );
    const subtitle: Subtitle = {
      ayahNum: ayah.numberInSurah,
      arabic: ayah.text,
      translation: translation?.text ?? "",
      start: offset,
      end: offset + options.fallbackDuration,
    };

    offset += options.fallbackDuration + gap;
    return subtitle;
  });
}

function countTimingUnits(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
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
