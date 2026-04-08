import { randomUUID } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { ReadStream } from "node:tty";
import OpenAI from "openai";

import {
  createCmpFiveAgentRuntime,
  createCmpRoleLiveLlmModelExecutor,
} from "./cmp-five-agent/index.js";
import {
  executeModelInference,
  type ModelInferenceExecutionParams,
  type ModelInferenceExecutionResult,
} from "./integrations/model-inference.js";
import type { TapAgentModelRoute } from "./integrations/tap-agent-model.js";
import {
  registerTapCapabilityFamilyAssembly,
} from "./integrations/tap-capability-family-assembly.js";
import {
  createGoalSource,
} from "./goal/index.js";
import {
  createInvocationPlanFromCapabilityIntent,
} from "./capability-invocation/index.js";
import {
  createAgentCapabilityProfile,
  createAgentCoreRuntime,
} from "./index.js";
import {
  createAgentLineage,
  createCmpBranchFamily,
} from "./cmp-types/index.js";
import { rax } from "../rax/index.js";
import { loadLiveProviderConfig, loadOpenAILiveConfig } from "../rax/live-config.js";

type DialogueRole = "user" | "assistant";

interface DialogueTurn {
  role: DialogueRole;
  text: string;
}

interface CliOptions {
  once?: string;
  historyTurns: number;
  uiMode: "full" | "direct";
}

interface CmpTurnArtifacts {
  agentId: string;
  packageId: string;
  packageRef: string;
  projectionId: string;
  snapshotId: string;
  summary: ReturnType<ReturnType<typeof createAgentCoreRuntime>["getCmpFiveAgentRuntimeSummary"]>;
  intent: string;
  operatorGuide: string;
  childGuide: string;
  checkerReason: string;
  routeRationale: string;
  scopePolicy: string;
  packageStrategy: string;
  timelineStrategy: string;
}

interface CoreTurnArtifacts {
  runId: string;
  answer: string;
  dispatchStatus: string;
  capabilityKey?: string;
  capabilityResultStatus?: string;
  eventTypes: string[];
  plannerRawAnswer?: string;
  toolExecution?: {
    capabilityKey: string;
    status: string;
    output?: unknown;
    error?: unknown;
  };
}

interface ParsedTapRequest {
  capabilityKey: string;
  input: Record<string, unknown>;
  rawCommand?: string;
}

interface TurnArtifacts {
  cmp: CmpTurnArtifacts;
  core: CoreTurnArtifacts;
}

interface LiveCliState {
  runtime: ReturnType<typeof createAgentCoreRuntime>;
  sessionId: string;
  transcript: DialogueTurn[];
  turnIndex: number;
  uiMode: "full" | "direct";
  logger: LiveChatLogger;
  latestCmp?: CmpTurnArtifacts;
  pendingCmpSync?: Promise<void>;
  lastTurn?: TurnArtifacts;
}

type LiveChatLogEvent =
  | "session_start"
  | "session_end"
  | "turn_start"
  | "turn_result"
  | "stage_start"
  | "stage_end"
  | "stream_start"
  | "stream_end"
  | "stream_text";

type AgentReasoningEffort = "low" | "medium" | "high" | "none";
let CURRENT_UI_MODE: "full" | "direct" = "full";

interface AgentRoutePlan {
  model: string;
  reasoning: AgentReasoningEffort;
  maxOutputTokens?: number;
}

const LIVE_CHAT_TAP_OVERRIDE = {
  requestedMode: "bapr",
  automationDepth: "prefer_auto",
  explanationStyle: "plain_language",
} as const;

class LiveChatLogger {
  readonly path: string;
  #pending: Promise<void> = Promise.resolve();

  constructor(path: string) {
    this.path = path;
  }

  async log(event: LiveChatLogEvent, payload: Record<string, unknown>): Promise<void> {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      event,
      ...payload,
    });
    this.#pending = this.#pending.then(() => appendFile(this.path, `${line}\n`, "utf8"));
    await this.#pending;
  }

  async flush(): Promise<void> {
    await this.#pending;
  }
}

interface CoreCapabilityRequest {
  capabilityKey: string;
  reason: string;
  input: Record<string, unknown>;
  requestedTier?: "B0" | "B1" | "B2" | "B3";
  timeoutMs?: number;
}

interface CoreActionEnvelope {
  action: "reply" | "capability_call";
  responseText: string;
  capabilityRequest?: CoreCapabilityRequest;
}

const LIVE_CHAT_MODEL_PLAN = {
  core: {
    model: "gpt-5.4",
    reasoning: "high",
  },
  tap: {
    reviewer: {
      model: "gpt-5.4",
      reasoning: "low",
      maxOutputTokens: 1120000,
    },
    toolReviewer: {
      model: "gpt-5.4-mini",
      reasoning: "medium",
      maxOutputTokens: 1120000,
    },
    provisioner: {
      model: "gpt-5.4",
      reasoning: "low",
      maxOutputTokens: 1120000,
    },
  },
  cmp: {
    icma: {
      model: "gpt-5.4-mini",
      reasoning: "none",
      maxOutputTokens: 1280000,
    },
    iterator: {
      model: "gpt-5.4-mini",
      reasoning: "low",
      maxOutputTokens: 960000,
    },
    checker: {
      model: "gpt-5.4-mini",
      reasoning: "medium",
      maxOutputTokens: 1120000,
    },
    dbagent: {
      model: "gpt-5.4",
      reasoning: "medium",
      maxOutputTokens: 1120000,
    },
    dispatcher: {
      model: "gpt-5.4",
      reasoning: "low",
      maxOutputTokens: 480000,
    },
  },
} as const satisfies {
  core: AgentRoutePlan;
  tap: Record<"reviewer" | "toolReviewer" | "provisioner", AgentRoutePlan>;
  cmp: Record<"icma" | "iterator" | "checker" | "dbagent" | "dispatcher", AgentRoutePlan>;
};

function readArgValue(argv: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = argv.find((entry) => entry.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }

  const index = argv.findIndex((entry) => entry === `--${name}`);
  if (index >= 0) {
    return argv[index + 1];
  }

  return undefined;
}

function parseCliOptions(argv: string[]): CliOptions {
  const once = readArgValue(argv, "once");
  const historyTurnsRaw = readArgValue(argv, "history-turns");
  const uiModeRaw = readArgValue(argv, "ui") ?? (argv.includes("--direct") ? "direct" : "full");
  const historyTurns = Number.parseInt(historyTurnsRaw ?? "6", 10);

  return {
    once: once?.trim() || undefined,
    historyTurns: Number.isFinite(historyTurns) && historyTurns > 0 ? historyTurns : 6,
    uiMode: uiModeRaw === "direct" ? "direct" : "full",
  };
}

