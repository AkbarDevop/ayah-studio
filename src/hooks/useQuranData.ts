"use client";

import { useCallback, useEffect, useState } from "react";
import type { Ayah, Surah, TranslationAyah } from "@/types";
import { fetchAllSurahs, fetchSurahWithTranslation, fetchSurahTajweed } from "@/lib/quran-api";

export function useQuranData() {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [surahsLoading, setSurahsLoading] = useState(true);
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [translations, setTranslations] = useState<TranslationAyah[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translationEdition, setTranslationEdition] = useState("en.asad");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAyahIndices, setSelectedAyahIndices] = useState<Set<number>>(
    new Set()
  );
  const [tajweedEnabled, setTajweedEnabled] = useState(false);
  const [tajweedTexts, setTajweedTexts] = useState<Map<number, string>>(
    new Map()
  );

  useEffect(() => {
    setSurahsLoading(true);
    fetchAllSurahs()
      .then(setSurahs)
      .catch((err) => setError(err.message))
      .finally(() => setSurahsLoading(false));
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
        const { ayahs: nextAyahs, translations: nextTranslations } =
          await fetchSurahContent(surah);
        setAyahs(nextAyahs);
        setTranslations(nextTranslations);
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

  // Fetch tajweed text whenever a surah is selected
  useEffect(() => {
    if (!selectedSurah) {
      setTajweedTexts(new Map());
      return;
    }

    let cancelled = false;
    fetchSurahTajweed(selectedSurah.number)
      .then((texts) => {
        if (!cancelled) setTajweedTexts(texts);
      })
      .catch(() => {
        // Silently fail — tajweed is a nice-to-have enhancement
        if (!cancelled) setTajweedTexts(new Map());
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSurah]);

  useEffect(() => {
    if (!selectedSurah) return;

    let cancelled = false;
    setLoading(true);

    fetchSurahContent(selectedSurah)
      .then(({ ayahs: nextAyahs, translations: nextTranslations }) => {
        if (cancelled) return;
        setAyahs(nextAyahs);
        setTranslations(nextTranslations);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchSurahContent, selectedSurah]);

  function toggleAyahIndex(index: number) {
    setSelectedAyahIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function selectAllAyahs() {
    setSelectedAyahIndices(new Set(ayahs.map((_, index) => index)));
  }

  function deselectAllAyahs() {
    setSelectedAyahIndices(new Set());
  }

  function clearSelection() {
    setSelectedSurah(null);
    setAyahs([]);
    setTranslations([]);
    setSelectedAyahIndices(new Set());
  }

  return {
    surahs,
    setSurahs,
    surahsLoading,
    selectedSurah,
    setSelectedSurah,
    ayahs,
    setAyahs,
    translations,
    setTranslations,
    loading,
    error,
    translationEdition,
    setTranslationEdition,
    searchQuery,
    setSearchQuery,
    selectedAyahIndices,
    setSelectedAyahIndices,
    fetchSurahContent,
    loadSurah,
    toggleAyahIndex,
    selectAllAyahs,
    deselectAllAyahs,
    clearSelection,
    tajweedEnabled,
    setTajweedEnabled,
    tajweedTexts,
  };
}
