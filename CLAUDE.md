# Ayah Studio — Quran Video Subtitle Editor

## What This Is
A web app that helps creators make Quran recitation videos with properly styled Arabic text and translation subtitles. Users browse surahs, select ayahs, upload audio, detect ayah boundaries via Whisper ASR, generate timed subtitle tracks, preview them on a video canvas, and export as SRT/ASS/JSON.

## Tech Stack
- **Framework:** Next.js 16 (App Router, TypeScript strict)
- **React:** 19
- **Styling:** Tailwind CSS v4 (using `@theme` in CSS, NOT tailwind.config)
- **Icons:** lucide-react
- **Fonts:** Noto Naskh Arabic, Amiri (Arabic), Manrope (UI), IBM Plex Mono (labels)
- **API:** Al-Quran Cloud API (https://api.alquran.cloud/v1)
- **ASR:** HuggingFace Whisper (remote) + MLX Whisper (local fallback)
- **Audio:** ffmpeg/ffprobe for silence detection and format conversion
- **Testing:** Vitest
- **CI:** GitHub Actions (lint → typecheck → test → build)

## Project Structure
```
ayah-studio/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout with Google Fonts + ErrorBoundary
│   │   ├── page.tsx                # Main editor (client component)
│   │   ├── globals.css             # Tailwind v4 + custom CSS properties
│   │   └── api/
│   │       ├── ayah-detect/route.ts    # Audio upload → Whisper → ayah matching
│   │       └── youtube-import/route.ts # YouTube audio extraction
│   ├── components/
│   │   ├── audio/
│   │   │   └── audio-waveform.tsx  # Waveform visualization
│   │   ├── editor/
│   │   │   ├── surah-browser.tsx   # Surah list with search + translation picker
│   │   │   ├── ayah-card.tsx       # Individual ayah card (toggle selection)
│   │   │   └── ayah-selector.tsx   # Ayah list with select all/generate controls
│   │   ├── timeline/
│   │   │   └── timeline-track.tsx  # Horizontal timeline with subtitle blocks
│   │   ├── preview/
│   │   │   └── video-preview.tsx   # 16:9 video canvas with subtitle overlay
│   │   ├── subtitle/
│   │   │   └── subtitle-editor.tsx # Edit timing, Arabic text, translation
│   │   ├── export/
│   │   │   └── export-panel.tsx    # Export modal (SRT/ASS/JSON)
│   │   └── error-boundary.tsx      # React error boundary with fallback UI
│   ├── hooks/
│   │   ├── useQuranData.ts         # Surah/ayah fetching & selection state
│   │   ├── useMediaState.ts        # Audio/video upload & playback state
│   │   ├── useSubtitles.ts         # Subtitle CRUD, generation, formatting
│   │   ├── usePlayback.ts          # Playback controls, simulation timer
│   │   └── useDetectionState.ts    # Ayah detection progress & results
│   ├── lib/
│   │   ├── constants.ts            # Translations, subtitle styles, reciters
│   │   ├── quran-api.ts            # Al-Quran Cloud API client
│   │   ├── export.ts               # SRT/ASS/JSON generation + download
│   │   ├── subtitle-formatting.ts  # Font/color resolution helpers
│   │   ├── subtitle-generation.ts  # buildSubtitlesFromAyahRange with chunking
│   │   ├── subtitle-timing.ts      # normalizeSubtitleTiming (NaN/clamp)
│   │   ├── ayah-detection.ts       # Transcript → Quran matching (Dice coefficient)
│   │   ├── ayah-detection-config.ts # Detection limits & config
│   │   └── youtube-import.ts       # YouTube URL parsing & import
│   └── types/
│       └── index.ts                # All TypeScript interfaces
├── scripts/
│   └── mlx_whisper_transcribe.py   # Local MLX Whisper fallback script
├── src/__tests__/
│   ├── export.test.ts              # SRT/ASS/JSON export tests
│   ├── subtitle-formatting.test.ts # Font/color formatting tests
│   ├── subtitle-generation.test.ts # Subtitle generation tests
│   └── subtitle-timing.test.ts     # Timing normalization tests
├── .github/workflows/ci.yml        # CI pipeline
├── .env.example                    # Required env vars
├── vitest.config.ts
├── CLAUDE.md
└── package.json
```

## Design System
Islamic-inspired dark theme. Colors defined as CSS custom properties in globals.css:
- Background: `--bg` (#0C0F14), `--surface` (#141820), `--surface-alt` (#1A1F2A)
- Borders: `--border` (#2A3040), `--border-light` (#3A4055)
- Accent: `--gold` (#D4A853), `--emerald` (#2E8B6E)
- Text: `--text` (#E8E4DC), `--text-muted` (#8A8D96), `--text-dim` (#5A5D66)

Use Tailwind arbitrary values: `bg-[var(--surface)]`, `text-[var(--gold)]`, etc.

## Key Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run lint` — ESLint check
- `npm test` — Run Vitest test suite
- `npm run test:watch` — Vitest in watch mode

## API Routes
- **`/api/ayah-detect`** — POST: Upload audio file → ffmpeg silence detection → Whisper transcription → Quran corpus matching → returns ayah boundaries with timestamps
- **`/api/youtube-import`** — POST: YouTube URL → extract audio for import

## External API
- `GET /surah` — All 114 surahs metadata
- `GET /surah/{number}` — Arabic ayahs
- `GET /surah/{number}/{edition}` — Translation ayahs

## Coding Standards
- TypeScript strict — no `any`
- Tailwind for all styling — no inline styles
- Arabic text always RTL with `dir="rtl"` or `direction: rtl`
- Components are client components (`"use client"`) since they manage state
- State decomposed into custom hooks (useQuranData, useMediaState, useSubtitles, usePlayback, useDetectionState)
- ASS subtitle colors use BGR byte order (`&H00BBGGRR`), not RGB
- Tests go in `src/__tests__/`

## Architecture Notes
- **Ayah detection pipeline:** Audio upload → ffmpeg silence split → HuggingFace Whisper ASR (remote) or MLX Whisper (local fallback) → Arabic diacritics normalization → bigram Dice coefficient scoring against Quran corpus → boundary timestamps
- **Leading segment detection:** Identifies istiadha, basmala, al-Fatiha, and ameen recitations before the selected surah
- **Subtitle chunking:** Long ayahs can be split into display chunks by word count for readability
- **100MB upload limit** for audio files (configured in ayah-detection-config.ts)

## Roadmap
- [x] Audio upload + waveform visualization
- [x] Auto-sync subtitles to recitation audio timestamps (ayah detection)
- [ ] FFmpeg.wasm for client-side video rendering
- [ ] Supabase auth + saved subtitle projects
- [ ] AI video generation integration
- [ ] Word-by-word Arabic highlighting mode
- [ ] Tajweed color coding