function truncate(value: string, max = 240): string {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, max - 1)}…`;
}

function excerptText(
  value: string,
  max = 4_000,
): {
  text: string;
  truncated: boolean;
  originalChars: number;
} {
  const originalChars = value.length;
  if (originalChars <= max) {
    return {
      text: value,
      truncated: false,
      originalChars,
    };
  }
  const head = Math.max(1, Math.floor(max * 0.7));
  const tail = Math.max(1, max - head - 64);
  return {
    text: [
      value.slice(0, head),
      "",
      `...[truncated ${originalChars - head - tail} chars]...`,
      "",
      value.slice(Math.max(head, originalChars - tail)),
    ].join("\n"),
    truncated: true,
    originalChars,
  };
}

function trimStructuredValue(value: unknown, budget = 8_000): unknown {
  if (typeof value === "string") {
    const excerpt = excerptText(value, Math.min(4_000, budget));
    return excerpt.truncated
      ? {
          text: excerpt.text,
          truncated: true,
          originalChars: excerpt.originalChars,
        }
      : excerpt.text;
  }

  if (typeof value === "number" || typeof value === "boolean" || value == null) {
    return value;
  }

  if (Array.isArray(value)) {
    const limit = Math.min(8, Math.max(1, Math.floor(budget / 800)));
    const items = value.slice(0, limit).map((entry) => trimStructuredValue(entry, Math.max(600, Math.floor(budget / Math.max(1, limit)))));
    if (value.length > limit) {
      items.push({
        truncated: true,
        omittedItems: value.length - limit,
      });
    }
    return items;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const limit = Math.min(16, Math.max(1, Math.floor(budget / 500)));
    const trimmed: Record<string, unknown> = {};
    for (const [key, entry] of entries.slice(0, limit)) {
      trimmed[key] = trimStructuredValue(entry, Math.max(400, Math.floor(budget / Math.max(1, limit))));
    }
    if (entries.length > limit) {
      trimmed.__truncated = true;
      trimmed.__omittedKeys = entries.length - limit;
    }
    return trimmed;
  }

  return String(value);
}

function summarizeToolOutputForCore(
  capabilityKey: string,
  output: unknown,
): string {
  const normalized = output && typeof output === "object"
    ? output as Record<string, unknown>
    : undefined;

  if (capabilityKey === "shell.restricted" || capabilityKey === "test.run") {
    const stdout = typeof normalized?.stdout === "string" ? normalized.stdout : "";
    const stderr = typeof normalized?.stderr === "string" ? normalized.stderr : "";
    const stdoutExcerpt = excerptText(stdout, 6_000);
    const stderrExcerpt = excerptText(stderr, 2_000);
    return JSON.stringify({
      capabilityKey,
      cwd: typeof normalized?.cwd === "string" ? normalized.cwd : undefined,
      exitCode: normalized?.exitCode,
      stdoutChars: stdout.length,
      stderrChars: stderr.length,
      stdoutExcerpt: stdoutExcerpt.text,
      stdoutTruncated: stdoutExcerpt.truncated,
      stderrExcerpt: stderrExcerpt.text,
      stderrTruncated: stderrExcerpt.truncated,
    }, null, 2);
  }

  if (capabilityKey === "search.ground") {
    const sources = Array.isArray(normalized?.sources)
      ? normalized.sources.slice(0, 6)
      : [];
    const citations = Array.isArray(normalized?.citations)
      ? normalized.citations.slice(0, 8)
      : [];
    return JSON.stringify({
      capabilityKey,
      status: normalized?.status,
      answer: typeof normalized?.answer === "string"
        ? excerptText(normalized.answer, 5_000).text
        : undefined,
      sourceCount: Array.isArray(normalized?.sources) ? normalized.sources.length : 0,
      citationCount: Array.isArray(normalized?.citations) ? normalized.citations.length : 0,
      sources: trimStructuredValue(sources, 3_500),
      citations: trimStructuredValue(citations, 2_500),
      evidence: trimStructuredValue(normalized?.evidence, 3_500),
    }, null, 2);
  }

  return JSON.stringify({
    capabilityKey,
    output: trimStructuredValue(output, 8_000),
  }, null, 2);
}

function resolveCliSearchGroundDefaults(): {
  provider: "anthropic" | "deepmind" | "openai";
  model: string;
  layer: "api";
} {
  const configs = loadLiveProviderConfig();
  const deepmindModel = configs.deepmind.model;
  if (deepmindModel) {
    return {
      provider: "deepmind",
      model: deepmindModel === "gemini-3-flash"
        ? "gemini-2.5-flash"
        : deepmindModel,
      layer: "api",
    };
  }

  const anthropicModel = configs.anthropic.model;
  if (anthropicModel) {
    return {
      provider: "anthropic",
      model: anthropicModel
        .replace("claude-opus-4.6-thinking", "claude-opus-4-6-thinking")
        .replace("claude-sonnet-4.6", "claude-sonnet-4-6"),
      layer: "api",
    };
  }

  return {
    provider: "openai",
    model: configs.openai.model,
    layer: "api",
  };
}

function resolveCliDefaultCarrierRoute(
  config: ReturnType<typeof loadOpenAILiveConfig>,
): {
  provider: "openai";
  model: string;
  layer: "api";
} {
  return {
    provider: "openai",
    model: config.model,
    layer: "api",
  };
}

async function resolveDefaultMcpConnectionId(input: {
  provider: "openai";
  model: string;
  layer: "api";
}): Promise<string | undefined> {
  const connections = rax.mcp.listConnections({
    provider: input.provider,
    model: input.model,
    layer: input.layer,
    input: {},
  });
  if (connections.length === 1) {
    return connections[0]?.connectionId;
  }
  return undefined;
}

async function applyCliDefaultsToCapabilityRequest(
  request: CoreCapabilityRequest,
  config: ReturnType<typeof loadOpenAILiveConfig>,
  userMessage: string,
): Promise<CoreCapabilityRequest> {
  if (request.capabilityKey !== "search.ground") {
    const routeDefaults = resolveCliDefaultCarrierRoute(config);
    if (
      request.capabilityKey === "skill.use"
      || request.capabilityKey === "skill.mount"
      || request.capabilityKey === "skill.prepare"
    ) {
      return {
        ...request,
        input: {
          provider: routeDefaults.provider,
          model: routeDefaults.model,
          layer: routeDefaults.layer,
          ...request.input,
        },
      };
    }

    if (
      request.capabilityKey === "mcp.listTools"
      || request.capabilityKey === "mcp.readResource"
      || request.capabilityKey === "mcp.call"
      || request.capabilityKey === "mcp.native.execute"
    ) {
      const route = typeof request.input.route === "object" && request.input.route
        ? request.input.route as Record<string, unknown>
        : {};
      const normalizedInput = typeof request.input.input === "object" && request.input.input
        ? request.input.input as Record<string, unknown>
        : {};
      const mergedRoute = {
        provider: routeDefaults.provider,
        model: routeDefaults.model,
        layer: routeDefaults.layer,
        ...route,
      };
      const maybeConnectionId = typeof normalizedInput.connectionId === "string" && normalizedInput.connectionId.trim()
        ? normalizedInput.connectionId
        : await resolveDefaultMcpConnectionId(routeDefaults);
      return {
        ...request,
        input: {
          ...request.input,
          route: mergedRoute,
          input: maybeConnectionId
            ? {
                connectionId: maybeConnectionId,
                ...normalizedInput,
              }
            : normalizedInput,
        },
      };
    }

    return request;
  }

  const query = readString(request.input.query)
    ?? readString(request.input.question)
    ?? readString(request.input.prompt)
    ?? userMessage;
  const fallbackRoute = resolveCliSearchGroundDefaults();

  return {
    ...request,
    requestedTier: request.requestedTier ?? "B1",
    timeoutMs: request.timeoutMs ?? 60_000,
    input: {
      provider: fallbackRoute.provider,
      model: fallbackRoute.model,
      layer: fallbackRoute.layer,
      citations: "required",
      freshness: "day",
      searchContextSize: "medium",
      maxSources: 6,
      maxOutputTokens: 12_000,
      ...request.input,
      query,
    },
  };
}

function formatTranscript(turns: DialogueTurn[]): string {
  if (turns.length === 0) {
    return "(none)";
  }
  return turns
    .map((turn, index) => `${index + 1}. ${turn.role === "user" ? "User" : "Assistant"}: ${truncate(turn.text, 280)}`)
    .join("\n");
}

function formatLiveStatus(status: CmpTurnArtifacts["summary"]["live"][keyof CmpTurnArtifacts["summary"]["live"]]): string {
  return `${status.status}/${status.mode}${status.fallbackApplied ? " (fallback)" : ""}`;
}

function formatDisplayValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

function extractTextFromResponseLike(raw: unknown): string {
  if (!raw || typeof raw !== "object") {
    return "";
  }
  const root = raw as Record<string, unknown>;
  const outputText = typeof root.output_text === "string" ? root.output_text : "";
  if (outputText.trim()) {
    return outputText;
  }

  const output = Array.isArray(root.output) ? root.output : [];
  const textParts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const itemRecord = item as Record<string, unknown>;
    if (itemRecord.type === "message") {
      const content = Array.isArray(itemRecord.content) ? itemRecord.content : [];
      for (const block of content) {
        if (!block || typeof block !== "object") {
          continue;
        }
        const blockRecord = block as Record<string, unknown>;
        const text = typeof blockRecord.text === "string" ? blockRecord.text : "";
        if (text.trim()) {
          textParts.push(text);
        }
      }
    }
  }
  return textParts.join("\n").trim();
}

function printDivider(label?: string): void {
  const prefix = "\n============================================================";
  if (!label) {
    console.log(prefix);
    return;
  }
  console.log(`${prefix}\n${label}\n============================================================`);
}

function padRight(value: string, width: number): string {
  return value.length >= width ? value.slice(0, width) : value.padEnd(width, " ");
}

function printDirectBox(title: string, lines: string[]): void {
  const maxWidth = Math.min(process.stdout.columns ?? 72, 88);
  const innerWidth = Math.max(
    38,
    Math.min(
      maxWidth - 2,
      Math.max(title.length, ...lines.map((line) => line.length), 38) + 2,
    ),
  );
  console.log(`╭${"─".repeat(innerWidth)}╮`);
  console.log(`│ ${padRight(title, innerWidth - 1)}│`);
  if (lines.length > 0) {
    console.log(`│ ${padRight("", innerWidth - 1)}│`);
  }
  for (const line of lines) {
    console.log(`│ ${padRight(line, innerWidth - 1)}│`);
  }
  console.log(`╰${"─".repeat(innerWidth)}╯`);
}

function printDirectBullet(text: string): void {
  console.log(`• ${text}`);
}

function printDirectSub(text: string): void {
  console.log(`  ↳ ${text}`);
}

function wrapComposerLine(line: string, width: number): string[] {
  if (!line) {
    return [""];
  }
  const chunks: string[] = [];
  let remaining = line;
  while (remaining.length > width) {
    chunks.push(remaining.slice(0, width));
    remaining = remaining.slice(width);
  }
  chunks.push(remaining);
  return chunks;
}

function buildComposerFrame(buffer: string): string[] {
  const maxWidth = Math.min(process.stdout.columns ?? 72, 88);
  const innerWidth = Math.max(38, Math.min(maxWidth - 2, 72));
  const bodyWidth = innerWidth - 3;
  const rawLines = buffer.split("\n");
  const wrapped = rawLines.flatMap((line) => wrapComposerLine(line, bodyWidth));
  const visible = wrapped.length > 0 ? wrapped.slice(-4) : [""];
  const lastIndex = visible.length - 1;
  visible[lastIndex] = `${visible[lastIndex]}▌`;
  const paddedBody = visible.map((line) => `│ ${padRight(line, innerWidth - 1)}│`);
  while (paddedBody.length < 4) {
    paddedBody.push(`│ ${padRight("", innerWidth - 1)}│`);
  }

  return [
    `╭${"─".repeat(innerWidth)}╮`,
    `│ ${padRight("Compose", innerWidth - 1)}│`,
    ...paddedBody,
    `╰${"─".repeat(innerWidth)}╯`,
    `  Enter send · Ctrl+J newline · /exit quit`,
  ];
}

async function promptDirectInputBox(): Promise<string | null> {
  if (!input.isTTY || !output.isTTY) {
    const readline = createInterface({
      input,
      output,
      terminal: true,
    });
    try {
      return await readline.question("\nYou> ");
    } finally {
      readline.close();
    }
  }

  const ttyInput = input as ReadStream;
  const originalRawMode = ttyInput.isRaw;
  let buffer = "";
  let renderedLines = 0;

  const render = () => {
    const frame = buildComposerFrame(buffer);
    if (renderedLines > 0) {
      output.write(`\x1b[${renderedLines}F`);
      for (let index = 0; index < renderedLines; index += 1) {
        output.write("\x1b[2K");
        if (index < renderedLines - 1) {
          output.write("\x1b[1E");
        }
      }
      output.write(`\x1b[${renderedLines}F`);
    }
    output.write(`\n${frame.join("\n")}\n`);
    renderedLines = frame.length + 1;
  };

  const clear = () => {
    if (renderedLines === 0) {
      return;
    }
    output.write(`\x1b[${renderedLines}F`);
    for (let index = 0; index < renderedLines; index += 1) {
      output.write("\x1b[2K");
      if (index < renderedLines - 1) {
        output.write("\x1b[1E");
      }
    }
    output.write(`\x1b[${renderedLines}F`);
    renderedLines = 0;
  };

  render();

  return await new Promise<string | null>((resolvePrompt) => {
    const onData = (chunk: Buffer | string) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");

      if (text === "\u0003") {
        cleanup();
        resolvePrompt(null);
        return;
      }
      if (text === "\r") {
        const submitted = buffer;
        cleanup();
        resolvePrompt(submitted);
        return;
      }
      if (text === "\n") {
        buffer += "\n";
        render();
        return;
      }
      if (text === "\u007f" || text === "\b") {
        buffer = buffer.slice(0, -1);
        render();
        return;
      }
      if (text === "\u001b") {
        return;
      }

      buffer += text;
      render();
    };

    const cleanup = () => {
      ttyInput.off("data", onData);
      if (!originalRawMode) {
        ttyInput.setRawMode(false);
      }
      clear();
    };

    ttyInput.setRawMode(true);
    ttyInput.resume();
    ttyInput.on("data", onData);
  });
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

async function withStopwatch<T>(
  label: string,
  work: () => Promise<T>,
  options: { quiet?: boolean } = {},
): Promise<T> {
  const startedAt = Date.now();
  if (!options.quiet) {
    console.log(`${label} start ${formatNowStamp()}`);
  }

  try {
    return await work();
  } finally {
    if (!options.quiet) {
      console.log(`${label} done in ${formatElapsed(Date.now() - startedAt)}`);
    }
  }
}

function formatRoutePlan(name: string, plan: AgentRoutePlan): string {
  return `${name}: ${plan.model} / ${plan.reasoning}${plan.maxOutputTokens ? ` / maxOut=${plan.maxOutputTokens}` : ""}`;
}

function extractFirstJsonObject(source: string): string {
  const fenced = source.match(/```json\s*([\s\S]*?)```/iu) ?? source.match(/```\s*([\s\S]*?)```/iu);
  if (fenced?.[1]) {
    return extractFirstJsonObject(fenced[1]);
  }
  const start = source.indexOf("{");
  if (start === -1) {
    throw new Error("Core action envelope did not contain a JSON object.");
  }
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") {
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  throw new Error("Core action envelope JSON was unterminated.");
}

function parseCoreActionEnvelope(text: string): CoreActionEnvelope {
  const parsed = JSON.parse(extractFirstJsonObject(text)) as Record<string, unknown>;
  const action = parsed.action;
  const responseText = parsed.responseText;
  if ((action !== "reply" && action !== "capability_call") || typeof responseText !== "string") {
    throw new Error("Core action envelope requires action and responseText.");
  }
  const capabilityRequest = parsed.capabilityRequest;
  if (action === "capability_call") {
    if (!capabilityRequest || typeof capabilityRequest !== "object") {
      throw new Error("Core capability_call envelope requires capabilityRequest.");
    }
    const request = capabilityRequest as Record<string, unknown>;
    if (typeof request.capabilityKey !== "string" || typeof request.reason !== "string" || !request.input || typeof request.input !== "object") {
      throw new Error("Core capabilityRequest requires capabilityKey, reason, and object input.");
    }
    return {
      action,
      responseText,
      capabilityRequest: {
        capabilityKey: request.capabilityKey,
        reason: request.reason,
        input: request.input as Record<string, unknown>,
        requestedTier: typeof request.requestedTier === "string"
          ? request.requestedTier as CoreCapabilityRequest["requestedTier"]
          : undefined,
        timeoutMs: readPositiveInteger(request.timeoutMs),
      },
    };
  }
  return {
    action,
    responseText,
  };
}

function unwrapResponseTextIfJson(text: string): string {
  try {
    const parsed = JSON.parse(extractFirstJsonObject(text)) as Record<string, unknown>;
    if (typeof parsed.responseText === "string" && parsed.responseText.trim()) {
      return parsed.responseText.trim();
    }
  } catch {
    // Keep original text when it is not a matching JSON envelope.
  }
  return text;
}

function stripCodeFences(value: string): string {
  return value.replace(/```[a-zA-Z0-9_-]*\n?/gu, "").replace(/```/gu, "").trim();
}

function resolveReasoningEffort(
  plan: AgentRoutePlan,
): "low" | "medium" | "high" | undefined {
  return plan.reasoning === "none" ? undefined : plan.reasoning;
}

function readPositiveInteger(value: unknown): number | undefined {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function formatNowStamp(date = new Date()): string {
  return date.toLocaleTimeString("zh-CN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function createLiveChatLogPath(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
  return resolve(process.cwd(), "memory/live-reports", `live-agent-chat.${timestamp}.jsonl`);
}

function formatTapMatrixRows(matrix: Array<{
  mode: string;
  riskLevel: string;
  reviewerDecision: string;
  toolReviewerAuthority: string;
  tmaLane: string;
  autoContinue: boolean;
  requiresHumanGate: boolean;
}>): string[] {
  const grouped = new Map<string, typeof matrix>();
  for (const entry of matrix) {
    const bucket = grouped.get(entry.mode) ?? [];
    bucket.push(entry);
    grouped.set(entry.mode, bucket);
  }

  return [...grouped.entries()].map(([mode, rows]) => {
    const parts = rows.map((row) =>
      `${row.riskLevel}:${row.reviewerDecision}/tool=${row.toolReviewerAuthority}/tma=${row.tmaLane}${row.autoContinue ? "/auto" : ""}${row.requiresHumanGate ? "/human" : ""}`,
    );
    return `${mode} => ${parts.join(" | ")}`;
  });
}

function inferStreamLabel(params: ModelInferenceExecutionParams): string {
  const metadata = params.intent.frame.metadata ?? {};
  const explicit = readString(metadata.streamLabel);
  if (explicit) {
    return explicit;
  }
  const cmpRole = readString(metadata.cmpRole);
  if (cmpRole) {
    return `CMP/${cmpRole}`;
  }
  const tapWorkerKind = readString(metadata.tapWorkerKind);
  if (tapWorkerKind) {
    return `TAP/${tapWorkerKind}`;
  }
  return "core/model.infer";
}

function shouldPrintStreamLabel(uiMode: "full" | "direct", label: string): boolean {
  if (uiMode === "full") {
    return true;
  }
  return false;
}

function parseTapRequest(text: string): ParsedTapRequest | undefined {
  const normalized = stripCodeFences(text);
  const markerIndex = normalized.search(/\[(?:TAP[_ ]REQUEST|TAP 请求)\]/u);
  if (markerIndex < 0) {
    return undefined;
  }

  const block = normalized.slice(markerIndex);
  const capabilityMatch = block.match(/capability:\s*([a-zA-Z0-9._-]+)/u);
  if (!capabilityMatch?.[1]) {
    return undefined;
  }
  const capabilityKey = capabilityMatch[1].trim();

  if (capabilityKey === "shell.restricted") {
    const commandMatch = block.match(/command:\s*([^\n\r]+)/u);
    const cwdMatch = block.match(/cwd:\s*([^\n\r]+)/u);
    const rawCommand = commandMatch?.[1]?.trim();
    if (!rawCommand) {
      return undefined;
    }
    const needsShell = /[|&;<>()$`]/u.test(rawCommand) || rawCommand.includes("||") || rawCommand.includes("&&") || rawCommand.includes(" ");
    return {
      capabilityKey,
      rawCommand,
      input: needsShell
        ? {
            command: "zsh",
            args: ["-lc", rawCommand],
            cwd: cwdMatch?.[1]?.trim() || ".",
            timeoutMs: 20_000,
          }
        : {
            command: rawCommand,
            cwd: cwdMatch?.[1]?.trim() || ".",
            timeoutMs: 20_000,
          },
    };
  }

  return undefined;
}

async function executeCliModelInference(
  params: ModelInferenceExecutionParams,
): Promise<ModelInferenceExecutionResult> {
  const metadata = params.intent.frame.metadata ?? {};
  const provider = readString(metadata.provider) ?? "openai";
  const variant = readString(metadata.variant) ?? "responses";
  const model = readString(metadata.model) ?? loadOpenAILiveConfig().model;
  const reasoningEffort = readString(metadata.reasoningEffort) as "low" | "medium" | "high" | undefined;
  const maxOutputTokens = readPositiveInteger(metadata.maxOutputTokens);

  if (provider !== "openai" || (variant !== "responses" && variant !== "chat_completions_compat")) {
    return executeModelInference(params);
  }

  const config = loadOpenAILiveConfig();
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
  const label = inferStreamLabel(params);
  const logger = metadata.cliLogger instanceof LiveChatLogger
    ? metadata.cliLogger
    : undefined;
  const turnIndex = readPositiveInteger(metadata.cliTurnIndex);
  const uiMode = metadata.cliUiMode === "direct"
    ? "direct"
    : CURRENT_UI_MODE;
  const printStream = shouldPrintStreamLabel(uiMode, label);
  const preferBuffered = label === "core/action";
  const startedAt = Date.now();
  const startStamp = formatNowStamp();
  let printedHeader = false;
  let text = "";

  if (printStream) {
    console.log(`\n[stream ${label}] start ${startStamp}`);
  }
  await logger?.log("stream_start", {
    turnIndex,
    label,
    provider,
    model,
    variant,
    reasoningEffort: reasoningEffort ?? "none",
    maxOutputTokens: maxOutputTokens ?? null,
  });

  const fallbackToManagedInference = async (
    reason: "empty_buffered" | "empty_streamed" | "stream_failed_fallback_buffered",
  ): Promise<ModelInferenceExecutionResult> => {
    const fallback = await executeModelInference(params);
    const fallbackText =
      fallback?.result?.output && typeof fallback.result.output === "object"
        ? (((fallback.result.output as { text?: unknown }).text) as string | undefined) ?? ""
        : "";
    if (printStream && fallbackText) {
      console.log(`[stream ${label}] ${fallbackText}`);
      console.log(`[stream ${label}] end ${formatNowStamp()} (${formatElapsed(Date.now() - startedAt)})`);
    }
    await logger?.log("stream_text", {
      turnIndex,
      label,
      text: fallbackText,
    });
    await logger?.log("stream_end", {
      turnIndex,
      label,
      status: reason,
      elapsedMs: Date.now() - startedAt,
      outputChars: fallbackText.length,
    });
    return fallback;
  };

  const finishBuffered = async (status: "success" | "buffered_success" | "stream_failed_fallback_buffered" = "success"): Promise<ModelInferenceExecutionResult> => {
    let bufferedText = "";
    let bufferedRaw: Record<string, unknown> | undefined;
    if (variant === "responses") {
      const response = await client.responses.create({
        model,
        input: params.intent.frame.instructionText,
        stream: false,
        max_output_tokens: maxOutputTokens,
        reasoning: reasoningEffort ? { effort: reasoningEffort } : undefined,
      } as never);
      bufferedRaw = response as unknown as Record<string, unknown>;
      bufferedText = extractTextFromResponseLike(bufferedRaw);
    } else {
      const completion = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: params.intent.frame.instructionText }],
        stream: false,
        max_completion_tokens: maxOutputTokens,
        reasoning_effort: reasoningEffort,
      } as never);
      const choice = Array.isArray(completion.choices) ? completion.choices[0] : undefined;
      const message = choice && typeof choice === "object"
        ? (choice as { message?: { content?: unknown } }).message
        : undefined;
      bufferedText = typeof message?.content === "string" ? message.content : "";
      bufferedRaw = completion as unknown as Record<string, unknown>;
    }

    if (!bufferedText.trim()) {
      return fallbackToManagedInference("empty_buffered");
    }

    if (printStream && bufferedText) {
      console.log(`[stream ${label}] ${bufferedText}`);
    }
    await logger?.log("stream_text", {
      turnIndex,
      label,
      text: bufferedText,
    });
    const endedAt = Date.now();
    if (printStream) {
      console.log(`[stream ${label}] end ${formatNowStamp()} (${formatElapsed(endedAt - startedAt)})`);
    }
    await logger?.log("stream_end", {
      turnIndex,
      label,
      status,
      elapsedMs: endedAt - startedAt,
      outputChars: bufferedText.length,
    });

    return {
      provider: "openai",
      model,
      layer: "api",
      raw: bufferedRaw ?? {
        object: variant === "responses" ? "response" : "chat.completion",
        output_text: bufferedText,
      },
      result: {
        resultId: params.intent.intentId,
        sessionId: params.intent.sessionId,
        runId: params.intent.runId,
        source: "model",
        status: "success",
        output: {
          text: bufferedText,
          raw: bufferedRaw ?? {
            object: variant === "responses" ? "response" : "chat.completion",
            output_text: bufferedText,
          },
        },
        evidence: [],
        emittedAt: new Date().toISOString(),
        correlationId: params.intent.correlationId,
        metadata: {
          provider: "openai",
          model,
          layer: "api",
          variant,
        },
      },
    };
  };

  if (preferBuffered) {
    return finishBuffered("buffered_success");
  }

  const ensureHeader = (): void => {
    if (!printStream) {
      return;
    }
    if (printedHeader) {
      return;
    }
    printedHeader = true;
    output.write(`[stream ${label}] `);
  };

  try {
    if (variant === "responses") {
      const stream = await client.responses.create({
        model,
        input: params.intent.frame.instructionText,
        stream: true,
        max_output_tokens: maxOutputTokens,
        reasoning: reasoningEffort ? { effort: reasoningEffort } : undefined,
      } as never);

      for await (const event of stream as unknown as AsyncIterable<Record<string, unknown>>) {
        if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
          ensureHeader();
          text += event.delta;
          if (printStream) {
            output.write(event.delta);
          }
        } else if (event.type === "response.output_text.done" && typeof event.text === "string" && !text.trim()) {
          ensureHeader();
          text = event.text;
          if (printStream) {
            output.write(event.text);
          }
        }
      }
    } else {
      const stream = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: params.intent.frame.instructionText }],
        stream: true,
        max_completion_tokens: maxOutputTokens,
        reasoning_effort: reasoningEffort,
      } as never);

      for await (const chunk of stream as unknown as AsyncIterable<Record<string, unknown>>) {
        const choices = Array.isArray(chunk.choices) ? chunk.choices : [];
        const firstChoice = choices[0];
        if (!firstChoice || typeof firstChoice !== "object") {
          continue;
        }
        const delta = (firstChoice as Record<string, unknown>).delta;
        if (!delta || typeof delta !== "object") {
          continue;
        }
        const content = (delta as Record<string, unknown>).content;
        if (typeof content === "string" && content.length > 0) {
          ensureHeader();
          text += content;
          if (printStream) {
            output.write(content);
          }
        }
      }
    }
  } catch (error) {
    if (printStream) {
      console.log(`[stream ${label}] streaming path failed, fallback to buffered call`);
    }
    return finishBuffered("stream_failed_fallback_buffered");
  } finally {
    if (printedHeader && printStream) {
      output.write("\n");
    }
  }

  const endedAt = Date.now();
  if (!text.trim()) {
    return fallbackToManagedInference("empty_streamed");
  }
  if (printStream) {
    console.log(`[stream ${label}] end ${formatNowStamp()} (${formatElapsed(endedAt - startedAt)})`);
  }
  await logger?.log("stream_text", {
    turnIndex,
    label,
    text,
  });
  await logger?.log("stream_end", {
    turnIndex,
    label,
    status: "success",
    elapsedMs: endedAt - startedAt,
    outputChars: text.length,
  });

  return {
    provider: "openai",
    model,
    layer: "api",
    raw: {
      object: variant === "responses" ? "response" : "chat.completion",
      output_text: text,
    },
    result: {
      resultId: params.intent.intentId,
      sessionId: params.intent.sessionId,
      runId: params.intent.runId,
      source: "model",
      status: "success",
      output: {
        text,
        raw: {
          object: variant === "responses" ? "response" : "chat.completion",
          output_text: text,
        },
      },
      evidence: [],
      emittedAt: new Date().toISOString(),
      correlationId: params.intent.correlationId,
      metadata: {
        provider: "openai",
        model,
        layer: "api",
        variant,
      },
    },
  };
}

