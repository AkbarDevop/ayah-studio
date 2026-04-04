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
  words: string[];
  wordSet: Set<string>;
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

// ── Constants ──────────────────────────────────────────────────────────────────

const DIACRITICS_REGEX = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D4-\u08FF]/g;
const NON_ARABIC_REGEX = /[^ء-ي0-9\s]/g;

export const ISTIADHA_MATCH_TEXTS = [
  "اعوذ بالله من الشيطان الرجيم",
  "اعوذ بالله السميع العليم من الشيطان الرجيم",
] as const;
export const ISTIADHA_DISPLAY_TEXT =
  "أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ";
export const BASMALA_MATCH_TEXT = "بسم الله الرحمن الرحيم";
export const BASMALA_DISPLAY_TEXT = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ";
export const AMEEN_MATCH_TEXT = "امين";
export const AMEEN_DISPLAY_TEXT = "آمِين";
export const FATIHA_MATCH_TEXT = normalizeArabicText(
  [
    "بسم الله الرحمن الرحيم",
    "الحمد لله رب العالمين",
    "الرحمن الرحيم",
    "مالك يوم الدين",
    "اياك نعبد واياك نستعين",
    "اهدنا الصراط المستقيم",
    "صراط الذين انعمت عليهم غير المغضوب عليهم ولا الضالين",
  ].join(" ")
);

// Trigram fuzzy match threshold
const TRIGRAM_THRESHOLD = 0.55;

// ── Corpus & Index Cache ───────────────────────────────────────────────────────

let quranCorpusPromise: Promise<NormalizedSurah[]> | null = null;
let wordIndexPromise: Promise<
  Map<string, Array<{ surahIdx: number; ayahIdx: number }>>
> | null = null;

// ── Main Detection ─────────────────────────────────────────────────────────────

/**
 * Fast ayah detection using the offline-tarteel approach:
 *
 * 1. Score every individual ayah (6,236 total) against the transcript
 *    using fast word-set overlap (O(1) per word via Sets). ~10ms.
 * 2. Take top-scoring individual ayahs.
 * 3. Group consecutive same-surah ayahs into candidate ranges.
 * 4. Final-score only the grouped ranges with word-bigram Dice.
 *
 * For multi-surah recordings, also tries transcript windows.
 */
