import type {
  Ayah,
  AyahTimingSegment,
  Subtitle,
  SubtitleFormatting,
  TranslationAyah,
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

  if (
    options.detectedTimings &&
    options.detectedTimings.length > 0 &&
    options.detectedTimings.length >= ayahRange.length
  ) {
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

  const arabicChunks = splitWordsIntoChunks(arabicWords, maxWordsPerChunk);
  const chunkWordCounts = arabicChunks.map((chunk) => chunk.length);
  const translationChunks = splitTranslationIntoAlignedChunks(
    subtitle.translation,
    chunkWordCounts
  );
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
