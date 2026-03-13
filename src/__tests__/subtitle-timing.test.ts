import { describe, it, expect } from "vitest";
import {
  normalizeSubtitleTiming,
  normalizeSubtitleTimings,
} from "@/lib/subtitle-timing";
import type { Subtitle } from "@/types";

function makeSub(start: number, end: number): Subtitle {
  return {
    ayahNum: 1,
    arabic: "test",
    translation: "test",
    start,
    end,
  };
}

describe("normalizeSubtitleTiming", () => {
  it("passes through valid timing unchanged", () => {
    const sub = makeSub(2, 8);
    const result = normalizeSubtitleTiming(sub);
    expect(result.start).toBe(2);
    expect(result.end).toBe(8);
  });

  it("clamps negative start to 0", () => {
    const result = normalizeSubtitleTiming(makeSub(-3, 5));
    expect(result.start).toBe(0);
    expect(result.end).toBe(5);
  });

  it("enforces minimum duration when end <= start", () => {
    const result = normalizeSubtitleTiming(makeSub(5, 3));
    expect(result.start).toBe(5);
    expect(result.end).toBeGreaterThan(5);
  });

  it("enforces minimum duration when end equals start", () => {
    const result = normalizeSubtitleTiming(makeSub(5, 5));
    expect(result.end).toBeGreaterThan(result.start);
  });

  it("handles NaN values gracefully", () => {
    const result = normalizeSubtitleTiming(makeSub(NaN, NaN));
    expect(Number.isFinite(result.start)).toBe(true);
    expect(Number.isFinite(result.end)).toBe(true);
    expect(result.end).toBeGreaterThan(result.start);
  });

  it("handles Infinity values", () => {
    const result = normalizeSubtitleTiming(makeSub(Infinity, -Infinity));
    expect(Number.isFinite(result.start)).toBe(true);
    expect(Number.isFinite(result.end)).toBe(true);
  });

  it("rounds to millisecond precision", () => {
    const result = normalizeSubtitleTiming(makeSub(1.23456789, 5.98765432));
    const startDecimals = result.start.toString().split(".")[1]?.length ?? 0;
    const endDecimals = result.end.toString().split(".")[1]?.length ?? 0;
    expect(startDecimals).toBeLessThanOrEqual(3);
    expect(endDecimals).toBeLessThanOrEqual(3);
  });

  it("preserves non-timing fields", () => {
    const sub: Subtitle = {
      ayahNum: 42,
      label: "Al-Baqarah 42",
      arabic: "some arabic",
      translation: "some translation",
      start: 1,
      end: 5,
    };
    const result = normalizeSubtitleTiming(sub);
    expect(result.ayahNum).toBe(42);
    expect(result.label).toBe("Al-Baqarah 42");
    expect(result.arabic).toBe("some arabic");
    expect(result.translation).toBe("some translation");
  });
});

describe("normalizeSubtitleTimings", () => {
  it("normalizes all subtitles in array", () => {
    const results = normalizeSubtitleTimings([
      makeSub(-1, 5),
      makeSub(5, 3),
      makeSub(NaN, 10),
    ]);
    expect(results).toHaveLength(3);
    results.forEach((sub) => {
      expect(Number.isFinite(sub.start)).toBe(true);
      expect(Number.isFinite(sub.end)).toBe(true);
      expect(sub.end).toBeGreaterThan(sub.start);
    });
  });

  it("returns empty array for empty input", () => {
    expect(normalizeSubtitleTimings([])).toEqual([]);
  });
});
