"use client";

import { useEffect, useRef, useState } from "react";

interface WaveSurferLike {
  destroy: () => void;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  stop: () => void;
  empty: () => void;
  load: (src: string) => Promise<unknown>;
  getCurrentTime: () => number;
  setTime: (seconds: number) => void;
  isPlaying: () => boolean;
  play: () => Promise<void>;
  pause: () => void;
}

interface AudioWaveformProps {
  audioSrc: string | null;
  audioName: string | null;
  audioDuration: number;
  usingClipAudio: boolean;
  hasOverride: boolean;
  currentTime: number;
  playing: boolean;
  onTimeChange: (seconds: number) => void;
  onDurationChange: (seconds: number) => void;
  onPlayingChange: (playing: boolean) => void;
  onAudioError: (message: string | null) => void;
}

function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function getWaveErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "This audio clip could not be decoded. Try a different MP3, WAV, or M4A file.";
}

export default function AudioWaveform({
  audioSrc,
  audioName,
  audioDuration,
  usingClipAudio,
  hasOverride,
  currentTime,
  playing,
  onTimeChange,
  onDurationChange,
  onPlayingChange,
  onAudioError,
}: AudioWaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const waveSurferRef = useRef<WaveSurferLike | null>(null);
  const [instanceReady, setInstanceReady] = useState(false);
  const [waveReady, setWaveReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function initWaveform() {
      if (!containerRef.current || waveSurferRef.current) return;

      const { default: WaveSurfer } = await import("wavesurfer.js");
      if (cancelled || !containerRef.current) return;

      const waveSurfer = WaveSurfer.create({
        container: containerRef.current,
        height: 88,
        waveColor: "#485066",
        progressColor: "#D4A853",
        cursorColor: "#E8C97A",
        cursorWidth: 2,
        barWidth: 3,
        barGap: 2,
        barRadius: 999,
        normalize: true,
        dragToSeek: true,
        autoScroll: true,
        autoCenter: true,
      }) as WaveSurferLike;

      waveSurfer.on("ready", (duration) => {
        const nextDuration =
          typeof duration === "number" && Number.isFinite(duration)
            ? duration
            : 0;

        setWaveReady(true);
        setLoading(false);
        onAudioError(null);
        onDurationChange(nextDuration);
      });

      waveSurfer.on("timeupdate", (time) => {
        if (typeof time === "number") {
          onTimeChange(time);
        }
      });

      waveSurfer.on("play", () => {
        onPlayingChange(true);
      });

      waveSurfer.on("pause", () => {
        onPlayingChange(false);
      });

      waveSurfer.on("finish", () => {
        onPlayingChange(false);
      });

      waveSurfer.on("error", (error) => {
        setWaveReady(false);
        setLoading(false);
        onDurationChange(0);
        onPlayingChange(false);
        onAudioError(getWaveErrorMessage(error));
      });

      waveSurferRef.current = waveSurfer;
      setInstanceReady(true);
    }

    void initWaveform();

    return () => {
      cancelled = true;
      waveSurferRef.current?.destroy();
      waveSurferRef.current = null;
    };
  }, [onAudioError, onDurationChange, onPlayingChange, onTimeChange]);

  useEffect(() => {
    const waveSurfer = waveSurferRef.current;
    if (!instanceReady || !waveSurfer) return;

    if (!audioSrc) {
      setLoading(false);
      setWaveReady(false);
      onDurationChange(0);
      onAudioError(null);
      onPlayingChange(false);
      waveSurfer.stop();
      waveSurfer.empty();
      return;
    }

    setLoading(true);
    setWaveReady(false);
    onAudioError(null);
    onPlayingChange(false);
    void waveSurfer.load(audioSrc).catch((error: unknown) => {
      setLoading(false);
      setWaveReady(false);
      onPlayingChange(false);
      onAudioError(getWaveErrorMessage(error));
    });
  }, [
    audioSrc,
    instanceReady,
    onAudioError,
    onDurationChange,
    onPlayingChange,
  ]);

  useEffect(() => {
    const waveSurfer = waveSurferRef.current;
    if (!waveSurfer || !audioSrc || !waveReady) return;

    const delta = Math.abs(waveSurfer.getCurrentTime() - currentTime);
    if (delta > 0.2) {
      waveSurfer.setTime(currentTime);
    }
  }, [audioSrc, currentTime, waveReady]);

  useEffect(() => {
    const waveSurfer = waveSurferRef.current;
    if (!waveSurfer || !audioSrc || !waveReady) return;

    if (playing && !waveSurfer.isPlaying()) {
      void waveSurfer.play().catch(() => {
        onPlayingChange(false);
      });
      return;
    }

    if (!playing && waveSurfer.isPlaying()) {
      waveSurfer.pause();
    }
  }, [audioSrc, onPlayingChange, playing, waveReady]);

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2.5 md:gap-3 md:px-4 md:py-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono-ui text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-dim)]">
            Audio Waveform
          </p>
          <p className="mt-1 truncate text-xs text-[var(--text-muted)] md:text-sm">
            {audioName
              ? audioName
              : "Upload a clip to load audio automatically."}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono-ui text-[11px] uppercase tracking-[0.12em] text-[var(--gold)] md:text-xs">
            {formatAudioTime(currentTime)} / {formatAudioTime(audioDuration)}
          </p>
          <p className="mt-1 hidden text-[11px] text-[var(--text-dim)] md:block">
            {audioSrc
              ? usingClipAudio
                ? "Using clip audio as the timing source"
                : hasOverride
                  ? "Using override audio as the timing source"
                  : "Audio leads playback when loaded"
              : "Waveform appears automatically from the clip audio"}
          </p>
        </div>
      </div>

      <div className="relative px-3 py-3 md:px-4 md:py-4">
        {!audioSrc && (
          <div className="flex h-[80px] items-center justify-center rounded-lg border border-dashed border-[var(--border-light)] bg-[var(--surface-alt)]/60 px-4 text-center md:h-[120px] md:px-6">
            <p className="max-w-lg text-xs leading-relaxed text-[var(--text-dim)] md:text-sm">
              Upload a reciter clip and its audio will load automatically.
            </p>
          </div>
        )}

        <div
          ref={containerRef}
          className={
            audioSrc
              ? "rounded-lg border border-[var(--border)] bg-[var(--surface-alt)]/80 px-2 py-3"
              : "hidden"
          }
        />

        {audioSrc && loading && (
          <div className="absolute inset-x-4 bottom-4 top-4 flex items-center justify-center rounded-lg bg-black/35">
            <div className="glass-overlay rounded-full px-4 py-2">
              <p className="font-mono-ui text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Decoding waveform...
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
