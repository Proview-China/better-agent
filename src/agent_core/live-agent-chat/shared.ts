import { appendFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";

import type {
  ModelInferenceExecutionParams,
} from "../integrations/model-inference.js";
import type { TapAgentModelRoute } from "../integrations/tap-agent-model.js";
import type { createAgentCoreRuntime } from "../index.js";
import {
  loadOpenAILiveConfig,
} from "../../rax/live-config.js";
import {
  DEFAULT_RAXCODE_LIVE_CHAT_MODEL_PLAN,
  DEFAULT_RAXCODE_UI_CONFIG,
  DEFAULT_RAXCODE_TAP_OVERRIDE,
  createDefaultRaxcodePermissionsConfig,
  loadResolvedRoleConfig,
  type RaxcodeLiveChatModelPlan,
  type RaxcodePermissionsConfig,
  type RaxcodeUiConfig,
} from "../../raxcode-config.js";
import { resolveLiveReportsDir } from "../../runtime-paths.js";
import {
  resolveCapabilityFamilyDefinition,
  resolveFamilyOutcomeKind,
} from "./family-telemetry.js";
import type {
  FamilyOutcomeKind,
} from "./family-telemetry.js";
import type { TaUserOverrideContract } from "../ta-pool-model/index.js";
import {
  resolveProviderRouteKind,
  sanitizeProviderRouteFeatureOptions,
} from "../integrations/model-route-features.js";

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
  syncStatus: "skipped" | "warming" | "ingested" | "checked" | "materialized" | "synced" | "failed";
  agentId: string;
  packageId: string;
  packageRef: string;
  packageKind?: string;
  packageMode?: string;
  fidelityLabel?: string;
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
  failureReason?: string;
}

export interface CoreTurnArtifacts {
  runId: string;
  answer: string;
  dispatchStatus: string;
  taskStatus?: CoreTaskStatus;
  capabilityKey?: string;
  capabilityResultStatus?: string;
  context?: CoreContextSnapshot;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    thinkingTokens?: number;
    estimated?: boolean;
  };
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
    summary.returnedParagraphCount !== undefined ? `- returnedParagraphCount: ${summary.returnedParagraphCount}` : undefined,
    summary.omittedParagraphCount !== undefined ? `- omittedParagraphCount: ${summary.omittedParagraphCount}` : undefined,
    summary.tableCount !== undefined ? `- tableCount: ${summary.tableCount}` : undefined,
  ].filter((line): line is string => Boolean(line));

  const paragraphLines = summary.paragraphs.slice(0, 3).map((paragraph, index) =>
    `- 第${index + 1}段: ${paragraph}`);
  if (paragraphLines.length > 0) {
    lines.push(...paragraphLines);
  }

  if (summary.contentExcerpt) {
    const normalizedExcerpt = summary.contentExcerpt.trim();
    const visibleParagraphText = summary.paragraphs
      .slice(0, 3)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph.length > 0)
      .join("\n")
      .trim();
    const excerptAlreadyVisible = visibleParagraphText.length > 0
      && normalizedExcerpt === visibleParagraphText;
    if (!excerptAlreadyVisible) {
      lines.push(`- 内容摘要: ${normalizedExcerpt}`);
    }
  }

  if (summary.firstTable?.rows?.length) {
    lines.push("- 首表前几行:");
    lines.push(
      ...summary.firstTable.rows.slice(0, 2).map((row, index) =>
        `  - 第${index + 1}行: ${row.join(", ")}`),
    );
    if (summary.firstTable.returnedRowCount !== undefined) {
      lines.push(`- 首表 returnedRowCount: ${summary.firstTable.returnedRowCount}`);
    }
    if (summary.firstTable.omittedRowCount !== undefined) {
      lines.push(`- 首表 omittedRowCount: ${summary.firstTable.omittedRowCount}`);
    }
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

export interface LiveCliSkillOverlayEntry {
  id: string;
  label: string;
  summary: string;
  bodyRef?: string;
}

export interface LiveCliWorkspaceInitContext {
  schemaVersion: "core-workspace-init-context/v1";
  sourcePath: string;
  bodyRef: string;
  summary: string;
  excerpt: string;
  updatedAt: string;
  freshness: "fresh" | "changed";
}

export interface CmpPanelSnapshotEntry {
  sectionId: string;
  lifecycle: string;
  kind: string;
  agentId: string;
  ref: string;
  updatedAt: string;
}

export interface CmpPanelSnapshotPayload {
  summaryLines: string[];
  status: "booting" | "ready" | "empty" | "degraded";
  sourceKind: "warming_up" | "cmp_readback" | "runtime_fallback";
  emptyReason?: string;
  truthStatus?: string;
  readbackStatus?: string;
  detailLines?: string[];
  roleLines?: string[];
  requestLines?: string[];
  issueLines?: string[];
  entries: CmpPanelSnapshotEntry[];
}

export interface MpPanelSnapshotEntry {
  memoryId: string;
  label: string;
  summary: string;
  agentId?: string;
  scopeLevel?: string;
  updatedAt?: string;
  bodyRef?: string;
}

export interface MpPanelSnapshotPayload {
  summaryLines: string[];
  status: "booting" | "ready" | "empty" | "degraded";
  sourceKind: "warming_up" | "lancedb" | "mp_overlay" | "repo_memory_fallback";
  emptyReason?: string;
  sourceClass: string;
  rootPath?: string;
  recordCount?: number;
  detailLines?: string[];
  roleLines?: string[];
  flowLines?: string[];
  issueLines?: string[];
  entries: MpPanelSnapshotEntry[];
}

export interface LiveCliState {
  runtime: LiveCliRuntime;
  sessionId: string;
  transcript: DialogueTurn[];
  turnIndex: number;
  uiMode: "full" | "direct";
  logger: LiveChatLogger;
  skillOverlayEntries?: LiveCliSkillOverlayEntry[];
  memoryOverlayEntries?: LiveCliSkillOverlayEntry[];
  mpRoutedPackage?: import("../core-prompt/types.js").CoreMpRoutedPackageV1;
  workspaceInitContext?: LiveCliWorkspaceInitContext;
  latestCmp?: CmpTurnArtifacts;
  latestCmpViewerSnapshot?: CmpPanelSnapshotPayload;
  latestMpViewerSnapshot?: MpPanelSnapshotPayload;
  pendingCmpSync?: Promise<void>;
  cmpInfraReady?: Promise<void>;
  skillOverlayReady?: Promise<void>;
  mpOverlayReady?: Promise<void>;
  startupWarmupReady?: Promise<void>;
  lastTurn?: TurnArtifacts;
  initFlow?: {
    status:
      | "idle"
      | "validating_workspace"
      | "awaiting_seed"
      | "analyzing_repo"
      | "asking_questions"
      | "synthesizing_agents"
      | "registering_git"
      | "synthesizing"
      | "completed"
      | "interrupted"
      | "ready"
      | "failed";
    repoState?: "empty" | "non_empty";
    initState?: "uninitialized" | "partial" | "initialized";
    gitState?: "unregistered" | "registering" | "registered" | "failed";
    seedText?: string;
    compiledSessionPreamble?: string;
    completionSummary?: string;
    artifactPath?: string;
    updatedAt?: string;
    summaryLines?: string[];
    clarificationHistory?: Array<{
      questionId?: string;
      answerText: string;
    }>;
    errorMessage?: string;
  };
  pendingQuestion?: QuestionAskPayload & {
    sourceKind: "init" | "core";
    resumeSeedText?: string;
  };
}

export function updateLiveCliViewerSnapshots(
  state: Pick<LiveCliState, "latestCmpViewerSnapshot" | "latestMpViewerSnapshot">,
  snapshots: {
    cmp?: CmpPanelSnapshotPayload;
    mp?: MpPanelSnapshotPayload;
  },
): void {
  if (snapshots.cmp) {
    state.latestCmpViewerSnapshot = snapshots.cmp;
  }
  if (snapshots.mp) {
    state.latestMpViewerSnapshot = snapshots.mp;
  }
}

export interface DirectFallbackReader {
  close(): void;
  read(): Promise<string | null>;
  legacyReadline?: {
    close(): void;
  };
}

export type DirectInputImageSourceKind = "clipboard" | "local_path" | "remote_url";

export interface DirectInputImageAttachment {
  id: string;
  tokenText?: string;
  sourceKind: DirectInputImageSourceKind;
  displayName?: string;
  mimeType?: string;
  localPath?: string;
  remoteUrl?: string;
}

export interface DirectInputPastedContentAttachment {
  id: string;
  tokenText: string;
  text: string;
  characterCount: number;
}

export interface DirectInputFileReference {
  id: string;
  tokenText: string;
  relativePath: string;
  absolutePath: string;
  displayName?: string;
}

export interface DirectUserInputEnvelope {
  type: "direct_user_input";
  text: string;
  attachments?: DirectInputImageAttachment[];
  pastedContents?: DirectInputPastedContentAttachment[];
  fileRefs?: DirectInputFileReference[];
}

export interface DirectInitRequestEnvelope {
  type: "direct_init_request";
  text: string;
}

export interface QuestionAskOption {
  id: string;
  label: string;
  description: string;
}

export interface QuestionAskChoiceQuestion {
  id: string;
  prompt: string;
  options: QuestionAskOption[];
  notePrompt?: string;
  allowAnnotation?: boolean;
  required?: boolean;
  kind?: "choice";
}

export interface QuestionAskFreeformQuestion {
  id: string;
  prompt: string;
  kind: "freeform";
  placeholder?: string;
  notePrompt?: string;
  allowAnnotation?: boolean;
  required?: boolean;
}

export type QuestionAskQuestion =
  | QuestionAskChoiceQuestion
  | QuestionAskFreeformQuestion;

export interface QuestionAskPayload {
  requestId: string;
  title: string;
  instruction: string;
  sourceKind?: "init" | "core";
  questions: QuestionAskQuestion[];
  submitLabel?: string;
}

export interface DirectQuestionAnswer {
  questionId: string;
  selectedOptionId?: string;
  selectedOptionLabel?: string;
  answerText?: string;
  annotation?: string;
}

export interface DirectQuestionAnswerEnvelope {
  type: "direct_question_answer";
  requestId: string;
  answers: DirectQuestionAnswer[];
  currentIndex?: number;
  isFinal?: boolean;
}

export function deriveQuestionnairePayloadFromReplyText(text: string): QuestionAskPayload | undefined {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }
  const lines = trimmed
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const questions: QuestionAskPayload["questions"] = [];
  for (const line of lines) {
    const match = line.match(/^(\d{1,2})[.)、]\s*(.+)$/u);
    if (!match) {
      continue;
    }
    questions.push({
      kind: "freeform",
      id: `reply_question_${match[1]}`,
      prompt: match[2].trim(),
      placeholder: "Type your answer for the current question.",
      required: true,
      allowAnnotation: false,
    });
  }
  if (questions.length === 0) {
    return undefined;
  }
  const normalized = trimmed.toLowerCase();
  const looksLikeQuestionnaire =
    normalized.includes("questionnaire")
    || normalized.includes("structured answers")
    || normalized.includes("please answer")
    || trimmed.includes("请回答")
    || trimmed.includes("回答下面")
    || trimmed.includes("测试问题")
    || trimmed.includes("你可以直接按");
  if (!looksLikeQuestionnaire && questions.length < 2) {
    return undefined;
  }
  const instructionLine = lines.find((line) =>
    !/^(\d{1,2})[.)、]\s*/u.test(line)
    && !line.startsWith("UserAct")
    && !line.startsWith("Requesting structured answers")
    && !line.startsWith("Request:")
    && !line.startsWith("Reason:")
    && !line.startsWith("Items:"));
  return {
    requestId: "reply-questionnaire-fallback",
    title: "/question",
    instruction: instructionLine ?? "Please answer Raxode’s questions so it can continue safely.",
    sourceKind: "core",
    questions,
    submitLabel: "Submit answers",
  };
}