export async function detectAyahRangesFromTranscript(
  transcript: string,
  limit = 3
): Promise<AyahDetectionMatch[]> {
  const transcriptVariants = buildMatchingTextVariants(transcript);
  if (transcriptVariants.length === 0) {
    return [];
  }

  const maxTokenCount = Math.max(
    ...transcriptVariants.map((v) => v.tokenCount)
  );
  if (maxTokenCount < 2) {
    return [];
  }

  const corpus = await loadQuranCorpus();

  const allCandidates: AyahDetectionMatch[] = [];

  for (const variant of transcriptVariants) {
    allCandidates.push(...detectForVariant(variant, corpus));
  }

  // For long transcripts (multi-surah recordings), try transcript windows
  if (maxTokenCount > 50) {
    const normalized = normalizeArabicText(transcript);
    const words = normalized.split(" ");
    const windowSize = Math.ceil(words.length * 0.55);
    const step = Math.ceil(words.length * 0.25);

    for (let start = 0; start + windowSize <= words.length; start += step) {
      const windowText = words.slice(start, start + windowSize).join(" ");
      const windowVariants = buildMatchingTextVariants(windowText);
      for (const variant of windowVariants) {
        if (variant.tokenCount >= 8) {
          allCandidates.push(...detectForVariant(variant, corpus));
        }
      }
    }
  }

  return allCandidates
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

/**
 * Core detection for a single transcript variant.
 *
 * Step 1: Score all 6,236 ayahs individually (fast word-set overlap).
 * Step 2: Group top-scoring consecutive ayahs into ranges.
 * Step 3: Final-score ranges with word bigrams + order.
 */
function detectForVariant(
  variant: MatchingTextVariant,
  corpus: NormalizedSurah[]
): AyahDetectionMatch[] {
  const transcriptWords = variant.normalizedText.split(" ").filter(Boolean);
  if (transcriptWords.length < 2) {
    return [];
  }

  const transcriptWordSet = variant.tokens;

  // ── Step 1: Fast per-ayah scoring using word-set overlap ──
  // This is O(6236 * avgAyahWords) ≈ O(75K) — very fast.
  const ayahScores: Array<{
    surahIdx: number;
    ayahIdx: number;
    matchCount: number;
  }> = [];

  for (let si = 0; si < corpus.length; si++) {
    const surah = corpus[si];
    for (let ai = 0; ai < surah.ayahs.length; ai++) {
      const ayah = surah.ayahs[ai];

      // Count how many of this ayah's unique words appear in the transcript
      let matchCount = 0;
      for (const word of ayah.wordSet) {
        if (transcriptWordSet.has(word)) {
          matchCount++;
        }
      }

      // Require at least 2 matching words or 40% of ayah words
      if (matchCount >= 2 || matchCount / ayah.wordCount >= 0.4) {
        ayahScores.push({ surahIdx: si, ayahIdx: ai, matchCount });
      }

    }
  }

  if (ayahScores.length === 0) {
    return [];
  }

  // ── Step 2: Group consecutive ayahs into ranges ──
  // Sort by surah then ayah position
  ayahScores.sort((a, b) =>
    a.surahIdx !== b.surahIdx
      ? a.surahIdx - b.surahIdx
      : a.ayahIdx - b.ayahIdx
  );

  interface CandidateRange {
    surahIdx: number;
    startAyahIdx: number;
    endAyahIdx: number;
    totalMatches: number;
  }

  const ranges: CandidateRange[] = [];
  for (const item of ayahScores) {
    const last = ranges[ranges.length - 1];
    // Allow gap of 1 ayah (for ayahs with only common words that didn't match)
    if (
      last &&
      last.surahIdx === item.surahIdx &&
      item.ayahIdx <= last.endAyahIdx + 2
    ) {
      last.endAyahIdx = item.ayahIdx;
      last.totalMatches += item.matchCount;
    } else {
      ranges.push({
        surahIdx: item.surahIdx,
        startAyahIdx: item.ayahIdx,
        endAyahIdx: item.ayahIdx,
        totalMatches: item.matchCount,
      });
    }
  }

  // Also add top individual ayahs as single-ayah ranges.
  // Without this, a single-ayah recitation gets swallowed into
  // a huge range of consecutive ayahs sharing common words.
  const topIndividualAyahs = [...ayahScores]
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, 10);
  for (const item of topIndividualAyahs) {
    const alreadyTight = ranges.some(
      (r) =>
        r.surahIdx === item.surahIdx &&
        r.startAyahIdx === item.ayahIdx &&
        r.endAyahIdx === item.ayahIdx
    );
    if (!alreadyTight) {
      ranges.push({
        surahIdx: item.surahIdx,
        startAyahIdx: item.ayahIdx,
        endAyahIdx: item.ayahIdx,
        totalMatches: item.matchCount,
      });
    }
  }

  // Take top ranges by match density (matches per ayah word count)
  // This prevents huge ranges from crowding out tight single-ayah matches
  const topRanges = ranges
    .map((r) => {
      const rangeWordCount = corpus[r.surahIdx].ayahs
        .slice(r.startAyahIdx, r.endAyahIdx + 1)
        .reduce((n, a) => n + a.wordCount, 0);
      const density = r.totalMatches / Math.max(rangeWordCount, 1);
      return { ...r, density };
    })
    .sort((a, b) => b.density - a.density)
    .slice(0, 20);

  // ── Step 3: Final-score each range with word bigrams + order ──
  const candidates: AyahDetectionMatch[] = [];

  for (const range of topRanges) {
    const surah = corpus[range.surahIdx];
    const ayahs = surah.ayahs.slice(range.startAyahIdx, range.endAyahIdx + 1);
    const combinedWords: string[] = [];
    const combinedOriginalParts: string[] = [];

    for (const ayah of ayahs) {
      combinedWords.push(...ayah.words);
      combinedOriginalParts.push(ayah.text);
    }

    const combinedOriginal = combinedOriginalParts.join(" ");
    const combinedWordCount = combinedWords.length;

    const score = scoreRangeFinal(
      transcriptWords,
      combinedWords,
      variant.wordBigrams,
      variant.tokenCount,
      combinedWordCount
    );

    if (score >= 0.35) {
      candidates.push({
        surahNumber: surah.number,
        surahName: surah.englishName,
        surahArabicName: surah.name,
        startAyah: ayahs[0].numberInSurah,
        endAyah: ayahs[ayahs.length - 1].numberInSurah,
        score,
        matchedText: combinedOriginal,
      });
    }

    // Also try tighter sub-ranges within the candidate
    // (the grouped range might be too wide)
    if (ayahs.length > 3) {
      const bestSubRange = findBestSubRange(
        surah,
        range.startAyahIdx,
        range.endAyahIdx,
        transcriptWords,
        variant
      );
      if (bestSubRange) {
        candidates.push(bestSubRange);
      }
    }
  }

  return candidates;
}

