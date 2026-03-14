"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { X, Copy, Download, Check, FileText } from "lucide-react";
import type {
  AspectRatioPreset,
  ExportFormat,
  Subtitle,
  SubtitleFormatting,
  SubtitlePlacement,
} from "@/types";
import {
  generateSRT,
  generateASS,
  generateJSON,
  downloadFile,
} from "@/lib/export";

interface ExportPanelProps {
  subtitles: Subtitle[];
  subtitleStyleId: string;
  subtitleFormatting: SubtitleFormatting;
  subtitlePlacement: SubtitlePlacement;
  aspectRatio: AspectRatioPreset;
  onClose: () => void;
}

const FORMAT_OPTIONS: {
  value: ExportFormat;
  label: string;
  description: string;
  extension: string;
  mime: string;
}[] = [
  {
    value: "srt",
    label: ".SRT",
    description:
      "SubRip format. Widely supported by video players and editing software.",
    extension: "srt",
    mime: "text/plain;charset=utf-8",
  },
  {
    value: "ass",
    label: ".ASS",
    description:
      "Advanced SubStation Alpha. Supports styled text, fonts, and positioning.",
    extension: "ass",
    mime: "text/plain;charset=utf-8",
  },
  {
    value: "json",
    label: ".JSON",
    description:
      "Raw JSON data. Useful for programmatic access and custom integrations.",
    extension: "json",
    mime: "application/json",
  },
];

export default function ExportPanel({
  subtitles,
  subtitleStyleId,
  subtitleFormatting,
  subtitlePlacement,
  aspectRatio,
  onClose,
}: ExportPanelProps) {
  const [format, setFormat] = useState<ExportFormat>("srt");
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const currentFormatOption = FORMAT_OPTIONS.find((f) => f.value === format)!;

  const preview = useMemo(() => {
    switch (format) {
      case "srt":
        return generateSRT(subtitles);
      case "ass":
        return generateASS(
          subtitles,
          subtitleStyleId,
          subtitlePlacement,
          aspectRatio,
          subtitleFormatting
        );
      case "json":
        return generateJSON(subtitles);
    }
  }, [
    aspectRatio,
    format,
    subtitleFormatting,
    subtitlePlacement,
    subtitles,
    subtitleStyleId,
  ]);

  // Focus trap and Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    // Focus the close button on open for accessibility
    closeButtonRef.current?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Close on backdrop click
  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(preview);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = preview;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [preview]);

  const handleDownload = useCallback(() => {
    downloadFile(
      preview,
      `ayah-subtitles.${currentFormatOption.extension}`,
      currentFormatOption.mime
    );
  }, [preview, currentFormatOption]);

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Export subtitles"
    >
      <div
        ref={panelRef}
        className="animate-fade-in-scale w-full max-w-[560px] rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl shadow-black/40"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--gold)]/10">
              <FileText className="h-4 w-4 text-[var(--gold)]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--gold)]">
                Export Subtitles
              </h2>
              <p className="text-[11px] text-[var(--text-dim)]">
                {subtitles.length} subtitle{subtitles.length !== 1 ? "s" : ""} ready
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-muted)] transition-all duration-200 hover:bg-[var(--surface-alt)] hover:text-[var(--text)] active:scale-[0.95]"
            aria-label="Close export panel (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4">
          {/* Format selector */}
          <div className="mb-4 flex gap-2">
            {FORMAT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFormat(opt.value)}
                className={[
                  "font-mono-ui flex-1 rounded-md border px-3 py-2.5 text-xs uppercase tracking-wider transition-all duration-200",
                  format === opt.value
                    ? "border-[var(--gold)] bg-[var(--gold)] text-[var(--bg)] font-semibold shadow-lg shadow-[var(--gold)]/15"
                    : "border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text-muted)] hover:border-[var(--border-light)] hover:text-[var(--text)]",
                ].join(" ")}
                aria-pressed={format === opt.value}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Format description */}
          <p className="mb-4 text-xs leading-relaxed text-[var(--text-muted)]">
            {currentFormatOption.description}
          </p>

          {/* Preview */}
          <pre
            className="font-mono-ui max-h-[260px] overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] p-4 text-xs leading-relaxed text-[var(--text-muted)] transition-colors duration-200"
          >
            {preview}
          </pre>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-4">
          <p className="text-[11px] text-[var(--text-dim)]">
            Press Esc to close
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className={`font-mono-ui flex items-center gap-2 rounded-md border px-4 py-2 text-xs transition-all duration-200 active:scale-[0.97] ${
                copied
                  ? "border-[var(--emerald)] bg-[var(--emerald)]/10 text-[var(--emerald-light)]"
                  : "border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text-muted)] hover:border-[var(--border-light)] hover:text-[var(--text)]"
              }`}
              aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="font-mono-ui flex items-center gap-2 rounded-md border border-[var(--gold)] bg-[var(--gold)] px-4 py-2.5 text-xs font-semibold text-[var(--bg)] transition-all duration-200 hover:bg-[var(--gold-light)] active:scale-[0.97]"
              aria-label={`Download as ${currentFormatOption.extension} file`}
            >
              <Download size={13} />
              Download .{currentFormatOption.extension.toUpperCase()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
