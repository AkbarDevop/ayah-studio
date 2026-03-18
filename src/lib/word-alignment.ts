import type { WordTiming } from "@/types";
import { normalizeArabicText } from "./ayah-detection";

/**
 * Align ASR word timings to canonical Quran text using Needleman-Wunsch
 * global sequence alignment with fuzzy Arabic matching.
 */
export function alignWordsToQuranText(
  quranText: string,
  asrWords: WordTiming[],
  subtitleStart: number,
  subtitleEnd: number
): WordTiming[] {
  const quranWords = quranText.split(/\s+/).filter(Boolean);
  if (quranWords.length === 0) return [];

  // No ASR words — evenly distribute across the time window
  if (asrWords.length === 0) {
    return evenlyDistribute(quranWords, subtitleStart, subtitleEnd);
  }

  const n = quranWords.length;
  const m = asrWords.length;

  // Precompute normalized forms
  const normQuran = quranWords.map((w) => normalizeArabicText(w));
  const normAsr = asrWords.map((w) => normalizeArabicText(w.word));

  // Score matrix
  const GAP = -0.4;
  const scores: number[][] = Array.from({ length: n + 1 }, () =>
    Array(m + 1).fill(0) as number[]
  );
  const trace: number[][] = Array.from({ length: n + 1 }, () =>
    Array(m + 1).fill(0) as number[]
  );

  // 0 = diagonal (match), 1 = up (skip quran word), 2 = left (skip asr word)
  for (let i = 1; i <= n; i++) {
    scores[i][0] = scores[i - 1][0] + GAP;
    trace[i][0] = 1;
  }
  for (let j = 1; j <= m; j++) {
    scores[0][j] = scores[0][j - 1] + GAP;
    trace[0][j] = 2;
  }

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const matchScore = wordSimilarity(normQuran[i - 1], normAsr[j - 1]);
      const diag = scores[i - 1][j - 1] + matchScore;
      const up = scores[i - 1][j] + GAP;
      const left = scores[i][j - 1] + GAP;

      if (diag >= up && diag >= left) {
        scores[i][j] = diag;
        trace[i][j] = 0;
      } else if (up >= left) {
        scores[i][j] = up;
        trace[i][j] = 1;
      } else {
        scores[i][j] = left;
        trace[i][j] = 2;
      }
    }
  }

  // Traceback — map each Quran word to its aligned ASR word (or null)
  const aligned: (WordTiming | null)[] = Array(n).fill(null);
  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && trace[i][j] === 0) {
      // Match — only assign if similarity is reasonable
      const sim = wordSimilarity(normQuran[i - 1], normAsr[j - 1]);
      if (sim > 0.15) {
        aligned[i - 1] = {
          word: quranWords[i - 1],
          start: asrWords[j - 1].start,
          end: asrWords[j - 1].end,
        };
      }
      i--;
      j--;
    } else if (i > 0 && (j === 0 || trace[i][j] === 1)) {
      // Gap in ASR — Quran word unmatched
      i--;
    } else {
      // Gap in Quran — skip ASR word
      j--;
    }
  }

  return interpolateGaps(aligned, quranWords, subtitleStart, subtitleEnd);
}

/** Character bigram Dice coefficient for two normalized Arabic words */
function wordSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a.length < 2 || b.length < 2) {
    return a === b ? 1.0 : a.length === 1 && b.includes(a) ? 0.5 : -0.3;
  }

  const bigramsA = new Set<string>();
  for (let i = 0; i < a.length - 1; i++) bigramsA.add(a.slice(i, i + 2));

  let overlap = 0;
  const bigramsB = new Set<string>();
  for (let i = 0; i < b.length - 1; i++) {
    const bg = b.slice(i, i + 2);
    bigramsB.add(bg);
    if (bigramsA.has(bg)) overlap++;
  }

  const dice = (2 * overlap) / (bigramsA.size + bigramsB.size);
  // Map dice [0,1] to score range [-0.3, 1.0]
  return dice * 1.3 - 0.3;
}

/** Fill in timing gaps for unmatched Quran words via linear interpolation */
function interpolateGaps(
  aligned: (WordTiming | null)[],
  quranWords: string[],
  subtitleStart: number,
  subtitleEnd: number
): WordTiming[] {
  const result: WordTiming[] = [];

  for (let i = 0; i < aligned.length; i++) {
    const current = aligned[i];
    if (current) {
      result.push(current);
      continue;
    }

    // Find nearest matched neighbors
    let prevTime = subtitleStart;
    for (let p = i - 1; p >= 0; p--) {
      const prev = aligned[p];
      if (prev) {
        prevTime = prev.end;
        break;
      }
    }

    let nextTime = subtitleEnd;
    for (let n = i + 1; n < aligned.length; n++) {
      const next = aligned[n];
      if (next) {
        nextTime = next.start;
        break;
      }
    }

    // Count consecutive gaps to split the interval evenly
    let gapStart = i;
    while (gapStart > 0 && !aligned[gapStart - 1]) gapStart--;
    let gapEnd = i;
    while (gapEnd < aligned.length - 1 && !aligned[gapEnd + 1]) gapEnd++;

    const gapCount = gapEnd - gapStart + 1;
    const gapIdx = i - gapStart;
    const interval = (nextTime - prevTime) / gapCount;

    result.push({
      word: quranWords[i],
      start: prevTime + interval * gapIdx,
      end: prevTime + interval * (gapIdx + 1),
    });
  }

  return result;
}

/** Evenly distribute words across a time window when no ASR data exists */
function evenlyDistribute(
  words: string[],
  start: number,
  end: number
): WordTiming[] {
  const interval = (end - start) / words.length;
  return words.map((word, i) => ({
    word,
    start: start + interval * i,
    end: start + interval * (i + 1),
  }));
}
