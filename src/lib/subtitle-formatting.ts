import type {
  ArabicFontFamily,
  SubtitleFormatting,
  TranslationFontFamily,
} from "@/types";
import { SUBTITLE_STYLES } from "./constants";

export const DEFAULT_SUBTITLE_FORMATTING: SubtitleFormatting = {
  arabicFontFamily: "amiri",
  translationFontFamily: "ui",
  arabicFontSize: 28,
  translationFontSize: 16,
  arabicColorOverride: null,
  translationColorOverride: null,
  backgroundColorOverride: null,
  backgroundOpacity: 0,
  backgroundBlur: 12,
  borderRadius: 16,
  translationItalic: true,
  splitLongAyahs: true,
  maxWordsPerChunk: 8,
  karaokeEnabled: false,
  textShadow: true,
  textOutline: false,
  lineSpacing: 6,
};

export const ARABIC_FONT_OPTIONS: Array<{
  value: ArabicFontFamily;
  label: string;
}> = [
  { value: "amiri", label: "Amiri" },
  { value: "naskh", label: "Noto Naskh Arabic" },
];

export const TRANSLATION_FONT_OPTIONS: Array<{
  value: TranslationFontFamily;
  label: string;
}> = [
  { value: "ui", label: "Manrope" },
  { value: "mono", label: "IBM Plex Mono" },
];

export function getArabicFontCss(fontFamily: ArabicFontFamily) {
  return fontFamily === "naskh"
    ? "var(--font-arabic), serif"
    : "var(--font-amiri), serif";
}

export function getTranslationFontCss(fontFamily: TranslationFontFamily) {
  return fontFamily === "mono"
    ? "var(--font-ibm-plex), monospace"
    : "var(--font-ui), system-ui, sans-serif";
}

export function getArabicFontAssName(fontFamily: ArabicFontFamily) {
  return fontFamily === "naskh" ? "Noto Naskh Arabic" : "Amiri";
}

export function getTranslationFontAssName(fontFamily: TranslationFontFamily) {
  return fontFamily === "mono" ? "IBM Plex Mono" : "Manrope";
}

export function resolveSubtitleColors(
  styleId: string,
  formatting: SubtitleFormatting
) {
  const style =
    SUBTITLE_STYLES.find((candidate) => candidate.id === styleId) ??
    SUBTITLE_STYLES[0];

  return {
    arabicColor: formatting.arabicColorOverride ?? style.arabicColor,
    translationColor:
      formatting.translationColorOverride ?? style.transColor,
  };
}

export function applyOpacityToColor(color: string, opacityPercent: number) {
  const opacity = clamp(opacityPercent / 100, 0, 1);
  const normalized = color.trim().toLowerCase();

  if (normalized === "transparent") {
    return "transparent";
  }

  const hexMatch = normalized.match(/^#([0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  const rgbaMatch = normalized.match(
    /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/
  );
  if (rgbaMatch) {
    const [, r, g, b, alpha] = rgbaMatch;
    const baseAlpha = alpha ? Number.parseFloat(alpha) : 1;
    return `rgba(${Number.parseFloat(r)}, ${Number.parseFloat(g)}, ${Number.parseFloat(b)}, ${roundAlpha(
      baseAlpha * opacity
    )})`;
  }

  return color;
}

/**
 * Derives the default backgroundOpacity (0–100) from a style's bg color string.
 * e.g. "rgba(0,0,0,0.7)" → 70, "transparent" → 0
 */
export function getStyleDefaultOpacity(bg: string): number {
  if (!bg || bg === "transparent") return 0;
  const rgbaMatch = bg.match(
    /^rgba?\(\s*[0-9.]+\s*,\s*[0-9.]+\s*,\s*[0-9.]+(?:\s*,\s*([0-9.]+))?\s*\)$/
  );
  if (rgbaMatch) {
    const alpha = rgbaMatch[1] ? Number.parseFloat(rgbaMatch[1]) : 1;
    return Math.round(alpha * 100);
  }
  return 100;
}

/**
 * Returns formatting overrides to apply when switching to a given style,
 * so that the style's intended look is correctly reflected.
 */
export function getStyleFormattingDefaults(styleId: string): Partial<SubtitleFormatting> {
  const style = SUBTITLE_STYLES.find((s) => s.id === styleId);
  if (!style) return {};

  const opacity = getStyleDefaultOpacity(style.bg);
  const isTransparent = opacity === 0;

  return {
    backgroundOpacity: opacity,
    backgroundColorOverride: null,
    textShadow: isTransparent || styleId === "shadow",
    textOutline: false,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundAlpha(value: number) {
  return Math.round(value * 1000) / 1000;
}
