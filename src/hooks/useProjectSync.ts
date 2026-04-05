"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import type { Subtitle, SubtitleFormatting, SubtitlePlacement, AspectRatioPreset } from "@/types";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface ProjectPayload {
  name: string;
  surahNumber: number | null;
  startAyah: number | null;
  endAyah: number | null;
  translationEdition: string;
  youtubeUrl: string;
  mediaDuration: number;
  subtitles: Subtitle[];
  subtitleStyle: string;
  subtitleFormatting: SubtitleFormatting;
  subtitlePlacement: SubtitlePlacement;
  aspectRatio: string;
}

interface EditorState {
  surahNumber: number | undefined;
  translationEdition: string;
  subtitles: Subtitle[];
  subtitleStyle: string;
  subtitleFormatting: SubtitleFormatting;
  subtitlePlacement: SubtitlePlacement;
  aspectRatio: AspectRatioPreset;
  youtubeUrl: string;
  videoDuration: number;
}

export interface ProjectSyncReturn {
  projectId: string | null;
  saveStatus: SaveStatus;
  isLoading: boolean;
  saveNow: () => void;
}

interface HydrationCallbacks {
  setSurahByNumber: (surahNumber: number) => Promise<void>;
  setTranslationEdition: (edition: string) => void;
  setSubtitles: (subtitles: Subtitle[]) => void;
  setSubtitleStyle: (style: string) => void;
  setSubtitleFormatting: (formatting: SubtitleFormatting) => void;
  setSubtitlePlacement: (placement: SubtitlePlacement) => void;
  setAspectRatio: (ratio: AspectRatioPreset) => void;
  setYoutubeUrl: (url: string) => void;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const DEBOUNCE_MS = 2000;
const SAVED_DISPLAY_MS = 3000;

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export function useProjectSync(
  editorState: EditorState,
  callbacks: HydrationCallbacks,
): ProjectSyncReturn {
  const { isSignedIn } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [projectId, setProjectId] = useState<string | null>(
    searchParams.get("project"),
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isLoading, setIsLoading] = useState(false);

  // Track whether initial hydration from server is complete
  const hydratedRef = useRef(false);
  // Track last saved payload to detect dirty state
  const lastSavedPayloadRef = useRef<string>("");
  // Debounce timer
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Saved-display timer
  const savedDisplayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guard against double-create
  const creatingRef = useRef(false);

  /* ------------------------------------------------------------------ */
  /* Build the payload from current editor state                         */
  /* ------------------------------------------------------------------ */
  const buildPayload = useCallback((): ProjectPayload => {
    const subs = editorState.subtitles;
    const ayahNums = subs.map((s) => s.ayahNum).filter((n) => n > 0);
    const startAyah = ayahNums.length > 0 ? Math.min(...ayahNums) : null;
    const endAyah = ayahNums.length > 0 ? Math.max(...ayahNums) : null;

    return {
      name: editorState.surahNumber
        ? `Surah ${editorState.surahNumber}`
        : "Untitled Project",
      surahNumber: editorState.surahNumber ?? null,
      startAyah,
      endAyah,
      translationEdition: editorState.translationEdition,
      youtubeUrl: editorState.youtubeUrl,
      mediaDuration: editorState.videoDuration,
      subtitles: subs,
      subtitleStyle: editorState.subtitleStyle,
      subtitleFormatting: editorState.subtitleFormatting,
      subtitlePlacement: editorState.subtitlePlacement,
      aspectRatio: editorState.aspectRatio,
    };
  }, [editorState]);

  /* ------------------------------------------------------------------ */
  /* Hydrate editor state from a fetched project                         */
  /* ------------------------------------------------------------------ */
  const hydrateFromProject = useCallback(
    async (project: Record<string, unknown>) => {
      if (project.translationEdition && typeof project.translationEdition === "string") {
        callbacks.setTranslationEdition(project.translationEdition);
      }

      if (project.surahNumber && typeof project.surahNumber === "number") {
        await callbacks.setSurahByNumber(project.surahNumber);
      }

      if (Array.isArray(project.subtitles) && project.subtitles.length > 0) {
        callbacks.setSubtitles(project.subtitles as Subtitle[]);
      }

      if (project.subtitleStyle && typeof project.subtitleStyle === "string") {
        callbacks.setSubtitleStyle(project.subtitleStyle);
      }

      if (project.subtitleFormatting && typeof project.subtitleFormatting === "object") {
        callbacks.setSubtitleFormatting(project.subtitleFormatting as SubtitleFormatting);
      }

      if (project.subtitlePlacement && typeof project.subtitlePlacement === "object") {
        callbacks.setSubtitlePlacement(project.subtitlePlacement as SubtitlePlacement);
      }

      if (project.aspectRatio && typeof project.aspectRatio === "string") {
        callbacks.setAspectRatio(project.aspectRatio as AspectRatioPreset);
      }

      if (project.youtubeUrl && typeof project.youtubeUrl === "string") {
        callbacks.setYoutubeUrl(project.youtubeUrl);
      }

      // Record the initial state so we don't immediately re-save
      const payload = {
        name: project.surahNumber ? `Surah ${project.surahNumber}` : "Untitled Project",
        surahNumber: project.surahNumber ?? null,
        startAyah: project.startAyah ?? null,
        endAyah: project.endAyah ?? null,
        translationEdition: project.translationEdition ?? "en.asad",
        youtubeUrl: project.youtubeUrl ?? "",
        mediaDuration: project.mediaDuration ?? 0,
        subtitles: project.subtitles ?? [],
        subtitleStyle: project.subtitleStyle ?? "shadow",
        subtitleFormatting: project.subtitleFormatting ?? {},
        subtitlePlacement: project.subtitlePlacement ?? { x: 0.5, y: 0.78 },
        aspectRatio: project.aspectRatio ?? "landscape",
      };
      lastSavedPayloadRef.current = JSON.stringify(payload);
    },
    [callbacks],
  );

  /* ------------------------------------------------------------------ */
  /* Load project on mount if ?project=xxx is present                    */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const id = searchParams.get("project");
    if (!id || !isSignedIn || hydratedRef.current) return;

    let cancelled = false;
    setIsLoading(true);

    fetch(`/api/projects/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Project not found");
        return res.json();
      })
      .then(async (project) => {
        if (cancelled) return;
        await hydrateFromProject(project);
        setProjectId(id);
        hydratedRef.current = true;
        setSaveStatus("saved");
      })
      .catch(() => {
        if (!cancelled) {
          // Project doesn't exist or user can't access it — just clear the param
          hydratedRef.current = true;
          const params = new URLSearchParams(searchParams.toString());
          params.delete("project");
          const qs = params.toString();
          router.replace(`/editor${qs ? `?${qs}` : ""}`, { scroll: false });
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams, isSignedIn, hydrateFromProject, router]);

  /* ------------------------------------------------------------------ */
  /* Save (create or update)                                             */
  /* ------------------------------------------------------------------ */
  const save = useCallback(async () => {
    if (!isSignedIn) return;

    const payload = buildPayload();
    const payloadJson = JSON.stringify(payload);

    // Nothing changed
    if (payloadJson === lastSavedPayloadRef.current) return;

    setSaveStatus("saving");

    try {
      let id = projectId;

      if (!id) {
        // Create
        if (creatingRef.current) return;
        creatingRef.current = true;

        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payloadJson,
        });

        if (!res.ok) throw new Error("Failed to create project");

        const created = await res.json();
        id = created.id as string;
        setProjectId(id);
        creatingRef.current = false;

        // Update URL without reload
        const params = new URLSearchParams(searchParams.toString());
        params.set("project", id);
        router.replace(`/editor?${params.toString()}`, { scroll: false });
      } else {
        // Update
        const res = await fetch(`/api/projects/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: payloadJson,
        });

