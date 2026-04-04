"use client";

import { useState, useEffect } from "react";
import { Music, Mic, BookOpen, Clock } from "lucide-react";
import type { DetectionPhase as DetectionStep } from "@/hooks/useDetectionState";

const STEPS: {
  id: DetectionStep;
  label: string;
  icon: typeof Music;
}[] = [
  { id: "preparing", label: "Preparing audio...", icon: Music },
  { id: "uploading", label: "Uploading audio...", icon: Music },
  { id: "transcribing", label: "Transcribing with AI...", icon: Mic },
  { id: "matching", label: "Matching ayahs...", icon: BookOpen },
];

interface DetectionProgressProps {
  currentStep: DetectionStep | null;
  startTime: number | null;
}

export default function DetectionProgress({
  currentStep,
  startTime,
}: DetectionProgressProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) return;

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const currentStepIdx = currentStep
    ? STEPS.findIndex((s) => s.id === currentStep)
    : -1;

  return (
    <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-4">
      <div className="space-y-3">
        {STEPS.map((step, idx) => {
          const isActive = idx === currentStepIdx;
          const isDone = idx < currentStepIdx;
          const isPending = idx > currentStepIdx;
          const Icon = step.icon;

          return (
            <div
              key={step.id}
              className={[
                "flex items-center gap-3 rounded-xl px-3 py-2 transition-all",
                isActive
                  ? "bg-[var(--gold)]/10 border border-[var(--gold-dim)]/40"
                  : isDone
                    ? "opacity-60"
                    : "opacity-40",
              ].join(" ")}
            >
              <div
                className={[
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                  isActive
                    ? "bg-[var(--gold)]/20 text-[var(--gold)]"
                    : isDone
                      ? "bg-[var(--emerald)]/20 text-[var(--emerald-light)]"
                      : "bg-[var(--surface)] text-[var(--text-dim)]",
                ].join(" ")}
              >
                {isActive ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--gold-dim)] border-t-[var(--gold)]" />
                ) : isDone ? (
                  <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M3.5 8.5L6.5 11.5L12.5 4.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </div>

              <span
                className={[
                  "text-sm",
                  isActive
                    ? "font-medium text-[var(--gold)] step-pulse"
                    : isDone
                      ? "text-[var(--text-muted)] line-through"
                      : isPending
                        ? "text-[var(--text-dim)]"
                        : "text-[var(--text-muted)]",
                ].join(" ")}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2 px-3">
        <Clock className="h-3.5 w-3.5 text-[var(--text-dim)]" />
        <span className="font-mono-ui text-[11px] text-[var(--text-dim)]">
          {elapsed}s elapsed
        </span>
        {elapsed > 30 && (
          <span className="ml-2 text-[11px] text-[var(--text-muted)]">
            This may take a minute for longer videos
          </span>
        )}
      </div>
    </div>
  );
}