function printStartup(config: ReturnType<typeof loadOpenAILiveConfig>): void {
  printDivider("Praxis Live CLI");
  console.log("当前这不是假 mock，而是 CMP + TAP + core 的真实运行 harness。");
  console.log(`OpenAI-compatible route: ${config.baseURL}`);
  console.log(formatRoutePlan("core", LIVE_CHAT_MODEL_PLAN.core));
  console.log("TAP:");
  console.log(`  ${formatRoutePlan("reviewer", LIVE_CHAT_MODEL_PLAN.tap.reviewer)}`);
  console.log(`  ${formatRoutePlan("tool_reviewer", LIVE_CHAT_MODEL_PLAN.tap.toolReviewer)}`);
  console.log(`  ${formatRoutePlan("provisioner", LIVE_CHAT_MODEL_PLAN.tap.provisioner)}`);
  console.log("CMP:");
  console.log(`  ${formatRoutePlan("icma", LIVE_CHAT_MODEL_PLAN.cmp.icma)}`);
  console.log(`  ${formatRoutePlan("iterator", LIVE_CHAT_MODEL_PLAN.cmp.iterator)}`);
  console.log(`  ${formatRoutePlan("checker", LIVE_CHAT_MODEL_PLAN.cmp.checker)}`);
  console.log(`  ${formatRoutePlan("dbagent", LIVE_CHAT_MODEL_PLAN.cmp.dbagent)}`);
  console.log(`  ${formatRoutePlan("dispatcher", LIVE_CHAT_MODEL_PLAN.cmp.dispatcher)}`);
  console.log("命令: /help /status /cmp /tap /events /history /exit");
}