/**
 * Try smaller sub-ranges within a candidate range to find
 * the tightest-fitting ayah window.
 */
function findBestSubRange(
  surah: NormalizedSurah,
  startIdx: number,
  endIdx: number,
  transcriptWords: string[],
  variant: MatchingTextVariant
): AyahDetectionMatch | null {
  let bestScore = 0;
  let bestMatch: AyahDetectionMatch | null = null;
  const rangeLen = endIdx - startIdx + 1;

  // Try windows of different sizes within the range
  for (let size = Math.max(1, rangeLen - 3); size <= rangeLen; size++) {
    for (let start = startIdx; start + size - 1 <= endIdx; start++) {
      const ayahs = surah.ayahs.slice(start, start + size);
      const words: string[] = [];
      const origParts: string[] = [];
      for (const a of ayahs) {
        words.push(...a.words);
        origParts.push(a.text);
      }

      const score = scoreRangeFinal(
        transcriptWords,
        words,
        variant.wordBigrams,
        variant.tokenCount,
        words.length
      );

      if (score > bestScore && score >= 0.35) {
        bestScore = score;
        bestMatch = {
          surahNumber: surah.number,
          surahName: surah.englishName,
          surahArabicName: surah.name,
          startAyah: ayahs[0].numberInSurah,
          endAyah: ayahs[ayahs.length - 1].numberInSurah,
          score,
          matchedText: origParts.join(" "),
        };
      }
    }
  }

  return bestMatch;
}

/**
 * Final scoring for a candidate range. Uses:
 *   1. Word coverage (fast set overlap — no trigram)
 *   2. Word-bigram Dice (phrase-level similarity)
 *   3. Word order score (sequential matching)
 *   4. Length ratio penalty
 */
function scoreRangeFinal(
  transcriptWords: string[],
  candidateWords: string[],
  transcriptWordBigrams: Set<string>,
  transcriptWordCount: number,
  candidateWordCount: number
): number {
  if (candidateWords.length === 0 || transcriptWords.length === 0) {
    return 0;
  }

  const lengthRatio = ratio(
    transcriptWordCount,
    Math.max(candidateWordCount, 1)
  );

  // 1. Word coverage (fast — Set lookup only, no trigram)
  const candidateWordSet = new Set(candidateWords);
  let matchedCount = 0;
  for (const tw of transcriptWords) {
    if (candidateWordSet.has(tw)) {
      matchedCount++;
    }
  }
  const coverage =
    matchedCount / Math.max(transcriptWords.length, candidateWords.length);

  // 2. Word-bigram Dice (phrase-level)
  const candidateText = candidateWords.join(" ");
  const candidateWordBigrams = buildWordBigrams(candidateText);
  const wordDice = diceCoefficient(transcriptWordBigrams, candidateWordBigrams);

  // 3. Word order (lightweight — exact match only, no trigram)
  const orderScore = computeOrderScoreFast(transcriptWords, candidateWords);

  // Combine
  let score: number;
  if (transcriptWordCount >= 5) {
    score = wordDice * 0.35 + coverage * 0.35 + orderScore * 0.30;
    score *= 0.5 + lengthRatio * 0.5;
  } else {
    score = coverage * 0.45 + wordDice * 0.35 + orderScore * 0.20;
    score *= 0.8 + lengthRatio * 0.2;
  }

  // Bonus for containment
  const tText = transcriptWords.join(" ");
  if (candidateText.includes(tText) || tText.includes(candidateText)) {
    score += 0.06;
  }

  return Math.min(1, Math.max(0, score));
}

