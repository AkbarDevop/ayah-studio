"use client";

import { useEffect, useRef, useCallback } from "react";
import type { ReciterRecitation } from "@/lib/audio-api";

interface ReciterAudioPlayerProps {
  recitation: ReciterRecitation;
  playing: boolean;
  currentTime: number;
  onTimeChange: (time: number) => void;
  onPlayingChange: (playing: boolean) => void;
  onDurationChange: (duration: number) => void;
}

/**
 * Plays a full-surah MP3 from quran.com using a single <audio> element.
 * The recitation includes pre-computed per-ayah timestamps, so seeking
 * and time updates map directly to audio.currentTime.
 */
export default function ReciterAudioPlayer({
  recitation,
  playing,
  currentTime,
  onTimeChange,
  onPlayingChange,
  onDurationChange,
}: ReciterAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const rafRef = useRef<number>(0);
  const seekingRef = useRef(false);

  // Load audio source and report duration
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.src !== recitation.audioUrl) {
      audio.src = recitation.audioUrl;
      audio.load();
    }
    onDurationChange(recitation.totalDuration);
  }, [recitation, onDurationChange]);

  // Time update loop during playback
  const updateTime = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || seekingRef.current) return;

    onTimeChange(audio.currentTime);

    if (playing) {
      rafRef.current = requestAnimationFrame(updateTime);
    }
  }, [playing, onTimeChange]);

  // Handle play/pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      // Sync audio position if needed
      if (Math.abs(audio.currentTime - currentTime) > 0.5) {
        audio.currentTime = currentTime;
      }
      void audio.play().catch(() => onPlayingChange(false));
      rafRef.current = requestAnimationFrame(updateTime);
    } else {
      audio.pause();
      cancelAnimationFrame(rafRef.current);
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [playing, currentTime, updateTime, onPlayingChange]);

  // Handle audio ended
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    function handleEnded() {
      onPlayingChange(false);
      onTimeChange(0);
    }

    audio.addEventListener("ended", handleEnded);
    return () => audio.removeEventListener("ended", handleEnded);
  }, [onPlayingChange, onTimeChange]);

  // Seek handling — when currentTime changes externally while paused
  useEffect(() => {
    if (playing) return;
    const audio = audioRef.current;
    if (!audio) return;

    if (Math.abs(audio.currentTime - currentTime) > 0.3) {
      seekingRef.current = true;
      audio.currentTime = currentTime;
      // Small delay to let the seek complete
      const timer = setTimeout(() => { seekingRef.current = false; }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentTime, playing]);

  return (
    <audio ref={audioRef} preload="auto" style={{ display: "none" }} />
  );
}
