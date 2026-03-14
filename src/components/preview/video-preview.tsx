"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Video, Move, Upload, BookOpen } from "lucide-react";
import type {
  AspectRatioPreset,
  PlaybackMode,
  Subtitle,
  SubtitleFormatting,
  SubtitlePlacement,
} from "@/types";
import {
  applyOpacityToColor,
  getArabicFontCss,
  getTranslationFontCss,
  resolveSubtitleColors,
} from "@/lib/subtitle-formatting";

interface VideoPreviewProps {
  subtitles: Subtitle[];
  currentTime: number;
  subtitleStyleId: string;
  subtitleFormatting: SubtitleFormatting;
  subtitlePlacement: SubtitlePlacement;
  playbackMode: PlaybackMode;
  aspectRatio: AspectRatioPreset;
  videoSrc: string | null;
  videoName: string | null;
  videoError: string | null;
  playing: boolean;
  onPlayPause: () => void;
  onTimeChange: (seconds: number) => void;
  onDurationChange: (seconds: number) => void;
  onPlayingChange: (playing: boolean) => void;
  onVideoError: (message: string | null) => void;
  onSubtitlePlacementChange: (placement: SubtitlePlacement) => void;
  previewSubtitle: Subtitle | null;
}

function IslamicPattern() {
  const cells: { cx: number; cy: number }[] = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 8; col++) {
      const cx = col * 55 + (row % 2 === 1 ? 27.5 : 0);
      const cy = row * 48;
      cells.push({ cx, cy });
    }
  }

  function hexPoints(cx: number, cy: number, r: number): string {
    const pts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
    }
    return pts.join(" ");
  }

  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 440 240"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {cells.map(({ cx, cy }, i) => (
        <g key={i}>
          <polygon
            points={hexPoints(cx, cy, 22)}
            fill="none"
            stroke="var(--gold)"
            strokeWidth="0.5"
            opacity="0.04"
          />
          <polygon
            points={hexPoints(cx, cy, 14)}
            fill="none"
            stroke="var(--gold)"
            strokeWidth="0.5"
            opacity="0.04"
          />
        </g>
      ))}
    </svg>
  );
}

function formatDisplayTime(seconds: number): string {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(Math.floor(seconds % 60)).padStart(2, "0");
  return `${m}:${s}`;
}

function getAspectRatioLabel(aspectRatio: AspectRatioPreset) {
  switch (aspectRatio) {
    case "portrait":
      return "9:16 Reels";
    case "square":
      return "1:1 Feed";
    default:
      return "16:9 YouTube";
  }
}

