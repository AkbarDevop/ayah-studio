import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
      <div className="text-center px-6">
        <h1 className="text-[8rem] font-bold leading-none text-[var(--gold)] tracking-tight">
          404
        </h1>
        <p className="mt-2 text-xl text-[var(--text-muted)]">Page not found</p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-[var(--gold)] px-6 py-2.5 text-sm font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--gold-light)]"
          >
            Go to Ayah Studio
          </Link>
          <Link
            href="/editor"
            className="inline-flex items-center justify-center rounded-xl border border-[var(--border-light)] bg-[var(--surface)] px-6 py-2.5 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface-alt)]"
          >
            Open Editor
          </Link>
        </div>
      </div>
    </div>
  );
}