function printStartupDirect(config: ReturnType<typeof loadOpenAILiveConfig>): void {
  printDirectBox(">_ Praxis Direct CLI", [
    `model:     ${LIVE_CHAT_MODEL_PLAN.core.model} ${LIVE_CHAT_MODEL_PLAN.core.reasoning}`,
    `tap mode:  ${LIVE_CHAT_TAP_OVERRIDE.requestedMode} / ${LIVE_CHAT_TAP_OVERRIDE.automationDepth}`,
    `workspace: ${process.cwd().split("/").slice(-1)[0] || process.cwd()}`,
    `route:     ${config.baseURL}`,
  ]);
  console.log("Commands: /help /status /capabilities /history /exit");
  console.log("Composer: Enter send · Ctrl+J newline");
}

function printHelp(): void {
  printDivider("Commands");
  console.log("/help    查看命令");
  console.log("/status  查看最近一轮 CMP/TAP/core 总览");
  console.log("/capabilities 查看当前 TAP 池中已注册能力");
  console.log("/cmp     查看最近一轮 CMP 摘要");
  console.log("/tap     查看当前 TAP 治理视图");
  console.log("/events   查看最近一轮 core run 事件类型");
  console.log("/history 查看当前 CLI 内部对话历史摘要");
  console.log("/exit    退出");
}

function printCmpArtifacts(turn: CmpTurnArtifacts): void {
  printDivider("CMP Active View");
  console.log(`agentId: ${turn.agentId}`);
  console.log(`intent: ${turn.intent}`);
  console.log(`operatorGuide: ${turn.operatorGuide}`);
  console.log(`childGuide: ${turn.childGuide}`);
  console.log(`checkerReason: ${turn.checkerReason}`);
  console.log(`packageRef: ${turn.packageRef}`);
  console.log(`routeRationale: ${turn.routeRationale}`);
  console.log(`scopePolicy: ${turn.scopePolicy}`);
  console.log(`packageStrategy: ${formatDisplayValue(turn.packageStrategy)}`);
  console.log(`timelineStrategy: ${formatDisplayValue(turn.timelineStrategy)}`);
  console.log(
    `live: icma=${formatLiveStatus(turn.summary.live.icma)}, iterator=${formatLiveStatus(turn.summary.live.iterator)}, checker=${formatLiveStatus(turn.summary.live.checker)}, dbagent=${formatLiveStatus(turn.summary.live.dbagent)}, dispatcher=${formatLiveStatus(turn.summary.live.dispatcher)}`,
  );
}

function printTapArtifacts(runtime: LiveCliState["runtime"], sessionId: string, runId?: string): void {
  const governance = runtime.createTapGovernanceObject({
    userOverride: LIVE_CHAT_TAP_OVERRIDE,
  });
  const userSurface = runtime.createTapUserSurfaceSnapshot({
    userOverride: LIVE_CHAT_TAP_OVERRIDE,
  });
  const snapshot = runtime.createTapGovernanceSnapshot();
  const usage = runtime.createTapThreeAgentUsageReport({
    sessionId,
    runId,
  });
  const manifests = runtime.capabilityPool.listCapabilities();
  const capabilityKeys = manifests.map((manifest) => manifest.capabilityKey);
  const capabilityKeyById = new Map(manifests.map((manifest) => [manifest.capabilityId, manifest.capabilityKey]));
  const bindingKeys = runtime.capabilityPool
    .listBindings()
    .map((binding) => `${capabilityKeyById.get(binding.capabilityId) ?? binding.capabilityId}:${binding.state}`);

  printDivider("TAP Governance View");
  console.log(`summary: ${userSurface.summary}`);
  console.log(
    `visibleMode=${userSurface.visibleMode} automationDepth=${userSurface.automationDepth} currentLayer=${userSurface.currentLayer}`,
  );
  console.log(
    `workspaceMode=${governance.workspacePolicy.workspaceMode} taskMode=${governance.taskPolicy.taskMode} effectiveMode=${governance.taskPolicy.effectiveMode}`,
  );
  console.log(
    `pendingHumanGateCount=${userSurface.pendingHumanGateCount} activeCapabilityKeys=${userSurface.activeCapabilityKeys.join(", ") || "(none)"}`,
  );
  console.log(`blockingCapabilityKeys=${snapshot.blockingCapabilityKeys.join(", ") || "(none)"}`);
  console.log(`threeAgentUsage: ${usage.summary}`);
  console.log(`registeredCapabilities(${capabilityKeys.length}): ${capabilityKeys.join(", ") || "(none)"}`);
  console.log(`bindings(${bindingKeys.length}): ${bindingKeys.join(", ") || "(none)"}`);
  console.log("shared15ViewMatrix:");
  for (const line of formatTapMatrixRows(governance.shared15ViewMatrix)) {
    console.log(`  ${line}`);
  }
}

function printCoreArtifacts(turn: CoreTurnArtifacts): void {
  printDivider("Core Result");
  console.log(`runId: ${turn.runId}`);
  console.log(`dispatchStatus: ${turn.dispatchStatus}`);
  console.log(`capability: ${turn.capabilityKey ?? "(none)"}`);
  console.log(`capabilityResultStatus: ${turn.capabilityResultStatus ?? "(none)"}`);
  console.log("\nAssistant:");
  console.log(turn.answer);
}

function printDirectCapabilities(runtime: LiveCliState["runtime"]): void {
  const capabilities = runtime.capabilityPool
    .listCapabilities()
    .map((manifest) => manifest.capabilityKey)
    .sort();
  const grouped = new Map<string, string[]>();
  for (const capability of capabilities) {
    const family = capability.split(".")[0] ?? "other";
    const bucket = grouped.get(family) ?? [];
    bucket.push(capability);
    grouped.set(family, bucket);
  }
  console.log("");
  printDirectBullet(`Capabilities (${capabilities.length} registered)`);
  for (const [family, items] of grouped.entries()) {
    printDirectSub(`${family}: ${items.join(", ")}`);
  }
}

function printDirectStatus(state: LiveCliState): void {
  if (!state.lastTurn) {
    console.log("还没有跑任何一轮。先直接输入一句话。");
    return;
  }
  const governance = state.runtime.createTapGovernanceObject({
    userOverride: LIVE_CHAT_TAP_OVERRIDE,
  });
  const snapshot = state.runtime.createTapGovernanceSnapshot();
  console.log("");
  printDirectBullet("Status");
  printDirectSub(`core: ${state.lastTurn.core.dispatchStatus} / ${state.lastTurn.core.capabilityKey ?? "no capability"} / ${state.lastTurn.core.capabilityResultStatus ?? "success"}`);
  printDirectSub(`cmp: ${state.latestCmp ? "synced" : "warming"} / ${truncate(state.lastTurn.cmp.intent, 96)}`);
  printDirectSub(`tap: ${governance.taskPolicy.effectiveMode} / ${state.runtime.capabilityPool.listCapabilities().length} registered / ${snapshot.blockingCapabilityKeys.length} blocked`);
}

