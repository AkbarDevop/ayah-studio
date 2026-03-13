import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { NextResponse } from "next/server";
import {
  getYouTubeImportLimitMessage,
  isSupportedYouTubeUrl,
  MAX_YOUTUBE_IMPORT_BYTES,
} from "@/lib/youtube-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const YT_DLP_PATH = process.env.YT_DLP_PATH ?? "yt-dlp";
const YOUTUBE_IMPORT_FORMAT =
  "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best[ext=mp4]/best";

interface YouTubeImportRequest {
  url?: string;
}

interface YouTubeMetadata {
  title?: string;
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
    const metadata = await fetchYouTubeMetadata(url);

    await runProcess(YT_DLP_PATH, [
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

    const mediaPath = await findDownloadedMediaPath(tempDir);
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
    const message =
      error instanceof Error
        ? error.message
        : "Failed to import this YouTube clip.";

    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function fetchYouTubeMetadata(url: string) {
  const stdout = await runProcessWithOutput(YT_DLP_PATH, [
    "--no-playlist",
    "--dump-single-json",
    "--no-warnings",
    "--no-call-home",
    "--skip-download",
    url,
  ]);

  const data = JSON.parse(stdout) as YouTubeMetadata;
  return data;
}

async function findDownloadedMediaPath(tempDir: string) {
  const entries = await fs.readdir(tempDir);
  const mediaFile = entries.find((entry) => /\.(mp4|webm)$/i.test(entry));

  if (!mediaFile) {
    throw new Error(
      "yt-dlp completed but no playable video file was produced for this URL."
    );
  }

  return path.join(tempDir, mediaFile);
}

function buildImportedFilename(title: string | undefined, ext: string) {
  const safeTitle = sanitizeFilename(title || `youtube-import-${randomUUID()}`);
  const normalizedExt = ext || ".mp4";
  return `${safeTitle}${normalizedExt}`;
}

function sanitizeFilename(input: string) {
  return input
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

async function runProcess(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "ignore", "pipe"],
    });

    let stderr = "";

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          stderr.trim() ||
            `${path.basename(command)} exited with code ${String(code)}`
        )
      );
    });
  });
}

async function runProcessWithOutput(command: string, args: string[]) {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(
        new Error(
          stderr.trim() ||
            `${path.basename(command)} exited with code ${String(code)}`
        )
      );
    });
  });
}
