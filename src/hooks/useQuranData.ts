"use client";

import { useCallback, useEffect, useState } from "react";
import type { Ayah, Surah, TranslationAyah } from "@/types";
import { fetchAllSurahs, fetchSurahWithTranslation } from "@/lib/quran-api";

export function useQuranData() {
  const [surahs, setSurahs] = useState<Surah[]>([]);
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
  };
}