function printStatus(state: LiveCliState): void {
  if (!state.lastTurn) {
    console.log("还没有跑任何一轮。先直接输入一句话。");
    return;
  }

  if (state.uiMode === "direct") {
    printDirectStatus(state);
    printDirectAnswer(state.lastTurn.core);
    return;
  }

  printCmpArtifacts(state.lastTurn.cmp);
  printTapArtifacts(state.runtime, state.sessionId, state.lastTurn.core.runId);
  printCoreArtifacts(state.lastTurn.core);
}

function printDirectAnswer(turn: CoreTurnArtifacts): void {
  console.log("");
  printDirectBullet("Assistant");
  console.log(turn.answer);
}

function printEvents(state: LiveCliState): void {
  if (!state.lastTurn) {
    console.log("还没有 core run 事件。");
    return;
  }
  printDivider("Core Event Types");
  for (const eventType of state.lastTurn.core.eventTypes) {
    console.log(`- ${eventType}`);
  }
}

function buildCoreUserInput(input: {
  userMessage: string;
  transcript: DialogueTurn[];
  cmp?: CmpTurnArtifacts;
  runtime: LiveCliState["runtime"];
  toolResultText?: string;
  forceFinalAnswer?: boolean;
}): string {
  const recentTurns = input.transcript.slice(-6);
  const availableCapabilities = input.runtime.capabilityPool
    .listCapabilities()
    .map((manifest) => manifest.capabilityKey)
    .join(", ");
  const cmpSummaryBlock = input.cmp
    ? [
      "CMP active package summary:",
      `- intent: ${input.cmp.intent}`,
      `- operator guide: ${input.cmp.operatorGuide}`,
      `- child guide: ${input.cmp.childGuide}`,
      `- checker reason: ${input.cmp.checkerReason}`,
      `- package ref: ${input.cmp.packageRef}`,
      `- route rationale: ${input.cmp.routeRationale}`,
      `- scope policy: ${input.cmp.scopePolicy}`,
      `- package strategy: ${input.cmp.packageStrategy}`,
      `- timeline strategy: ${input.cmp.timelineStrategy}`,
    ]
    : [
      "CMP active package summary:",
      "- no fresh CMP package is available yet for this turn",
      "- proceed with the direct user request and any already available capability window",
    ];
  return [
    "You are answering inside the Praxis live CLI harness.",
    "Use the CMP package summary below as the current executable context.",
    "Execution mode is active.",
    "TAP governance is configured in bapr + prefer_auto for this CLI.",
    "The registered TAP capability window below is already available for direct use.",
    "Do not ask the user to manually approve, manually run commands, or paste local command output when a matching registered capability already exists.",
    "Do not describe yourself as unable to act when the capability window already contains a fitting tool.",
    "If the user asks what you can do, what abilities are in the TAP pool, or asks for a capability introduction, answer directly from the registered capability inventory below instead of calling a tool.",
    "Do not use MCP capabilities merely to inspect your own already-registered TAP inventory.",
    input.forceFinalAnswer
      ? "A TAP tool result is already available. Do not emit another tool request. Answer the user directly."
      : "If the user asks to inspect or operate the local workspace/system, or asks for current online information, emit a structured action envelope immediately whenever a fitting capability exists.",
    input.forceFinalAnswer
      ? "Summarize the actual tool result and continue the task."
      : "Exact JSON schema: {\"action\":\"reply|capability_call\",\"responseText\":\"短中文句子\",\"capabilityRequest\":{\"capabilityKey\":\"shell.restricted|test.run|repo.write|code.read|docs.read|search.ground|skill.use|skill.mount|skill.prepare|mcp.listTools|mcp.readResource|mcp.call|mcp.native.execute\",\"reason\":\"为什么要用\",\"requestedTier\":\"B0|B1|B2|B3\",\"timeoutMs\":15000,\"input\":{}}}",
    input.forceFinalAnswer
      ? "Do not return JSON in the final answer."
      : "Return strict JSON only. No markdown fences. No prose outside JSON.",
    input.forceFinalAnswer
      ? ""
      : "For shell.restricted/test.run, use structured input like {\"command\":\"zsh\",\"args\":[\"--version\"],\"cwd\":\".\",\"timeoutMs\":15000}. Do not use shell operators like ||, &&, pipes, redirects, or inline shell strings.",
    input.forceFinalAnswer
      ? ""
      : "If the user asks for latest/current web information, browsing, live situation, or anything explicitly requiring the internet, prefer search.ground instead of replying that you cannot browse.",
    input.forceFinalAnswer
      ? ""
      : "For search.ground, use input like {\"query\":\"问题本体\",\"freshness\":\"day\",\"citations\":\"required\"}. Provider/model defaults will be supplied by the CLI.",
    input.forceFinalAnswer
      ? ""
      : "When using shell.restricted, prefer bounded output. Avoid commands that dump an entire large tree or huge raw search results in one go.",
    input.forceFinalAnswer
      ? ""
      : "For skill.use / skill.mount / skill.prepare, provide route fields like provider/model and include the skill source or container in input.",
    input.forceFinalAnswer
      ? ""
      : "For MCP capabilities, provide route.provider, route.model, and structured input. Examples: mcp.listTools => {\"route\":{...},\"input\":{\"connectionId\":\"...\"}}, mcp.call => {\"route\":{...},\"input\":{\"connectionId\":\"...\",\"toolName\":\"...\",\"arguments\":{}}}.",
    input.forceFinalAnswer
      ? ""
      : "If shell.restricted, test.run, repo.write, or search.ground is already registered, treat it as ready-to-use TAP inventory rather than something that still needs user approval.",
    `Currently registered TAP capabilities: ${availableCapabilities || "(none)"}.`,
    "",
    "Latest user message:",
    input.userMessage,
    "",
    "Recent dialogue:",
    formatTranscript(recentTurns),
    "",
    ...cmpSummaryBlock,
    ...(input.toolResultText
      ? [
        "",
        "Latest TAP tool result:",
        input.toolResultText,
      ]
      : []),
    "",
    "Return JSON only. No markdown fences. No prose outside JSON. Use Chinese in responseText unless the user asks for another language.",
  ].join("\n");
}

function extractResponseTextMaybe(text: string): string {
  const cleaned = text.trim();
  if (!cleaned.startsWith("{")) {
    return cleaned;
  }
  try {
    const parsed = JSON.parse(extractFirstJsonObject(cleaned)) as Record<string, unknown>;
    if (typeof parsed.responseText === "string" && parsed.responseText.trim()) {
      return parsed.responseText.trim();
    }
  } catch {
    return cleaned;
  }
  return cleaned;
}

async function runCoreModelPass(input: {
  state: LiveCliState;
  userInput: string;
  cmp?: CmpTurnArtifacts;
  config: ReturnType<typeof loadOpenAILiveConfig>;
}): Promise<{
  runId: string;
  answer: string;
  dispatchStatus: string;
  capabilityKey?: string;
  capabilityResultStatus?: string;
  eventTypes: string[];
}> {
  const source = createGoalSource({
    goalId: randomUUID(),
    sessionId: input.state.sessionId,
    userInput: input.userInput,
      metadata: {
        provider: "openai",
        model: LIVE_CHAT_MODEL_PLAN.core.model,
        variant: "responses",
        reasoningEffort: resolveReasoningEffort(LIVE_CHAT_MODEL_PLAN.core),
        cliHarness: "praxis-live-cli",
        cliLogger: input.state.logger,
        cliTurnIndex: input.state.turnIndex,
        cliUiMode: input.state.uiMode,
        ...(input.cmp ? {
          cmpPackageId: input.cmp.packageId,
          cmpPackageRef: input.cmp.packageRef,
      } : {}),
    },
  });

  const result = await input.state.runtime.runUntilTerminal({
    sessionId: input.state.sessionId,
    source,
    maxSteps: 4,
  });

  const answer = result.answer?.trim()
    || "Core 没有返回正文，但链路已经跑完。";
  const eventTypes = result.finalEvents.map((entry) => entry.event.type);
  const capabilityResultEvent = result.finalEvents
    .map((entry) => entry.event)
    .find((event) => event.type === "capability.result_received");
  const capabilityResultStatus = capabilityResultEvent?.type === "capability.result_received"
    ? capabilityResultEvent.payload.status
    : undefined;

  return {
    runId: result.outcome.run.runId,
    answer,
    dispatchStatus: result.capabilityDispatch?.status ?? "none",
    capabilityKey: result.capabilityDispatch?.dispatch?.prepared.capabilityKey,
    capabilityResultStatus,
    eventTypes,
  };
}

async function executeTapRequest(
  state: LiveCliState,
  request: ParsedTapRequest,
): Promise<{
  capabilityKey: string;
  status: string;
  output?: unknown;
  error?: unknown;
}> {
  const toolRun = await state.runtime.createRunFromSource({
    sessionId: state.sessionId,
    source: createGoalSource({
      sessionId: state.sessionId,
      userInput: `CLI TAP tool execution for ${request.capabilityKey}`,
      metadata: {
        cliHarness: "praxis-live-cli",
        cliTurnIndex: state.turnIndex,
      },
    }),
  });

  const intentId = `cli-capability:${randomUUID()}`;
  const dispatch = await state.runtime.dispatchCapabilityIntentViaTaPool({
    intentId,
    sessionId: state.sessionId,
    runId: toolRun.run.runId,
    kind: "capability_call",
    createdAt: new Date().toISOString(),
    priority: "high",
    correlationId: intentId,
    request: {
      requestId: `cli-capability-request:${randomUUID()}`,
      intentId,
      sessionId: state.sessionId,
      runId: toolRun.run.runId,
      capabilityKey: request.capabilityKey,
      input: request.input,
      priority: "high",
      timeoutMs: readPositiveInteger(request.input.timeoutMs) ?? 20_000,
      metadata: {
        cliHarness: "praxis-live-cli",
        cliTurnIndex: state.turnIndex,
      },
    },
  }, {
    agentId: `praxis-live-cli:${state.sessionId}`,
    mode: LIVE_CHAT_TAP_OVERRIDE.requestedMode,
    requestedTier: "B1",
    reason: `CLI execution request for ${request.capabilityKey}`,
    metadata: {
      tapUserOverride: LIVE_CHAT_TAP_OVERRIDE,
    },
  });

  const kernelResult = state.runtime.readKernelResult(toolRun.run.runId);
  if (dispatch.status !== "dispatched") {
    return {
      capabilityKey: request.capabilityKey,
      status: dispatch.status,
      error: {
        safety: dispatch.safety,
        reviewDecision: dispatch.reviewDecision,
      },
    };
  }

  return {
    capabilityKey: request.capabilityKey,
    status: kernelResult?.status ?? "unknown",
    output: kernelResult?.output,
    error: kernelResult?.error,
  };
}

