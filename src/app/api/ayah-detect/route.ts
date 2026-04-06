import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { NextResponse } from "next/server";
import {
  AMEEN_DISPLAY_TEXT,
  AMEEN_MATCH_TEXT,
  BASMALA_DISPLAY_TEXT,
  BASMALA_MATCH_TEXT,
  detectAyahRangesFromTranscript,
  FATIHA_MATCH_TEXT,
  getAyahRangeMetadata,
  hasLeadingBasmala,
  hasLikelyLeadingFatiha,
  hasLeadingIstiadha,
  ISTIADHA_DISPLAY_TEXT,
  ISTIADHA_MATCH_TEXTS,
  normalizeArabicText,
  scoreArabicTextSimilarity,
  startsWithBasmala,
  stripLeadingRecitationIntro,
} from "@/lib/ayah-detection";
import {
  MAX_AYAH_DETECT_MULTIPART_OVERHEAD_BYTES,
  MAX_AYAH_DETECT_UPLOAD_BYTES,
  getAyahDetectUploadLimitMessage,
} from "@/lib/ayah-detection-config";
import type { AyahDetectionMatch, AyahTimingSegment, WordTiming } from "@/types";
import { alignWordsToQuranText } from "@/lib/word-alignment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Allow uploads up to 100MB (videos can be large)
export const config = {
  api: { bodyParser: { sizeLimit: "100mb" } },
};

const HUGGINGFACE_ASR_MODELS = [
  "tarteel-ai/whisper-base-ar-quran",
  "openai/whisper-large-v3",
] as const;
const LOCAL_WHISPER_MODEL =
  process.env.LOCAL_WHISPER_MODEL ?? "mlx-community/whisper-small-mlx";
const UV_PATH = process.env.UV_PATH ?? "uv";
const SILENCE_FILTER = "silencedetect=noise=-18dB:d=0.08";
const SILENCE_EDGE_PADDING_SECONDS = 0.35;
const MIN_SPEECH_SEGMENT_SECONDS = 0.55;
const MAX_TRANSCRIPT_CHUNK_SECONDS = 4.25;
const MAX_TRANSCRIPT_CHUNKS = 12;

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
    const { transcript, provider, chunks, wordTimings } = await transcribeAudio(
      audioBuffer,
      outputPath,
      token
    );

    // Early bail if the transcript is garbage (no usable Arabic content)
    const normalizedFull = normalizeArabicText(transcript);
    if (isGarbageTranscript(normalizedFull)) {
      return NextResponse.json({
        provider,
        transcript,
        matches: [],
        warning:
          "The transcription did not produce enough recognizable Arabic text. Try a cleaner recording with less background noise, or use override audio.",
      });
    }

    const transcriptChunks =
      chunks.length > 0
        ? chunks
        : await transcribeSpeechSegments(outputPath, clipDuration, silenceRanges, token);
    const leadingSegments = detectLeadingRecitationSegments(
      transcript,
      transcriptChunks,
      clipDuration
    );
    const trimmedTranscriptChunks = trimTranscriptChunksAfterTime(
      transcriptChunks,
      getLeadingTimingOffset(leadingSegments)
    );
    const trimmedTranscript =
      buildTranscriptFromChunks(trimmedTranscriptChunks) ||
      stripLeadingRecitationIntro(transcript);
    console.log("[ayah-detect] provider:", provider);
    console.log("[ayah-detect] transcript length:", transcript.length, "chars");
    console.log("[ayah-detect] transcript preview:", transcript.slice(0, 300));
    console.log("[ayah-detect] normalized words:", normalizeArabicText(transcript).split(" ").length);

    const t0 = Date.now();
    const rawMatches = mergeAyahMatches(
      await detectAyahRangesFromTranscript(transcript, 3),
      trimmedTranscript && trimmedTranscript !== normalizeArabicText(transcript)
        ? await detectAyahRangesFromTranscript(trimmedTranscript, 3).then(
            (matches) =>
              matches.map((match) => ({
                ...match,
                score: Math.min(1, match.score + 0.04),
              }))
          )
        : []
    );
    console.log("[ayah-detect] matching took:", Date.now() - t0, "ms");
    console.log("[ayah-detect] raw matches:", rawMatches.map(m => `${m.surahName} ${m.startAyah}-${m.endAyah} (${(m.score * 100).toFixed(1)}%)`));

    const matches = await Promise.all(
      rawMatches.map((match) =>
        enrichMatchWithTiming(
          match,
          clipDuration,
          silenceRanges,
          transcriptChunks,
          leadingSegments,
          transcript,
          wordTimings
        )
      )
    );

    // Fallback: if no matches but Fatiha was detected as a leading segment,
    // the reciter was likely reciting just Al-Fatiha.
    if (matches.length === 0) {
      const fatihaLeading = leadingSegments.find((s) => s.kind === "fatiha");
      if (fatihaLeading) {
        const fatihaMatch = await enrichMatchWithTiming(
          {
            surahNumber: 1,
            surahName: "Al-Faatiha",
            surahArabicName: "سُورَةُ ٱلْفَاتِحَةِ",
            startAyah: 1,
            endAyah: 7,
            score: 0.75,
            matchedText: transcript,
          },
          clipDuration,
          silenceRanges,
          transcriptChunks,
          leadingSegments,
          transcript,
          wordTimings
        );
        return NextResponse.json({
          provider,
          transcript,
          matches: [fatihaMatch],
        });
      }

      return NextResponse.json({
        provider,
        transcript,
        matches: [],
        warning:
          "The clip transcribed, but the matcher could not confidently map it to a Quran ayah range. Try a cleaner recitation or use override audio.",
      });
    }

    return NextResponse.json({
      provider,
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
    "-t",
    "180",          // limit to first 3 minutes — enough for detection
    "-c:a",
    "pcm_s16le",
    outputPath,
  ]);
}

