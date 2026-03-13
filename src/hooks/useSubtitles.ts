"use client";

import { useState } from "react";
import type {
  AspectRatioPreset,
  Ayah,
  Subtitle,
  SubtitleFormatting,
  SubtitlePlacement,
  TranslationAyah,
  SidebarTab,
  AyahTimingSegment,
} from "@/types";
import { buildSubtitlesFromAyahRange } from "@/lib/subtitle-generation";
import { DEFAULT_SUBTITLE_FORMATTING } from "@/lib/subtitle-formatting";
import { normalizeSubtitleTiming } from "@/lib/subtitle-timing";

export function useSubtitles(onResetPlayback: () => void) {
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [subtitleStyle, setSubtitleStyle] = useState("classic");
  const [selectedSubIdx, setSelectedSubIdx] = useState<number | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [defaultDuration, setDefaultDuration] = useState(8);
  const [tab, setTab] = useState<SidebarTab>("browse");
  const [aspectRatio, setAspectRatio] =
    useState<AspectRatioPreset>("landscape");
  const [subtitlePlacement, setSubtitlePlacement] =
    useState<SubtitlePlacement>({ x: 0.5, y: 0.78 });
  const [subtitleFormatting, setSubtitleFormatting] = useState<SubtitleFormatting>(
    DEFAULT_SUBTITLE_FORMATTING
  );

  const subtitleDuration =
    subtitles.length > 0 ? Math.max(...subtitles.map((s) => s.end)) + 2 : 0;
  const previewSubtitle =
    selectedSubIdx !== null ? subtitles[selectedSubIdx] ?? null : subtitles[0] ?? null;

  function generateSubtitles(
    ayahs: Ayah[],
    translations: TranslationAyah[],
    selectedAyahIndices: Set<number>
  ) {
    const sorted = Array.from(selectedAyahIndices).sort((a, b) => a - b);
    const nextSubtitles = buildSubtitlesFromAyahRange(
      sorted.map((index) => ayahs[index]).filter(Boolean),
      translations,
      {
        fallbackDuration: defaultDuration,
        formatting: subtitleFormatting,
      }
    );

    applyGeneratedSubtitles(nextSubtitles);
  }

  function applyDetectedSubtitles(
    ayahRange: Ayah[],
    translations: TranslationAyah[],
    options: {
      detectedTimings?: AyahTimingSegment[];
      clipDuration?: number;
      leadingSubtitle?: Subtitle;
    }
  ) {
    const nextSubtitles = buildSubtitlesFromAyahRange(ayahRange, translations, {
      detectedTimings: options.detectedTimings,
      clipDuration: options.clipDuration,
      fallbackDuration: defaultDuration,
      formatting: subtitleFormatting,
      leadingSubtitle: options.leadingSubtitle,
    });

    applyGeneratedSubtitles(nextSubtitles);
  }

  function applyGeneratedSubtitles(nextSubtitles: Subtitle[]) {
    setSubtitles(nextSubtitles);
    setSelectedSubIdx(null);
    onResetPlayback();
    setTab("subtitles");
  }

  function handleSubtitleChange(updated: Subtitle) {
    if (selectedSubIdx === null) return;
    updateSubtitleAtIndex(selectedSubIdx, updated);
  }

  function handleSubtitleDelete() {
    if (selectedSubIdx === null) return;
    setSubtitles((prev) => prev.filter((_, index) => index !== selectedSubIdx));
    setSelectedSubIdx(null);
  }

  function updateSubtitleAtIndex(index: number, updated: Subtitle) {
    const normalized = normalizeSubtitleTiming(updated);
    setSubtitles((prev) =>
      prev.map((subtitle, subtitleIndex) =>
        subtitleIndex === index ? normalized : subtitle
      )
    );
  }

  function updateSubtitleFormatting(
    patch: Partial<SubtitleFormatting>
  ) {
    setSubtitleFormatting((current) => ({
      ...current,
      ...patch,
    }));
  }

  return {
    subtitles,
    setSubtitles,
    subtitleStyle,
    setSubtitleStyle,
    selectedSubIdx,
    setSelectedSubIdx,
    showExport,
    setShowExport,
    defaultDuration,
    setDefaultDuration,
    tab,
    setTab,
    aspectRatio,
    setAspectRatio,
    subtitlePlacement,
    setSubtitlePlacement,
    subtitleFormatting,
    setSubtitleFormatting,
    updateSubtitleFormatting,
    subtitleDuration,
    previewSubtitle,
    generateSubtitles,
    applyDetectedSubtitles,
    updateSubtitleAtIndex,
    handleSubtitleChange,
    handleSubtitleDelete,
  };
}
