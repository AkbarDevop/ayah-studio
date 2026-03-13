import { QURAN_API } from "./constants";
import type { AyahDetectionMatch } from "@/types";

interface QuranCorpusResponse {
  code: number;
  status: string;
  data: {
    surahs: Array<{
      number: number;
      name: string;
      englishName: string;
      ayahs: Array<{
        numberInSurah: number;
        text: string;
      }>;
    }>;
  };
}

interface NormalizedAyah {
  numberInSurah: number;
  text: string;
  normalizedText: string;
  wordCount: number;
}

interface NormalizedSurah {
  number: number;
  name: string;
  englishName: string;
  ayahs: NormalizedAyah[];
}

export interface AyahRangeMetadata {
  surahNumber: number;
  surahName: string;
  surahArabicName: string;
  ayahs: Array<{
    numberInSurah: number;
    text: string;
    wordCount: number;
  }>;
}

const DIACRITICS_REGEX = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D4-\u08FF]/g;
const NON_ARABIC_REGEX = /[^ء-ي0-9\s]/g;
export const BASMALA_MATCH_TEXT = "بسم الله الرحمن الرحيم";
export const BASMALA_DISPLAY_TEXT = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ";

let quranCorpusPromise: Promise<NormalizedSurah[]> | null = null;

export async function detectAyahRangesFromTranscript(
  transcript: string,
  limit = 3
): Promise<AyahDetectionMatch[]> {
  const transcriptVariants = buildMatchingTextVariants(transcript);
  if (transcriptVariants.length === 0) {
    return [];
  }

  const transcriptTokenCount = Math.max(
    ...transcriptVariants.map((variant) => variant.tokenCount)
  );
  if (transcriptTokenCount < 2) {
    return [];
  }

  const corpus = await loadQuranCorpus();
  const maxWindowSize = getMaxWindowSize(transcriptTokenCount);

  const candidates: AyahDetectionMatch[] = [];

  for (const surah of corpus) {
    for (let startIndex = 0; startIndex < surah.ayahs.length; startIndex += 1) {
      let combinedNormalized = "";
      let combinedOriginal = "";
      let combinedWordCount = 0;

      for (
        let windowSize = 1;
        windowSize <= maxWindowSize &&
        startIndex + windowSize <= surah.ayahs.length;
        windowSize += 1
      ) {
        const ayah = surah.ayahs[startIndex + windowSize - 1];
        combinedNormalized = joinText(combinedNormalized, ayah.normalizedText);
        combinedOriginal = joinText(combinedOriginal, ayah.text);
        combinedWordCount += ayah.wordCount;

        const score = scoreCandidateAgainstTranscriptVariants(
          transcriptVariants,
          combinedNormalized,
          combinedWordCount
        );

        if (score < 0.38) {
          continue;
        }

        candidates.push({
          surahNumber: surah.number,
          surahName: surah.englishName,
          surahArabicName: surah.name,
          startAyah: surah.ayahs[startIndex].numberInSurah,
          endAyah: ayah.numberInSurah,
          score,
          matchedText: combinedOriginal,
        });
      }
    }
  }

  return candidates
    .sort((a, b) => b.score - a.score)
    .filter(
      (candidate, index, list) =>
        list.findIndex(
          (other) =>
            other.surahNumber === candidate.surahNumber &&
            other.startAyah === candidate.startAyah &&
            other.endAyah === candidate.endAyah
        ) === index
    )
    .slice(0, limit);
}

