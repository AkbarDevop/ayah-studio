"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { CheckCircle2, AlertCircle, X, Info } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const autoTimer = setTimeout(() => {
      setExiting(true);
    }, 2700);
    return () => clearTimeout(autoTimer);
  }, []);

  useEffect(() => {
    if (!exiting) return;
    const exitTimer = setTimeout(() => {
      onDismiss(toast.id);
    }, 300);
    return () => clearTimeout(exitTimer);
  }, [exiting, onDismiss, toast.id]);

  const Icon =
    toast.type === "success"
      ? CheckCircle2
      : toast.type === "error"
        ? AlertCircle
        : Info;

  const iconColor =
    toast.type === "success"
      ? "text-[var(--emerald-light)]"
      : toast.type === "error"
        ? "text-[var(--accent)]"
        : "text-[var(--gold)]";

  const borderColor =
    toast.type === "success"
      ? "border-[var(--emerald)]/40"
      : toast.type === "error"
        ? "border-[var(--accent)]/40"
        : "border-[var(--gold-dim)]/40";

  return (
    <div
      className={[
        "toast-item flex items-center gap-3 rounded-xl border px-4 py-3 shadow-xl shadow-black/30",
        "bg-[var(--surface)] backdrop-blur-md",
        borderColor,
        exiting ? "toast-exit" : "toast-enter",
      ].join(" ")}
      role="status"
    >
      <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
      <p className="min-w-0 flex-1 text-sm text-[var(--text)]">{toast.message}</p>
      <button
        type="button"
        onClick={() => setExiting(true)}
        className="shrink-0 rounded-md p-1 text-[var(--text-dim)] transition-colors hover:text-[var(--text-muted)]"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext value={{ showToast }}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col gap-2">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </div>
      )}
    </ToastContext>
  );
}
