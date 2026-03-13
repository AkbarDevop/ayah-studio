"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type MouseEvent,
} from "react";
import type { Subtitle } from "@/types";

interface TimelineTrackProps {
  subtitles: Subtitle[];
  currentTime: number;
  totalDuration: number;
  selectedIdx: number | null;
  onSelect: (idx: number) => void;
  onSeek: (seconds: number) => void;
  onResizeSubtitle: (
    idx: number,
    edge: "start" | "end",
    seconds: number
  ) => void;
}

export default function TimelineTrack({
  subtitles,
  currentTime,
  totalDuration,
  selectedIdx,
  onSelect,
  onSeek,
  onResizeSubtitle,
}: TimelineTrackProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const resizeStateRef = useRef<{
    idx: number;
    edge: "start" | "end";
  } | null>(null);

  const timeMarkers = useMemo(() => {
    if (totalDuration <= 0) return [];
    const markers: number[] = [];
    for (let t = 0; t <= totalDuration; t += 5) {
      markers.push(t);
    }
    return markers;
  }, [totalDuration]);

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  const playheadPercent =
    totalDuration > 0
      ? Math.min(100, Math.max(0, (currentTime / totalDuration) * 100))
      : 0;

  function handleSeek(event: MouseEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeX = (event.clientX - bounds.left) / bounds.width;
    onSeek(Math.min(totalDuration, Math.max(0, relativeX * totalDuration)));
  }

  const getTimeFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || totalDuration <= 0) {
        return 0;
      }

      const bounds = track.getBoundingClientRect();
      const relativeX = (clientX - bounds.left) / bounds.width;
      return Math.min(totalDuration, Math.max(0, relativeX * totalDuration));
    },
    [totalDuration]
  );

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const resizeState = resizeStateRef.current;
      if (!resizeState) {
        return;
      }

      event.preventDefault();
      onResizeSubtitle(
        resizeState.idx,
        resizeState.edge,
        getTimeFromClientX(event.clientX)
      );
    }

    function stopResizing() {
      resizeStateRef.current = null;
    }

    window.addEventListener("pointermove", handlePointerMove, {
      passive: false,
    });
    window.addEventListener("pointerup", stopResizing);
    window.addEventListener("pointercancel", stopResizing);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("pointercancel", stopResizing);
    };
  }, [getTimeFromClientX, onResizeSubtitle]);

  return (
    <div
      ref={trackRef}
      className="relative h-[78px] w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(26,31,42,0.96),rgba(16,20,28,0.94))]"
      onClick={handleSeek}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white/3 to-transparent" />
      {/* Time markers */}
      {timeMarkers.map((t) => {
        const leftPercent = totalDuration > 0 ? (t / totalDuration) * 100 : 0;
        return (
          <div
            key={`marker-${t}`}
            className="absolute top-0 h-full"
            style={{ left: `${leftPercent}%` }}
          >
            <div className="h-full w-px bg-[var(--border)]/75" />
            <span className="font-mono-ui absolute bottom-[4px] left-[6px] select-none text-[9px] text-[var(--text-dim)]">
              {formatTime(t)}
            </span>
          </div>
        );
      })}

      <div
        className="pointer-events-none absolute inset-y-0 z-[2] w-px bg-[var(--gold-light)]"
        style={{ left: `${playheadPercent}%` }}
      >
        <div className="absolute -left-[5px] top-2 h-2.5 w-2.5 rounded-full border border-[var(--bg)] bg-[var(--gold-light)] shadow-[0_0_0_4px_rgba(212,168,83,0.18)]" />
      </div>

      {/* Subtitle blocks */}
      {subtitles.map((sub, idx) => {
        const leftPercent =
          totalDuration > 0 ? (sub.start / totalDuration) * 100 : 0;
        const widthPercent =
          totalDuration > 0
            ? ((sub.end - sub.start) / totalDuration) * 100
            : 0;
        const isSelected = selectedIdx === idx;

        return (
          <button
            key={`block-${sub.ayahNum}-${idx}`}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(idx);
            }}
            className={[
              "font-mono-ui absolute top-[16px] z-[3] flex h-[38px] cursor-pointer items-center justify-center rounded-xl border px-1.5 transition-colors",
              isSelected
                ? "border-[var(--gold-light)] bg-[var(--gold)] text-[var(--bg)] shadow-[0_12px_30px_rgba(212,168,83,0.28)]"
                : "border-transparent bg-[var(--emerald)] text-white hover:bg-[var(--emerald-light)]",
            ].join(" ")}
            style={{
              left: `${leftPercent}%`,
              width: `${Math.max(widthPercent, 0.5)}%`,
            }}
          >
            {isSelected && (
              <>
                <span
                  role="presentation"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    resizeStateRef.current = { idx, edge: "start" };
                  }}
                  className="absolute inset-y-0 left-0 w-2.5 cursor-ew-resize rounded-l-xl bg-black/15 hover:bg-black/25"
                />
                <span
                  role="presentation"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    resizeStateRef.current = { idx, edge: "end" };
                  }}
                  className="absolute inset-y-0 right-0 w-2.5 cursor-ew-resize rounded-r-xl bg-black/15 hover:bg-black/25"
                />
              </>
            )}
            <span className="truncate px-2 text-[10px] font-bold tracking-[0.04em]">
              {sub.label ?? sub.ayahNum}
            </span>
          </button>
        );
      })}

      {/* Empty state */}
      {subtitles.length === 0 && (
        <div className="flex h-full items-center justify-center">
          <span className="font-mono-ui text-[11px] uppercase tracking-wider text-[var(--text-dim)]">
            No subtitles
          </span>
        </div>
      )}
    </div>
  );
}
