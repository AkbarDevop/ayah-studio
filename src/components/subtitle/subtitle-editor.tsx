"use client";

import { Trash2 } from "lucide-react";
import type { Subtitle } from "@/types";

interface SubtitleEditorProps {
  subtitle: Subtitle;
  currentTime: number;
  translationEdition: string;
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
  translationEdition,
  onChange,
  onDelete,
  onSetStartToPlayhead,
  onSetEndToPlayhead,
}: SubtitleEditorProps) {
  const isArabicOnly = translationEdition === "none";
  const isNastaliq = translationEdition.startsWith("ur.") || translationEdition.startsWith("fa.");
  function handleFieldChange(
    field: keyof Subtitle,
    value: string | number
  ) {
    onChange({ ...subtitle, [field]: value });
  }

  return (
    <div className="flex flex-col gap-4 rounded-[1.1rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(20,24,32,0.98),rgba(16,20,28,0.94))] p-3.5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] md:gap-5 md:rounded-[1.35rem] md:p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-[var(--text-dim)]">
            Inspector
          </p>
          <h3 className="mt-1 font-mono-ui text-sm font-medium text-[var(--text)]">
          Editing {subtitle.label ?? `Ayah ${subtitle.ayahNum}`}
          {subtitle.chunkCount && subtitle.chunkCount > 1
            ? ` · Part ${subtitle.chunkIndex ?? 1}/${subtitle.chunkCount}`
            : ""}
          </h3>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="flex min-h-[44px] items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[var(--accent)] transition-colors hover:bg-[var(--surface-alt)]"
          aria-label="Delete subtitle"
        >
          <Trash2 size={13} />
          <span>Delete</span>
        </button>
      </div>

      {/* Timing inputs */}
      <div className="grid grid-cols-2 gap-2 md:gap-3">
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
            className="font-mono-ui w-full rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--gold-dim)]"
          />
          <button
            type="button"
            onClick={onSetStartToPlayhead}
            className="font-mono-ui mt-2 min-h-[36px] rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-2 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)] transition-colors hover:border-[var(--gold-dim)] hover:text-[var(--text)] md:px-2.5"
          >
            Playhead ({currentTime.toFixed(1)}s)
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
            className="font-mono-ui w-full rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--gold-dim)]"
          />
          <button
            type="button"
            onClick={onSetEndToPlayhead}
            className="font-mono-ui mt-2 min-h-[36px] rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-2 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)] transition-colors hover:border-[var(--gold-dim)] hover:text-[var(--text)] md:px-2.5"
          >
            Playhead ({currentTime.toFixed(1)}s)
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
          className="font-arabic-ui h-[70px] w-full resize-none rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-base leading-[2] text-[var(--text)] outline-none transition-colors focus:border-[var(--gold-dim)] md:text-[18px]"
        />
      </div>

      {/* Translation textarea */}
      <div>
        <Label>Translation</Label>
        {isArabicOnly ? (
          <div className="flex h-[55px] items-center rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-3 opacity-50">
            <span className="font-mono-ui text-xs text-[var(--text-dim)]">
              Arabic only — no translation
            </span>
          </div>
        ) : (
          <textarea
            dir={isNastaliq ? "rtl" : undefined}
            value={subtitle.translation}
            onChange={(e) => handleFieldChange("translation", e.target.value)}
            className="h-[55px] w-full resize-none rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-sm italic text-[var(--text)] outline-none transition-colors focus:border-[var(--gold-dim)]"
            style={isNastaliq ? { fontFamily: "var(--font-nastaliq), serif" } : undefined}
          />
        )}
      </div>
    </div>
  );
}
