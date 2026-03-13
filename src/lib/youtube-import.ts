export const MAX_YOUTUBE_IMPORT_BYTES = 180 * 1024 * 1024;
export const MAX_YOUTUBE_IMPORT_MB = Math.round(
  MAX_YOUTUBE_IMPORT_BYTES / (1024 * 1024)
);

export function getYouTubeImportLimitMessage() {
  return `Imported YouTube clips must be ${MAX_YOUTUBE_IMPORT_MB} MB or smaller.`;
}

export function isSupportedYouTubeUrl(input: string) {
  try {
    const url = new URL(input.trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, "");

    return (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host === "youtu.be" ||
      host.endsWith(".youtube.com")
    );
  } catch {
    return false;
  }
}
