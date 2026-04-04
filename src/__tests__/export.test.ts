import { describe, it, expect } from "vitest";
import { generateSRT, generateASS, generateJSON } from "@/lib/export";
import type { Subtitle } from "@/types";

const SAMPLE_SUBTITLES: Subtitle[] = [
  {
    ayahNum: 1,
    arabic: "\u0628\u0650\u0633\u0652\u0645\u0650 \u0671\u0644\u0644\u0651\u064E\u0647\u0650",
    translation: "In the name of God",
    start: 0,
    end: 5,
  },
  {
    ayahNum: 2,
    arabic: "\u0671\u0644\u0652\u062D\u064E\u0645\u0652\u062F\u064F \u0644\u0650\u0644\u0651\u064E\u0647\u0650",
    translation: "Praise be to God",
    start: 5.5,
    end: 10,
  },
];

describe("generateSRT", () => {
  it("generates valid SRT output", () => {
    const srt = generateSRT(SAMPLE_SUBTITLES);
    expect(srt).toContain("1\n00:00:00,000 --> 00:00:05,000");
    expect(srt).toContain("2\n00:00:05,500 --> 00:00:10,000");
    expect(srt).toContain("In the name of God");
    expect(srt).toContain("Praise be to God");
  });

  it("returns empty string for empty array", () => {
    expect(generateSRT([])).toBe("");
  });

  it("handles subtitles over 1 hour", () => {
    const srt = generateSRT([
      { ayahNum: 1, arabic: "a", translation: "b", start: 3661.5, end: 3665 },
    ]);
    expect(srt).toContain("01:01:01,500 --> 01:01:05,000");
  });
});

describe("generateASS", () => {
  it("generates valid ASS with Script Info header", () => {
    const ass = generateASS(
      SAMPLE_SUBTITLES,
      "classic",
      { x: 0.5, y: 0.78 },
      "landscape"
    );
    expect(ass).toContain("[Script Info]");
    expect(ass).toContain("PlayResX: 1920");
    expect(ass).toContain("PlayResY: 1080");
    expect(ass).toContain("[V4+ Styles]");
    expect(ass).toContain("[Events]");
  });

  it("uses BGR byte order for colors", () => {
    const ass = generateASS(
      SAMPLE_SUBTITLES,
      "classic",
      { x: 0.5, y: 0.78 },
      "landscape"
    );
    // Classic gold is #D4A853 → BGR should be &H0053A8D4
    expect(ass).toContain("&H0053A8D4");
    // Should NOT contain the RGB order
    expect(ass).not.toContain("&H00D4A853");
  });

  it("respects portrait resolution", () => {
    const ass = generateASS(
      SAMPLE_SUBTITLES,
      "classic",
      { x: 0.5, y: 0.5 },
      "portrait"
    );
    expect(ass).toContain("PlayResX: 1080");
    expect(ass).toContain("PlayResY: 1920");
  });

  it("respects square resolution", () => {
    const ass = generateASS(
      SAMPLE_SUBTITLES,
      "classic",
      { x: 0.5, y: 0.5 },
      "square"
    );
    expect(ass).toContain("PlayResX: 1080");
    expect(ass).toContain("PlayResY: 1080");
  });

  it("escapes ASS special characters in text", () => {
    const subs: Subtitle[] = [
      {
        ayahNum: 1,
        arabic: "text with {curly} and \\backslash",
        translation: "line1\nline2",
        start: 0,
        end: 5,
      },
    ];
    const ass = generateASS(
      subs,
      "classic",
      { x: 0.5, y: 0.5 },
      "landscape"
    );
    expect(ass).toContain("\\{curly\\}");
    expect(ass).toContain("\\N");
  });

  it("clamps placement within safe zone", () => {
    const ass = generateASS(
      SAMPLE_SUBTITLES,
      "classic",
      { x: 0, y: 1 },
      "landscape"
    );
    // x=0 clamped to 0.12 → 0.12 * 1920 = 230
    expect(ass).toContain("\\pos(230,");
  });
});

describe("generateJSON", () => {
  it("returns valid JSON", () => {
    const json = generateJSON(SAMPLE_SUBTITLES);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].ayahNum).toBe(1);
    expect(parsed[1].ayahNum).toBe(2);
  });

  it("preserves timing values", () => {
    const json = generateJSON(SAMPLE_SUBTITLES);
    const parsed = JSON.parse(json);
    expect(parsed[0].start).toBe(0);
    expect(parsed[0].end).toBe(5);
  });
});
