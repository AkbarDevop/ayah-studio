import type { Subtitle } from "@/types";

const MIN_SUBTITLE_DURATION_SECONDS = 0.1;

export function normalizeSubtitleTiming(subtitle: Subtitle): Subtitle {
  const start = sanitizeFiniteNumber(subtitle.start);
  const end = sanitizeFiniteNumber(subtitle.end);
  const safeStart = Math.max(0, start);
  const safeEnd = Math.max(
    safeStart + MIN_SUBTITLE_DURATION_SECONDS,
    end
  );

  return {
    ...subtitle,
    start: roundTiming(safeStart),
    end: roundTiming(safeEnd),
  };
}

export function normalizeSubtitleTimings(subtitles: Subtitle[]): Subtitle[] {
  return subtitles.map(normalizeSubtitleTiming);
}

function sanitizeFiniteNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function roundTiming(value: number) {
  return Math.round(value * 1000) / 1000;
}
