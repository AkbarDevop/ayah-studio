import { QURAN_API } from "./constants";

export interface AyahAudioEntry {
  ayahNumber: number;
  numberInSurah: number;
  audioUrl: string;
  duration: number | null;
}

interface AudioAyahResponse {
  number: number;
  audio: string;
  numberInSurah: number;
  text: string;
}

interface AudioSurahResponse {
  number: number;
  name: string;
  ayahs: AudioAyahResponse[];
}

interface ApiResponse<T> {
  code: number;
  status: string;
  data: T;
}

/**
 * Fetch audio URLs for every ayah of a surah from a specific reciter edition.
 * The Al-Quran Cloud API returns ayahs with an `audio` field containing MP3 URLs.
 */
export async function fetchSurahAudio(
  surahNum: number,
  reciterIdentifier: string
): Promise<AyahAudioEntry[]> {
  const res = await fetch(
    `${QURAN_API}/surah/${surahNum}/${reciterIdentifier}`
  );
  const data: ApiResponse<AudioSurahResponse> = await res.json();
  if (data.code !== 200) throw new Error("Failed to fetch reciter audio");

  return data.data.ayahs.map((ayah) => ({
    ayahNumber: ayah.number,
    numberInSurah: ayah.numberInSurah,
    audioUrl: ayah.audio,
    duration: null,
  }));
}

/**
 * Measure the duration of an audio file by loading its metadata.
 */
export function getAudioDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.preload = "metadata";

    audio.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(audio.duration)) {
        resolve(audio.duration);
      } else {
        reject(new Error("Invalid audio duration"));
      }
    });

    audio.addEventListener("error", () => {
      reject(new Error("Failed to load audio metadata"));
    });

    audio.src = url;
  });
}

/**
 * Load durations for all ayah audio files in batches of 5 to avoid
 * overwhelming the browser with concurrent requests.
 */
export async function loadAudioDurations(
  entries: AyahAudioEntry[],
  onProgress?: (loaded: number, total: number) => void
): Promise<AyahAudioEntry[]> {
  const results: AyahAudioEntry[] = [...entries];
  const batchSize = 5;
  let loaded = 0;

  for (let i = 0; i < results.length; i += batchSize) {
    const batch = results.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      batch.map((a) => getAudioDuration(a.audioUrl))
    );

    settled.forEach((result, j) => {
      const idx = i + j;
      if (result.status === "fulfilled") {
        results[idx] = { ...results[idx], duration: result.value };
      }
    });

    loaded = Math.min(loaded + batch.length, results.length);
    onProgress?.(loaded, results.length);
  }

  return results;
}
