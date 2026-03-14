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

/**
 * Normalize all subtitles and fix overlaps between consecutive entries.
 * If subtitle B starts before subtitle A ends, clamp A's end to B's start
 * (preserving a minimum duration for A).
 */
export function normalizeSubtitleTimings(subtitles: Subtitle[]): Subtitle[] {
  const normalized = subtitles.map(normalizeSubtitleTiming);

  for (let i = 0; i < normalized.length - 1; i += 1) {
    const current = normalized[i];
    const next = normalized[i + 1];

    if (current.end > next.start) {
      // Resolve overlap: clamp current end to next start, but ensure minimum duration
      const clampedEnd = Math.max(
        current.start + MIN_SUBTITLE_DURATION_SECONDS,
        next.start
      );
      normalized[i] = {
        ...current,
        end: roundTiming(clampedEnd),
      };

      // If clamping still leaves overlap (because next.start < current.start + min),
      // push next's start forward
      if (clampedEnd > next.start) {
        normalized[i + 1] = {
          ...next,
          start: roundTiming(clampedEnd),
          end: roundTiming(Math.max(clampedEnd + MIN_SUBTITLE_DURATION_SECONDS, next.end)),
        };
      }
    }
  }

  return normalized;
}

function sanitizeFiniteNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function roundTiming(value: number) {
  return Math.round(value * 1000) / 1000;
}
