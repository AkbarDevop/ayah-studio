import type {
  Ayah,
  AyahTimingSegment,
  Subtitle,
  SubtitleFormatting,
  TranslationAyah,
  WordTiming,
} from "@/types";
import { DEFAULT_SUBTITLE_FORMATTING } from "./subtitle-formatting";

export function buildSubtitlesFromAyahRange(
  ayahRange: Ayah[],
  translations: TranslationAyah[],
  options: {
    surahLabel?: string;
    timeOffset?: number;
    detectedTimings?: AyahTimingSegment[];
    clipDuration?: number;
    fallbackDuration: number;
    formatting?: SubtitleFormatting;
    leadingSubtitles?: Subtitle[];
  }
): Subtitle[] {
  const formatting = options.formatting ?? DEFAULT_SUBTITLE_FORMATTING;
  const timeOffset = options.timeOffset ?? 0;
  const translationsByAyah = new Map(
    translations.map((translation) => [translation.numberInSurah, translation])
  );
  const prefixSubtitles =
    options.leadingSubtitles?.map((subtitle) => ({
      ...subtitle,
      chunkIndex: 1,
      chunkCount: 1,
    })) ?? [];

  if (ayahRange.length === 0) {
    return prefixSubtitles;
  }

  if (options.detectedTimings?.length === ayahRange.length) {
    const timingByAyah = new Map(
      options.detectedTimings.map((timing) => [timing.ayahNum, timing])
    );

    return [
      ...prefixSubtitles,
      ...expandSubtitlesForFormatting(
        ayahRange.map((ayah, index) => {
        const translation = translationsByAyah.get(ayah.numberInSurah);
        const timing = timingByAyah.get(ayah.numberInSurah);

        return {
          ayahNum: ayah.numberInSurah,
          label: formatAyahLabel(options.surahLabel, ayah.numberInSurah),
          arabic: ayah.text,
          translation: translation?.text ?? "",
          start: (timing?.start ?? 0) + timeOffset,
          end: (timing?.end ?? options.fallbackDuration * (index + 1)) + timeOffset,
        };
      }),
      formatting
      ),
    ];
  }

  const clipDuration = options.clipDuration ?? 0;

  if (clipDuration > 0) {
    const weights = ayahRange.map((ayah) =>
      Math.max(countTimingUnits(ayah.text), 1)
    );
    const totalWeight = weights.reduce((sum, value) => sum + value, 0);
    let consumedWeight = 0;

    return [
      ...prefixSubtitles,
      ...expandSubtitlesForFormatting(
        ayahRange.map((ayah, index) => {
        const translation = translationsByAyah.get(ayah.numberInSurah);
        const start = (consumedWeight / totalWeight) * clipDuration;
        consumedWeight += weights[index];
        const end =
          index === ayahRange.length - 1
            ? clipDuration
            : (consumedWeight / totalWeight) * clipDuration;

        return {
          ayahNum: ayah.numberInSurah,
          label: formatAyahLabel(options.surahLabel, ayah.numberInSurah),
          arabic: ayah.text,
          translation: translation?.text ?? "",
          start: start + timeOffset,
          end: end + timeOffset,
        };
      }),
      formatting
      ),
    ];
  }

  let offset = 0;
  const gap = 0.5;

  return [
    ...prefixSubtitles,
    ...expandSubtitlesForFormatting(
      ayahRange.map((ayah) => {
      const translation = translationsByAyah.get(ayah.numberInSurah);
      const subtitle: Subtitle = {
        ayahNum: ayah.numberInSurah,
        label: formatAyahLabel(options.surahLabel, ayah.numberInSurah),
        arabic: ayah.text,
        translation: translation?.text ?? "",
        start: offset + timeOffset,
        end: offset + options.fallbackDuration + timeOffset,
      };

      offset += options.fallbackDuration + gap;
      return subtitle;
    }),
    formatting
    ),
  ];
}

function expandSubtitlesForFormatting(
  subtitles: Subtitle[],
  formatting: SubtitleFormatting
) {
  return subtitles.flatMap((subtitle) =>
    splitSubtitleIntoChunks(subtitle, formatting)
  );
}

