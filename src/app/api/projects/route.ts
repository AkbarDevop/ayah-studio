import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

// GET /api/projects — list the current user's projects
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.updatedAt));

  return NextResponse.json(userProjects);
}

// POST /api/projects — create a new project
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const [project] = await db
    .insert(projects)
    .values({
      userId,
      name: body.name,
      surahNumber: body.surahNumber,
      startAyah: body.startAyah,
      endAyah: body.endAyah,
      translationEdition: body.translationEdition,
      videoUrl: body.videoUrl,
      youtubeUrl: body.youtubeUrl,
      mediaDuration: body.mediaDuration,
      subtitles: body.subtitles,
      subtitleStyle: body.subtitleStyle,
      subtitleFormatting: body.subtitleFormatting,
      subtitlePlacement: body.subtitlePlacement,
      aspectRatio: body.aspectRatio,
    })
    .returning();

  return NextResponse.json(project, { status: 201 });
}
