"use client";

import { useCallback, useRef, useState } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { generateASS } from "@/lib/export";
import type {
  AspectRatioPreset,
  Subtitle,
  SubtitleFormatting,
  SubtitlePlacement,
} from "@/types";

interface UseVideoRenderOptions {
  videoSrc: string | null;
  subtitles: Subtitle[];
  subtitleStyleId: string;
  subtitleFormatting: SubtitleFormatting;
  subtitlePlacement: SubtitlePlacement;
  aspectRatio: AspectRatioPreset;
}

interface UseVideoRenderReturn {
  renderVideo: () => Promise<void>;
  cancelRender: () => void;
  progress: number;
  isRendering: boolean;
  renderedUrl: string | null;
  renderedSize: number | null;
  error: string | null;
  isSupported: boolean;
}

// FFmpeg WASM files are self-hosted in /public/ffmpeg/ to avoid CORS/COEP issues.
// To update, download ffmpeg-core.js and ffmpeg-core.wasm from:
//   https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/
// and place them in /public/ffmpeg/.
const CORE_BASE_URL = "/ffmpeg";

function checkSharedArrayBufferSupport(): boolean {
  try {
    return typeof SharedArrayBuffer !== "undefined";
  } catch {
    return false;
  }
}

export function useVideoRender({
  videoSrc,
  subtitles,
  subtitleStyleId,
  subtitleFormatting,
  subtitlePlacement,
  aspectRatio,
}: UseVideoRenderOptions): UseVideoRenderReturn {
  const [progress, setProgress] = useState(0);
  const [isRendering, setIsRendering] = useState(false);
  const [renderedUrl, setRenderedUrl] = useState<string | null>(null);
  const [renderedSize, setRenderedSize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ffmpegRef = useRef<FFmpeg | null>(null);
  const cancelledRef = useRef(false);

  const isSupported = checkSharedArrayBufferSupport();

  const loadFFmpeg = useCallback(async (): Promise<FFmpeg> => {
    if (ffmpegRef.current?.loaded) {
      return ffmpegRef.current;
    }

    const ffmpeg = new FFmpeg();

    ffmpeg.on("progress", ({ progress: p }) => {
      if (!cancelledRef.current) {
        setProgress(Math.min(Math.round(p * 100), 99));
      }
    });

    const coreURL = await toBlobURL(
      `${CORE_BASE_URL}/ffmpeg-core.js`,
      "text/javascript"
    );
    const wasmURL = await toBlobURL(
      `${CORE_BASE_URL}/ffmpeg-core.wasm`,
      "application/wasm"
    );
    const workerURL = await toBlobURL(
      `${CORE_BASE_URL}/ffmpeg-core.worker.js`,
      "text/javascript"
    );

    await ffmpeg.load({ coreURL, wasmURL, workerURL });

    ffmpegRef.current = ffmpeg;
    return ffmpeg;
  }, []);

  const renderVideo = useCallback(async () => {
    if (!videoSrc) {
      setError("No video loaded. Upload a video clip first.");
      return;
    }

    if (subtitles.length === 0) {
      setError("No subtitles to burn in. Add ayahs first.");
      return;
    }

    if (!isSupported) {
      setError(
        "Your browser does not support SharedArrayBuffer. Try Chrome or Edge with secure context (HTTPS)."
      );
      return;
    }

    // Clean up previous render
    if (renderedUrl) {
      URL.revokeObjectURL(renderedUrl);
      setRenderedUrl(null);
      setRenderedSize(null);
    }

    setIsRendering(true);
    setProgress(0);
    setError(null);
    cancelledRef.current = false;

    try {
      setProgress(2);
      const ffmpeg = await loadFFmpeg();

      if (cancelledRef.current) return;

      // Write the video file
      setProgress(5);
      const videoData = await fetchFile(videoSrc);
      await ffmpeg.writeFile("input.mp4", videoData);

      if (cancelledRef.current) return;

      // Generate and write ASS subtitle file
      const assContent = generateASS(
        subtitles,
        subtitleStyleId,
        subtitlePlacement,
        aspectRatio,
        subtitleFormatting
      );
      const encoder = new TextEncoder();
      await ffmpeg.writeFile("subs.ass", encoder.encode(assContent));

      if (cancelledRef.current) return;

      // Burn subtitles into video
      setProgress(10);
      await ffmpeg.exec([
        "-i",
        "input.mp4",
        "-vf",
        "ass=subs.ass",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "23",
        "-c:a",
        "copy",
        "-movflags",
        "+faststart",
        "output.mp4",
      ]);

      if (cancelledRef.current) return;

      // Read the output file — copy into a plain ArrayBuffer so Blob accepts it
      const outputData = await ffmpeg.readFile("output.mp4");
      let rawBytes: ArrayBuffer;
      if (outputData instanceof Uint8Array) {
        const copy = new ArrayBuffer(outputData.byteLength);
        new Uint8Array(copy).set(outputData);
        rawBytes = copy;
      } else {
        rawBytes = new TextEncoder().encode(outputData).buffer as ArrayBuffer;
      }
      const outputBlob = new Blob([rawBytes], { type: "video/mp4" });
      const url = URL.createObjectURL(outputBlob);

      setRenderedUrl(url);
      setRenderedSize(outputBlob.size);
      setProgress(100);

      // Clean up temp files
      await ffmpeg.deleteFile("input.mp4").catch(() => {});
      await ffmpeg.deleteFile("subs.ass").catch(() => {});
      await ffmpeg.deleteFile("output.mp4").catch(() => {});
    } catch (err) {
      if (!cancelledRef.current) {
        const message =
          err instanceof Error ? err.message : "Video rendering failed.";
        setError(message);
      }
    } finally {
      if (!cancelledRef.current) {
        setIsRendering(false);
      }
    }
  }, [
    videoSrc,
    subtitles,
    subtitleStyleId,
    subtitleFormatting,
    subtitlePlacement,
    aspectRatio,
    isSupported,
    renderedUrl,
    loadFFmpeg,
  ]);

  const cancelRender = useCallback(() => {
    cancelledRef.current = true;
    setIsRendering(false);
    setProgress(0);
    setError(null);

    // Attempt to terminate FFmpeg
    if (ffmpegRef.current?.loaded) {
      ffmpegRef.current.terminate();
      ffmpegRef.current = null;
    }
  }, []);

  return {
    renderVideo,
    cancelRender,
    progress,
    isRendering,
    renderedUrl,
    renderedSize,
    error,
    isSupported,
  };
}
