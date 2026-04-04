import { describe, it, expect } from "vitest";
import { alignWordsToQuranText } from "@/lib/word-alignment";
import type { WordTiming } from "@/types";

describe("alignWordsToQuranText", () => {
  it("returns evenly distributed timings when no ASR words are provided", () => {
    const result = alignWordsToQuranText(
      "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
      [],
      0,
      4
    );

    expect(result).toHaveLength(4);
    expect(result[0].start).toBe(0);
    expect(result[3].end).toBe(4);
    // Each word gets 1 second
    expect(result[0].end).toBeCloseTo(1, 1);
    expect(result[1].start).toBeCloseTo(1, 1);
  });

  it("aligns perfectly matching ASR words 1:1", () => {
    const asrWords: WordTiming[] = [
      { word: "بسم", start: 0.1, end: 0.5 },
      { word: "الله", start: 0.6, end: 1.0 },
      { word: "الرحمن", start: 1.1, end: 1.8 },
      { word: "الرحيم", start: 1.9, end: 2.5 },
    ];

    const result = alignWordsToQuranText(
      "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
      asrWords,
      0,
      3
    );

    expect(result).toHaveLength(4);
    // Timings should come from ASR
    expect(result[0].start).toBe(0.1);
    expect(result[0].end).toBe(0.5);
    expect(result[1].start).toBe(0.6);
    expect(result[3].end).toBe(2.5);
    // Words should be the canonical Quran text
    expect(result[0].word).toBe("بِسْمِ");
    expect(result[1].word).toBe("ٱللَّهِ");
  });

  it("handles more ASR words than Quran words (Whisper splits)", () => {
    const asrWords: WordTiming[] = [
      { word: "بسم", start: 0.1, end: 0.3 },
      { word: "الله", start: 0.4, end: 0.7 },
      { word: "ال", start: 0.8, end: 0.9 },
      { word: "رحمن", start: 0.9, end: 1.3 },
      { word: "الرحيم", start: 1.4, end: 1.8 },
    ];

    const result = alignWordsToQuranText(
      "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
      asrWords,
      0,
      2
    );

    expect(result).toHaveLength(4);
    // First two should align directly
    expect(result[0].start).toBe(0.1);
    expect(result[1].start).toBe(0.4);
    // Last word should align
    expect(result[3].word).toBe("ٱلرَّحِيمِ");
  });

  it("handles fewer ASR words than Quran words (Whisper merges)", () => {
    const asrWords: WordTiming[] = [
      { word: "بسم الله", start: 0.1, end: 0.8 },
      { word: "الرحمن الرحيم", start: 0.9, end: 1.6 },
    ];

    const result = alignWordsToQuranText(
      "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
      asrWords,
      0,
      2
    );

    expect(result).toHaveLength(4);
    // All words should have timings (interpolated for unmatched)
    for (const wt of result) {
      expect(wt.start).toBeGreaterThanOrEqual(0);
      expect(wt.end).toBeLessThanOrEqual(2);
      expect(wt.end).toBeGreaterThan(wt.start);
    }
  });

  it("preserves canonical Quran words with diacritics", () => {
    const asrWords: WordTiming[] = [
      { word: "قل", start: 0, end: 0.5 },
      { word: "هو", start: 0.5, end: 0.8 },
      { word: "الله", start: 0.8, end: 1.2 },
      { word: "احد", start: 1.2, end: 1.6 },
    ];

    const result = alignWordsToQuranText(
      "قُلْ هُوَ ٱللَّهُ أَحَدٌ",
      asrWords,
      0,
      2
    );

    expect(result).toHaveLength(4);
    expect(result[0].word).toBe("قُلْ");
    expect(result[1].word).toBe("هُوَ");
    expect(result[2].word).toBe("ٱللَّهُ");
    expect(result[3].word).toBe("أَحَدٌ");
  });

  it("handles empty Quran text", () => {
    const result = alignWordsToQuranText("", [], 0, 1);
    expect(result).toHaveLength(0);
  });

  it("handles single-word ayah", () => {
    const asrWords: WordTiming[] = [
      { word: "والعصر", start: 0.2, end: 0.9 },
    ];

    const result = alignWordsToQuranText("وَٱلْعَصْرِ", asrWords, 0, 1);

    expect(result).toHaveLength(1);
    expect(result[0].word).toBe("وَٱلْعَصْرِ");
    expect(result[0].start).toBe(0.2);
    expect(result[0].end).toBe(0.9);
  });

  it("produces monotonically increasing timings", () => {
    const asrWords: WordTiming[] = [
      { word: "الحمد", start: 0.1, end: 0.4 },
      { word: "لله", start: 0.5, end: 0.8 },
      { word: "رب", start: 0.9, end: 1.1 },
      { word: "العالمين", start: 1.2, end: 1.8 },
    ];

    const result = alignWordsToQuranText(
      "ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ",
      asrWords,
      0,
      2
    );

    for (let i = 1; i < result.length; i++) {
      expect(result[i].start).toBeGreaterThanOrEqual(result[i - 1].start);
    }
  });
});
