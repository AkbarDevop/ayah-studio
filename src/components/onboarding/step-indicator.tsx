"use client";

import { Upload, Sparkles, PenLine, Download } from "lucide-react";

export type StudioPhase = "welcome" | "detecting" | "results" | "editor";

const STEPS = [
  { id: "upload", label: "Upload", icon: Upload },
  { id: "detect", label: "Detect", icon: Sparkles },
  { id: "edit", label: "Edit", icon: PenLine },
  { id: "export", label: "Export", icon: Download },
] as const;

function getStepStatus(
  stepId: string,
  phase: StudioPhase
): "done" | "active" | "pending" {
  switch (stepId) {
    case "upload":
      return phase === "welcome" ? "active" : "done";
    case "detect":
      return phase === "detecting"
        ? "active"
        : phase === "results"
          ? "active"
          : phase === "editor"
            ? "done"
            : "pending";
    case "edit":
      return phase === "editor" ? "active" : "pending";
    case "export":
      return "pending";
    default:
      return "pending";
  }
}

export default function StepIndicator({ phase }: { phase: StudioPhase }) {
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((step, i) => {
        const status = getStepStatus(step.id, phase);
        const Icon = step.icon;
        return (
          <div key={step.id} className="flex items-center gap-1">
            {i > 0 && (
              <div
                className={[
                  "mx-0.5 h-px w-4 transition-colors duration-300",
                  status !== "pending"
                    ? "bg-[var(--gold)]/60"
                    : "bg-[var(--border)]",
                ].join(" ")}
              />
            )}
            <div
              className={[
                "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] transition-all duration-300 font-[family-name:var(--font-ibm-plex)]",
                status === "done"
                  ? "text-[var(--gold)]"
                  : status === "active"
                    ? "text-[var(--gold)] bg-[var(--gold)]/10"
                    : "text-[var(--text-dim)]",
              ].join(" ")}
            >
              <div className="relative">
                <Icon className="h-3 w-3" />
                {status === "active" && (
                  <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--gold)] animate-pulse" />
                )}
              </div>
              <span className="hidden sm:inline">{step.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