async function enrichMatchWithTiming(
  match: AyahDetectionMatch,
  clipDuration: number,
  silenceRanges: SilenceRange[],
  transcriptChunks: TranscriptChunk[],
  leadingSegments: Array<{
    kind: "istiadha" | "basmala" | "fatiha" | "ameen";
    arabic?: string;
    start: number;
    end: number;
  }>,
  transcript?: string,
  rawWordTimings: WordTiming[] = []
): Promise<AyahDetectionMatch> {
  const range = await getAyahRangeMetadata(
    match.surahNumber,
    match.startAyah,
    match.endAyah
  );

  if (!range || clipDuration <= 0) {
    return match;
  }

  const includedLeadingSegments = selectLeadingSegmentsForMatch(
    leadingSegments,
    match.surahNumber,
    range.ayahs[0]?.text ?? ""
  );
  const timingWindowStart = getLeadingTimingOffset(includedLeadingSegments);
  const timingTranscriptChunks = timingWindowStart > 0
    ? trimTranscriptChunksAfterTime(transcriptChunks, timingWindowStart)
    : transcriptChunks;

  const chunkAlignedTimings = buildAyahTimingSegmentsFromTranscriptChunks(
    range.ayahs,
    clipDuration,
    timingTranscriptChunks,
    timingWindowStart
  );

  if (chunkAlignedTimings) {
    const enrichedTimings = attachWordTimingsToSegments(
      chunkAlignedTimings,
      range.ayahs,
      rawWordTimings
    );
    const leadingSegmentsWithTimings = await hydrateLeadingSegmentsForMatch(
      includedLeadingSegments,
      transcriptChunks,
      silenceRanges,
      enrichedTimings[0]?.start,
      clipDuration,
      transcript
    );

    return {
      ...match,
      timings: enrichedTimings,
      timingSource: "chunks",
      leadingSegments: leadingSegmentsWithTimings,
    };
  }

  const timings = buildAyahTimingSegments(
    range.ayahs.map((ayah) => ({
      ayahNum: ayah.numberInSurah,
      wordCount: ayah.wordCount,
    })),
    clipDuration,
    silenceRanges,
    timingWindowStart
  );

  const enrichedTimings = attachWordTimingsToSegments(
    timings.segments,
    range.ayahs,
    rawWordTimings
  );

  const leadingSegmentsWithTimings = await hydrateLeadingSegmentsForMatch(
    includedLeadingSegments,
    transcriptChunks,
    silenceRanges,
    enrichedTimings[0]?.start,
    clipDuration,
    transcript
  );

  return {
    ...match,
    timings: enrichedTimings,
    timingSource: timings.source,
    leadingSegments: leadingSegmentsWithTimings,
  };
}

function attachWordTimingsToSegments(
  segments: AyahTimingSegment[],
  ayahs: Array<{ numberInSurah: number; text: string; wordCount: number }>,
  rawWordTimings: WordTiming[]
): AyahTimingSegment[] {
  if (rawWordTimings.length === 0) {
    return segments;
  }

  return segments.map((segment) => {
    const ayah = ayahs.find((a) => a.numberInSurah === segment.ayahNum);
    if (!ayah) {
      return segment;
    }

    // Filter raw word timings to those overlapping this segment's time window
    const overlapping = rawWordTimings.filter(
      (wt) => wt.end > segment.start && wt.start < segment.end
    );

    const words = alignWordsToQuranText(
      ayah.text,
      overlapping,
      segment.start,
      segment.end
    );

    return { ...segment, words };
  });
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

function extractWordTimings(payload: unknown): WordTiming[] {
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
        ? (chunk as { text: string }).text.trim()
        : "";
      const timestamp = normalizeChunkTimestamp(
        (chunk as { timestamp?: unknown }).timestamp
      );

      if (!text || !timestamp) {
        return null;
      }

      return {
        word: text,
        start: timestamp[0],
        end: timestamp[1],
      };
    })
    .filter((timing): timing is WordTiming => Boolean(timing));
}

async function transcribeAudio(
  audioBuffer: Buffer,
  audioPath: string,
  token: string | null
) {
  // Priority 1: Groq Whisper API (free, fastest — ~2s)
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      console.log("[ayah-detect] trying Groq Whisper...");
      const result = await transcribeWithGroq(audioPath, groqKey);
      return {
        transcript: result.transcript,
        chunks: result.chunks,
        wordTimings: result.wordTimings,
        provider: "groq:whisper-large-v3-turbo",
      };
    } catch (error) {
      console.warn("[ayah-detect] Groq failed, trying fallbacks:", (error as Error).message);
    }
  }

  // Priority 2: OpenAI Whisper API (paid, fast, word-level timestamps)
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      console.log("[ayah-detect] trying OpenAI Whisper...");
      const result = await transcribeWithOpenAI(audioPath, openaiKey);
      return {
        transcript: result.transcript,
        chunks: result.chunks,
        wordTimings: result.wordTimings,
        provider: "openai:whisper-1",
      };
    } catch (error) {
      console.warn("[ayah-detect] OpenAI failed, trying fallbacks:", (error as Error).message);
    }
  }

  // Priority 3: HuggingFace Inference API
  let huggingFaceError: Error | null = null;
  if (token) {
    try {
      const { transcript, model, chunks, wordTimings } = await transcribeWithHuggingFace(
        audioBuffer,
        token
      );

      return {
        transcript,
        chunks,
        wordTimings,
        provider: `huggingface:${model}`,
      };
    } catch (error) {
      huggingFaceError =
        error instanceof Error ? error : new Error(String(error));

      if (!shouldFallbackToLocalWhisper(huggingFaceError)) {
        throw huggingFaceError;
      }
    }
  }

  // Priority 4: Local MLX Whisper
  try {
    const localResult = await transcribeLocally(audioPath);
    return {
      transcript: localResult.transcript,
      chunks: localResult.chunks,
      wordTimings: localResult.wordTimings,
      provider: `local:${LOCAL_WHISPER_MODEL}`,
    };
  } catch (localError) {
    const localMessage =
      localError instanceof Error ? localError.message : String(localError);

    if (huggingFaceError) {
      throw new Error(
        `${huggingFaceError.message} Local fallback also failed: ${localMessage}`
      );
    }

    throw new Error(
      `Ayah detection needs either an OpenAI API key, a Hugging Face token, or local MLX Whisper. Local fallback failed: ${localMessage}`
    );
  }
}