export function parseDirectUserInputEnvelope(raw: string): DirectUserInputEnvelope | undefined {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (parsed.type !== "direct_user_input" || typeof parsed.text !== "string") {
      return undefined;
    }
    const attachments = Array.isArray(parsed.attachments)
      ? parsed.attachments
        .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object" && !Array.isArray(entry))
        .map((entry) => {
          const sourceKind = entry.sourceKind === "clipboard" || entry.sourceKind === "local_path" || entry.sourceKind === "remote_url"
            ? entry.sourceKind
            : undefined;
          const attachment = {
            id: typeof entry.id === "string" ? entry.id : "",
            ...(typeof entry.tokenText === "string" ? { tokenText: entry.tokenText } : {}),
            ...(sourceKind ? { sourceKind } : {}),
            ...(typeof entry.displayName === "string" ? { displayName: entry.displayName } : {}),
            ...(typeof entry.mimeType === "string" ? { mimeType: entry.mimeType } : {}),
            ...(typeof entry.localPath === "string" ? { localPath: entry.localPath } : {}),
            ...(typeof entry.remoteUrl === "string" ? { remoteUrl: entry.remoteUrl } : {}),
          };
          return attachment;
        })
        .filter((entry): entry is DirectInputImageAttachment =>
          entry.id.length > 0
          && typeof entry.sourceKind === "string"
          && (
            (entry.sourceKind === "clipboard" && typeof entry.localPath === "string" && entry.localPath.length > 0)
            || (entry.sourceKind === "local_path" && typeof entry.localPath === "string" && entry.localPath.length > 0)
            || (entry.sourceKind === "remote_url" && typeof entry.remoteUrl === "string" && entry.remoteUrl.length > 0)
          ))
      : undefined;
    const pastedContents = Array.isArray(parsed.pastedContents)
      ? parsed.pastedContents
        .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object" && !Array.isArray(entry))
        .map((entry) => ({
          id: typeof entry.id === "string" ? entry.id : "",
          tokenText: typeof entry.tokenText === "string" ? entry.tokenText : "",
          text: typeof entry.text === "string" ? entry.text : "",
          characterCount: typeof entry.characterCount === "number" && Number.isFinite(entry.characterCount)
            ? entry.characterCount
            : undefined,
        }))
        .filter((entry): entry is DirectInputPastedContentAttachment =>
          entry.id.length > 0
          && entry.tokenText.length > 0
          && entry.text.length > 0
          && typeof entry.characterCount === "number"
          && entry.characterCount >= entry.text.length)
      : undefined;
    const fileRefs = Array.isArray(parsed.fileRefs)
      ? parsed.fileRefs
        .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object" && !Array.isArray(entry))
        .map((entry) => ({
          id: typeof entry.id === "string" ? entry.id : "",
          tokenText: typeof entry.tokenText === "string" ? entry.tokenText : "",
          relativePath: typeof entry.relativePath === "string" ? entry.relativePath : "",
          absolutePath: typeof entry.absolutePath === "string" ? entry.absolutePath : "",
          ...(typeof entry.displayName === "string" ? { displayName: entry.displayName } : {}),
        }))
        .filter((entry): entry is DirectInputFileReference =>
          entry.id.length > 0
          && entry.tokenText.length > 0
          && entry.relativePath.length > 0
          && entry.absolutePath.length > 0)
      : undefined;
    return {
      type: "direct_user_input",
      text: parsed.text,
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
      ...(pastedContents && pastedContents.length > 0 ? { pastedContents } : {}),
      ...(fileRefs && fileRefs.length > 0 ? { fileRefs } : {}),
    };
  } catch {
    return undefined;
  }
}

export function parseDirectInitRequestEnvelope(raw: string): DirectInitRequestEnvelope | undefined {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (parsed.type !== "direct_init_request" || typeof parsed.text !== "string") {
      return undefined;
    }
    return {
      type: "direct_init_request",
      text: parsed.text,
    };
  } catch {
    return undefined;
  }
}

export function parseDirectQuestionAnswerEnvelope(raw: string): DirectQuestionAnswerEnvelope | undefined {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (parsed.type !== "direct_question_answer" || typeof parsed.requestId !== "string" || !Array.isArray(parsed.answers)) {
      return undefined;
    }
    const answers = parsed.answers.flatMap((entry): DirectQuestionAnswer[] => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return [];
      }
      const record = entry as Record<string, unknown>;
      if (typeof record.questionId !== "string") {
        return [];
      }
      const selectedOptionId = typeof record.selectedOptionId === "string" ? record.selectedOptionId : undefined;
      const selectedOptionLabel = typeof record.selectedOptionLabel === "string" ? record.selectedOptionLabel : undefined;
      const answerText = typeof record.answerText === "string" && record.answerText.trim().length > 0
        ? record.answerText
        : undefined;
      if ((!selectedOptionId || !selectedOptionLabel) && !answerText) {
        return [];
      }
      return [{
        questionId: record.questionId,
        ...(selectedOptionId ? { selectedOptionId } : {}),
        ...(selectedOptionLabel ? { selectedOptionLabel } : {}),
        ...(answerText ? { answerText } : {}),
        ...(typeof record.annotation === "string" && record.annotation.trim().length > 0
          ? { annotation: record.annotation }
          : {}),
      }];
    });
    if (answers.length === 0) {
      return undefined;
    }
    return {
      type: "direct_question_answer",
      requestId: parsed.requestId,
      answers,
      ...(typeof parsed.currentIndex === "number" && Number.isFinite(parsed.currentIndex)
        ? { currentIndex: parsed.currentIndex }
        : {}),
      ...(typeof parsed.isFinal === "boolean" ? { isFinal: parsed.isFinal } : {}),
    };
  } catch {
    return undefined;
  }
}

export type LiveChatLogEvent =
  | "session_start"
  | "session_end"
  | "direct_input_loop_ready"
  | "panel_snapshot"
  | "rewind_applied"
  | "rewind_failed"
  | "turn_start"
  | "turn_result"
  | "stage_start"
  | "stage_end"
  | "stream_start"
  | "stream_end"
  | "stream_text"
  | "assistant_delta";

export type AgentReasoningEffort = "low" | "medium" | "high" | "xhigh" | "none" | "minimal";

export interface AgentRoutePlan {
  model: string;
  reasoning: AgentReasoningEffort;
  serviceTier?: "fast";
  maxOutputTokens?: number;
  contextWindowTokens?: number;
}

export interface CoreContextSnapshot {
  provider: string;
  model: string;
  windowTokens: number;
  windowSource: "config_override" | "route_plan" | "model_family_default" | "fallback_default";
  promptKind: "initial" | "core_action" | "core_model_pass";
  promptTokens: number;
  transcriptTokens: number;
  maxOutputTokens?: number;
}

export interface CapabilityFamilyTelemetry {
  tapFamilyKey: string;
  tapFamilyTitle: string;
  familyKey: string;
  familyTitle: string;
  familyIntentSummary: string;
  familyOutcomeKind?: FamilyOutcomeKind;
  familyResultSummary?: string[];
  resultMetadata?: {
    selectedBackend?: string;
    resolvedBackend?: string;
    fallbackApplied?: boolean;
    sourceTitles?: string[];
    sourceCount?: number;
    sourceKind?: string;
    targetPaths?: string[];
    targetUrl?: string;
    targetRefs?: string[];
    pathCount?: number;
    matchCount?: number;
    symbolCount?: number;
    changedFileCount?: number;
    sheetCount?: number;
    pageCount?: number;
    paragraphCount?: number;
    imageCount?: number;
    aheadCount?: number;
    behindCount?: number;
    commitHash?: string;
    branchName?: string;
    targetName?: string;
    toolName?: string;
    resourceUri?: string;
    itemCount?: number;
    resultCount?: number;
    skillName?: string;
    mountCount?: number;
    outputCount?: number;
    requestKind?: string;
    durationMs?: number;
    todoCount?: number;
    trackerId?: string;
    mimeType?: string;
    errorCode?: string;
    errorDetailCode?: string;
  };
}

export function estimateContextTokens(text: string): number {
  return Math.max(0, Math.ceil(text.length / 4));
}

