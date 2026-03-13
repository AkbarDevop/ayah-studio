import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { NextResponse } from "next/server";
import {
  detectAyahRangesFromTranscript,
  getAyahRangeMetadata,
  normalizeArabicText,
  scoreArabicTextSimilarity,
} from "@/lib/ayah-detection";
import {
  MAX_AYAH_DETECT_MULTIPART_OVERHEAD_BYTES,
  MAX_AYAH_DETECT_UPLOAD_BYTES,
  getAyahDetectUploadLimitMessage,
} from "@/lib/ayah-detection-config";
import type { AyahDetectionMatch, AyahTimingSegment } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HUGGINGFACE_ASR_MODELS = [
  "tarteel-ai/whisper-base-ar-quran",
  "openai/whisper-large-v3",
] as const;
const SILENCE_FILTER = "silencedetect=noise=-18dB:d=0.08";
const SILENCE_EDGE_PADDING_SECONDS = 0.35;

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "");
  const maxRequestBytes =
    MAX_AYAH_DETECT_UPLOAD_BYTES + MAX_AYAH_DETECT_MULTIPART_OVERHEAD_BYTES;

  if (Number.isFinite(contentLength) && contentLength > maxRequestBytes) {
    return NextResponse.json(
      { error: getAyahDetectUploadLimitMessage() },
      { status: 413 }
    );
  }

  const formData = await request.formData();
  const media = formData.get("media");

  if (!(media instanceof File)) {
    return NextResponse.json(
      { error: "Upload a clip or audio file before running ayah detection." },
      { status: 400 }
    );
  }

  if (media.size > MAX_AYAH_DETECT_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: getAyahDetectUploadLimitMessage() },
      { status: 413 }
    );
  }

  const token = await resolveHuggingFaceToken();

  if (!token) {
    return NextResponse.json(
      {
        error:
          "Ayah detection needs a Hugging Face token. Set HF_TOKEN/HUGGINGFACE_API_KEY or run `hf auth login`, then restart Ayah Studio.",
      },
      { status: 503 }
    );
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ayah-detect-"));
  const inputPath = path.join(
    tempDir,
    `${randomUUID()}${guessExtension(media.name, media.type)}`
  );
  const outputPath = path.join(tempDir, `${randomUUID()}.wav`);

  try {
    const buffer = Buffer.from(await media.arrayBuffer());
    await fs.writeFile(inputPath, buffer);
    await extractMonoWav(inputPath, outputPath);

    const audioBuffer = await fs.readFile(outputPath);
    const clipDuration = getWavDurationSeconds(audioBuffer);
    const silenceRanges = await detectSilenceRanges(outputPath);
    const { transcript, model, chunks } = await transcribeWithHuggingFace(
      audioBuffer,
      token
    );
    const transcriptChunks =
      chunks.length > 0
        ? chunks
        : await transcribeSpeechSegments(outputPath, clipDuration, silenceRanges, token);
    const rawMatches = await detectAyahRangesFromTranscript(transcript, 3);
    const matches = await Promise.all(
      rawMatches.map((match) =>
        enrichMatchWithTiming(
          match,
          clipDuration,
          silenceRanges,
          transcriptChunks
        )
      )
    );

    if (matches.length === 0) {
      return NextResponse.json({
        provider: `huggingface:${model}`,
        transcript,
        matches: [],
        warning:
          "The clip transcribed, but the matcher could not confidently map it to a Quran ayah range. Try a cleaner recitation or use override audio.",
      });
    }

    return NextResponse.json({
      provider: `huggingface:${model}`,
      transcript,
      matches,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Ayah detection failed unexpectedly.";
    const status =
      message.includes("token") || message.includes("HF_TOKEN") ? 503 : 500;

    return NextResponse.json({ error: message }, { status });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function extractMonoWav(inputPath: string, outputPath: string) {
  await runProcess(process.env.FFMPEG_PATH ?? "ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "pcm_s16le",
    outputPath,
  ]);
}

async function enrichMatchWithTiming(
  match: AyahDetectionMatch,
  clipDuration: number,
  silenceRanges: SilenceRange[],
  transcriptChunks: TranscriptChunk[]
): Promise<AyahDetectionMatch> {
  const range = await getAyahRangeMetadata(
    match.surahNumber,
    match.startAyah,
    match.endAyah
  );

  if (!range || clipDuration <= 0) {
    return match;
  }

  const chunkAlignedTimings = buildAyahTimingSegmentsFromTranscriptChunks(
    range.ayahs,
    clipDuration,
    transcriptChunks
  );

  if (chunkAlignedTimings) {
    return {
      ...match,
      timings: chunkAlignedTimings,
      timingSource: "chunks",
    };
  }

  const timings = buildAyahTimingSegments(
    range.ayahs.map((ayah) => ({
      ayahNum: ayah.numberInSurah,
      wordCount: ayah.wordCount,
    })),
    clipDuration,
    silenceRanges
  );

  return {
    ...match,
    timings: timings.segments,
    timingSource: timings.source,
  };
}

async function transcribeWithHuggingFace(audioBuffer: Buffer, token: string) {
  let lastError: Error | null = null;

  for (const model of HUGGINGFACE_ASR_MODELS) {
    try {
      const result = await transcribeWithModel(audioBuffer, token, model);
      return { ...result, model };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (!isMissingHostedModelError(lastError)) {
        throw lastError;
      }
    }
  }

  throw (
    lastError ??
    new Error("No hosted Hugging Face ASR model could transcribe the clip.")
  );
}

async function transcribeWithModel(
  audioBuffer: Buffer,
  token: string,
  model: string
) {
  try {
    return await requestTimedTranscription(audioBuffer, token, model);
  } catch (error) {
    const timedError = error instanceof Error ? error : new Error(String(error));

    if (!shouldFallbackToUntimedTranscription(timedError)) {
      throw timedError;
    }

    return await requestUntimedTranscription(audioBuffer, token, model);
  }
}

async function requestTimedTranscription(
  audioBuffer: Buffer,
  token: string,
  model: string
) {
  const response = await fetch(
    `https://router.huggingface.co/hf-inference/models/${model}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: audioBuffer.toString("base64"),
        parameters: {
          return_timestamps: true,
        },
      }),
      cache: "no-store",
    }
  );

  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    const payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
    const detail =
      typeof payload === "string"
        ? payload
        : payload?.error || payload?.message || JSON.stringify(payload);
    throw new Error(
      `Hugging Face ASR request failed for ${model}: ${String(
        response.status
      )} ${detail}`
    );
  }

  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  const transcript =
    typeof payload === "string" ? payload : payload?.text ?? "";

  if (!transcript || typeof transcript !== "string") {
    throw new Error(`The ASR provider returned no transcript text for ${model}.`);
  }

  return {
    transcript,
    chunks: extractTranscriptChunks(payload),
  };
}

async function requestUntimedTranscription(
  audioBuffer: Buffer,
  token: string,
  model: string
) {
  const response = await fetch(
    `https://router.huggingface.co/hf-inference/models/${model}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "audio/wav",
      },
      body: new Uint8Array(audioBuffer),
      cache: "no-store",
    }
  );

  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    const payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
    const detail =
      typeof payload === "string"
        ? payload
        : payload?.error || payload?.message || JSON.stringify(payload);
    throw new Error(
      `Hugging Face ASR request failed for ${model}: ${String(
        response.status
      )} ${detail}`
    );
  }

  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  const transcript =
    typeof payload === "string" ? payload : payload?.text ?? "";

  if (!transcript || typeof transcript !== "string") {
    throw new Error(`The ASR provider returned no transcript text for ${model}.`);
  }

  return {
    transcript,
    chunks: [] as TranscriptChunk[],
  };
}

