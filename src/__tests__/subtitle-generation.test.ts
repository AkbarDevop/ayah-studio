import { describe, it, expect } from "vitest";
import { buildSubtitlesFromAyahRange } from "@/lib/subtitle-generation";
import { DEFAULT_SUBTITLE_FORMATTING } from "@/lib/subtitle-formatting";
import type { Ayah, TranslationAyah } from "@/types";

function makeAyah(numberInSurah: number, text: string): Ayah {
  return {
    number: numberInSurah,
    text,
    numberInSurah,
    juz: 1,
    page: 1,
    hizbQuarter: 1,
  };
}

function makeTranslation(numberInSurah: number, text: string): TranslationAyah {
  return {
    number: numberInSurah,
    text,
    numberInSurah,
    edition: {
      identifier: "en.asad",
      language: "en",
      name: "Asad",
      englishName: "Muhammad Asad",
    },
  };
}

const AYAHS = [
  makeAyah(1, "word1 word2 word3"),
  makeAyah(2, "word4 word5"),
  makeAyah(3, "word6 word7 word8 word9"),
];

const TRANSLATIONS = [
  makeTranslation(1, "First verse"),
  makeTranslation(2, "Second verse"),
  makeTranslation(3, "Third verse"),
];

describe("buildSubtitlesFromAyahRange", () => {
  it("returns empty array for empty ayah range", () => {
    const result = buildSubtitlesFromAyahRange([], [], {
      fallbackDuration: 8,
    });
    expect(result).toEqual([]);
  });

  it("generates subtitles with fallback duration when no clip duration", () => {
    const result = buildSubtitlesFromAyahRange(AYAHS, TRANSLATIONS, {
      fallbackDuration: 5,
    });
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result[0].ayahNum).toBe(1);
    expect(result[0].arabic).toBe("word1 word2 word3");
    expect(result[0].translation).toBe("First verse");
    expect(result[0].start).toBe(0);
    expect(result[0].end).toBe(5);
  });

  it("distributes timing by word weight when clip duration is given", () => {
    const result = buildSubtitlesFromAyahRange(AYAHS, TRANSLATIONS, {
      fallbackDuration: 5,
      clipDuration: 30,
    });
    // Total words: 3 + 2 + 4 = 9
    // Ayah 1 gets 3/9 * 30 = 10s, ayah 2 gets 2/9 * 30 ≈ 6.67s, ayah 3 gets the rest
    expect(result[0].start).toBe(0);
    expect(result[0].end).toBeCloseTo(10, 0);
  });

  it("uses detected timings when provided", () => {
    const timings = [
      { ayahNum: 1, start: 0, end: 4 },
      { ayahNum: 2, start: 4, end: 7 },
      { ayahNum: 3, start: 7, end: 12 },
    ];
    const result = buildSubtitlesFromAyahRange(AYAHS, TRANSLATIONS, {
      fallbackDuration: 5,
      detectedTimings: timings,
    });
    expect(result[0].start).toBe(0);
    expect(result[0].end).toBe(4);
    expect(result[1].start).toBe(4);
    expect(result[1].end).toBe(7);
  });

  it("applies time offset", () => {
    const result = buildSubtitlesFromAyahRange(AYAHS.slice(0, 1), TRANSLATIONS.slice(0, 1), {
      fallbackDuration: 5,
      timeOffset: 10,
    });
    expect(result[0].start).toBe(10);
    expect(result[0].end).toBe(15);
  });

  it("adds surah label when provided", () => {
    const result = buildSubtitlesFromAyahRange(AYAHS.slice(0, 1), TRANSLATIONS.slice(0, 1), {
      fallbackDuration: 5,
      surahLabel: "Al-Fatiha",
    });
    expect(result[0].label).toBe("Al-Fatiha 1");
  });

  it("handles missing translations gracefully", () => {
    const result = buildSubtitlesFromAyahRange(AYAHS, [], {
      fallbackDuration: 5,
    });
    expect(result.length).toBeGreaterThanOrEqual(3);
    result.forEach((sub) => {
      expect(sub.translation).toBe("");
    });
  });

  it("splits long ayahs into chunks when formatting enabled", () => {
    const longAyah = makeAyah(1, Array(20).fill("word").join(" "));
    const result = buildSubtitlesFromAyahRange(
      [longAyah],
      [makeTranslation(1, Array(20).fill("translated").join(" "))],
      {
        fallbackDuration: 10,
        formatting: {
          ...DEFAULT_SUBTITLE_FORMATTING,
          splitLongAyahs: true,
          maxWordsPerChunk: 8,
        },
      }
    );
    expect(result.length).toBeGreaterThan(1);
    result.forEach((sub) => {
      expect(sub.chunkCount).toBeGreaterThan(1);
    });
  });

  it("does not split when splitLongAyahs is false", () => {
    const longAyah = makeAyah(1, Array(20).fill("word").join(" "));
    const result = buildSubtitlesFromAyahRange(
      [longAyah],
      [makeTranslation(1, "translation")],
      {
        fallbackDuration: 10,
        formatting: {
          ...DEFAULT_SUBTITLE_FORMATTING,
          splitLongAyahs: false,
        },
      }
    );
    expect(result).toHaveLength(1);
    expect(result[0].chunkCount).toBe(1);
  });

  it("prepends leading subtitles when provided", () => {
    const leadingSubs = [
      {
        ayahNum: 0,
        label: "Basmala",
        arabic: "basmala text",
        translation: "",
        start: 0,
        end: 2,
      },
    ];
    const result = buildSubtitlesFromAyahRange(AYAHS.slice(0, 1), TRANSLATIONS.slice(0, 1), {
      fallbackDuration: 5,
      leadingSubtitles: leadingSubs,
    });
    expect(result[0].label).toBe("Basmala");
    expect(result.length).toBeGreaterThan(1);
  });
});
