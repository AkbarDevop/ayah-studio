"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { PlaybackMode } from "@/types";

export function usePlayback() {
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  function reset() {
    setPlaying(false);
    setCurrentTime(0);
  }

  return {
    currentTime,
    setCurrentTime,
    playing,
    setPlaying,
    reset,
  };
}

export function useSimulationTimer(
  playbackMode: PlaybackMode,
  playing: boolean,
  totalDuration: number,
  setCurrentTime: Dispatch<SetStateAction<number>>,
  setPlaying: Dispatch<SetStateAction<boolean>>
) {
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (playbackMode !== "simulation") {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
      return;
    }

    if (playing) {
      playIntervalRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + 0.1;
          if (next >= totalDuration) {
            setPlaying(false);
            return 0;
          }
          return next;
        });
      }, 100);
    } else if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [playbackMode, playing, totalDuration, setCurrentTime, setPlaying]);
}
