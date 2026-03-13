"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";

export function useMediaState(onReset: () => void) {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoName, setVideoName] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);
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

  function handleVideoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setVideoError("Please choose a valid video file.");
      event.target.value = "";
      return;
    }

    setVideoError(null);
    onReset();
    setVideoDuration(0);
    if (!audioSrc) {
      setAudioDuration(0);
      setAudioError(null);
    }
    setVideoFile(file);
    setVideoName(file.name);
    setVideoSrc(URL.createObjectURL(file));
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
