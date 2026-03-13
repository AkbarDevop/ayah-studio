# Ayah Studio

Ayah Studio is a Quran video subtitle editor for creators who work with recitation clips. It helps you load a reciter video, choose ayahs, generate subtitle timing, refine the text, position the overlay visually, and export subtitle files for use in editors and publishing workflows.

## What It Does

- Browse all 114 surahs and load Arabic ayahs with translation from the Al-Quran Cloud API
- Select ayahs and generate timed subtitle tracks with configurable seconds per ayah
- Upload a local recitation clip and preview subtitles over the real video
- Switch between `16:9`, `9:16`, and `1:1` canvas presets for YouTube, Reels, and feed formats
- Drag subtitle placement directly inside the preview, with quick presets for upper-third, center, and lower-third layouts
- Edit subtitle timing, Arabic text, and translation inline
- Export subtitles as `SRT`, `ASS`, or `JSON`

## Current Product Scope

This repo is focused on the editing workflow, not final rendered video export yet.

Implemented now:

- Quran browsing and translation selection
- Subtitle generation and editing
- Timeline view
- Style presets for Arabic + translation overlays
- Local video preview
- Subtitle positioning
- `SRT` / `ASS` / `JSON` export

Not implemented yet:

- Burned-in final video rendering
- Audio waveform syncing
- Ayah auto-detection from uploaded audio/video
- Saved cloud projects

## Local Setup

Ayah Studio currently expects Node 22.

```bash
nvm use 22
npm install
npm run dev
```

Open `http://localhost:3000`.

If you do not use `nvm`, the repo includes [`.nvmrc`](./.nvmrc) and the package engine range in [package.json](./package.json).

## How To Use

1. Upload a reciter clip in the workspace header, or start without a clip.
2. Search and open a surah from the `Browse` tab.
3. Choose the ayahs you want and click `Generate`.
4. Review subtitles in the `Subtitles` tab and edit text or timing.
5. Change subtitle style and position in the `Style` tab.
6. Export `SRT`, `ASS`, or `JSON`.

## Export Notes

- `SRT` is the most broadly compatible plain subtitle format.
- `ASS` keeps styling and placement, including the current subtitle position inside the frame.
- `JSON` is useful for future integrations or custom rendering pipelines.

## Product Direction

The intended direction is a Quran-aware editing workflow for short-form recitation content:

- reciter clip upload
- smart cropping for social formats
- ayah-aware subtitle alignment
- later, safer visual assist tools for backgrounds and supporting motion design

The app is intentionally not framed as unconstrained religious scene generation. The stronger product is accurate editing assistance around real recitation clips.

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- Al-Quran Cloud API

## Repository Notes

- Main app entry: [`src/app/page.tsx`](./src/app/page.tsx)
- Quran API client: [`src/lib/quran-api.ts`](./src/lib/quran-api.ts)
- Subtitle export utilities: [`src/lib/export.ts`](./src/lib/export.ts)
- Project context and conventions: [`CLAUDE.md`](./CLAUDE.md)