/**
 * Fast word order scoring using exact match only (no trigram).
 * For each transcript word found in candidate, track positions.
 * Count how many are in increasing order.
 */
function computeOrderScoreFast(
  transcriptWords: string[],
  candidateWords: string[]
): number {
  if (transcriptWords.length === 0 || candidateWords.length === 0) {
    return 0;
  }

  // Build position index for candidate words
  const wordPositions = new Map<string, number[]>();
  for (let i = 0; i < candidateWords.length; i++) {
    const w = candidateWords[i];
    let positions = wordPositions.get(w);
    if (!positions) {
      positions = [];
      wordPositions.set(w, positions);
    }
    positions.push(i);
  }

  // Find positions of transcript words in candidate (greedy, left-to-right)
  const matchedPositions: number[] = [];
  let minNextPos = 0;

  for (const tw of transcriptWords) {
    const positions = wordPositions.get(tw);
    if (!positions) continue;

    // Find the smallest position >= minNextPos (prefer order-preserving)
    let bestPos = -1;
    for (const pos of positions) {
      if (pos >= minNextPos) {
        bestPos = pos;
        break;
      }
    }

    if (bestPos >= 0) {
      matchedPositions.push(bestPos);
      minNextPos = bestPos + 1;
    } else if (positions.length > 0) {
      // Word exists but not in order — still count it
      matchedPositions.push(positions[0]);
    }
  }

  if (matchedPositions.length < 2) {
    return matchedPositions.length > 0 ? 0.3 : 0;
  }

  let increasing = 0;
  for (let i = 1; i < matchedPositions.length; i++) {
    if (matchedPositions[i] > matchedPositions[i - 1]) {
      increasing++;
    }
  }

  return increasing / (matchedPositions.length - 1);
}

// ── Trigram Fuzzy Matching ─────────────────────────────────────────────────────

function trigramSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 3 && b.length < 3) return a === b ? 1 : 0;

  const buildTrigrams = (s: string): Set<string> => {
    const padded = ` ${s} `;
    const trigrams = new Set<string>();
    for (let i = 0; i < padded.length - 2; i++) {
      trigrams.add(padded.slice(i, i + 3));
    }
    return trigrams;
  };

  const triA = buildTrigrams(a);
  const triB = buildTrigrams(b);

  let intersection = 0;
  for (const t of triA) {
    if (triB.has(t)) intersection++;
  }

  return (2 * intersection) / (triA.size + triB.size);
}

// ── Normalization ──────────────────────────────────────────────────────────────

export function normalizeArabicText(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/\uFEFF/g, "")
    .replace(DIACRITICS_REGEX, "")
    .replace(/[ٱأإآ]/g, "ا")
    .replace(/ء/g, "")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ـ/g, "")
    .replace(NON_ARABIC_REGEX, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Text Similarity (used by leading segment detection) ────────────────────────

export function scoreArabicTextSimilarity(
  left: string,
  right: string
): number {
  const leftVariants = buildMatchingTextVariants(left);
  const rightVariants = buildMatchingTextVariants(right);
  let bestScore = 0;

  for (const leftVariant of leftVariants) {
    for (const rightVariant of rightVariants) {
      const leftWords = leftVariant.normalizedText.split(" ").filter(Boolean);
      const rightWords = rightVariant.normalizedText
        .split(" ")
        .filter(Boolean);

      bestScore = Math.max(
        bestScore,
        scoreRangeFinal(
          leftWords,
          rightWords,
          leftVariant.wordBigrams,
          leftVariant.tokenCount,
          rightVariant.tokenCount
        )
      );
    }
  }

  return bestScore;
}

// ── Metadata ───────────────────────────────────────────────────────────────────

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

// ── Corpus Loading ─────────────────────────────────────────────────────────────

async function loadQuranCorpus(): Promise<NormalizedSurah[]> {
  if (!quranCorpusPromise) {
    quranCorpusPromise = fetchQuranCorpus().catch((error) => {
      quranCorpusPromise = null;
      throw error;
    });
  }

  return quranCorpusPromise;
}

async function loadWordIndex(): Promise<
  Map<string, Array<{ surahIdx: number; ayahIdx: number }>>
> {
  if (!wordIndexPromise) {
    wordIndexPromise = loadQuranCorpus().then((corpus) => {
      const index = new Map<
        string,
        Array<{ surahIdx: number; ayahIdx: number }>
      >();

      for (let si = 0; si < corpus.length; si++) {
        for (let ai = 0; ai < corpus[si].ayahs.length; ai++) {
          for (const word of corpus[si].ayahs[ai].wordSet) {
            let positions = index.get(word);
            if (!positions) {
              positions = [];
              index.set(word, positions);
            }
            positions.push({ surahIdx: si, ayahIdx: ai });
          }
        }
      }

      return index;
    });
  }

  return wordIndexPromise;
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
      const words = normalizedText.split(" ").filter(Boolean);
      return {
        numberInSurah: ayah.numberInSurah,
        text: ayah.text,
        normalizedText,
        words,
        wordSet: new Set(words),
        wordCount: words.length,
      };
    }),
  }));
}

