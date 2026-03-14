"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-6">
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10">
              <span className="text-2xl">&#9888;</span>
            </div>
            <h2 className="text-lg font-semibold text-[var(--text)]">
              Something went wrong
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
              {this.state.error?.message ?? "An unexpected error occurred."}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
              }}
              className="mt-5 rounded-lg bg-[var(--gold)] px-5 py-2.5 text-sm font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--gold-light)]"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
