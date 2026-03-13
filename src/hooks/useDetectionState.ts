"use client";

import { useState } from "react";
import {
  MAX_AYAH_DETECT_UPLOAD_BYTES,
  getAyahDetectUploadLimitMessage,
} from "@/lib/ayah-detection-config";
import type { AyahDetectionResult } from "@/types";

export function useDetectionState() {
  const [detectingAyahs, setDetectingAyahs] = useState(false);
  const [detectionError, setDetectionError] = useState<string | null>(null);
  const [detectionResult, setDetectionResult] =
    useState<AyahDetectionResult | null>(null);
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
      setAppliedDetectionKey(null);
      setDetectionError(getAyahDetectUploadLimitMessage());
      return null;
    }

    const formData = new FormData();
    formData.append("media", sourceFile);

    setDetectingAyahs(true);
    setDetectionError(null);
    setAppliedDetectionKey(null);

    try {
      const response = await fetch("/api/ayah-detect", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as
        | AyahDetectionResult
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : "Ayah detection failed."
        );
      }

      const result = payload as AyahDetectionResult;
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
    }
  }

  function reset() {
    setDetectionError(null);
    setDetectionResult(null);
    setAppliedDetectionKey(null);
  }

  return {
    detectingAyahs,
    detectionError,
    setDetectionError,
    detectionResult,
    appliedDetectionKey,
    setAppliedDetectionKey,
    detectAyahs,
    reset,
  };
}