async function transcribeSpeechSegments(
  audioPath: string,
  clipDuration: number,
  silenceRanges: SilenceRange[],
  token: string
) {
  const speechSegments = buildSpeechSegments(clipDuration, silenceRanges);

  if (speechSegments.length <= 1) {
    return [] as TranscriptChunk[];
  }

  const transcriptChunks: TranscriptChunk[] = [];

  for (const segment of speechSegments) {
    const chunkPath = path.join(path.dirname(audioPath), `${randomUUID()}.wav`);

    try {
      await extractAudioSegment(audioPath, chunkPath, segment.start, segment.end);
      const audioBuffer = await fs.readFile(chunkPath);
      const { transcript } = await transcribeWithHuggingFace(audioBuffer, token);

      if (transcript.trim()) {
        transcriptChunks.push({
          text: transcript,
          start: segment.start,
          end: segment.end,
        });
      }
    } finally {
      await fs.rm(chunkPath, { force: true });
    }
  }

  return transcriptChunks;
}

async function extractAudioSegment(
  inputPath: string,
  outputPath: string,
  start: number,
  end: number
) {
  await runProcess(process.env.FFMPEG_PATH ?? "ffmpeg", [
    "-y",
    "-ss",
    String(Math.max(start, 0)),
    "-t",
    String(Math.max(end - start, 0.1)),
    "-i",
    inputPath,
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "pcm_s16le",
    outputPath,
  ]);
}

