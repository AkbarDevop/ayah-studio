"use client";

import { useState } from "react";
import type {
  AspectRatioPreset,
  Ayah,
  Subtitle,
  SubtitlePlacement,
  TranslationAyah,
  SidebarTab,
  AyahTimingSegment,
} from "@/types";
import { buildSubtitlesFromAyahRange } from "@/lib/subtitle-generation";

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
    }
  ) {
    const nextSubtitles = buildSubtitlesFromAyahRange(ayahRange, translations, {
      detectedTimings: options.detectedTimings,
      clipDuration: options.clipDuration,
      fallbackDuration: defaultDuration,
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
    setSubtitles((prev) =>
      prev.map((subtitle, index) =>
        index === selectedSubIdx ? updated : subtitle
      )
    );
  }

  function handleSubtitleDelete() {
    if (selectedSubIdx === null) return;
    setSubtitles((prev) => prev.filter((_, index) => index !== selectedSubIdx));
    setSelectedSubIdx(null);
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
    subtitleDuration,
    previewSubtitle,
    generateSubtitles,
    applyDetectedSubtitles,
    handleSubtitleChange,
    handleSubtitleDelete,
  };
}
