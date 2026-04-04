"use client";

import { useState } from "react";
import {
  X,
  ChevronDown,
  Upload,
  Link2,
  Sparkles,
  Monitor,
  Smartphone,
  Square,
} from "lucide-react";
import type {
  Subtitle,
  SubtitleFormatting,
  SubtitlePlacement,
  AyahDetectionMatch,
  AyahDetectionResult,
  AspectRatioPreset,
} from "@/types";
import type { AyahAudioEntry } from "@/lib/audio-api";
import {
  ARABIC_FONT_OPTIONS,
  TRANSLATION_FONT_OPTIONS,
  getStyleFormattingDefaults,
} from "@/lib/subtitle-formatting";
import { SUBTITLE_STYLES, RECITERS } from "@/lib/constants";
import { MAX_AYAH_DETECT_UPLOAD_MB } from "@/lib/ayah-detection-config";
import { MAX_YOUTUBE_IMPORT_MB } from "@/lib/youtube-import";
import ReciterPanel from "@/components/audio/reciter-panel";

const ASPECT_RATIO_OPTIONS: {
  id: AspectRatioPreset;
  label: string;
  hint: string;
  icon: typeof Monitor;
}[] = [
  { id: "landscape", label: "16:9", hint: "YouTube", icon: Monitor },
  { id: "portrait", label: "9:16", hint: "Reels", icon: Smartphone },
  { id: "square", label: "1:1", hint: "Feed", icon: Square },
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

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  // Style
  subtitleStyle: string;
  onSubtitleStyleChange: (id: string) => void;
  subtitleFormatting: SubtitleFormatting;
  onUpdateFormatting: (update: Partial<SubtitleFormatting>) => void;
  subtitlePlacement: SubtitlePlacement;
  onSubtitlePlacementChange: (placement: SubtitlePlacement) => void;
  resolvedColors: { arabicColor: string; translationColor: string };
  // Source
  videoName: string | null;
  videoDuration: number;
  videoSrc: string | null;
  audioName: string | null;
  audioSrc: string | null;
  audioDuration: number;
  usingClipAudio: boolean;
  videoInputRef: React.RefObject<HTMLInputElement | null>;
  audioInputRef: React.RefObject<HTMLInputElement | null>;
  youtubeUrl: string;
  onYoutubeUrlChange: (url: string) => void;
  onYouTubeImport: () => Promise<void>;
  youtubeImporting: boolean;
  onClearVideo: () => void;
  onClearAudio: () => void;
  videoError: string | null;
  audioError: string | null;
  youtubeImportError: string | null;
  // Detection
  detectionResult: AyahDetectionResult | null;
  detectingAyahs: boolean;
  detectionError: string | null;
  appliedDetectionKey: string | null;
  appliedDetectionMode: string | null;
  onRerunDetection: () => void;
  onApplyDetection: (match: AyahDetectionMatch) => void;
  detectionSourceLabel: string | null;
  detectionSourceFile: File | null;
  // Format
  aspectRatio: AspectRatioPreset;
  onAspectRatioChange: (id: AspectRatioPreset) => void;
  // Reciter
  selectedReciter: string;
  onReciterChange: (id: string) => void;
  onLoadReciterAudio: () => void;
  onAutoSync: () => void;
  audioLoading: boolean;
  audioProgress: { loaded: number; total: number } | null;
  ayahAudios: AyahAudioEntry[];
  subtitlesExist: boolean;
  surahSelected: boolean;
}

type Section = "style" | "source" | "detection" | "format" | "reciter";