function isMissingHostedModelError(error: Error) {
  return (
    error.message.includes(" 404 ") ||
    error.message.includes("404 Not Found") ||
    error.message.endsWith(" Not Found")
  );
}

function buildSpeechSegments(
  clipDuration: number,
  silenceRanges: SilenceRange[]
) {
  if (clipDuration <= 0) {
    return [] as Array<{ start: number; end: number }>;
  }

  const speechSegments: Array<{ start: number; end: number }> = [];
  const minimumSpeechDuration = 0.65;
  let cursor = 0;

  for (const silence of silenceRanges) {
    if (silence.start - cursor >= minimumSpeechDuration) {
      speechSegments.push({
        start: cursor,
        end: silence.start,
      });
    }

    cursor = Math.max(cursor, silence.end);
  }

  if (clipDuration - cursor >= minimumSpeechDuration) {
    speechSegments.push({
      start: cursor,
      end: clipDuration,
    });
  }

  return mergeSegmentsDownToLimit(speechSegments, 8);
}

function mergeSegmentsDownToLimit(
  segments: Array<{ start: number; end: number }>,
  maxSegments: number
) {
  const merged = [...segments];

  while (merged.length > maxSegments) {
    let mergeIndex = 0;
    let shortestDuration = Number.POSITIVE_INFINITY;

    for (let index = 0; index < merged.length; index += 1) {
      const duration = merged[index].end - merged[index].start;
      if (duration < shortestDuration) {
        shortestDuration = duration;
        mergeIndex = index;
      }
    }

    if (mergeIndex === 0) {
      merged.splice(0, 2, {
        start: merged[0].start,
        end: merged[1].end,
      });
      continue;
    }

    merged.splice(mergeIndex - 1, 2, {
      start: merged[mergeIndex - 1].start,
      end: merged[mergeIndex].end,
    });
  }

  return merged;
}

function shouldFallbackToUntimedTranscription(error: Error) {
  return (
    error.message.includes(" 400 ") ||
    error.message.includes(" 415 ") ||
    error.message.includes(" 422 ") ||
    error.message.toLowerCase().includes("base64") ||
    error.message.toLowerCase().includes("return_timestamps") ||
    error.message.toLowerCase().includes("parameters")
  );
}

function extractTranscriptChunks(payload: unknown): TranscriptChunk[] {
  if (!payload || typeof payload !== "object" || !("chunks" in payload)) {
    return [];
  }

  const rawChunks = (payload as { chunks?: unknown }).chunks;
  if (!Array.isArray(rawChunks)) {
    return [];
  }

  return rawChunks
    .map((chunk) => {
      if (!chunk || typeof chunk !== "object") {
        return null;
      }

      const text = typeof (chunk as { text?: unknown }).text === "string"
        ? (chunk as { text: string }).text
        : "";
      const timestamp = normalizeChunkTimestamp(
        (chunk as { timestamp?: unknown }).timestamp
      );

      if (!text || !timestamp) {
        return null;
      }

      return {
        text,
        start: timestamp[0],
        end: timestamp[1],
      };
    })
    .filter((chunk): chunk is TranscriptChunk => Boolean(chunk));
}

