"use client";

import { useMemo } from "react";
import type { Subtitle } from "@/types";

interface TimelineTrackProps {
  subtitles: Subtitle[];
  totalDuration: number;
  selectedIdx: number | null;
  onSelect: (idx: number) => void;
}

export default function TimelineTrack({
  subtitles,
  totalDuration,
  selectedIdx,
  onSelect,
}: TimelineTrackProps) {
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

  return (
    <div className="relative h-[60px] w-full overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-alt)]">
      {/* Time markers */}
      {timeMarkers.map((t) => {
        const leftPercent = totalDuration > 0 ? (t / totalDuration) * 100 : 0;
        return (
          <div
            key={`marker-${t}`}
            className="absolute top-0 h-full"
            style={{ left: `${leftPercent}%` }}
          >
            <div className="h-full w-px bg-[var(--border)]" />
            <span className="font-mono-ui absolute bottom-[2px] left-[3px] select-none text-[9px] text-[var(--text-dim)]">
              {formatTime(t)}
            </span>
          </div>
        );
      })}

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
            onClick={() => onSelect(idx)}
            className={[
              "font-mono-ui absolute top-[12px] flex h-[36px] cursor-pointer items-center justify-center rounded-sm border px-1 transition-colors",
              isSelected
                ? "border-[var(--gold-light)] bg-[var(--gold)] text-[var(--bg)]"
                : "border-transparent bg-[var(--emerald)] text-white hover:bg-[var(--emerald-light)]",
            ].join(" ")}
            style={{
              left: `${leftPercent}%`,
              width: `${Math.max(widthPercent, 0.5)}%`,
            }}
          >
            <span className="truncate text-[10px] font-bold">
              {sub.ayahNum}
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