async function transcribeWithGroq(
  audioPath: string,
  apiKey: string
): Promise<{ transcript: string; chunks: TranscriptChunk[]; wordTimings: WordTiming[] }> {
  // Convert WAV to MP3 for faster upload
  const mp3Path = audioPath.replace(/\.wav$/, "-groq.mp3");
  try {
    await runProcess(process.env.FFMPEG_PATH ?? "ffmpeg", [
      "-y", "-i", audioPath, "-ac", "1", "-ar", "16000", "-b:a", "64k", "-f", "mp3", mp3Path,
    ]);
  } catch {
    // Fall back to WAV
  }

  const useMp3 = await fs.stat(mp3Path).then(() => true).catch(() => false);
  const uploadPath = useMp3 ? mp3Path : audioPath;
  const uploadName = useMp3 ? "audio.mp3" : "audio.wav";
  const uploadType = useMp3 ? "audio/mpeg" : "audio/wav";

  const audioData = await fs.readFile(uploadPath);
  console.log(`[ayah-detect] Groq uploading ${uploadName}: ${(audioData.length / 1024).toFixed(0)} KB`);
  const blob = new Blob([audioData], { type: uploadType });

  const formData = new FormData();
  formData.append("file", blob, uploadName);
  formData.append("model", "whisper-large-v3-turbo");
  formData.append("language", "ar");
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "word");
  formData.append("timestamp_granularities[]", "segment");

  const t0 = Date.now();
  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq Whisper API error ${response.status}: ${errorText}`);
  }

  const result = await response.json() as {
    text?: string;
    segments?: Array<{ text?: string; start?: number; end?: number }>;
    words?: Array<{ word?: string; start?: number; end?: number }>;
  };
  console.log(`[ayah-detect] Groq responded in ${Date.now() - t0}ms`);

  const transcript = (result.text ?? "").trim();
  if (!transcript) {
    throw new Error("Groq Whisper returned empty transcript");
  }

  const chunks: TranscriptChunk[] = (result.segments ?? [])
    .map((seg) => ({
      text: (seg.text ?? "").trim(),
      start: Number(seg.start),
      end: Number(seg.end),
    }))
    .filter((c) => c.text && Number.isFinite(c.start) && Number.isFinite(c.end) && c.end > c.start);

  const wordTimings: WordTiming[] = (result.words ?? [])
    .map((w) => ({
      word: (w.word ?? "").trim(),
      start: Number(w.start),
      end: Number(w.end),
    }))
    .filter((w) => w.word && Number.isFinite(w.start) && Number.isFinite(w.end) && w.end > w.start);

  // Clean up temp MP3
  if (useMp3) await fs.rm(mp3Path, { force: true }).catch(() => {});

  return { transcript, chunks, wordTimings };
}

async function transcribeWithOpenAI(
  audioPath: string,
  apiKey: string
): Promise<{ transcript: string; chunks: TranscriptChunk[]; wordTimings: WordTiming[] }> {
  // Convert WAV to MP3 for much faster upload (~10x smaller)
  const mp3Path = audioPath.replace(/\.wav$/, ".mp3");
  try {
    await runProcess(process.env.FFMPEG_PATH ?? "ffmpeg", [
      "-y", "-i", audioPath, "-ac", "1", "-ar", "16000", "-b:a", "64k", "-f", "mp3", mp3Path,
    ]);
  } catch {
    // Fall back to WAV if MP3 conversion fails
  }

  const useMp3 = await fs.stat(mp3Path).then(() => true).catch(() => false);
  const uploadPath = useMp3 ? mp3Path : audioPath;
  const uploadName = useMp3 ? "audio.mp3" : "audio.wav";
  const uploadType = useMp3 ? "audio/mpeg" : "audio/wav";

  const audioData = await fs.readFile(uploadPath);
  console.log(`[ayah-detect] uploading ${uploadName}: ${(audioData.length / 1024).toFixed(0)} KB`);
  const blob = new Blob([audioData], { type: uploadType });

  const formData = new FormData();
  formData.append("file", blob, uploadName);
  formData.append("model", "whisper-1");
  formData.append("language", "ar");
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "word");
  formData.append("timestamp_granularities[]", "segment");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI Whisper API error ${response.status}: ${errorText}`);
  }

  const result = await response.json() as {
    text?: string;
    segments?: Array<{ text?: string; start?: number; end?: number }>;
    words?: Array<{ word?: string; start?: number; end?: number }>;
  };

  const transcript = (result.text ?? "").trim();
  if (!transcript) {
    throw new Error("OpenAI Whisper returned empty transcript");
  }

  const chunks: TranscriptChunk[] = (result.segments ?? [])
    .map((seg) => ({
      text: (seg.text ?? "").trim(),
      start: Number(seg.start),
      end: Number(seg.end),
    }))
    .filter((c) => c.text && Number.isFinite(c.start) && Number.isFinite(c.end) && c.end > c.start);

  const wordTimings: WordTiming[] = (result.words ?? [])
    .map((w) => ({
      word: (w.word ?? "").trim(),
      start: Number(w.start),
      end: Number(w.end),
    }))
    .filter((w) => w.word && Number.isFinite(w.start) && Number.isFinite(w.end) && w.end > w.start);

  return { transcript, chunks, wordTimings };
}

async function transcribeWithModel(
  audioBuffer: Buffer,
  token: string,
  model: string
): Promise<{ transcript: string; chunks: TranscriptChunk[]; wordTimings: WordTiming[] }> {
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
  // Try word-level timestamps first for per-word timing
  const wordLevelResult = await tryWordLevelTranscription(audioBuffer, token, model);
  if (wordLevelResult) {
    return wordLevelResult;
  }

  // Fall back to chunk-level timestamps
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
    wordTimings: [] as WordTiming[],
  };
}

async function tryWordLevelTranscription(
  audioBuffer: Buffer,
  token: string,
  model: string
): Promise<{ transcript: string; chunks: TranscriptChunk[]; wordTimings: WordTiming[] } | null> {
  try {
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
            return_timestamps: "word",
          },
        }),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const status = response.status;
      // 400/422 means the model doesn't support word-level — fall back silently
      if (status === 400 || status === 422) {
        return null;
      }
      // Other errors should propagate normally via the chunk-level path
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
    const transcript =
      typeof payload === "string" ? payload : payload?.text ?? "";

    if (!transcript || typeof transcript !== "string") {
      return null;
    }

    const wordTimings = extractWordTimings(payload);

    return {
      transcript,
      chunks: extractTranscriptChunks(payload),
      wordTimings,
    };
  } catch {
    // Any network/parse error — fall back to chunk-level
    return null;
  }
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
    wordTimings: [] as WordTiming[],
  };
}