function normalizeChunkTimestamp(timestamp: unknown) {
  if (!Array.isArray(timestamp) || timestamp.length < 2) {
    return null;
  }

  const start = Number(timestamp[0]);
  const end = Number(timestamp[1]);

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null;
  }

  return [start, end] as const;
}

async function runProcess(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "ignore", "pipe"],
    });

    let stderr = "";

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          stderr.trim() ||
            `${path.basename(command)} exited with code ${String(code)}`
        )
      );
    });
  });
}

async function runProcessWithStderr(command: string, args: string[]) {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "ignore", "pipe"],
    });

    let stderr = "";

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stderr);
        return;
      }

      reject(
        new Error(
          stderr.trim() ||
            `${path.basename(command)} exited with code ${String(code)}`
        )
      );
    });
  });
}

async function detectSilenceRanges(audioPath: string) {
  const stderr = await runProcessWithStderr(process.env.FFMPEG_PATH ?? "ffmpeg", [
    "-i",
    audioPath,
    "-af",
    SILENCE_FILTER,
    "-f",
    "null",
    "-",
  ]);

  return parseSilenceRanges(stderr);
}

function parseSilenceRanges(log: string): SilenceRange[] {
  const lines = log.split("\n");
  const ranges: SilenceRange[] = [];
  let activeStart: number | null = null;

  for (const line of lines) {
    const startMatch = line.match(/silence_start:\s*([0-9.]+)/);
    if (startMatch) {
      activeStart = Number.parseFloat(startMatch[1]);
      continue;
    }

    const endMatch = line.match(
      /silence_end:\s*([0-9.]+)\s*\|\s*silence_duration:\s*([0-9.]+)/
    );
    if (endMatch && activeStart !== null) {
      const end = Number.parseFloat(endMatch[1]);
      const duration = Number.parseFloat(endMatch[2]);

      if (
        Number.isFinite(activeStart) &&
        Number.isFinite(end) &&
        Number.isFinite(duration)
      ) {
        ranges.push({
          start: activeStart,
          end,
          duration,
          midpoint: activeStart + (end - activeStart) / 2,
        });
      }

      activeStart = null;
    }
  }

  return ranges;
}

function buildAyahTimingSegments(
  ayahs: Array<{ ayahNum: number; wordCount: number }>,
  clipDuration: number,
  silenceRanges: SilenceRange[]
) {
  if (ayahs.length === 0 || clipDuration <= 0) {
    return {
      segments: [] as AyahTimingSegment[],
      source: "weighted" as const,
    };
  }

  if (ayahs.length === 1) {
    return {
      segments: [
        {
          ayahNum: ayahs[0].ayahNum,
          start: 0,
          end: clipDuration,
        },
      ],
      source: "weighted" as const,
    };
  }

  const internalSilences = silenceRanges
    .filter(
      (range) =>
        range.start > SILENCE_EDGE_PADDING_SECONDS &&
        range.end < clipDuration - SILENCE_EDGE_PADDING_SECONDS
    )
    .sort((left, right) => left.midpoint - right.midpoint);

  const boundaryCount = ayahs.length - 1;
  const weightedBoundaries = buildWeightedBoundaries(ayahs, clipDuration);
  const selectedSilenceMidpoints = alignSilencesToExpectedBoundaries(
    weightedBoundaries,
    internalSilences,
    clipDuration
  );
  const selectedSilenceCount = selectedSilenceMidpoints.filter(
    (value): value is number => typeof value === "number"
  ).length;

  if (selectedSilenceCount === boundaryCount) {
    return {
      segments: buildSegmentsFromBoundaries(
        ayahs.map((ayah) => ayah.ayahNum),
        mergeBoundaryPositions(
          weightedBoundaries,
          selectedSilenceMidpoints,
          clipDuration
        )
      ),
      source: "silence" as const,
    };
  }

  const source =
    selectedSilenceCount > 0 ? ("hybrid" as const) : ("weighted" as const);
  const boundaryPositions = mergeBoundaryPositions(
    weightedBoundaries,
    selectedSilenceMidpoints,
    clipDuration
  );

  return {
    segments: buildSegmentsFromBoundaries(
      ayahs.map((ayah) => ayah.ayahNum),
      boundaryPositions
    ),
    source,
  };
}

