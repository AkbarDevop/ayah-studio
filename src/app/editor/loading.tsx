export default function EditorLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-[var(--text)] animate-pulse">
          Ayah Studio
        </h1>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Loading editor...
        </p>
      </div>
    </div>
  );
}