function normalizeTelemetryText(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function truncateTelemetryText(value: string, maxChars = 64): string {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars - 1).trimEnd()}…`;
}

function isLowSignalSourceTitle(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "youtube.com"
    || normalized === "youtu.be"
    || normalized === "facebook.com"
    || normalized === "instagram.com"
    || normalized === "linkedin.com"
    || normalized === "x.com"
    || normalized === "twitter.com"
    || normalized === "tiktok.com";
}

function compactWebsearchIntentSubject(raw: string, capabilityKey: string): string {
  const normalized = normalizeTelemetryText(raw)
    .replace(/\bsite:[^\s]+/giu, " ")
    .replace(/\b(?:OR|AND)\b/giu, " ")
    .replace(/[()]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  if (!normalized) {
    return capabilityKey === "search.fetch"
      ? "the requested page"
      : "the requested topic";
  }
  const condensed = normalized
    .replace(/\s*official documentation domain\s*/giu, " ")
    .replace(/\s*latest move\s*/giu, " latest move ")
    .replace(/\s+/gu, " ")
    .trim();
  return truncateTelemetryText(condensed, 52);
}

function summarizeWebsearchIntentSubject(input: {
  capabilityKey: string;
  requestInput?: Record<string, unknown>;
  inputSummary?: string;
}): string {
  const requestInput = input.requestInput ?? {};
  const query = readString(requestInput.query)
    ?? readString(requestInput.prompt)
    ?? readString(requestInput.goal);
  if (query) {
    return compactWebsearchIntentSubject(query, input.capabilityKey);
  }
  const url = readString(requestInput.url)
    ?? (Array.isArray(requestInput.urls)
      ? requestInput.urls.find((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : undefined);
  if (url && input.capabilityKey === "search.fetch") {
    try {
      return new URL(url).host;
    } catch {
      return truncateTelemetryText(normalizeTelemetryText(url), 52);
    }
  }
  const summary = readString(input.inputSummary);
  if (summary) {
    return compactWebsearchIntentSubject(summary, input.capabilityKey);
  }
  return input.capabilityKey === "search.fetch"
    ? "the requested page"
    : "the requested topic";
}

function collectWebsearchSourceTitles(output: Record<string, unknown> | undefined): string[] {
  const scoredTitles = new Map<string, number>();
  const appendTitle = (value: unknown) => {
    if (typeof value !== "string") {
      return;
    }
    const normalized = normalizeTelemetryText(value);
    if (!normalized) {
      return;
    }
    const scoreDelta = isLowSignalSourceTitle(normalized) ? 1 : 10;
    scoredTitles.set(normalized, (scoredTitles.get(normalized) ?? 0) + scoreDelta);
  };

  if (Array.isArray(output?.sources)) {
    for (const item of output.sources) {
      if (!item || typeof item !== "object") {
        continue;
      }
      appendTitle((item as Record<string, unknown>).title);
    }
  }

  if (Array.isArray(output?.results)) {
    for (const item of output.results) {
      if (!item || typeof item !== "object") {
        continue;
      }
      appendTitle((item as Record<string, unknown>).title);
    }
  }

  if (Array.isArray(output?.pages)) {
    for (const item of output.pages) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const record = item as Record<string, unknown>;
      appendTitle(record.title);
      appendTitle(record.pageTitle);
      appendTitle(record.finalUrl);
      appendTitle(record.url);
    }
  }

  const ranked = [...scoredTitles.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].length - right[0].length;
    })
    .map(([title]) => title);
  const highSignal = ranked.filter((title) => !isLowSignalSourceTitle(title));
  return (highSignal.length > 0 ? highSignal : ranked).slice(0, 3);
}

function resolveWebsearchSourceCount(output: Record<string, unknown> | undefined): number | undefined {
  if (!output) {
    return undefined;
  }
  if (Array.isArray(output.sources)) {
    return output.sources.length;
  }
  if (Array.isArray(output.results)) {
    return output.results.length;
  }
  if (Array.isArray(output.pages)) {
    return output.pages.length;
  }
  return undefined;
}


function readTelemetryRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function appendTelemetryRef(
  refs: string[],
  value: unknown,
  options: { prefix?: string } = {},
): void {
  const raw = readString(value);
  if (!raw) {
    return;
  }
  const normalized = normalizeTelemetryText(raw);
  if (!normalized) {
    return;
  }
  const prefixed = options.prefix && !normalized.includes(":")
    ? `${options.prefix}:${normalized}`
    : normalized;
  if (!refs.includes(prefixed)) {
    refs.push(prefixed);
  }
}

function appendMpLineageTelemetryRefs(refs: string[], value: unknown): void {
  if (value instanceof Map) {
    for (const entry of value.values()) {
      appendMpLineageTelemetryRefs(refs, entry);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      appendMpLineageTelemetryRefs(refs, entry);
    }
    return;
  }
  if (typeof value === "string") {
    appendTelemetryRef(refs, value, { prefix: "agent" });
    return;
  }
  const record = readTelemetryRecord(value);
  if (!record) {
    return;
  }
  appendTelemetryRef(refs, record.agentId, { prefix: "agent" });
  appendTelemetryRef(refs, record.memoryId);
  appendTelemetryRef(refs, record.checkedSnapshotRef);
  const metadata = readTelemetryRecord(record.metadata);
  appendTelemetryRef(refs, metadata?.sourceRef);
  appendTelemetryRef(refs, metadata?.checkedSnapshotRef);
}

function createCodeFamilyTelemetry(input: {
  capabilityKey: string;
  requestInput?: Record<string, unknown>;
  status?: string;
  output?: unknown;
  error?: unknown;
}): CapabilityFamilyTelemetry | undefined {
  const normalized = input.capabilityKey;
  let familyIntentSummary = "Reading workspace files";
  if (normalized === "code.symbol_search" || normalized === "code.lsp") {
    familyIntentSummary = "Searching symbols in the codebase";
  } else if (normalized === "code.patch") {
    familyIntentSummary = "Applying a patch to the repo";
  } else if (normalized === "code.edit") {
    familyIntentSummary = "Editing repo files";
  } else if (normalized === "code.diff") {
    familyIntentSummary = "Inspecting code changes";
  } else if (normalized === "code.glob" || normalized === "code.grep" || normalized === "code.read_many") {
    familyIntentSummary = "Scanning workspace files";
  }

  const normalizedOutput = input.output && typeof input.output === "object"
    ? input.output as Record<string, unknown>
    : undefined;
  const normalizedError = input.error && typeof input.error === "object"
    ? input.error as Record<string, unknown>
    : undefined;
  const targetPaths = [
    readString(input.requestInput?.path),
    ...(Array.isArray(input.requestInput?.paths)
      ? input.requestInput?.paths.filter((entry): entry is string => typeof entry === "string")
      : []),
    readString(normalizedOutput?.path),
    readString(normalizedOutput?.cwd),
  ]
    .filter((entry): entry is string => Boolean(entry))
    .map((entry) => normalizeTelemetryText(entry))
    .filter((entry, index, entries) => entries.indexOf(entry) === index)
    .slice(0, 3);
  const matchCount = readPositiveInteger(normalizedOutput?.resultCount)
    ?? (Array.isArray(normalizedOutput?.matches) ? normalizedOutput.matches.length : undefined)
    ?? (Array.isArray(normalizedOutput?.definitions) ? normalizedOutput.definitions.length : undefined)
    ?? (Array.isArray(normalizedOutput?.references) ? normalizedOutput.references.length : undefined);
  const symbolCount = Array.isArray(normalizedOutput?.symbols) ? normalizedOutput.symbols.length : undefined;
  const changedFileCount = Array.isArray(normalizedOutput?.changedFiles)
    ? normalizedOutput.changedFiles.length
    : Array.isArray(normalizedOutput?.entries)
      ? normalizedOutput.entries.length
      : undefined;
  const status = normalizeTelemetryText(input.status ?? "").toLowerCase();
  const familyResultSummary = status
    ? [`${familyIntentSummary} ${status === "failed" || status === "blocked" || status === "timeout" ? "failed" : "succeeded"}`]
    : undefined;
  const resultMetadata = Object.fromEntries(
    Object.entries({
      targetPaths: targetPaths.length > 0 ? targetPaths : undefined,
      pathCount: targetPaths.length > 0 ? targetPaths.length : undefined,
      matchCount,
      symbolCount,
      changedFileCount,
      errorCode: readString(normalizedError?.code),
    }).filter(([, value]) => Array.isArray(value) ? value.length > 0 : value !== undefined),
  ) as Record<string, unknown>;
  return {
    tapFamilyKey: "foundation",
    tapFamilyTitle: "Foundation",
    familyKey: "code",
    familyTitle: "Code",
    familyIntentSummary,
    familyResultSummary,
    resultMetadata: Object.keys(resultMetadata).length > 0
      ? resultMetadata as CapabilityFamilyTelemetry["resultMetadata"] & {
          targetPaths?: string[];
          pathCount?: number;
          matchCount?: number;
          symbolCount?: number;
          changedFileCount?: number;
          errorCode?: string;
        }
      : undefined,
  };
}

function createDocsFamilyTelemetry(input: {
  capabilityKey: string;
  requestInput?: Record<string, unknown>;
  status?: string;
  output?: unknown;
  error?: unknown;
}): CapabilityFamilyTelemetry | undefined {
  const normalized = input.capabilityKey;
  let familyIntentSummary = "Reading the requested document";
  if (normalized === "spreadsheet.read" || normalized === "spreadsheet.write") {
    familyIntentSummary = normalized === "spreadsheet.write"
      ? "Writing spreadsheet data"
      : "Reading spreadsheet data";
  } else if (normalized === "read_pdf") {
    familyIntentSummary = "Extracting content from the PDF";
  } else if (normalized === "read_notebook") {
    familyIntentSummary = "Reading notebook content";
  } else if (normalized === "doc.write") {
    familyIntentSummary = "Writing the requested document";
  } else if (normalized === "docs.read") {
    familyIntentSummary = "Reading the requested document";
  }

  const normalizedOutput = input.output && typeof input.output === "object"
    ? input.output as Record<string, unknown>
    : undefined;
  const normalizedError = input.error && typeof input.error === "object"
    ? input.error as Record<string, unknown>
    : undefined;
  const targetPaths = [
    readString(input.requestInput?.path),
    readString(normalizedOutput?.path),
  ]
    .filter((entry): entry is string => Boolean(entry))
    .map((entry) => normalizeTelemetryText(entry))
    .filter((entry, index, entries) => entries.indexOf(entry) === index)
    .slice(0, 3);
  const sheetCount = readPositiveInteger(normalizedOutput?.sheetCount);
  const pageCount = readPositiveInteger(normalizedOutput?.pageCount);
  const paragraphCount = readNonNegativeInteger(normalizedOutput?.paragraphCount);
  const imageCount = Array.isArray(normalizedOutput?.imageUrls)
    ? normalizedOutput.imageUrls.length
    : readPositiveInteger(normalizedOutput?.imageCount);
  const status = normalizeTelemetryText(input.status ?? "").toLowerCase();
  const familyResultSummary = (() => {
    if (!status) {
      return undefined;
    }
    const lines = [
      `${familyIntentSummary} ${status === "failed" || status === "blocked" || status === "timeout" ? "failed" : "succeeded"}`,
    ];
    if (normalized === "spreadsheet.read" && sheetCount) {
      lines.push(`Returned ${sheetCount} sheet${sheetCount === 1 ? "" : "s"}`);
    } else if (normalized === "read_pdf" && pageCount) {
      lines.push(`Returned ${pageCount} page${pageCount === 1 ? "" : "s"}`);
    } else if ((normalized === "doc.read" || normalized === "docs.read") && paragraphCount !== undefined) {
      lines.push(`Returned ${paragraphCount} paragraph${paragraphCount === 1 ? "" : "s"}`);
    }
    return lines.slice(0, 3);
  })();
  const resultMetadata = Object.fromEntries(
    Object.entries({
      targetPaths: targetPaths.length > 0 ? targetPaths : undefined,
      sheetCount,
      pageCount,
      paragraphCount,
      imageCount,
      errorCode: readString(normalizedError?.code),
    }).filter(([, value]) => Array.isArray(value) ? value.length > 0 : value !== undefined),
  ) as Record<string, unknown>;
  return {
    tapFamilyKey: "foundation",
    tapFamilyTitle: "Foundation",
    familyKey: "docs",
    familyTitle: "Docs",
    familyIntentSummary,
    familyResultSummary,
    resultMetadata: Object.keys(resultMetadata).length > 0
      ? resultMetadata as CapabilityFamilyTelemetry["resultMetadata"] & {
          targetPaths?: string[];
          sheetCount?: number;
          pageCount?: number;
          paragraphCount?: number;
          imageCount?: number;
          errorCode?: string;
        }
      : undefined,
  };
}

function createViewingPictureTelemetry(input: {
  capabilityKey: string;
  requestInput?: Record<string, unknown>;
  status?: string;
  output?: unknown;
  error?: unknown;
}): CapabilityFamilyTelemetry | undefined {
  if (input.capabilityKey !== "view_image") {
    return undefined;
  }
  const normalizedOutput = input.output && typeof input.output === "object"
    ? input.output as Record<string, unknown>
    : undefined;
  const normalizedError = input.error && typeof input.error === "object"
    ? input.error as Record<string, unknown>
    : undefined;
  const status = normalizeTelemetryText(input.status ?? "").toLowerCase();
  const familyIntentSummary = "Viewing the provided image";
  const familyResultSummary = status
    ? [status === "failed" || status === "blocked" || status === "timeout"
      ? "Viewing the provided image failed"
      : "Viewing the provided image succeeded"]
    : undefined;
  const targetPath = readString(input.requestInput?.sourcePath) ?? readString(input.requestInput?.path);
  const targetUrl = readString(input.requestInput?.sourceUrl) ?? readString(input.requestInput?.url);
  const sourceKind = readString(input.requestInput?.sourceKind);
  const resultMetadata = Object.fromEntries(
    Object.entries({
      sourceKind,
      targetPaths: targetPath ? [normalizeTelemetryText(targetPath)] : undefined,
      targetUrl: targetUrl ? normalizeTelemetryText(targetUrl) : undefined,
      imageCount: typeof normalizedOutput?.imageUrl === "string" ? 1 : readPositiveInteger(normalizedOutput?.imageCount),
      mimeType: readString(normalizedOutput?.mimeType),
      errorCode: readString(normalizedError?.code),
    }).filter(([, value]) => Array.isArray(value) ? value.length > 0 : value !== undefined),
  ) as CapabilityFamilyTelemetry["resultMetadata"];
  return {
    tapFamilyKey: "foundation",
    tapFamilyTitle: "Foundation",
    familyKey: "viewing_picture",
    familyTitle: "ViewingPicture",
    familyIntentSummary,
    familyResultSummary,
    resultMetadata: resultMetadata && Object.keys(resultMetadata).length > 0 ? resultMetadata : undefined,
  };
}

function createGitFamilyTelemetry(input: {
  capabilityKey: string;
  requestInput?: Record<string, unknown>;
  status?: string;
  output?: unknown;
  error?: unknown;
}): CapabilityFamilyTelemetry | undefined {
  const normalized = input.capabilityKey;
  let familyIntentSummary = "Checking repository status";
  if (normalized === "git.diff") {
    familyIntentSummary = "Inspecting repository changes";
  } else if (normalized === "git.commit") {
    familyIntentSummary = "Creating a git commit";
  } else if (normalized === "git.push") {
    familyIntentSummary = "Pushing the git branch";
  }
  const normalizedOutput = input.output && typeof input.output === "object"
    ? input.output as Record<string, unknown>
    : undefined;
  const normalizedError = input.error && typeof input.error === "object"
    ? input.error as Record<string, unknown>
    : undefined;
  const changedFileCount = Array.isArray(normalizedOutput?.changedFiles)
    ? normalizedOutput.changedFiles.length
    : Array.isArray(normalizedOutput?.entries)
      ? normalizedOutput.entries.length
      : Array.isArray(normalizedOutput?.committedFiles)
        ? normalizedOutput.committedFiles.length
        : undefined;
  const aheadCount = readNonNegativeInteger(normalizedOutput?.aheadCount);
  const behindCount = readNonNegativeInteger(normalizedOutput?.behindCount);
  const commitHash = readString(normalizedOutput?.commitHash);
  const branchName = readString(normalizedOutput?.branch);
  const status = normalizeTelemetryText(input.status ?? "").toLowerCase();
  const familyResultSummary = (() => {
    if (!status) {
      return undefined;
    }
    const lines = [`${familyIntentSummary} ${status === "failed" || status === "blocked" || status === "timeout" ? "failed" : "succeeded"}`];
    if (normalized === "git.commit" && commitHash) {
      lines.push(`Created commit ${commitHash.slice(0, 7)}`);
    } else if (normalized === "git.status" && changedFileCount !== undefined) {
      lines.push(`${changedFileCount} file${changedFileCount === 1 ? "" : "s"} changed`);
    }
    return lines.slice(0, 3);
  })();
  const resultMetadata = Object.fromEntries(
    Object.entries({
      changedFileCount,
      aheadCount,
      behindCount,
      commitHash,
      branchName,
      errorCode: readString(normalizedError?.code),
    }).filter(([, value]) => Array.isArray(value) ? value.length > 0 : value !== undefined),
  ) as Record<string, unknown>;
  return {
    tapFamilyKey: "foundation",
    tapFamilyTitle: "Foundation",
    familyKey: "git",
    familyTitle: "Git",
    familyIntentSummary,
    familyResultSummary,
    resultMetadata: Object.keys(resultMetadata).length > 0
      ? resultMetadata as CapabilityFamilyTelemetry["resultMetadata"] & {
          changedFileCount?: number;
          aheadCount?: number;
          behindCount?: number;
          commitHash?: string;
          branchName?: string;
          errorCode?: string;
        }
      : undefined,
  };
}

function createShellFamilyTelemetry(input: {
  capabilityKey: string;
  requestInput?: Record<string, unknown>;
  status?: string;
  output?: unknown;
  error?: unknown;
}): CapabilityFamilyTelemetry {
  const normalized = input.capabilityKey;
  let familyIntentSummary = "Running a restricted shell command";
  if (normalized === "shell.session") {
    familyIntentSummary = "Running a shell session command";
  } else if (normalized === "test.run") {
    familyIntentSummary = "Running test command";
  } else if (normalized === "remote.exec") {
    familyIntentSummary = "Executing remote command";
  }

  const reqInput = input.requestInput ?? {};
  const normalizedOutput = input.output && typeof input.output === "object"
    ? input.output as Record<string, unknown>
    : undefined;
  const normalizedError = input.error && typeof input.error === "object"
    ? input.error as Record<string, unknown>
    : undefined;
  const targetPaths = [
    readString(reqInput.cwd),
    readString(normalizedOutput?.cwd),
  ]
    .filter((entry): entry is string => Boolean(entry))
    .map((entry) => normalizeTelemetryText(entry))
    .filter((entry, index, entries) => entries.indexOf(entry) === index)
    .slice(0, 3);
  const changedFileCount = Array.isArray(normalizedOutput?.changedFiles)
    ? normalizedOutput.changedFiles.length
    : Array.isArray(normalizedOutput?.entries)
      ? normalizedOutput.entries.length
      : undefined;
  const itemCount = normalized === "shell.session"
    ? (readString(normalizedOutput?.sessionId) ? 1 : undefined)
    : undefined;
  const durationMs = readPositiveInteger(normalizedOutput?.durationMs);
  const exitCode = readNonNegativeInteger(normalizedOutput?.exitCode);
  const host = readString(normalizedOutput?.host);
  const status = normalizeTelemetryText(input.status ?? "").toLowerCase();
  const familyResultSummary = (() => {
    if (!status) {
      return undefined;
    }
    const lines = [`${familyIntentSummary} ${status === "failed" || status === "blocked" || status === "timeout" ? "failed" : "succeeded"}`];
    if (normalized === "shell.session" && readString(normalizedOutput?.sessionId)) {
      lines.push(`Session ${String(readString(normalizedOutput?.sessionId)).slice(0, 16)} ready`);
    } else if (normalized === "remote.exec" && host) {
      lines.push(`Target ${host}`);
    } else if (exitCode !== undefined) {
      lines.push(`Exit code ${exitCode}`);
    }
    return lines.slice(0, 3);
  })();
  const resultMetadata = Object.fromEntries(
    Object.entries({
      targetPaths: targetPaths.length > 0 ? targetPaths : undefined,
      changedFileCount,
      itemCount,
      durationMs,
      errorCode: readString(normalizedError?.code),
    }).filter(([, value]) => Array.isArray(value) ? value.length > 0 : value !== undefined),
  ) as CapabilityFamilyTelemetry["resultMetadata"];
  return {
    tapFamilyKey: "foundation",
    tapFamilyTitle: "Foundation",
    familyKey: "shell",
    familyTitle: "Shell",
    familyIntentSummary,
    familyResultSummary,
    resultMetadata: resultMetadata && Object.keys(resultMetadata).length > 0 ? resultMetadata : undefined,
  };
}

function createBrowserFamilyTelemetry(input: {
  capabilityKey: string;
  requestInput?: Record<string, unknown>;
  status?: string;
  output?: unknown;
  error?: unknown;
}): CapabilityFamilyTelemetry {
  const reqInput = input.requestInput ?? {};
  const normalizedOutput = input.output && typeof input.output === "object"
    ? input.output as Record<string, unknown>
    : undefined;
  const normalizedError = input.error && typeof input.error === "object"
    ? input.error as Record<string, unknown>
    : undefined;
  const action = readString(reqInput.action) ?? readString(normalizedOutput?.action);
  const familyIntentSummary = action === "navigate"
    ? "Driving the browser"
    : "Running browser automation";
  const targetPaths = [
    readString(normalizedOutput?.screenshotPath),
    readString(normalizedOutput?.snapshotPath),
  ]
    .filter((entry): entry is string => Boolean(entry))
    .map((entry) => normalizeTelemetryText(entry))
    .filter((entry, index, entries) => entries.indexOf(entry) === index)
    .slice(0, 3);
  const itemCount = readPositiveInteger(normalizedOutput?.imageCount)
    ?? (readString(normalizedOutput?.screenshotPath) ? 1 : undefined);
  const durationMs = readPositiveInteger(normalizedOutput?.durationMs);
  const status = normalizeTelemetryText(input.status ?? "").toLowerCase();
  const familyResultSummary = (() => {
    if (!status) {
      return undefined;
    }
    const lines = [`${familyIntentSummary} ${status === "failed" || status === "blocked" || status === "timeout" ? "failed" : "succeeded"}`];
    if (itemCount !== undefined) {
      lines.push(`Captured ${itemCount} item${itemCount === 1 ? "" : "s"}`);
    }
    return lines.slice(0, 3);
  })();
  const resultMetadata = Object.fromEntries(
    Object.entries({
      targetPaths: targetPaths.length > 0 ? targetPaths : undefined,
      itemCount,
      durationMs,
      errorCode: readString(normalizedError?.code),
    }).filter(([, value]) => Array.isArray(value) ? value.length > 0 : value !== undefined),
  ) as CapabilityFamilyTelemetry["resultMetadata"];
  return {
    tapFamilyKey: "foundation",
    tapFamilyTitle: "Foundation",
    familyKey: "browser",
    familyTitle: "Browser",
    familyIntentSummary,
    familyResultSummary,
    resultMetadata: resultMetadata && Object.keys(resultMetadata).length > 0 ? resultMetadata : undefined,
  };
}

function createRepoFamilyTelemetry(input: {
  capabilityKey: string;
  requestInput?: Record<string, unknown>;
  status?: string;
  output?: unknown;
  error?: unknown;
}): CapabilityFamilyTelemetry {
  const reqInput = input.requestInput ?? {};
  const normalizedOutput = input.output && typeof input.output === "object"
    ? input.output as Record<string, unknown>
    : undefined;
  const normalizedError = input.error && typeof input.error === "object"
    ? input.error as Record<string, unknown>
    : undefined;

  const requestEntryPaths = Array.isArray(reqInput.entries)
    ? reqInput.entries
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
      .map((entry) => readString(entry.path))
      .filter((entry): entry is string => Boolean(entry))
    : [];
  const writtenPaths = Array.isArray(normalizedOutput?.writes)
    ? normalizedOutput.writes
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
      .map((entry) => readString(entry.path))
      .filter((entry): entry is string => Boolean(entry))
    : [];
  const targetPaths = [...requestEntryPaths, ...writtenPaths]
    .map((entry) => normalizeTelemetryText(entry))
    .filter((entry, index, entries) => entries.indexOf(entry) === index)
    .slice(0, 3);
  const changedFileCount = Array.isArray(normalizedOutput?.writes)
    ? normalizedOutput.writes.length
    : requestEntryPaths.length > 0
      ? requestEntryPaths.length
      : undefined;
  const itemCount = changedFileCount;
  const status = normalizeTelemetryText(input.status ?? "").toLowerCase();
  const familyIntentSummary = "Writing repository files";
  const familyResultSummary = (() => {
    if (!status) {
      return undefined;
    }
    const lines = [`${familyIntentSummary} ${status === "failed" || status === "blocked" || status === "timeout" ? "failed" : "succeeded"}`];
    if (changedFileCount !== undefined) {
      lines.push(`${changedFileCount} file${changedFileCount === 1 ? "" : "s"} changed`);
    }
    return lines.slice(0, 3);
  })();
  const resultMetadata = Object.fromEntries(
    Object.entries({
      targetPaths: targetPaths.length > 0 ? targetPaths : undefined,
      changedFileCount,
      itemCount,
      errorCode: readString(normalizedError?.code),
    }).filter(([, value]) => Array.isArray(value) ? value.length > 0 : value !== undefined),
  ) as CapabilityFamilyTelemetry["resultMetadata"];
  return {
    tapFamilyKey: "foundation",
    tapFamilyTitle: "Foundation",
    familyKey: "repo",
    familyTitle: "Repo",
    familyIntentSummary,
    familyResultSummary,
    resultMetadata: resultMetadata && Object.keys(resultMetadata).length > 0 ? resultMetadata : undefined,
  };
}

function createMpFamilyTelemetry(input: {
  capabilityKey: string;
  requestInput?: Record<string, unknown>;
  status?: string;
  output?: unknown;
  error?: unknown;
}): CapabilityFamilyTelemetry {
  const normalized = input.capabilityKey;
  let familyIntentSummary = "Searching memory history";
  if (normalized === "mp.align") {
    familyIntentSummary = "Aligning memory artifacts";
  } else if (normalized === "mp.materialize") {
    familyIntentSummary = "Materializing memory context";
  } else if (normalized === "mp.ingest") {
    familyIntentSummary = "Ingesting memory artifacts";
  } else if (normalized === "mp.resolve") {
    familyIntentSummary = "Resolving memory lineage";
  } else if (normalized === "mp.promote") {
    familyIntentSummary = "Promoting memory records";
  } else if (normalized === "mp.archive") {
    familyIntentSummary = "Archiving memory records";
  } else if (normalized === "mp.split") {
    familyIntentSummary = "Splitting memory records";
  } else if (normalized === "mp.merge") {
    familyIntentSummary = "Merging memory records";
  } else if (normalized === "mp.reindex") {
    familyIntentSummary = "Reindexing memory records";
  } else if (normalized === "mp.compact") {
    familyIntentSummary = "Compacting memory records";
  } else if (normalized === "mp.history.request") {
    familyIntentSummary = "Requesting memory history";
  }
  const normalizedOutput = input.output && typeof input.output === "object" ? input.output as Record<string, unknown> : undefined;
  const normalizedError = input.error && typeof input.error === "object" ? input.error as Record<string, unknown> : undefined;
  const requestInput = input.requestInput as Record<string, unknown> | undefined;
  const targetRefs: string[] = [];
  appendTelemetryRef(targetRefs, requestInput?.memoryId);
  appendTelemetryRef(targetRefs, requestInput?.storedSection);
  appendTelemetryRef(targetRefs, requestInput?.checkedSnapshotRef);
  for (const agentId of readStringArray(requestInput?.agentIds) ?? []) {
    appendTelemetryRef(targetRefs, agentId, { prefix: "agent" });
  }
  appendMpLineageTelemetryRefs(targetRefs, requestInput?.sourceLineages);
  appendTelemetryRef(targetRefs, normalizedOutput?.memoryId);
  appendMpLineageTelemetryRefs(targetRefs, normalizedOutput?.sourceLineages);
  for (const agentId of readStringArray(normalizedOutput?.agentIds) ?? []) {
    appendTelemetryRef(targetRefs, agentId, { prefix: "agent" });
  }
  const itemCount = Array.isArray(normalizedOutput?.items)
    ? normalizedOutput.items.length
    : Array.isArray(normalizedOutput?.records)
      ? normalizedOutput.records.length
      : readPositiveInteger(normalizedOutput?.count);
  const resultCount = Array.isArray(normalizedOutput?.hits)
    ? normalizedOutput.hits.length
    : readPositiveInteger(normalizedOutput?.resultCount);
  const status = normalizeTelemetryText(input.status ?? "").toLowerCase();
  const familyResultSummary = status
    ? [`${familyIntentSummary} ${status === "failed" || status === "blocked" || status === "timeout" ? "failed" : "succeeded"}`]
    : undefined;
  const resultMetadata = Object.fromEntries(
    Object.entries({
      targetRefs: targetRefs.length > 0 ? targetRefs : undefined,
      itemCount,
      resultCount,
      errorCode: readString(normalizedError?.code),
    }).filter(([, value]) => Array.isArray(value) ? value.length > 0 : value !== undefined),
  ) as CapabilityFamilyTelemetry["resultMetadata"];
  return {
    tapFamilyKey: "mp",
    tapFamilyTitle: "MP",
    familyKey: "mp",
    familyTitle: "MemoryPool",
    familyIntentSummary,
    familyResultSummary,
    resultMetadata: resultMetadata && Object.keys(resultMetadata).length > 0 ? resultMetadata : undefined,
  };
}

function createMcpFamilyTelemetry(input: {
  capabilityKey: string;
  requestInput?: Record<string, unknown>;
  status?: string;
  output?: unknown;
  error?: unknown;
}): CapabilityFamilyTelemetry {
  const normalized = input.capabilityKey;
  let familyIntentSummary = "Listing MCP tools";
  if (normalized === "mcp.listResources") {
    familyIntentSummary = "Listing MCP resources";
  } else if (normalized === "mcp.readResource") {
    familyIntentSummary = "Reading MCP resource";
  } else if (normalized === "mcp.call") {
    familyIntentSummary = "Calling MCP tool";
  } else if (normalized === "mcp.native.execute") {
    familyIntentSummary = "Executing MCP native transport";
  }
  const reqInput = input.requestInput ?? {};
  const nestedInput = readTelemetryRecord(reqInput.input);
  const transportInput = readTelemetryRecord(nestedInput?.transport);
  const normalizedOutput = input.output && typeof input.output === "object" ? input.output as Record<string, unknown> : undefined;
  const normalizedError = input.error && typeof input.error === "object" ? input.error as Record<string, unknown> : undefined;
  const targetName = readString(nestedInput?.connectionId)
    ?? readString(nestedInput?.serverName)
    ?? readString(transportInput?.connectionId)
    ?? readString(transportInput?.serverName)
    ?? readString(transportInput?.command)
    ?? readString(normalizedOutput?.connectionId);
  const toolName = readString(nestedInput?.toolName)
    ?? readString(nestedInput?.name)
    ?? readString(transportInput?.toolName)
    ?? readString(transportInput?.name)
    ?? readString(normalizedOutput?.toolName);
  const resourceUri = readString(nestedInput?.uri)
    ?? readString(nestedInput?.resourceUri)
    ?? readString(transportInput?.uri)
    ?? readString(transportInput?.resourceUri)
    ?? readString(normalizedOutput?.uri);
  const itemCount = Array.isArray(normalizedOutput?.tools)
    ? normalizedOutput.tools.length
    : Array.isArray(normalizedOutput?.resources)
      ? normalizedOutput.resources.length
      : Array.isArray(normalizedOutput?.content)
        ? normalizedOutput.content.length
        : undefined;
  const status = normalizeTelemetryText(input.status ?? "").toLowerCase();
  const familyResultSummary = status
    ? [`${familyIntentSummary} ${status === "failed" || status === "blocked" || status === "timeout" ? "failed" : "succeeded"}`]
    : undefined;
  const resultMetadata = Object.fromEntries(
    Object.entries({
      targetName,
      toolName,
      resourceUri,
      itemCount,
      errorCode: readString(normalizedError?.code),
    }).filter(([, value]) => value !== undefined),
  ) as CapabilityFamilyTelemetry["resultMetadata"];
  return {
    tapFamilyKey: "mcp",
    tapFamilyTitle: "MCP",
    familyKey: "mcp",
    familyTitle: "MCP",
    familyIntentSummary,
    familyResultSummary,
    resultMetadata: resultMetadata && Object.keys(resultMetadata).length > 0 ? resultMetadata : undefined,
  };
}

function createSkillFamilyTelemetry(input: {
  capabilityKey: string;
  requestInput?: Record<string, unknown>;
  status?: string;
  output?: unknown;
  error?: unknown;
}): CapabilityFamilyTelemetry {
  const normalized = input.capabilityKey;
  let familyIntentSummary = "Using the requested skill";
  if (normalized === "skill.mount") {
    familyIntentSummary = "Mounting the requested skill";
  } else if (normalized === "skill.prepare") {
    familyIntentSummary = "Preparing the requested skill";
  } else if (normalized === "skill.doc.generate") {
    familyIntentSummary = "Generating skill documentation";
  }
  const reqInput = input.requestInput ?? {};
  const normalizedOutput = input.output && typeof input.output === "object" ? input.output as Record<string, unknown> : undefined;
  const normalizedError = input.error && typeof input.error === "object" ? input.error as Record<string, unknown> : undefined;
  const skillName = readString(reqInput.skillName)
    ?? readString(reqInput.name)
    ?? readString(reqInput.target)
    ?? readString(normalizedOutput?.title)
    ?? readString((normalizedOutput?.container as Record<string, unknown> | undefined)?.name);
  const mountCount = Array.isArray((normalizedOutput?.activation as Record<string, unknown> | undefined)?.mounts)
    ? ((normalizedOutput?.activation as Record<string, unknown>).mounts as unknown[]).length
    : undefined;
  const outputCount = Array.isArray(normalizedOutput?.documents)
    ? normalizedOutput.documents.length
    : Array.isArray((normalizedOutput?.preparedInvocation as Record<string, unknown> | undefined)?.resources)
      ? ((normalizedOutput?.preparedInvocation as Record<string, unknown>).resources as unknown[]).length
      : undefined;
  const status = normalizeTelemetryText(input.status ?? "").toLowerCase();
  const familyResultSummary = status
    ? [`${familyIntentSummary} ${status === "failed" || status === "blocked" || status === "timeout" ? "failed" : "succeeded"}`]
    : undefined;
  const resultMetadata = Object.fromEntries(
    Object.entries({
      skillName,
      mountCount,
      outputCount,
      errorCode: readString(normalizedError?.code),
    }).filter(([, value]) => value !== undefined),
  ) as CapabilityFamilyTelemetry["resultMetadata"];
  return {
    tapFamilyKey: normalized === "skill.doc.generate" ? "foundation" : "skill",
    tapFamilyTitle: normalized === "skill.doc.generate" ? "Foundation" : "Skill",
    familyKey: "skill",
    familyTitle: "Skill",
    familyIntentSummary,
    familyResultSummary,
    resultMetadata: resultMetadata && Object.keys(resultMetadata).length > 0 ? resultMetadata : undefined,
  };
}

function createUserActFamilyTelemetry(input: {
  capabilityKey: string;
  requestInput?: Record<string, unknown>;
  status?: string;
  output?: unknown;
  error?: unknown;
}): CapabilityFamilyTelemetry {
  const normalized = input.capabilityKey;
  let familyIntentSummary = "Requesting structured answers";
  let requestKind = "questionnaire";
  if (normalized === "request_user_input") {
    familyIntentSummary = "Requesting user input";
    requestKind = "user_input";
  } else if (normalized === "request_permissions") {
    familyIntentSummary = "Requesting additional permissions";
    requestKind = "permissions";
  } else if (normalized === "audio.transcribe") {
    familyIntentSummary = "Transcribing audio";
    requestKind = "audio_transcribe";
  } else if (normalized === "speech.synthesize") {
    familyIntentSummary = "Synthesizing speech";
    requestKind = "speech_synthesize";
  } else if (normalized === "image.generate") {
    familyIntentSummary = "Generating image output";
    requestKind = "image_generate";
  }
  const normalizedOutput = input.output && typeof input.output === "object" ? input.output as Record<string, unknown> : undefined;
  const normalizedError = input.error && typeof input.error === "object" ? input.error as Record<string, unknown> : undefined;
  const itemCount = Array.isArray((normalizedError?.details as Record<string, unknown> | undefined)?.questions)
    ? ((normalizedError?.details as Record<string, unknown>).questions as unknown[]).length
    : Array.isArray((normalizedError?.details as Record<string, unknown> | undefined)?.permissions)
      ? ((normalizedError?.details as Record<string, unknown>).permissions as unknown[]).length
      : Array.isArray(normalizedOutput?.segments)
        ? normalizedOutput.segments.length
        : Array.isArray(normalizedOutput?.images)
          ? normalizedOutput.images.length
          : undefined;
  const durationMs = readPositiveInteger(normalizedOutput?.durationMs);
  const status = normalizeTelemetryText(input.status ?? "").toLowerCase();
  const familyResultSummary = status
    ? [`${familyIntentSummary} ${status === "failed" || status === "blocked" || status === "timeout" ? "failed" : "succeeded"}`]
    : undefined;
  const resultMetadata = Object.fromEntries(
    Object.entries({
      requestKind,
      itemCount,
      durationMs,
      errorCode: readString(normalizedError?.code),
    }).filter(([, value]) => value !== undefined),
  ) as CapabilityFamilyTelemetry["resultMetadata"];
  return {
    tapFamilyKey: "userio",
    tapFamilyTitle: "UserIO",
    familyKey: "useract",
    familyTitle: "UserAct",
    familyIntentSummary,
    familyResultSummary,
    resultMetadata: resultMetadata && Object.keys(resultMetadata).length > 0 ? resultMetadata : undefined,
  };
}

function createWorkflowFamilyTelemetry(input: {
  capabilityKey: string;
  requestInput?: Record<string, unknown>;
  status?: string;
  output?: unknown;
  error?: unknown;
}): CapabilityFamilyTelemetry {
  const normalized = input.capabilityKey;
  const familyIntentSummary = normalized === "tracker.create"
    ? "Creating tracker item"
    : "Updating todo workflow";
  const requestInput = input.requestInput ?? {};
  const normalizedOutput = input.output && typeof input.output === "object" ? input.output as Record<string, unknown> : undefined;
  const normalizedError = input.error && typeof input.error === "object" ? input.error as Record<string, unknown> : undefined;
  const todoCount = readNonNegativeInteger(normalizedOutput?.count)
    ?? (Array.isArray(normalizedOutput?.todos) ? normalizedOutput.todos.length : undefined)
    ?? (Array.isArray(normalizedOutput?.newTodos) ? normalizedOutput.newTodos.length : undefined)
    ?? (Array.isArray(requestInput.todos) ? requestInput.todos.length : undefined);
  const trackerId = readString(normalizedOutput?.trackerId)
    ?? readString(requestInput.trackerId)
    ?? readString(readTelemetryRecord(normalizedOutput?.artifact)?.trackerId);
  const itemCount = normalized === "tracker.create"
    ? (trackerId ? 1 : undefined)
    : todoCount;
  const status = normalizeTelemetryText(input.status ?? "").toLowerCase();
  const familyResultSummary = (() => {
    if (!status) {
      return undefined;
    }
    const lines = [`${familyIntentSummary} ${status === "failed" || status === "blocked" || status === "timeout" ? "failed" : "succeeded"}`];
    if (normalized === "tracker.create" && trackerId) {
      lines.push(`Created tracker ${trackerId.slice(0, 8)}`);
    } else if (normalized === "write_todos" && todoCount !== undefined) {
      lines.push(`${todoCount} todo item${todoCount === 1 ? "" : "s"} updated`);
    }
    return lines.slice(0, 3);
  })();
  const resultMetadata = Object.fromEntries(
    Object.entries({
      todoCount,
      trackerId,
      itemCount,
      errorCode: readString(normalizedError?.code),
    }).filter(([, value]) => value !== undefined),
  ) as CapabilityFamilyTelemetry["resultMetadata"];
  return {
    tapFamilyKey: "foundation",
    tapFamilyTitle: "Foundation",
    familyKey: "workflow",
    familyTitle: "Workflow",
    familyIntentSummary,
    familyResultSummary,
    resultMetadata: resultMetadata && Object.keys(resultMetadata).length > 0 ? resultMetadata : undefined,
  };
}

export function createCapabilityFamilyTelemetry(input: {
  capabilityKey?: string | null;
  requestInput?: Record<string, unknown>;
  inputSummary?: string;
  status?: string;
  output?: unknown;
  error?: unknown;
}): CapabilityFamilyTelemetry | undefined {
  const capabilityKey = input.capabilityKey?.trim().toLowerCase();
  const family = resolveCapabilityFamilyDefinition(capabilityKey);
  if (!family || !capabilityKey) {
    return undefined;
  }

  const familyOutcomeKind = resolveFamilyOutcomeKind(input.status);
  const withResolvedFamily = (
    telemetry: CapabilityFamilyTelemetry | undefined,
  ): CapabilityFamilyTelemetry | undefined => telemetry
    ? {
      ...telemetry,
      tapFamilyKey: family.tapFamilyKey,
      tapFamilyTitle: family.tapFamilyTitle,
      familyKey: family.familyKey,
      familyTitle: family.familyTitle,
      familyOutcomeKind,
    }
    : undefined;

  if (family.familyKey === "code") {
    return withResolvedFamily(createCodeFamilyTelemetry({
      capabilityKey,
      requestInput: input.requestInput,
      status: input.status,
      output: input.output,
      error: input.error,
    }));
  }
  if (family.familyKey === "docs") {
    return withResolvedFamily(createDocsFamilyTelemetry({
      capabilityKey,
      requestInput: input.requestInput,
      status: input.status,
      output: input.output,
      error: input.error,
    }));
  }
  if (family.familyKey === "viewing_picture") {
    return withResolvedFamily(createViewingPictureTelemetry({
      capabilityKey,
      requestInput: input.requestInput,
      status: input.status,
      output: input.output,
      error: input.error,
    }));
  }
  if (family.familyKey === "git") {
    return withResolvedFamily(createGitFamilyTelemetry({
      capabilityKey,
      requestInput: input.requestInput,
      status: input.status,
      output: input.output,
      error: input.error,
    }));
  }
  if (family.familyKey === "shell") {
    return withResolvedFamily(createShellFamilyTelemetry({
      capabilityKey,
      requestInput: input.requestInput,
      status: input.status,
      output: input.output,
      error: input.error,
    }));
  }
  if (family.familyKey === "browser") {
    return withResolvedFamily(createBrowserFamilyTelemetry({
      capabilityKey,
      requestInput: input.requestInput,
      status: input.status,
      output: input.output,
      error: input.error,
    }));
  }
  if (family.familyKey === "repo") {
    return withResolvedFamily(createRepoFamilyTelemetry({
      capabilityKey,
      requestInput: input.requestInput,
      status: input.status,
      output: input.output,
      error: input.error,
    }));
  }
  if (family.familyKey === "mp") {
    return withResolvedFamily(createMpFamilyTelemetry({
      capabilityKey,
      requestInput: input.requestInput,
      status: input.status,
      output: input.output,
      error: input.error,
    }));
  }
  if (family.familyKey === "mcp") {
    return withResolvedFamily(createMcpFamilyTelemetry({
      capabilityKey,
      requestInput: input.requestInput,
      status: input.status,
      output: input.output,
      error: input.error,
    }));
  }
  if (family.familyKey === "skill") {
    return withResolvedFamily(createSkillFamilyTelemetry({
      capabilityKey,
      requestInput: input.requestInput,
      status: input.status,
      output: input.output,
      error: input.error,
    }));
  }
  if (family.familyKey === "useract") {
    return withResolvedFamily(createUserActFamilyTelemetry({
      capabilityKey,
      requestInput: input.requestInput,
      status: input.status,
      output: input.output,
      error: input.error,
    }));
  }
  if (family.familyKey === "workflow") {
    return withResolvedFamily(createWorkflowFamilyTelemetry({
      capabilityKey,
      requestInput: input.requestInput,
      status: input.status,
      output: input.output,
      error: input.error,
    }));
  }

  const subject = summarizeWebsearchIntentSubject({
    capabilityKey,
    requestInput: input.requestInput,
    inputSummary: input.inputSummary,
  });
  const familyIntentSummary = capabilityKey === "search.fetch"
    ? `Fetching and extracting ${subject}`
    : `Searching and grounding ${subject}`;

  const normalizedOutput = input.output && typeof input.output === "object"
    ? input.output as Record<string, unknown>
    : undefined;
  const normalizedError = input.error && typeof input.error === "object"
    ? input.error as Record<string, unknown>
    : undefined;
  const status = normalizeTelemetryText(input.status ?? "").toLowerCase();
  const selectedBackend = readString(normalizedOutput?.selectedBackend);
  const resolvedBackend = readString(normalizedOutput?.resolvedBackend);
  const fallbackApplied = normalizedOutput?.fallbackApplied === true;
  const sourceTitles = collectWebsearchSourceTitles(normalizedOutput);
  const sourceCount = resolveWebsearchSourceCount(normalizedOutput);
  const errorCode = readString(normalizedError?.code);
  const detailCode = normalizedError?.details && typeof normalizedError.details === "object"
    ? readString((normalizedError.details as Record<string, unknown>).code)
    : undefined;

  const familyResultSummary = (() => {
    if (!status) {
      return undefined;
    }
    const lines: string[] = [];
    if (status === "success" || status === "completed" || status === "partial") {
      lines.push(`${familyIntentSummary} succeeded`);
      if (fallbackApplied && resolvedBackend && selectedBackend && resolvedBackend !== selectedBackend) {
        lines.push(`Recovered via ${resolvedBackend}`);
      }
    } else if (status === "failed" || status === "blocked" || status === "timeout") {
      lines.push(`${familyIntentSummary} failed`);
      if (fallbackApplied && resolvedBackend) {
        lines.push(`Recovered via ${resolvedBackend}`);
      }
    } else {
      lines.push(familyIntentSummary);
    }
    return lines.slice(0, 3);
  })();

  const resultMetadata = Object.fromEntries(
    Object.entries({
      selectedBackend,
      resolvedBackend,
      fallbackApplied: fallbackApplied ? true : undefined,
      sourceTitles: sourceTitles.length > 0 ? sourceTitles : undefined,
      sourceCount,
      errorCode,
      errorDetailCode: detailCode,
    }).filter(([, value]) => Array.isArray(value) ? value.length > 0 : value !== undefined),
  ) as NonNullable<CapabilityFamilyTelemetry["resultMetadata"]>;
  const hasResultMetadata = Object.values(resultMetadata).some((value) =>
    Array.isArray(value)
      ? value.length > 0
      : value !== undefined,
  );

  return {
    tapFamilyKey: family.tapFamilyKey,
    tapFamilyTitle: family.tapFamilyTitle,
    familyKey: family.familyKey,
    familyTitle: family.familyTitle,
    familyIntentSummary,
    familyOutcomeKind,
    familyResultSummary,
    resultMetadata: hasResultMetadata ? resultMetadata : undefined,
  };
}

export function resolveContextWindowProfile(input: {
  provider?: string;
  model?: string;
  configuredWindowTokens?: number;
  routePlanWindowTokens?: number;
  maxOutputTokens?: number;
}): Pick<CoreContextSnapshot, "windowTokens" | "windowSource"> {
  if (readPositiveInteger(input.configuredWindowTokens)) {
    return {
      windowTokens: input.configuredWindowTokens!,
      windowSource: "config_override",
    };
  }
  if (readPositiveInteger(input.routePlanWindowTokens)) {
    return {
      windowTokens: input.routePlanWindowTokens!,
      windowSource: "route_plan",
    };
  }

  const provider = (input.provider ?? "").trim().toLowerCase();
  const model = (input.model ?? "").trim().toLowerCase();
  if (provider === "openai" || /^gpt-5/iu.test(model)) {
    return {
      windowTokens: 1_050_000,
      windowSource: "model_family_default",
    };
  }
  if (provider === "anthropic" || /claude/iu.test(model)) {
    return {
      windowTokens: 200_000,
      windowSource: "model_family_default",
    };
  }
  if (provider === "deepmind" || /gemini/iu.test(model)) {
    return {
      windowTokens: 1_000_000,
      windowSource: "model_family_default",
    };
  }
  return {
    windowTokens: 200_000,
    windowSource: "fallback_default",
  };
}

export function createCoreContextSnapshot(input: {
  provider: string;
  model: string;
  promptKind: CoreContextSnapshot["promptKind"];
  promptText: string;
  transcriptText?: string;
  configuredWindowTokens?: number;
  routePlanWindowTokens?: number;
  maxOutputTokens?: number;
}): CoreContextSnapshot {
  const resolved = resolveContextWindowProfile({
    provider: input.provider,
    model: input.model,
    configuredWindowTokens: input.configuredWindowTokens,
    routePlanWindowTokens: input.routePlanWindowTokens,
    maxOutputTokens: input.maxOutputTokens,
  });
  return {
    provider: input.provider,
    model: input.model,
    promptKind: input.promptKind,
    windowTokens: resolved.windowTokens,
    windowSource: resolved.windowSource,
    promptTokens: estimateContextTokens(input.promptText),
    transcriptTokens: estimateContextTokens(input.transcriptText ?? ""),
    maxOutputTokens: input.maxOutputTokens,
  };
}

export let LIVE_CHAT_TAP_OVERRIDE: TaUserOverrideContract = {
  ...DEFAULT_RAXCODE_TAP_OVERRIDE,
};

export let LIVE_CHAT_UI_CONFIG: RaxcodeUiConfig = {
  ...DEFAULT_RAXCODE_UI_CONFIG,
};

export let LIVE_CHAT_PERMISSIONS_CONFIG: RaxcodePermissionsConfig = createDefaultRaxcodePermissionsConfig();

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

export type LiveChatModelPlan = {
  core: AgentRoutePlan;
  tap: Record<"reviewer" | "toolReviewer" | "provisioner", AgentRoutePlan>;
  mp: Record<"icma" | "iterator" | "checker" | "dbagent" | "dispatcher", AgentRoutePlan>;
  cmp: Record<"icma" | "iterator" | "checker" | "dbagent" | "dispatcher", AgentRoutePlan>;
  tui: AgentRoutePlan;
};

function cloneRoutePlan(plan: {
  model: string;
  reasoning: AgentReasoningEffort;
  maxOutputTokens?: number;
  contextWindowTokens?: number;
}): AgentRoutePlan {
  return {
    model: plan.model,
    reasoning: plan.reasoning,
    maxOutputTokens: plan.maxOutputTokens,
    contextWindowTokens: plan.contextWindowTokens,
  };
}

function cloneLiveChatModelPlan(plan: RaxcodeLiveChatModelPlan): LiveChatModelPlan {
  return {
    core: cloneRoutePlan(plan.core.main),
    tap: {
      reviewer: cloneRoutePlan(plan.tap.reviewer),
      toolReviewer: cloneRoutePlan(plan.tap.toolReviewer),
      provisioner: cloneRoutePlan(plan.tap.provisioner),
    },
    mp: {
      icma: cloneRoutePlan(plan.mp.icma),
      iterator: cloneRoutePlan(plan.mp.iterator),
      checker: cloneRoutePlan(plan.mp.checker),
      dbagent: cloneRoutePlan(plan.mp.dbagent),
      dispatcher: cloneRoutePlan(plan.mp.dispatcher),
    },
    cmp: {
      icma: cloneRoutePlan(plan.cmp.icma),
      iterator: cloneRoutePlan(plan.cmp.iterator),
      checker: cloneRoutePlan(plan.cmp.checker),
      dbagent: cloneRoutePlan(plan.cmp.dbagent),
      dispatcher: cloneRoutePlan(plan.cmp.dispatcher),
    },
    tui: cloneRoutePlan(plan.tui.main),
  };
}

export let LIVE_CHAT_MODEL_PLAN: LiveChatModelPlan = cloneLiveChatModelPlan(
  DEFAULT_RAXCODE_LIVE_CHAT_MODEL_PLAN,
);

export function applyLiveChatRuntimeConfig(input: {
  modelPlan?: RaxcodeLiveChatModelPlan;
  tapOverride?: TaUserOverrideContract;
  uiConfig?: RaxcodeUiConfig;
  permissionsConfig?: RaxcodePermissionsConfig;
} = {}): void {
  LIVE_CHAT_MODEL_PLAN = cloneLiveChatModelPlan(input.modelPlan ?? DEFAULT_RAXCODE_LIVE_CHAT_MODEL_PLAN);
  LIVE_CHAT_TAP_OVERRIDE = {
    ...DEFAULT_RAXCODE_TAP_OVERRIDE,
    ...(input.tapOverride ?? {}),
    toolPolicyOverrides: input.tapOverride?.toolPolicyOverrides
      ? [...input.tapOverride.toolPolicyOverrides]
      : [...(DEFAULT_RAXCODE_TAP_OVERRIDE.toolPolicyOverrides ?? [])],
    requireHumanOnRiskLevels: input.tapOverride?.requireHumanOnRiskLevels
      ? [...input.tapOverride.requireHumanOnRiskLevels]
      : [...(DEFAULT_RAXCODE_TAP_OVERRIDE.requireHumanOnRiskLevels ?? [])],
  };
  LIVE_CHAT_UI_CONFIG = {
    ...DEFAULT_RAXCODE_UI_CONFIG,
    ...(input.uiConfig ?? {}),
  };
  LIVE_CHAT_PERMISSIONS_CONFIG = input.permissionsConfig
    ? {
        ...input.permissionsConfig,
        capabilityOverrides: [...input.permissionsConfig.capabilityOverrides],
        persistedAllowRules: input.permissionsConfig.persistedAllowRules.map((rule) => ({ ...rule })),
        shared15ViewMatrix: input.permissionsConfig.shared15ViewMatrix.map((cell) => ({ ...cell })),
        requireHumanOnRiskLevels: [...input.permissionsConfig.requireHumanOnRiskLevels],
      }
    : createDefaultRaxcodePermissionsConfig();
}

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
      error: trimStructuredValue(normalized?.error, 2_500),
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
    paragraphCount: readNonNegativeInteger(normalized.paragraphCount),
    returnedParagraphCount: readNonNegativeInteger(normalized.returnedParagraphCount),
    omittedParagraphCount: readNonNegativeInteger(normalized.omittedParagraphCount),
    tableCount: readNonNegativeInteger(normalized.tableCount),
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
        rowCount: readNonNegativeInteger(firstTableRaw.rowCount),
        returnedRowCount: readNonNegativeInteger(firstTableRaw.returnedRowCount),
        omittedRowCount: readNonNegativeInteger(firstTableRaw.omittedRowCount),
        columnCount: readNonNegativeInteger(firstTableRaw.columnCount),
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
  const resolved = loadResolvedRoleConfig("core.main");

  return {
    provider: resolved.profile.provider,
    model: resolved.profile.model,
    layer: "api",
  };
}

export function resolveCliDefaultCarrierRoute(
  config: Pick<OpenAILiveConfig, "model">,
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
  config: Pick<OpenAILiveConfig, "model">,
  userMessage: string,
  previousBrowserSession?: {
    headless?: boolean;
    browser?: string;
    isolated?: boolean;
  },
): Promise<CoreCapabilityRequest> {
  const normalizeCodeReadIntent = (nextRequest: CoreCapabilityRequest): CoreCapabilityRequest => {
    if (nextRequest.capabilityKey !== "code.ls") {
      return nextRequest;
    }
    const requestedPath = readString(nextRequest.input.path)
      ?? readString(nextRequest.input.file_path)
      ?? readString(nextRequest.input.filePath);
    if (!requestedPath) {
      return nextRequest;
    }
    const normalizedPath = requestedPath.trim();
    if (normalizedPath === "." || normalizedPath === "./" || normalizedPath === "/") {
      return nextRequest;
    }
    const normalizedUserMessage = userMessage.toLowerCase();
    const asksForFileContent =
      /code\.read/iu.test(userMessage)
      || /文件|内容|描述|讲了什么|干了什么|做了什么|主要/u.test(userMessage);
    const pathLooksLikeFile = extname(normalizedPath).length > 0
      || /\.[A-Za-z0-9_-]+$/u.test(basename(normalizedPath));
    if (!asksForFileContent || !pathLooksLikeFile) {
      return nextRequest;
    }
    return {
      ...nextRequest,
      capabilityKey: "code.read",
      input: {
        ...nextRequest.input,
        path: normalizedPath,
      },
    };
  };

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

    return normalizeCodeReadIntent(request);
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

export function extractResponseTextFromPartialEnvelope(buffer: string): string | undefined {
  const match = /"responseText"\s*:\s*"/u.exec(buffer);
  if (!match) {
    return undefined;
  }
  let index = match.index + match[0].length;
  let output = "";

  while (index < buffer.length) {
    const char = buffer[index];
    if (char === "\"") {
      return output;
    }
    if (char === "\\") {
      const next = buffer[index + 1];
      if (next === undefined) {
        return output;
      }
      if (next === "u") {
        const hex = buffer.slice(index + 2, index + 6);
        if (!/^[0-9a-fA-F]{4}$/u.test(hex)) {
          return output;
        }
        output += String.fromCharCode(Number.parseInt(hex, 16));
        index += 6;
        continue;
      }
      const simpleEscapeMap: Record<string, string> = {
        "\"": "\"",
        "\\": "\\",
        "/": "/",
        b: "\b",
        f: "\f",
        n: "\n",
        r: "\r",
        t: "\t",
      };
      output += simpleEscapeMap[next] ?? next;
      index += 2;
      continue;
    }
    output += char;
    index += 1;
  }

  return output;
}

export function extractReplyResponseTextFromPartialEnvelope(buffer: string): string | undefined {
  const actionMatch = /"action"\s*:\s*"([^"]*)"/u.exec(buffer);
  if (!actionMatch || actionMatch[1] !== "reply") {
    return undefined;
  }
  return extractResponseTextFromPartialEnvelope(buffer);
}

export function stripCodeFences(value: string): string {
  return value.replace(/```[a-zA-Z0-9_-]*\n?/gu, "").replace(/```/gu, "").trim();
}

const ESCAPED_DISPLAY_SEQUENCE_PATTERN = /\\(?:r\\n|n\\n|r|n|t|u[0-9a-fA-F]{4})/u;

function decodeEscapedDisplayTextSinglePass(text: string): string {
  return JSON.parse(
    `"${text
      .replace(/"/gu, "\\\"")
      .replace(/\r/gu, "\\r")
      .replace(/\n/gu, "\\n")
      .replace(/\u2028/gu, "\\u2028")
      .replace(/\u2029/gu, "\\u2029")}"`,
  ) as string;
}

