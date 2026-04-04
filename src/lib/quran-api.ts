import { QURAN_API } from "./constants";
import type { Surah, Ayah, TranslationAyah } from "@/types";

interface ApiResponse<T> {
  code: number;
  status: string;
  data: T;
}

interface SurahData {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
  ayahs: Ayah[];
}

interface TranslationSurahData {
  number: number;
  name: string;
  englishName: string;
  ayahs: TranslationAyah[];
}

const basmalaTranslationCache = new Map<string, Promise<string>>();
const tajweedCache = new Map<number, Promise<Map<number, string>>>();

interface TajweedVerse {
  id: number;
  verse_key: string;
  text_uthmani_tajweed: string;
}

interface TajweedApiResponse {
  verses: TajweedVerse[];
}

export async function fetchSurahTajweed(
  surahNum: number
): Promise<Map<number, string>> {
  const cached = tajweedCache.get(surahNum);
  if (cached) return cached;

  const promise = fetch(
    `https://api.quran.com/api/v4/quran/verses/uthmani_tajweed?chapter_number=${surahNum}`
  )
    .then(async (res) => {
      if (!res.ok) throw new Error("Failed to fetch tajweed text");
      const data: TajweedApiResponse = await res.json();
      const map = new Map<number, string>();
      for (const verse of data.verses) {
        // verse_key is "surah:ayah", e.g. "1:2"
        const ayahNum = Number.parseInt(verse.verse_key.split(":")[1], 10);
        map.set(ayahNum, verse.text_uthmani_tajweed);
      }
      return map;
    })
    .catch((error) => {
      tajweedCache.delete(surahNum);
      throw error;
    });

  tajweedCache.set(surahNum, promise);
  return promise;
}

export async function fetchAllSurahs(): Promise<Surah[]> {
  const res = await fetch(`${QURAN_API}/surah`);
  const data: ApiResponse<Surah[]> = await res.json();
  if (data.code !== 200) throw new Error("Failed to fetch surahs");
  return data.data;
}

export async function fetchSurahAyahs(surahNum: number): Promise<Ayah[]> {
  const res = await fetch(`${QURAN_API}/surah/${surahNum}`);
  const data: ApiResponse<SurahData> = await res.json();
  if (data.code !== 200) throw new Error("Failed to fetch ayahs");
  return data.data.ayahs;
}

export async function fetchSurahTranslation(
  surahNum: number,
  edition: string
): Promise<TranslationAyah[]> {
  const res = await fetch(`${QURAN_API}/surah/${surahNum}/${edition}`);
  const data: ApiResponse<TranslationSurahData> = await res.json();
  if (data.code !== 200) throw new Error("Failed to fetch translation");
  return data.data.ayahs;
}

export async function fetchSurahWithTranslation(
  surahNum: number,
  edition: string
): Promise<{ ayahs: Ayah[]; translations: TranslationAyah[] }> {
  if (edition === "none") {
    const ayahs = await fetchSurahAyahs(surahNum);
    return { ayahs, translations: [] };
  }

  const [ayahs, translations] = await Promise.all([
    fetchSurahAyahs(surahNum),
    fetchSurahTranslation(surahNum, edition),
  ]);
  return { ayahs, translations };
}

export async function fetchBasmalaTranslation(edition: string): Promise<string> {
  if (edition === "none") {
    return "";
  }

  const cached = basmalaTranslationCache.get(edition);
  if (cached) {
    return cached;
  }

  const promise = fetchSurahTranslation(1, edition)
    .then((translations) => {
      const basmala = translations.find((ayah) => ayah.numberInSurah === 1);
      return basmala?.text ?? "";
    })
    .catch((error) => {
      basmalaTranslationCache.delete(edition);
      throw error;
    });

  basmalaTranslationCache.set(edition, promise);
  return promise;
}