async function runCoreActionPlanner(
  state: LiveCliState,
  userMessage: string,
): Promise<CoreActionEnvelope> {
  const availableCapabilities = state.runtime.capabilityPool
    .listCapabilities()
    .map((manifest) => manifest.capabilityKey);
  const intent = {
    intentId: randomUUID(),
    sessionId: state.sessionId,
    runId: `${state.sessionId}:core-action:${state.turnIndex}`,
    kind: "model_inference" as const,
    createdAt: new Date().toISOString(),
    priority: "high" as const,
    frame: {
      goalId: `core-action-envelope:${state.turnIndex}`,
      instructionText: [
        "Return strict JSON only.",
        "Choose the next action for the frontstage core agent.",
        "Execution mode is active.",
        "TAP governance is bapr + prefer_auto for this CLI.",
        `Available capabilities: ${availableCapabilities.join(", ") || "(none)"}`,
        "These registered capabilities are already available for direct use in this CLI.",
        "If a fitting capability exists, choose capability_call instead of reply.",
        "Do not ask the user to approve, to run local commands themselves, or to paste command output when a fitting capability already exists.",
        "Do not say you cannot act if the capability window already contains a matching tool.",
        "If the user asks what you can do, what abilities you have, or what is currently in the TAP pool, answer directly from the available capability inventory instead of calling any tool.",
        "Do not use mcp.* just to inspect your own registered inventory.",
        "If the user asks for current, latest, online, web, or live information and search.ground is available, choose capability_call with search.ground instead of saying you cannot browse.",
        "For shell.restricted and test.run, prefer bounded output and avoid commands likely to dump an entire large repository or massive raw result in one step.",
        "Schema:",
        '{"action":"reply|capability_call","responseText":"user-facing text","capabilityRequest":{"capabilityKey":"shell.restricted|test.run|repo.write|search.ground|skill.use|skill.mount|skill.prepare|mcp.listTools|mcp.readResource|mcp.call|mcp.native.execute|...","reason":"short reason","input":{"command":"...","args":["..."],"cwd":"."},"requestedTier":"B0|B1|B2|B3","timeoutMs":20000}}',
        "If action=reply, omit capabilityRequest.",
        "If action=capability_call, responseText should briefly tell the user what tool you are using and then proceed.",
        "For search.ground, emit input like {\"query\":\"...\",\"freshness\":\"day\",\"citations\":\"required\"}. The CLI will supply provider/model defaults.",
        "For skill.* and mcp.* capabilities, include structured route/input objects rather than vague prose.",
        "User message:",
        userMessage,
      ].join("\n"),
      successCriteria: [],
      failureCriteria: [],
      constraints: [],
      inputRefs: [],
      cacheKey: `core-action-envelope:${randomUUID()}`,
      metadata: {
        provider: "openai",
        model: LIVE_CHAT_MODEL_PLAN.core.model,
        variant: "responses",
        reasoningEffort: resolveReasoningEffort(LIVE_CHAT_MODEL_PLAN.core),
        streamLabel: "core/action",
        cliLogger: state.logger,
        cliTurnIndex: state.turnIndex,
        cliUiMode: state.uiMode,
      },
    },
  };

  const result = await executeCliModelInference({ intent });
  const text = ((result.result.output as { text?: unknown }).text as string | undefined) ?? "";
  return parseCoreActionEnvelope(text);
}

async function runCmpTurn(state: LiveCliState, userMessage: string): Promise<CmpTurnArtifacts> {
  const turnId = `${state.turnIndex}`;
  const timestamp = new Date().toISOString();
  const agentId = "cmp-live-cli-main";
  const projectionId = `cmp-cli-projection-${turnId}`;
  const snapshotId = `cmp-cli-snapshot-${turnId}`;
  const packageId = `cmp-cli-package-${turnId}`;
  const packageRef = `cmp-package:${snapshotId}:core-live-cli:active_reseed`;
  const transcriptWindow = state.transcript.slice(-6);
  const previousAssistant = [...state.transcript].reverse().find((turn) => turn.role === "assistant")?.text;

  const icmaInput = {
    ingest: {
      agentId,
      sessionId: state.sessionId,
      taskSummary: `Prepare current executable context for the latest user request: ${truncate(userMessage, 160)}`,
      materials: [
        { kind: "user_input" as const, ref: `turn:${turnId}:user` },
        ...(previousAssistant
          ? [{ kind: "assistant_output" as const, ref: `turn:${turnId}:assistant-prev` }]
          : []),
        ...(transcriptWindow.length > 1
          ? [{ kind: "system_prompt" as const, ref: `session:${state.sessionId}:history` }]
          : []),
      ],
      lineage: createAgentLineage({
        agentId,
        depth: 0,
        projectId: "praxis-live-cli",
        branchFamily: createCmpBranchFamily({
          workBranch: "work/praxis-live-cli",
          cmpBranch: "cmp/praxis-live-cli",
          mpBranch: "mp/praxis-live-cli",
          tapBranch: "tap/praxis-live-cli",
        }),
      }),
      metadata: {
        latestUserMessage: userMessage,
        previousAssistantMessage: previousAssistant,
        transcriptWindow,
        harness: "praxis-live-cli",
        cliLogger: state.logger,
        cliTurnIndex: state.turnIndex,
        cliUiMode: state.uiMode,
      },
    },
    createdAt: timestamp,
    loopId: `cmp-cli-icma-${turnId}`,
  };

  const iteratorInput = {
    agentId,
    deltaId: `cmp-cli-delta-${turnId}`,
    candidateId: `cmp-cli-candidate-${turnId}`,
    branchRef: "refs/heads/cmp/praxis-live-cli",
    commitRef: `cmp-cli-commit-${turnId}`,
    reviewRef: `refs/cmp/review/${turnId}`,
    createdAt: timestamp,
    metadata: {
      latestUserMessage: userMessage,
      cliLogger: state.logger,
      cliTurnIndex: state.turnIndex,
      cliUiMode: state.uiMode,
    },
  };

  const checkerInput = {
    agentId,
    candidateId: `cmp-cli-candidate-${turnId}`,
    checkedSnapshotId: snapshotId,
    checkedAt: timestamp,
    suggestPromote: false,
    metadata: {
      latestUserMessage: userMessage,
      transcriptWindow,
      cliLogger: state.logger,
      cliTurnIndex: state.turnIndex,
      cliUiMode: state.uiMode,
    },
  };

  const contextPackage = {
    packageId,
    sourceProjectionId: projectionId,
    targetAgentId: "core-live-cli",
    packageKind: "active_reseed" as const,
    packageRef,
    fidelityLabel: "checked_high_fidelity" as const,
    createdAt: timestamp,
    sourceSnapshotId: snapshotId,
    requestId: `cmp-cli-request-${turnId}`,
    metadata: {
      cmpGuideRef: `cmp-guide:${packageId}`,
      cmpBackgroundRef: `cmp-background:${packageId}`,
      cmpTimelinePackageId: `${packageId}:timeline`,
      latestUserMessage: userMessage,
      transcriptWindow,
    },
  };

  const dbagentInput = {
    checkedSnapshot: {
      snapshotId,
      agentId,
      lineageRef: `lineage:${agentId}`,
      branchRef: "refs/heads/cmp/praxis-live-cli",
      commitRef: `cmp-cli-commit-${turnId}`,
      checkedAt: timestamp,
      qualityLabel: "usable" as const,
      promotable: true,
      metadata: {
        latestUserMessage: userMessage,
        cliLogger: state.logger,
        cliTurnIndex: state.turnIndex,
        cliUiMode: state.uiMode,
      },
    },
    projectionId,
    contextPackage,
    createdAt: timestamp,
    loopId: `cmp-cli-dbagent-${turnId}`,
    metadata: {
      sourceRequestId: `cmp-cli-request-${turnId}`,
      cliLogger: state.logger,
      cliTurnIndex: state.turnIndex,
      cliUiMode: state.uiMode,
    },
  };

  const dispatcherInput = {
    contextPackage,
    dispatch: {
      agentId,
      packageId,
      sourceAgentId: agentId,
      targetAgentId: "core-live-cli",
      targetKind: "core_agent" as const,
      metadata: {
        sourceRequestId: `cmp-cli-request-${turnId}`,
        sourceSnapshotId: snapshotId,
        cliLogger: state.logger,
        cliTurnIndex: state.turnIndex,
      },
    },
    receipt: {
      dispatchId: `cmp-cli-dispatch-${turnId}`,
      packageId,
      sourceAgentId: agentId,
      targetAgentId: "core-live-cli",
      status: "delivered" as const,
      deliveredAt: timestamp,
    },
    createdAt: timestamp,
    loopId: `cmp-cli-dispatcher-${turnId}`,
  };

  await state.logger.log("stage_start", {
    turnIndex: state.turnIndex,
    stage: "cmp/icma",
  });
  const icmaResult = await withStopwatch(
    `[turn ${state.turnIndex}] CMP/icma elapsed`,
    () => state.runtime.captureCmpIcmaWithLlm(icmaInput),
    { quiet: state.uiMode === "direct" },
  );
  await state.logger.log("stage_end", {
    turnIndex: state.turnIndex,
    stage: "cmp/icma",
    status: "success",
    intent: icmaResult.loop.structuredOutput.intent,
  });
  await state.logger.log("stage_start", {
    turnIndex: state.turnIndex,
    stage: "cmp/iterator",
  });
  const iteratorResult = await withStopwatch(
    `[turn ${state.turnIndex}] CMP/iterator elapsed`,
    () => state.runtime.advanceCmpIteratorWithLlm(iteratorInput),
    { quiet: state.uiMode === "direct" },
  );
  await state.logger.log("stage_end", {
    turnIndex: state.turnIndex,
    stage: "cmp/iterator",
    status: "success",
    reviewRef: iteratorResult.reviewRef,
  });
  await state.logger.log("stage_start", {
    turnIndex: state.turnIndex,
    stage: "cmp/checker",
  });
  const checkerResult = await withStopwatch(
    `[turn ${state.turnIndex}] CMP/checker elapsed`,
    () => state.runtime.evaluateCmpCheckerWithLlm(checkerInput),
    { quiet: state.uiMode === "direct" },
  );
  await state.logger.log("stage_end", {
    turnIndex: state.turnIndex,
    stage: "cmp/checker",
    status: "success",
    shortReason: checkerResult.checkerRecord.reviewOutput.shortReason,
  });
  await state.logger.log("stage_start", {
    turnIndex: state.turnIndex,
    stage: "cmp/dbagent",
  });
  const dbagentResult = await withStopwatch(
    `[turn ${state.turnIndex}] CMP/dbagent elapsed`,
    () => state.runtime.materializeCmpDbAgentWithLlm(dbagentInput),
    { quiet: state.uiMode === "direct" },
  );
  await state.logger.log("stage_end", {
    turnIndex: state.turnIndex,
    stage: "cmp/dbagent",
    status: "success",
    packageTopology: dbagentResult.loop.materializationOutput.packageTopology,
  });
  await state.logger.log("stage_start", {
    turnIndex: state.turnIndex,
    stage: "cmp/dispatcher",
  });
  const dispatcherResult = await withStopwatch(
    `[turn ${state.turnIndex}] CMP/dispatcher elapsed`,
    () => state.runtime.dispatchCmpDispatcherWithLlm(dispatcherInput),
    { quiet: state.uiMode === "direct" },
  );
  await state.logger.log("stage_end", {
    turnIndex: state.turnIndex,
    stage: "cmp/dispatcher",
    status: "success",
    routeRationale: dispatcherResult.loop.bundle.governance.routeRationale ?? null,
    scopePolicy: dispatcherResult.loop.bundle.governance.scopePolicy ?? null,
  });

  const summary = state.runtime.getCmpFiveAgentRuntimeSummary(agentId);

  return {
    agentId,
    packageId,
    packageRef,
    projectionId,
    snapshotId,
    summary,
    intent: icmaResult.loop.structuredOutput.intent,
    operatorGuide: icmaResult.loop.structuredOutput.guide.operatorGuide,
    childGuide: icmaResult.loop.structuredOutput.guide.childGuide,
    checkerReason: checkerResult.checkerRecord.reviewOutput.shortReason,
    routeRationale: dispatcherResult.loop.bundle.governance.routeRationale ?? "missing",
    scopePolicy: dispatcherResult.loop.bundle.governance.scopePolicy ?? "missing",
    packageStrategy: dbagentResult.loop.materializationOutput.primaryPackageStrategy ?? "missing",
    timelineStrategy: dbagentResult.loop.materializationOutput.timelinePackageStrategy ?? "missing",
  };
}