// ── Scoring Helpers ────────────────────────────────────────────────────────────

function buildWordBigrams(input: string): Set<string> {
  const words = input.split(" ").filter(Boolean);
  if (words.length < 2) {
    return new Set(words.length === 1 ? [words[0]] : []);
  }

  const bigrams = new Set<string>();
  for (let index = 0; index < words.length - 1; index += 1) {
    bigrams.add(`${words[index]} ${words[index + 1]}`);
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

function countWords(input: string): number {
  return input ? input.split(" ").filter(Boolean).length : 0;
}

function ratio(left: number, right: number): number {
  if (left <= 0 || right <= 0) {
    return 0;
  }

  return Math.min(left, right) / Math.max(left, right);
}

// ── Matching Text Variants ─────────────────────────────────────────────────────

interface MatchingTextVariant {
  normalizedText: string;
  tokenCount: number;
  tokens: Set<string>;
  wordBigrams: Set<string>;
}

function buildMatchingTextVariants(input: string): MatchingTextVariant[] {
  const normalizedText = normalizeArabicText(input);
  if (!normalizedText) {
    return [];
  }

  const variants = new Set<string>([normalizedText]);
  const queue = [normalizedText];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    for (const next of [
      stripLeadingIstiadha(current),
      stripLeadingFatiha(current),
      stripLeadingAmeen(current),
      stripLeadingBasmala(current),
      stripTrailingAmeen(current),
    ]) {
      if (next && next !== current && !variants.has(next)) {
        variants.add(next);
        queue.push(next);
      }
    }
  }

  return Array.from(variants).map((variant) => ({
    normalizedText: variant,
    tokenCount: countWords(variant),
    tokens: new Set(variant.split(" ")),
    wordBigrams: buildWordBigrams(variant),
  }));
}

// ── Leading Segment Stripping ──────────────────────────────────────────────────

export function stripLeadingIstiadha(input: string) {
  for (const variant of ISTIADHA_MATCH_TEXTS) {
    if (input === variant) {
      return "";
    }

    if (input.startsWith(`${variant} `)) {
      return input.slice(variant.length).trim();
    }
  }

  // Fuzzy match: handle Whisper garbling individual words
  const inputWords = input.split(" ");
  for (const variant of ISTIADHA_MATCH_TEXTS) {
    const variantWords = variant.split(" ");
    if (inputWords.length <= variantWords.length) continue;

    const prefix = inputWords.slice(0, variantWords.length);
    let matchCount = 0;
    for (let i = 0; i < variantWords.length; i++) {
      if (
        prefix[i] === variantWords[i] ||
        trigramSimilarity(prefix[i], variantWords[i]) >= TRIGRAM_THRESHOLD
      ) {
        matchCount++;
      }
    }

    if (matchCount >= variantWords.length - 1 && matchCount >= 4) {
      return inputWords.slice(variantWords.length).join(" ").trim();
    }
  }

  return input;
}

export function stripLeadingBasmala(input: string) {
  if (input === BASMALA_MATCH_TEXT) {
    return "";
  }

  if (input.startsWith(`${BASMALA_MATCH_TEXT} `)) {
    return input.slice(BASMALA_MATCH_TEXT.length).trim();
  }

  // Fuzzy match for Whisper garbling
  const inputWords = input.split(" ");
  const basmalaWords = BASMALA_MATCH_TEXT.split(" ");
  if (inputWords.length > basmalaWords.length) {
    const prefix = inputWords.slice(0, basmalaWords.length);
    let matchCount = 0;
    for (let i = 0; i < basmalaWords.length; i++) {
      if (
        prefix[i] === basmalaWords[i] ||
        trigramSimilarity(prefix[i], basmalaWords[i]) >= TRIGRAM_THRESHOLD
      ) {
        matchCount++;
      }
    }
    // Require at least 3 of 4 Basmala words to match
    if (matchCount >= basmalaWords.length - 1) {
      return inputWords.slice(basmalaWords.length).join(" ").trim();
    }
  }

  return input;
}

export function stripLeadingFatiha(input: string) {
  if (input === FATIHA_MATCH_TEXT) {
    return "";
  }

  if (input.startsWith(`${FATIHA_MATCH_TEXT} `)) {
    return input.slice(FATIHA_MATCH_TEXT.length).trim();
  }

  return input;
}

export function stripLeadingAmeen(input: string) {
  if (input === AMEEN_MATCH_TEXT) {
    return "";
  }

  if (input.startsWith(`${AMEEN_MATCH_TEXT} `)) {
    return input.slice(AMEEN_MATCH_TEXT.length).trim();
  }

  return input;
}

export function stripTrailingAmeen(input: string) {
  // Match common spellings: امين, آمين, ءامين
  const ameenVariants = [AMEEN_MATCH_TEXT, "ءامين"];
  for (const variant of ameenVariants) {
    if (input === variant) {
      return "";
    }
    if (input.endsWith(` ${variant}`)) {
      return input.slice(0, -(variant.length + 1)).trim();
    }
  }
  return input;
}

export function hasLeadingIstiadha(input: string) {
  return (
    stripLeadingIstiadha(normalizeArabicText(input)) !==
    normalizeArabicText(input)
  );
}

export function hasLeadingBasmala(input: string) {
  return (
    stripLeadingBasmala(normalizeArabicText(input)) !==
    normalizeArabicText(input)
  );
}

export function hasLeadingFatiha(input: string) {
  return (
    stripLeadingFatiha(normalizeArabicText(input)) !==
    normalizeArabicText(input)
  );
}

export function hasLikelyLeadingFatiha(input: string) {
  const normalized = normalizeArabicText(input);
  if (!normalized) {
    return false;
  }

  const prefix = normalized.split(" ").slice(0, 40).join(" ");
  return scoreArabicTextSimilarity(prefix, FATIHA_MATCH_TEXT) >= 0.46;
}

export function hasLeadingAmeen(input: string) {
  return (
    stripLeadingAmeen(normalizeArabicText(input)) !==
    normalizeArabicText(input)
  );
}

export function stripLeadingRecitationIntro(input: string) {
  let current = normalizeArabicText(input);
  let changed = false;

  while (current) {
    let next = stripLeadingIstiadha(current);
    if (next !== current) {
      current = next;
      changed = true;
      continue;
    }

    next = stripLeadingFatiha(current);
    if (next !== current) {
      current = next;
      changed = true;
      continue;
    }

    next = stripLeadingAmeen(current);
    if (next !== current) {
      current = next;
      changed = true;
      continue;
    }

    next = stripLeadingBasmala(current);
    if (next !== current) {
      current = next;
      changed = true;
      continue;
    }

    break;
  }

  return changed ? current : normalizeArabicText(input);
}

export function startsWithBasmala(input: string) {
  const normalized = normalizeArabicText(input);
  return (
    normalized === BASMALA_MATCH_TEXT ||
    normalized.startsWith(`${BASMALA_MATCH_TEXT} `)
  );
}

export function startsWithFatiha(input: string) {
  const normalized = normalizeArabicText(input);
  return (
    normalized === FATIHA_MATCH_TEXT ||
    normalized.startsWith(`${FATIHA_MATCH_TEXT} `)
  );
}