export default function SettingsDrawer({
  open,
  onClose,
  // Style
  subtitleStyle,
  onSubtitleStyleChange,
  subtitleFormatting,
  onUpdateFormatting,
  subtitlePlacement,
  onSubtitlePlacementChange,
  resolvedColors,
  // Source
  videoName,
  videoDuration,
  videoSrc,
  audioName,
  audioSrc,
  audioDuration,
  usingClipAudio,
  videoInputRef,
  audioInputRef,
  youtubeUrl,
  onYoutubeUrlChange,
  onYouTubeImport,
  youtubeImporting,
  onClearVideo,
  onClearAudio,
  videoError,
  audioError,
  youtubeImportError,
  // Detection
  detectionResult,
  detectingAyahs,
  detectionError,
  appliedDetectionKey,
  appliedDetectionMode,
  onRerunDetection,
  onApplyDetection,
  detectionSourceLabel,
  detectionSourceFile,
  // Format
  aspectRatio,
  onAspectRatioChange,
  // Reciter
  selectedReciter,
  onReciterChange,
  onLoadReciterAudio,
  onAutoSync,
  audioLoading,
  audioProgress,
  ayahAudios,
  subtitlesExist,
  surahSelected,
}: SettingsDrawerProps) {
  const [expanded, setExpanded] = useState<Section | null>("style");

  function toggleSection(section: Section) {
    setExpanded((prev) => (prev === section ? null : section));
  }

  if (!open) return null;

  const bestDetection = detectionResult?.matches[0] ?? null;
  const appliedDetection =
    detectionResult?.matches.find(
      (m) => getDetectionKey(m) === appliedDetectionKey
    ) ?? null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--bg)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)]/60 px-5 py-4">
          <h2 className="text-base font-semibold text-[var(--text)]">
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-alt)] hover:text-[var(--text)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sections */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* ── Format ────────────────────────────────────────── */}
          <AccordionSection
            title="Format"
            section="format"
            expanded={expanded}
            onToggle={toggleSection}
          >
            <div className="grid grid-cols-3 gap-2">
              {ASPECT_RATIO_OPTIONS.map(({ id, label, hint, icon: Icon }) => {
                const isActive = aspectRatio === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onAspectRatioChange(id)}
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
              })}
            </div>
          </AccordionSection>

          {/* ── Style ─────────────────────────────────────────── */}
          <AccordionSection
            title="Style"
            section="style"
            expanded={expanded}
            onToggle={toggleSection}
          >
            <div className="space-y-3">
              {SUBTITLE_STYLES.map((style) => {
                const isActive = subtitleStyle === style.id;
                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => {
                      onSubtitleStyleChange(style.id);
                      onUpdateFormatting(getStyleFormattingDefaults(style.id));
                    }}
                    aria-pressed={isActive}
                    className={[
                      "w-full rounded-2xl border p-3 text-left transition-all duration-200 active:scale-[0.99]",
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
                        In the name of God, the Most Gracious, the Most Merciful
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Formatting controls */}
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
                      value={subtitleFormatting.arabicFontFamily}
                      onChange={(e) =>
                        onUpdateFormatting({
                          arabicFontFamily: e.target.value as "amiri" | "naskh",
                        })
                      }
                      className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--gold-dim)]"
                    >
                      {ARABIC_FONT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="font-mono-ui mb-1 block text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                      Translation Font
                    </span>
                    <select
                      value={subtitleFormatting.translationFontFamily}
                      onChange={(e) =>
                        onUpdateFormatting({
                          translationFontFamily: e.target.value as "ui" | "mono",
                        })
                      }
                      className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--gold-dim)]"
                    >
                      {TRANSLATION_FONT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* Font sizes */}
                <SliderControl
                  label="Arabic Size"
                  value={subtitleFormatting.arabicFontSize}
                  min={20}
                  max={44}
                  unit="px"
                  onChange={(v) => onUpdateFormatting({ arabicFontSize: v })}
                />
                <SliderControl
                  label="Translation Size"
                  value={subtitleFormatting.translationFontSize}
                  min={12}
                  max={28}
                  unit="px"
                  onChange={(v) =>
                    onUpdateFormatting({ translationFontSize: v })
                  }
                />

                {/* Colors */}
                <ColorControl
                  label="Arabic Color"
                  value={resolvedColors.arabicColor}
                  onChange={(v) =>
                    onUpdateFormatting({ arabicColorOverride: v })
                  }
                  onReset={() =>
                    onUpdateFormatting({ arabicColorOverride: null })
                  }
                />
                <ColorControl
                  label="Translation Color"
                  value={resolvedColors.translationColor}
                  onChange={(v) =>
                    onUpdateFormatting({ translationColorOverride: v })
                  }
                  onReset={() =>
                    onUpdateFormatting({ translationColorOverride: null })
                  }
                />

                {/* Checkboxes */}
                <CheckboxControl
                  label="Italicize translation text"
                  description="Applies to the preview and styled .ASS export."
                  checked={subtitleFormatting.translationItalic}
                  onChange={(v) =>
                    onUpdateFormatting({ translationItalic: v })
                  }
                />
                <CheckboxControl
                  label="Word highlighting"
                  description="Lights up each word as it's recited."
                  checked={subtitleFormatting.karaokeEnabled}
                  onChange={(v) =>
                    onUpdateFormatting({ karaokeEnabled: v })
                  }
                />
                <CheckboxControl
                  label="Text shadow"
                  description="Adds a drop shadow behind text. Works great with no-background styles."
                  checked={subtitleFormatting.textShadow}
                  onChange={(v) =>
                    onUpdateFormatting({ textShadow: v })
                  }
                />
                <CheckboxControl
                  label="Text outline"
                  description="Adds a thin outline stroke around text for extra contrast."
                  checked={subtitleFormatting.textOutline}
                  onChange={(v) =>
                    onUpdateFormatting({ textOutline: v })
                  }
                />

                <SliderControl
                  label="Line Spacing"
                  value={subtitleFormatting.lineSpacing}
                  min={0}
                  max={20}
                  unit="px"
                  onChange={(v) =>
                    onUpdateFormatting({ lineSpacing: v })
                  }
                />

                <SliderControl
                  label="Background Opacity"
                  value={subtitleFormatting.backgroundOpacity}
                  min={0}
                  max={100}
                  step={5}
                  unit="%"
                  onChange={(v) =>
                    onUpdateFormatting({ backgroundOpacity: v })
                  }
                />

                {subtitleFormatting.backgroundOpacity > 0 && (
                  <>
                    <ColorControl
                      label="Background Color"
                      value={subtitleFormatting.backgroundColorOverride ?? "#000000"}
                      onChange={(v) =>
                        onUpdateFormatting({ backgroundColorOverride: v })
                      }
                      onReset={() =>
                        onUpdateFormatting({ backgroundColorOverride: null })
                      }
                    />
                    <SliderControl
                      label="Background Blur"
                      value={subtitleFormatting.backgroundBlur}
                      min={0}
                      max={30}
                      unit="px"
                      onChange={(v) =>
                        onUpdateFormatting({ backgroundBlur: v })
                      }
                    />
                    <SliderControl
                      label="Corner Radius"
                      value={subtitleFormatting.borderRadius}
                      min={0}
                      max={32}
                      unit="px"
                      onChange={(v) =>
                        onUpdateFormatting({ borderRadius: v })
                      }
                    />
                  </>
                )}
              </div>
            </div>

            {/* Long Ayah Handling */}
            <div className="mt-6">
              <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)] font-[family-name:var(--font-ibm-plex)]">
                Long Ayah Handling
              </p>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <CheckboxControl
                  label="Split long ayahs into multiple chunks"
                  description="Applies to new subtitle generation and detected ayah ranges."
                  checked={subtitleFormatting.splitLongAyahs}
                  onChange={(v) =>
                    onUpdateFormatting({ splitLongAyahs: v })
                  }
                />
                <SliderControl
                  label="Max Arabic Words Per Chunk"
                  value={subtitleFormatting.maxWordsPerChunk}
                  min={6}
                  max={22}
                  onChange={(v) =>
                    onUpdateFormatting({ maxWordsPerChunk: v })
                  }
                />
              </div>
            </div>

            {/* Subtitle Position */}
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
                Drag the live subtitle in the preview to fine-tune, or jump to a
                preset below.
              </p>
              <div className="space-y-2">
                {SUBTITLE_POSITION_PRESETS.map((preset) => {
                  const isActive =
                    Math.abs(subtitlePlacement.x - preset.placement.x) < 0.01 &&
                    Math.abs(subtitlePlacement.y - preset.placement.y) < 0.01;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() =>
                        onSubtitlePlacementChange(preset.placement)
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
          </AccordionSection>

          {/* ── Source ─────────────────────────────────────────── */}
          <AccordionSection
            title="Source"
            section="source"
            expanded={expanded}
            onToggle={toggleSection}
          >
            {/* Video */}
            <div className="studio-panel-soft rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="section-kicker">Video</p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                    {videoName ?? "No clip loaded"}
                  </p>
                </div>
                {videoDuration > 0 && (
                  <span className="metric-pill">{videoDuration.toFixed(1)}s</span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-xl bg-[var(--gold)] px-3.5 py-2.5 text-sm font-semibold text-[var(--bg)] transition-all duration-200 hover:bg-[var(--gold-light)] active:scale-[0.97]"
                >
                  <Upload className="h-4 w-4" />
                  <span>{videoSrc ? "Replace Clip" : "Upload Clip"}</span>
                </button>
                {videoSrc && (
                  <button
                    type="button"
                    onClick={onClearVideo}
                    className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
                  >
                    <X className="h-4 w-4" />
                    Clear
                  </button>
                )}
              </div>
              {(videoError || youtubeImportError) && (
                <div className="mt-3 text-xs text-red-400">
                  {videoError || youtubeImportError}
                </div>
              )}
            </div>

            {/* YouTube */}
            <div className="mt-3 studio-panel-soft rounded-xl p-4">
              <p className="section-kicker">YouTube Import</p>
              <div className="mt-3 flex gap-2">
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => onYoutubeUrlChange(e.target.value)}
                  placeholder="Paste a YouTube link"
                  className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--gold-dim)]"
                />
                <button
                  type="button"
                  onClick={() => void onYouTubeImport()}
                  disabled={youtubeImporting}
                  className={[
                    "flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors",
                    youtubeImporting
                      ? "cursor-wait bg-[var(--border)] text-[var(--text-dim)]"
                      : "bg-[var(--emerald)] text-white hover:bg-[var(--emerald-light)]",
                  ].join(" ")}
                >
                  <Link2 className="h-4 w-4" />
                  {youtubeImporting ? "..." : "Import"}
                </button>
              </div>
              <p className="mt-2 text-xs text-[var(--text-dim)]">
                Limit: {MAX_YOUTUBE_IMPORT_MB} MB.
              </p>
            </div>

            {/* Audio */}
            <div className="mt-3 studio-panel-soft rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="section-kicker">Audio Override</p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                    {audioSrc
                      ? `Override: ${audioName}`
                      : videoName
                        ? `Using clip audio from ${videoName}`
                        : "No audio source"}
                  </p>
                </div>
                {audioDuration > 0 && (
                  <span className="metric-pill">{audioDuration.toFixed(1)}s</span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-xl bg-[var(--emerald)] px-3.5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--emerald-light)]"
                >
                  <Upload className="h-4 w-4" />
                  {audioSrc ? "Replace" : "Override Audio"}
                </button>
                {audioSrc && (
                  <button
                    type="button"
                    onClick={onClearAudio}
                    className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
                  >
                    <X className="h-4 w-4" />
                    Clear
                  </button>
                )}
              </div>
              {audioError && (
                <div className="mt-2 text-xs text-red-400">{audioError}</div>
              )}
              {usingClipAudio && !audioError && (
                <p className="mt-2 text-xs text-[var(--emerald-light)]">
                  Using clip audio automatically
                </p>
              )}
            </div>
          </AccordionSection>

          {/* ── Detection ─────────────────────────────────────── */}
          <AccordionSection
            title="Detection"
            section="detection"
            expanded={expanded}
            onToggle={toggleSection}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-[var(--text-muted)]">
                {detectionSourceLabel
                  ? `Source: ${detectionSourceLabel}`
                  : "No detection source"}
              </p>
              <button
                type="button"
                onClick={onRerunDetection}
                disabled={!detectionSourceFile || detectingAyahs}
                className={[
                  "flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all",
                  detectionSourceFile && !detectingAyahs
                    ? "bg-[var(--gold)] text-[var(--bg)] hover:bg-[var(--gold-light)]"
                    : "cursor-not-allowed bg-[var(--border)] text-[var(--text-dim)]",
                ].join(" ")}
              >
                <Sparkles
                  className={`h-3.5 w-3.5 ${detectingAyahs ? "animate-spin" : ""}`}
                />
                {detectingAyahs ? "Detecting..." : "Re-run"}
              </button>
            </div>

            {detectingAyahs && (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--gold-dim)] border-t-[var(--gold)]" />
                <p className="text-sm text-[var(--text-muted)]">
                  Analyzing recitation...
                </p>
              </div>
            )}

            {detectionError && (
              <div className="mt-3 rounded-xl border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-3 text-sm text-[var(--accent)]">
                {detectionError}
              </div>
            )}

            {appliedDetection && (
              <div className="mt-3 rounded-xl border border-[var(--emerald)]/35 bg-[var(--emerald)]/10 px-4 py-3">
                <p className="text-sm font-semibold text-[var(--emerald-light)]">
                  {appliedDetectionMode === "auto" ? "Auto-detected" : "Applied"}
                  : {appliedDetection.surahName} {appliedDetection.startAyah}
                  {appliedDetection.endAyah !== appliedDetection.startAyah
                    ? `-${appliedDetection.endAyah}`
                    : ""}
                </p>
              </div>
            )}

            {detectionResult &&
              detectionResult.matches.length > 0 &&
              !appliedDetection && (
                <div className="mt-3 space-y-2">
                  <p className="section-kicker">Suggested Ranges</p>
                  {detectionResult.matches.map((match) => {
                    const matchKey = getDetectionKey(match);
                    return (
                      <div
                        key={matchKey}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-[var(--text)]">
                            {match.surahName} {match.startAyah}
                            {match.endAyah !== match.startAyah
                              ? `-${match.endAyah}`
                              : ""}
                          </p>
                          <p className="text-xs text-[var(--text-dim)]">
                            {Math.round(match.score * 100)}% match
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onApplyDetection(match)}
                          className="shrink-0 rounded-xl bg-[var(--emerald)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--emerald-light)]"
                        >
                          Apply
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
          </AccordionSection>

          {/* ── Reciter ────────────────────────────────────────── */}
          <AccordionSection
            title="Reciter Audio"
            section="reciter"
            expanded={expanded}
            onToggle={toggleSection}
          >
            <ReciterPanel
              selectedReciter={selectedReciter}
              onReciterChange={onReciterChange}
              onLoadAudio={onLoadReciterAudio}
              onAutoSync={onAutoSync}
              audioLoading={audioLoading}
              audioProgress={audioProgress}
              ayahAudios={ayahAudios}
              subtitlesExist={subtitlesExist}
              surahSelected={surahSelected}
            />
          </AccordionSection>
        </div>
      </div>
    </>
  );
}

/* ── Shared sub-components ─────────────────────────────────────── */

function AccordionSection({
  title,
  section,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  section: Section;
  expanded: Section | null;
  onToggle: (s: Section) => void;
  children: React.ReactNode;
}) {
  const isOpen = expanded === section;
  return (
    <div className="border-b border-[var(--border)]/40">
      <button
        type="button"
        onClick={() => onToggle(section)}
        className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface)]/50"
      >
        {title}
        <ChevronDown
          className={`h-4 w-4 text-[var(--text-dim)] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

function SliderControl({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="mt-4 block">
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="font-mono-ui block text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
          {label}
        </span>
        <span className="font-mono-ui text-[11px] text-[var(--text-dim)]">
          {value}
          {unit ?? ""}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number.parseInt(e.target.value, 10))}
        className="w-full accent-[var(--gold)]"
      />
    </label>
  );
}

function ColorControl({
  label,
  value,
  onChange,
  onReset,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onReset: () => void;
}) {
  return (
    <label className="mt-4 block">
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="font-mono-ui block text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
          {label}
        </span>
        <span className="font-mono-ui text-[11px] text-[var(--text-dim)]">
          {value}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 cursor-pointer rounded border border-[var(--border)] bg-[var(--surface-alt)]"
        />
        <button
          type="button"
          onClick={onReset}
          className="font-mono-ui rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 py-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)] transition-colors hover:border-[var(--gold-dim)] hover:text-[var(--text)]"
        >
          Use Style Color
        </button>
      </div>
    </label>
  );
}

function CheckboxControl({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="mt-4 flex items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-[var(--border)] bg-[var(--surface-alt)] accent-[var(--gold)]"
      />
      <span>
        <span className="block text-sm text-[var(--text)]">{label}</span>
        <span className="mt-1 block text-xs leading-relaxed text-[var(--text-dim)]">
          {description}
        </span>
      </span>
    </label>
  );
}

function getDetectionKey(match: AyahDetectionMatch): string {
  return `${match.surahNumber}:${match.startAyah}:${match.endAyah}`;
}