function splitSubtitleIntoChunks(
  subtitle: Subtitle,
  formatting: SubtitleFormatting
) {
  if (!formatting.splitLongAyahs) {
    return [{ ...subtitle, chunkIndex: 1, chunkCount: 1 }];
  }

  const arabicWords = tokenizeWords(subtitle.arabic);
  const maxWordsPerChunk = Math.max(4, Math.floor(formatting.maxWordsPerChunk));

  if (arabicWords.length <= maxWordsPerChunk) {
    return [{ ...subtitle, chunkIndex: 1, chunkCount: 1 }];
  }

  // Smart split: use word timings to find breath pauses if available
  const wordTimings = subtitle.wordTimings;
  const arabicChunks =
    wordTimings && wordTimings.length >= arabicWords.length * 0.5
      ? splitByBreathPauses(arabicWords, wordTimings, maxWordsPerChunk)
      : splitWordsIntoChunks(arabicWords, maxWordsPerChunk);

  const chunkWordCounts = arabicChunks.map((chunk) => chunk.length);
  const translationChunks = splitTranslationIntoAlignedChunks(
    subtitle.translation,
    chunkWordCounts
  );

  // Use word timings for precise chunk timing if available
  if (wordTimings && wordTimings.length > 0) {
    return buildTimedChunks(subtitle, arabicChunks, translationChunks, wordTimings);
  }

  // Fallback: proportional timing by word count
  const totalWords = chunkWordCounts.reduce((sum, count) => sum + count, 0);
  const totalDuration = Math.max(subtitle.end - subtitle.start, 0.1);

  let start = subtitle.start;

  return arabicChunks.map((chunkWords, index) => {
    const durationRatio = chunkWordCounts[index] / totalWords;
    const end =
      index === arabicChunks.length - 1
        ? subtitle.end
        : start + totalDuration * durationRatio;
    const nextSubtitle: Subtitle = {
      ayahNum: subtitle.ayahNum,
      label: subtitle.label,
      arabic: chunkWords.join(" "),
      translation: translationChunks[index] ?? "",
      start,
      end,
      chunkIndex: index + 1,
      chunkCount: arabicChunks.length,
    };

    start = end;
    return nextSubtitle;
  });
}

/**
 * Split at natural breath pauses detected from word-level timestamps.
 * A pause > 300ms between words indicates the reciter took a breath.
 * Falls back to punctuation-based splitting if no pauses found.
 */
function splitByBreathPauses(
  arabicWords: string[],
  wordTimings: WordTiming[],
  maxWordsPerChunk: number
): string[][] {
  const BREATH_PAUSE_THRESHOLD = 0.2; // 200ms = breath pause (reciters pause briefly between phrases)
  const MIN_CHUNK_WORDS = 2;

  // Find all pause points (gaps between consecutive words)
  const pausePoints: { index: number; gap: number }[] = [];
  for (let i = 1; i < wordTimings.length; i++) {
    const gap = wordTimings[i].start - wordTimings[i - 1].end;
    if (gap >= BREATH_PAUSE_THRESHOLD) {
      pausePoints.push({ index: i, gap });
    }
  }

  // If no breath pauses found, fall back to word-count splitting
  if (pausePoints.length === 0) {
    return splitWordsIntoChunks(arabicWords, maxWordsPerChunk);
  }

  // Build chunks using pause points as split boundaries
  // Only split if the chunk would exceed maxWordsPerChunk
  const chunks: string[][] = [];
  let chunkStart = 0;

  // Sort pauses by gap size (longest first) so we prefer bigger pauses
  const sortedPauses = [...pausePoints].sort((a, b) => b.gap - a.gap);

  // Greedily split: walk through words, split at the best pause point
  // when we're approaching maxWordsPerChunk
  const splitIndices = new Set<number>();
  for (const pause of sortedPauses) {
    splitIndices.add(pause.index);
  }

  // Walk through and build chunks
  const orderedSplits = [...splitIndices].sort((a, b) => a - b);
  for (const splitIdx of orderedSplits) {
    // Map timing index to Arabic word index (they may not align 1:1)
    const wordIdx = Math.min(splitIdx, arabicWords.length);
    const currentChunkSize = wordIdx - chunkStart;

    // Only split if both resulting chunks are big enough
    if (currentChunkSize >= MIN_CHUNK_WORDS) {
      chunks.push(arabicWords.slice(chunkStart, wordIdx));
      chunkStart = wordIdx;
    }
  }

  // Add the remaining words
  if (chunkStart < arabicWords.length) {
    chunks.push(arabicWords.slice(chunkStart));
  }

  // If any chunk is still too long, sub-split it with the word-count method
  return chunks.flatMap((chunk) =>
    chunk.length > maxWordsPerChunk
      ? splitWordsIntoChunks(chunk, maxWordsPerChunk)
      : [chunk]
  );
}

