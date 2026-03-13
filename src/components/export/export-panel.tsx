"use client";

import { useState, useMemo, useCallback } from "react";
import { X, Copy, Download } from "lucide-react";
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
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-[560px] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-lg font-semibold text-[var(--gold)]">
            Export Subtitles
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-alt)] hover:text-[var(--text)]"
            aria-label="Close"
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
                  "font-mono-ui flex-1 rounded-md border px-3 py-2 text-xs uppercase tracking-wider transition-colors",
                  format === opt.value
                    ? "border-[var(--gold)] bg-[var(--gold)] text-[var(--bg)] font-semibold"
                    : "border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text-muted)] hover:border-[var(--border-light)] hover:text-[var(--text)]",
                ].join(" ")}
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
            className="font-mono-ui max-h-[260px] overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] p-4 text-xs leading-relaxed text-[var(--text-muted)]"
          >
            {preview}
          </pre>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] px-5 py-4">
          <button
            type="button"
            onClick={handleCopy}
            className="font-mono-ui flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-2 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--border-light)] hover:text-[var(--text)]"
          >
            <Copy size={13} />
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="font-mono-ui flex items-center gap-2 rounded-md border border-[var(--gold)] bg-[var(--gold)] px-4 py-2 text-xs font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--gold-light)]"
          >
            <Download size={13} />
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
