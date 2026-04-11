import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";

import type {
  ModelInferenceExecutionParams,
} from "../integrations/model-inference.js";
import type { TapAgentModelRoute } from "../integrations/tap-agent-model.js";
import type { createAgentCoreRuntime } from "../index.js";
import {
  loadLiveProviderConfig,
  loadOpenAILiveConfig,
} from "../../rax/live-config.js";

export type DialogueRole = "user" | "assistant";

export interface DialogueTurn {
  role: DialogueRole;
  text: string;
}

export interface CliOptions {
  once?: string;
  historyTurns: number;
  uiMode: "full" | "direct";
}

export type LiveCliRuntime = ReturnType<typeof createAgentCoreRuntime>;
export type OpenAILiveConfig = ReturnType<typeof loadOpenAILiveConfig>;
export type CmpRuntimeSummary = ReturnType<LiveCliRuntime["getCmpFiveAgentRuntimeSummary"]>;

export interface CmpTurnArtifacts {
  agentId: string;
  packageId: string;
  packageRef: string;
  projectionId: string;
  snapshotId: string;
  summary: CmpRuntimeSummary;
  intent: string;
  operatorGuide: string;
  childGuide: string;
  checkerReason: string;
  routeRationale: string;
  scopePolicy: string;
  packageStrategy: string;
  timelineStrategy: string;
}

