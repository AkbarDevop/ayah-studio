"use client";

import { Trash2, Crosshair } from "lucide-react";
import type { Subtitle } from "@/types";

interface SubtitleEditorProps {
  subtitle: Subtitle;
  currentTime: number;
  onChange: (updated: Subtitle) => void;
  onDelete: () => void;
  onSetStartToPlayhead: () => void;
  onSetEndToPlayhead: () => void;
}

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="font-mono-ui mb-1 block text-[11px] uppercase tracking-wider text-[var(--text-muted)]"
    >
      {children}
    </label>
  );
}

export default function SubtitleEditor({
  subtitle,
  currentTime,
  onChange,
  onDelete,
  onSetStartToPlayhead,
  onSetEndToPlayhead,
}: SubtitleEditorProps) {
  function handleFieldChange(
    field: keyof Subtitle,
    value: string | number
  ) {
    onChange({ ...subtitle, [field]: value });
  }

  const subtitleLabel = subtitle.label ?? `Ayah ${subtitle.ayahNum}`;
  const chunkInfo = subtitle.chunkCount && subtitle.chunkCount > 1
    ? ` -- Part ${subtitle.chunkIndex ?? 1}/${subtitle.chunkCount}`
    : "";

  return (
    <div className="animate-slide-in-right flex flex-col gap-5 rounded-[1.35rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(20,24,32,0.98),rgba(16,20,28,0.94))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-[var(--text-dim)]">
            Inspector
          </p>
          <h3 className="mt-1 font-mono-ui text-sm font-medium text-[var(--text)]">
            Editing {subtitleLabel}{chunkInfo}
          </h3>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-[var(--accent)] transition-all duration-200 hover:bg-[var(--accent)]/10 active:scale-[0.97]"
          aria-label={`Delete ${subtitleLabel}`}
        >
          <Trash2 size={13} />
          <span>Delete</span>
        </button>
      </div>

      {/* Timing inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="sub-start">Start (s)</Label>
          <input
            id="sub-start"
            type="number"
            step={0.5}
            min={0}
            value={subtitle.start}
            onChange={(e) =>
              handleFieldChange("start", parseFloat(e.target.value) || 0)
            }
            className="font-mono-ui w-full rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--text)] outline-none transition-all duration-200 focus:border-[var(--gold-dim)] focus:ring-1 focus:ring-[var(--gold-dim)]/30"
          />
          <button
            type="button"
            onClick={onSetStartToPlayhead}
            className="tooltip-trigger font-mono-ui mt-2 flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)] transition-all duration-200 hover:border-[var(--gold-dim)] hover:text-[var(--text)] active:scale-[0.97]"
            data-tooltip="Snap start to current playhead position"
            aria-label={`Set start to playhead at ${currentTime.toFixed(2)} seconds`}
          >
            <Crosshair size={10} />
            Playhead ({currentTime.toFixed(2)}s)
          </button>
        </div>
        <div>
          <Label htmlFor="sub-end">End (s)</Label>
          <input
            id="sub-end"
            type="number"
            step={0.5}
            min={0}
            value={subtitle.end}
            onChange={(e) =>
              handleFieldChange("end", parseFloat(e.target.value) || 0)
            }
            className="font-mono-ui w-full rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--text)] outline-none transition-all duration-200 focus:border-[var(--gold-dim)] focus:ring-1 focus:ring-[var(--gold-dim)]/30"
          />
          <button
            type="button"
            onClick={onSetEndToPlayhead}
            className="tooltip-trigger font-mono-ui mt-2 flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)] transition-all duration-200 hover:border-[var(--gold-dim)] hover:text-[var(--text)] active:scale-[0.97]"
            data-tooltip="Snap end to current playhead position"
            aria-label={`Set end to playhead at ${currentTime.toFixed(2)} seconds`}
          >
            <Crosshair size={10} />
            Playhead ({currentTime.toFixed(2)}s)
          </button>
        </div>
      </div>
      <p className="font-mono-ui text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
        Duration: {(subtitle.end - subtitle.start).toFixed(1)}s. End time is kept at least 0.1s after start.
      </p>

      {/* Arabic textarea */}
      <div>
        <Label htmlFor="sub-arabic">Arabic Text</Label>
        <textarea
          id="sub-arabic"
          dir="rtl"
          value={subtitle.arabic}
          onChange={(e) => handleFieldChange("arabic", e.target.value)}
          className="font-arabic-ui h-[70px] w-full resize-none rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-[18px] leading-[2] text-[var(--text)] outline-none transition-all duration-200 focus:border-[var(--gold-dim)] focus:ring-1 focus:ring-[var(--gold-dim)]/30"
        />
      </div>

      {/* Translation textarea */}
      <div>
        <Label htmlFor="sub-translation">Translation</Label>
        <textarea
          id="sub-translation"
          value={subtitle.translation}
          onChange={(e) => handleFieldChange("translation", e.target.value)}
          className="h-[55px] w-full resize-none rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-sm italic text-[var(--text)] outline-none transition-all duration-200 focus:border-[var(--gold-dim)] focus:ring-1 focus:ring-[var(--gold-dim)]/30"
        />
      </div>
    </div>
  );
}
