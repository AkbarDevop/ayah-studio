import type {
  AspectRatioPreset,
  Subtitle,
  SubtitlePlacement,
} from "@/types";
import { SUBTITLE_STYLES } from "./constants";

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
  return subtitles
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
  aspectRatio: AspectRatioPreset
): string {
  const st =
    SUBTITLE_STYLES.find((s) => s.id === styleId) || SUBTITLE_STYLES[0];
  const { width: playResX, height: playResY } = getAssResolution(aspectRatio);
  const safeX = Math.round(clamp(placement.x, 0.12, 0.88) * playResX);
  const safeY = Math.round(clamp(placement.y, 0.12, 0.88) * playResY);
  const translationOffset = Math.round(playResY * 0.055);

  let output = `[Script Info]\nTitle: Quran Subtitles — Ayah Studio\nScriptType: v4.00+\nPlayResX: ${playResX}\nPlayResY: ${playResY}\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n`;
  output += `[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, BackColour, Bold, Alignment, MarginL, MarginR, MarginV, Encoding\n`;
  output += `Style: Arabic,${st.font},42,&H00${st.arabicColor.slice(1)},&H80000000,0,5,30,30,30,1\n`;
  output += `Style: Translation,Arial,28,&H00E8E4DC,&H80000000,0,5,30,30,30,1\n\n`;
  output += `[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;

  subtitles.forEach((sub) => {
    output += `Dialogue: 0,${formatASSTime(sub.start)},${formatASSTime(sub.end)},Arabic,,0,0,0,,{\\an5\\pos(${safeX},${safeY})}${escapeAssText(sub.arabic)}\n`;
    output += `Dialogue: 1,${formatASSTime(sub.start)},${formatASSTime(sub.end)},Translation,,0,0,0,,{\\an5\\pos(${safeX},${safeY + translationOffset})}${escapeAssText(sub.translation)}\n`;
  });

  return output;
}

export function generateJSON(subtitles: Subtitle[]): string {
  return JSON.stringify(subtitles, null, 2);
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
