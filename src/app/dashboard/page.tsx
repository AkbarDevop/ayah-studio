"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Plus, BookOpen, Clock, Bot, Trash2 } from "lucide-react";

interface Project {
  id: string;
  name: string;
  surahNumber: number | null;
  surahName: string | null;
  translationCount: number;
  subtitleCount: number;
  updatedAt: string;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function deleteProject(id: string) {
    const confirmed = window.confirm(
      "Delete this project? This cannot be undone."
    );
    if (!confirmed) return;

    setDeleting(id);
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // Silently fail — the project stays in the list
    } finally {
      setDeleting(null);
    }
  }

  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch("/api/projects");
        if (!res.ok) {
          throw new Error(`Failed to load projects (${res.status})`);
        }
        const data: Project[] = await res.json();
        setProjects(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load projects"
        );
      } finally {
        setLoading(false);
      }
    }

    fetchProjects();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-[family-name:var(--font-ui)]">
      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-[var(--border)]/40 bg-[var(--bg)]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="text-[var(--gold)] text-lg font-bold tracking-tight">
              Ayah Studio
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/editor"
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--gold)] px-4 py-2 text-sm font-semibold text-[var(--bg)] transition-all hover:brightness-110 hover:shadow-[0_0_20px_rgba(212,168,83,0.2)]"
            >
              <Plus className="h-4 w-4" />
              New Project
            </Link>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8",
                },
              }}
            />
          </div>
        </div>
      </nav>

      {/* ── Main Content ────────────────────────────────────────── */}
      <main className="mx-auto max-w-6xl px-5 pt-28 pb-16">
        <div className="mb-8 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Projects</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Quran subtitle projects live here. X strategy runs in its own focused studio.
            </p>
          </div>

          <Link
            href="/dashboard/x"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--gold)]/35 bg-[var(--gold)]/10 px-4 py-3 text-sm font-semibold text-[var(--gold-light)] transition hover:bg-[var(--gold)]/14"
          >
            <Bot className="h-4 w-4" />
            Open X Studio
          </Link>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="studio-panel p-6 flex flex-col gap-3"
              >
                <div className="skeleton h-5 w-3/5" />
                <div className="skeleton h-4 w-4/5" />
                <div className="mt-auto pt-4 flex items-center justify-between">
                  <div className="skeleton h-3 w-2/5" />
                  <div className="skeleton h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="studio-panel p-8 text-center">
            <p className="text-[var(--text-muted)] mb-4">{error}</p>
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                fetch("/api/projects")
                  .then((res) => {
                    if (!res.ok) throw new Error(`Failed (${res.status})`);
                    return res.json();
                  })
                  .then((data: Project[]) => setProjects(data))
                  .catch((err: unknown) =>
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Failed to load projects"
                    )
                  )
                  .finally(() => setLoading(false));
              }}
              className="rounded-lg border border-[var(--border)] px-5 py-2 text-sm font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--border-light)] hover:text-[var(--text)]"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && projects.length === 0 && (
          <div className="studio-panel p-12 flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--gold)]/10 mb-5">
              <BookOpen className="h-6 w-6 text-[var(--gold)]" />
            </div>
            <h2 className="text-lg font-semibold mb-2">No projects yet</h2>
            <p className="text-sm text-[var(--text-muted)] mb-6 max-w-sm">
              Create your first project to start adding Quran subtitles to your
              recitation videos.
            </p>
            <Link
              href="/editor"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--gold)] px-6 py-3 text-sm font-semibold text-[var(--bg)] transition-all hover:brightness-110 hover:shadow-[0_0_24px_rgba(212,168,83,0.25)]"
            >
              <Plus className="h-4 w-4" />
              Create your first project
            </Link>
          </div>
        )}

        {/* Project grid */}
        {!loading && !error && projects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((project) => (
              <div
                key={project.id}
                className="studio-panel p-6 text-left transition-all hover:border-[var(--border-light)] hover:shadow-[0_0_24px_rgba(0,0,0,0.2)] group relative"
              >
                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteProject(project.id);
                  }}
                  disabled={deleting === project.id}
                  className="absolute top-3 right-3 p-1.5 rounded-lg text-[var(--text-dim)] opacity-0 group-hover:opacity-100 transition-all hover:text-red-400 hover:bg-red-400/10 disabled:opacity-50"
                  title="Delete project"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>

                {/* Clickable area */}
                <button
                  onClick={() =>
                    router.push(`/editor?project=${project.id}`)
                  }
                  className="w-full text-left cursor-pointer"
                >
                  {/* Surah name */}
                  {project.surahName && (
                    <p className="text-sm font-medium text-[var(--gold)] mb-1 flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5" />
                      {project.surahName}
                    </p>
                  )}

                  {/* Project name */}
                  <h3 className="text-base font-semibold text-[var(--text)] group-hover:text-[var(--text)] mb-3 truncate">
                    {project.name}
                  </h3>

                  {/* Stats row */}
                  <div className="flex items-center gap-3 text-xs text-[var(--text-dim)] mb-3">
                    {project.subtitleCount > 0 && (
                      <span>
                        {project.subtitleCount}{" "}
                        {project.subtitleCount === 1 ? "subtitle" : "subtitles"}
                      </span>
                    )}
                    {project.subtitleCount > 0 &&
                      project.translationCount > 0 && (
                        <span className="text-[var(--border)]">·</span>
                      )}
                    {project.translationCount > 0 && (
                      <span>
                        {project.translationCount}{" "}
                        {project.translationCount === 1
                          ? "translation"
                          : "translations"}
                      </span>
                    )}
                  </div>

                  {/* Last edited */}
                  <div className="flex items-center gap-1.5 text-xs text-[var(--text-dim)]">
                    <Clock className="h-3 w-3" />
                    <span>{timeAgo(project.updatedAt)}</span>
                  </div>
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
