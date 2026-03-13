export interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

export interface Ayah {
  number: number;
  text: string;
  numberInSurah: number;
  juz: number;
  page: number;
  hizbQuarter: number;
}

export interface TranslationAyah {
  number: number;
  text: string;
  numberInSurah: number;
  edition: {
    identifier: string;
    language: string;
    name: string;
    englishName: string;
  };
}

export interface Subtitle {
  ayahNum: number;
  arabic: string;
  translation: string;
  start: number;
  end: number;
  chunkIndex?: number;
  chunkCount?: number;
}

export interface SubtitleStyle {
  id: string;
  label: string;
  arabicColor: string;
  transColor: string;
  bg: string;
  font: string;
}

export interface Translation {
  code: string;
  label: string;
}

export interface Reciter {
  name: string;
}

export interface SubtitlePlacement {
  x: number;
  y: number;
}

export type ArabicFontFamily = "amiri" | "naskh";
export type TranslationFontFamily = "ui" | "mono";

export interface SubtitleFormatting {
  arabicFontFamily: ArabicFontFamily;
  translationFontFamily: TranslationFontFamily;
  arabicFontSize: number;
  translationFontSize: number;
  backgroundOpacity: number;
  splitLongAyahs: boolean;
  maxWordsPerChunk: number;
}

export interface AyahTimingSegment {
  ayahNum: number;
  start: number;
  end: number;
}

export interface AyahDetectionMatch {
  surahNumber: number;
  surahName: string;
  surahArabicName: string;
  startAyah: number;
  endAyah: number;
  score: number;
  matchedText: string;
  timings?: AyahTimingSegment[];
  timingSource?: "chunks" | "silence" | "hybrid" | "weighted";
}

export interface AyahDetectionResult {
  provider: string;
  transcript: string;
  matches: AyahDetectionMatch[];
  warning?: string;
}

export type SidebarTab = "browse" | "subtitles" | "style";
export type ExportFormat = "srt" | "ass" | "json";
export type AspectRatioPreset = "landscape" | "portrait" | "square";
export type PlaybackMode = "simulation" | "video" | "audio";