/**
 * Build subtitle chunks with precise timing from word timestamps.
 * Each chunk's start/end aligns exactly with when those words are spoken.
 */
function buildTimedChunks(
  subtitle: Subtitle,
  arabicChunks: string[][],
  translationChunks: string[],
  wordTimings: WordTiming[]
): Subtitle[] {
  let wordOffset = 0;

  return arabicChunks.map((chunkWords, index) => {
    const chunkTimings = wordTimings.slice(wordOffset, wordOffset + chunkWords.length);
    wordOffset += chunkWords.length;

    // Use word timestamps for precise timing, fall back to proportional
    const chunkStart =
      chunkTimings.length > 0
        ? chunkTimings[0].start
        : subtitle.start;
    const chunkEnd =
      index === arabicChunks.length - 1
        ? subtitle.end
        : chunkTimings.length > 0
          ? chunkTimings[chunkTimings.length - 1].end
          : subtitle.end;

    return {
      ayahNum: subtitle.ayahNum,
      label: subtitle.label,
      arabic: chunkWords.join(" "),
      translation: translationChunks[index] ?? "",
      start: Math.max(chunkStart, subtitle.start),
      end: Math.min(chunkEnd, subtitle.end),
      chunkIndex: index + 1,
      chunkCount: arabicChunks.length,
      wordTimings: chunkTimings,
    };
  });
}

function splitWordsIntoChunks(words: string[], maxWordsPerChunk: number) {
  const chunks: string[][] = [];
  let start = 0;
  const minimumPreferredBreak = Math.max(1, Math.floor(maxWordsPerChunk * 0.6));

  while (start < words.length) {
    let end = Math.min(start + maxWordsPerChunk, words.length);

    if (end < words.length) {
      const preferredBreak = findPreferredBreakIndex(
        words,
        start,
        end,
        minimumPreferredBreak
      );
      if (preferredBreak > start) {
        end = preferredBreak;
      }
    }

    chunks.push(words.slice(start, end));
    start = end;
  }

  return chunks;
}

function findPreferredBreakIndex(
  words: string[],
  start: number,
  end: number,
  minimumPreferredBreak: number
) {
  for (let index = end; index > start + minimumPreferredBreak; index -= 1) {
    if (/[،؛.!?؟:]$/.test(words[index - 1])) {
      return index;
    }
  }

  return end;
}

function splitTranslationIntoAlignedChunks(
  translation: string,
  chunkWordCounts: number[]
) {
  const words = tokenizeWords(translation);
  if (words.length === 0) {
    return chunkWordCounts.map(() => "");
  }

  const totalWeight = chunkWordCounts.reduce((sum, count) => sum + count, 0);
  const remainingChunkWeights = [...chunkWordCounts];
  const chunks: string[] = [];
  let start = 0;
  let remainingWords = words.length;

  for (let index = 0; index < chunkWordCounts.length; index += 1) {
    const weight = remainingChunkWeights[index];
    const remainingChunkCount = chunkWordCounts.length - index - 1;

    if (index === chunkWordCounts.length - 1) {
      chunks.push(words.slice(start).join(" "));
      break;
    }

    const targetWords = Math.max(
      1,
      Math.round((weight / totalWeight) * words.length)
    );
    const maxSliceLength = remainingWords - remainingChunkCount;
    const sliceLength = Math.max(1, Math.min(targetWords, maxSliceLength));
    const end = start + sliceLength;
    chunks.push(words.slice(start, end).join(" "));
    start = end;
    remainingWords = words.length - start;
  }

  return chunks;
}

function countTimingUnits(text: string): number {
  return tokenizeWords(text).length;
}

function formatAyahLabel(surahLabel: string | undefined, ayahNumber: number) {
  return surahLabel ? `${surahLabel} ${ayahNumber}` : `Ayah ${ayahNumber}`;
}

function tokenizeWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean);
}
