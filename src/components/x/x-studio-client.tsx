"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import {
  ArrowLeft,
  Bot,
  CalendarDays,
  Check,
  Copy,
  Download,
  ExternalLink,
  LoaderCircle,
  Search,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  buildSchedulerCsv,
  buildStrategyFilename,
  buildThreadText,
  type StrategyResult,
} from "@/lib/x-studio";

type FormState = {
  topic: string;
  audience: string;
  objective: string;
  cadence: number;
  timezone: string;
};

const STORAGE_KEY = "ayah-studio:x-strategy:v1";

const DEFAULT_FORM: FormState = {
  topic: "",
  audience: "",
  objective: "",
  cadence: 5,
  timezone:
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "America/Chicago",
};

function downloadTextFile(contents: string, filename: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function charTone(length: number) {
  if (length > 280) return "text-red-300";
  if (length > 255) return "text-amber-300";
  return "text-[var(--text-dim)]";
}

export function XStudioClient() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [strategy, setStrategy] = useState<StrategyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const deferredTopic = useDeferredValue(form.topic.trim());

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as {
        form?: Partial<FormState>;
        strategy?: StrategyResult | null;
      };

      setForm((current) => ({
        ...current,
        ...parsed.form,
        timezone:
          parsed.form?.timezone ||
          Intl.DateTimeFormat().resolvedOptions().timeZone ||
          current.timezone,
      }));

      if (parsed.strategy) {
        setStrategy(parsed.strategy);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        form,
        strategy,
      })
    );
  }, [form, strategy]);

  useEffect(() => {
    if (!copiedKey) return;

    const timeout = window.setTimeout(() => setCopiedKey(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [copiedKey]);

  const flowState = useMemo(
    () => [
      {
        label: "Research",
        detail: "Agent scans the web for source material and recent angles.",
        state: isGenerating ? "active" : strategy ? "done" : "pending",
        icon: Search,
      },
      {
        label: "Positioning",
        detail: "Turn the topic into an account promise and content pillars.",
        state:
          isGenerating
            ? "pending"
            : strategy
              ? "done"
              : deferredTopic
                ? "active"
                : "pending",
        icon: Wand2,
      },
      {
        label: "Drafting",
        detail: "Generate singles, threads, and schedule-ready copy.",
        state: strategy ? "done" : "pending",
        icon: Sparkles,
      },
      {
        label: "Scheduling",
        detail: "Export a clean handoff for X publishing or a scheduler.",
        state: strategy ? "done" : "pending",
        icon: CalendarDays,
      },
    ],
    [deferredTopic, isGenerating, strategy]
  );

  async function handleGenerate() {
    if (!form.topic.trim()) {
      setError("Give the agent a topic first.");
      return;
    }

    setError(null);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/x-strategy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: form.topic,
          audience: form.audience || undefined,
          objective: form.objective || undefined,
          cadence: form.cadence,
          timezone: form.timezone,
        }),
      });

      const payload = (await response.json()) as
        | StrategyResult
        | { error?: string };

      if (!response.ok || !("generatedAt" in payload)) {
        const errorMsg = "error" in payload ? payload.error : undefined;
        throw new Error(errorMsg || "Failed to generate a strategy.");
      }

      setStrategy(payload);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate a strategy."
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopy(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
    } catch {
      setError("Copy failed. Your browser blocked clipboard access.");
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-[family-name:var(--font-ui)]">
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-[var(--border)]/40 bg-[var(--bg)]/82 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <div className="hidden h-5 w-px bg-[var(--border)] sm:block" />
            <div>
              <p className="text-sm font-semibold tracking-tight text-[var(--gold)]">
                X Studio
              </p>
              <p className="hidden text-xs text-[var(--text-dim)] sm:block">
                Topic in, research and posts out
              </p>
            </div>
          </div>

          <UserButton
            appearance={{
              elements: {
                avatarBox: "h-8 w-8",
              },
            }}
          />
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-5 pt-28 pb-16">
        <section className="grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
          <div className="studio-panel p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="metric-pill">X-only MVP</span>
              <span className="metric-pill">Automated research</span>
              <span className="metric-pill">Scheduler handoff</span>
            </div>

            <div className="mt-6 max-w-3xl">
              <p className="section-kicker">Topic-first workflow</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Give the agent one topic.
                <br />
                It plans the week and writes the posts.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--text-muted)] sm:text-base">
                No source upload step. The agent researches the web, picks angles,
                drafts singles and threads for X, then exports a clean schedule
                handoff.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-2 block text-sm font-medium text-[var(--text)]">
                  Topic
                </span>
                <textarea
                  value={form.topic}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      topic: event.target.value,
                    }))
                  }
                  rows={4}
                  placeholder="Example: build an X account around Quran reflections for young Muslims in the U.S."
                  className="w-full rounded-2xl border border-[var(--border)] bg-[rgba(10,13,18,0.78)] px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--gold)]"
                />
              </label>

              <label>
                <span className="mb-2 block text-sm font-medium text-[var(--text)]">
                  Audience hint
                </span>
                <input
                  value={form.audience}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      audience: event.target.value,
                    }))
                  }
                  placeholder="Optional. Leave blank and let the agent infer it."
                  className="w-full rounded-2xl border border-[var(--border)] bg-[rgba(10,13,18,0.78)] px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--gold)]"
                />
              </label>

              <label>
                <span className="mb-2 block text-sm font-medium text-[var(--text)]">
                  Objective hint
                </span>
                <input
                  value={form.objective}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      objective: event.target.value,
                    }))
                  }
                  placeholder="Optional. Example: grow a trusted educational page."
                  className="w-full rounded-2xl border border-[var(--border)] bg-[rgba(10,13,18,0.78)] px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--gold)]"
                />
              </label>

              <label>
                <span className="mb-2 block text-sm font-medium text-[var(--text)]">
                  Posts this week
                </span>
                <input
                  type="number"
                  min={3}
                  max={7}
                  value={form.cadence}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      cadence: Number(event.target.value) || 5,
                    }))
                  }
                  className="w-full rounded-2xl border border-[var(--border)] bg-[rgba(10,13,18,0.78)] px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--gold)]"
                />
              </label>

              <label>
                <span className="mb-2 block text-sm font-medium text-[var(--text)]">
                  Timezone
                </span>
                <input
                  value={form.timezone}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      timezone: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-[var(--border)] bg-[rgba(10,13,18,0.78)] px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--gold)]"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--gold)] px-6 py-3 text-sm font-semibold text-[var(--bg)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isGenerating ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Generating
                  </>
                ) : (
                  <>
                    <Bot className="h-4 w-4" />
                    Generate X strategy
                  </>
                )}
              </button>

              <p className="text-sm text-[var(--text-dim)]">
                {deferredTopic
                  ? `The agent will research and draft around "${deferredTopic}".`
                  : "Start with one topic and the rest is automated."}
              </p>
            </div>

            {error ? (
              <div className="mt-6 rounded-2xl border border-red-500/35 bg-red-500/8 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}
          </div>

          <aside className="studio-panel-soft p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="section-kicker">Agent loop</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                  What happens after you hit generate
                </h2>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-black/20 px-4 py-2 text-right">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-dim)]">
                  Output
                </p>
                <p className="text-sm font-medium text-[var(--text)]">
                  Plan + drafts + export
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {flowState.map((item) => (
                <div key={item.label} className="workflow-chip" data-state={item.state}>
                  <div className="workflow-chip-icon">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">
                      {item.label}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                      {item.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-3xl border border-[var(--border)] bg-[rgba(10,13,18,0.55)] p-5">
              <p className="text-sm font-semibold text-[var(--text)]">
                Shipping constraints, on purpose
              </p>
              <ul className="mt-3 space-y-3 text-sm leading-6 text-[var(--text-muted)]">
                <li>Research is automated. The user should not be hunting sources.</li>
                <li>Publishing is export-first. No fake X sync without real OAuth.</li>
                <li>Threads stay supported in the draft layer even if a scheduler flattens them.</li>
              </ul>
            </div>

            {strategy ? (
              <div className="mt-6 rounded-3xl border border-[var(--gold)]/20 bg-[var(--gold)]/8 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--gold-light)]">
                  <Check className="h-4 w-4" />
                  Latest run
                </div>
                <p className="mt-3 text-sm text-[var(--text)]">
                  {strategy.mode === "live"
                    ? `Live research mode via ${strategy.model}.`
                    : "Fallback planner mode. The UI still works, but the sources are heuristics."}
                </p>
                <p className="mt-2 text-xs text-[var(--text-dim)]">
                  Generated {new Date(strategy.generatedAt).toLocaleString()}
                </p>
              </div>
            ) : null}
          </aside>
        </section>

        {strategy ? (
          <div className="mt-8 space-y-8">
            <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="studio-panel p-6 sm:p-8">
                <p className="section-kicker">Positioning</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                  {strategy.topic}
                </h2>
                <p className="mt-4 text-sm leading-7 text-[var(--text-muted)]">
                  {strategy.summary}
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--border)] bg-black/15 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-dim)]">
                      Audience
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--text)]">
                      {strategy.audience}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-black/15 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-dim)]">
                      Objective
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--text)]">
                      {strategy.objective}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-[var(--border)] bg-black/15 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-dim)]">
                    Positioning
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text)]">
                    {strategy.positioning}
                  </p>
                  <p className="mt-4 text-xs uppercase tracking-[0.16em] text-[var(--text-dim)]">
                    Voice
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                    {strategy.voice}
                  </p>
                </div>

                {strategy.notes.length > 0 ? (
                  <div className="mt-4 rounded-2xl border border-[var(--border)] bg-black/15 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-dim)]">
                      Notes
                    </p>
                    <div className="mt-3 space-y-2">
                      {strategy.notes.map((note) => (
                        <p key={note} className="text-sm leading-6 text-[var(--text-muted)]">
                          {note}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="studio-panel p-6 sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="section-kicker">Research inputs</p>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                      Sources the agent used
                    </h2>
                  </div>
                  <span className="metric-pill">{strategy.sources.length} sources</span>
                </div>

                <div className="mt-6 grid gap-4">
                  {strategy.sources.map((source) => (
                    <div
                      key={`${source.publisher}-${source.title}`}
                      className="rounded-2xl border border-[var(--border)] bg-black/15 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-[var(--text)]">
                            {source.title}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--gold-dim)]">
                            {source.publisher}
                          </p>
                        </div>
                        {source.url ? (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
                          >
                            Open
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                        {source.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="studio-panel p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="section-kicker">Content pillars</p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                    What the account will keep talking about
                  </h2>
                </div>
                <span className="metric-pill">{strategy.pillars.length} lanes</span>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                {strategy.pillars.map((pillar) => (
                  <div
                    key={pillar.name}
                    className="rounded-3xl border border-[var(--border)] bg-black/15 p-5"
                  >
                    <p className="text-lg font-semibold text-[var(--text)]">
                      {pillar.name}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                      {pillar.angle}
                    </p>
                    <p className="mt-4 text-xs uppercase tracking-[0.16em] text-[var(--text-dim)]">
                      Why it works
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--text)]">
                      {pillar.reason}
                    </p>
                    <div className="mt-4 rounded-2xl border border-[var(--gold)]/15 bg-[var(--gold)]/8 px-4 py-3 text-sm text-[var(--gold-light)]">
                      {pillar.exampleHook}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="studio-panel p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="section-kicker">Schedule</p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                    Next week on X
                  </h2>
                </div>
                <span className="metric-pill">{strategy.schedule.length} slots</span>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-5">
                {strategy.schedule.map((slot, index) => (
                  <div
                    key={`${slot.date}-${slot.time}-${slot.angle}`}
                    className="rounded-3xl border border-[var(--border)] bg-black/15 p-5"
                  >
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-dim)]">
                      Slot {index + 1}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-[var(--text)]">
                      {slot.dayLabel}
                    </p>
                    <p className="mt-1 text-sm text-[var(--gold-light)]">
                      {slot.time} {slot.timezone}
                    </p>
                    <div className="mt-4 inline-flex rounded-full border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      {slot.format}
                    </div>
                    <p className="mt-4 text-sm font-medium text-[var(--text)]">
                      {slot.pillar}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                      {slot.angle}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="section-kicker">Draft queue</p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                    Ready-to-post copy
                  </h2>
                </div>
              </div>

              {strategy.drafts.map((draft, index) => {
                const clipboardText =
                  draft.format === "thread"
                    ? buildThreadText(draft)
                    : draft.tweets[0] ?? "";

                return (
                  <div key={draft.id} className="studio-panel p-6 sm:p-8">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="max-w-3xl">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="metric-pill">Draft {index + 1}</span>
                          <span className="metric-pill">{draft.format}</span>
                          <span className="metric-pill">
                            {draft.scheduled.dayLabel} at {draft.scheduled.time}
                          </span>
                        </div>
                        <h3 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--text)]">
                          {draft.title}
                        </h3>
                        <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                          {draft.goal}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          onClick={() => handleCopy(draft.id, clipboardText)}
                          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:border-[var(--border-light)] hover:text-[var(--text)]"
                        >
                          {copiedKey === draft.id ? (
                            <>
                              <Check className="h-4 w-4" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" />
                              Copy {draft.format === "thread" ? "thread" : "post"}
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="mt-6 rounded-2xl border border-[var(--gold)]/20 bg-[var(--gold)]/8 px-4 py-3 text-sm text-[var(--gold-light)]">
                      <span className="font-semibold">Hook:</span> {draft.hook}
                    </div>

                    <div className="mt-6 space-y-4">
                      {draft.tweets.map((tweet, tweetIndex) => (
                        <div
                          key={`${draft.id}-${tweetIndex}`}
                          className="rounded-3xl border border-[var(--border)] bg-black/15 p-5"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <p className="text-sm font-semibold text-[var(--text)]">
                              {draft.format === "thread"
                                ? `Post ${tweetIndex + 1}`
                                : "Single post"}
                            </p>
                            <span className={`text-xs ${charTone(tweet.length)}`}>
                              {tweet.length} chars
                            </span>
                          </div>
                          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[var(--text)]">
                            {tweet}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl border border-[var(--border)] bg-black/15 p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-dim)]">
                          CTA
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[var(--text)]">
                          {draft.cta}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[var(--border)] bg-black/15 p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-dim)]">
                          Editor note
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                          {draft.notes}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>

            <section className="studio-panel p-6 sm:p-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <p className="section-kicker">Publishing handoff</p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                    Export for scheduling, keep direct posting honest
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-[var(--text-muted)]">
                    This MVP ships the hard part first: strategy, research, copy,
                    and a scheduler-ready export. Direct X posting is not faked
                    here because it needs real OAuth user tokens and explicit
                    publishing permissions.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() =>
                      downloadTextFile(
                        buildSchedulerCsv(strategy),
                        buildStrategyFilename(strategy.topic, "csv"),
                        "text/csv;charset=utf-8"
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-[var(--gold)] px-4 py-2 text-sm font-semibold text-[var(--bg)] transition hover:brightness-110"
                  >
                    <Download className="h-4 w-4" />
                    Download CSV
                  </button>
                  <button
                    onClick={() =>
                      downloadTextFile(
                        JSON.stringify(strategy, null, 2),
                        buildStrategyFilename(strategy.topic, "json"),
                        "application/json;charset=utf-8"
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:border-[var(--border-light)] hover:text-[var(--text)]"
                  >
                    <Download className="h-4 w-4" />
                    Download JSON
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-3">
                <div className="rounded-3xl border border-[var(--border)] bg-black/15 p-5">
                  <p className="text-sm font-semibold text-[var(--text)]">
                    CSV handoff
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                    Includes date, time, format, first-post text, and the full thread
                    body so nothing gets lost in the scheduler handoff.
                  </p>
                </div>
                <div className="rounded-3xl border border-[var(--border)] bg-black/15 p-5">
                  <p className="text-sm font-semibold text-[var(--text)]">
                    Threads stay intact
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                    Some schedulers flatten threads. This export keeps both the first
                    post and the entire thread text so an operator can still publish
                    it cleanly.
                  </p>
                </div>
                <div className="rounded-3xl border border-[var(--border)] bg-black/15 p-5">
                  <p className="text-sm font-semibold text-[var(--text)]">
                    Honest next step
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                    V2 is direct X posting with user OAuth. The product shape is now
                    clear enough to wire that without guessing.
                  </p>
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
