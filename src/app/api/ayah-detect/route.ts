import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { NextResponse } from "next/server";
import {
  detectAyahRangesFromTranscript,
  getAyahRangeMetadata,
} from "@/lib/ayah-detection";
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

  const formData = await request.formData();
  const media = formData.get("media");

  if (!(media instanceof File)) {
    return NextResponse.json(
      { error: "Upload a clip or audio file before running ayah detection." },
      { status: 400 }
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
    const { transcript, model } = await transcribeWithHuggingFace(
      audioBuffer,
      token
    );
    const rawMatches = await detectAyahRangesFromTranscript(transcript, 3);
    const matches = await Promise.all(
      rawMatches.map((match) =>
        enrichMatchWithTiming(match, clipDuration, silenceRanges)
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
  silenceRanges: SilenceRange[]
): Promise<AyahDetectionMatch> {
  const range = await getAyahRangeMetadata(
    match.surahNumber,
    match.startAyah,
    match.endAyah
  );

  if (!range || clipDuration <= 0) {
    return match;
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
      const transcript = await transcribeWithModel(audioBuffer, token, model);
      return { transcript, model };
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

  return transcript;
}

function isMissingHostedModelError(error: Error) {
  return (
    error.message.includes(" 404 ") ||
    error.message.includes("404 Not Found") ||
    error.message.endsWith(" Not Found")
  );
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