export default function VideoPreview({
  subtitles,
  currentTime,
  subtitleStyleId,
  subtitleFormatting,
  subtitlePlacement,
  playbackMode,
  aspectRatio,
  videoSrc,
  videoName,
  videoError,
  playing,
  onPlayPause,
  onTimeChange,
  onDurationChange,
  onPlayingChange,
  onVideoError,
  onSubtitlePlacementChange,
  previewSubtitle,
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ offsetX: number; offsetY: number } | null>(
    null
  );
  const [videoReady, setVideoReady] = useState(false);
  const isAudioTransport = playbackMode === "audio";
  const canPlay =
    Boolean(videoSrc) || subtitles.length > 0 || playbackMode === "audio";

  const currentSubtitle = useMemo(() => {
    return subtitles.find(
      (sub) => currentTime >= sub.start && currentTime <= sub.end
    ) ?? null;
  }, [subtitles, currentTime]);
  const visibleSubtitle = currentSubtitle ?? (!playing ? previewSubtitle : null);
  const subtitleColors = useMemo(
    () => resolveSubtitleColors(subtitleStyleId, subtitleFormatting),
    [subtitleFormatting, subtitleStyleId]
  );
  const overlayBackground = useMemo(() => {
    switch (subtitleStyleId) {
      case "modern":
        return applyOpacityToColor("rgba(0,0,0,0.6)", subtitleFormatting.backgroundOpacity);
      case "emerald":
        return applyOpacityToColor("rgba(10,20,18,0.8)", subtitleFormatting.backgroundOpacity);
      case "minimal":
        return applyOpacityToColor("transparent", subtitleFormatting.backgroundOpacity);
      case "cinematic":
        return applyOpacityToColor("rgba(0,0,0,0.85)", subtitleFormatting.backgroundOpacity);
      case "classic":
      default:
        return applyOpacityToColor("rgba(0,0,0,0.7)", subtitleFormatting.backgroundOpacity);
    }
  }, [subtitleFormatting.backgroundOpacity, subtitleStyleId]);
  const aspectRatioLabel = useMemo(
    () => getAspectRatioLabel(aspectRatio),
    [aspectRatio]
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;
    video.load();
  }, [videoSrc]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;
    if (!videoReady || videoError) return;

    if (Math.abs(video.currentTime - currentTime) > 0.25) {
      video.currentTime = currentTime;
    }
  }, [currentTime, videoError, videoReady, videoSrc]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;
    if (!videoReady || videoError) return;

    if (playing) {
      if (
        !isAudioTransport &&
        video.duration &&
        video.currentTime >= video.duration - 0.05
      ) {
        video.currentTime = 0;
        onTimeChange(0);
      }

      void video.play().catch(() => {
        onPlayingChange(false);
      });
    } else {
      video.pause();
    }
  }, [
    isAudioTransport,
    playing,
    videoError,
    videoReady,
    videoSrc,
    onPlayingChange,
    onTimeChange,
  ]);

  const updatePlacementFromPointer = useCallback(
    (clientX: number, clientY: number, offsetX: number, offsetY: number) => {
      const stage = stageRef.current;
      const subtitle = subtitleRef.current;
      if (!stage || !subtitle) return;

      const stageRect = stage.getBoundingClientRect();
      const subtitleRect = subtitle.getBoundingClientRect();

      const halfWidth = subtitleRect.width / 2;
      const halfHeight = subtitleRect.height / 2;
      const nextX = clientX - stageRect.left - offsetX;
      const nextY = clientY - stageRect.top - offsetY;

      const minX = halfWidth;
      const maxX = stageRect.width - halfWidth;
      const minY = halfHeight;
      const maxY = stageRect.height - halfHeight;

      onSubtitlePlacementChange({
        x: clamp(nextX, minX, maxX) / stageRect.width,
        y: clamp(nextY, minY, maxY) / stageRect.height,
      });
    },
    [onSubtitlePlacementChange]
  );

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      event.preventDefault();
      updatePlacementFromPointer(
        event.clientX,
        event.clientY,
        dragState.offsetX,
        dragState.offsetY
      );
    }

    function stopDragging() {
      dragStateRef.current = null;
    }

    window.addEventListener("pointermove", handlePointerMove, {
      passive: false,
    });
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, [updatePlacementFromPointer]);

  function handleSubtitlePointerDown(
    event: React.PointerEvent<HTMLDivElement>
  ) {
    const subtitle = subtitleRef.current;
    if (!subtitle || !visibleSubtitle) return;

    event.preventDefault();
    const subtitleRect = subtitle.getBoundingClientRect();
    dragStateRef.current = {
      offsetX: event.clientX - (subtitleRect.left + subtitleRect.width / 2),
      offsetY: event.clientY - (subtitleRect.top + subtitleRect.height / 2),
    };
  }

  return (
    <div className="preview-stage" data-preview-ratio={aspectRatio}>
      <div
        ref={stageRef}
        className="preview-stage-frame absolute inset-0"
      >
        {videoSrc ? (
          <>
            <video
              ref={videoRef}
              src={videoSrc}
              className="absolute inset-0 h-full w-full object-cover"
              playsInline
              muted={isAudioTransport}
              preload="auto"
              onLoadStart={() => {
                setVideoReady(false);
                onVideoError(null);
              }}
              onLoadedMetadata={(event) => {
                const duration = event.currentTarget.duration;
                onVideoError(null);
                onDurationChange(Number.isFinite(duration) ? duration : 0);
              }}
              onLoadedData={() => {
                setVideoReady(true);
                onVideoError(null);
              }}
              onCanPlay={() => {
                setVideoReady(true);
                onVideoError(null);
              }}
              onTimeUpdate={(event) => {
                if (!isAudioTransport) {
                  onTimeChange(event.currentTarget.currentTime);
                }
              }}
              onPlay={() => {
                if (!isAudioTransport) {
                  onPlayingChange(true);
                }
              }}
              onPause={() => {
                if (!isAudioTransport) {
                  onPlayingChange(false);
                }
              }}
              onEnded={(event) => {
                if (!isAudioTransport) {
                  event.currentTarget.currentTime = 0;
                  onTimeChange(0);
                  onPlayingChange(false);
                }
              }}
              onError={() => {
                setVideoReady(false);
                onDurationChange(0);
                onPlayingChange(false);
                onVideoError(
                  "This clip could not be decoded. Try re-exporting it or using a different MP4/WebM file."
                );
              }}
            />
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/55 via-black/15 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
          </>
        ) : (
          <>
            <div className="preview-canvas-bg absolute inset-0" />
            <IslamicPattern />
          </>
        )}

        {/* Time indicator -- top left */}
        <div className="glass-overlay font-mono-ui absolute left-3 top-3 z-10 rounded-md px-2 py-1 text-xs text-[var(--text-muted)] transition-colors duration-200">
          {formatDisplayTime(currentTime)}
        </div>

        <div className="glass-overlay font-mono-ui absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
          {aspectRatioLabel}
        </div>

        {/* Play/Pause -- top right */}
        <button
          type="button"
          onClick={onPlayPause}
          disabled={!canPlay}
          className={[
            "glass-overlay absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] transition-all duration-200",
            canPlay
              ? "hover:text-[var(--text)] hover:scale-110 active:scale-95"
              : "cursor-not-allowed opacity-50",
          ].join(" ")}
          aria-label={playing ? "Pause playback" : "Start playback"}
        >
          {playing ? <Pause size={15} /> : <Play size={15} />}
        </button>

        <div className="preview-safe-frame" />
        <div className="preview-safe-line" data-line="upper" />
        <div className="preview-safe-line" data-line="lower" />

        {/* Empty state -- improved with actionable guidance */}
        {!videoSrc && subtitles.length === 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 animate-fade-in">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[var(--border-light)] bg-[var(--surface)]/60 backdrop-blur-sm">
              <Video size={24} className="text-[var(--text-dim)]" />
            </div>
            <div className="max-w-xs space-y-2 text-center">
              <p className="font-mono-ui text-sm font-medium text-[var(--text-muted)]">
                Your preview will appear here
              </p>
              <div className="space-y-1.5">
                <p className="flex items-center justify-center gap-1.5 text-xs text-[var(--text-dim)]">
                  <Upload size={12} />
                  Upload a recitation clip to get started
                </p>
                <p className="flex items-center justify-center gap-1.5 text-xs text-[var(--text-dim)]">
                  <BookOpen size={12} />
                  Or browse and select ayahs from the sidebar
                </p>
              </div>
            </div>
          </div>
        )}

        {videoSrc && videoName && (
          <div className="glass-overlay font-mono-ui absolute bottom-3 left-3 z-10 max-w-[65%] rounded-md px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
            {videoName}
          </div>
        )}

        {videoSrc && !videoReady && !videoError && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/25 animate-fade-in">
            <div className="glass-overlay flex items-center gap-3 rounded-full px-5 py-2.5">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--gold-dim)] border-t-[var(--gold)]" />
              <p className="font-mono-ui text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Loading video...
              </p>
            </div>
          </div>
        )}

        {videoError && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 px-6 text-center animate-fade-in">
            <div className="max-w-md rounded-xl border border-[var(--accent)] bg-[var(--surface)]/95 px-5 py-4">
              <p className="font-mono-ui text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--accent)]">
                Video Load Error
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                {videoError}
              </p>
            </div>
          </div>
        )}

        {videoSrc && subtitles.length === 0 && (
          <div className="glass-overlay font-mono-ui absolute bottom-3 right-3 z-10 rounded-md px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)] animate-fade-in">
            Add ayahs to preview subtitles
          </div>
        )}

        {/* Current subtitle overlay */}
        {visibleSubtitle && (
          <div
            ref={subtitleRef}
            onPointerDown={handleSubtitlePointerDown}
            data-subtitle-theme={subtitleStyleId}
            data-preview-ratio={aspectRatio}
            className="preview-stage-caption subtitle-theme-surface absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-2xl border border-white/10 px-5 py-3 text-center shadow-2xl shadow-black/40 backdrop-blur-md active:cursor-grabbing transition-[left,top] duration-75"
            style={{
              left: `${subtitlePlacement.x * 100}%`,
              top: `${subtitlePlacement.y * 100}%`,
              background: overlayBackground,
            }}
            >
            <div className="font-mono-ui mb-2 inline-flex items-center gap-1 rounded-full bg-black/25 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
              <Move className="h-3 w-3" />
              Drag
            </div>
            <p
              dir="rtl"
              className="subtitle-theme-arabic mb-1.5 leading-relaxed"
              style={{
                color: subtitleColors.arabicColor,
                fontFamily: getArabicFontCss(subtitleFormatting.arabicFontFamily),
                fontSize: `${subtitleFormatting.arabicFontSize}px`,
              }}
            >
              {visibleSubtitle.arabic}
            </p>
            <p
              className="subtitle-theme-translation leading-relaxed"
              style={{
                color: subtitleColors.translationColor,
                fontFamily: getTranslationFontCss(
                  subtitleFormatting.translationFontFamily
                ),
                fontSize: `${subtitleFormatting.translationFontSize}px`,
                fontStyle: subtitleFormatting.translationItalic
                  ? "italic"
                  : "normal",
              }}
            >
              {visibleSubtitle.translation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
