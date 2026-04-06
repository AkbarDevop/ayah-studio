import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  buildFallbackStrategy,
  extractSourcesFromOpenAIResponse,
  hydrateStrategy,
  parseJsonResponse,
  type RawStrategyPayload,
  type StrategyRequest,
} from "@/lib/x-studio";

const OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";
const OPENAI_MODEL =
  process.env.OPENAI_SOCIAL_MODEL ||
  process.env.OPENAI_MODEL ||
  "gpt-5.4-mini";

const STRATEGY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "audience",
    "objective",
    "positioning",
    "voice",
    "summary",
    "sources",
    "pillars",
    "schedule",
    "drafts",
    "notes",
  ],
  properties: {
    audience: { type: "string" },
    objective: { type: "string" },
    positioning: { type: "string" },
    voice: { type: "string" },
    summary: { type: "string" },
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "publisher", "reason"],
        properties: {
          title: { type: "string" },
          publisher: { type: "string" },
          url: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
    pillars: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "angle", "reason", "exampleHook"],
        properties: {
          name: { type: "string" },
          angle: { type: "string" },
          reason: { type: "string" },
          exampleHook: { type: "string" },
        },
      },
    },
    schedule: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["dayLabel", "time", "format", "pillar", "objective", "angle"],
        properties: {
          dayLabel: { type: "string" },
          time: { type: "string" },
          format: { type: "string", enum: ["single", "thread"] },
          pillar: { type: "string" },
          objective: { type: "string" },
          angle: { type: "string" },
        },
      },
    },
    drafts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["format", "title", "hook", "goal", "cta", "notes", "tweets"],
        properties: {
          format: { type: "string", enum: ["single", "thread"] },
          title: { type: "string" },
          hook: { type: "string" },
          goal: { type: "string" },
          cta: { type: "string" },
          notes: { type: "string" },
          tweets: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
    notes: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function buildDeveloperPrompt(request: StrategyRequest) {
  return [
    "You are an X content strategist and editorial operator.",
    "The user gives you only a topic. You must research the sources yourself.",
    "Use web search before drafting anything.",
    "Output only the requested JSON structure.",
    "Generate a one-week X plan with single posts and short threads.",
    "Keep each single post under 260 characters.",
    "Keep each thread segment under 260 characters.",
    "Prefer strong hooks, concrete takeaways, and clean CTA language.",
    "Do not use hashtags unless they are truly necessary.",
    "If the topic is religious, legal, financial, or medical, prefer primary or high-trust sources and add a note wherever human review is still needed.",
    `Timezone for scheduling: ${request.timezone || "America/Chicago"}.`,
  ].join(" ");
}

function buildUserPrompt(request: StrategyRequest) {
  const cadence = request.cadence ?? 5;

  return [
    `Topic: ${request.topic.trim()}`,
    `Audience hint: ${request.audience?.trim() || "Infer the best initial audience from the topic."}`,
    `Goal hint: ${request.objective?.trim() || "Grow a trustworthy X account with posts worth saving and sharing."}`,
    `Cadence: ${cadence} posts over the next week.`,
    "Return:",
    "1. Positioning for the account.",
    "2. 4 content pillars.",
    "3. 4-6 web sources worth trusting.",
    "4. A schedule for the next week.",
    "5. Ready-to-post copy for each slot.",
    "The drafts should feel human, specific, and publishable.",
  ].join("\n");
}

function parseRequestBody(body: unknown): StrategyRequest | null {
  if (!isObject(body)) return null;

  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  if (!topic) return null;

  return {
    topic,
    audience: typeof body.audience === "string" ? body.audience : undefined,
    objective: typeof body.objective === "string" ? body.objective : undefined,
    timezone: typeof body.timezone === "string" ? body.timezone : undefined,
    cadence: typeof body.cadence === "number" ? body.cadence : undefined,
  };
}

async function fetchOpenAIStrategy(request: StrategyRequest) {
  const response = await fetch(OPENAI_RESPONSES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      reasoning: { effort: "low" },
      tools: [
        {
          type: "web_search",
          user_location: {
            type: "approximate",
            country: "US",
          },
        },
      ],
      tool_choice: "auto",
      include: ["web_search_call.action.sources"],
      text: {
        format: {
          type: "json_schema",
          name: "x_strategy_plan",
          strict: true,
          schema: STRATEGY_SCHEMA,
        },
      },
      input: [
        {
          role: "developer",
          content: [{ type: "input_text", text: buildDeveloperPrompt(request) }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: buildUserPrompt(request) }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenAI request failed (${response.status}): ${errorText.slice(0, 300)}`
    );
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const outputText =
    typeof payload.output_text === "string" ? payload.output_text : "";

  const parsed = parseJsonResponse<RawStrategyPayload>(outputText);
  if (!parsed) {
    throw new Error("OpenAI returned an unreadable strategy payload.");
  }

  const extractedSources = extractSourcesFromOpenAIResponse(payload);
  const strategy = hydrateStrategy(
    {
      ...parsed,
      sources:
        extractedSources.length > 0
          ? extractedSources
          : parsed.sources,
    },
    request,
    "live",
    OPENAI_MODEL
  );

  return strategy;
}

async function generateStrategy(request: StrategyRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return buildFallbackStrategy(
      request,
      "OPENAI_API_KEY is not configured, so this run used the fallback planner."
    );
  }

  try {
    return await fetchOpenAIStrategy(request);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Live research failed, so the fallback planner was used.";

    return buildFallbackStrategy(request, message);
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const input = parseRequestBody(body);

  if (!input) {
    return NextResponse.json(
      { error: "A topic is required to generate a strategy." },
      { status: 400 }
    );
  }

  const strategy = await generateStrategy(input);
  return NextResponse.json(strategy);
}
