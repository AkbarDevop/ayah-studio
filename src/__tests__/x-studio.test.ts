import { describe, expect, it } from "vitest";
import {
  buildFallbackStrategy,
  buildSchedulerCsv,
  buildSchedulerRows,
  buildThreadText,
  parseJsonResponse,
} from "@/lib/x-studio";

describe("buildFallbackStrategy", () => {
  it("creates a complete fallback plan from a single topic", () => {
    const strategy = buildFallbackStrategy({
      topic: "Quran reflections for young Muslims on X",
      cadence: 5,
      timezone: "America/Chicago",
    });

    expect(strategy.topic).toContain("Quran reflections");
    expect(strategy.schedule).toHaveLength(5);
    expect(strategy.drafts).toHaveLength(5);
    expect(strategy.sources.length).toBeGreaterThan(0);
    expect(strategy.mode).toBe("fallback");
  });

  it("keeps thread drafts multi-post", () => {
    const strategy = buildFallbackStrategy({
      topic: "Islam and Quran education",
      cadence: 5,
      timezone: "America/Chicago",
    });

    const thread = strategy.drafts.find((draft) => draft.format === "thread");

    expect(thread).toBeDefined();
    expect(thread?.tweets.length).toBeGreaterThan(1);
  });
});

describe("buildSchedulerRows", () => {
  it("preserves thread bodies for scheduler handoff", () => {
    const strategy = buildFallbackStrategy({
      topic: "Quran study habit",
      cadence: 5,
      timezone: "America/Chicago",
    });

    const rows = buildSchedulerRows(strategy);
    const threadRow = rows.find((row) => row.format === "thread");

    expect(rows).toHaveLength(5);
    expect(threadRow?.threadText).toContain("1.");
    expect(threadRow?.reviewStatus).toBe("Needs review");
  });
});

describe("buildSchedulerCsv", () => {
  it("escapes quotes and keeps the CSV header", () => {
    const strategy = buildFallbackStrategy({
      topic: 'Quran "clarity" series',
      cadence: 5,
      timezone: "America/Chicago",
    });

    strategy.drafts[0].tweets = ['A "quoted" line'];

    const csv = buildSchedulerCsv(strategy);

    expect(csv).toContain("publish_date,publish_time,timezone");
    expect(csv).toContain('"A ""quoted"" line"');
  });
});

describe("parseJsonResponse", () => {
  it("parses raw JSON", () => {
    const parsed = parseJsonResponse<{ ok: boolean }>('{"ok":true}');
    expect(parsed).toEqual({ ok: true });
  });

  it("extracts the trailing JSON object from noisy text", () => {
    const parsed = parseJsonResponse<{ ok: boolean }>(
      'some wrapper text\n{"ok":true}'
    );
    expect(parsed).toEqual({ ok: true });
  });
});

describe("buildThreadText", () => {
  it("numbers thread segments for clipboard use", () => {
    const strategy = buildFallbackStrategy({
      topic: "Islamic study routine",
      cadence: 5,
      timezone: "America/Chicago",
    });
    const thread = strategy.drafts.find((draft) => draft.format === "thread");

    expect(thread).toBeDefined();
    expect(buildThreadText(thread!)).toContain("1.");
  });
});
