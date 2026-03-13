"use client";

import { Trash2 } from "lucide-react";
import type { Subtitle } from "@/types";

interface SubtitleEditorProps {
  subtitle: Subtitle;
  currentTime: number;
  onChange: (updated: Subtitle) => void;
  onDelete: () => void;
  onSetStartToPlayhead: () => void;
  onSetEndToPlayhead: () => void;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="font-mono-ui mb-1 block text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
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

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-mono-ui text-sm font-medium text-[var(--text)]">
          Editing Ayah {subtitle.ayahNum}
          {subtitle.chunkCount && subtitle.chunkCount > 1
            ? ` · Part ${subtitle.chunkIndex ?? 1}/${subtitle.chunkCount}`
            : ""}
        </h3>
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[var(--accent)] transition-colors hover:bg-[var(--surface-alt)]"
          aria-label="Delete subtitle"
        >
          <Trash2 size={13} />
          <span>Delete</span>
        </button>
      </div>

      {/* Timing inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Start (s)</Label>
          <input
            type="number"
            step={0.5}
            min={0}
            value={subtitle.start}
            onChange={(e) =>
              handleFieldChange("start", parseFloat(e.target.value) || 0)
            }
            className="font-mono-ui w-full rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--gold-dim)]"
          />
          <button
            type="button"
            onClick={onSetStartToPlayhead}
            className="font-mono-ui mt-2 rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)] transition-colors hover:border-[var(--gold-dim)] hover:text-[var(--text)]"
          >
            Set to Playhead ({currentTime.toFixed(2)}s)
          </button>
        </div>
        <div>
          <Label>End (s)</Label>
          <input
            type="number"
            step={0.5}
            min={0}
            value={subtitle.end}
            onChange={(e) =>
              handleFieldChange("end", parseFloat(e.target.value) || 0)
            }
            className="font-mono-ui w-full rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--gold-dim)]"
          />
          <button
            type="button"
            onClick={onSetEndToPlayhead}
            className="font-mono-ui mt-2 rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)] transition-colors hover:border-[var(--gold-dim)] hover:text-[var(--text)]"
          >
            Set to Playhead ({currentTime.toFixed(2)}s)
          </button>
        </div>
      </div>
      <p className="font-mono-ui text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
        End time is kept at least 0.1s after start.
      </p>

      {/* Arabic textarea */}
      <div>
        <Label>Arabic Text</Label>
        <textarea
          dir="rtl"
          value={subtitle.arabic}
          onChange={(e) => handleFieldChange("arabic", e.target.value)}
          className="font-arabic-ui h-[70px] w-full resize-none rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-[18px] leading-[2] text-[var(--text)] outline-none transition-colors focus:border-[var(--gold-dim)]"
        />
      </div>

      {/* Translation textarea */}
      <div>
        <Label>Translation</Label>
        <textarea
          value={subtitle.translation}
          onChange={(e) => handleFieldChange("translation", e.target.value)}
          className="h-[55px] w-full resize-none rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-sm italic text-[var(--text)] outline-none transition-colors focus:border-[var(--gold-dim)]"
        />
      </div>
    </div>
  );
}