function buildAyahTimingSegmentsFromTranscriptChunks(
  ayahs: Array<{ numberInSurah: number; text: string; wordCount: number }>,
  clipDuration: number,
  transcriptChunks: TranscriptChunk[]
) {
  const usableChunks = transcriptChunks
    .map((chunk) => {
      const normalizedText = normalizeArabicText(chunk.text);
      return {
        ...chunk,
        normalizedText,
        wordCount: countWords(normalizedText),
      };
    })
    .filter(
      (chunk) =>
        Boolean(chunk.normalizedText) &&
        Number.isFinite(chunk.start) &&
        Number.isFinite(chunk.end) &&
        chunk.end > chunk.start
    );

  if (clipDuration <= 0 || usableChunks.length < ayahs.length) {
    return null;
  }

  const totalAyahWords = ayahs.reduce(
    (sum, ayah) => sum + Math.max(ayah.wordCount, 1),
    0
  );
  const groupCache = new Map<
    string,
    { text: string; start: number; end: number; duration: number }
  >();
  const groupScoreCache = new Map<string, number>();
  const maxChunkIndex = usableChunks.length;
  const dp = Array.from({ length: ayahs.length + 1 }, () =>
    Array.from({ length: maxChunkIndex + 1 }, () => Number.NEGATIVE_INFINITY)
  );
  const backtrack = Array.from({ length: ayahs.length + 1 }, () =>
    Array.from({ length: maxChunkIndex + 1 }, () => -1)
  );

  dp[0][0] = 0;

  for (let ayahIndex = 1; ayahIndex <= ayahs.length; ayahIndex += 1) {
    for (
      let endChunk = ayahIndex;
      endChunk <= usableChunks.length - (ayahs.length - ayahIndex);
      endChunk += 1
    ) {
      for (
        let startChunk = ayahIndex - 1;
        startChunk < endChunk;
        startChunk += 1
      ) {
        if (!Number.isFinite(dp[ayahIndex - 1][startChunk])) {
          continue;
        }

        const group = getTranscriptChunkGroup(
          usableChunks,
          startChunk,
          endChunk,
          groupCache
        );
        const groupScore = scoreTranscriptChunkGroup(
          ayahs[ayahIndex - 1].text,
          ayahs[ayahIndex - 1].wordCount,
          totalAyahWords,
          group,
          clipDuration,
          groupScoreCache,
          `${ayahIndex - 1}:${startChunk}-${endChunk}`
        );

        if (groupScore < 0.16) {
          continue;
        }

        const candidateScore = dp[ayahIndex - 1][startChunk] + groupScore;
        if (candidateScore > dp[ayahIndex][endChunk]) {
          dp[ayahIndex][endChunk] = candidateScore;
          backtrack[ayahIndex][endChunk] = startChunk;
        }
      }
    }
  }

  const finalScore = dp[ayahs.length][usableChunks.length];
  if (!Number.isFinite(finalScore) || finalScore / ayahs.length < 0.34) {
    return null;
  }

  const partitions: Array<{ startChunk: number; endChunk: number }> = [];
  let endChunk = usableChunks.length;

  for (let ayahIndex = ayahs.length; ayahIndex > 0; ayahIndex -= 1) {
    const startChunk = backtrack[ayahIndex][endChunk];
    if (startChunk < 0) {
      return null;
    }

    partitions.unshift({ startChunk, endChunk });
    endChunk = startChunk;
  }

  const boundaries = [0];

  for (let index = 0; index < partitions.length - 1; index += 1) {
    const currentGroup = getTranscriptChunkGroup(
      usableChunks,
      partitions[index].startChunk,
      partitions[index].endChunk,
      groupCache
    );
    const nextGroup = getTranscriptChunkGroup(
      usableChunks,
      partitions[index + 1].startChunk,
      partitions[index + 1].endChunk,
      groupCache
    );
    boundaries.push((currentGroup.end + nextGroup.start) / 2);
  }

  boundaries.push(clipDuration);

  return buildSegmentsFromBoundaries(
    ayahs.map((ayah) => ayah.numberInSurah),
    clampBoundaryPositions(boundaries, clipDuration)
  );
}

