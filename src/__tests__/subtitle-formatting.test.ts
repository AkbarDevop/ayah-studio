import { describe, it, expect } from "vitest";
import {
  DEFAULT_SUBTITLE_FORMATTING,
  getArabicFontAssName,
  getTranslationFontAssName,
  getArabicFontCss,
  getTranslationFontCss,
  resolveSubtitleColors,
  applyOpacityToColor,
} from "@/lib/subtitle-formatting";

describe("DEFAULT_SUBTITLE_FORMATTING", () => {
  it("has sensible defaults", () => {
    expect(DEFAULT_SUBTITLE_FORMATTING.arabicFontFamily).toBe("amiri");
    expect(DEFAULT_SUBTITLE_FORMATTING.translationFontFamily).toBe("ui");
    expect(DEFAULT_SUBTITLE_FORMATTING.arabicFontSize).toBeGreaterThan(0);
    expect(DEFAULT_SUBTITLE_FORMATTING.translationFontSize).toBeGreaterThan(0);
    expect(DEFAULT_SUBTITLE_FORMATTING.backgroundOpacity).toBe(100);
    expect(DEFAULT_SUBTITLE_FORMATTING.splitLongAyahs).toBe(true);
    expect(DEFAULT_SUBTITLE_FORMATTING.maxWordsPerChunk).toBeGreaterThanOrEqual(4);
  });
});

describe("getArabicFontAssName", () => {
  it("returns Amiri for amiri", () => {
    expect(getArabicFontAssName("amiri")).toBe("Amiri");
  });

  it("returns Noto Naskh Arabic for naskh", () => {
    expect(getArabicFontAssName("naskh")).toBe("Noto Naskh Arabic");
  });
});

describe("getTranslationFontAssName", () => {
  it("returns Manrope for ui", () => {
    expect(getTranslationFontAssName("ui")).toBe("Manrope");
  });

  it("returns IBM Plex Mono for mono", () => {
    expect(getTranslationFontAssName("mono")).toBe("IBM Plex Mono");
  });
});

describe("getArabicFontCss", () => {
  it("returns amiri css for amiri", () => {
    expect(getArabicFontCss("amiri")).toContain("amiri");
  });

  it("returns naskh css for naskh", () => {
    expect(getArabicFontCss("naskh")).toContain("arabic");
  });
});

describe("getTranslationFontCss", () => {
  it("returns sans-serif for ui", () => {
    expect(getTranslationFontCss("ui")).toContain("sans-serif");
  });

  it("returns monospace for mono", () => {
    expect(getTranslationFontCss("mono")).toContain("monospace");
  });
});

describe("resolveSubtitleColors", () => {
  it("uses style colors when no overrides", () => {
    const colors = resolveSubtitleColors("classic", DEFAULT_SUBTITLE_FORMATTING);
    expect(colors.arabicColor).toBe("#D4A853");
    expect(colors.translationColor).toBe("#E8E4DC");
  });

  it("uses overrides when provided", () => {
    const colors = resolveSubtitleColors("classic", {
      ...DEFAULT_SUBTITLE_FORMATTING,
      arabicColorOverride: "#FF0000",
      translationColorOverride: "#00FF00",
    });
    expect(colors.arabicColor).toBe("#FF0000");
    expect(colors.translationColor).toBe("#00FF00");
  });

  it("falls back to first style for unknown styleId", () => {
    const colors = resolveSubtitleColors("nonexistent", DEFAULT_SUBTITLE_FORMATTING);
    expect(colors.arabicColor).toBeDefined();
    expect(colors.translationColor).toBeDefined();
  });
});

describe("applyOpacityToColor", () => {
  it("returns transparent for transparent input", () => {
    expect(applyOpacityToColor("transparent", 50)).toBe("transparent");
  });

  it("converts hex color to rgba with opacity", () => {
    const result = applyOpacityToColor("#FF0000", 50);
    expect(result).toMatch(/^rgba\(255,\s*0,\s*0,\s*0\.5\)$/);
  });

  it("applies 100% opacity to hex as full alpha", () => {
    const result = applyOpacityToColor("#FF0000", 100);
    expect(result).toMatch(/^rgba\(255,\s*0,\s*0,\s*1\)$/);
  });

  it("applies 0% opacity as zero alpha", () => {
    const result = applyOpacityToColor("#FF0000", 0);
    expect(result).toMatch(/^rgba\(255,\s*0,\s*0,\s*0\)$/);
  });

  it("handles rgba input with existing alpha", () => {
    const result = applyOpacityToColor("rgba(0, 0, 0, 0.7)", 50);
    expect(result).toContain("rgba(");
    // 0.7 * 0.5 = 0.35
    expect(result).toContain("0.35");
  });

  it("returns original for unknown format", () => {
    expect(applyOpacityToColor("red", 50)).toBe("red");
  });
});
