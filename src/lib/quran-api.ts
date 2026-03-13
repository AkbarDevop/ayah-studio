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
  const [ayahs, translations] = await Promise.all([
    fetchSurahAyahs(surahNum),
    fetchSurahTranslation(surahNum, edition),
  ]);
  return { ayahs, translations };
}