function shouldDecodeEscapedDisplayText(text: string): boolean {
  if (!ESCAPED_DISPLAY_SEQUENCE_PATTERN.test(text)) {
    return false;
  }
  if (/\\u[0-9a-fA-F]{4}/u.test(text)) {
    return true;
  }
  if (/\\r\\n|\\n\\n|\\t/u.test(text)) {
    return true;
  }
  const matches = text.match(/\\(?:r\\n|n\\n|r|n|t|u[0-9a-fA-F]{4})/gu) ?? [];
  return matches.length >= 2;
}

export function decodeEscapedDisplayTextMaybe(text: string): string {
  if (!shouldDecodeEscapedDisplayText(text)) {
    return text;
  }

  const preservedPaths: string[] = [];
  let withProtectedPaths = "";
  let index = 0;

  while (index < text.length) {
    const current = text[index];
    const next = text[index + 1];
    const third = text[index + 2];
    const startsWindowsPath = (
      /[A-Za-z]/u.test(current ?? "")
      && next === ":"
      && third === "\\"
    );

    if (!startsWindowsPath) {
      withProtectedPaths += current;
      index += 1;
      continue;
    }

    let cursor = index + 3;
    let path = text.slice(index, cursor);
    let consumedSeparator = false;

    while (cursor < text.length) {
      const char = text[cursor];
      if (/\s/u.test(char)) {
        break;
      }
      if (char !== "\\") {
        path += char;
        cursor += 1;
        continue;
      }

      const escapeLead = text[cursor + 1];
      const escapeTail = text[cursor + 2];
      const looksDisplayEscape = (
        (escapeLead === "n" || escapeLead === "r" || escapeLead === "t")
        && (
          escapeTail === "\\"
          || escapeTail === undefined
          || /\s/u.test(escapeTail)
          || /[\u2e80-\u9fff]/u.test(escapeTail)
          || /[)\]}>,.;!?:"']/u.test(escapeTail)
        )
      ) || (
        escapeLead === "u"
        && /^[0-9a-fA-F]{4}$/u.test(text.slice(cursor + 2, cursor + 6))
      );

      if (looksDisplayEscape) {
        break;
      }

      consumedSeparator = true;
      path += "\\";
      cursor += 1;
    }

    if (!consumedSeparator) {
      withProtectedPaths += current;
      index += 1;
      continue;
    }

    const token = `__PRAXIS_ESCAPED_PATH_${preservedPaths.length}__`;
    preservedPaths.push(path);
    withProtectedPaths += token;
    index = cursor;
  }

  let decoded = withProtectedPaths;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (!shouldDecodeEscapedDisplayText(decoded)) {
      break;
    }
    try {
      const next = decodeEscapedDisplayTextSinglePass(decoded);
      if (next === decoded) {
        break;
      }
      decoded = next;
    } catch {
      break;
    }
  }

  return preservedPaths.reduce(
    (value, preserved, index) => value.replace(`__PRAXIS_ESCAPED_PATH_${index}__`, preserved),
    decoded,
  );
}

