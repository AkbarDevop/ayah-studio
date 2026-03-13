# Ayah Studio — Quran Video Subtitle Editor

## What This Is
A web app that helps creators make Quran recitation videos with properly styled Arabic text and translation subtitles. Users browse surahs, select ayahs, generate timed subtitle tracks, preview them on a video canvas, and export as SRT/ASS/JSON.

## Tech Stack
- **Framework:** Next.js 16 (App Router, TypeScript)
- **Styling:** Tailwind CSS v4 (using `@theme` in CSS, NOT tailwind.config)
- **Icons:** lucide-react
- **Fonts:** Noto Naskh Arabic, Amiri (Arabic), Manrope (UI), IBM Plex Mono (labels)
- **API:** Al-Quran Cloud API (https://api.alquran.cloud/v1)
- **Deploy:** Vercel (planned)

## Project Structure
```
ayah-studio/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout with Google Fonts
│   │   ├── page.tsx            # Main editor (client component, all state)
│   │   └── globals.css         # Tailwind v4 + custom CSS properties
│   ├── components/
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
│   │   └── export/
│   │       └── export-panel.tsx    # Export modal (SRT/ASS/JSON)
│   ├── lib/
│   │   ├── constants.ts        # Translations, subtitle styles, reciters
│   │   ├── quran-api.ts        # Al-Quran Cloud API client
│   │   └── export.ts           # SRT/ASS/JSON generation + download
│   └── types/
│       └── index.ts            # All TypeScript interfaces
├── CLAUDE.md                   # This file
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

## API
- `GET /surah` — All 114 surahs metadata
- `GET /surah/{number}` — Arabic ayahs
- `GET /surah/{number}/{edition}` — Translation ayahs

## Coding Standards
- TypeScript strict — no `any`
- Tailwind for all styling — no inline styles
- Arabic text always RTL with `dir="rtl"` or `direction: rtl`
- Components are client components (`"use client"`) since they manage state
- All state lives in `page.tsx` and is passed down as props

## Roadmap (don't build yet)
- [ ] Audio upload + waveform visualization (wavesurfer.js)
- [ ] Auto-sync subtitles to recitation audio timestamps
- [ ] FFmpeg.wasm for client-side video rendering
- [ ] Supabase auth + saved subtitle projects
- [ ] AI video generation integration
- [ ] Word-by-word Arabic highlighting mode
- [ ] Tajweed color coding
