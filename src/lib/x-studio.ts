// @ts-nocheck
export type StrategyRequest = {
  topic: string;
  audience?: string;
  objective?: string;
  timezone?: string;
  cadence?: number;
};

export type ResearchSource = {
  title: string;
  url?: string;
  publisher: string;
  reason: string;
};

export type ContentPillar = {
  name: string;
  angle: string;
  reason: string;
  exampleHook: string;
};

export type ScheduleSlot = {
  dayLabel: string;
  date: string;
  time: string;
  timezone: string;
  format: "single" | "thread";
  pillar: string;
  objective: string;
  angle: string;
};

export type DraftPost = {
  id: string;
  format: "single" | "thread";
  title: string;
  hook: string;
  goal: string;
  cta: string;
  notes: string;
  tweets: string[];
  scheduled: ScheduleSlot;
};

export type StrategyResult = {
  topic: string;
  audience: string;
  objective: string;
  positioning: string;
  voice: string;
  summary: string;
  generatedAt: string;
  mode: "live" | "fallback";
  model: string;
  sources: ResearchSource[];
  pillars: ContentPillar[];
  schedule: ScheduleSlot[];
  drafts: DraftPost[];
  notes: string[];
};

export type SchedulerRow = {
  publishDate: string;
  publishTime: string;
  timezone: string;
  platform: "x";
  format: "single" | "thread";
  title: string;
  postText: string;
  threadText: string;
  reviewStatus: string;
};

type RawStrategyPayload = {
  audience?: string;
  objective?: string;
  positioning?: string;
  voice?: string;
  summary?: string;
  sources?: Array<Partial<ResearchSource>>;
  pillars?: Array<Partial<ContentPillar>>;
  schedule?: Array<
    Partial<Pick<ScheduleSlot, "format" | "pillar" | "objective" | "angle">> & {
      dayLabel?: string;
      time?: string;
    }
  >;
  drafts?: Array<
    Partial<
      Pick<DraftPost, "format" | "title" | "hook" | "goal" | "cta" | "notes">
    > & {
      tweets?: string[];
    }
  >;
  notes?: string[];
};

const DEFAULT_TIMEZONE = "America/Chicago";
const DEFAULT_CADENCE = 5;
const DEFAULT_TIMES = [
  "08:45",
  "12:15",
  "18:40",
  "09:30",
  "19:10",
  "11:20",
  "20:05",
] as const;

const ISLAMIC_KEYWORDS = [
  "islam",
  "quran",
  "ayah",
  "surah",
  "tafsir",
  "hadith",
  "dua",
  "muslim",
  "ramadan",
];

function clampCadence(value?: number): number {
  if (!value) return DEFAULT_CADENCE;
  return Math.min(7, Math.max(3, Math.round(value)));
}