export function resolveReasoningEffort(
  plan: AgentRoutePlan,
): Exclude<AgentReasoningEffort, "none"> | undefined {
  return plan.reasoning === "none" ? undefined : plan.reasoning;
}

export function readPositiveInteger(value: unknown): number | undefined {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : undefined;
}

export function readNonNegativeInteger(value: unknown): number | undefined {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : undefined;
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
  return resolve(resolveLiveReportsDir(), `live-agent-chat.${timestamp}.jsonl`);
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
  const stripped = stripCodeFences(cleaned).trim();
  const candidates = [...new Set([cleaned, stripped].filter((value) => value.length > 0))];

  for (const candidate of candidates) {
    const looksEnvelopeLike = candidate.startsWith("{") || candidate.includes("\"responseText\"");
    if (!looksEnvelopeLike) {
      continue;
    }
    try {
      const parsed = JSON.parse(extractFirstJsonObject(candidate)) as Record<string, unknown>;
      if (typeof parsed.responseText === "string" && parsed.responseText.trim()) {
        return parsed.responseText.trim();
      }
    } catch {
      const partial = extractResponseTextFromPartialEnvelope(candidate)?.trim();
      if (partial) {
        return partial;
      }
      continue;
    }
    const partial = extractResponseTextFromPartialEnvelope(candidate)?.trim();
    if (partial) {
      return partial;
    }
  }
  return cleaned;
}

