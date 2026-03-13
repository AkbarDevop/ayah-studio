import type {
  AspectRatioPreset,
  Subtitle,
  SubtitleFormatting,
  SubtitlePlacement,
} from "@/types";
import { SUBTITLE_STYLES } from "./constants";
import {
  DEFAULT_SUBTITLE_FORMATTING,
  getArabicFontAssName,
  getTranslationFontAssName,
} from "./subtitle-formatting";
import { normalizeSubtitleTimings } from "./subtitle-timing";

function formatSRTTime(seconds: number): string {
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(Math.floor(seconds % 60)).padStart(2, "0");
  const ms = String(Math.floor((seconds % 1) * 1000)).padStart(3, "0");
  return `${h}:${m}:${s},${ms}`;
}

function formatASSTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(Math.floor(seconds % 60)).padStart(2, "0");
  const cs = String(Math.floor((seconds % 1) * 100)).padStart(2, "0");
  return `${h}:${m}:${s}.${cs}`;
}

export function generateSRT(subtitles: Subtitle[]): string {
  return normalizeSubtitleTimings(subtitles)
    .map(
      (sub, i) =>
        `${i + 1}\n${formatSRTTime(sub.start)} --> ${formatSRTTime(sub.end)}\n${sub.arabic}\n${sub.translation}\n`
    )
    .join("\n");
}

export function generateASS(
  subtitles: Subtitle[],
  styleId: string,
  placement: SubtitlePlacement,
  aspectRatio: AspectRatioPreset,
  formatting: SubtitleFormatting = DEFAULT_SUBTITLE_FORMATTING
): string {
  const safeSubtitles = normalizeSubtitleTimings(subtitles);
  const st =
    SUBTITLE_STYLES.find((s) => s.id === styleId) || SUBTITLE_STYLES[0];
  const { width: playResX, height: playResY } = getAssResolution(aspectRatio);
  const safeX = Math.round(clamp(placement.x, 0.12, 0.88) * playResX);
  const safeY = Math.round(clamp(placement.y, 0.12, 0.88) * playResY);
  const translationOffset = Math.round(playResY * 0.055);

  let output = `[Script Info]\nTitle: Quran Subtitles — Ayah Studio\nScriptType: v4.00+\nPlayResX: ${playResX}\nPlayResY: ${playResY}\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n`;
  output += `[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, BackColour, Bold, Alignment, MarginL, MarginR, MarginV, Encoding\n`;
  output += `Style: Arabic,${getArabicFontAssName(formatting.arabicFontFamily)},${Math.round(formatting.arabicFontSize * 1.5)},${rgbToAssBgr(st.arabicColor)},${cssColorToAssBackColour(
    st.bg,
    formatting.backgroundOpacity
  )},0,5,30,30,30,1\n`;
  output += `Style: Translation,${getTranslationFontAssName(
    formatting.translationFontFamily
  )},${Math.round(formatting.translationFontSize * 1.5)},${rgbToAssBgr(
    st.transColor
  )},${cssColorToAssBackColour(
    st.bg,
    formatting.backgroundOpacity
  )},0,5,30,30,30,1\n\n`;
  output += `[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;

  safeSubtitles.forEach((sub) => {
    output += `Dialogue: 0,${formatASSTime(sub.start)},${formatASSTime(sub.end)},Arabic,,0,0,0,,{\\an5\\pos(${safeX},${safeY})}${escapeAssText(sub.arabic)}\n`;
    output += `Dialogue: 1,${formatASSTime(sub.start)},${formatASSTime(sub.end)},Translation,,0,0,0,,{\\an5\\pos(${safeX},${safeY + translationOffset})}${escapeAssText(sub.translation)}\n`;
  });

  return output;
}

export function generateJSON(subtitles: Subtitle[]): string {
  return JSON.stringify(normalizeSubtitleTimings(subtitles), null, 2);
}

export function downloadFile(
  content: string,
  filename: string,
  mimeType = "text/plain;charset=utf-8"
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeAssText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\r?\n/g, "\\N");
}

function getAssResolution(aspectRatio: AspectRatioPreset): {
  width: number;
  height: number;
} {
  switch (aspectRatio) {
    case "portrait":
      return { width: 1080, height: 1920 };
    case "square":
      return { width: 1080, height: 1080 };
    case "landscape":
    default:
      return { width: 1920, height: 1080 };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rgbToAssBgr(hex: string): string {
  const normalized = hex.replace("#", "");
  const r = normalized.slice(0, 2);
  const g = normalized.slice(2, 4);
  const b = normalized.slice(4, 6);
  return `&H00${b}${g}${r}`;
}

function cssColorToAssBackColour(color: string, opacityPercent: number) {
  const normalized = color.trim().toLowerCase();
  if (normalized === "transparent") {
    return "&HFF000000";
  }

  const rgbaMatch = normalized.match(
    /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/
  );

  if (rgbaMatch) {
    const [, r, g, b, alpha] = rgbaMatch;
    const baseAlpha = alpha ? Number.parseFloat(alpha) : 1;
    const finalAlpha = 1 - Math.max(0, Math.min(1, baseAlpha * (opacityPercent / 100)));
    return `&H${toAssByte(finalAlpha)}${toAssByte(Number.parseFloat(b) / 255)}${toAssByte(
      Number.parseFloat(g) / 255
    )}${toAssByte(Number.parseFloat(r) / 255)}`;
  }

  const hexMatch = normalized.match(/^#([0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    const finalAlpha = 1 - Math.max(0, Math.min(1, opacityPercent / 100));
    return `&H${toAssByte(finalAlpha)}${toAssByte(b / 255)}${toAssByte(
      g / 255
    )}${toAssByte(r / 255)}`;
  }

  return "&H80000000";
}

function toAssByte(value: number) {
  return Math.round(Math.max(0, Math.min(1, value)) * 255)
    .toString(16)
    .toUpperCase()
    .padStart(2, "0");
}