export function isIslamicTopic(topic: string): boolean {
  const normalized = topic.toLowerCase();
  return ISLAMIC_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export function formatDateParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function formatDayLabel(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function cleanText(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function cleanTweets(value: string[] | undefined, fallback: string[]): string[] {
  const tweets =
    value?.map((tweet) => tweet.trim()).filter((tweet) => tweet.length > 0) ?? [];

  return tweets.length > 0 ? tweets : fallback;
}

function deriveAudience(topic: string, audience?: string): string {
  if (audience?.trim()) return audience.trim();

  if (isIslamicTopic(topic)) {
    return "English-speaking Muslims on X who want grounded, shareable reminders with real substance.";
  }

  return "Curious X users who save practical, well-structured posts and follow niche experts.";
}

function deriveObjective(topic: string, objective?: string): string {
  if (objective?.trim()) return objective.trim();

  if (isIslamicTopic(topic)) {
    return "Build an account people trust for concise Quran-centered insight, not generic motivation.";
  }

  return `Turn ${topic.trim()} into a repeatable X content engine that grows trust and profile visits.`;
}

function buildScheduleSeed(
  topic: string,
  audience: string,
  objective: string,
  cadence: number
): RawStrategyPayload {
  const baseTheme = cleanText(topic, "your topic");

  return {
    audience,
    objective,
    positioning: isIslamicTopic(topic)
      ? `A trustworthy X account for ${baseTheme} that favors text, citations, and practical reflection over hot takes.`
      : `A focused X account for ${baseTheme} that teaches fast, earns saves, and builds repeat attention.`,
    voice: isIslamicTopic(topic)
      ? "Respectful, clear, non-performative, source-aware, and calm."
      : "Sharp, useful, practical, and easy to repost without sounding automated.",
    summary: isIslamicTopic(topic)
      ? `Research-first X strategy for ${baseTheme}. Lead with the text, add context, then close with one concrete takeaway people can apply or share.`
      : `Research-first X strategy for ${baseTheme}. Alternate between practical frameworks, strong hooks, and compact threads that make the account worth following.`,
    sources: isIslamicTopic(topic)
      ? [
          {
            title: "Quran text and translations",
            publisher: "Quran.com",
            url: "https://quran.com",
            reason: "Primary text source for ayah references and trusted translations.",
          },
          {
            title: "Quran translations and explanation database",
            publisher: "QuranEnc",
            url: "https://quranenc.com",
            reason: "Useful for cross-checking translation wording and reference structure.",
          },
          {
            title: "Long-form Islamic research and explainers",
            publisher: "Yaqeen Institute",
            url: "https://yaqeeninstitute.org",
            reason: "Adds contemporary framing without losing seriousness.",
          },
        ]
      : [
          {
            title: "Official documentation or first-party material",
            publisher: "Primary source",
            reason: "Anchor the account in the real thing, not summaries of summaries.",
          },
          {
            title: "Recent practitioner analysis",
            publisher: "Expert source",
            reason: "Find what working operators are saying right now.",
          },
          {
            title: "Community pain points and FAQs",
            publisher: "Community forums",
            reason: "Use recurring questions as ready-made post hooks.",
          },
        ],
    pillars: isIslamicTopic(topic)
      ? [
          {
            name: "Ayah unpacked",
            angle: "Take one ayah or short passage and explain what people miss on first read.",
            reason: "This builds trust because it starts from the text, not the opinion.",
            exampleHook: `One ayah in ${baseTheme} changes how people usually talk about it.`,
          },
          {
            name: "Daily life bridge",
            angle: "Connect the Quranic theme to a real behavior, struggle, or routine.",
            reason: "People share what helps them live better, not just what sounds beautiful.",
            exampleHook: `If you only apply one lesson from ${baseTheme} this week, make it this.`,
          },
          {
            name: "Misread and clarified",
            angle: "Clarify a common oversimplification without sounding combative.",
            reason: "Correction content earns replies and saves when it stays calm and sourced.",
            exampleHook: `A common mistake in how people discuss ${baseTheme}:`,
          },
          {
            name: "Short thread series",
            angle: "Use 4-6 post threads when the idea needs progression, not one-liners.",
            reason: "Threads give the account depth and create stronger profile visits.",
            exampleHook: `A short thread on ${baseTheme}, starting with the text and ending with the practical takeaway.`,
          },
        ]
      : [
          {
            name: "Operator notes",
            angle: "Show what actually works in the real world around the topic.",
            reason: "Specifics beat vague inspiration every time.",
            exampleHook: `Most people talk about ${baseTheme} at the headline level. The useful part is lower down.`,
          },
          {
            name: "Mistake correction",
            angle: "Point out one repeated bad assumption and replace it with a better model.",
            reason: "Correction posts trigger reposts because they feel like truth bombs.",
            exampleHook: `The biggest mistake people make with ${baseTheme} is starting in the wrong place.`,
          },
          {
            name: "Framework drop",
            angle: "Turn a messy topic into a short repeatable framework.",
            reason: "Frameworks are easy to save, send, and remember.",
            exampleHook: `A simple framework for thinking about ${baseTheme}:`,
          },
          {
            name: "Threaded breakdown",
            angle: "Use a thread when you need sequence, examples, and a closing CTA.",
            reason: "A good thread creates a profile view loop instead of a single impression.",
            exampleHook: `A no-BS thread on ${baseTheme}: what matters, what does not, and where to start.`,
          },
        ],
    schedule: Array.from({ length: cadence }, (_, index) => ({
      format: index === 1 || index === cadence - 1 ? "thread" : "single",
      pillar:
        index === 1 || index === cadence - 1
          ? "Short thread series"
          : index % 2 === 0
            ? "Ayah unpacked"
            : "Daily life bridge",
      objective,
      angle:
        index === 0
          ? `Open the account with a clear promise around ${baseTheme}.`
          : index === 1
            ? `Teach one layered idea from ${baseTheme} in a short thread.`
            : index === 2
              ? `Bridge ${baseTheme} to a practical daily action.`
              : index === 3
                ? `Correct a common misunderstanding around ${baseTheme}.`
                : `Close the week with a saveable summary that invites follow-through.`,
    })),
    drafts: isIslamicTopic(topic)
      ? [
          {
            format: "single",
            title: "Account positioning post",
            hook: `If you want to write about ${baseTheme} on X, start with the text before the hot takes.`,
            goal: "Set tone and attract the right first followers.",
            cta: "Invite people to follow for sourced reflections.",
            notes:
              "Keep it calm. No preaching tone. This is a trust-setting opener.",
            tweets: [
              `If you want to build an X account around ${baseTheme}, start with the text before the hot takes. People follow Islamic pages for trust, not volume. My lane here: short, sourced reflections people can read in under a minute and carry into the day.`,
            ],
          },
          {
            format: "thread",
            title: "Starter thread",
            hook: `A short thread on ${baseTheme}: what people usually skip, and why it matters.`,
            goal: "Teach depth fast and establish the account's editorial style.",
            cta: "Ask readers which topic should be unpacked next.",
            notes:
              "Use citations after generation if live search is unavailable. Keep each post under 260 chars.",
            tweets: [
              `A short thread on ${baseTheme}: what people usually skip, and why it matters.`,
              `Most weak Islamic content online starts with conclusions. Better order: text, context, takeaway. That is what makes something both shareable and trustworthy.`,
              `If a post about ${baseTheme} cannot point back to a real source, it should not be published yet. Reach is not worth confusion.`,
              `The practical test is simple: after reading it, does someone understand the passage better and know what to do with it today?`,
              `That is the standard for this account. If you want more of these, follow along and reply with the next theme to unpack.`,
            ],
          },
          {
            format: "single",
            title: "Daily life bridge",
            hook: `${baseTheme} is not only something to admire. It is something to practice.`,
            goal: "Create a saveable post with a concrete behavioral takeaway.",
            cta: "Invite readers to bookmark it for the week.",
            notes:
              "Anchor the post in one action. Avoid broad sermon language.",
            tweets: [
              `${baseTheme} is not only something to admire. It is something to practice. The strongest Islamic posts on X do one thing well: they move from the ayah to the habit. One line of truth, one line of action, then stop.`,
            ],
          },
          {
            format: "single",
            title: "Clarification post",
            hook: `A common mistake when people post about ${baseTheme}: they compress nuance until the meaning bends.`,
            goal: "Show intellectual seriousness without sounding combative.",
            cta: "Invite respectful discussion in replies.",
            notes:
              "No dunking. The value comes from clarity and calm correction.",
            tweets: [
              `A common mistake when people post about ${baseTheme}: they compress nuance until the meaning bends. Short content still needs honesty. Better to post one careful point with a source than five viral lines that blur the message.`,
            ],
          },
          {
            format: "thread",
            title: "Week-closing thread",
            hook: `If I were building a serious X page around ${baseTheme} from zero, this is the posting mix I'd use for week one.`,
            goal: "Turn the week's strategy into a saveable framework.",
            cta: "Ask readers whether they want part two.",
            notes: "This doubles as both strategy content and a profile trailer.",
            tweets: [
              `If I were building a serious X page around ${baseTheme} from zero, this is the posting mix I'd use for week one.`,
              `Post 1: a positioning post so people know the account is source-first.`,
              `Post 2: a short thread that teaches one layered idea clearly.`,
              `Post 3: a daily-life bridge that turns reflection into action.`,
              `Post 4: a calm clarification of a common oversimplification.`,
              `Repeat that rhythm and you get trust, saves, and profile visits without sounding manufactured.`,
            ],
          },
        ]
      : [
          {
            format: "single",
            title: "Positioning post",
            hook: `Most people post about ${baseTheme} like a topic. The better move is to post it like a system.`,
            goal: "Define the account's angle in one post.",
            cta: "Invite follows from people who want specifics.",
            notes: "Make the account promise explicit.",
            tweets: [
              `Most people post about ${baseTheme} like a topic. The better move is to post it like a system. Clear hooks. Real examples. No filler. That is how you build an account worth following instead of a timeline full of forgettable opinions.`,
            ],
          },
          {
            format: "thread",
            title: "No-BS thread",
            hook: `A no-BS thread on ${baseTheme}: what matters, what does not, and where to start.`,
            goal: "Win profile visits with a high-signal thread.",
            cta: "Invite replies with follow-up questions.",
            notes: "Keep the thread practical and specific.",
            tweets: [
              `A no-BS thread on ${baseTheme}: what matters, what does not, and where to start.`,
              `What matters: first-party material, repeated user pain, and language simple enough to repost.`,
              `What does not: vague inspiration, bloated threads, and sounding smart without saying anything concrete.`,
              `Where to start: one focused claim, one example, one action step. Then stop before the post gets soft.`,
              `That pattern compounds. Use it for a month and the account starts to feel distinct.`,
            ],
          },
          {
            format: "single",
            title: "Framework post",
            hook: `A simple way to think about ${baseTheme}: signal, system, story.`,
            goal: "Create a saveable framework post.",
            cta: "Prompt readers to save it.",
            notes: "Frameworks should be easy to remember.",
            tweets: [
              `A simple way to think about ${baseTheme}: signal, system, story. Signal shows what matters now. System shows how it works. Story shows why anyone should care. Most weak posts only do one of the three.`,
            ],
          },
          {
            format: "single",
            title: "Mistake post",
            hook: `The biggest mistake people make with ${baseTheme} is starting at the summary instead of the source.`,
            goal: "Sharpen the account's point of view.",
            cta: "Encourage quote tweets with other mistakes.",
            notes: "Strong stance, still useful.",
            tweets: [
              `The biggest mistake people make with ${baseTheme} is starting at the summary instead of the source. The shortcut saves time once, then costs clarity for months. Go lower in the stack and your content instantly gets harder to ignore.`,
            ],
          },
          {
            format: "thread",
            title: "Week one playbook",
            hook: `If I had to grow an X account around ${baseTheme} in the next 7 days, I would post this sequence.`,
            goal: "Turn the strategy into a concrete posting blueprint.",
            cta: "Ask whether readers want the template version.",
            notes: "Useful for both creators and operators.",
            tweets: [
              `If I had to grow an X account around ${baseTheme} in the next 7 days, I would post this sequence.`,
              `Day 1: positioning post so people understand the lane immediately.`,
              `Day 2: thread with real specifics, not five versions of the same sentence.`,
              `Day 3: saveable framework. Day 4: mistake correction. Day 5: another thread with one clean takeaway.`,
              `That mix is enough to learn what resonates without turning the account into a content farm.`,
            ],
          },
        ],
    notes: [
      "Fallback mode uses product heuristics, not live web research.",
      "For sensitive topics, a human should still verify specific claims before publishing.",
    ],
  };
}

function buildDefaultSlots(timezone: string, cadence: number): ScheduleSlot[] {
  const now = new Date();

  return Array.from({ length: cadence }, (_, index) => {
    const slotDate = new Date(now);
    slotDate.setUTCDate(now.getUTCDate() + index + 1);

    return {
      dayLabel: formatDayLabel(slotDate, timezone),
      date: formatDateParts(slotDate, timezone),
      time: DEFAULT_TIMES[index % DEFAULT_TIMES.length],
      timezone,
      format: index === 1 || index === cadence - 1 ? "thread" : "single",
      pillar: index === 1 || index === cadence - 1 ? "Short thread series" : "Operator notes",
      objective: "Build trust and profile visits.",
      angle: "Publish one focused insight.",
    };
  });
}

function normalizeSources(
  payload: RawStrategyPayload,
  mode: "live" | "fallback"
): ResearchSource[] {
  const fromPayload =
    (payload.sources ?? []).reduce<ResearchSource[]>((acc, source) => {
      const title = source.title?.trim();
      const publisher = source.publisher?.trim();
      const reason = source.reason?.trim();
      if (title && publisher && reason) {
        acc.push({ title, publisher, reason, url: source.url?.trim() });
      }
      return acc;
    }, []);

  if (fromPayload.length > 0) return fromPayload.slice(0, 6);

  return mode === "fallback" ? (buildScheduleSeed("", "", "", 0).sources ?? []) as ResearchSource[] : [];
}

export function hydrateStrategy(
  payload: RawStrategyPayload,
  request: StrategyRequest,
  mode: "live" | "fallback",
  model: string
): StrategyResult {
  const topic = cleanText(request.topic, "Untitled topic");
  const audience = deriveAudience(topic, payload.audience ?? request.audience);
  const objective = deriveObjective(topic, payload.objective ?? request.objective);
  const cadence = clampCadence(request.cadence);
  const timezone = cleanText(request.timezone, DEFAULT_TIMEZONE);
  const fallbackSeed = buildScheduleSeed(topic, audience, objective, cadence);

  const scheduleTemplate =
    payload.schedule && payload.schedule.length > 0
      ? payload.schedule
      : fallbackSeed.schedule ?? [];

  const defaultSlots = buildDefaultSlots(timezone, Math.max(cadence, scheduleTemplate.length));

  const schedule = defaultSlots.map((slot, index) => {
    const raw = scheduleTemplate[index];

    return {
      ...slot,
      dayLabel: cleanText(raw?.dayLabel, slot.dayLabel),
      time: cleanText(raw?.time, slot.time),
      format: raw?.format === "thread" ? "thread" : "single",
      pillar: cleanText(raw?.pillar, fallbackSeed.pillars?.[index % fallbackSeed.pillars.length]?.name ?? slot.pillar),
      objective: cleanText(raw?.objective, objective),
      angle: cleanText(raw?.angle, fallbackSeed.schedule?.[index % fallbackSeed.schedule.length]?.angle ?? slot.angle),
    } satisfies ScheduleSlot;
  });

  const normalizedPillars =
    payload.pillars
      ?.map((pillar, index) => {
        const fallback =
          fallbackSeed.pillars?.[index % (fallbackSeed.pillars?.length || 1)];

        return {
          name: cleanText(pillar.name, fallback?.name ?? `Pillar ${index + 1}`),
          angle: cleanText(pillar.angle, fallback?.angle ?? "Teach one useful angle."),
          reason: cleanText(
            pillar.reason,
            fallback?.reason ?? "Useful angles are easier to save and share."
          ),
          exampleHook: cleanText(
            pillar.exampleHook,
            fallback?.exampleHook ?? `A better way to think about ${topic}:`
          ),
        } satisfies ContentPillar;
      })
      .filter((pillar) => pillar.name.length > 0) ?? [];

  const pillars =
    normalizedPillars.length > 0
      ? normalizedPillars.slice(0, 6)
      : (fallbackSeed.pillars ?? []);

  const draftTemplate =
    payload.drafts && payload.drafts.length > 0
      ? payload.drafts
      : fallbackSeed.drafts ?? [];

  const drafts = schedule.map((slot, index) => {
    const raw = draftTemplate[index % draftTemplate.length];
    const fallback =
      fallbackSeed.drafts?.[index % (fallbackSeed.drafts?.length || 1)];

    return {
      id: `draft-${index + 1}`,
      format:
        raw?.format === "thread" || slot.format === "thread" ? "thread" : "single",
      title: cleanText(raw?.title, fallback?.title ?? `Draft ${index + 1}`),
      hook: cleanText(raw?.hook, fallback?.hook ?? `A better angle on ${topic}`),
      goal: cleanText(
        raw?.goal,
        fallback?.goal ?? "Earn saves, replies, and profile visits."
      ),
      cta: cleanText(
        raw?.cta,
        fallback?.cta ?? "Invite replies and profile follows."
      ),
      notes: cleanText(
        raw?.notes,
        fallback?.notes ?? "Tighten wording before publishing."
      ),
      tweets: cleanTweets(
        raw?.tweets,
        fallback?.tweets ?? [`One strong post about ${topic}.`]
      ),
      scheduled: slot,
    } satisfies DraftPost;
  });

  return {
    topic,
    audience,
    objective,
    positioning: cleanText(
      payload.positioning,
      fallbackSeed.positioning ?? `Focused X strategy for ${topic}.`
    ),
    voice: cleanText(
      payload.voice,
      fallbackSeed.voice ?? "Clear, specific, and useful."
    ),
    summary: cleanText(
      payload.summary,
      fallbackSeed.summary ?? `A compact X plan for ${topic}.`
    ),
    generatedAt: new Date().toISOString(),
    mode,
    model,
    sources:
      normalizeSources(
        {
          ...fallbackSeed,
          ...payload,
          sources:
            payload.sources && payload.sources.length > 0
              ? payload.sources
              : fallbackSeed.sources,
        },
        mode
      ) ?? [],
    pillars,
    schedule,
    drafts,
    notes:
      payload.notes?.filter((note): note is string => Boolean(note?.trim())) ??
      fallbackSeed.notes ??
      [],
  };
}

export function buildFallbackStrategy(
  request: StrategyRequest,
  reason?: string
): StrategyResult {
  const cadence = clampCadence(request.cadence);
  const topic = cleanText(request.topic, "Untitled topic");
  const audience = deriveAudience(topic, request.audience);
  const objective = deriveObjective(topic, request.objective);
  const seed = buildScheduleSeed(topic, audience, objective, cadence);
  const strategy = hydrateStrategy(seed, request, "fallback", "fallback-planner");

  if (reason) {
    strategy.notes = [reason, ...strategy.notes];
  }

  return strategy;
}

export function parseJsonResponse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    const match = value.match(/\{[\s\S]*\}$/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

export function buildThreadText(draft: DraftPost): string {
  return draft.tweets
    .map((tweet, index) => `${index + 1}. ${tweet}`)
    .join("\n\n");
}

export function buildSchedulerRows(strategy: StrategyResult): SchedulerRow[] {
  return strategy.drafts.map((draft) => ({
    publishDate: draft.scheduled.date,
    publishTime: draft.scheduled.time,
    timezone: draft.scheduled.timezone,
    platform: "x",
    format: draft.format,
    title: draft.title,
    postText: draft.tweets[0] ?? "",
    threadText: draft.format === "thread" ? buildThreadText(draft) : "",
    reviewStatus: "Needs review",
  }));
}

function escapeCsvCell(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function buildSchedulerCsv(strategy: StrategyResult): string {
  const header = [
    "publish_date",
    "publish_time",
    "timezone",
    "platform",
    "format",
    "title",
    "post_text",
    "thread_text",
    "review_status",
  ];

  const rows = buildSchedulerRows(strategy).map((row) =>
    [
      row.publishDate,
      row.publishTime,
      row.timezone,
      row.platform,
      row.format,
      row.title,
      row.postText,
      row.threadText,
      row.reviewStatus,
    ]
      .map(escapeCsvCell)
      .join(",")
  );

  return [header.join(","), ...rows].join("\n");
}

export function buildStrategyFilename(topic: string, extension: "csv" | "json") {
  const slug = topic
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return `${slug || "x-strategy"}-${Date.now()}.${extension}`;
}

export function extractSourcesFromOpenAIResponse(value: unknown): ResearchSource[] {
  const queue: unknown[] = [value];
  const seen = new Set<string>();
  const sources: ResearchSource[] = [];

  while (queue.length > 0) {
    const item = queue.shift();

    if (!item || typeof item !== "object") continue;

    if (Array.isArray(item)) {
      queue.push(...item);
      continue;
    }

    const record = item as Record<string, unknown>;
    const url = typeof record.url === "string" ? record.url : undefined;
    const title = typeof record.title === "string" ? record.title : undefined;
    const publisher =
      typeof record.publisher === "string"
        ? record.publisher
        : typeof record.domain === "string"
          ? record.domain
          : undefined;

    if (url && title && !seen.has(url)) {
      seen.add(url);
      sources.push({
        title,
        url,
        publisher: publisher ?? new URL(url).hostname.replace(/^www\./, ""),
        reason: "Web result used during automated research.",
      });
    }

    queue.push(...Object.values(record));
  }

  return sources.slice(0, 6);
}

export type { RawStrategyPayload };
