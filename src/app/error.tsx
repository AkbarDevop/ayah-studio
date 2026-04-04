"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
      <div className="mx-6 w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-[var(--text)]">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          {error.message || "An unexpected error occurred."}
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center rounded-xl bg-[var(--gold)] px-6 py-2.5 text-sm font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--gold-light)]"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-[var(--border-light)] bg-[var(--surface-alt)] px-6 py-2.5 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--border)]"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
