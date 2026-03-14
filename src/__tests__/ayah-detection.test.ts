import { describe, it, expect } from "vitest";
import {
  normalizeArabicText,
  scoreArabicTextSimilarity,
  stripLeadingIstiadha,
  stripLeadingBasmala,
  stripLeadingFatiha,
  stripLeadingAmeen,
  hasLeadingIstiadha,
  hasLeadingBasmala,
  hasLeadingFatiha,
  hasLeadingAmeen,
  hasLikelyLeadingFatiha,
  ISTIADHA_MATCH_TEXTS,
  BASMALA_MATCH_TEXT,
  FATIHA_MATCH_TEXT,
  AMEEN_MATCH_TEXT,
} from "@/lib/ayah-detection";

describe("normalizeArabicText", () => {
  it("strips diacritics from Arabic text", () => {
    const input = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ";
    const result = normalizeArabicText(input);
    expect(result).toBe("بسم الله الرحمن الرحيم");
  });

  it("normalizes hamza variants to alif", () => {
    // 4 input chars => 4 output alifs (each hamza variant maps to a single alif)
    const result = normalizeArabicText("أإآٱ");
    expect(result).toBe("اااا");
  });

  it("normalizes taa marbuta to haa", () => {
    const result = normalizeArabicText("رحمة");
    expect(result).toBe("رحمه");
  });

  it("normalizes alif maqsura to yaa", () => {
    const result = normalizeArabicText("على");
    expect(result).toBe("علي");
  });

  it("returns empty string for non-Arabic input", () => {
    const result = normalizeArabicText("hello world");
    expect(result).toBe("");
  });

  it("handles mixed content by stripping non-Arabic", () => {
    const result = normalizeArabicText("test بسم الله test");
    expect(result).toBe("بسم الله");
  });

  it("collapses multiple spaces", () => {
    const result = normalizeArabicText("بسم   الله   الرحمن");
    expect(result).toBe("بسم الله الرحمن");
  });

  it("handles empty input", () => {
    expect(normalizeArabicText("")).toBe("");
  });
});

describe("scoreArabicTextSimilarity", () => {
  it("returns 1 for identical texts", () => {
    const text = "بسم الله الرحمن الرحيم";
    const score = scoreArabicTextSimilarity(text, text);
    expect(score).toBeGreaterThanOrEqual(0.95);
  });

  it("returns high score for same text with diacritics vs without", () => {
    const withDiacritics = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ";
    const withoutDiacritics = "بسم الله الرحمن الرحيم";
    const score = scoreArabicTextSimilarity(withDiacritics, withoutDiacritics);
    expect(score).toBeGreaterThanOrEqual(0.95);
  });

  it("returns low score for very different texts", () => {
    const text1 = "الحمد لله رب العالمين";
    const text2 = "قل هو الله احد";
    const score = scoreArabicTextSimilarity(text1, text2);
    expect(score).toBeLessThan(0.5);
  });

  it("returns 0 for empty input", () => {
    expect(scoreArabicTextSimilarity("", "test")).toBe(0);
    expect(scoreArabicTextSimilarity("test", "")).toBe(0);
  });

  it("differentiates short ayahs with same words in different order", () => {
    // Two short phrases with the same words but different order
    const text1 = "الرحمن الرحيم";
    const text2 = "الرحيم الرحمن";
    const score = scoreArabicTextSimilarity(text1, text2);
    // Should be high (same words) but not perfect (different order)
    expect(score).toBeGreaterThan(0.5);
    expect(score).toBeLessThan(1.0);
  });
});

