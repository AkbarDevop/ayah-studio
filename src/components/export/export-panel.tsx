"use client";

import { useState, useMemo, useCallback } from "react";
import { X, Copy, Download, Film, AlertTriangle, Loader2, Image } from "lucide-react";
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
import { useVideoRender } from "@/hooks/useVideoRender";
import AyahCardGenerator from "./ayah-card-generator";

type ExportTab = "subtitles" | "image";

interface ExportPanelProps {
  subtitles: Subtitle[];
  subtitleStyleId: string;
  subtitleFormatting: SubtitleFormatting;
  subtitlePlacement: SubtitlePlacement;
  aspectRatio: AspectRatioPreset;
  videoSrc: string | null;
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ExportPanel({
  subtitles,
  subtitleStyleId,
  subtitleFormatting,
  subtitlePlacement,
  aspectRatio,
  videoSrc,
  onClose,
}: ExportPanelProps) {
  const [activeTab, setActiveTab] = useState<ExportTab>("subtitles");
  const [format, setFormat] = useState<ExportFormat>("srt");
  const [copied, setCopied] = useState(false);

  const {
    renderVideo,
    cancelRender,
    progress,
    isRendering,
    renderedUrl,
    renderedSize,
    error: renderError,
    isSupported: ffmpegSupported,
  } = useVideoRender({
    videoSrc,
    subtitles,
    subtitleStyleId,
    subtitleFormatting,
    subtitlePlacement,
    aspectRatio,
  });

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

  const handleVideoDownload = useCallback(() => {
    if (!renderedUrl) return;
    const a = document.createElement("a");
    a.href = renderedUrl;
    a.download = "ayah-studio-subtitled.mp4";
    a.click();
  }, [renderedUrl]);

  const canRenderVideo = Boolean(videoSrc) && subtitles.length > 0 && ffmpegSupported;

  const videoRenderTooltip = !videoSrc
    ? "Upload a video clip first"
    : subtitles.length === 0
      ? "Add subtitles first"
      : !ffmpegSupported
        ? "Your browser does not support video rendering (SharedArrayBuffer required)"
        : null;

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-[560px] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-lg font-semibold text-[var(--gold)]">
            Export
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

        {/* Tab Switcher */}
        <div className="flex border-b border-[var(--border)] px-5">
          <button
            type="button"
            onClick={() => setActiveTab("subtitles")}
            className={[
              "font-mono-ui flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs uppercase tracking-wider transition-colors",
              activeTab === "subtitles"
                ? "border-[var(--gold)] text-[var(--gold)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]",
            ].join(" ")}
          >
            <Film size={13} />
            Subtitles
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("image")}
            className={[
              "font-mono-ui flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs uppercase tracking-wider transition-colors",
              activeTab === "image"
                ? "border-[var(--gold)] text-[var(--gold)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]",
            ].join(" ")}
          >
            <Image size={13} />
            Share as Image
          </button>
        </div>

        <div className="px-5 py-4">
          {activeTab === "image" ? (
            <AyahCardGenerator subtitles={subtitles} />
          ) : (
          <>
          {/* Video Render Section */}
          <div className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] p-4">
            <div className="mb-3 flex items-center gap-2">
              <Film size={16} className="text-[var(--gold)]" />
              <h3 className="font-mono-ui text-xs font-semibold uppercase tracking-wider text-[var(--text)]">
                Download Video
              </h3>
            </div>

            <p className="mb-3 text-xs leading-relaxed text-[var(--text-muted)]">
              Render your video with subtitles burned in. Processing happens in
              your browser using FFmpeg.wasm.
            </p>

            {!ffmpegSupported && (
              <div className="mb-3 flex items-start gap-2 rounded-md border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-3 py-2">
                <AlertTriangle
                  size={14}
                  className="mt-0.5 shrink-0 text-[var(--accent)]"
                />
                <p className="text-xs leading-relaxed text-[var(--accent)]">
                  SharedArrayBuffer is not available. Video rendering requires
                  Chrome or Edge with HTTPS. Check that cross-origin isolation
                  headers are set.
                </p>
              </div>
            )}

            {renderError && (
              <div className="mb-3 flex items-start gap-2 rounded-md border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-3 py-2">
                <AlertTriangle
                  size={14}
                  className="mt-0.5 shrink-0 text-[var(--accent)]"
                />
                <p className="text-xs leading-relaxed text-[var(--accent)]">
                  {renderError}
                </p>
              </div>
            )}

            {isRendering && (
              <div className="mb-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="font-mono-ui text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                    {progress < 10
                      ? "Loading FFmpeg..."
                      : `Rendering... ${progress}%`}
                  </span>
                  <button
                    type="button"
                    onClick={cancelRender}
                    className="font-mono-ui text-[10px] uppercase tracking-wider text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
                  >
                    Cancel
                  </button>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
                  <div
                    className="h-full rounded-full bg-[var(--gold)] transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {renderedUrl && renderedSize && !isRendering && (
              <div className="mb-3 flex items-center gap-2 rounded-md border border-[var(--emerald)]/30 bg-[var(--emerald)]/5 px-3 py-2">
                <p className="text-xs leading-relaxed text-[var(--emerald)]">
                  Ready to download ({formatFileSize(renderedSize)})
                </p>
              </div>
            )}

            <div className="flex gap-2">
              {renderedUrl && !isRendering ? (
                <button
                  type="button"
                  onClick={handleVideoDownload}
                  className="font-mono-ui flex flex-1 items-center justify-center gap-2 rounded-md border border-[var(--emerald)] bg-[var(--emerald)] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:brightness-110"
                >
                  <Download size={14} />
                  Download Video
                </button>
              ) : (
                <button
                  type="button"
                  onClick={renderVideo}
                  disabled={!canRenderVideo || isRendering}
                  title={videoRenderTooltip ?? undefined}
                  className={[
                    "font-mono-ui flex flex-1 items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-xs font-semibold transition-colors",
                    canRenderVideo && !isRendering
                      ? "border-[var(--gold)] bg-[var(--gold)] text-[var(--bg)] hover:bg-[var(--gold-light)]"
                      : "cursor-not-allowed border-[var(--border)] bg-[var(--surface)] text-[var(--text-dim)]",
                  ].join(" ")}
                >
                  {isRendering ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Rendering...
                    </>
                  ) : (
                    <>
                      <Film size={14} />
                      Render Video with Subtitles
                    </>
                  )}
                </button>
              )}
            </div>

            {!videoSrc && (
              <p className="mt-2 text-[10px] text-[var(--text-dim)]">
                Upload a video clip to enable video rendering.
              </p>
            )}
          </div>

          {/* Divider label */}
          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--border)]" />
            <span className="font-mono-ui text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
              Or export subtitle file
            </span>
            <div className="h-px flex-1 bg-[var(--border)]" />
          </div>

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
            className="font-mono-ui max-h-[200px] overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] p-4 text-xs leading-relaxed text-[var(--text-muted)]"
          >
            {preview}
          </pre>
          </>
          )}
        </div>

        {/* Footer — only show for subtitles tab */}
        {activeTab === "subtitles" && (
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
        )}
      </div>
    </div>
  );
}
