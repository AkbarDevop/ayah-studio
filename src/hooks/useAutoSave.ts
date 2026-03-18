"use client";

import { useEffect, useRef } from "react";
import type { PersistedProject } from "@/lib/persistence";
import { saveProject } from "@/lib/persistence";

/**
 * Auto-saves project state to localStorage with 1-second debounce.
 */
export function useAutoSave(state: PersistedProject) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      saveProject(state);
    }, 1000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [state]);
}
