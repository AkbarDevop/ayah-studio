import { QURAN_API } from "./constants";

export interface AyahAudioEntry {
  ayahNumber: number;
  numberInSurah: number;
  audioUrl: string;
  duration: number | null;
}

// ── Quran.com API (pre-computed timestamps) ──────────────────────────────────

const QURAN_COM_API = "https://api.quran.com/api/v4";

export interface ReciterTimingEntry {
  ayahNum: number;
  start: number; // seconds
  end: number;   // seconds
}

export interface ReciterRecitation {
  audioUrl: string;
  totalDuration: number; // seconds
  ayahTimings: ReciterTimingEntry[];
}

interface QuranComTimestamp {
  verse_key: string;
  timestamp_from: number; // ms
  timestamp_to: number;   // ms
  duration: number;        // ms
  segments: Array<number[]>;
}

interface QuranComChapterRecitation {
  audio_file: {
    id: number;
    chapter_id: number;
    file_size: number;
    format: string;
    audio_url: string;
    timestamps?: QuranComTimestamp[];
  };
}

/**
 * Fetch a full-surah MP3 URL with pre-computed per-ayah timestamps
 * from the quran.com API. Single API call, instant results.
 */
export async function fetchReciterTimings(
  surahNum: number,
  quranComReciterId: number
): Promise<ReciterRecitation> {
  const res = await fetch(
    `${QURAN_COM_API}/chapter_recitations/${quranComReciterId}/${surahNum}?segments=true`
  );

  if (!res.ok) {
    throw new Error("Failed to fetch reciter audio from quran.com");
  }

  const data: QuranComChapterRecitation = await res.json();
  const { audio_url, timestamps } = data.audio_file;

  if (!timestamps || timestamps.length === 0) {
    throw new Error("No timing data available for this reciter");
  }

  const ayahTimings: ReciterTimingEntry[] = timestamps.map((ts) => {
    const [, ayahStr] = ts.verse_key.split(":");
    return {
      ayahNum: parseInt(ayahStr, 10),
      start: ts.timestamp_from / 1000,
      end: ts.timestamp_to / 1000,
    };
  });

  const totalDuration = timestamps[timestamps.length - 1].timestamp_to / 1000;

  return {
    audioUrl: audio_url,
    totalDuration,
    ayahTimings,
  };
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
