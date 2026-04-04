export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border-light)] border-t-[var(--gold)]"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}
