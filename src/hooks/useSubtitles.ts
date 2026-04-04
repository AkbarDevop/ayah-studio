"use client";

import { useCallback, useRef, useState } from "react";
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

const MAX_HISTORY = 50;

export function useSubtitles(onResetPlayback: () => void) {
  const [subtitles, setSubtitlesRaw] = useState<Subtitle[]>([]);
  const [subtitleStyle, setSubtitleStyle] = useState("shadow");
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

  /* ------------------------------------------------------------------ */
  /* Undo / Redo history                                                 */
  /* ------------------------------------------------------------------ */
  const historyRef = useRef<Subtitle[][]>([]);
  const futureRef = useRef<Subtitle[][]>([]);
  const currentRef = useRef<Subtitle[]>(subtitles);

  // Force a re-render so canUndo / canRedo stay reactive
  const [, setHistoryTick] = useState(0);
  const bumpTick = useCallback(() => setHistoryTick((n) => n + 1), []);

  /** Push current state to history, then apply next state. */
  function setSubtitles(next: Subtitle[]) {
    historyRef.current = [
      ...historyRef.current.slice(-(MAX_HISTORY - 1)),
      currentRef.current,
    ];
    futureRef.current = [];
    currentRef.current = next;
    setSubtitlesRaw(next);
    bumpTick();
  }

  /** Functional updater variant that also records history. */
  function setSubtitlesWithUpdater(
    updater: (prev: Subtitle[]) => Subtitle[]
  ) {
    setSubtitlesRaw((prev) => {
      const next = updater(prev);
      historyRef.current = [
        ...historyRef.current.slice(-(MAX_HISTORY - 1)),
        prev,
      ];
      futureRef.current = [];
      currentRef.current = next;
      bumpTick();
      return next;
    });
  }

  function undo() {
    if (historyRef.current.length === 0) return;
    const previous = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    futureRef.current = [...futureRef.current, currentRef.current];
    currentRef.current = previous;
    setSubtitlesRaw(previous);
    bumpTick();
  }

  function redo() {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current[futureRef.current.length - 1];
    futureRef.current = futureRef.current.slice(0, -1);
    historyRef.current = [...historyRef.current, currentRef.current];
    currentRef.current = next;
    setSubtitlesRaw(next);
    bumpTick();
  }

  const canUndo = historyRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  /* ------------------------------------------------------------------ */
  /* Subtitle operations (all push to history)                           */
  /* ------------------------------------------------------------------ */

  const subtitleDuration =
    subtitles.length > 0 ? Math.max(...subtitles.map((s) => s.end)) + 2 : 0;
  const previewSubtitle =
    selectedSubIdx !== null ? subtitles[selectedSubIdx] ?? null : subtitles[0] ?? null;

  function generateSubtitles(
    ayahs: Ayah[],
    translations: TranslationAyah[],
    selectedAyahIndices: Set<number>,
    surahLabel?: string
  ) {
    const sorted = Array.from(selectedAyahIndices).sort((a, b) => a - b);
    const nextSubtitles = buildSubtitlesFromAyahRange(
      sorted.map((index) => ayahs[index]).filter(Boolean),
      translations,
      {
        surahLabel,
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
      surahLabel?: string;
      detectedTimings?: AyahTimingSegment[];
      clipDuration?: number;
      leadingSubtitles?: Subtitle[];
    }
  ) {
    const nextSubtitles = buildSubtitlesFromAyahRange(ayahRange, translations, {
      surahLabel: options.surahLabel,
      detectedTimings: options.detectedTimings,
      clipDuration: options.clipDuration,
      fallbackDuration: defaultDuration,
      formatting: subtitleFormatting,
      leadingSubtitles: options.leadingSubtitles,
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
    setSubtitlesWithUpdater((prev) =>
      prev.filter((_, index) => index !== selectedSubIdx)
    );
    setSelectedSubIdx(null);
  }

  function updateSubtitleAtIndex(index: number, updated: Subtitle) {
    const normalized = normalizeSubtitleTiming(updated);
    setSubtitlesWithUpdater((prev) =>
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
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
