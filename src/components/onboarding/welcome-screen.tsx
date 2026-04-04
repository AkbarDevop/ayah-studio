"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  Upload,
  Sparkles,
  Download,
  Link2,
  Search,
  Loader2,
  Play,
} from "lucide-react";
import type { Surah } from "@/types";

const POPULAR_SURAHS = [1, 36, 55, 56, 67, 78, 112, 114] as const;

const SAMPLE_VIDEOS = [
  { surah: "Ad-Duha", number: 93, url: "https://www.youtube.com/watch?v=U22bA-lsCX0", duration: "1:22" },
  { surah: "Al-Qadr", number: 97, url: "https://www.youtube.com/watch?v=3RLNnB4-0aQ", duration: "0:45" },
  { surah: "Az-Zalzalah", number: 99, url: "https://www.youtube.com/watch?v=oqw3-BmdKtQ", duration: "1:10" },
  { surah: "Al-Asr", number: 103, url: "https://www.youtube.com/watch?v=jbBr13F-ewA", duration: "0:30" },
  { surah: "Al-Kawthar", number: 108, url: "https://www.youtube.com/watch?v=v2c413s_488", duration: "0:25" },
  { surah: "Al-Masad", number: 111, url: "https://www.youtube.com/watch?v=w-6iNiBQNkk", duration: "0:40" },
] as const;

function extractVideoId(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be") return parsed.pathname.slice(1).split("/")[0] || null;
    if (host.includes("youtube.com")) return parsed.searchParams.get("v") || null;
    return null;
  } catch {
    return null;
  }
}

interface WelcomeScreenProps {
  onVideoUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onYouTubeImport: (urlOverride?: string) => Promise<void>;
  youtubeUrl: string;
  onYoutubeUrlChange: (url: string) => void;
  youtubeImporting: boolean;
  youtubeImportError: string | null;
  videoInputRef: React.RefObject<HTMLInputElement | null>;
  surahs: Surah[];
  onSurahSelect: (surah: Surah) => void;
}

