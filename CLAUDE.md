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

## gstack

Use the /browse skill from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.

Available skills:
- `/office-hours` — YC-style brainstorming. Startup mode or builder mode.
- `/plan-ceo-review` — Founder/CEO mode. Rethink the problem, find the 10-star product.
- `/plan-eng-review` — Eng manager mode. Lock architecture, data flow, edge cases, tests.
- `/plan-design-review` — Designer's eye plan review. Rate design dimensions, fix gaps.
- `/design-consultation` — Create a design system and DESIGN.md from scratch.
- `/review` — Paranoid staff engineer. Find bugs that pass CI but break production.
- `/ship` — Release engineer. Sync main, run tests, push, open PR.
- `/land-and-deploy` — Merge PR, wait for CI/deploy, verify production health.
- `/canary` — Post-deploy canary monitoring with screenshots and alerts.
- `/benchmark` — Performance regression detection with baselines.
- `/browse` — QA engineer. Browser automation — navigate, screenshot, test flows.
- `/qa` — Systematic QA testing + fix loop with before/after evidence.
- `/qa-only` — QA report only, no fixes.
- `/design-review` — Visual QA audit on live site. Find and fix visual issues.
- `/setup-browser-cookies` — Import real browser cookies for authenticated testing.
- `/setup-deploy` — Configure deployment settings for /land-and-deploy.
- `/retro` — Engineering manager. Analyze commit history and shipping velocity.
- `/investigate` — Systematic debugging with root cause investigation.
- `/document-release` — Post-ship docs update. Sync README/CHANGELOG/CLAUDE.md.
- `/codex` — OpenAI Codex CLI wrapper for code review, challenge, and consult.
- `/cso` — Chief Security Officer mode. OWASP Top 10 + STRIDE security audit.
- `/careful` — Safety guardrails for destructive commands.
- `/freeze` — Restrict file edits to a specific directory.
- `/guard` — Full safety mode: destructive warnings + directory-scoped edits.
- `/unfreeze` — Clear freeze boundary, allow edits to all directories.
- `/gstack-upgrade` — Upgrade gstack to the latest version.

If gstack skills aren't working, run `cd .claude/skills/gstack && ./setup` to build the binary and register skills.

## Roadmap
Done:
- [x] Audio upload + waveform visualization (wavesurfer.js)
- [x] Auto-sync subtitles to recitation audio timestamps (OpenAI Whisper)
- [x] FFmpeg.wasm for client-side video rendering
- [x] Onboarding UX with progressive disclosure (welcome → detect → edit)
- [x] Undo/redo with keyboard shortcuts
- [x] Mobile responsive layout with bottom nav
- [x] Toast notification system
- [x] Advanced subtitle styling (background opacity, blur, outline, line spacing)

Not yet:
- [ ] Supabase auth + saved subtitle projects
- [ ] AI video generation integration
- [ ] Word-by-word Arabic highlighting mode
- [ ] Tajweed color coding
