import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { NextResponse } from "next/server";
import {
  getYouTubeImportLimitMessage,
  isSupportedYouTubeUrl,
  MAX_YOUTUBE_IMPORT_BYTES,
} from "@/lib/youtube-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const YT_DLP_PATH = process.env.YT_DLP_PATH || "yt-dlp";

const YOUTUBE_IMPORT_FORMAT =
  "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best[ext=mp4]/best";

interface YouTubeImportRequest {
  url?: string;
}

function runYtDlp(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      YT_DLP_PATH,
      args,
      { maxBuffer: 10 * 1024 * 1024, timeout: 90_000 },
      (error, stdout, stderr) => {
        if (error) {
          const msg = stderr?.trim() || error.message || "yt-dlp failed";
          reject(new Error(msg));
          return;
        }
        resolve(stdout);
      }
    );
  });
}

export async function POST(request: Request) {
  let payload: YouTubeImportRequest;

  try {
    payload = (await request.json()) as YouTubeImportRequest;
  } catch {
    return NextResponse.json(
      { error: "Paste a valid YouTube URL to import a clip." },
      { status: 400 }
    );
  }

  const url = payload.url?.trim() ?? "";
  if (!isSupportedYouTubeUrl(url)) {
    return NextResponse.json(
      { error: "Only direct YouTube video links are supported right now." },
      { status: 400 }
    );
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ayah-youtube-"));
  const outputTemplate = path.join(tempDir, "clip.%(ext)s");

  try {
    const metadataJson = await runYtDlp([
      "--no-playlist",
      "--dump-single-json",
      "--no-warnings",
      "--skip-download",
      url,
    ]);
    const metadata = JSON.parse(metadataJson) as { title?: string };

    await runYtDlp([
      "--no-playlist",
      "--no-progress",
      "--newline",
      "--format",
      YOUTUBE_IMPORT_FORMAT,
      "--merge-output-format",
      "mp4",
      "--output",
      outputTemplate,
      url,
    ]);

    const entries = await fs.readdir(tempDir);
    const mediaFile = entries.find((e) => /\.(mp4|webm)$/i.test(e));
    if (!mediaFile) throw new Error("No video file produced.");

    const mediaPath = path.join(tempDir, mediaFile);
    const stat = await fs.stat(mediaPath);

    if (stat.size > MAX_YOUTUBE_IMPORT_BYTES) {
      return NextResponse.json(
        { error: getYouTubeImportLimitMessage() },
        { status: 413 }
      );
    }

    const buffer = await fs.readFile(mediaPath);
    const ext = path.extname(mediaPath).toLowerCase();
    const filename = buildImportedFilename(metadata.title, ext);
    const contentType = ext === ".webm" ? "video/webm" : "video/mp4";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "content-type": contentType,
        "content-length": String(buffer.byteLength),
        "cache-control": "no-store",
        "x-imported-filename": encodeURIComponent(filename),
      },
    });
  } catch (error) {
    const raw =
      error instanceof Error ? error.message : "YouTube import failed.";

    // Detect YouTube bot-blocking patterns
    const isBlocked =
      raw.includes("Sign in to confirm") ||
      raw.includes("bot") ||
      raw.includes("ENOENT") ||
      raw.includes("yt-dlp") ||
      raw.includes("HTTP Error 403");

    const message = isBlocked
      ? "YouTube blocked this server. Download the video yourself and drag it into the upload area above."
      : raw;

    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function buildImportedFilename(title: string | undefined, ext: string) {
  const safeTitle = sanitizeFilename(title || `youtube-import-${randomUUID()}`);
  return `${safeTitle}${ext || ".mp4"}`;
}

function sanitizeFilename(input: string) {
  return input
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}