export default function WelcomeScreen({
  onVideoUpload,
  onYouTubeImport,
  youtubeUrl,
  onYoutubeUrlChange,
  youtubeImporting,
  youtubeImportError,
  videoInputRef,
  surahs,
  onSurahSelect,
}: WelcomeScreenProps) {
  const [dragOver, setDragOver] = useState(false);
  const [surahSearch, setSurahSearch] = useState("");
  const dropRef = useRef<HTMLDivElement>(null);

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) {
      setDragOver(false);
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && videoInputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      videoInputRef.current.files = dt.files;
      videoInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  const filteredSurahs = surahSearch.trim()
    ? surahs.filter(
        (s) =>
          s.englishName.toLowerCase().includes(surahSearch.toLowerCase()) ||
          s.name.includes(surahSearch) ||
          String(s.number) === surahSearch.trim()
      )
    : [];

  const popularSurahs = surahs.filter((s) =>
    POPULAR_SURAHS.includes(s.number as (typeof POPULAR_SURAHS)[number])
  );

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl space-y-8">
        {/* Drop zone */}
        <div
          ref={dropRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => videoInputRef.current?.click()}
          className={[
            "welcome-dropzone group cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300 sm:p-12",
            dragOver
              ? "border-[var(--gold)] bg-[var(--gold)]/8 shadow-[0_0_40px_rgba(212,168,83,0.15)]"
              : "border-[var(--border-light)] bg-[var(--surface)]/50 hover:border-[var(--gold)]/50 hover:bg-[var(--surface)]",
          ].join(" ")}
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--gold)]/10 text-[var(--gold)] transition-transform duration-300 group-hover:scale-110">
            <Upload className="h-6 w-6" />
          </div>
          <p className="text-lg font-semibold text-[var(--text)]">
            Drop your recitation video here
          </p>
          <p className="mt-1.5 text-sm text-[var(--text-muted)]">
            or click to browse files
          </p>

          {/* Divider */}
          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-[var(--border)]" />
            <span className="text-xs font-medium uppercase tracking-widest text-[var(--text-dim)] font-[family-name:var(--font-ibm-plex)]">
              or
            </span>
            <div className="h-px flex-1 bg-[var(--border)]" />
          </div>

          {/* YouTube input */}
          <div
            className="mx-auto flex max-w-md gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex-1">
              <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]" />
              <input
                type="text"
                placeholder="Paste YouTube link"
                value={youtubeUrl}
                onChange={(e) => onYoutubeUrlChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && youtubeUrl.trim()) {
                    void onYouTubeImport();
                  }
                }}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] py-2.5 pl-9 pr-3 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:border-[var(--gold)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--gold)]/20"
              />
            </div>
            <button
              type="button"
              onClick={() => void onYouTubeImport()}
              disabled={youtubeImporting || !youtubeUrl.trim()}
              className="flex items-center gap-2 rounded-xl bg-[var(--emerald)] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {youtubeImporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              <span>{youtubeImporting ? "Importing..." : "Import"}</span>
            </button>
          </div>
          {youtubeImportError && (
            <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-left" onClick={(e) => e.stopPropagation()}>
              <p className="text-xs text-red-400">{youtubeImportError}</p>
              {youtubeImportError.includes("blocked") && youtubeUrl.trim() && (
                <div className="mt-2 flex items-center gap-2">
                  <a
                    href={`https://ssyoutube.com/watch?v=${extractVideoId(youtubeUrl) || ""}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md bg-[var(--gold)]/10 px-3 py-1.5 text-xs font-medium text-[var(--gold)] transition-colors hover:bg-[var(--gold)]/20"
                  >
                    <Download className="h-3 w-3" />
                    Download video
                  </a>
                  <span className="text-xs text-[var(--text-dim)]">
                    then drag it into the upload area
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sample recitations */}
        <div>
          <p className="mb-3 text-center text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-dim)] font-[family-name:var(--font-ibm-plex)]">
            Try a sample recitation
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {SAMPLE_VIDEOS.map((sample) => (
              <button
                key={sample.number}
                type="button"
                disabled={youtubeImporting}
                onClick={() => {
                  onYoutubeUrlChange(sample.url);
                  void onYouTubeImport(sample.url);
                }}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)]/60 bg-[var(--surface-alt)]/50 px-3 py-1.5 text-xs transition-all hover:border-[var(--emerald)]/40 hover:text-[var(--emerald)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Play className="h-3 w-3 text-[var(--emerald)]" />
                <span className="text-[var(--text-muted)]">{sample.surah}</span>
                <span className="text-[var(--text-dim)]">{sample.duration}</span>
              </button>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div>
          <p className="mb-4 text-center text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-dim)] font-[family-name:var(--font-ibm-plex)]">
            How it works
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                icon: Upload,
                step: "1",
                title: "Upload",
                desc: "Drop a video or paste a YouTube link",
              },
              {
                icon: Sparkles,
                step: "2",
                title: "Detect",
                desc: "AI identifies the surah and ayah range",
              },
              {
                icon: Download,
                step: "3",
                title: "Export",
                desc: "Style your subtitles and download SRT/ASS",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-xl border border-[var(--border)]/50 bg-[var(--surface)]/40 p-4 text-center"
              >
                <div className="mx-auto mb-2.5 flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--gold)]/8 text-[var(--gold)]">
                  <item.icon className="h-4 w-4" />
                </div>
                <p className="text-sm font-semibold text-[var(--text)]">
                  {item.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Manual surah picker */}
        <div className="text-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-dim)] font-[family-name:var(--font-ibm-plex)]">
            Or pick a surah manually
          </p>

          {/* Search */}
          <div className="relative mx-auto max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]" />
            <input
              type="text"
              placeholder="Search surahs..."
              value={surahSearch}
              onChange={(e) => setSurahSearch(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] py-2.5 pl-9 pr-3 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:border-[var(--gold)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--gold)]/20"
            />
          </div>

          {/* Search results */}
          {filteredSurahs.length > 0 && (
            <div className="mx-auto mt-2 max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 max-h-48 overflow-y-auto">
              {filteredSurahs.slice(0, 8).map((surah) => (
                <button
                  key={surah.number}
                  type="button"
                  onClick={() => onSurahSelect(surah)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-alt)]"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--gold)]/10 text-xs font-semibold text-[var(--gold)]">
                    {surah.number}
                  </span>
                  <span className="text-[var(--text)]">{surah.englishName}</span>
                  <span className="ml-auto text-xs text-[var(--text-dim)]">
                    {surah.numberOfAyahs} ayahs
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Popular surahs */}
          {!surahSearch.trim() && popularSurahs.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {popularSurahs.map((surah) => (
                <button
                  key={surah.number}
                  type="button"
                  onClick={() => onSurahSelect(surah)}
                  className="rounded-lg border border-[var(--border)]/60 bg-[var(--surface-alt)]/50 px-3 py-1.5 text-xs text-[var(--text-muted)] transition-all hover:border-[var(--gold)]/40 hover:text-[var(--gold)]"
                >
                  {surah.englishName}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
