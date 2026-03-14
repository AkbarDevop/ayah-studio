"use client";

import { useEffect, useRef, useState } from "react";
import { Music, Volume2, VolumeX } from "lucide-react";

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
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] transition-colors duration-200">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-200 ${
            audioSrc ? "bg-[var(--gold)]/10" : "bg-[var(--surface-alt)]"
          }`}>
            {audioSrc ? (
              <Volume2 className="h-4 w-4 text-[var(--gold)]" />
            ) : (
              <VolumeX className="h-4 w-4 text-[var(--text-dim)]" />
            )}
          </div>
          <div>
            <p className="font-mono-ui text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-dim)]">
              Audio Waveform
            </p>
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">
              {audioName
                ? audioName
                : "Upload a clip and its audio track will appear here."}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono-ui text-xs uppercase tracking-[0.12em] text-[var(--gold)]">
            {formatAudioTime(currentTime)} / {formatAudioTime(audioDuration)}
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-dim)]">
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

      <div className="relative px-4 py-4">
        {!audioSrc && (
          <div className="animate-fade-in flex h-[120px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--border-light)] bg-[var(--surface-alt)]/60 px-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-light)] bg-[var(--surface)]">
              <Music className="h-4 w-4 text-[var(--text-dim)]" />
            </div>
            <p className="max-w-md text-xs leading-relaxed text-[var(--text-dim)]">
              Upload a reciter clip and Ayah Studio will use its built-in audio
              track automatically. You can also provide a separate audio override.
            </p>
          </div>
        )}

        <div
          ref={containerRef}
          className={
            audioSrc
              ? "rounded-lg border border-[var(--border)] bg-[var(--surface-alt)]/80 px-2 py-3 transition-opacity duration-300"
              : "hidden"
          }
          style={{ opacity: waveReady ? 1 : 0.4 }}
        />

        {audioSrc && loading && (
          <div className="absolute inset-x-4 bottom-4 top-4 flex items-center justify-center rounded-lg bg-black/35 animate-fade-in">
            <div className="glass-overlay flex items-center gap-3 rounded-full px-5 py-2.5">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--gold-dim)] border-t-[var(--gold)]" />
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