export function toTapAgentModelRoute(
  plan: AgentRoutePlan,
  roleId?: Parameters<typeof loadResolvedRoleConfig>[0],
): Partial<TapAgentModelRoute> {
  const resolved = roleId ? loadResolvedRoleConfig(roleId as Parameters<typeof loadResolvedRoleConfig>[0]) : null;
  const provider = resolved?.profile.provider ?? "openai";
  const variant = resolved?.profile.route.apiStyle === "messages" || resolved?.profile.route.apiStyle === "generateContent"
    ? "provider-native"
    : "responses";
  const routeKind = resolved
    ? resolveProviderRouteKind({
      provider: resolved.profile.provider,
      baseURL: resolved.profile.route.baseURL,
      apiStyle: resolved.profile.route.apiStyle,
      variant,
    })
    : "openai_responses";
  const sanitized = sanitizeProviderRouteFeatureOptions(routeKind, {
    reasoningEffort: resolveReasoningEffort(plan),
    serviceTier: plan.serviceTier,
  });
  return {
    provider,
    model: plan.model,
    layer: "api",
    variant,
    roleId,
    reasoningEffort: sanitized.reasoningEffort,
    serviceTier: sanitized.serviceTier,
    maxOutputTokens: plan.maxOutputTokens,
  };
}
