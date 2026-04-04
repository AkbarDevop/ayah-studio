"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Download, Copy, Check } from "lucide-react";
import type { Subtitle } from "@/types";

type CardSize = "square" | "story" | "wide";

interface CardSizeConfig {
  width: number;
  height: number;
  label: string;
  description: string;
}

const CARD_SIZES: Record<CardSize, CardSizeConfig> = {
  square: { width: 1080, height: 1080, label: "Square", description: "1080 x 1080 — Instagram" },
  story: { width: 1080, height: 1920, label: "Story", description: "1080 x 1920 — Reels / Stories" },
  wide: { width: 1200, height: 630, label: "Wide", description: "1200 x 630 — Twitter / OG" },
};

// Simple Islamic ornament drawn with canvas paths
function drawOrnament(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  width: number,
  color: string,
  scale: number
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5 * scale;
  ctx.globalAlpha = 0.5;

  // Central diamond
  const diamondSize = 6 * scale;
  ctx.beginPath();
  ctx.moveTo(cx, y - diamondSize);
  ctx.lineTo(cx + diamondSize, y);
  ctx.lineTo(cx, y + diamondSize);
  ctx.lineTo(cx - diamondSize, y);
  ctx.closePath();
  ctx.fill();

  // Lines extending from diamond
  const lineLen = width * 0.28;
  const gap = diamondSize + 4 * scale;

  ctx.beginPath();
  ctx.moveTo(cx - gap, y);
  ctx.lineTo(cx - gap - lineLen, y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx + gap, y);
  ctx.lineTo(cx + gap + lineLen, y);
  ctx.stroke();

  // Small dots at line ends
  const dotR = 2.5 * scale;
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.arc(cx - gap - lineLen, y, dotR, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + gap + lineLen, y, dotR, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  lineHeight: number
): { lines: string[]; totalHeight: number } {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  return { lines, totalHeight: lines.length * lineHeight };
}

function renderCard(
  canvas: HTMLCanvasElement,
  subtitle: Subtitle,
  size: CardSizeConfig
) {
  const { width, height } = size;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const scale = width / 1080;

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, "#0C0F14");
  grad.addColorStop(0.5, "#141820");
  grad.addColorStop(1, "#0C0F14");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Subtle radial glow in center
  const radGrad = ctx.createRadialGradient(
    width / 2, height * 0.42, 0,
    width / 2, height * 0.42, width * 0.5
  );
  radGrad.addColorStop(0, "rgba(212, 168, 83, 0.04)");
  radGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = radGrad;
  ctx.fillRect(0, 0, width, height);

  const contentPadding = 80 * scale;
  const maxTextWidth = width - contentPadding * 2;
  const centerX = width / 2;

  // --- Arabic text ---
  const arabicFontSize = Math.round(52 * scale);
  ctx.font = `${arabicFontSize}px Amiri, serif`;
  ctx.fillStyle = "#D4A853";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.direction = "rtl";

  const arabicLineHeight = arabicFontSize * 1.7;
  const arabicWrapped = wrapText(ctx, subtitle.arabic, maxTextWidth, arabicLineHeight);

  // Calculate vertical centering
  const translationFontSize = Math.round(22 * scale);
  const translationLineHeight = translationFontSize * 1.65;

  ctx.font = `${translationFontSize}px Manrope, system-ui, sans-serif`;
  const translationWrapped = subtitle.translation
    ? wrapText(ctx, subtitle.translation, maxTextWidth * 0.9, translationLineHeight)
    : { lines: [], totalHeight: 0 };

  const ornamentSpace = 40 * scale;
  const gapBetween = subtitle.translation ? 32 * scale : 0;
  const labelHeight = 28 * scale;
  const totalContentHeight =
    arabicWrapped.totalHeight +
    gapBetween +
    (subtitle.translation ? ornamentSpace : 0) +
    translationWrapped.totalHeight +
    ornamentSpace +
    labelHeight;

  let yPos = (height - totalContentHeight) / 2;

  // Draw Arabic lines
  ctx.font = `${arabicFontSize}px Amiri, serif`;
  ctx.fillStyle = "#D4A853";
  ctx.direction = "rtl";
  for (const line of arabicWrapped.lines) {
    ctx.fillText(line, centerX, yPos);
    yPos += arabicLineHeight;
  }

  // Ornament between Arabic and translation
  if (subtitle.translation) {
    yPos += gapBetween * 0.4;
    drawOrnament(ctx, centerX, yPos, maxTextWidth * 0.5, "#D4A853", scale);
    yPos += ornamentSpace * 0.6;
  }

  // Draw translation
  if (subtitle.translation && translationWrapped.lines.length > 0) {
    ctx.font = `${translationFontSize}px Manrope, system-ui, sans-serif`;
    ctx.fillStyle = "#E8E4DC";
    ctx.direction = "ltr";
    ctx.globalAlpha = 0.85;
    for (const line of translationWrapped.lines) {
      ctx.fillText(line, centerX, yPos);
      yPos += translationLineHeight;
    }
    ctx.globalAlpha = 1;
  }

  // Surah label at bottom
  yPos += ornamentSpace * 0.6;
  const labelText = subtitle.label ?? `Ayah ${subtitle.ayahNum}`;
  const labelFontSize = Math.round(16 * scale);
  ctx.font = `500 ${labelFontSize}px Manrope, system-ui, sans-serif`;
  ctx.fillStyle = "#8A8D96";
  ctx.direction = "ltr";
  ctx.fillText(labelText, centerX, yPos);

  // Top ornament
  drawOrnament(ctx, centerX, 60 * scale, maxTextWidth * 0.3, "#D4A853", scale * 0.8);

  // Bottom ornament
  drawOrnament(ctx, centerX, height - 60 * scale, maxTextWidth * 0.3, "#D4A853", scale * 0.8);

  // Watermark
  const wmFontSize = Math.round(12 * scale);
  ctx.font = `400 ${wmFontSize}px Manrope, system-ui, sans-serif`;
  ctx.fillStyle = "#5A5D66";
  ctx.globalAlpha = 0.5;
  ctx.textAlign = "center";
  ctx.direction = "ltr";
  ctx.fillText("ayahstudio.com", centerX, height - 28 * scale);
  ctx.globalAlpha = 1;
}