async function executeCoreCapabilityRequest(
  state: LiveCliState,
  request: CoreCapabilityRequest,
): Promise<NonNullable<CoreTurnArtifacts["toolExecution"]>> {
  try {
    const intentId = randomUUID();
    const createdAt = new Date().toISOString();
    const capabilityIntent = {
      intentId,
      sessionId: state.sessionId,
      runId: `${state.sessionId}:cli-direct-capability:${state.turnIndex}`,
      kind: "capability_call" as const,
      createdAt,
      priority: "high" as const,
      correlationId: intentId,
      request: {
        requestId: randomUUID(),
        intentId,
        sessionId: state.sessionId,
        runId: `${state.sessionId}:cli-direct-capability:${state.turnIndex}`,
        capabilityKey: request.capabilityKey,
        input: request.input,
        priority: "high" as const,
        timeoutMs: request.timeoutMs ?? 20_000,
        metadata: {
          cliBridge: "core-action-envelope",
          cliUiMode: state.uiMode,
        },
      },
    };
    const plan = createInvocationPlanFromCapabilityIntent(capabilityIntent);
    const lease = await state.runtime.capabilityGateway.acquire(plan);
    const prepared = await state.runtime.capabilityGateway.prepare(lease, plan);

    return await new Promise(async (resolve, reject) => {
      const unsubscribe = state.runtime.capabilityGateway.onResult((result) => {
        if (result.metadata?.preparedId !== prepared.preparedId) {
          return;
        }
        unsubscribe();
        if (result.status !== "success" && result.status !== "partial") {
          resolve({
            capabilityKey: request.capabilityKey,
            status: result.status,
            error: result.error,
          });
          return;
        }
        resolve({
          capabilityKey: request.capabilityKey,
          status: result.status,
          output: result.output,
        });
      });

      try {
        await state.runtime.capabilityGateway.dispatch(prepared);
      } catch (error) {
        unsubscribe();
        reject(error);
      }
    });
  } catch (error) {
    return {
      capabilityKey: request.capabilityKey,
      status: "failed",
      error: {
        code: "cli_capability_bridge_failed",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

async function executeCoreCapabilityRequestFast(
  state: LiveCliState,
  request: CoreCapabilityRequest,
): Promise<NonNullable<CoreTurnArtifacts["toolExecution"]>> {
  const access = state.runtime.resolveTaCapabilityAccess({
    sessionId: state.sessionId,
    runId: `live-cli-capability:${state.turnIndex}`,
    agentId: `live-cli-core:${state.sessionId}`,
    capabilityKey: request.capabilityKey,
    reason: request.reason,
    requestedTier: request.requestedTier ?? "B0",
    mode: LIVE_CHAT_TAP_OVERRIDE.requestedMode,
    metadata: {
      tapUserOverride: LIVE_CHAT_TAP_OVERRIDE,
      cliBridge: "core-action-envelope",
      cliTurnIndex: state.turnIndex,
    },
  });
  const canBypassForBapr = LIVE_CHAT_TAP_OVERRIDE.requestedMode === "bapr"
    && access.status === "review_required";
  if (access.status !== "baseline_granted" && !canBypassForBapr) {
    return {
      capabilityKey: request.capabilityKey,
      status: access.status,
      error: access.request,
    };
  }

  const intentId = randomUUID();
  const createdAt = new Date().toISOString();
  const capabilityIntent = {
    intentId,
    sessionId: state.sessionId,
    runId: `live-cli-capability:${state.turnIndex}`,
    kind: "capability_call" as const,
    createdAt,
    priority: "high" as const,
    correlationId: intentId,
    request: {
      requestId: randomUUID(),
      intentId,
      sessionId: state.sessionId,
      runId: `live-cli-capability:${state.turnIndex}`,
      capabilityKey: request.capabilityKey,
      input: request.input,
      priority: "high" as const,
      timeoutMs: request.timeoutMs ?? 20_000,
      metadata: {
        cliBridge: "core-action-envelope",
      },
    },
  };
  const plan = createInvocationPlanFromCapabilityIntent(capabilityIntent);
  const lease = await state.runtime.capabilityGateway.acquire(plan);
  const prepared = await state.runtime.capabilityGateway.prepare(lease, plan);

  return await new Promise(async (resolve, reject) => {
    let handleExecutionId: string | undefined;
    const unsubscribe = state.runtime.capabilityPool.onResult((result) => {
      if (result.executionId !== handleExecutionId) {
        return;
      }
      unsubscribe();
      if (result.status !== "success" && result.status !== "partial") {
        resolve({
          capabilityKey: request.capabilityKey,
          status: result.status,
          error: result.error,
        });
        return;
      }
      resolve({
        capabilityKey: request.capabilityKey,
        status: result.status,
        output: result.output,
      });
    });

    try {
      const handle = await state.runtime.capabilityGateway.dispatch(prepared);
      handleExecutionId = handle.executionId;
    } catch (error) {
      unsubscribe();
      reject(error);
    }
  });
}

async function runCoreTurn(
  state: LiveCliState,
  userMessage: string,
  cmp: CmpTurnArtifacts | undefined,
  config: ReturnType<typeof loadOpenAILiveConfig>,
): Promise<CoreTurnArtifacts> {
  let actionEnvelope: CoreActionEnvelope | undefined;
  let rawAnswer = "";
  try {
    actionEnvelope = await runCoreActionPlanner(state, userMessage);
    rawAnswer = JSON.stringify(actionEnvelope);
  } catch {
    actionEnvelope = undefined;
  }
  if (!actionEnvelope) {
    const fallback = await runCoreModelPass({
      state,
      userInput: buildCoreUserInput({
        userMessage,
        transcript: state.transcript,
        cmp,
        runtime: state.runtime,
      }),
      cmp,
      config,
    });
    rawAnswer = fallback.answer;
    try {
      actionEnvelope = parseCoreActionEnvelope(rawAnswer);
    } catch {
      actionEnvelope = undefined;
    }
    if (actionEnvelope?.action === "reply") {
      return {
        runId: fallback.runId,
        answer: extractResponseTextMaybe(actionEnvelope.responseText),
        dispatchStatus: "reply_only",
        capabilityResultStatus: "success",
        plannerRawAnswer: rawAnswer,
        eventTypes: [
          ...fallback.eventTypes,
          "core.action_planner.reply",
        ],
      };
    }
    const tapRequest = parseTapRequest(rawAnswer);
    if (!tapRequest) {
      return {
        ...fallback,
        answer: extractResponseTextMaybe(rawAnswer),
        plannerRawAnswer: rawAnswer,
      };
    }
    actionEnvelope = {
      action: "capability_call",
      responseText: rawAnswer,
      capabilityRequest: {
        capabilityKey: tapRequest.capabilityKey,
        reason: `Core requested ${tapRequest.capabilityKey} from live CLI bridge.`,
        input: tapRequest.input,
        requestedTier: "B0",
        timeoutMs: readPositiveInteger(tapRequest.input.timeoutMs),
      },
    };
  }

  if (actionEnvelope?.action === "capability_call" && actionEnvelope.capabilityRequest) {
    const capabilityRequest = await applyCliDefaultsToCapabilityRequest(
      actionEnvelope.capabilityRequest,
      config,
      userMessage,
    );
    if (state.uiMode === "direct") {
      printDirectSub(`调用能力 ${capabilityRequest.capabilityKey}`);
    }
    await state.logger.log("stage_start", {
      turnIndex: state.turnIndex,
      stage: "core/capability_bridge",
      capabilityKey: capabilityRequest.capabilityKey,
      reason: capabilityRequest.reason,
    });
    const toolExecution = await executeCoreCapabilityRequest(
      state,
      capabilityRequest,
    );
    if (state.uiMode === "direct") {
      printDirectSub(`能力返回 ${toolExecution.status}`);
    }
    await state.logger.log("stage_end", {
      turnIndex: state.turnIndex,
      stage: "core/capability_bridge",
      status: toolExecution.status,
      capabilityKey: toolExecution.capabilityKey,
      output: toolExecution.output,
      error: toolExecution.error,
    });

    const toolResultText = toolExecution.error
      ? JSON.stringify({ error: toolExecution.error }, null, 2)
      : summarizeToolOutputForCore(capabilityRequest.capabilityKey, toolExecution.output ?? {});

    const followup = await runCoreModelPass({
      state,
      userInput: buildCoreUserInput({
        userMessage,
        transcript: state.transcript,
        cmp,
        runtime: state.runtime,
        toolResultText,
        forceFinalAnswer: true,
      }),
      cmp,
      config,
    });
    const followupAnswer = extractResponseTextMaybe(followup.answer?.trim() ?? "")
      || actionEnvelope.responseText
      || rawAnswer;
      return {
        runId: followup.runId,
        answer: followupAnswer,
        dispatchStatus: "capability_executed",
        capabilityKey: capabilityRequest.capabilityKey,
        capabilityResultStatus: toolExecution.status,
        plannerRawAnswer: rawAnswer,
        toolExecution,
      eventTypes: [
        ...followup.eventTypes,
        "core.action_planner.capability_call",
        "core.capability_bridge.executed",
      ],
    };
  }

  if (state.uiMode === "direct") {
    printDirectSub("直接回答，不调用额外能力");
  }

  return {
    runId: `${state.sessionId}:core-reply:${state.turnIndex}`,
    answer: extractResponseTextMaybe(actionEnvelope?.responseText ?? rawAnswer),
    dispatchStatus: "reply_only",
    capabilityResultStatus: "success",
    plannerRawAnswer: rawAnswer,
    eventTypes: ["core.action_planner.reply"],
  };
}

async function handleUserTurn(
  state: LiveCliState,
  userMessage: string,
  config: ReturnType<typeof loadOpenAILiveConfig>,
): Promise<void> {
  state.turnIndex += 1;
  await state.logger.log("turn_start", {
    turnIndex: state.turnIndex,
    userMessage,
    transcriptTail: state.transcript.slice(-6),
  });
  const backgroundCmpLabel = `[turn ${state.turnIndex}] CMP sidecar sync elapsed`;
  const previousCmp = state.latestCmp;
  const cmpStartedAt = Date.now();
  const coreStartedAt = Date.now();
  console.log("");
  console.log(state.uiMode === "direct"
    ? `You asked: ${truncate(userMessage, 96)}`
    : `[turn ${state.turnIndex}] core starts immediately; CMP sidecar runs in background.`);
  if (state.uiMode === "direct") {
    printDirectBullet(`Working · turn ${state.turnIndex}`);
    printDirectSub("core 前台开始处理");
    printDirectSub("CMP sidecar 后台启动，不阻塞当前回合");
  }
  state.pendingCmpSync = (async () => {
    const cmp = await withStopwatch(backgroundCmpLabel, () => runCmpTurn(state, userMessage), {
      quiet: state.uiMode === "direct",
    });
    state.latestCmp = cmp;
    state.lastTurn = state.lastTurn
      ? { ...state.lastTurn, cmp }
      : state.lastTurn;
    console.log(state.uiMode === "direct"
      ? `  ↳ CMP sidecar 已同步 (${formatElapsed(Date.now() - cmpStartedAt)})`
      : `[turn ${state.turnIndex}] CMP sidecar synced.`);
  })();

  const coreLabel = `[turn ${state.turnIndex}] TAP + core dispatch elapsed`;
  await state.logger.log("stage_start", {
    turnIndex: state.turnIndex,
    stage: "core/run",
  });
  if (state.uiMode === "direct") {
    printDirectSub("core 正在规划下一步");
  }
  const core = await withStopwatch(coreLabel, () => runCoreTurn(state, userMessage, previousCmp, config), {
    quiet: state.uiMode === "direct",
  });
  await state.logger.log("stage_end", {
    turnIndex: state.turnIndex,
    stage: "core/run",
    status: "success",
    runId: core.runId,
    dispatchStatus: core.dispatchStatus,
    capabilityKey: core.capabilityKey ?? null,
  });
  if (state.uiMode === "direct") {
    printDirectSub(`core 已完成 (${formatElapsed(Date.now() - coreStartedAt)})`);
  } else {
    console.log("[turn] Core completed.");
  }

  state.transcript.push({ role: "user", text: userMessage });
  state.transcript.push({ role: "assistant", text: core.answer });
  state.lastTurn = {
    cmp: state.latestCmp ?? previousCmp ?? {
      agentId: "cmp-sidecar-pending",
      packageId: "pending",
      packageRef: "pending",
      projectionId: "pending",
      snapshotId: "pending",
      summary: state.runtime.getCmpFiveAgentRuntimeSummary("cmp-live-cli-main"),
      intent: "pending",
      operatorGuide: "CMP sidecar is still preparing or no prior package is available.",
      childGuide: "pending",
      checkerReason: "pending",
      routeRationale: "pending",
      scopePolicy: "pending",
      packageStrategy: "pending",
      timelineStrategy: "pending",
    },
    core,
  };
  await state.logger.log("turn_result", {
    turnIndex: state.turnIndex,
    cmp: state.lastTurn.cmp,
    core,
    transcriptTail: state.transcript.slice(-8),
  });

  if (state.uiMode === "direct") {
    printDirectStatus(state);
    printDirectAnswer(core);
  } else {
    printCmpArtifacts(state.lastTurn.cmp);
    printTapArtifacts(state.runtime, state.sessionId, core.runId);
    printCoreArtifacts(core);
  }
}

function createRuntime(config: ReturnType<typeof loadOpenAILiveConfig>) {
  const reviewerRoute: Partial<TapAgentModelRoute> = {
    provider: "openai",
    model: LIVE_CHAT_MODEL_PLAN.tap.reviewer.model,
    layer: "api",
    variant: "responses",
    reasoningEffort: resolveReasoningEffort(LIVE_CHAT_MODEL_PLAN.tap.reviewer),
    maxOutputTokens: LIVE_CHAT_MODEL_PLAN.tap.reviewer.maxOutputTokens,
  };
  const toolReviewerRoute: Partial<TapAgentModelRoute> = {
    provider: "openai",
    model: LIVE_CHAT_MODEL_PLAN.tap.toolReviewer.model,
    layer: "api",
    variant: "responses",
    reasoningEffort: resolveReasoningEffort(LIVE_CHAT_MODEL_PLAN.tap.toolReviewer),
    maxOutputTokens: LIVE_CHAT_MODEL_PLAN.tap.toolReviewer.maxOutputTokens,
  };
  const provisionerRoute: Partial<TapAgentModelRoute> = {
    provider: "openai",
    model: LIVE_CHAT_MODEL_PLAN.tap.provisioner.model,
    layer: "api",
    variant: "responses",
    reasoningEffort: resolveReasoningEffort(LIVE_CHAT_MODEL_PLAN.tap.provisioner),
    maxOutputTokens: LIVE_CHAT_MODEL_PLAN.tap.provisioner.maxOutputTokens,
  };

  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.live-cli.main",
      agentClass: "main-agent",
      baselineCapabilities: [
        "model.infer",
        "code.read",
        "docs.read",
        "repo.write",
        "shell.restricted",
        "test.run",
        "skill.doc.generate",
        "search.ground",
        "skill.use",
        "skill.mount",
        "skill.prepare",
        "mcp.listTools",
        "mcp.readResource",
        "mcp.call",
        "mcp.native.execute",
      ],
      allowedCapabilityPatterns: ["*"],
      defaultMode: "bapr",
    }),
    modelInferenceExecutor: executeCliModelInference,
    tapAgentModelRoutes: {
      reviewer: reviewerRoute,
      toolReviewer: toolReviewerRoute,
      provisioner: provisionerRoute,
    },
    cmpFiveAgentRuntime: createCmpFiveAgentRuntime({
      live: {
      modes: {
        icma: "llm_assisted",
        iterator: "llm_assisted",
        checker: "llm_assisted",
        dbagent: "llm_assisted",
        dispatcher: "llm_assisted",
      },
      executors: {
        icma: createCmpRoleLiveLlmModelExecutor({
          provider: "openai",
          model: LIVE_CHAT_MODEL_PLAN.cmp.icma.model,
          layer: "api",
          variant: "responses",
          reasoningEffort: resolveReasoningEffort(LIVE_CHAT_MODEL_PLAN.cmp.icma),
          maxOutputTokens: LIVE_CHAT_MODEL_PLAN.cmp.icma.maxOutputTokens,
          executor: executeCliModelInference,
        }),
        iterator: createCmpRoleLiveLlmModelExecutor({
          provider: "openai",
          model: LIVE_CHAT_MODEL_PLAN.cmp.iterator.model,
          layer: "api",
          variant: "responses",
          reasoningEffort: resolveReasoningEffort(LIVE_CHAT_MODEL_PLAN.cmp.iterator),
          maxOutputTokens: LIVE_CHAT_MODEL_PLAN.cmp.iterator.maxOutputTokens,
          executor: executeCliModelInference,
        }),
        checker: createCmpRoleLiveLlmModelExecutor({
          provider: "openai",
          model: LIVE_CHAT_MODEL_PLAN.cmp.checker.model,
          layer: "api",
          variant: "responses",
          reasoningEffort: resolveReasoningEffort(LIVE_CHAT_MODEL_PLAN.cmp.checker),
          maxOutputTokens: LIVE_CHAT_MODEL_PLAN.cmp.checker.maxOutputTokens,
          executor: executeCliModelInference,
        }),
        dbagent: createCmpRoleLiveLlmModelExecutor({
          provider: "openai",
          model: LIVE_CHAT_MODEL_PLAN.cmp.dbagent.model,
          layer: "api",
          variant: "responses",
          reasoningEffort: resolveReasoningEffort(LIVE_CHAT_MODEL_PLAN.cmp.dbagent),
          maxOutputTokens: LIVE_CHAT_MODEL_PLAN.cmp.dbagent.maxOutputTokens,
          executor: executeCliModelInference,
        }),
        dispatcher: createCmpRoleLiveLlmModelExecutor({
          provider: "openai",
          model: LIVE_CHAT_MODEL_PLAN.cmp.dispatcher.model,
          layer: "api",
          variant: "responses",
          reasoningEffort: resolveReasoningEffort(LIVE_CHAT_MODEL_PLAN.cmp.dispatcher),
          maxOutputTokens: LIVE_CHAT_MODEL_PLAN.cmp.dispatcher.maxOutputTokens,
          executor: executeCliModelInference,
        }),
      },
      },
    }),
  });

  registerTapCapabilityFamilyAssembly({
    runtime,
    foundation: {
      workspaceRoot: process.cwd(),
    },
    includeFamilies: {
      foundation: true,
      websearch: true,
      skill: true,
      mcp: true,
    },
  });

  return runtime;
}