describe("stripLeadingIstiadha", () => {
  it("strips exact istiadha prefix", () => {
    const input = "اعوذ بالله من الشيطان الرجيم بسم الله";
    const result = stripLeadingIstiadha(input);
    expect(result).toBe("بسم الله");
  });

  it("strips extended istiadha variant", () => {
    const input = "اعوذ بالله السميع العليم من الشيطان الرجيم بسم الله";
    const result = stripLeadingIstiadha(input);
    expect(result).toBe("بسم الله");
  });

  it("returns empty when input is only istiadha", () => {
    const result = stripLeadingIstiadha(ISTIADHA_MATCH_TEXTS[0]);
    expect(result).toBe("");
  });

  it("returns input unchanged when no istiadha prefix", () => {
    const input = "بسم الله الرحمن الرحيم";
    const result = stripLeadingIstiadha(input);
    expect(result).toBe(input);
  });

  it("strips fuzzy istiadha where one word is garbled", () => {
    // Simulating a Whisper garble: "الشيطان" misrecognized as "الشطان"
    const garbled = "اعوذ بالله من الشطان الرجيم بسم الله";
    const result = stripLeadingIstiadha(garbled);
    expect(result).toBe("بسم الله");
  });
});

describe("stripLeadingBasmala", () => {
  it("strips exact basmala prefix", () => {
    const input = "بسم الله الرحمن الرحيم الحمد لله";
    const result = stripLeadingBasmala(input);
    expect(result).toBe("الحمد لله");
  });

  it("returns empty when input is only basmala", () => {
    const result = stripLeadingBasmala(BASMALA_MATCH_TEXT);
    expect(result).toBe("");
  });

  it("returns input unchanged when no basmala prefix", () => {
    const input = "الحمد لله رب العالمين";
    const result = stripLeadingBasmala(input);
    expect(result).toBe(input);
  });
});

describe("stripLeadingAmeen", () => {
  it("strips exact ameen prefix", () => {
    const input = "امين بسم الله";
    const result = stripLeadingAmeen(input);
    expect(result).toBe("بسم الله");
  });

  it("returns input unchanged when no ameen prefix (single word, no fuzzy)", () => {
    const input = "بسم الله";
    const result = stripLeadingAmeen(input);
    expect(result).toBe(input);
  });
});

describe("hasLeadingIstiadha", () => {
  it("detects istiadha in diacritized text", () => {
    const text = "أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ بِسْمِ اللَّهِ";
    expect(hasLeadingIstiadha(text)).toBe(true);
  });

  it("returns false for text without istiadha", () => {
    expect(hasLeadingIstiadha("بسم الله الرحمن الرحيم")).toBe(false);
  });
});

describe("hasLeadingBasmala", () => {
  it("detects basmala in diacritized text", () => {
    const text = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ الحمد لله";
    expect(hasLeadingBasmala(text)).toBe(true);
  });

  it("returns false for text without basmala", () => {
    expect(hasLeadingBasmala("الحمد لله رب العالمين")).toBe(false);
  });
});

describe("hasLeadingAmeen", () => {
  it("detects ameen", () => {
    expect(hasLeadingAmeen("آمِين بسم الله")).toBe(true);
  });

  it("returns false without ameen", () => {
    expect(hasLeadingAmeen("بسم الله")).toBe(false);
  });
});

describe("hasLikelyLeadingFatiha", () => {
  it("detects fatiha text", () => {
    const fatihaText = [
      "بسم الله الرحمن الرحيم",
      "الحمد لله رب العالمين",
      "الرحمن الرحيم",
      "مالك يوم الدين",
      "اياك نعبد واياك نستعين",
      "اهدنا الصراط المستقيم",
      "صراط الذين انعمت عليهم غير المغضوب عليهم ولا الضالين",
    ].join(" ");
    expect(hasLikelyLeadingFatiha(fatihaText)).toBe(true);
  });

  it("returns false for non-fatiha text", () => {
    expect(hasLikelyLeadingFatiha("قل هو الله احد الله الصمد")).toBe(false);
  });

  it("returns false for empty text", () => {
    expect(hasLikelyLeadingFatiha("")).toBe(false);
  });
});

describe("stripLeadingFatiha", () => {
  it("strips fatiha text and returns remainder", () => {
    const fatihaWithMore = FATIHA_MATCH_TEXT + " قل هو الله احد";
    const result = stripLeadingFatiha(fatihaWithMore);
    expect(result).toBe("قل هو الله احد");
  });

  it("returns empty when input is exactly fatiha", () => {
    expect(stripLeadingFatiha(FATIHA_MATCH_TEXT)).toBe("");
  });
});