export interface CoreTurnArtifacts {
  runId: string;
  answer: string;
  dispatchStatus: string;
  taskStatus?: CoreTaskStatus;
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

export interface ParsedTapRequest {
  capabilityKey: string;
  input: Record<string, unknown>;
  rawCommand?: string;
}

export interface SpreadsheetReadFactSummary {
  path?: string;
  format?: string;
  sheetCount?: number;
  returnedSheetCount?: number;
  selectedSheet?: string;
  truncated?: boolean;
  sheetNames: string[];
  firstSheet?: {
    name?: string;
    rowCount?: number;
    returnedRowCount?: number;
    omittedRowCount?: number;
    columnCount?: number;
    headers: string[];
    rows: string[][];
    truncated?: boolean;
  };
}

interface DocReadFactSummary {
  path?: string;
  format?: string;
  paragraphCount?: number;
  returnedParagraphCount?: number;
  omittedParagraphCount?: number;
  tableCount?: number;
  truncated?: boolean;
  paragraphs: string[];
  contentExcerpt?: string;
  firstTable?: {
    rowCount?: number;
    returnedRowCount?: number;
    omittedRowCount?: number;
    columnCount?: number;
    rows: string[][];
    truncated?: boolean;
  };
}

export function buildDocReadCompletionAnswer(summary: DocReadFactSummary | undefined): string | undefined {
  if (!summary) {
    return undefined;
  }
  const lines = [
    "已完成文档回读核验。",
    summary.path ? `- path: ${summary.path}` : undefined,
    summary.format ? `- format: ${summary.format}` : undefined,
    summary.paragraphCount !== undefined ? `- paragraphCount: ${summary.paragraphCount}` : undefined,
    summary.tableCount !== undefined ? `- tableCount: ${summary.tableCount}` : undefined,
  ].filter((line): line is string => Boolean(line));

  const paragraphLines = summary.paragraphs.slice(0, 3).map((paragraph, index) =>
    `- 第${index + 1}段: ${paragraph}`);
  if (paragraphLines.length > 0) {
    lines.push(...paragraphLines);
  } else if (summary.contentExcerpt) {
    lines.push(`- 内容摘要: ${summary.contentExcerpt}`);
  }

  if (summary.firstTable?.rows?.length) {
    lines.push("- 首表前几行:");
    lines.push(
      ...summary.firstTable.rows.slice(0, 2).map((row, index) =>
        `  - 第${index + 1}行: ${row.join(", ")}`),
    );
  }

  if ((summary.omittedParagraphCount ?? 0) > 0 || summary.truncated) {
    lines.push(`- 还有 ${summary.omittedParagraphCount ?? 0} 段未展开，这次返回是采样结果。`);
  }

  return lines.join("\n");
}

export interface TurnArtifacts {
  cmp: CmpTurnArtifacts;
  core: CoreTurnArtifacts;
}

export interface LiveCliState {
  runtime: LiveCliRuntime;
  sessionId: string;
  transcript: DialogueTurn[];
  turnIndex: number;
  uiMode: "full" | "direct";
  logger: LiveChatLogger;
  latestCmp?: CmpTurnArtifacts;
  pendingCmpSync?: Promise<void>;
  lastTurn?: TurnArtifacts;
}

export interface DirectFallbackReader {
  readline: {
    close(): void;
  };
  iterator: AsyncIterator<string>;
}

export type LiveChatLogEvent =
  | "session_start"
  | "session_end"
  | "turn_start"
  | "turn_result"
  | "stage_start"
  | "stage_end"
  | "stream_start"
  | "stream_end"
  | "stream_text";

export type AgentReasoningEffort = "low" | "medium" | "high" | "none";

export interface AgentRoutePlan {
  model: string;
  reasoning: AgentReasoningEffort;
  maxOutputTokens?: number;
}

export const LIVE_CHAT_TAP_OVERRIDE = {
  requestedMode: "bapr",
  automationDepth: "prefer_auto",
  explanationStyle: "plain_language",
} as const;

export class LiveChatLogger {
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

export interface CoreCapabilityRequest {
  capabilityKey: string;
  reason: string;
  input: Record<string, unknown>;
  requestedTier?: "B0" | "B1" | "B2" | "B3";
  timeoutMs?: number;
}

export interface CoreActionEnvelope {
  action: "reply" | "capability_call";
  responseText: string;
  taskStatus?: CoreTaskStatus;
  capabilityRequest?: CoreCapabilityRequest;
}

export type CoreTaskStatus = "completed" | "incomplete" | "blocked" | "exhausted";

export function normalizeCoreTaskStatus(envelope: Pick<CoreActionEnvelope, "action" | "taskStatus">): CoreTaskStatus {
  if (envelope.taskStatus === "completed"
    || envelope.taskStatus === "incomplete"
    || envelope.taskStatus === "blocked"
    || envelope.taskStatus === "exhausted") {
    return envelope.taskStatus;
  }
  return envelope.action === "capability_call" ? "incomplete" : "completed";
}

export function shouldStopCoreCapabilityLoop(params: {
  capabilityResultStatus?: string;
  completedLoops: number;
  maxLoops: number;
}): boolean {
  if (params.completedLoops >= params.maxLoops) {
    return true;
  }
  const status = (params.capabilityResultStatus ?? "").trim().toLowerCase();
  return status === "blocked"
    || status === "review_required"
    || status === "waiting_human"
    || status === "waiting_human_approval"
    || status === "baseline_missing";
}

export const LIVE_CHAT_MODEL_PLAN = {
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

export function readArgValue(argv: string[], name: string): string | undefined {
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

export function parseCliOptions(argv: string[]): CliOptions {
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

export function truncate(value: string, max = 240): string {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, max - 1)}…`;
}

export function excerptText(
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

function maybeExcerptText(
  value: string,
  max: number,
  preserveBody = false,
): string {
  return preserveBody ? value : excerptText(value, max).text;
}

function summarizeDataUrl(value: string): {
  kind: "data_url";
  mimeType: string;
  originalChars: number;
} {
  const mimeType = value.match(/^data:([^;,]+)/u)?.[1] ?? "application/octet-stream";
  return {
    kind: "data_url",
    mimeType,
    originalChars: value.length,
  };
}

export function trimStructuredValue(value: unknown, budget = 8_000): unknown {
  if (typeof value === "string") {
    if (value.startsWith("data:")) {
      return summarizeDataUrl(value);
    }
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
    const items = value
      .slice(0, limit)
      .map((entry) => trimStructuredValue(entry, Math.max(600, Math.floor(budget / Math.max(1, limit)))));
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

export function summarizeToolOutputForCore(
  capabilityKey: string,
  output: unknown,
  options: {
    preserveBody?: boolean;
  } = {},
): string {
  const preserveBody = options.preserveBody === true;
  const normalized = output && typeof output === "object"
    ? output as Record<string, unknown>
    : undefined;

  if (capabilityKey === "shell.restricted" || capabilityKey === "test.run" || capabilityKey === "shell.session") {
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
      stdoutExcerpt: preserveBody ? stdout : stdoutExcerpt.text,
      stdoutTruncated: stdoutExcerpt.truncated,
      stderrExcerpt: preserveBody ? stderr : stderrExcerpt.text,
      stderrTruncated: stderrExcerpt.truncated,
    }, null, 2);
  }

  if (capabilityKey === "search.ground" || capabilityKey === "search.web") {
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
        ? maybeExcerptText(normalized.answer, 5_000, preserveBody)
        : undefined,
      sourceCount: Array.isArray(normalized?.sources) ? normalized.sources.length : 0,
      citationCount: Array.isArray(normalized?.citations) ? normalized.citations.length : 0,
      sources: trimStructuredValue(sources, 3_500),
      citations: trimStructuredValue(citations, 2_500),
      evidence: trimStructuredValue(normalized?.evidence, 3_500),
    }, null, 2);
  }

  if (capabilityKey === "search.fetch") {
    const pages = Array.isArray(normalized?.pages)
      ? normalized.pages.slice(0, 3)
      : [];
    return JSON.stringify({
      capabilityKey,
      prompt: typeof normalized?.prompt === "string"
        ? excerptText(normalized.prompt, 600).text
        : undefined,
      urlCount: normalized?.urlCount,
      selectedBackend: normalized?.selectedBackend,
      resolvedBackend: normalized?.resolvedBackend,
      fallbackApplied: normalized?.fallbackApplied,
      fallbackReasonCode: normalized?.fallbackReasonCode,
      fallbackReasonPhase: normalized?.fallbackReasonPhase,
      fallbackReasonClass: normalized?.fallbackReasonClass,
      pages: pages.map((page) => {
        const record = page && typeof page === "object"
          ? page as Record<string, unknown>
          : undefined;
        return {
          url: record?.url,
          finalUrl: record?.finalUrl,
          status: record?.status,
          transport: record?.transport,
          backend: record?.backend,
          fallbackApplied: record?.fallbackApplied,
          errorCode: record?.errorCode,
          networkPhase: record?.networkPhase,
          failureClass: record?.failureClass,
          redirectTarget: record?.redirectTarget,
          content: typeof record?.content === "string"
            ? maybeExcerptText(record.content, 1_000, preserveBody)
            : undefined,
        };
      }),
    }, null, 2);
  }

  if (capabilityKey === "git.status" || capabilityKey === "git.diff" || capabilityKey === "git.commit" || capabilityKey === "git.push" || capabilityKey === "code.diff") {
    return JSON.stringify({
      capabilityKey,
      cwd: typeof normalized?.cwd === "string" ? normalized.cwd : undefined,
      branch: normalized?.branch,
      clean: normalized?.clean,
      commitHash: normalized?.commitHash,
      message: normalized?.message,
      changedFiles: trimStructuredValue(normalized?.changedFiles, 2_000),
      committedFiles: trimStructuredValue(normalized?.committedFiles, 2_000),
      entries: trimStructuredValue(normalized?.entries, 2_000),
      diff: typeof normalized?.diff === "string"
        ? maybeExcerptText(normalized.diff, 6_000, preserveBody)
        : typeof normalized?.raw === "string"
          ? maybeExcerptText(normalized.raw, 6_000, preserveBody)
          : undefined,
    }, null, 2);
  }

  if (capabilityKey === "code.symbol_search" || capabilityKey === "code.lsp") {
    return JSON.stringify({
      capabilityKey,
      operation: normalized?.operation,
      path: normalized?.path,
      query: normalized?.query,
      backend: normalized?.backend,
      resultCount: normalized?.resultCount,
      matches: trimStructuredValue(normalized?.matches, 2_500),
      symbols: trimStructuredValue(normalized?.symbols, 2_500),
      definitions: trimStructuredValue(normalized?.definitions, 2_500),
      references: trimStructuredValue(normalized?.references, 2_500),
      hoverText: typeof normalized?.hoverText === "string"
        ? maybeExcerptText(normalized.hoverText, 2_000, preserveBody)
        : undefined,
    }, null, 2);
  }

  if (capabilityKey === "spreadsheet.read") {
    const summary = extractSpreadsheetReadFactSummary(output);
    return JSON.stringify({
      capabilityKey,
      ...summary,
    }, null, 2);
  }

  if (capabilityKey === "doc.read") {
    const summary = extractDocReadFactSummary(output);
    return JSON.stringify({
      capabilityKey,
      ...summary,
    }, null, 2);
  }

  if (capabilityKey === "read_pdf" || capabilityKey === "read_notebook") {
    return JSON.stringify({
      capabilityKey,
      path: normalized?.path,
      pageCount: normalized?.pageCount,
      cellCount: normalized?.cellCount,
      returnedCellCount: normalized?.returnedCellCount,
      language: normalized?.language,
      content: typeof normalized?.content === "string"
        ? maybeExcerptText(normalized.content, 3_500, preserveBody)
        : undefined,
      cells: trimStructuredValue(normalized?.cells, 3_500),
    }, null, 2);
  }

  if (capabilityKey === "view_image") {
    return JSON.stringify({
      capabilityKey,
      path: normalized?.path,
      mimeType: normalized?.mimeType,
      byteLength: normalized?.byteLength,
      detail: normalized?.detail,
    }, null, 2);
  }

  if (capabilityKey === "browser.playwright") {
    return JSON.stringify({
      capabilityKey,
      action: normalized?.action,
      toolName: normalized?.toolName,
      connectionId: normalized?.connectionId,
      selectedBackend: normalized?.selectedBackend,
      resolvedBackend: normalized?.resolvedBackend,
      browser: normalized?.browser,
      headless: normalized?.headless,
      pageUrl: normalized?.pageUrl,
      pageTitle: normalized?.pageTitle,
      snapshotCaptured: normalized?.snapshotCaptured,
      interstitialRecovered: normalized?.interstitialRecovered,
      launchEvidence: trimStructuredValue(normalized?.launchEvidence, 2_000),
      text: typeof normalized?.text === "string"
        ? maybeExcerptText(normalized.text, 3_500, preserveBody)
        : undefined,
      imageCount: normalized?.imageCount,
      tools: trimStructuredValue(normalized?.tools, 2_500),
    }, null, 2);
  }

  if (capabilityKey === "write_todos") {
    return JSON.stringify({
      capabilityKey,
      count: normalized?.count,
      todos: trimStructuredValue(normalized?.todos, 3_000),
    }, null, 2);
  }

  if (capabilityKey === "remote.exec") {
    return JSON.stringify({
      capabilityKey,
      host: normalized?.host,
      user: normalized?.user,
      port: normalized?.port,
      command: normalized?.command,
      args: trimStructuredValue(normalized?.args, 1_000),
      cwd: normalized?.cwd,
      stdout: typeof normalized?.stdout === "string"
        ? maybeExcerptText(normalized.stdout, 3_000, preserveBody)
        : undefined,
      stderr: typeof normalized?.stderr === "string"
        ? maybeExcerptText(normalized.stderr, 2_000, preserveBody)
        : undefined,
      exitCode: normalized?.exitCode,
    }, null, 2);
  }

  if (capabilityKey === "tracker.create") {
    return JSON.stringify({
      capabilityKey,
      trackerId: normalized?.trackerId,
      path: normalized?.path,
      title: normalized?.title,
      kind: normalized?.kind,
      statusValue: normalized?.statusValue,
      labels: trimStructuredValue(normalized?.labels, 1_000),
    }, null, 2);
  }

  return JSON.stringify({
    capabilityKey,
    output: trimStructuredValue(output, 8_000),
  }, null, 2);
}

function normalizeSpreadsheetCell(value: unknown): string {
  if (value == null) {
    return "";
  }
  return typeof value === "string"
    ? value
    : typeof value === "number" || typeof value === "boolean"
      ? String(value)
      : JSON.stringify(value);
}

function normalizeSpreadsheetRow(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((cell) => normalizeSpreadsheetCell(cell))
    : [];
}

export function extractSpreadsheetReadFactSummary(output: unknown): SpreadsheetReadFactSummary | undefined {
  if (!output || typeof output !== "object") {
    return undefined;
  }
  const normalized = output as Record<string, unknown>;
  const rawSheets = Array.isArray(normalized.sheets) ? normalized.sheets : [];
  const sheetNames = rawSheets
    .map((entry) =>
      entry && typeof entry === "object"
        ? readString((entry as Record<string, unknown>).name)
        : undefined)
    .filter((entry): entry is string => Boolean(entry));
  const firstSheetRaw = rawSheets[0] && typeof rawSheets[0] === "object"
    ? rawSheets[0] as Record<string, unknown>
    : undefined;

  return {
    path: readString(normalized.path),
    format: readString(normalized.format),
    sheetCount: readPositiveInteger(normalized.sheetCount),
    returnedSheetCount: readPositiveInteger(normalized.returnedSheetCount),
    selectedSheet: readString(normalized.sheet),
    truncated: normalized.truncated === true,
    sheetNames,
    firstSheet: firstSheetRaw
      ? {
        name: readString(firstSheetRaw.name),
        rowCount: readPositiveInteger(firstSheetRaw.rowCount),
        returnedRowCount: readPositiveInteger(firstSheetRaw.returnedRowCount),
        omittedRowCount: readPositiveInteger(firstSheetRaw.omittedRowCount),
        columnCount: readPositiveInteger(firstSheetRaw.columnCount),
        headers: normalizeSpreadsheetRow(firstSheetRaw.headers),
        rows: Array.isArray(firstSheetRaw.rows)
          ? firstSheetRaw.rows
            .map((entry) => normalizeSpreadsheetRow(entry))
            .filter((entry) => entry.length > 0)
          : [],
        truncated: firstSheetRaw.truncated === true,
      }
      : undefined,
  };
}

export function buildSpreadsheetReadCompletionAnswer(summary: SpreadsheetReadFactSummary | undefined): string | undefined {
  if (!summary) {
    return undefined;
  }
  const lines = [
    "已完成回读核验。",
    summary.path ? `- path: ${summary.path}` : undefined,
    summary.format ? `- format: ${summary.format}` : undefined,
    summary.sheetCount !== undefined ? `- sheetCount: ${summary.sheetCount}` : undefined,
    summary.firstSheet?.name ? `- 第一张表名称: ${summary.firstSheet.name}` : undefined,
    summary.firstSheet?.headers?.length
      ? `- 表头: ${summary.firstSheet.headers.join(", ")}`
      : undefined,
  ].filter((line): line is string => Boolean(line));

  const rowLines = summary.firstSheet?.rows?.slice(0, 2).map((row, index) =>
    `- 第${index + 1}行: ${row.join(", ")}`) ?? [];

  if (rowLines.length > 0) {
    lines.push(...rowLines);
  }

  if (summary.firstSheet && rowLines.length === 0) {
    lines.push("- 当前回读里还没有拿到可见行数据。");
  }

  if ((summary.firstSheet?.omittedRowCount ?? 0) > 0 || summary.firstSheet?.truncated || summary.truncated) {
    lines.push(`- 还有 ${summary.firstSheet?.omittedRowCount ?? 0} 行未展开，这次返回是采样结果。`);
  }

  return lines.join("\n");
}

export function extractDocReadFactSummary(output: unknown): DocReadFactSummary | undefined {
  if (!output || typeof output !== "object") {
    return undefined;
  }

  const normalized = output as Record<string, unknown>;
  const rawTables = Array.isArray(normalized.tables) ? normalized.tables : [];
  const firstTableRaw = rawTables[0] && typeof rawTables[0] === "object"
    ? rawTables[0] as Record<string, unknown>
    : undefined;

  return {
    path: readString(normalized.path),
    format: readString(normalized.format),
    paragraphCount: readPositiveInteger(normalized.paragraphCount),
    returnedParagraphCount: readPositiveInteger(normalized.returnedParagraphCount),
    omittedParagraphCount: readPositiveInteger(normalized.omittedParagraphCount),
    tableCount: readPositiveInteger(normalized.tableCount),
    truncated: normalized.truncated === true,
    paragraphs: Array.isArray(normalized.paragraphs)
      ? normalized.paragraphs
        .map((entry) => readString(entry))
        .filter((entry): entry is string => Boolean(entry))
        .slice(0, 3)
      : [],
    contentExcerpt: typeof normalized.content === "string"
      ? excerptText(normalized.content, 1_200).text
      : undefined,
    firstTable: firstTableRaw
      ? {
        rowCount: readPositiveInteger(firstTableRaw.rowCount),
        returnedRowCount: readPositiveInteger(firstTableRaw.returnedRowCount),
        omittedRowCount: readPositiveInteger(firstTableRaw.omittedRowCount),
        columnCount: readPositiveInteger(firstTableRaw.columnCount),
        rows: Array.isArray(firstTableRaw.rows)
          ? firstTableRaw.rows
            .map((entry) => normalizeSpreadsheetRow(entry))
            .filter((entry) => entry.length > 0)
            .slice(0, 3)
          : [],
        truncated: firstTableRaw.truncated === true,
      }
      : undefined,
  };
}

export function resolveCliSearchGroundDefaults(): {
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

export function resolveCliDefaultCarrierRoute(
  config: OpenAILiveConfig,
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

export async function applyCliDefaultsToCapabilityRequest(
  request: CoreCapabilityRequest,
  config: OpenAILiveConfig,
  userMessage: string,
  previousBrowserSession?: {
    headless?: boolean;
    browser?: string;
    isolated?: boolean;
  },
): Promise<CoreCapabilityRequest> {
  if (request.capabilityKey !== "search.ground" && request.capabilityKey !== "search.web") {
    if (request.capabilityKey === "browser.playwright") {
      const rewrittenRequest = rewriteBrowserPlaywrightRequest(request, userMessage);
      const preferredHeadless = inferBrowserHeadlessPreference(userMessage);
      const explicitHeadless = typeof rewrittenRequest.input.headless === "boolean"
        ? rewrittenRequest.input.headless
        : undefined;
      const resolvedHeadless = explicitHeadless
        ?? previousBrowserSession?.headless
        ?? preferredHeadless
        ?? false;
      const resolvedBrowser = typeof rewrittenRequest.input.browser === "string"
        ? rewrittenRequest.input.browser
        : previousBrowserSession?.browser;
      const resolvedIsolated = typeof rewrittenRequest.input.isolated === "boolean"
        ? rewrittenRequest.input.isolated
        : previousBrowserSession?.isolated;
      return {
        ...rewrittenRequest,
        input: {
          ...rewrittenRequest.input,
          headless: resolvedHeadless,
          ...(resolvedBrowser ? { browser: resolvedBrowser } : {}),
          ...(resolvedIsolated !== undefined ? { isolated: resolvedIsolated } : {}),
        },
      };
    }
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
      || request.capabilityKey === "mcp.listResources"
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
      return {
        ...request,
        input: {
          ...request.input,
          route: mergedRoute,
          input: normalizedInput,
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
  const citations = request.capabilityKey === "search.ground"
    ? "required"
    : "preferred";

  return {
    ...request,
    requestedTier: request.requestedTier ?? "B1",
    timeoutMs: request.timeoutMs ?? 60_000,
    input: {
      provider: fallbackRoute.provider,
      model: fallbackRoute.model,
      layer: fallbackRoute.layer,
      citations,
      freshness: "day",
      searchContextSize: "medium",
      maxSources: 6,
      maxOutputTokens: 12_000,
      ...request.input,
      query,
    },
  };
}

export function formatTranscript(turns: DialogueTurn[]): string {
  if (turns.length === 0) {
    return "(none)";
  }
  return turns
    .map((turn, index) => `${index + 1}. ${turn.role === "user" ? "User" : "Assistant"}: ${truncate(turn.text, 280)}`)
    .join("\n");
}

export function formatLiveStatus(status: CmpTurnArtifacts["summary"]["live"][keyof CmpTurnArtifacts["summary"]["live"]]): string {
  return `${status.status}/${status.mode}${status.fallbackApplied ? " (fallback)" : ""}`;
}

export function formatDisplayValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

export function extractTextFromResponseLike(raw: unknown): string {
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

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export async function withStopwatch<T>(
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

export function formatRoutePlan(name: string, plan: AgentRoutePlan): string {
  return `${name}: ${plan.model} / ${plan.reasoning}${plan.maxOutputTokens ? ` / maxOut=${plan.maxOutputTokens}` : ""}`;
}

export function extractFirstJsonObject(source: string): string {
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

export function parseCoreActionEnvelope(text: string): CoreActionEnvelope {
  const parsed = JSON.parse(extractFirstJsonObject(text)) as Record<string, unknown>;
  const capabilityRequest = parsed.capabilityRequest;
  const legacyCompleted = typeof parsed.completed === "boolean" ? parsed.completed : undefined;
  const action = parsed.action === "reply" || parsed.action === "capability_call"
    ? parsed.action
    : capabilityRequest && typeof capabilityRequest === "object"
      ? "capability_call"
      : "reply";
  const responseText = parsed.responseText;
  if (typeof responseText !== "string") {
    throw new Error("Core action envelope requires action and responseText.");
  }
  const taskStatus = parsed.taskStatus ?? (
    legacyCompleted === true
      ? "completed"
      : legacyCompleted === false
        ? "incomplete"
        : undefined
  );
  if (
    taskStatus !== undefined
    && taskStatus !== "completed"
    && taskStatus !== "incomplete"
    && taskStatus !== "blocked"
    && taskStatus !== "exhausted"
  ) {
    throw new Error("Core action envelope taskStatus must be completed, incomplete, blocked, or exhausted.");
  }
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
      taskStatus,
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
    taskStatus,
  };
}

export function unwrapResponseTextIfJson(text: string): string {
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

export function stripCodeFences(value: string): string {
  return value.replace(/```[a-zA-Z0-9_-]*\n?/gu, "").replace(/```/gu, "").trim();
}

export function resolveReasoningEffort(
  plan: AgentRoutePlan,
): "low" | "medium" | "high" | undefined {
  return plan.reasoning === "none" ? undefined : plan.reasoning;
}

export function readPositiveInteger(value: unknown): number | undefined {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : undefined;
}

export function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
  return normalized.length > 0 ? normalized : undefined;
}

export function summarizeForLog(value: string, max = 180): string {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, max - 1)}…`;
}

export function summarizeCapabilityRequestForLog(request: CoreCapabilityRequest): string {
  const input = request.input;
  if (request.capabilityKey === "shell.session") {
    const action = readString(input.action) ?? "start";
    const sessionId = readString(input.sessionId) ?? readString(input.session_id);
    if (action !== "start") {
      return summarizeForLog(`${action}${sessionId ? ` ${sessionId}` : ""}`);
    }
    const commandArray = readStringArray(input.command);
    const command = commandArray?.[0] ?? readString(input.command) ?? "(missing command)";
    const args = [
      ...(commandArray?.slice(1) ?? []),
      ...(readStringArray(input.args) ?? []),
    ];
    const cwd = readString(input.cwd) ?? readString(input.workdir) ?? readString(input.dir_path) ?? ".";
    return summarizeForLog(`${command}${args.length > 0 ? ` ${args.join(" ")}` : ""} @ ${cwd}`);
  }

  if (request.capabilityKey === "shell.restricted" || request.capabilityKey === "test.run") {
    const commandArray = readStringArray(input.command);
    const command = commandArray?.[0] ?? readString(input.command) ?? "(missing command)";
    const args = [
      ...(commandArray?.slice(1) ?? []),
      ...(readStringArray(input.args) ?? []),
    ];
    const cwd = readString(input.cwd) ?? readString(input.workdir) ?? readString(input.dir_path) ?? ".";
    return summarizeForLog(`${command}${args.length > 0 ? ` ${args.join(" ")}` : ""} @ ${cwd}`);
  }

  if (request.capabilityKey === "search.ground" || request.capabilityKey === "search.web") {
    return summarizeForLog(
      readString(input.query)
      ?? readString(input.question)
      ?? readString(input.prompt)
      ?? request.reason,
    );
  }

  if (request.capabilityKey === "search.fetch") {
    const urls = Array.isArray(input.urls)
      ? input.urls.filter((entry): entry is string => typeof entry === "string").join(", ")
      : undefined;
    return summarizeForLog(
      readString(input.url)
      ?? urls
      ?? readString(input.prompt)
      ?? request.reason,
    );
  }

  if (request.capabilityKey === "browser.playwright") {
    const summary = readString(input.url)
      ?? readString(input.action)
      ?? readString(input.toolName)
      ?? request.reason;
    const headless = typeof input.headless === "boolean"
      ? (input.headless ? "headless" : "headed")
      : "headless:auto";
    return summarizeForLog(`${summary} [requested:${headless}]`);
  }

  if (
    request.capabilityKey === "code.read"
    || request.capabilityKey === "code.ls"
    || request.capabilityKey === "code.glob"
    || request.capabilityKey === "code.grep"
    || request.capabilityKey === "code.read_many"
    || request.capabilityKey === "code.symbol_search"
    || request.capabilityKey === "code.lsp"
    || request.capabilityKey === "spreadsheet.read"
    || request.capabilityKey === "read_pdf"
    || request.capabilityKey === "read_notebook"
    || request.capabilityKey === "view_image"
    || request.capabilityKey === "code.edit"
    || request.capabilityKey === "code.patch"
    || request.capabilityKey === "code.diff"
    || request.capabilityKey === "docs.read"
    || request.capabilityKey === "repo.write"
    || request.capabilityKey === "git.status"
    || request.capabilityKey === "git.diff"
    || request.capabilityKey === "git.commit"
    || request.capabilityKey === "git.push"
  ) {
    return summarizeForLog(
      readString(input.path)
      ?? readString(input.file_path)
      ?? readString(input.filePath)
      ?? readString(input.target)
      ?? readString(input.query)
      ?? readString(input.pattern)
      ?? request.reason,
    );
  }

  if (request.capabilityKey === "write_todos") {
    return summarizeForLog(
      Array.isArray(input.todos)
        ? input.todos
          .map((entry) => typeof entry === "object" && entry
            ? `${readString((entry as Record<string, unknown>).status) ?? "pending"}:${readString((entry as Record<string, unknown>).description) ?? "?"}`
            : "?")
          .join(" | ")
        : request.reason,
    );
  }

  if (request.capabilityKey === "remote.exec") {
    const host = readString(input.host) ?? "(missing host)";
    const commandArray = readStringArray(input.command);
    const command = commandArray?.[0] ?? readString(input.command) ?? "(missing command)";
    const args = [
      ...(commandArray?.slice(1) ?? []),
      ...(readStringArray(input.args) ?? []),
    ];
    return summarizeForLog(`${host} :: ${command}${args.length > 0 ? ` ${args.join(" ")}` : ""}`);
  }

  if (request.capabilityKey === "tracker.create") {
    return summarizeForLog(
      readString(input.title)
      ?? readString(input.kind)
      ?? request.reason,
    );
  }

  if (
    request.capabilityKey === "mcp.listTools"
    || request.capabilityKey === "mcp.listResources"
    || request.capabilityKey === "mcp.readResource"
    || request.capabilityKey === "mcp.call"
    || request.capabilityKey === "mcp.native.execute"
  ) {
    const route = typeof input.route === "object" && input.route
      ? input.route as Record<string, unknown>
      : {};
    const routeModel = readString(route.model) ?? readString(input.model);
    const routeProvider = readString(route.provider) ?? readString(input.provider);
    return summarizeForLog(`${request.capabilityKey}${routeProvider || routeModel ? ` via ${[routeProvider, routeModel].filter(Boolean).join("/")}` : ""}`);
  }

  if (
    request.capabilityKey === "skill.use"
    || request.capabilityKey === "skill.mount"
    || request.capabilityKey === "skill.prepare"
    || request.capabilityKey === "skill.doc.generate"
  ) {
    return summarizeForLog(
      readString(input.skillName)
      ?? readString(input.name)
      ?? readString(input.target)
      ?? request.reason,
    );
  }

  return summarizeForLog(request.reason);
}

export function formatNowStamp(date = new Date()): string {
  return date.toLocaleTimeString("zh-CN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function createLiveChatLogPath(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
  return resolve(process.cwd(), "memory/live-reports", `live-agent-chat.${timestamp}.jsonl`);
}

function extractFirstHttpUrl(text: string): string | undefined {
  const match = text.match(/https?:\/\/[^\s)\]}>"'`]+/iu);
  return match?.[0];
}

function buildGoogleSearchQueryFromUserMessage(userMessage: string): string | undefined {
  const normalized = userMessage.replace(/\s+/gu, " ").trim();
  const searchMatch = normalized.match(/搜索(?:一下|下)?(.+?)(?:[,，。]|并且|而且|然后|同时|$)/u);
  const rawQuery = searchMatch?.[1]?.trim()
    ?? normalized.match(/查(?:一下|下)?(.+?)(?:[,，。]|并且|而且|然后|同时|$)/u)?.[1]?.trim();
  const cleaned = rawQuery
    ?.replace(/^(给我|帮我|请|一下|一下子)\s*/u, "")
    .replace(/\s*(给我|帮我|请)$/u, "")
    .trim();
  if (!cleaned) {
    return undefined;
  }
  const needsUsdPerOunce = /(美元\/盎司|美刀\/盎司|usd\/oz|USD\/oz|XAU\/USD)/u.test(normalized);
  if (needsUsdPerOunce && !/(美元\/盎司|美刀\/盎司|usd\/oz|USD\/oz|XAU\/USD)/u.test(cleaned)) {
    return `${cleaned} 美元/盎司`;
  }
  return cleaned;
}

function rewriteBrowserPlaywrightRequest(
  request: CoreCapabilityRequest,
  userMessage: string,
): CoreCapabilityRequest {
  if (request.capabilityKey !== "browser.playwright") {
    return request;
  }
  const action = typeof request.input.action === "string" ? request.input.action : undefined;
  const actions = Array.isArray(request.input.actions)
    ? request.input.actions
      .map((entry) => (entry && typeof entry === "object" ? entry as Record<string, unknown> : undefined))
      .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    : [];

  if (!action && actions.length > 0) {
    const navigateStep = actions.find((entry) => {
      const type = readString(entry.type)?.toLowerCase();
      return type === "navigate" || type === "goto";
    });
    const navigateUrl = navigateStep
      ? readString(navigateStep.url) ?? readString(request.input.url)
      : undefined;
    if (navigateUrl) {
      return rewriteBrowserPlaywrightRequest({
        ...request,
        input: {
          ...request.input,
          action: "navigate",
          url: navigateUrl,
          allowedDomains: readStringArray(request.input.allowedDomains)
            ?? readStringArray(request.input.allowed_domains),
        },
      }, userMessage);
    }
  }

  if (action !== "navigate") {
    return request;
  }
  const query = buildGoogleSearchQueryFromUserMessage(userMessage);
  if (!query) {
    return request;
  }
  const rawUrl = typeof request.input.url === "string" ? request.input.url : undefined;
  const isGoogleHome = (() => {
    if (!rawUrl) {
      return true;
    }
    try {
      const parsed = new URL(rawUrl);
      return /(^|\.)google\.com$/iu.test(parsed.hostname)
        && (parsed.pathname === "/" || parsed.pathname === "");
    } catch {
      return false;
    }
  })();
  if (!isGoogleHome) {
    return request;
  }
  return {
    ...request,
    input: {
      ...request.input,
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      allowedDomains: ["google.com", "www.google.com"],
    },
  };
}

function inferBrowserHeadlessPreference(userMessage: string): boolean | undefined {
  const normalized = userMessage.trim();
  if (/(有头|可视化|可见|让我看|给我看|看着|展示过程|实际呈现|visible|headed|show (?:me )?the browser)/iu.test(normalized)) {
    return false;
  }
  if (/(无头|后台跑|静默运行|headless|hidden browser)/iu.test(normalized)) {
    return true;
  }
  return undefined;
}

export function formatTapMatrixRows(matrix: Array<{
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

export function inferStreamLabel(params: ModelInferenceExecutionParams): string {
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

export function shouldPrintStreamLabel(uiMode: "full" | "direct", _label: string): boolean {
  return uiMode === "full";
}

export function parseTapRequest(text: string): ParsedTapRequest | undefined {
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

export function extractResponseTextMaybe(text: string): string {
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

export function toTapAgentModelRoute(plan: AgentRoutePlan): Partial<TapAgentModelRoute> {
  return {
    provider: "openai",
    model: plan.model,
    layer: "api",
    variant: "responses",
    reasoningEffort: resolveReasoningEffort(plan),
    maxOutputTokens: plan.maxOutputTokens,
  };
}