export function normalizeArabicText(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/\uFEFF/g, "")
    .replace(DIACRITICS_REGEX, "")
    .replace(/[ٱأإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ـ/g, "")
    .replace(NON_ARABIC_REGEX, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function scoreArabicTextSimilarity(left: string, right: string): number {
  const leftVariants = buildMatchingTextVariants(left);
  const rightVariants = buildMatchingTextVariants(right);
  let bestScore = 0;

  for (const leftVariant of leftVariants) {
    for (const rightVariant of rightVariants) {
      bestScore = Math.max(
        bestScore,
        scoreMatch(
          leftVariant.normalizedText,
          rightVariant.normalizedText,
          leftVariant.tokens,
          leftVariant.bigrams
        )
      );
    }
  }

  return bestScore;
}

export async function getAyahRangeMetadata(
  surahNumber: number,
  startAyah: number,
  endAyah: number
): Promise<AyahRangeMetadata | null> {
  const corpus = await loadQuranCorpus();
  const surah = corpus.find((entry) => entry.number === surahNumber);

  if (!surah) {
    return null;
  }

  const ayahRange = surah.ayahs.filter(
    (ayah) =>
      ayah.numberInSurah >= startAyah && ayah.numberInSurah <= endAyah
  );

  if (ayahRange.length === 0) {
    return null;
  }

  return {
    surahNumber: surah.number,
    surahName: surah.englishName,
    surahArabicName: surah.name,
    ayahs: ayahRange.map((ayah) => ({
      numberInSurah: ayah.numberInSurah,
      text: ayah.text,
      wordCount: ayah.wordCount,
    })),
  };
}

async function loadQuranCorpus(): Promise<NormalizedSurah[]> {
  if (!quranCorpusPromise) {
    quranCorpusPromise = fetchQuranCorpus().catch((error) => {
      quranCorpusPromise = null;
      throw error;
    });
  }

  return quranCorpusPromise;
}

async function fetchQuranCorpus(): Promise<NormalizedSurah[]> {
  const response = await fetch(`${QURAN_API}/quran/quran-uthmani`, {
    cache: "force-cache",
  });
  const data = (await response.json()) as QuranCorpusResponse;

  if (data.code !== 200 || !Array.isArray(data.data?.surahs)) {
    throw new Error("Failed to load Quran text corpus for ayah detection.");
  }

  return data.data.surahs.map((surah) => ({
    number: surah.number,
    name: surah.name,
    englishName: surah.englishName,
    ayahs: surah.ayahs.map((ayah) => {
      const normalizedText = normalizeArabicText(ayah.text);
      return {
        numberInSurah: ayah.numberInSurah,
        text: ayah.text,
        normalizedText,
        wordCount: countWords(normalizedText),
      };
    }),
  }));
}

function scoreMatch(
  transcript: string,
  candidate: string,
  transcriptTokens: Set<string>,
  transcriptBigrams: Set<string>
): number {
  if (!candidate) return 0;

  const candidateTokens = new Set(candidate.split(" "));
  const candidateBigrams = buildBigrams(candidate);
  const dice = diceCoefficient(transcriptBigrams, candidateBigrams);
  const overlap = setOverlapRatio(transcriptTokens, candidateTokens);
  const prefix = prefixSimilarity(transcript, candidate);
  const lengthRatio = ratio(countWords(transcript), countWords(candidate));

  let score = dice * 0.58 + overlap * 0.24 + prefix * 0.18;
  score *= 0.8 + lengthRatio * 0.2;

  if (candidate.includes(transcript) || transcript.includes(candidate)) {
    score += 0.06;
  }

  return Math.min(1, Math.max(0, score));
}

function scoreCandidateAgainstTranscriptVariants(
  transcriptVariants: MatchingTextVariant[],
  candidateText: string,
  candidateWordCount: number
) {
  let bestScore = 0;

  for (const variant of transcriptVariants) {
    const lengthRatio = ratio(variant.tokenCount, Math.max(candidateWordCount, 1));

    if (lengthRatio < 0.3) {
      continue;
    }

    bestScore = Math.max(
      bestScore,
      scoreMatch(
        variant.normalizedText,
        candidateText,
        variant.tokens,
        variant.bigrams
      )
    );
  }

  return bestScore;
}

function buildMatchingTextVariants(input: string): MatchingTextVariant[] {
  const normalizedText = normalizeArabicText(input);
  if (!normalizedText) {
    return [];
  }

  const variants = [normalizedText];
  const strippedBasmala = stripLeadingBasmala(normalizedText);

  if (strippedBasmala && strippedBasmala !== normalizedText) {
    variants.push(strippedBasmala);
  }

  return variants.map((variant) => ({
    normalizedText: variant,
    tokenCount: countWords(variant),
    tokens: new Set(variant.split(" ")),
    bigrams: buildBigrams(variant),
  }));
}

function stripLeadingBasmala(input: string) {
  if (input === BASMALA_MATCH_TEXT) {
    return "";
  }

  if (input.startsWith(`${BASMALA_MATCH_TEXT} `)) {
    return input.slice(BASMALA_MATCH_TEXT.length).trim();
  }

  return input;
}

export function hasLeadingBasmala(input: string) {
  return stripLeadingBasmala(normalizeArabicText(input)) !==
    normalizeArabicText(input);
}

export function startsWithBasmala(input: string) {
  const normalized = normalizeArabicText(input);
  return (
    normalized === BASMALA_MATCH_TEXT ||
    normalized.startsWith(`${BASMALA_MATCH_TEXT} `)
  );
}

function buildBigrams(input: string): Set<string> {
  const compact = input.replace(/\s+/g, " ").trim();
  if (compact.length <= 2) {
    return new Set(compact ? [compact] : []);
  }

  const bigrams = new Set<string>();
  for (let index = 0; index < compact.length - 1; index += 1) {
    bigrams.add(compact.slice(index, index + 2));
  }

  return bigrams;
}

function diceCoefficient(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const value of left) {
    if (right.has(value)) {
      intersection += 1;
    }
  }

  return (2 * intersection) / (left.size + right.size);
}

function setOverlapRatio(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(left.size, right.size);
}

function prefixSimilarity(left: string, right: string): number {
  const maxLength = Math.min(left.length, right.length, 42);
  if (maxLength === 0) {
    return 0;
  }

  let matchingChars = 0;
  for (let index = 0; index < maxLength; index += 1) {
    if (left[index] !== right[index]) {
      break;
    }
    matchingChars += 1;
  }

  return matchingChars / maxLength;
}

function countWords(input: string): number {
  return input ? input.split(" ").filter(Boolean).length : 0;
}

function ratio(left: number, right: number): number {
  if (left <= 0 || right <= 0) {
    return 0;
  }

  return Math.min(left, right) / Math.max(left, right);
}

interface MatchingTextVariant {
  normalizedText: string;
  tokenCount: number;
  tokens: Set<string>;
  bigrams: Set<string>;
}

function joinText(left: string, right: string): string {
  return left ? `${left} ${right}` : right;
}

function getMaxWindowSize(transcriptTokenCount: number): number {
  if (transcriptTokenCount <= 7) return 2;
  if (transcriptTokenCount <= 16) return 4;
  if (transcriptTokenCount <= 28) return 6;
  return 8;
}