interface AyahCardGeneratorProps {
  subtitles: Subtitle[];
}

export default function AyahCardGenerator({ subtitles }: AyahCardGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [cardSize, setCardSize] = useState<CardSize>("square");
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  const subtitle = subtitles[selectedIdx];
  const sizeConfig = CARD_SIZES[cardSize];

  // Re-render canvas when subtitle or size changes
  useEffect(() => {
    if (!canvasRef.current || !subtitle) return;
    renderCard(canvasRef.current, subtitle, sizeConfig);
  }, [subtitle, sizeConfig]);

  const handleDownload = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const label = subtitle?.label?.replace(/\s+/g, "-") ?? `ayah-${subtitle?.ayahNum}`;
      a.download = `${label}-${cardSize}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }, [subtitle, cardSize]);

  const handleCopyToClipboard = useCallback(async () => {
    if (!canvasRef.current) return;
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvasRef.current!.toBlob(resolve, "image/png")
      );
      if (!blob) return;
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 2000);
    } catch {
      // Clipboard API may not be available
    }
  }, []);

  if (!subtitle) return null;

  // Preview dimensions: fit within a max preview box
  const previewMaxW = 460;
  const aspectRatio = sizeConfig.width / sizeConfig.height;
  const previewW = aspectRatio >= 1 ? previewMaxW : Math.round(previewMaxW * aspectRatio);
  const previewH = Math.round(previewW / aspectRatio);

  return (
    <div>
      {/* Ayah picker (if multiple subtitles) */}
      {subtitles.length > 1 && (
        <div className="mb-3">
          <label className="font-mono-ui mb-1.5 block text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
            Select Ayah
          </label>
          <select
            value={selectedIdx}
            onChange={(e) => setSelectedIdx(Number(e.target.value))}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-xs text-[var(--text)] outline-none focus:border-[var(--gold-dim)]"
          >
            {subtitles.map((sub, i) => (
              <option key={i} value={i}>
                {sub.label ?? `Ayah ${sub.ayahNum}`} — {sub.arabic.slice(0, 40)}...
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Size picker */}
      <div className="mb-3">
        <label className="font-mono-ui mb-1.5 block text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
          Card Size
        </label>
        <div className="flex gap-2">
          {(Object.keys(CARD_SIZES) as CardSize[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setCardSize(key)}
              className={[
                "font-mono-ui flex-1 rounded-md border px-3 py-2 text-[10px] uppercase tracking-wider transition-colors",
                cardSize === key
                  ? "border-[var(--gold)] bg-[var(--gold)] font-semibold text-[var(--bg)]"
                  : "border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text-muted)] hover:border-[var(--border-light)] hover:text-[var(--text)]",
              ].join(" ")}
              title={CARD_SIZES[key].description}
            >
              {CARD_SIZES[key].label}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas preview */}
      <div className="mb-4 flex justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] p-3">
        <canvas
          ref={canvasRef}
          style={{ width: previewW, height: previewH }}
          className="rounded-md"
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleDownload}
          className="font-mono-ui flex flex-1 items-center justify-center gap-2 rounded-md border border-[var(--gold)] bg-[var(--gold)] px-4 py-2.5 text-xs font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--gold-light)]"
        >
          <Download size={14} />
          Download PNG
        </button>
        <button
          type="button"
          onClick={handleCopyToClipboard}
          className="font-mono-ui flex items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-2.5 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--border-light)] hover:text-[var(--text)]"
        >
          {copiedToClipboard ? <Check size={14} /> : <Copy size={14} />}
          {copiedToClipboard ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