function getTranscriptChunkGroup(
  transcriptChunks: Array<TranscriptChunk & { normalizedText: string }>,
  startChunk: number,
  endChunk: number,
  cache: Map<string, { text: string; start: number; end: number; duration: number }>
) {
  const cacheKey = `${startChunk}:${endChunk}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const groupChunks = transcriptChunks.slice(startChunk, endChunk);
  const group = {
    text: groupChunks.map((chunk) => chunk.normalizedText).join(" ").trim(),
    start: groupChunks[0].start,
    end: groupChunks[groupChunks.length - 1].end,
    duration: groupChunks[groupChunks.length - 1].end - groupChunks[0].start,
  };

  cache.set(cacheKey, group);
  return group;
}

function scoreTranscriptChunkGroup(
  ayahText: string,
  ayahWordCount: number,
  totalAyahWords: number,
  group: { text: string; duration: number },
  clipDuration: number,
  cache: Map<string, number>,
  cacheKey: string
) {
  const cached = cache.get(cacheKey);
  if (typeof cached === "number") {
    return cached;
  }

  const textScore = scoreArabicTextSimilarity(group.text, ayahText);
  const expectedDurationRatio = Math.max(ayahWordCount, 1) / totalAyahWords;
  const actualDurationRatio = Math.max(group.duration, 0.05) / clipDuration;
  const durationScore = Math.max(
    0,
    1 - Math.abs(expectedDurationRatio - actualDurationRatio) * 2.2
  );
  const score = textScore * 0.78 + durationScore * 0.22;

  cache.set(cacheKey, score);
  return score;
}

function buildWeightedBoundaries(
  ayahs: Array<{ ayahNum: number; wordCount: number }>,
  clipDuration: number
) {
  const totalWeight = ayahs.reduce(
    (sum, ayah) => sum + Math.max(ayah.wordCount, 1),
    0
  );
  const boundaries = [0];
  let consumedWeight = 0;

  for (let index = 0; index < ayahs.length - 1; index += 1) {
    consumedWeight += Math.max(ayahs[index].wordCount, 1);
    boundaries.push((consumedWeight / totalWeight) * clipDuration);
  }

  boundaries.push(clipDuration);
  return boundaries;
}

function mergeBoundaryPositions(
  weightedBoundaries: number[],
  silenceMidpoints: Array<number | null>,
  clipDuration: number
) {
  const merged = [...weightedBoundaries];

  for (let index = 0; index < silenceMidpoints.length; index += 1) {
    const boundaryIndex = index + 1;
    const silenceMidpoint = silenceMidpoints[index];
    if (typeof silenceMidpoint === "number") {
      merged[boundaryIndex] = silenceMidpoint;
    }
  }

  return clampBoundaryPositions(merged, clipDuration);
}

function alignSilencesToExpectedBoundaries(
  weightedBoundaries: number[],
  silenceRanges: SilenceRange[],
  clipDuration: number
) {
  const selected: Array<number | null> = new Array(
    Math.max(weightedBoundaries.length - 2, 0)
  ).fill(null);
  const usedSilenceIndexes = new Set<number>();

  for (let boundaryIndex = 1; boundaryIndex < weightedBoundaries.length - 1; boundaryIndex += 1) {
    const expected = weightedBoundaries[boundaryIndex];
    const left = weightedBoundaries[boundaryIndex - 1];
    const right = weightedBoundaries[boundaryIndex + 1];
    const tolerance = getBoundaryTolerance(left, expected, right, clipDuration);

    let bestMatch: { index: number; distance: number; duration: number } | null = null;

    for (let silenceIndex = 0; silenceIndex < silenceRanges.length; silenceIndex += 1) {
      if (usedSilenceIndexes.has(silenceIndex)) {
        continue;
      }

      const silence = silenceRanges[silenceIndex];
      const distance = Math.abs(silence.midpoint - expected);

      if (
        silence.midpoint <= left ||
        silence.midpoint >= right ||
        distance > tolerance
      ) {
        continue;
      }

      if (
        !bestMatch ||
        distance < bestMatch.distance ||
        (distance === bestMatch.distance && silence.duration > bestMatch.duration)
      ) {
        bestMatch = {
          index: silenceIndex,
          distance,
          duration: silence.duration,
        };
      }
    }

    if (bestMatch) {
      usedSilenceIndexes.add(bestMatch.index);
      selected[boundaryIndex - 1] = silenceRanges[bestMatch.index].midpoint;
    }
  }

  return selected;
}

function getBoundaryTolerance(
  leftBoundary: number,
  expectedBoundary: number,
  rightBoundary: number,
  clipDuration: number
) {
  const localWindow = Math.min(
    expectedBoundary - leftBoundary,
    rightBoundary - expectedBoundary
  );

  return Math.max(
    0.45,
    Math.min(Math.max(localWindow * 0.4, 0.45), clipDuration * 0.12, 2.4)
  );
}

function clampBoundaryPositions(boundaries: number[], clipDuration: number) {
  const clamped = [...boundaries];
  const minGap = Math.min(0.18, clipDuration / Math.max(boundaries.length * 8, 1));

  clamped[0] = 0;
  clamped[clamped.length - 1] = clipDuration;

  for (let index = 1; index < clamped.length - 1; index += 1) {
    const previous = clamped[index - 1] + minGap;
    const next = clamped[index + 1] - minGap;
    clamped[index] = Math.min(next, Math.max(previous, clamped[index]));
  }

  return clamped;
}

function buildSegmentsFromBoundaries(
  ayahNumbers: number[],
  boundaries: number[]
) {
  return ayahNumbers.map((ayahNum, index) => ({
    ayahNum,
    start: boundaries[index],
    end: boundaries[index + 1],
  }));
}

function getWavDurationSeconds(audioBuffer: Buffer) {
  const dataBytes = Math.max(audioBuffer.byteLength - 44, 0);
  return dataBytes / (16000 * 2);
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function resolveHuggingFaceToken() {
  const envToken = process.env.HUGGINGFACE_API_KEY ?? process.env.HF_TOKEN;

  if (envToken?.trim()) {
    return envToken.trim();
  }

  const defaultTokenPath =
    process.env.HF_TOKEN_PATH ??
    path.join(os.homedir(), ".cache", "huggingface", "token");

  try {
    const token = (await fs.readFile(defaultTokenPath, "utf8")).trim();
    return token || null;
  } catch {
    return null;
  }
}

function guessExtension(filename: string, mimeType: string): string {
  const ext = path.extname(filename);
  if (ext) {
    return ext;
  }

  if (mimeType.includes("mp4")) return ".mp4";
  if (mimeType.includes("webm")) return ".webm";
  if (mimeType.includes("mpeg")) return ".mp3";
  if (mimeType.includes("wav")) return ".wav";
  if (mimeType.includes("aac")) return ".aac";
  if (mimeType.includes("ogg")) return ".ogg";

  return ".bin";
}

interface SilenceRange {
  start: number;
  end: number;
  duration: number;
  midpoint: number;
}

interface TranscriptChunk {
  text: string;
  start: number;
  end: number;
}
