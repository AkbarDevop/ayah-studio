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

export type SidebarTab = "browse" | "subtitles" | "style";
export type ExportFormat = "srt" | "ass" | "json";
export type AspectRatioPreset = "landscape" | "portrait" | "square";