        if (!res.ok) throw new Error("Failed to save project");
      }

      lastSavedPayloadRef.current = payloadJson;
      setSaveStatus("saved");

      // Clear "saved" indicator after a few seconds
      if (savedDisplayRef.current) clearTimeout(savedDisplayRef.current);
      savedDisplayRef.current = setTimeout(() => {
        setSaveStatus((current) => (current === "saved" ? "idle" : current));
      }, SAVED_DISPLAY_MS);
    } catch {
      setSaveStatus("error");
      creatingRef.current = false;
    }
  }, [isSignedIn, projectId, buildPayload, searchParams, router]);

  /* ------------------------------------------------------------------ */
  /* Debounced auto-save on state changes                                */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    // Don't auto-save while loading initial project
    if (isLoading) return;
    // Don't auto-save for anonymous users
    if (!isSignedIn) return;
    // Don't auto-save if we haven't loaded the project yet (for existing projects)
    if (searchParams.get("project") && !hydratedRef.current) return;
    // Don't auto-save if subtitles are empty (nothing meaningful to save)
    if (editorState.subtitles.length === 0) return;

    const payloadJson = JSON.stringify(buildPayload());
    if (payloadJson === lastSavedPayloadRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    setSaveStatus((current) => (current === "saved" ? "idle" : current));

    debounceRef.current = setTimeout(() => {
      void save();
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [editorState, isSignedIn, isLoading, searchParams, buildPayload, save]);

  /* ------------------------------------------------------------------ */
  /* Cleanup                                                             */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedDisplayRef.current) clearTimeout(savedDisplayRef.current);
    };
  }, []);

  /* ------------------------------------------------------------------ */
  /* Manual save trigger                                                 */
  /* ------------------------------------------------------------------ */
  const saveNow = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    void save();
  }, [save]);

  return {
    projectId,
    saveStatus,
    isLoading,
    saveNow,
  };
}
