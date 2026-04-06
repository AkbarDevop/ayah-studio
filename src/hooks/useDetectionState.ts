"use client";

import { useState } from "react";
import {
  MAX_AYAH_DETECT_UPLOAD_BYTES,
  getAyahDetectUploadLimitMessage,
} from "@/lib/ayah-detection-config";
import type { AyahDetectionResult } from "@/types";

export type DetectionPhase =
  | "idle"
  | "preparing"
  | "uploading"
  | "transcribing"
  | "matching";

/** Size threshold below which we skip client-side audio extraction. */
const EXTRACTION_SKIP_BYTES = 5 * 1024 * 1024; // 5 MB
/** Size threshold above which client-side WASM extraction is too slow — let server handle it. */
const EXTRACTION_MAX_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * Extract just the audio track from a video file using FFmpeg.wasm.
 * Returns a small mono MP3 (~500 KB - 2 MB) suitable for speech recognition.
 */
async function extractAudioForDetection(file: File): Promise<File> {
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const { fetchFile, toBlobURL } = await import("@ffmpeg/util");

  const ffmpeg = new FFmpeg();

  const coreURL = await toBlobURL(
    "/ffmpeg/ffmpeg-core.js",
    "text/javascript"
  );
  const wasmURL = await toBlobURL(
    "/ffmpeg/ffmpeg-core.wasm",
    "application/wasm"
  );
  // Try loading worker for multi-threaded build
  let workerURL: string | undefined;
  try {
    workerURL = await toBlobURL(
      "/ffmpeg/ffmpeg-core.worker.js",
      "text/javascript"
    );
  } catch {
    // Worker not available, single-threaded is fine for audio extraction
  }

  await ffmpeg.load(workerURL ? { coreURL, wasmURL, workerURL } : { coreURL, wasmURL });

  await ffmpeg.writeFile("input", await fetchFile(file));
  await ffmpeg.exec([
    "-i",
    "input",
    "-vn",       // strip video
    "-ac",
    "1",         // mono
    "-ar",
    "16000",     // 16 kHz (Whisper native)
    "-b:a",
    "64k",       // low bitrate
    "-f",
    "mp3",
    "output.mp3",
  ]);

  const data = await ffmpeg.readFile("output.mp3");
  ffmpeg.terminate();

  const raw =
    data instanceof Uint8Array
      ? data
      : new TextEncoder().encode(data as string);
  // Copy into a plain ArrayBuffer to satisfy strict BlobPart typing
  const buf = new ArrayBuffer(raw.byteLength);
  new Uint8Array(buf).set(raw);
  const blob = new Blob([buf], { type: "audio/mpeg" });
  return new File([blob], "audio.mp3", { type: "audio/mpeg" });
}

/**
 * Upload a file via XMLHttpRequest so we can track upload progress.
 * Returns the parsed JSON response.
 */
function uploadWithProgress(
  url: string,
  formData: FormData,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal
): Promise<{ ok: boolean; status: number; body: AyahDetectionResult | { error?: string } }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(e.loaded / e.total);
      }
    });

    xhr.addEventListener("load", () => {
      try {
        const body = JSON.parse(xhr.responseText) as
          | AyahDetectionResult
          | { error?: string };
        resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, body });
      } catch {
        reject(new Error("Invalid response from server."));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error during upload.")));
    xhr.addEventListener("abort", () => reject(new Error("Upload aborted.")));

    if (signal) {
      signal.addEventListener("abort", () => xhr.abort());
    }

    xhr.send(formData);
  });
}

export function useDetectionState() {
  const [detectingAyahs, setDetectingAyahs] = useState(false);
  const [detectionPhase, setDetectionPhase] = useState<DetectionPhase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [detectionError, setDetectionError] = useState<string | null>(null);
  const [detectionResult, setDetectionResult] =
    useState<AyahDetectionResult | null>(null);
  const [appliedDetectionMode, setAppliedDetectionMode] = useState<
    "auto" | "manual" | null
  >(null);
  const [appliedDetectionKey, setAppliedDetectionKey] = useState<string | null>(
    null
  );

  async function detectAyahs(sourceFile: File | null) {
    if (!sourceFile) {
      setDetectionError("Upload a clip or override audio before detecting ayahs.");
      return null;
    }

    if (sourceFile.size > MAX_AYAH_DETECT_UPLOAD_BYTES) {
      setDetectionResult(null);
      setAppliedDetectionMode(null);
      setAppliedDetectionKey(null);
      setDetectionError(getAyahDetectUploadLimitMessage());
      return null;
    }

    setDetectingAyahs(true);
    setDetectionError(null);
    setAppliedDetectionMode(null);
    setAppliedDetectionKey(null);
    setUploadProgress(0);

    try {
      // --- Phase 1: Prepare audio ---
      let fileToUpload = sourceFile;
      const isVideo = sourceFile.type.startsWith("video/");
      const isLargeEnough = sourceFile.size > EXTRACTION_SKIP_BYTES;
      const isTooLargeForWasm = sourceFile.size > EXTRACTION_MAX_BYTES;

      if (isVideo && isLargeEnough && !isTooLargeForWasm) {
        setDetectionPhase("preparing");
        try {
          console.log(`[detect] Extracting audio from ${sourceFile.name} (${(sourceFile.size / 1024 / 1024).toFixed(1)} MB)...`);
          fileToUpload = await extractAudioForDetection(sourceFile);
          console.log(`[detect] Extracted audio: ${(fileToUpload.size / 1024).toFixed(0)} KB`);
        } catch (extractErr) {
          console.warn("[detect] Client-side extraction failed, uploading original:", extractErr);
          fileToUpload = sourceFile;
        }
      } else if (!isVideo) {
        console.log(`[detect] Audio file, skipping extraction: ${(sourceFile.size / 1024).toFixed(0)} KB`);
      } else {
        console.log(`[detect] Small file (${(sourceFile.size / 1024).toFixed(0)} KB), skipping extraction`);
      }

      // --- Phase 2: Upload ---
      setDetectionPhase("uploading");
      setUploadProgress(0);

      const formData = new FormData();
      formData.append("media", fileToUpload);

      const { ok, body } = await uploadWithProgress(
        "/api/ayah-detect",
        formData,
        (fraction) => setUploadProgress(Math.round(fraction * 100))
      );

      // --- Phase 3 & 4: Server-side processing ---
      // Once upload completes, the server transcribes then matches.
      // We show "transcribing" briefly, then "matching" on success.
      setDetectionPhase("transcribing");

      if (!ok) {
        throw new Error(
          "error" in body && body.error
            ? body.error
            : "Ayah detection failed."
        );
      }

      setDetectionPhase("matching");
      const result = body as AyahDetectionResult;
      setDetectionResult(result);
      return result;
    } catch (err) {
      setDetectionResult(null);
      setDetectionError(
        err instanceof Error ? err.message : "Ayah detection failed."
      );
      return null;
    } finally {
      setDetectingAyahs(false);
      setDetectionPhase("idle");
      setUploadProgress(0);
    }
  }

  function reset() {
    setDetectionError(null);
    setDetectionResult(null);
    setAppliedDetectionMode(null);
    setAppliedDetectionKey(null);
    setDetectionPhase("idle");
    setUploadProgress(0);
  }

  return {
    detectingAyahs,
    detectionPhase,
    uploadProgress,
    detectionError,
    setDetectionError,
    detectionResult,
    appliedDetectionMode,
    setAppliedDetectionMode,
    appliedDetectionKey,
    setAppliedDetectionKey,
    detectAyahs,
    reset,
  };
}
