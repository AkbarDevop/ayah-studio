"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  getYouTubeImportLimitMessage,
  isSupportedYouTubeUrl,
  MAX_YOUTUBE_IMPORT_BYTES,
} from "@/lib/youtube-import";

export function useMediaState(onReset: () => void) {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoName, setVideoName] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeImporting, setYoutubeImporting] = useState(false);
  const [youtubeImportError, setYoutubeImportError] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);

  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (videoSrc?.startsWith("blob:")) {
        URL.revokeObjectURL(videoSrc);
      }
    };
  }, [videoSrc]);

  useEffect(() => {
    return () => {
      if (audioSrc?.startsWith("blob:")) {
        URL.revokeObjectURL(audioSrc);
      }
    };
  }, [audioSrc]);

  const activeAudioSrc = audioSrc ?? videoSrc;
  const activeAudioName = audioSrc ? audioName : videoName;
  const usingClipAudio = Boolean(videoSrc) && !audioSrc;

  function loadVideoFile(file: File, displayName = file.name) {
    setVideoError(null);
    setYoutubeImportError(null);
    onReset();
    setVideoDuration(0);
    if (!audioSrc) {
      setAudioDuration(0);
      setAudioError(null);
    }
    setVideoFile(file);
    setVideoName(displayName);
    setVideoSrc(URL.createObjectURL(file));
  }

  function handleVideoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setVideoError("Please choose a valid video file.");
      event.target.value = "";
      return;
    }

    loadVideoFile(file);
    event.target.value = "";
  }

  function handleAudioUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const isAudioFile =
      file.type.startsWith("audio/") ||
      file.type.startsWith("video/") ||
      /\.(mp3|wav|m4a|aac|ogg|webm)$/i.test(file.name);

    if (!isAudioFile) {
      setAudioError("Please choose a valid audio file.");
      event.target.value = "";
      return;
    }

    setAudioError(null);
    onReset();
    setAudioDuration(0);
    setAudioFile(file);
    setAudioName(file.name);
    setAudioSrc(URL.createObjectURL(file));
    event.target.value = "";
  }

  async function importFromYouTube(urlOverride?: string) {
    const trimmedUrl = (urlOverride ?? youtubeUrl).trim();

    if (!trimmedUrl) {
      setYoutubeImportError("Paste a YouTube video link first.");
      return;
    }

    if (!isSupportedYouTubeUrl(trimmedUrl)) {
      setYoutubeImportError("Only direct YouTube video links are supported right now.");
      return;
    }

    setYoutubeImporting(true);
    setYoutubeImportError(null);

    try {
      const response = await fetch("/api/youtube-import", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ url: trimmedUrl }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;

        throw new Error(
          payload?.error || "Failed to import this YouTube clip."
        );
      }

      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error("The imported YouTube clip was empty.");
      }

      if (blob.size > MAX_YOUTUBE_IMPORT_BYTES) {
        throw new Error(getYouTubeImportLimitMessage());
      }

      const headerFilename = response.headers.get("x-imported-filename");
      const filename = headerFilename
        ? decodeURIComponent(headerFilename)
        : "youtube-import.mp4";
      const file = new File([blob], filename, {
        type: blob.type || "video/mp4",
        lastModified: Date.now(),
      });

      loadVideoFile(file, filename);
      setYoutubeUrl("");
    } catch (error) {
      setYoutubeImportError(
        error instanceof Error
          ? error.message
          : "Failed to import this YouTube clip."
      );
    } finally {
      setYoutubeImporting(false);
    }
  }

  function clearVideo() {
    onReset();
    setVideoDuration(0);
    if (!audioSrc) {
      setAudioDuration(0);
      setAudioError(null);
    }
    setVideoFile(null);
    setVideoName(null);
    setVideoSrc(null);
    setVideoError(null);
  }

  function clearAudio() {
    onReset();
    setAudioDuration(0);
    setAudioFile(null);
    setAudioName(null);
    setAudioSrc(null);
    setAudioError(null);
  }

  return {
    videoSrc,
    videoFile,
    videoName,
    videoDuration,
    setVideoDuration,
    videoError,
    setVideoError,
    youtubeUrl,
    setYoutubeUrl,
    youtubeImporting,
    youtubeImportError,
    importFromYouTube,
    audioSrc,
    audioFile,
    audioName,
    audioDuration,
    setAudioDuration,
    audioError,
    setAudioError,
    activeAudioSrc,
    activeAudioName,
    usingClipAudio,
    videoInputRef,
    audioInputRef,
    handleVideoUpload,
    handleAudioUpload,
    clearVideo,
    clearAudio,
  };
}