function printHistory(state: LiveCliState, historyTurns: number): void {
  printDivider("Dialogue History");
  console.log(formatTranscript(state.transcript.slice(-historyTurns)));
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  CURRENT_UI_MODE = options.uiMode;
  const config = loadOpenAILiveConfig();
  const logPath = createLiveChatLogPath();
  await mkdir(resolve(process.cwd(), "memory/live-reports"), { recursive: true });
  const logger = new LiveChatLogger(logPath);
  const runtime = createRuntime(config);
  const session = runtime.createSession({
    metadata: {
      harness: "praxis-live-cli",
    },
  });
  const state: LiveCliState = {
    runtime,
    sessionId: session.sessionId,
    transcript: [],
    uiMode: options.uiMode,
    logger,
    turnIndex: 0,
  };

  if (options.uiMode === "direct") {
    printStartupDirect(config);
  } else {
    printStartup(config);
  }
  console.log(`log file: ${logPath}`);
  await logger.log("session_start", {
    sessionId: state.sessionId,
    logPath,
    route: config.baseURL,
    modelPlan: LIVE_CHAT_MODEL_PLAN,
  });

  try {
    if (options.once) {
      await handleUserTurn(state, options.once, config);
      await state.pendingCmpSync;
      return;
    }

    const readline = options.uiMode === "direct"
      ? undefined
      : createInterface({
          input,
          output,
          terminal: true,
        });

    try {
      while (true) {
        const raw = options.uiMode === "direct"
          ? await promptDirectInputBox()
          : await readline!.question("\nYou> ");
        if (raw === null) {
          break;
        }
        const line = raw.trim();

        if (!line) {
          continue;
        }

        if (line === "/exit" || line === "/quit") {
          break;
        }
        if (line === "/help") {
          printHelp();
          continue;
        }
        if (line === "/status") {
          printStatus(state);
          continue;
        }
        if (line === "/capabilities") {
          printDirectCapabilities(state.runtime);
          continue;
        }
        if (line === "/cmp") {
          if (!state.lastTurn) {
            console.log("还没有 CMP 结果。");
            continue;
          }
          printCmpArtifacts(state.lastTurn.cmp);
          continue;
        }
        if (line === "/tap") {
          printTapArtifacts(state.runtime, state.sessionId, state.lastTurn?.core.runId);
          continue;
        }
        if (line === "/events") {
          printEvents(state);
          continue;
        }
        if (line === "/history") {
          printHistory(state, options.historyTurns);
          continue;
        }

        await handleUserTurn(state, line, config);
      }
    } finally {
      readline?.close();
    }
  } finally {
    await logger.log("session_end", {
      sessionId: state.sessionId,
      turnCount: state.turnIndex,
    });
    await logger.flush();
  }
}

await main();
