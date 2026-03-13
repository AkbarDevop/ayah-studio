export const MAX_AYAH_DETECT_UPLOAD_BYTES = 100 * 1024 * 1024;
export const MAX_AYAH_DETECT_UPLOAD_MB =
  MAX_AYAH_DETECT_UPLOAD_BYTES / (1024 * 1024);
export const MAX_AYAH_DETECT_MULTIPART_OVERHEAD_BYTES = 1024 * 1024;

export function getAyahDetectUploadLimitMessage() {
  return `Ayah detection supports files up to ${MAX_AYAH_DETECT_UPLOAD_MB} MB. Upload a shorter clip or a compressed audio track.`;
}
