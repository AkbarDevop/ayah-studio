"use client";

import { useEffect, useRef } from "react";

interface KeyboardShortcutHandlers {
  onPlayPause: () => void;
  onSeekForward: () => void;
  onSeekBackward: () => void;
  onNextSubtitle: () => void;
  onPrevSubtitle: () => void;
  onEscape: () => void;
  onDelete: () => void;
}

/**
 * Keyboard shortcuts for the editor:
 *   Space       — Play / Pause
 *   ArrowRight  — Seek forward 5 s
 *   ArrowLeft   — Seek backward 5 s
 *   ArrowDown   — Select next subtitle
 *   ArrowUp     — Select previous subtitle
 *   Escape      — Close modals / deselect
 *   Delete/Backspace — Delete selected subtitle
 *
 * All shortcuts are suppressed when focus is inside an input, textarea,
 * select, or contenteditable element.
 */
export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      switch (event.key) {
        case " ":
          if (!isInput) {
            event.preventDefault();
            ref.current.onPlayPause();
          }
          break;
        case "ArrowRight":
          if (!isInput) {
            event.preventDefault();
            ref.current.onSeekForward();
          }
          break;
        case "ArrowLeft":
          if (!isInput) {
            event.preventDefault();
            ref.current.onSeekBackward();
          }
          break;
        case "ArrowDown":
          if (!isInput) {
            event.preventDefault();
            ref.current.onNextSubtitle();
          }
          break;
        case "ArrowUp":
          if (!isInput) {
            event.preventDefault();
            ref.current.onPrevSubtitle();
          }
          break;
        case "Escape":
          ref.current.onEscape();
          break;
        case "Delete":
        case "Backspace":
          if (!isInput) {
            event.preventDefault();
            ref.current.onDelete();
          }
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
