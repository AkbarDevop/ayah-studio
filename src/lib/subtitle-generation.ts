import type {
  Ayah,
  AyahTimingSegment,
  Subtitle,
  TranslationAyah,
} from "@/types";

export function buildSubtitlesFromAyahRange(
  ayahRange: Ayah[],
  translations: TranslationAyah[],
  options: {
    detectedTimings?: AyahTimingSegment[];
    clipDuration?: number;
    fallbackDuration: number;
  }
): Subtitle[] {
  if (ayahRange.length === 0) {
    return [];
  }

  if (options.detectedTimings?.length === ayahRange.length) {
    const timingByAyah = new Map(
      options.detectedTimings.map((timing) => [timing.ayahNum, timing])
    );

    return ayahRange.map((ayah, index) => {
      const translation = translations.find(
        (item) => item.numberInSurah === ayah.numberInSurah
      );
      const timing = timingByAyah.get(ayah.numberInSurah);

      return {
        ayahNum: ayah.numberInSurah,
        arabic: ayah.text,
        translation: translation?.text ?? "",
        start: timing?.start ?? 0,
        end: timing?.end ?? options.fallbackDuration * (index + 1),
      };
    });
  }

  const clipDuration = options.clipDuration ?? 0;

  if (clipDuration > 0) {
    const weights = ayahRange.map((ayah) =>
      Math.max(countTimingUnits(ayah.text), 1)
    );
    const totalWeight = weights.reduce((sum, value) => sum + value, 0);
    let consumedWeight = 0;

    return ayahRange.map((ayah, index) => {
      const translation = translations.find(
        (item) => item.numberInSurah === ayah.numberInSurah
      );
      const start = (consumedWeight / totalWeight) * clipDuration;
      consumedWeight += weights[index];
      const end =
        index === ayahRange.length - 1
          ? clipDuration
          : (consumedWeight / totalWeight) * clipDuration;

      return {
        ayahNum: ayah.numberInSurah,
        arabic: ayah.text,
        translation: translation?.text ?? "",
        start,
        end,
      };
    });
  }

  let offset = 0;
  const gap = 0.5;

  return ayahRange.map((ayah) => {
    const translation = translations.find(
      (item) => item.numberInSurah === ayah.numberInSurah
    );
    const subtitle: Subtitle = {
      ayahNum: ayah.numberInSurah,
      arabic: ayah.text,
      translation: translation?.text ?? "",
      start: offset,
      end: offset + options.fallbackDuration,
    };

    offset += options.fallbackDuration + gap;
    return subtitle;
  });
}

function countTimingUnits(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