async function transcribeSpeechSegments(
  audioPath: string,
  clipDuration: number,
  silenceRanges: SilenceRange[],
  token: string | null
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
      const { transcript } = await transcribeAudio(audioBuffer, chunkPath, token);

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

async function transcribeLocally(audioPath: string) {
  const scriptPath = path.join(
    process.cwd(),
    "scripts",
    "mlx_whisper_transcribe.py"
  );

  const stdout = await runProcessWithOutput(UV_PATH, [
    "run",
    "--python",
    "3.12",
    "--with",
    "mlx-whisper==0.4.3",
    "python",
    scriptPath,
    audioPath,
    LOCAL_WHISPER_MODEL,
  ]);

  const payload = JSON.parse(stdout) as {
    text?: string;
    segments?: Array<{
      text?: string;
      start?: number;
      end?: number;
      words?: Array<{
        word?: string;
        start?: number;
        end?: number;
      }>;
    }>;
  };
  const transcript = payload.text?.trim() ?? "";

  if (!transcript) {
    throw new Error("Local MLX Whisper returned no transcript text.");
  }

  const chunks = Array.isArray(payload.segments)
    ? payload.segments
        .map((segment) => ({
          text: segment.text?.trim() ?? "",
          start: Number(segment.start),
          end: Number(segment.end),
        }))
        .filter(
          (segment) =>
            segment.text &&
            Number.isFinite(segment.start) &&
            Number.isFinite(segment.end) &&
            segment.end > segment.start
        )
    : [];

  const wordTimings: WordTiming[] = [];
  if (Array.isArray(payload.segments)) {
    for (const segment of payload.segments) {
      if (Array.isArray(segment.words)) {
        for (const w of segment.words) {
          const word = (w.word ?? "").trim();
          const start = Number(w.start);
          const end = Number(w.end);
          if (word && Number.isFinite(start) && Number.isFinite(end) && end > start) {
            wordTimings.push({ word, start, end });
          }
        }
      }
    }
  }

  return {
    transcript,
    chunks,
    wordTimings,
  };
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

function shouldFallbackToLocalWhisper(error: Error) {
  return (
    error.message.includes(" 402 ") ||
    error.message.includes("depleted your monthly included credits") ||
    error.message.includes("billing") ||
    isMissingHostedModelError(error)
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
  let cursor = 0;

  for (const silence of silenceRanges) {
    if (silence.start - cursor >= MIN_SPEECH_SEGMENT_SECONDS) {
      speechSegments.push({
        start: cursor,
        end: silence.start,
      });
    } else if (silence.start > cursor && speechSegments.length > 0) {
      // Merge short fragments into the previous segment instead of dropping them
      speechSegments[speechSegments.length - 1].end = silence.start;
    }

    cursor = Math.max(cursor, silence.end);
  }

  if (clipDuration - cursor >= MIN_SPEECH_SEGMENT_SECONDS) {
    speechSegments.push({
      start: cursor,
      end: clipDuration,
    });
  } else if (clipDuration > cursor && speechSegments.length > 0) {
    // Merge trailing short fragment into previous segment
    speechSegments[speechSegments.length - 1].end = clipDuration;
  }

  return mergeSegmentsDownToLimit(
    splitLongSpeechSegments(speechSegments),
    MAX_TRANSCRIPT_CHUNKS
  );
}

function splitLongSpeechSegments(segments: Array<{ start: number; end: number }>) {
  const expanded: Array<{ start: number; end: number }> = [];

  for (const segment of segments) {
    const duration = segment.end - segment.start;
    if (duration <= MAX_TRANSCRIPT_CHUNK_SECONDS) {
      expanded.push(segment);
      continue;
    }

    const partCount = Math.ceil(duration / MAX_TRANSCRIPT_CHUNK_SECONDS);
    const partDuration = duration / partCount;

    for (let index = 0; index < partCount; index += 1) {
      const start = segment.start + partDuration * index;
      const end =
        index === partCount - 1
          ? segment.end
          : segment.start + partDuration * (index + 1);

      if (end - start >= MIN_SPEECH_SEGMENT_SECONDS) {
        expanded.push({ start, end });
      }
    }
  }

  return expanded;
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

function detectLeadingRecitationSegments(
  transcript: string,
  transcriptChunks: TranscriptChunk[],
  clipDuration: number
) {
  if (clipDuration <= 0) {
    return [] as Array<{
      kind: "istiadha" | "basmala" | "fatiha" | "ameen";
      arabic?: string;
      start: number;
      end: number;
    }>;
  }

  const leadingSegments: Array<{
    kind: "istiadha" | "basmala" | "fatiha" | "ameen";
    arabic?: string;
    start: number;
    end: number;
  }> = [];

  const normalizedTranscript = normalizeArabicText(transcript);
  let workingChunks = transcriptChunks;
  let currentStart = 0;

  const pushSegment = (
    segment: {
      kind: "istiadha" | "basmala" | "fatiha" | "ameen";
      arabic?: string;
      start: number;
      end: number;
    } | null
  ) => {
    if (!segment) {
      return;
    }

    leadingSegments.push({
      ...segment,
      end: Math.min(Math.max(segment.end, segment.start + 0.1), clipDuration),
    });
    currentStart = leadingSegments[leadingSegments.length - 1].end;
    workingChunks = trimTranscriptChunksAfterTime(transcriptChunks, currentStart);
  };

  if (hasLeadingIstiadha(normalizedTranscript)) {
    pushSegment(
      detectLeadingPhraseSegment({
        transcriptChunks: workingChunks,
        clipDuration,
        startOffset: currentStart,
        kind: "istiadha",
        displayText: ISTIADHA_DISPLAY_TEXT,
        matchTexts: [...ISTIADHA_MATCH_TEXTS],
        fallbackDuration: 1.8,
        maxChunks: 2,
      })
    );
  }

  if (hasLikelyLeadingFatiha(stripLeadingRecitationIntroPrefix(normalizedTranscript, "istiadha"))) {
    pushSegment(
      detectLeadingPhraseSegment({
        transcriptChunks: workingChunks,
        clipDuration,
        startOffset: currentStart,
        kind: "fatiha",
        displayText: undefined,
        matchTexts: [FATIHA_MATCH_TEXT],
        fallbackDuration: 8.5,
        maxChunks: 8,
        minScore: 0.5,
      })
    );
  } else if (hasLeadingBasmala(stripLeadingRecitationIntroPrefix(normalizedTranscript, "istiadha"))) {
    pushSegment(
      detectLeadingPhraseSegment({
        transcriptChunks: workingChunks,
        clipDuration,
        startOffset: currentStart,
        kind: "basmala",
        displayText: BASMALA_DISPLAY_TEXT,
        matchTexts: [BASMALA_MATCH_TEXT],
        fallbackDuration: 2.2,
        maxChunks: 3,
      })
    );
  }

  if (
    leadingSegments.some((segment) => segment.kind === "fatiha")
  ) {
    pushSegment(
      detectLeadingPhraseSegment({
        transcriptChunks: workingChunks,
        clipDuration,
        startOffset: currentStart,
        kind: "ameen",
        displayText: AMEEN_DISPLAY_TEXT,
        matchTexts: [AMEEN_MATCH_TEXT],
        fallbackDuration: 0.8,
        maxChunks: 3,
        minScore: 0.34,
        maxDuration: 1.4,
        maxWords: 3,
      })
    );
  }

  if (
    leadingSegments.some((segment) => segment.kind === "fatiha")
  ) {
    pushSegment(
      detectLeadingPhraseSegment({
        transcriptChunks: workingChunks,
        clipDuration,
        startOffset: currentStart,
        kind: "basmala",
        displayText: BASMALA_DISPLAY_TEXT,
        matchTexts: [BASMALA_MATCH_TEXT],
        fallbackDuration: 2.2,
        maxChunks: 3,
        minScore: 0.54,
        maxDuration: 4.5,
      })
    );
  }

  return leadingSegments;
}

function detectLeadingPhraseSegment(options: {
  transcriptChunks: TranscriptChunk[];
  clipDuration: number;
  startOffset: number;
  kind: "istiadha" | "basmala" | "fatiha" | "ameen";
  displayText?: string;
  matchTexts: string[];
  fallbackDuration: number;
  maxChunks: number;
  minScore?: number;
  maxDuration?: number;
  maxWords?: number;
}) {
  const {
    transcriptChunks,
    clipDuration,
    startOffset,
    kind,
    displayText,
    matchTexts,
    fallbackDuration,
    maxChunks,
    minScore = 0.62,
    maxDuration,
    maxWords,
  } = options;

  if (transcriptChunks.length === 0) {
    return {
      kind,
      arabic: displayText,
      start: startOffset,
      end: Math.min(clipDuration, startOffset + fallbackDuration),
    };
  }

  let cumulativeText = "";
  let cumulativeEnd = startOffset;
  let best:
    | {
        score: number;
        end: number;
        text: string;
        matchText: string;
      }
    | null = null;

  for (const chunk of transcriptChunks.slice(0, maxChunks)) {
    cumulativeText = `${cumulativeText} ${chunk.text}`.trim();
    cumulativeEnd = chunk.end;
    const cumulativeDuration = cumulativeEnd - startOffset;
    const cumulativeWordCount = countWords(normalizeArabicText(cumulativeText));

    if (
      (typeof maxDuration === "number" && cumulativeDuration > maxDuration) ||
      (typeof maxWords === "number" && cumulativeWordCount > maxWords)
    ) {
      break;
    }

    for (const matchText of matchTexts) {
      const score = scoreArabicTextSimilarity(cumulativeText, matchText);
      if (!best || score > best.score) {
        best = {
          score,
          end: cumulativeEnd,
          text: cumulativeText,
          matchText,
        };
      }
    }
  }

  if (!best || best.score < minScore) {
    return null;
  }

  const targetWords = getLeadingTargetWordCount(kind, best.text, best.matchText);
  const totalWords = Math.max(countWords(best.text), targetWords);
  const estimatedEnd = Math.max(
    startOffset + 0.6,
    Math.min(
      best.end,
      startOffset + (best.end - startOffset) * (targetWords / totalWords)
    )
  );

  return {
    kind,
    arabic: displayText,
    start: startOffset,
    end: Math.min(estimatedEnd, clipDuration),
  };
}

function getLeadingTargetWordCount(
  kind: "istiadha" | "basmala" | "fatiha" | "ameen",
  cumulativeText: string,
  matchText: string
) {
  const defaultWordCount = countWords(matchText);

  if (kind !== "fatiha") {
    return defaultWordCount;
  }

  const words = normalizeArabicText(cumulativeText).split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return defaultWordCount;
  }

  let targetWords = defaultWordCount;
  const secondBasmalaIndex = findPhraseWordIndex(
    words,
    BASMALA_MATCH_TEXT.split(" "),
    BASMALA_MATCH_TEXT.split(" ").length
  );
  const ameenIndex = findPhraseWordIndex(
    words,
    [AMEEN_MATCH_TEXT],
    Math.max(1, defaultWordCount - 4)
  );

  if (secondBasmalaIndex > 0) {
    targetWords = Math.min(targetWords, secondBasmalaIndex);
  }

  if (ameenIndex > 0) {
    targetWords = Math.min(targetWords, ameenIndex);
  }

  return Math.max(1, targetWords);
}

function findPhraseWordIndex(
  words: string[],
  phraseWords: string[],
  startIndex: number
) {
  if (phraseWords.length === 0) {
    return -1;
  }

  for (let index = startIndex; index <= words.length - phraseWords.length; index += 1) {
    let matched = true;

    for (let phraseIndex = 0; phraseIndex < phraseWords.length; phraseIndex += 1) {
      if (words[index + phraseIndex] !== phraseWords[phraseIndex]) {
        matched = false;
        break;
      }
    }

    if (matched) {
      return index;
    }
  }

  return -1;
}

function mergeAyahMatches(
  baseMatches: AyahDetectionMatch[],
  preferredMatches: AyahDetectionMatch[]
) {
  const merged = new Map<string, AyahDetectionMatch>();

  for (const match of [...baseMatches, ...preferredMatches]) {
    const key = `${match.surahNumber}:${match.startAyah}:${match.endAyah}`;
    const existing = merged.get(key);
    if (!existing || match.score > existing.score) {
      merged.set(key, match);
    }
  }

  return Array.from(merged.values())
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
}

function getLeadingTimingOffset(
  leadingSegments: Array<{ start: number; end: number }>
) {
  return leadingSegments[leadingSegments.length - 1]?.end ?? 0;
}

function selectLeadingSegmentsForMatch(
  leadingSegments: Array<{
    kind: "istiadha" | "basmala" | "fatiha" | "ameen";
    arabic?: string;
    start: number;
    end: number;
    timings?: AyahTimingSegment[];
  }>,
  surahNumber: number,
  firstAyahText: string
) {
  if (surahNumber === 1) {
    const fatihaIndex = leadingSegments.findIndex(
      (segment) => segment.kind === "fatiha"
    );
    return fatihaIndex >= 0
      ? leadingSegments.slice(0, fatihaIndex)
      : leadingSegments;
  }

  return leadingSegments.filter(
    (segment) =>
      segment.kind !== "basmala" || !startsWithBasmala(firstAyahText)
  );
}

function clampLeadingSegmentsToFirstTiming(
  leadingSegments: Array<{
    kind: "istiadha" | "basmala" | "fatiha" | "ameen";
    arabic?: string;
    start: number;
    end: number;
    timings?: AyahTimingSegment[];
  }>,
  firstTimingStart: number | undefined
) {
  if (leadingSegments.length === 0) {
    return undefined;
  }

  return leadingSegments.map((segment, index) => {
    const nextStart =
      index === leadingSegments.length - 1 ? firstTimingStart : leadingSegments[index + 1]?.start;

    return {
      ...segment,
      end:
        typeof nextStart === "number"
          ? Math.min(segment.end, nextStart)
          : segment.end,
    };
  });
}

async function hydrateLeadingSegmentsForMatch(
  leadingSegments: Array<{
    kind: "istiadha" | "basmala" | "fatiha" | "ameen";
    arabic?: string;
    start: number;
    end: number;
    timings?: AyahTimingSegment[];
  }>,
  transcriptChunks: TranscriptChunk[],
  silenceRanges: SilenceRange[],
  firstTimingStart: number | undefined,
  clipDuration: number,
  transcript?: string
) {
  const clampedLeadingSegments = clampLeadingSegmentsToFirstTiming(
    leadingSegments,
    firstTimingStart
  );

  if (!clampedLeadingSegments) {
    return undefined;
  }

  const hydratedSegments = await Promise.all(
    clampedLeadingSegments.map(async (segment) => {
      const windowChunks = clipTranscriptChunksToWindow(
        transcriptChunks,
        segment.start,
        segment.end
      );
      const snappedSegment = snapLeadingSegmentToSpeech(segment, windowChunks);

      if (segment.kind !== "fatiha") {
        return snappedSegment;
      }

      const fatihaRange = await getAyahRangeMetadata(1, 1, 7);
      if (!fatihaRange) {
        return snappedSegment;
      }

      const timings =
        buildAyahTimingSegmentsFromTranscriptChunks(
          fatihaRange.ayahs,
          snappedSegment.end,
          windowChunks,
          snappedSegment.start
        ) ??
        buildAyahTimingSegments(
          fatihaRange.ayahs.map((ayah) => ({
            ayahNum: ayah.numberInSurah,
            wordCount: ayah.wordCount,
          })),
          snappedSegment.end,
          silenceRanges,
          snappedSegment.start
        ).segments;

      return {
        ...snappedSegment,
        timings,
      };
    })
  );

  return injectSyntheticPostFatihaSegments(
    hydratedSegments,
    firstTimingStart,
    clipDuration,
    transcript
  );
}

function clipTranscriptChunksToWindow(
  transcriptChunks: TranscriptChunk[],
  windowStart: number,
  windowEnd: number
) {
  return transcriptChunks
    .map((chunk) => ({
      ...chunk,
      start: Math.max(chunk.start, windowStart),
      end: Math.min(chunk.end, windowEnd),
    }))
    .filter((chunk) => chunk.end > chunk.start);
}

function snapLeadingSegmentToSpeech(
  segment: {
    kind: "istiadha" | "basmala" | "fatiha" | "ameen";
    arabic?: string;
    start: number;
    end: number;
    timings?: AyahTimingSegment[];
  },
  transcriptChunks: TranscriptChunk[]
) {
  if (transcriptChunks.length === 0) {
    return segment;
  }

  const speechStart = transcriptChunks[0].start;
  const speechEnd = transcriptChunks[transcriptChunks.length - 1].end;

  return {
    ...segment,
    start: Math.max(segment.start, speechStart),
    end: Math.min(segment.end, speechEnd),
  };
}

function injectSyntheticPostFatihaSegments(
  leadingSegments: Array<{
    kind: "istiadha" | "basmala" | "fatiha" | "ameen";
    arabic?: string;
    start: number;
    end: number;
    timings?: AyahTimingSegment[];
  }>,
  firstTimingStart: number | undefined,
  clipDuration: number,
  transcript?: string
) {
  if (!transcript || typeof firstTimingStart !== "number") {
    return leadingSegments;
  }

  const fatihaIndex = leadingSegments.findIndex(
    (segment) => segment.kind === "fatiha"
  );
  if (fatihaIndex < 0) {
    return leadingSegments;
  }

  const fatihaSegment = leadingSegments[fatihaIndex];
  const postFatihaCue = detectPostFatihaCue(transcript);
  if (!postFatihaCue.hasAmeen && !postFatihaCue.hasBasmala) {
    return leadingSegments;
  }

  const existingTrailingSegments = leadingSegments.slice(fatihaIndex + 1);
  const hasExistingAmeen = existingTrailingSegments.some(
    (segment) => segment.kind === "ameen"
  );
  const hasExistingBasmala = existingTrailingSegments.some(
    (segment) => segment.kind === "basmala"
  );

  const syntheticSegments: Array<{
    kind: "ameen" | "basmala";
    arabic?: string;
    start: number;
    end: number;
  }> = [];
  let cursor = firstTimingStart;

  if (postFatihaCue.hasBasmala && !hasExistingBasmala) {
    const duration = 1.9;
    syntheticSegments.unshift({
      kind: "basmala",
      arabic: BASMALA_DISPLAY_TEXT,
      start: Math.max(fatihaSegment.start, cursor - duration),
      end: cursor,
    });
    cursor = syntheticSegments[0].start - 0.08;
  }

  if (postFatihaCue.hasAmeen && !hasExistingAmeen) {
    const duration = 0.72;
    syntheticSegments.unshift({
      kind: "ameen",
      arabic: AMEEN_DISPLAY_TEXT,
      start: Math.max(fatihaSegment.start, cursor - duration),
      end: cursor,
    });
    cursor = syntheticSegments[0].start - 0.08;
  }

  if (syntheticSegments.length === 0) {
    return leadingSegments;
  }

  const fatihaEnd = Math.max(
    fatihaSegment.start,
    syntheticSegments[0].start - 0.08
  );
  const nextFatihaTimings =
    fatihaSegment.timings?.length
      ? [
          ...fatihaSegment.timings.slice(0, -1),
          {
            ...fatihaSegment.timings[fatihaSegment.timings.length - 1],
            end: Math.max(
              fatihaSegment.timings[fatihaSegment.timings.length - 1].start,
              fatihaEnd
            ),
          },
        ]
      : fatihaSegment.timings;

  return [
    ...leadingSegments.slice(0, fatihaIndex),
    {
      ...fatihaSegment,
      end: fatihaEnd,
      timings: nextFatihaTimings,
    },
    ...syntheticSegments,
    ...existingTrailingSegments,
  ].filter((segment) => segment.end > segment.start);
}

function detectPostFatihaCue(transcript: string) {
  const words = normalizeArabicText(transcript).split(/\s+/).filter(Boolean);
  const basmalaWords = BASMALA_MATCH_TEXT.split(" ");
  const secondBasmalaIndex = findPhraseWordIndex(
    words,
    basmalaWords,
    basmalaWords.length
  );
  const ameenIndex = findPhraseWordIndex(
    words,
    [AMEEN_MATCH_TEXT],
    Math.max(1, countWords(FATIHA_MATCH_TEXT) - 4)
  );

  return {
    hasAmeen:
      ameenIndex >= 0 &&
      (secondBasmalaIndex < 0 || ameenIndex < secondBasmalaIndex),
    hasBasmala: secondBasmalaIndex >= 0,
  };
}

function buildTranscriptFromChunks(transcriptChunks: TranscriptChunk[]) {
  return transcriptChunks.map((chunk) => chunk.text.trim()).filter(Boolean).join(" ").trim();
}

function stripLeadingRecitationIntroPrefix(
  text: string,
  ...segmentKinds: Array<"istiadha" | "fatiha" | "ameen" | "basmala">
) {
  let current = normalizeArabicText(text);

  for (const kind of segmentKinds) {
    if (kind === "istiadha") {
      current = stripSpecificLeadingText(current, ISTIADHA_MATCH_TEXTS);
    } else if (kind === "fatiha") {
      current = stripSpecificLeadingText(current, [FATIHA_MATCH_TEXT]);
    } else if (kind === "ameen") {
      current = stripSpecificLeadingText(current, [AMEEN_MATCH_TEXT]);
    } else {
      current = stripSpecificLeadingText(current, [BASMALA_MATCH_TEXT]);
    }
  }

  return current;
}

function stripSpecificLeadingText(input: string, candidates: readonly string[]) {
  for (const candidate of candidates) {
    if (input === candidate) {
      return "";
    }

    if (input.startsWith(`${candidate} `)) {
      return input.slice(candidate.length).trim();
    }
  }

  return input;
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

async function runProcessWithOutput(command: string, args: string[]) {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
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
  silenceRanges: SilenceRange[],
  startOffset = 0
) {
  const effectiveStart = Math.min(Math.max(startOffset, 0), clipDuration);
  const effectiveDuration = clipDuration - effectiveStart;

  if (ayahs.length === 0 || effectiveDuration <= 0) {
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
          start: effectiveStart,
          end: clipDuration,
        },
      ],
      source: "weighted" as const,
    };
  }

  const internalSilences = silenceRanges
    .filter(
      (range) =>
        range.start > effectiveStart + SILENCE_EDGE_PADDING_SECONDS &&
        range.end < clipDuration - SILENCE_EDGE_PADDING_SECONDS
    )
    .sort((left, right) => left.midpoint - right.midpoint);

  const boundaryCount = ayahs.length - 1;
  const weightedBoundaries = buildWeightedBoundaries(
    ayahs,
    effectiveStart,
    clipDuration
  );
  const selectedSilenceMidpoints = alignSilencesToExpectedBoundaries(
    weightedBoundaries,
    internalSilences,
    effectiveDuration
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
          effectiveStart,
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
    effectiveStart,
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
  transcriptChunks: TranscriptChunk[],
  startOffset = 0
) {
  const effectiveStart = Math.min(Math.max(startOffset, 0), clipDuration);
  const effectiveDuration = clipDuration - effectiveStart;
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
        chunk.end > chunk.start &&
        chunk.end > effectiveStart &&
        chunk.start < clipDuration
    );

  if (effectiveDuration <= 0 || usableChunks.length < ayahs.length) {
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
          effectiveDuration,
          groupScoreCache,
          `${ayahIndex - 1}:${startChunk}-${endChunk}`
        );

        if (groupScore < 0.22) {
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
  if (!Number.isFinite(finalScore) || finalScore / ayahs.length < 0.38) {
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

  const groups = partitions.map((partition) =>
    getTranscriptChunkGroup(
      usableChunks,
      partition.startChunk,
      partition.endChunk,
      groupCache
    )
  );

  // BUG #4 fix: Use the first transcript group's actual start time instead of
  // effectiveStart to avoid subtitles appearing during leading silence
  const firstBoundary = groups.length > 0
    ? Math.max(effectiveStart, groups[0].start - 0.04)
    : effectiveStart;
  const boundaries = [firstBoundary];

  const gapAwareSegments = buildSegmentsFromTranscriptGroups(
    ayahs.map((ayah) => ayah.numberInSurah),
    groups,
    effectiveStart,
    clipDuration
  );

  if (gapAwareSegments) {
    return gapAwareSegments;
  }

  for (let index = 0; index < partitions.length - 1; index += 1) {
    boundaries.push((groups[index].end + groups[index + 1].start) / 2);
  }

  boundaries.push(clipDuration);

  return buildSegmentsFromBoundaries(
    ayahs.map((ayah) => ayah.numberInSurah),
    clampBoundaryPositions(boundaries, effectiveStart, clipDuration)
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
  startOffset: number,
  clipDuration: number
) {
  const totalWeight = ayahs.reduce(
    (sum, ayah) => sum + Math.max(ayah.wordCount, 1),
    0
  );
  const boundaries = [startOffset];
  const effectiveDuration = clipDuration - startOffset;
  let consumedWeight = 0;

  for (let index = 0; index < ayahs.length - 1; index += 1) {
    consumedWeight += Math.max(ayahs[index].wordCount, 1);
    boundaries.push(startOffset + (consumedWeight / totalWeight) * effectiveDuration);
  }

  boundaries.push(clipDuration);
  return boundaries;
}

function mergeBoundaryPositions(
  weightedBoundaries: number[],
  silenceMidpoints: Array<number | null>,
  startOffset: number,
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

  return clampBoundaryPositions(merged, startOffset, clipDuration);
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

function clampBoundaryPositions(
  boundaries: number[],
  startOffset: number,
  clipDuration: number
) {
  const clamped = [...boundaries];
  const minGap = Math.min(0.18, clipDuration / Math.max(boundaries.length * 8, 1));

  clamped[0] = startOffset;
  clamped[clamped.length - 1] = clipDuration;

  // Forward pass: ensure each boundary is at least minGap after the previous
  for (let index = 1; index < clamped.length - 1; index += 1) {
    const previous = clamped[index - 1] + minGap;
    const next = clamped[index + 1] - minGap;
    clamped[index] = Math.min(next, Math.max(previous, clamped[index]));
  }

  // Backward pass: fix any remaining inversions caused by forward cascade
  for (let index = clamped.length - 2; index >= 1; index -= 1) {
    if (clamped[index] >= clamped[index + 1]) {
      clamped[index] = clamped[index + 1] - minGap;
    }
    if (clamped[index] <= clamped[index - 1]) {
      // If we still can't satisfy the gap, distribute evenly between neighbors
      clamped[index] = (clamped[index - 1] + clamped[index + 1]) / 2;
    }
  }

  return clamped;
}

function trimTranscriptChunksAfterTime(
  transcriptChunks: TranscriptChunk[],
  cutoffTime: number
) {
  return transcriptChunks.flatMap((chunk) => {
    if (chunk.end <= cutoffTime) {
      return [];
    }

    if (chunk.start >= cutoffTime) {
      return [chunk];
    }

    const duration = chunk.end - chunk.start;
    if (duration <= 0) {
      return [];
    }

    const elapsedRatio = Math.min(
      1,
      Math.max(0, (cutoffTime - chunk.start) / duration)
    );
    const trimmedText = trimChunkTextByElapsedRatio(chunk.text, elapsedRatio);

    if (!trimmedText) {
      return [];
    }

    return [
      {
        text: trimmedText,
        start: cutoffTime,
        end: chunk.end,
      },
    ];
  });
}

function trimChunkTextByElapsedRatio(text: string, elapsedRatio: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);

  if (words.length <= 1) {
    return elapsedRatio < 0.7 ? text.trim() : "";
  }

  const dropCount = Math.min(
    words.length - 1,
    Math.max(0, Math.round(words.length * elapsedRatio))
  );

  return words.slice(dropCount).join(" ").trim();
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

function buildSegmentsFromTranscriptGroups(
  ayahNumbers: number[],
  groups: Array<{ start: number; end: number }>,
  startOffset: number,
  clipDuration: number
) {
  if (groups.length !== ayahNumbers.length || groups.length === 0) {
    return null;
  }

  const segments: AyahTimingSegment[] = [];
  const edgePadding = 0.04;
  const minDuration = 0.12;
  // BUG #4 fix: Start from the first group's actual speech time, not the
  // startOffset (which may be 0), to avoid showing subtitles during leading silence
  const firstGroupStart = Math.max(startOffset, groups[0].start - edgePadding);
  let previousEnd = firstGroupStart;

  for (let index = 0; index < groups.length; index += 1) {
    const isLast = index === groups.length - 1;
    const group = groups[index];
    const nextGroup = groups[index + 1];

    // For start: use previous segment's end to eliminate gaps.
    // Only use group.start - padding if it's >= previousEnd (no gap).
    const rawStart = Math.max(startOffset, group.start - edgePadding);
    const start = Math.max(previousEnd, rawStart);

    // For end: if there's a gap to the next group, split it at the midpoint
    // instead of leaving a dead zone between segments
    let rawEnd: number;
    if (isLast) {
      // Last segment extends to clip end
      rawEnd = clipDuration;
    } else if (nextGroup) {
      const gapBetweenGroups = nextGroup.start - group.end;
      if (gapBetweenGroups > 0) {
        // Split the gap at its midpoint so no timing is unaccounted for
        rawEnd = Math.min(clipDuration, group.end + gapBetweenGroups / 2);
      } else {
        rawEnd = Math.min(clipDuration, group.end + edgePadding, nextGroup.start - edgePadding);
      }
    } else {
      rawEnd = Math.min(clipDuration, group.end + edgePadding);
    }

    const end = Math.max(start + minDuration, rawEnd);

    if (!Number.isFinite(start) || !Number.isFinite(end) || end > clipDuration + 0.001) {
      return null;
    }

    segments.push({
      ayahNum: ayahNumbers[index],
      start,
      end: Math.min(end, clipDuration),
    });
    previousEnd = Math.min(end, clipDuration);
  }

  return segments.every((segment, index) =>
    segment.end > segment.start &&
    (index === 0 || segment.start >= segments[index - 1].end)
  )
    ? segments
    : null;
}

function getWavDurationSeconds(audioBuffer: Buffer) {
  const dataBytes = Math.max(audioBuffer.byteLength - 44, 0);
  return dataBytes / (16000 * 2);
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Detect garbage transcripts -- those with no meaningful Arabic content.
 * Returns true if the normalized transcript has fewer than 2 words or is
 * composed entirely of very short fragments that don't form coherent text.
 */
function isGarbageTranscript(normalizedText: string): boolean {
  if (!normalizedText) return true;

  const wordCount = countWords(normalizedText);
  if (wordCount < 2) return true;

  // Check if the text contains enough Arabic characters
  // (after normalization, non-Arabic chars are stripped to spaces)
  const arabicCharCount = normalizedText.replace(/\s/g, "").length;
  if (arabicCharCount < 4) return true;

  return false;
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
