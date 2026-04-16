import { randomUUID } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { promisify } from "node:util";

import {
  buildBrowserGroundingEvidenceText,
  browserTaskRequiresPageNativeEvidence,
  browserTaskWantsGoldPrice,
  shouldKeepBrowserTaskBlockedByObstruction,
  type BrowserTurnSummary,
  updateBrowserTurnSummary,
} from "./live-agent-chat/browser-grounding.js";
import {
  buildInitArtifactMarkdownFromResult,
  buildInitCompilerPrompt,
  createFallbackInitCompilerResult,
  loadInitCompilerRepoExcerpts,
  parseInitArtifact,
  parseInitCompilerResult,
} from "./live-agent-chat/init-compiler.js";
import {
  parseHumanGateDecisionEnvelope,
} from "./live-agent-chat/human-gate-envelope.js";
import { runCmpSidecarTurn } from "./live-agent-chat/cmp-sidecar.js";
import {
  createCmpFiveAgentConfiguration,
  createCmpFiveAgentRuntime,
  createCmpRoleLiveLlmModelExecutor,
} from "./cmp-five-agent/index.js";
import { createGitCliCmpGitBackend } from "./cmp-git/index.js";
import { createRedisCliCmpRedisMqAdapter } from "./cmp-mq/index.js";
import { createCmpDbSqliteLiveExecutor } from "./cmp-db/index.js";
import {
  executeModelInference,
  type ModelInferenceExecutionParams,
  type ModelInferenceExecutionResult,
} from "./integrations/model-inference.js";
import { discoverLiveSkillOverlayEntries } from "./integrations/rax-skill-index-source.js";
import { discoverMpOverlayArtifacts } from "./integrations/rax-mp-overlay-source.js";
import { loadRepoMemoryOverlaySnapshot } from "./integrations/repo-memory-overlay-source.js";
import {
  buildChatCompletionMessagesFromPromptParts,
  buildResponsesInputFromPromptParts,
  readPromptMessagesMetadata,
} from "./integrations/prompt-message-parts.js";
import {
  registerTapCapabilityFamilyAssembly,
} from "./integrations/tap-capability-family-assembly.js";
import {
  createTapCapabilityUsageIndex,
  renderTapCapabilityUsageIndexForCore,
} from "./tap-availability/index.js";
import {
  buildLiveChatPromptBlocks,
  buildLiveChatPromptMessages,
  createCoreCmpHandoffLines,
  createLiveChatCoreContextualInput,
  createCoreContextEconomyLines,
  createCoreContinuationCompactionLines,
  renderLiveChatPromptAssembly,
  createCoreBoundedOutputLines,
  createCoreBrowserDisciplineLines,
  createCoreActionPlannerContractLines,
  createCoreCapabilityWindowLines,
  createCoreLoopContinuationLines,
  createCoreObjectiveAnchoringLines,
  createCoreSearchDisciplineLines,
  createCoreTaskStatusDisciplineLines,
  createCoreUserInputContractLines,
  createCoreValidationLadderLines,
  createCoreWorkflowProtocolLines,
} from "./core-prompt/index.js";
import {
  createGoalSource,
} from "./goal/index.js";
import {
  createInvocationPlanFromCapabilityIntent,
} from "./capability-invocation/index.js";
import {
  createAgentCapabilityProfile,
  createAgentCoreRuntime,
  createMpLanceTableNames,
} from "./index.js";
import type { DialogueTurn } from "./live-agent-chat/shared.js";
import {
  applyCliDefaultsToCapabilityRequest,
  applyLiveChatRuntimeConfig,
  buildDocReadCompletionAnswer,
  buildSpreadsheetReadCompletionAnswer,
  createCapabilityFamilyTelemetry,
  createCoreContextSnapshot,
  createLiveChatLogPath,
  type DirectInputFileReference,
  type DirectInputImageAttachment,
  type DirectInputPastedContentAttachment,
  type CoreTaskStatus,
  type CoreContextSnapshot,
  estimateContextTokens,
  extractDocReadFactSummary,
  extractSpreadsheetReadFactSummary,
  extractResponseTextMaybe,
  extractReplyResponseTextFromPartialEnvelope,
  extractTextFromResponseLike,
  formatElapsed,
  formatNowStamp,
  formatTranscript,
  inferStreamLabel,
  extractResponseTextFromPartialEnvelope,
  type CmpPanelSnapshotPayload,
  type CmpTurnArtifacts,
  type CoreActionEnvelope,
  type CoreCapabilityRequest,
  type CoreTurnArtifacts,
  LIVE_CHAT_MODEL_PLAN,
  LiveChatLogger,
  type LiveCliState,
  type MpPanelSnapshotEntry,
  type MpPanelSnapshotPayload,
  LIVE_CHAT_TAP_OVERRIDE,
  normalizeCoreTaskStatus,
  type ParsedTapRequest,
  parseCliOptions,
  parseCoreActionEnvelope,
  parseDirectInitRequestEnvelope,
  parseDirectQuestionAnswerEnvelope,
  parseDirectUserInputEnvelope,
  parseTapRequest,
  deriveQuestionnairePayloadFromReplyText,
  type QuestionAskPayload,
  readPositiveInteger,
  readString,
  resolveReasoningEffort,
  shouldStopCoreCapabilityLoop,
  shouldPrintStreamLabel,
  summarizeCapabilityRequestForLog,
  summarizeToolOutputForCore,
  trimStructuredValue,
  toTapAgentModelRoute,
  truncate,
  updateLiveCliViewerSnapshots,
  withStopwatch,
} from "./live-agent-chat/shared.js";
import {
  createDirectFallbackReader,
  printCmpArtifacts,
  printCoreArtifacts,
  printDirectAnswer,
  printAgentsViewPlaceholder,
  printCmpViewerSnapshot,
  printDirectBullet,
  printDirectCapabilities,
  printInitViewPlaceholder,
  printLanguageViewPlaceholder,
  printModelView,
  printMpViewerSnapshot,
  printPermissionsView,
  printDirectStatus,
  printResumeViewPlaceholder,
  printDirectSub,
  printEvents,
  printHelp,
  printHistory,
  printStartup,
  printStartupDirect,
  printStatus,
  printTapArtifacts,
  printWorkspaceView,
  promptDirectInputBox,
  readDirectFallbackLine,
} from "./live-agent-chat/ui.js";
import { rewindDialogueTranscript } from "./live-agent-chat/rewind.js";
import type {
  HumanGatePanelEntry,
} from "./tui-input/human-gate-panel.js";
import {
  createRaxCmpConfig,
  createRaxCmpFacade,
  createRaxMpFacade,
  rax,
  type RaxCmpPort,
} from "../rax/index.js";
import {
  createOpenAIClient,
  isChatgptCodexBackendBaseURL,
  loadOpenAILiveConfig,
  prepareResponsesParamsForOpenAIAuth,
} from "../rax/live-config.js";
import {
  isRaxcodeRoleId,
  loadRaxcodeConfigFile,
  loadRaxcodeRuntimeConfigSnapshot,
  resolveConfiguredWorkspaceRoot,
  RaxcodeConfigError,
  writeRaxcodeConfigFile,
} from "../raxcode-config.js";
import { refreshOpenAIOAuthIfNeeded } from "../raxcode-openai-auth.js";
import {
  resolveLiveReportsDir,
  resolveWorkspaceRaxodeAgentsDir,
  resolveWorkspaceRaxodeRoot,
} from "../runtime-paths.js";
import {
  readWorkspaceRaxodeGitReadback,
} from "./tui-input/workspace-raxode-store.js";

let CURRENT_UI_MODE: "full" | "direct" = "full";
const execFile = promisify(execFileCallback);

interface CapabilityPanelSnapshotEntry {
  capabilityKey: string;
  description: string;
  bindingState: string;
}

interface CapabilityPanelSnapshotGroup {
  groupKey: string;
  title: string;
  count: number;
  entries: CapabilityPanelSnapshotEntry[];
}

interface CapabilityPanelSnapshotPayload {
  summaryLines: string[];
  status: "booting" | "ready" | "empty" | "degraded";
  registeredCount: number;
  familyCount: number;
  blockedCount: number;
  pendingHumanGateCount?: number;
  pendingHumanGates?: HumanGatePanelEntry[];
  groups: CapabilityPanelSnapshotGroup[];
}

interface InitPanelSnapshotPayload {
  summaryLines: string[];
  status:
    | "idle"
    | "awaiting_seed"
    | "analyzing_repo"
    | "asking_questions"
    | "synthesizing_agents"
    | "registering_git"
    | "completed"
    | "ready"
    | "failed"
    | "degraded";
  initState?: "uninitialized" | "partial" | "initialized";
  repoState?: "empty" | "non_empty";
  gitState?: "unregistered" | "registering" | "registered" | "failed";
  artifactPath?: string;
  compiledSessionPreamble?: string;
  completionSummary?: string;
  seedText?: string;
  emptyReason?: string;
}

interface QuestionPanelSnapshotPayload {
  status: "idle" | "active";
  title?: string;
  instruction?: string;
  sourceKind?: "init" | "core";
  requestId?: string;
  submitLabel?: string;
  questions?: QuestionAskPayload["questions"];
  emptyReason?: string;
}

interface WorkspaceInitStateRecord {
  status: "partial" | "initialized";
  initializedAt: string;
  gitRegistered: boolean;
  projectId: string;
  defaultAgentId: string;
  branchFamily?: {
    workBranchName: string;
    cmpBranchName: string;
    mpBranchName: string;
    tapBranchName: string;
  };
  agentsPath?: string;
  artifactPath?: string;
}

interface CliUsageCounts {
  inputTokens?: number;
  outputTokens?: number;
  thinkingTokens?: number;
  estimated?: boolean;
}

function mergeCliUsageCounts(
  left: CliUsageCounts | undefined,
  right: CliUsageCounts | undefined,
): CliUsageCounts | undefined {
  if (!left && !right) {
    return undefined;
  }
  return {
    inputTokens: (left?.inputTokens ?? 0) + (right?.inputTokens ?? 0) || undefined,
    outputTokens: (left?.outputTokens ?? 0) + (right?.outputTokens ?? 0) || undefined,
    thinkingTokens: (left?.thinkingTokens ?? 0) + (right?.thinkingTokens ?? 0) || undefined,
    estimated: left?.estimated === true || right?.estimated === true || undefined,
  };
}

function readCliUsageCounts(raw: unknown): CliUsageCounts | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const record = raw as Record<string, unknown>;
  const usage = record.usage && typeof record.usage === "object"
    ? record.usage as Record<string, unknown>
    : record;
  const inputTokens = typeof usage.input_tokens === "number"
    ? usage.input_tokens
    : typeof usage.prompt_tokens === "number"
      ? usage.prompt_tokens
      : typeof usage.inputTokens === "number"
        ? usage.inputTokens
        : typeof usage.promptTokenCount === "number"
          ? usage.promptTokenCount
          : undefined;
  const outputTokens = typeof usage.output_tokens === "number"
    ? usage.output_tokens
    : typeof usage.completion_tokens === "number"
      ? usage.completion_tokens
      : typeof usage.outputTokens === "number"
        ? usage.outputTokens
        : typeof usage.candidatesTokenCount === "number"
          ? usage.candidatesTokenCount
          : undefined;
  const outputDetails = usage.output_tokens_details && typeof usage.output_tokens_details === "object"
    ? usage.output_tokens_details as Record<string, unknown>
    : undefined;
  const thinkingTokens = typeof usage.reasoning_tokens === "number"
    ? usage.reasoning_tokens
    : typeof usage.thinking_tokens === "number"
      ? usage.thinking_tokens
      : typeof usage.thoughtsTokenCount === "number"
        ? usage.thoughtsTokenCount
        : typeof outputDetails?.reasoning_tokens === "number"
          ? outputDetails.reasoning_tokens
          : undefined;
  if (inputTokens === undefined && outputTokens === undefined && thinkingTokens === undefined) {
    return undefined;
  }
  return {
    inputTokens,
    outputTokens,
    thinkingTokens,
  };
}

function readCliUsageCountsFromMetadata(metadata: unknown): CliUsageCounts | undefined {
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }
  const usage = readCliUsageCounts((metadata as Record<string, unknown>).usage);
  return usage ?? readCliUsageCounts(metadata);
}

async function executeCliModelInference(
  params: ModelInferenceExecutionParams,
): Promise<ModelInferenceExecutionResult> {
  const metadata = params.intent.frame.metadata ?? {};
  const provider = readString(metadata.provider) ?? "openai";
  const variant = readString(metadata.variant) ?? "responses";
  const roleId = typeof metadata.roleId === "string" && isRaxcodeRoleId(metadata.roleId)
    ? metadata.roleId
    : "core.main";
  const model = readString(metadata.model) ?? loadOpenAILiveConfig(roleId).model;
  const reasoningEffort = readString(metadata.reasoningEffort) as string | undefined;
  const serviceTier = readString(metadata.serviceTier) as "fast" | undefined;
  const maxOutputTokens = readPositiveInteger(metadata.maxOutputTokens);
  const promptMessages = readPromptMessagesMetadata(metadata.promptMessages);
  const inputImageUrls = Array.isArray(metadata.inputImageUrls)
    ? metadata.inputImageUrls
      .filter((entry): entry is string => typeof entry === "string" && entry.startsWith("data:image/"))
    : undefined;

  if (provider !== "openai" || (variant !== "responses" && variant !== "chat_completions_compat")) {
    return executeModelInference(params);
  }

  await refreshOpenAIOAuthIfNeeded();
  const config = loadOpenAILiveConfig(roleId);
  const client = createOpenAIClient(config);
  const label = inferStreamLabel(params);
  const logger = metadata.cliLogger instanceof LiveChatLogger
    ? metadata.cliLogger
    : undefined;
  const turnIndex = readPositiveInteger(metadata.cliTurnIndex);
  const uiMode = metadata.cliUiMode === "direct"
    ? "direct"
    : CURRENT_UI_MODE;
  const printStream = shouldPrintStreamLabel(uiMode, label);
  const preferBuffered =
    label === "core/action"
    && uiMode !== "direct"
    && !isChatgptCodexBackendBaseURL(config.baseURL);
  const isFinalAssistantStream = label === "core/model.infer";
  const shouldEmitReplyAssistantDelta = uiMode === "direct" && label === "core/action";
  const startedAt = Date.now();
  const startStamp = formatNowStamp();
  let printedHeader = false;
  let text = "";
  let emittedAssistantText = "";
  let capturedUsage: CliUsageCounts | undefined;

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
    serviceTier: serviceTier ?? null,
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
    if (fallbackText) {
      const replyText = shouldEmitReplyAssistantDelta
        ? extractReplyResponseTextFromPartialEnvelope(fallbackText)
        : undefined;
      if (replyText) {
        await logger?.log("assistant_delta", {
          turnIndex,
          label,
          text: replyText,
          done: true,
        });
      } else {
        await logger?.log(isFinalAssistantStream ? "assistant_delta" : "stream_text", {
          turnIndex,
          label,
          text: fallbackText,
          done: true,
        });
      }
    }
    await logger?.log("stream_end", {
      turnIndex,
      label,
      status: reason,
      elapsedMs: Date.now() - startedAt,
      outputChars: fallbackText.length,
    });
    return fallback;
  };

  const emitAssistantDeltaFromEnvelopeBuffer = async (done: boolean): Promise<void> => {
    if (!isFinalAssistantStream && !shouldEmitReplyAssistantDelta) {
      return;
    }
    const responseText = isFinalAssistantStream
      ? extractResponseTextFromPartialEnvelope(text)
      : extractReplyResponseTextFromPartialEnvelope(text);
    if (!responseText || responseText.length <= emittedAssistantText.length) {
      return;
    }
    const delta = responseText.slice(emittedAssistantText.length);
    emittedAssistantText = responseText;
    await logger?.log("assistant_delta", {
      turnIndex,
      label,
      text: delta,
      done,
    });
  };

  const finishBuffered = async (status: "success" | "buffered_success" | "stream_failed_fallback_buffered" = "success"): Promise<ModelInferenceExecutionResult> => {
    let bufferedText = "";
    let bufferedRaw: Record<string, unknown> | undefined;
    if (variant === "responses") {
      const response = await client.responses.create({
        ...prepareResponsesParamsForOpenAIAuth(
          config,
          {
            model,
            input: buildResponsesInputFromPromptParts({
              instructionText: params.intent.frame.instructionText,
              promptMessages,
              inputImageUrls,
            }),
            stream: false,
            max_output_tokens: maxOutputTokens,
            reasoning: reasoningEffort ? { effort: reasoningEffort } : undefined,
            service_tier: serviceTier,
          },
          params.intent.frame.instructionText,
        ),
      } as never);
      bufferedRaw = response as unknown as Record<string, unknown>;
      bufferedText = extractTextFromResponseLike(bufferedRaw);
      capturedUsage = readCliUsageCounts(bufferedRaw);
    } else {
      const completion = await client.chat.completions.create({
        model,
        messages: buildChatCompletionMessagesFromPromptParts({
          instructionText: params.intent.frame.instructionText,
          promptMessages,
          inputImageUrls,
        }),
        stream: false,
        max_completion_tokens: maxOutputTokens,
        reasoning_effort: reasoningEffort,
        service_tier: serviceTier,
      } as never);
      const choice = Array.isArray(completion.choices) ? completion.choices[0] : undefined;
      const message = choice && typeof choice === "object"
        ? (choice as { message?: { content?: unknown } }).message
        : undefined;
      bufferedText = typeof message?.content === "string" ? message.content : "";
      bufferedRaw = completion as unknown as Record<string, unknown>;
      capturedUsage = readCliUsageCounts(bufferedRaw);
    }

    if (!bufferedText.trim()) {
      return fallbackToManagedInference("empty_buffered");
    }

    if (printStream && bufferedText) {
      console.log(`[stream ${label}] ${bufferedText}`);
    }
    if (isFinalAssistantStream || shouldEmitReplyAssistantDelta) {
      text = bufferedText;
      await emitAssistantDeltaFromEnvelopeBuffer(true);
    } else {
      await logger?.log("stream_text", {
        turnIndex,
        label,
        text: bufferedText,
        done: true,
      });
    }
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
          ...(capturedUsage ? { usage: capturedUsage } : {}),
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
        ...prepareResponsesParamsForOpenAIAuth(
          config,
          {
            model,
            input: buildResponsesInputFromPromptParts({
              instructionText: params.intent.frame.instructionText,
              promptMessages,
              inputImageUrls,
            }),
            stream: true,
            max_output_tokens: maxOutputTokens,
            reasoning: reasoningEffort ? { effort: reasoningEffort } : undefined,
            service_tier: serviceTier,
          },
          params.intent.frame.instructionText,
        ),
      } as never);

      for await (const event of stream as unknown as AsyncIterable<Record<string, unknown>>) {
        if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
          ensureHeader();
          text += event.delta;
          if (printStream) {
            output.write(event.delta);
          }
          if (isFinalAssistantStream || shouldEmitReplyAssistantDelta) {
            await emitAssistantDeltaFromEnvelopeBuffer(false);
          }
        } else if (event.type === "response.output_text.done" && typeof event.text === "string" && !text.trim()) {
          ensureHeader();
          text = event.text;
          if (printStream) {
            output.write(event.text);
          }
          if (isFinalAssistantStream || shouldEmitReplyAssistantDelta) {
            await emitAssistantDeltaFromEnvelopeBuffer(true);
          }
        } else if (event.type === "response.completed" && event.response && typeof event.response === "object") {
          capturedUsage = readCliUsageCounts(event.response);
        }
      }
    } else {
      const stream = await client.chat.completions.create({
        model,
        messages: buildChatCompletionMessagesFromPromptParts({
          instructionText: params.intent.frame.instructionText,
          promptMessages,
          inputImageUrls,
        }),
        stream: true,
        max_completion_tokens: maxOutputTokens,
        reasoning_effort: reasoningEffort,
        service_tier: serviceTier,
      } as never);

      for await (const chunk of stream as unknown as AsyncIterable<Record<string, unknown>>) {
        capturedUsage = readCliUsageCounts(chunk) ?? capturedUsage;
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
          if (isFinalAssistantStream || shouldEmitReplyAssistantDelta) {
            await emitAssistantDeltaFromEnvelopeBuffer(false);
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
  if (!isFinalAssistantStream && !shouldEmitReplyAssistantDelta) {
    await logger?.log("stream_text", {
      turnIndex,
      label,
      text,
    });
  } else {
    await emitAssistantDeltaFromEnvelopeBuffer(true);
  }
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
        ...(capturedUsage ? { usage: capturedUsage } : {}),
      },
    },
  };
}

function buildCoreUserInput(input: {
  userMessage: string;
  transcript: DialogueTurn[];
  cmp?: CmpTurnArtifacts;
  runtime: LiveCliState["runtime"];
  toolResultText?: string;
  capabilityHistoryText?: string;
  groundingEvidenceText?: string;
  forceFinalAnswer?: boolean;
  capabilityLoopIndex?: number;
  maxCapabilityLoops?: number;
  previousTaskStatus?: CoreTaskStatus;
  previousReplyText?: string;
}): string {
  return createCoreUserInputAssembly(input).promptText;
}

function createCoreUserInputAssembly(input: {
  userMessage: string;
  transcript: DialogueTurn[];
  cmp?: CmpTurnArtifacts;
  runtime: LiveCliState["runtime"];
  skillEntries?: import("./core-prompt/types.js").CoreOverlayIndexEntryV1[];
  memoryEntries?: import("./core-prompt/types.js").CoreOverlayIndexEntryV1[];
  mpRoutedPackage?: import("./core-prompt/types.js").CoreMpRoutedPackageV1;
  toolResultText?: string;
  capabilityHistoryText?: string;
  groundingEvidenceText?: string;
  forceFinalAnswer?: boolean;
  capabilityLoopIndex?: number;
  maxCapabilityLoops?: number;
  previousTaskStatus?: CoreTaskStatus;
  previousReplyText?: string;
}): {
  promptText: string;
  promptBlocks: import("./types/kernel-goal.js").GoalPromptBlock[];
  promptMessages: Array<{ role: "system" | "developer" | "user"; content: string }>;
} {
  const recentTurns = input.transcript.slice(-6);
  const availableCapabilities = input.runtime.capabilityPool
    .listCapabilities()
    .map((manifest) => manifest.capabilityKey)
    .join(", ");
  const capabilityUsageIndexText = renderTapCapabilityUsageIndexForCore(
    createTapCapabilityUsageIndex({
      availableCapabilityKeys: input.runtime.capabilityPool
        .listCapabilities()
        .map((manifest) => manifest.capabilityKey),
    }),
  );
  const contextualInput = createLiveChatCoreContextualInput({
    userMessage: input.userMessage,
    transcript: input.transcript,
    cmp: input.cmp,
    mpRoutedPackage: input.mpRoutedPackage,
    availableCapabilitiesText: `Currently registered TAP capabilities: ${availableCapabilities || "(none)"}.`,
    capabilityUsageIndexText,
    skillEntries: input.skillEntries,
    memoryEntries: input.memoryEntries,
    capabilityHistoryText: input.capabilityHistoryText,
    toolResultText: input.toolResultText,
    groundingEvidenceText: input.groundingEvidenceText,
  });
  const developmentInput = {
    tapMode: LIVE_CHAT_TAP_OVERRIDE.requestedMode ?? "bapr",
    automationDepth: LIVE_CHAT_TAP_OVERRIDE.automationDepth ?? "default",
    uiMode: "direct" as const,
  };
  const modeInstructions = [
      "You are answering inside the Praxis live CLI harness.",
      "Use the CMP package summary below as the current executable context.",
      "Execution mode is active.",
      "TAP governance is configured in bapr + prefer_auto for this CLI.",
      ...createCoreCmpHandoffLines({
        cmpContextPackage: contextualInput.cmpContextPackage,
        forceFinalAnswer: input.forceFinalAnswer,
      }),
      ...createCoreObjectiveAnchoringLines({
        forceFinalAnswer: input.forceFinalAnswer,
      }),
      ...createCoreWorkflowProtocolLines({
        mode: "user_input",
        forceFinalAnswer: input.forceFinalAnswer,
      }),
      ...createCoreCapabilityWindowLines({
        mode: "user_input",
        forceFinalAnswer: input.forceFinalAnswer,
      }),
      "Your job is to finish the user task, not merely to make one tool call.",
      "If the task is not yet complete and another registered capability can move it forward, keep issuing capability_call steps until the task is actually done.",
      "Only stop and ask the user for help when you have determined that both your own reasoning and the currently registered TAP capability window cannot make further safe progress.",
      ...createCoreTaskStatusDisciplineLines({
        forceFinalAnswer: input.forceFinalAnswer,
        incompleteActionPhrase: "emit action=capability_call instead of stopping with action=reply",
      }),
      ...createCoreBrowserDisciplineLines({
        forceFinalAnswer: input.forceFinalAnswer,
      }),
      ...createCoreValidationLadderLines({
        forceFinalAnswer: input.forceFinalAnswer,
      }),
      ...createCoreContextEconomyLines({
        forceFinalAnswer: input.forceFinalAnswer,
      }),
      ...createCoreContinuationCompactionLines({
        forceFinalAnswer: input.forceFinalAnswer,
      }),
      input.groundingEvidenceText
        ? "When browser grounding evidence is provided below, treat it as tool-derived facts rather than speculation."
        : "",
      input.groundingEvidenceText
        ? "The grounding evidence block is normalized JSON with pages[] and facts[]. Prefer verified facts over weaker candidate hints."
        : "",
      input.groundingEvidenceText
        ? "If the grounding evidence already contains the exact value/time/source needed to satisfy the user, answer from that evidence and mark the task completed instead of asking the user to continue manually."
        : "",
      input.groundingEvidenceText
        ? "Do not say the value is unavailable if the grounding evidence below already contains a verified price, timestamp, page title, or source URL."
        : "",
      input.groundingEvidenceText
        ? "If the evidence shows only blockers or candidates and a safe next tool step still exists, keep the task incomplete or blocked instead of claiming completion."
        : "",
      input.groundingEvidenceText
        ? "If the user requires facts that must come from the visible target page itself, such as a page-displayed timestamp or an on-page quote, do not use search results or external summaries as a substitute for those page-native facts."
        : "",
      ...createCoreLoopContinuationLines({
        forceFinalAnswer: input.forceFinalAnswer,
        toolResultPresent: Boolean(input.toolResultText),
        capabilityLoopIndex: input.capabilityLoopIndex,
        maxCapabilityLoops: input.maxCapabilityLoops,
        previousTaskStatus: input.previousTaskStatus,
        previousReplyText: input.previousReplyText ? truncate(input.previousReplyText, 180) : undefined,
      }),
      input.forceFinalAnswer
        ? "A TAP tool result is already available. Do not emit another tool request. Answer the user directly."
        : "If the user asks to inspect or operate the local workspace/system, or asks for current online information, emit a structured action envelope immediately whenever a fitting capability exists.",
    ];
  const contractInstructions = [
      ...createCoreUserInputContractLines({
        forceFinalAnswer: input.forceFinalAnswer,
      }),
      ...createCoreSearchDisciplineLines({
        mode: "user_input",
        forceFinalAnswer: input.forceFinalAnswer,
      }),
      ...createCoreBoundedOutputLines({
        mode: "user_input",
        forceFinalAnswer: input.forceFinalAnswer,
      }),
    ];
  return {
    promptText: renderLiveChatPromptAssembly({
      developmentInput,
      contextualInput,
      modeInstructions,
      contractInstructions,
    }),
    promptBlocks: buildLiveChatPromptBlocks({
      developmentInput,
      contextualInput,
      modeInstructions,
      contractInstructions,
    }),
    promptMessages: buildLiveChatPromptMessages({
      developmentInput,
      contextualInput,
      modeInstructions,
      contractInstructions,
    }),
  };
}

function buildCoreActionPlannerInstructionText(
  state: LiveCliState,
  userMessage: string,
  cmp?: CmpTurnArtifacts,
): string {
  return createCoreActionPlannerAssembly(state, userMessage, cmp).promptText;
}

function createCoreActionPlannerAssembly(
  state: LiveCliState,
  userMessage: string,
  cmp?: CmpTurnArtifacts,
): {
  promptText: string;
  promptBlocks: import("./types/kernel-goal.js").GoalPromptBlock[];
  promptMessages: Array<{ role: "system" | "developer" | "user"; content: string }>;
} {
  const availableCapabilities = state.runtime.capabilityPool
    .listCapabilities()
    .map((manifest) => manifest.capabilityKey);
  const capabilityUsageIndexText = renderTapCapabilityUsageIndexForCore(
    createTapCapabilityUsageIndex({
      availableCapabilityKeys: availableCapabilities,
    }),
  );
  const developmentInput = {
    tapMode: LIVE_CHAT_TAP_OVERRIDE.requestedMode ?? "bapr",
    automationDepth: LIVE_CHAT_TAP_OVERRIDE.automationDepth ?? "default",
    uiMode: "direct" as const,
  };
  const contextualInput = createLiveChatCoreContextualInput({
    userMessage,
    transcript: state.transcript,
    cmp,
    mpRoutedPackage: state.mpRoutedPackage,
    availableCapabilitiesText: `Available capabilities: ${availableCapabilities.join(", ") || "(none)"}`,
    capabilityUsageIndexText,
    skillEntries: state.skillOverlayEntries,
    memoryEntries: state.memoryOverlayEntries,
  });
  const modeInstructions = [
      "Return strict JSON only.",
      "Choose the next action for the frontstage core agent.",
      "Execution mode is active.",
      "TAP governance is bapr + prefer_auto for this CLI.",
      ...createCoreCmpHandoffLines({
        cmpContextPackage: contextualInput.cmpContextPackage,
      }),
      ...createCoreObjectiveAnchoringLines({}),
      ...createCoreWorkflowProtocolLines({
        mode: "action_planner",
      }),
      ...createCoreCapabilityWindowLines({
        mode: "action_planner",
      }),
      "Your goal is to actually finish the user task, not just to emit a single tool call.",
      "If the current task is still incomplete and another available capability can advance it, keep emitting capability_call actions until the task is genuinely done.",
      "Only fall back to a direct reply that asks the user for help after you have determined that neither core reasoning nor the currently registered TAP capability window can safely make further progress.",
      ...createCoreTaskStatusDisciplineLines({
        incompleteActionPhrase: "choose action=capability_call instead of action=reply",
      }),
      ...createCoreValidationLadderLines({}),
      ...createCoreContextEconomyLines({}),
      ...createCoreContinuationCompactionLines({}),
      "If a fitting capability exists, choose capability_call instead of reply.",
      ...createCoreSearchDisciplineLines({
        mode: "action_planner",
      }),
      ...createCoreBoundedOutputLines({
        mode: "action_planner",
      }),
      ...createCoreBrowserDisciplineLines({}),
      "If the recent transcript shows a capability failure and the user asks you to retry, try another suitable available capability or a revised retry, rather than asking them to restate the request.",
    ];
  const contractInstructions = [
      ...createCoreActionPlannerContractLines(),
      "User message:",
      userMessage,
    ];
  return {
    promptText: renderLiveChatPromptAssembly({
      developmentInput,
      contextualInput,
      modeInstructions,
      contractInstructions,
    }),
    promptBlocks: buildLiveChatPromptBlocks({
      developmentInput,
      contextualInput,
      modeInstructions,
      contractInstructions,
    }),
    promptMessages: buildLiveChatPromptMessages({
      developmentInput,
      contextualInput,
      modeInstructions,
      contractInstructions,
    }),
  };
}

function createCoreContextTelemetry(input: {
  state: LiveCliState;
  config: ReturnType<typeof loadOpenAILiveConfig>;
  promptKind: CoreContextSnapshot["promptKind"];
  promptText: string;
}): CoreContextSnapshot {
  return createCoreContextSnapshot({
    provider: "openai",
    model: LIVE_CHAT_MODEL_PLAN.core.model,
    promptKind: input.promptKind,
    promptText: input.promptText,
    transcriptText: formatTranscript(input.state.transcript.slice(-6)),
    configuredWindowTokens: input.config.contextWindowTokens,
    routePlanWindowTokens: LIVE_CHAT_MODEL_PLAN.core.contextWindowTokens,
    maxOutputTokens: LIVE_CHAT_MODEL_PLAN.core.maxOutputTokens,
  });
}

async function runCoreModelPass(input: {
  state: LiveCliState;
  userInput: string;
  promptBlocks?: import("./types/kernel-goal.js").GoalPromptBlock[];
  promptMessages?: Array<{ role: "system" | "developer" | "user"; content: string }>;
  cmp?: CmpTurnArtifacts;
  config: ReturnType<typeof loadOpenAILiveConfig>;
  inputImageUrls?: string[];
  reasoningEffortOverride?: string;
}): Promise<{
  runId: string;
  answer: string;
  dispatchStatus: string;
  capabilityKey?: string;
  capabilityResultStatus?: string;
  usage?: CliUsageCounts;
  eventTypes: string[];
}> {
  const readKernelOutputText = (value: unknown): string | undefined => {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    if (!value || typeof value !== "object") {
      return undefined;
    }
    const record = value as Record<string, unknown>;
    if (typeof record.text === "string" && record.text.trim().length > 0) {
      return record.text.trim();
    }
    const raw = "raw" in record ? record.raw : undefined;
    const extracted = extractTextFromResponseLike(raw);
    return extracted.trim().length > 0 ? extracted.trim() : undefined;
  };

  const source = createGoalSource({
    goalId: randomUUID(),
    sessionId: input.state.sessionId,
    userInput: input.userInput,
      metadata: {
        roleId: "core.main",
        provider: "openai",
        model: LIVE_CHAT_MODEL_PLAN.core.model,
        variant: "responses",
        ...(input.promptMessages?.length
          ? { promptMessages: input.promptMessages }
          : {}),
        reasoningEffort: input.reasoningEffortOverride ?? resolveReasoningEffort(LIVE_CHAT_MODEL_PLAN.core),
        serviceTier: LIVE_CHAT_MODEL_PLAN.core.serviceTier,
        cliHarness: "praxis-live-cli",
        cliLogger: input.state.logger,
        cliTurnIndex: input.state.turnIndex,
        cliUiMode: input.state.uiMode,
        ...(input.inputImageUrls?.length
          ? { inputImageUrls: input.inputImageUrls }
          : {}),
        ...(input.cmp ? {
          cmpPackageId: input.cmp.packageId,
          cmpPackageRef: input.cmp.packageRef,
      } : {}),
    },
  });

  if (input.promptBlocks?.length) {
    source.metadata = {
      ...(source.metadata ?? {}),
      promptBlocks: input.promptBlocks,
    };
  }

  const result = await input.state.runtime.runUntilTerminal({
    sessionId: input.state.sessionId,
    source,
    maxSteps: 4,
  });

  const kernelResult = input.state.runtime.readKernelResult(result.outcome.run.runId);
  const kernelOutputText = readKernelOutputText(kernelResult?.output);
  const answer = result.answer?.trim()
    || kernelOutputText
    || (kernelResult?.error?.message
      ? `Core 模型调用失败：${kernelResult.error.message}`
      : kernelResult
        ? `Core 模型调用没有返回正文（status=${kernelResult.status}）。`
        : "Core 模型调用没有返回正文。");
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
    usage: readCliUsageCountsFromMetadata(kernelResult?.metadata),
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
    mode: LIVE_CHAT_TAP_OVERRIDE.requestedMode ?? "bapr",
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
  cmp?: CmpTurnArtifacts,
  inputImageUrls?: string[],
): Promise<{
  envelope: CoreActionEnvelope;
  usage?: CliUsageCounts;
}> {
  const assembly = createCoreActionPlannerAssembly(state, userMessage, cmp);
  const instructionText = assembly.promptText;
  const intent = {
    intentId: randomUUID(),
    sessionId: state.sessionId,
    runId: `${state.sessionId}:core-action:${state.turnIndex}`,
    kind: "model_inference" as const,
    createdAt: new Date().toISOString(),
    priority: "high" as const,
    frame: {
      goalId: `core-action-envelope:${state.turnIndex}`,
      instructionText,
      successCriteria: [],
      failureCriteria: [],
      constraints: [],
      inputRefs: [],
      cacheKey: `core-action-envelope:${randomUUID()}`,
      metadata: {
        roleId: "core.main",
        provider: "openai",
        model: LIVE_CHAT_MODEL_PLAN.core.model,
        variant: "responses",
        promptBlocks: assembly.promptBlocks,
        promptMessages: assembly.promptMessages,
        reasoningEffort: resolveReasoningEffort(LIVE_CHAT_MODEL_PLAN.core),
        serviceTier: LIVE_CHAT_MODEL_PLAN.core.serviceTier,
        streamLabel: "core/action",
        cliLogger: state.logger,
        cliTurnIndex: state.turnIndex,
        cliUiMode: state.uiMode,
        ...(inputImageUrls?.length ? { inputImageUrls } : {}),
      },
    },
  };

  const result = await executeCliModelInference({ intent });
  const text = ((result.result.output as { text?: unknown }).text as string | undefined) ?? "";
  return {
    envelope: parseCoreActionEnvelope(text),
    usage: readCliUsageCountsFromMetadata(result.result.metadata),
  };
}


function createCmpViewerRuntimePort(state: LiveCliState): RaxCmpPort {
  return {
    project: {
      bootstrapProjectInfra(input) {
        return state.runtime.bootstrapCmpProjectInfra(input);
      },
      getBootstrapReceipt(projectId) {
        return state.runtime.getCmpProjectInfraBootstrapReceipt(projectId);
      },
      getInfraProjectState(projectId) {
        return state.runtime.getCmpRuntimeInfraProjectState(projectId);
      },
      getRecoverySummary() {
        return state.runtime.getCmpRuntimeRecoverySummary();
      },
      getProjectRecoverySummary(projectId) {
        return state.runtime.getCmpRuntimeProjectRecoverySummary(projectId);
      },
      getDeliveryTruthSummary(projectId) {
        return state.runtime.getCmpRuntimeDeliveryTruthSummary(projectId);
      },
      createSnapshot() {
        return state.runtime.createCmpRuntimeSnapshot();
      },
      recoverSnapshot(snapshot) {
        return state.runtime.recoverCmpRuntimeSnapshot(snapshot);
      },
      advanceDeliveryTimeouts(input) {
        return state.runtime.advanceCmpMqDeliveryTimeouts(input);
      },
    },
    flow: {
      ingest(input) {
        return state.runtime.ingestRuntimeContext(input);
      },
      commit(input) {
        return state.runtime.commitContextDelta(input);
      },
      resolve(input) {
        return state.runtime.resolveCheckedSnapshot(input);
      },
      materialize(input) {
        return state.runtime.materializeContextPackage(input);
      },
      dispatch(input) {
        return state.runtime.dispatchContextPackage(input);
      },
      requestHistory(input) {
        return state.runtime.requestHistoricalContext(input);
      },
    },
    fiveAgent: {
      getSummary(agentId) {
        return state.runtime.getCmpFiveAgentRuntimeSummary(agentId);
      },
    },
    roles: {
      resolveCapabilityAccess(input) {
        return state.runtime.resolveCmpFiveAgentCapabilityAccess(input);
      },
      dispatchCapability(input) {
        return state.runtime.dispatchCmpFiveAgentCapability(input);
      },
      approvePeerExchange(input) {
        return state.runtime.reviewCmpPeerExchangeApproval(input);
      },
    },
  };
}

function createLiveCmpSessionConfig(input: {
  workspaceRoot: string;
  defaultBranchName?: string;
}) {
  return createRaxCmpConfig({
    projectId: "praxis-live-cli",
    git: {
      repoName: basename(input.workspaceRoot) || "praxis-live-cli",
      repoRootPath: input.workspaceRoot,
      defaultBranchName: input.defaultBranchName,
    },
    db: {
      kind: "sqlite",
      databaseName: resolve(input.workspaceRoot, "memory", "generated", "cmp-db", "cmp.sqlite"),
      schemaName: "main",
    },
    mq: {
      namespaceRoot: "praxis",
    },
  });
}

async function buildCmpPanelSnapshot(state: LiveCliState): Promise<CmpPanelSnapshotPayload> {
  const workspaceRoot = process.cwd();
  const projectId = "praxis-live-cli";
  const records = state.runtime
    .listCmpSectionRecords()
    .filter((record) => record.lifecycle === "persisted" || record.lifecycle === "checked" || record.lifecycle === "pre")
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const entries = records.map((record) => ({
    sectionId: record.sectionId,
    lifecycle: record.lifecycle,
    kind: record.kind,
    agentId: record.agentId,
    ref: readString(record.metadata?.bodyRef)
      ?? record.payloadRefs[0]
      ?? record.sourceAnchors[0]
      ?? record.sectionId,
    updatedAt: record.updatedAt,
  }));
  const cmpFacade = createRaxCmpFacade();
  const bootstrapReceipt = state.runtime.getCmpProjectInfraBootstrapReceipt(projectId);
  const cmpSession = cmpFacade.session.open({
    config: createLiveCmpSessionConfig({
      workspaceRoot,
      defaultBranchName: bootstrapReceipt?.git.defaultBranchName,
    }),
    runtime: createCmpViewerRuntimePort(state),
    control: {
      executionStyle: "manual",
    },
  });
  const readback = await cmpFacade.project.readback({
    session: cmpSession,
    metadata: {
      source: "direct_tui_cmp_viewer",
    },
  });
  const summary = readback.summary;
  const dbTruth = summary?.truthLayers.find((layer) => layer.layer === "db")?.status ?? "unknown";
  const readbackStatus = summary?.statusPanel?.health.readbackStatus ?? summary?.status ?? "unknown";
  const objectModelSectionCount = summary?.objectModel?.sectionCount;
  const truthLines = summary?.truthLayers.map((layer) => `${layer.layer}:${layer.status}`) ?? [];
  const lifecycleSummary = summary?.objectModel?.sectionLifecycleCounts
    ? Object.entries(summary.objectModel.sectionLifecycleCounts)
      .map(([lifecycle, count]) => `${lifecycle}:${count}`)
      .join(", ")
    : "";
  const detailLines = summary?.statusPanel
    ? [
      `truth: ${truthLines.join(", ") || "unknown"}`,
      `health: infra=${summary.statusPanel.health.liveInfraReady ? "ready" : "degraded"} liveReady=${summary.statusPanel.health.liveLlmReadyCount} fallback=${summary.statusPanel.health.liveLlmFallbackCount} failed=${summary.statusPanel.health.liveLlmFailedCount} drift=${summary.statusPanel.health.deliveryDriftCount} expired=${summary.statusPanel.health.expiredDeliveryCount}`,
      `readiness: object=${summary.statusPanel.readiness.objectModel} loop=${summary.statusPanel.readiness.fiveAgentLoop} llm=${summary.statusPanel.readiness.liveLlm} infra=${summary.statusPanel.readiness.liveInfra} final=${summary.statusPanel.readiness.finalAcceptance}`,
    ]
    : (truthLines.length > 0 ? [`truth: ${truthLines.join(", ")}`] : []);
  const roleLines = summary?.statusPanel
    ? Object.entries(summary.statusPanel.roles).map(([role, roleSummary]) =>
      `${role}: count=${roleSummary.count} stage=${roleSummary.latestStage ?? "idle"} live=${roleSummary.liveStatus ?? "unknown"}${roleSummary.semanticSummary ? ` · ${roleSummary.semanticSummary}` : ""}`)
    : [];
  const requestLines = summary?.statusPanel
    ? [
      `requests: peerPending=${summary.statusPanel.requests.pendingPeerApprovalCount} peerApproved=${summary.statusPanel.requests.approvedPeerApprovalCount} reinterventionPending=${summary.statusPanel.requests.reinterventionPendingCount} reinterventionServed=${summary.statusPanel.requests.reinterventionServedCount}`,
    ]
    : [];
  const issueLines = summary?.issues?.slice(0, 3) ?? [];
  const sourceKind = (dbTruth !== "unknown" || readbackStatus !== "unknown")
    ? "cmp_readback"
    : "runtime_fallback";
  const status = sourceKind !== "cmp_readback"
    ? "degraded"
    : readbackStatus === "ready"
      ? (entries.length > 0 ? "ready" : "empty")
      : "degraded";
  const emptyReason = entries.length > 0
    ? undefined
    : sourceKind === "cmp_readback" && readbackStatus === "ready"
      ? "CMP DB truth is healthy but there are no materialized section records to show yet."
      : sourceKind === "cmp_readback"
        ? (issueLines[0] ?? "CMP DB truth is reachable, but CMP readback is not fully healthy yet.")
      : "CMP DB truth is not available in the current runtime yet.";
  return {
    summaryLines: [
      objectModelSectionCount !== undefined
        ? `${objectModelSectionCount} DB-backed sections tracked`
        : `${entries.length} sections tracked`,
      lifecycleSummary || issueLines[0] || "No section lifecycle data yet",
      `db=${dbTruth} readback=${readbackStatus}`,
    ],
    status,
    sourceKind,
    emptyReason,
    truthStatus: dbTruth,
    readbackStatus,
    detailLines,
    roleLines,
    requestLines,
    issueLines,
    entries,
  };
}

function createMpViewerProjectId(cwd: string): string {
  const slug = cwd
    .replace(/[^a-z0-9]+/giu, "-")
    .replace(/^-+|-+$/gu, "")
    .toLowerCase()
    .slice(-48);
  return `project.mp-overlay.${slug || "default"}`;
}

async function loadMpLanceViewerEntries(input: {
  rootPath: string;
  projectId: string;
  agentId: string;
}): Promise<{ entries: MpPanelSnapshotEntry[]; openedTableCount: number }> {
  const lancedb = await import("@lancedb/lancedb") as {
    connect: (uri: string) => Promise<{
      openTable: (name: string) => Promise<{ query: () => { toArray: () => Promise<unknown[]> } }>;
    }>;
  };
  const connection = await lancedb.connect(input.rootPath);
  const tableNames = createMpLanceTableNames({
    projectId: input.projectId,
    agentId: input.agentId,
  });
  const orderedNames = [
    tableNames.projectMemories,
    tableNames.agentMemories,
    tableNames.globalMemories,
  ].filter((value, index, array): value is string => typeof value === "string" && value.length > 0 && array.indexOf(value) === index);
  const rows: Array<Record<string, unknown>> = [];
  let openedTableCount = 0;
  for (const tableName of orderedNames) {
    try {
      const table = await connection.openTable(tableName);
      openedTableCount += 1;
      const tableRows = await table.query().toArray();
      rows.push(...tableRows.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object"));
    } catch {
      continue;
    }
  }

  return {
    openedTableCount,
    entries: rows
    .filter((row) => String(row.projectId ?? "") === input.projectId)
    .sort((left, right) => {
      const leftArchived = String(left.visibilityState ?? "") === "archived" ? 1 : 0;
      const rightArchived = String(right.visibilityState ?? "") === "archived" ? 1 : 0;
      if (leftArchived !== rightArchived) {
        return leftArchived - rightArchived;
      }
      return String(right.updatedAt ?? "").localeCompare(String(left.updatedAt ?? ""));
    })
    .map((row) => {
      const semanticGroupId = typeof row.semanticGroupId === "string" ? row.semanticGroupId : "";
      const sourceStoredSectionId = typeof row.sourceStoredSectionId === "string" ? row.sourceStoredSectionId : "";
      const bodyRef = typeof row.bodyRef === "string" ? row.bodyRef : undefined;
      const memoryKind = typeof row.memoryKind === "string" ? row.memoryKind : "";
      return {
        memoryId: String(row.memoryId ?? ""),
        label: semanticGroupId || sourceStoredSectionId || bodyRef || String(row.memoryId ?? ""),
        summary: [semanticGroupId, sourceStoredSectionId, memoryKind].filter(Boolean).join(" / ") || "memory record",
        agentId: typeof row.agentId === "string" ? row.agentId : undefined,
        scopeLevel: typeof row.scopeLevel === "string" ? row.scopeLevel : undefined,
        updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : undefined,
        bodyRef,
      };
    }),
  };
}

async function buildMpPanelSnapshot(state: LiveCliState): Promise<MpPanelSnapshotPayload> {
  const cwd = process.cwd();
  const rootPath = resolve(cwd, "memory", "generated", "mp-overlay-cache");
  const projectId = createMpViewerProjectId(cwd);
  const agentId = "main";
  const mpFacade = createRaxMpFacade();
  const mpSession = mpFacade.create({
    config: {
      projectId,
      defaultAgentId: agentId,
      lance: {
        rootPath,
      },
    },
  });
  let mpReadbackSummary: Awaited<ReturnType<typeof mpFacade.readback>>["summary"] | undefined;
  try {
    await mpFacade.bootstrap({
      session: mpSession,
      payload: {
        projectId,
        rootPath,
        agentIds: [agentId],
      },
    });
    const readback = await mpFacade.readback({
      session: mpSession,
      projectId,
    });
    mpReadbackSummary = readback.summary;
  } catch {
    // fall through to LanceDB / overlay truth only
  }
  const roleLines = mpReadbackSummary
    ? Object.entries(mpReadbackSummary.statusPanel.roles).map(([role, roleSummary]) =>
      `${role}: count=${roleSummary.count} stage=${roleSummary.latestStage ?? "idle"}`)
    : [];
  const flowLines = mpReadbackSummary
    ? [
      `flow: pendingAlignment=${mpReadbackSummary.statusPanel.flow.pendingAlignmentCount} pendingSupersede=${mpReadbackSummary.statusPanel.flow.pendingSupersedeCount} staleCandidates=${mpReadbackSummary.statusPanel.flow.staleMemoryCandidateCount} passiveReturns=${mpReadbackSummary.statusPanel.flow.passiveReturnCount}`,
      `readiness: lance=${mpReadbackSummary.statusPanel.readiness.lanceTruth} align=${mpReadbackSummary.statusPanel.readiness.freshnessAlignment} quality=${mpReadbackSummary.statusPanel.readiness.memoryQuality} retrieval=${mpReadbackSummary.statusPanel.readiness.retrievalBundle} final=${mpReadbackSummary.statusPanel.readiness.finalAcceptance}`,
    ]
    : ["workflow: mp five-agent readback not observed in the current runtime"];
  const issueLines = mpReadbackSummary?.issues?.slice(0, 3) ?? [];
  try {
    const lancedbSnapshot = await loadMpLanceViewerEntries({
      rootPath,
      projectId,
      agentId,
    });
    const sectionRefCount = lancedbSnapshot.entries.filter((entry) => typeof entry.bodyRef === "string" && entry.bodyRef.length > 0).length;
    const detailLines = [
      `workflow: ${mpReadbackSummary?.status ?? "unknown"} receipt=${mpReadbackSummary?.receiptAvailable ? "ready" : "missing"} tables=${mpReadbackSummary?.tableCount ?? 0}`,
      `records: viewer=${lancedbSnapshot.entries.length} storedSectionRefs=${sectionRefCount}`,
      ...flowLines,
    ];
    if (lancedbSnapshot.openedTableCount > 0) {
      return {
        summaryLines: [
          lancedbSnapshot.entries.length > 0
            ? "LanceDB-backed MP memory records are available."
            : "LanceDB is reachable but no project memory records were found.",
          `source=lancedb · ${rootPath}`,
          `${lancedbSnapshot.entries.length} memory records`,
        ],
        status: lancedbSnapshot.entries.length > 0
          ? (mpReadbackSummary?.status === "ready" ? "ready" : "degraded")
          : "empty",
        sourceKind: "lancedb",
        sourceClass: "lancedb",
        emptyReason: lancedbSnapshot.entries.length > 0
          ? undefined
          : "No LanceDB memory records were found for the current project.",
        rootPath,
        recordCount: lancedbSnapshot.entries.length,
        detailLines,
        roleLines,
        flowLines,
        issueLines,
        entries: lancedbSnapshot.entries,
      };
    }
  } catch {
    // fall through to overlay/fallback sources
  }

  const fallbackSnapshot = loadRepoMemoryOverlaySnapshot({
    rootDir: resolve(cwd, "memory"),
  });
  const fallbackEntries = fallbackSnapshot.entries.map((entry) => ({
    id: entry.id,
    label: entry.label,
    summary: entry.summary,
    bodyRef: entry.bodyRef,
  }));
  const entries = (state.memoryOverlayEntries && state.memoryOverlayEntries.length > 0)
    ? state.memoryOverlayEntries
    : fallbackEntries;
  const sourceClass = state.mpRoutedPackage?.sourceClass ?? "repo_memory_fallback";
  const sourceKind = sourceClass === "repo_memory_fallback" ? "repo_memory_fallback" : "mp_overlay";
  const status = entries.length > 0 ? "degraded" : "empty";
  return {
    summaryLines: [
      state.mpRoutedPackage?.summary ?? (entries.length > 0 ? "MP memory overlay is available." : "MP snapshot unavailable"),
      `source=${sourceClass}${sourceKind === "repo_memory_fallback" ? " (fallback)" : ""}`,
      `${entries.length} memory records`,
    ],
    status,
    sourceKind,
    emptyReason: entries.length > 0 ? undefined : "No MP memory records are available in the current LanceDB or fallback snapshot.",
    sourceClass,
    rootPath,
    recordCount: entries.length,
    detailLines: [
      `workflow: ${mpReadbackSummary?.status ?? "unknown"} receipt=${mpReadbackSummary?.receiptAvailable ? "ready" : "missing"} tables=${mpReadbackSummary?.tableCount ?? 0}`,
      `records: viewer=${entries.length} source=${sourceClass}`,
      ...flowLines,
    ],
    roleLines,
    flowLines,
    issueLines: issueLines.length > 0 ? issueLines : ["viewer is showing overlay/fallback records, not live LanceDB-backed runtime truth"],
    entries: entries.map((entry) => ({
      memoryId: entry.id.replace(/^memory:/u, ""),
      label: entry.label,
      summary: entry.summary,
      agentId: undefined,
      scopeLevel: undefined,
      updatedAt: undefined,
      bodyRef: entry.bodyRef,
    })),
  };
}

function buildCapabilitiesPanelSnapshot(state: LiveCliState): CapabilityPanelSnapshotPayload {
  const governance = state.runtime.createTapGovernanceSnapshot();
  const tapRuntime = state.runtime.createTapRuntimeSnapshot();
  const manifests = state.runtime.capabilityPool.listCapabilities();
  const bindings = state.runtime.capabilityPool.listBindings();
  const humanGateContexts = new Map(
    (tapRuntime.humanGateContexts ?? []).map((context) => [context.gateId, context]),
  );
  const groups = new Map<string, CapabilityPanelSnapshotGroup>();
  for (const manifest of manifests) {
    const groupKey = manifest.capabilityKey.split(".")[0] ?? "other";
    const manifestBindings = bindings.filter((binding) => binding.capabilityId === manifest.capabilityId);
    const bindingState = [...new Set(manifestBindings.map((binding) => binding.state))].join("/") || "unbound";
    const existing = groups.get(groupKey) ?? {
      groupKey,
      title: groupKey,
      count: 0,
      entries: [],
    };
    existing.entries.push({
      capabilityKey: manifest.capabilityKey,
      description: manifest.description,
      bindingState,
    });
    existing.count += 1;
    groups.set(groupKey, existing);
  }
  const orderedGroups = [...groups.values()]
    .sort((left, right) => left.groupKey.localeCompare(right.groupKey))
    .map((group) => ({
      ...group,
      entries: group.entries.sort((left, right) => left.capabilityKey.localeCompare(right.capabilityKey)),
    }));
  const pendingHumanGates: HumanGatePanelEntry[] = tapRuntime.humanGates
    .filter((gate) => gate.sessionId === state.sessionId && gate.status === "waiting_human")
    .slice()
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .map((gate) => {
      const context = humanGateContexts.get(gate.gateId);
      const requestedScopeMetadata = context?.accessRequest.requestedScope?.metadata;
      const externalPathPrefixes = Array.isArray(requestedScopeMetadata?.externalPathPrefixes)
        ? requestedScopeMetadata.externalPathPrefixes
          .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        : [];
      return {
        gateId: gate.gateId,
        requestId: gate.requestId,
        capabilityKey: gate.capabilityKey,
        requestedTier: gate.requestedTier,
        mode: gate.mode,
        reason: gate.reason,
        createdAt: gate.createdAt,
        updatedAt: gate.updatedAt,
        externalPathPrefixes,
        plainLanguageRisk: gate.plainLanguageRisk,
      };
    });
  return {
    summaryLines: [
      `${manifests.length} registered`,
      `${orderedGroups.length} families`,
      `${governance.blockingCapabilityKeys.length} blocked`,
      `${pendingHumanGates.length} human gate pending`,
    ],
    status: manifests.length > 0 ? "ready" : "empty",
    registeredCount: manifests.length,
    familyCount: orderedGroups.length,
    blockedCount: governance.blockingCapabilityKeys.length,
    pendingHumanGateCount: pendingHumanGates.length,
    pendingHumanGates,
    groups: orderedGroups,
  };
}

function compactInitLine(value: string, maxChars = 220): string {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (!normalized) {
    return "";
  }
  return normalized.length <= maxChars
    ? normalized
    : `${normalized.slice(0, maxChars - 1).trimEnd()}…`;
}

function resolveLiveInitArtifactPath(workspaceRoot: string): string {
  return resolve(resolveWorkspaceRaxodeRoot(workspaceRoot), "AGENTS.md");
}

function resolveLiveInitStatePath(workspaceRoot: string): string {
  return resolve(resolveWorkspaceRaxodeRoot(workspaceRoot), "init-state.json");
}

function summarizeWorkspaceInitPreamble(parsed: ReturnType<typeof parseInitArtifact>): string {
  const preambleLines = (parsed.compiledSessionPreamble ?? "")
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^Project initialization context:?$/iu.test(line));
  const preferredLine = preambleLines[0]
    ?? parsed.summaryLines.find((line) => !/^Generated at:/iu.test(line));
  return compactInitLine(preferredLine ?? "Workspace initialization guidance is available.", 220);
}

function summarizeWorkspaceInitExcerpt(parsed: ReturnType<typeof parseInitArtifact>): string {
  const preambleLines = (parsed.compiledSessionPreamble ?? "")
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^Project initialization context:?$/iu.test(line));
  const fallbackLines = parsed.summaryLines.filter((line) => !/^Generated at:/iu.test(line));
  return compactInitLine((preambleLines.length > 0 ? preambleLines : fallbackLines).join(" | "), 520);
}

async function refreshWorkspaceInitContext(
  state: LiveCliState,
  workspaceRoot: string,
): Promise<void> {
  const artifactPath = resolveLiveInitArtifactPath(workspaceRoot);
  try {
    const [content, info] = await Promise.all([
      readFile(artifactPath, "utf8"),
      stat(artifactPath),
    ]);
    if (!info.isFile()) {
      state.workspaceInitContext = undefined;
      return;
    }
    const parsed = parseInitArtifact(content);
    const summary = summarizeWorkspaceInitPreamble(parsed);
    const excerpt = summarizeWorkspaceInitExcerpt(parsed);
    const updatedAt = info.mtime.toISOString();
    const previous = state.workspaceInitContext;
    state.workspaceInitContext = {
      schemaVersion: "core-workspace-init-context/v1",
      sourcePath: ".raxode/AGENTS.md",
      bodyRef: ".raxode/AGENTS.md",
      summary,
      excerpt,
      updatedAt,
      freshness:
        previous
        && (previous.updatedAt !== updatedAt || previous.summary !== summary || previous.excerpt !== excerpt)
          ? "changed"
          : "fresh",
    };
  } catch {
    state.workspaceInitContext = undefined;
  }
}

function createInitProjectId(workspaceRoot: string): string {
  const slug = basename(workspaceRoot)
    .replace(/[^a-z0-9]+/giu, "-")
    .replace(/^-+|-+$/gu, "")
    .toLowerCase();
  return `raxode.${slug || "workspace"}`;
}

async function inspectWorkspaceInitReality(workspaceRoot: string): Promise<{
  repoState: "empty" | "non_empty";
  gitRegistered: boolean;
  initState: "uninitialized" | "partial" | "initialized";
  agentsExists: boolean;
  initStateRecord?: WorkspaceInitStateRecord;
}> {
  const agentsPath = resolveLiveInitArtifactPath(workspaceRoot);
  const initStatePath = resolveLiveInitStatePath(workspaceRoot);
  let agentsExists = false;
  try {
    const info = await stat(agentsPath);
    agentsExists = info.isFile();
  } catch {
    agentsExists = false;
  }

  let repoState: "empty" | "non_empty" = "empty";
  try {
    const visible = await readdir(workspaceRoot);
    repoState = visible.some((entry) => entry !== ".git" && entry !== ".raxode") ? "non_empty" : "empty";
  } catch {
    repoState = "empty";
  }

  let initStateRecord: WorkspaceInitStateRecord | undefined;
  try {
    const content = await readFile(initStatePath, "utf8");
    const parsed = JSON.parse(content) as WorkspaceInitStateRecord;
    if (parsed && typeof parsed === "object") {
      initStateRecord = parsed;
    }
  } catch {
    initStateRecord = undefined;
  }

  const gitRegistered = initStateRecord?.gitRegistered === true;
  const initState = agentsExists && gitRegistered
    ? "initialized"
    : agentsExists
      ? "partial"
      : "uninitialized";
  return {
    repoState,
    gitRegistered,
    initState,
    agentsExists,
    ...(initStateRecord ? { initStateRecord } : {}),
  };
}

async function writeWorkspaceInitState(workspaceRoot: string, record: WorkspaceInitStateRecord): Promise<void> {
  await mkdir(resolveWorkspaceRaxodeRoot(workspaceRoot), { recursive: true });
  await writeFile(resolveLiveInitStatePath(workspaceRoot), `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

function buildInitSummaryLines(state: LiveCliState): string[] {
  const initFlow = state.initFlow;
  if (!initFlow) {
    return [];
  }
  if (Array.isArray(initFlow.summaryLines) && initFlow.summaryLines.length > 0) {
    return initFlow.summaryLines;
  }
  switch (initFlow.status) {
    case "awaiting_seed":
      return ["The current repository is empty. You need to provide an initialization prompt."];
    case "analyzing_repo":
      return [
        "Raxode is reading repo facts.",
        "Scanning README, current-context, AGENTS, and manifest files.",
      ];
    case "asking_questions":
      return [
        "Initialization needs a few structured answers before it can continue.",
      ];
    case "synthesizing_agents":
      return [
        "Raxode is synthesizing the workspace AGENTS context.",
        "Preparing the generated project instructions.",
      ];
    case "registering_git":
      return [
        "Raxode is registering shared git_infra for this workspace.",
        "Creating or validating the branch family and project readback.",
      ];
    case "failed":
      return [
        "Initialization failed.",
        initFlow.errorMessage ?? "Check the latest init attempt for details.",
      ];
    default:
      return [];
  }
}

function buildInitPanelSnapshot(state: LiveCliState): InitPanelSnapshotPayload {
  const initFlow = state.initFlow;
  if (!initFlow) {
    return {
      summaryLines: buildInitSummaryLines(state),
      status: "idle",
    };
  }
  return {
    summaryLines: buildInitSummaryLines(state),
    status: initFlow.status,
    ...(initFlow.initState ? { initState: initFlow.initState } : {}),
    ...(initFlow.repoState ? { repoState: initFlow.repoState } : {}),
    ...(initFlow.gitState ? { gitState: initFlow.gitState } : {}),
    ...(initFlow.artifactPath ? { artifactPath: initFlow.artifactPath } : {}),
    ...(initFlow.compiledSessionPreamble ? { compiledSessionPreamble: initFlow.compiledSessionPreamble } : {}),
    ...(initFlow.completionSummary ? { completionSummary: initFlow.completionSummary } : {}),
    ...(initFlow.seedText ? { seedText: initFlow.seedText } : {}),
    ...(initFlow.errorMessage ? { emptyReason: initFlow.errorMessage } : {}),
  };
}

async function emitInitPanelSnapshot(state: LiveCliState): Promise<void> {
  await state.logger.log("panel_snapshot", {
    panel: "init",
    snapshot: buildInitPanelSnapshot(state),
  });
}

function buildQuestionPanelSnapshot(state: LiveCliState): QuestionPanelSnapshotPayload {
  if (!state.pendingQuestion) {
    return {
      status: "idle",
    };
  }
  return {
    status: "active",
    requestId: state.pendingQuestion.requestId,
    title: state.pendingQuestion.title,
    instruction: state.pendingQuestion.instruction,
    sourceKind: state.pendingQuestion.sourceKind,
    submitLabel: state.pendingQuestion.submitLabel,
    questions: state.pendingQuestion.questions,
  };
}

async function emitQuestionPanelSnapshot(state: LiveCliState): Promise<void> {
  await state.logger.log("panel_snapshot", {
    panel: "question",
    snapshot: buildQuestionPanelSnapshot(state),
  });
}

async function loadPersistedInitArtifactIntoState(
  state: LiveCliState,
  workspaceRoot: string,
): Promise<void> {
  const reality = await inspectWorkspaceInitReality(workspaceRoot);
  const artifactPath = resolveLiveInitArtifactPath(workspaceRoot);
  try {
    const content = await readFile(artifactPath, "utf8");
    const parsed = parseInitArtifact(content);
    state.initFlow = {
      status: reality.initState === "initialized" ? "ready" : "idle",
      repoState: reality.repoState,
      initState: reality.initState,
      gitState: reality.gitRegistered ? "registered" : "unregistered",
      artifactPath,
      compiledSessionPreamble: parsed.compiledSessionPreamble,
      completionSummary: undefined,
      updatedAt: new Date().toISOString(),
      summaryLines: [],
      clarificationHistory: [],
    };
  } catch {
    state.initFlow = {
      status: "idle",
      repoState: reality.repoState,
      initState: reality.initState,
      gitState: reality.gitRegistered ? "registered" : "unregistered",
      updatedAt: new Date().toISOString(),
      summaryLines: [],
      clarificationHistory: [],
    };
  }
  await refreshWorkspaceInitContext(state, workspaceRoot);
}

async function runInitCompilerInference(
  config: ReturnType<typeof loadOpenAILiveConfig>,
  promptText: string,
): Promise<string> {
  await refreshOpenAIOAuthIfNeeded();
  const client = createOpenAIClient(config);
  const response = await client.responses.create({
    ...prepareResponsesParamsForOpenAIAuth(
      config,
      {
        model: config.model,
        input: promptText,
        stream: false,
        max_output_tokens: 900,
        reasoning: { effort: "low" },
      },
      promptText,
    ),
  } as never);
  const maybeStream = response as unknown as AsyncIterable<Record<string, unknown>>;
  if (response && typeof response === "object" && Symbol.asyncIterator in response) {
    let streamedText = "";
    let completedResponse: Record<string, unknown> | undefined;
    for await (const event of maybeStream) {
      if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
        streamedText += event.delta;
      } else if (event.type === "response.output_text.done" && typeof event.text === "string" && !streamedText.trim()) {
        streamedText = event.text;
      } else if (event.type === "response.completed" && event.response && typeof event.response === "object") {
        completedResponse = event.response as Record<string, unknown>;
      }
    }
    const completedText = completedResponse ? extractTextFromResponseLike(completedResponse) : "";
    return completedText.trim() || streamedText.trim();
  }
  return extractTextFromResponseLike(response as unknown as Record<string, unknown>);
}

function buildInitCompilerRetryPrompt(promptText: string): string {
  return [
    promptText,
    "",
    "IMPORTANT RETRY REQUIREMENTS:",
    "- The previous attempt did not produce a valid JSON object that matched the required schema.",
    "- Return exactly one JSON object and nothing else.",
    "- If you ask questions, make them repo-grounded and specific to the current workspace.",
    "- Do not use generic onboarding questions.",
  ].join("\n");
}

async function handleInitRequest(
  state: LiveCliState,
  text: string,
  config: ReturnType<typeof loadOpenAILiveConfig>,
  workspaceRoot: string,
): Promise<void> {
  const trimmedText = text.trim();
  const reality = await inspectWorkspaceInitReality(workspaceRoot);
  if (reality.repoState === "empty" && !trimmedText) {
    state.initFlow = {
      status: "awaiting_seed",
      repoState: reality.repoState,
      initState: reality.initState,
      gitState: reality.gitRegistered ? "registered" : "unregistered",
      seedText: state.initFlow?.seedText,
      artifactPath: state.initFlow?.artifactPath,
      compiledSessionPreamble: state.initFlow?.compiledSessionPreamble,
      updatedAt: new Date().toISOString(),
      summaryLines: [
        "The current repository is empty. You need to provide an initialization prompt.",
      ],
      clarificationHistory: state.initFlow?.clarificationHistory ?? [],
      errorMessage: "Initialization input cannot be empty.",
    };
    await emitInitPanelSnapshot(state);
    return;
  }

  const previous = state.initFlow;
  const seedText = previous?.seedText?.trim().length ? previous.seedText : trimmedText;
  const clarificationHistory = previous?.clarificationHistory ?? [];
  state.initFlow = {
    status: "analyzing_repo",
    repoState: reality.repoState,
    initState: reality.initState,
    gitState: reality.gitRegistered ? "registered" : "unregistered",
    seedText,
    updatedAt: new Date().toISOString(),
    summaryLines: [
      "Raxode is reading repo facts.",
      "Scanning README, current-context, AGENTS, and manifest files.",
    ],
    clarificationHistory,
  };
  await emitInitPanelSnapshot(state);

  const repoExcerpts = await loadInitCompilerRepoExcerpts(workspaceRoot);
  state.initFlow = {
    ...state.initFlow,
    status: "synthesizing_agents",
    summaryLines: [
      "Raxode is synthesizing the workspace AGENTS context.",
      "Combining your seed text with repository facts.",
    ],
  };
  await emitInitPanelSnapshot(state);

  const compilerPrompt = buildInitCompilerPrompt({
    seedText,
    clarifications: clarificationHistory.map((entry) => entry.answerText),
    repoExcerpts,
  });

  let compileResult: ReturnType<typeof parseInitCompilerResult> | undefined;
  let initCompilerRaw = "";
  try {
    initCompilerRaw = await runInitCompilerInference(config, compilerPrompt);
    compileResult = parseInitCompilerResult(initCompilerRaw);
  } catch {
    compileResult = undefined;
  }
  if (!compileResult) {
    try {
      initCompilerRaw = await runInitCompilerInference(config, buildInitCompilerRetryPrompt(compilerPrompt));
      compileResult = parseInitCompilerResult(initCompilerRaw);
    } catch {
      compileResult = undefined;
    }
  }
  if (!compileResult) {
    compileResult = createFallbackInitCompilerResult({
      seedText,
      clarifications: clarificationHistory.map((entry) => entry.answerText),
      repoExcerpts,
    });
  }

  if (compileResult.kind === "questions") {
    state.pendingQuestion = {
      requestId: `init-question:${randomUUID()}`,
      title: "/init",
      instruction: "Please answer Raxode’s questions based on your requirements.",
      sourceKind: "init",
      questions: compileResult.questions,
      submitLabel: "Submit initialization answers",
      resumeSeedText: seedText,
    };
    state.initFlow = {
      status: "asking_questions",
      repoState: reality.repoState,
      initState: reality.initState,
      gitState: reality.gitRegistered ? "registered" : "unregistered",
      seedText,
      updatedAt: new Date().toISOString(),
      summaryLines: [compileResult.summary],
      clarificationHistory,
    };
    await emitInitPanelSnapshot(state);
    await emitQuestionPanelSnapshot(state);
    return;
  }

  const artifactPath = resolveLiveInitArtifactPath(workspaceRoot);
  const artifactMarkdown = buildInitArtifactMarkdownFromResult(compileResult, seedText);
  await mkdir(resolveWorkspaceRaxodeRoot(workspaceRoot), { recursive: true });
  await writeFile(artifactPath, artifactMarkdown, "utf8");
  state.initFlow = {
    status: "registering_git",
    repoState: reality.repoState,
    initState: reality.initState,
    gitState: "registering",
    seedText,
    artifactPath,
    compiledSessionPreamble: compileResult.compiledSessionPreamble,
    completionSummary: compileResult.completionSummary,
    updatedAt: new Date().toISOString(),
    summaryLines: [
      "Raxode is registering shared git_infra for this workspace.",
      "Creating or validating the branch family and project readback.",
    ],
    clarificationHistory,
  };
  await emitInitPanelSnapshot(state);

  const defaultAgentId = "main";
  const projectId = createInitProjectId(workspaceRoot);
  await state.runtime.bootstrapCmpProjectInfra({
    projectId,
    repoName: basename(workspaceRoot) || "raxode-workspace",
    repoRootPath: workspaceRoot,
    agents: [{ agentId: defaultAgentId, depth: 0 }],
    defaultAgentId,
    defaultBranchName: "main",
    worktreeRootPath: resolve(workspaceRoot, ".cmp-worktrees"),
    storageEngine: "sqlite",
    databaseName: resolve(workspaceRoot, "memory", "generated", "cmp-db", "cmp.sqlite"),
    dbSchemaName: "main",
    redisNamespaceRoot: "praxis",
    metadata: {
      source: "raxode-init",
    },
  });
  const gitReadback = await readWorkspaceRaxodeGitReadback({
    workspaceRoot,
    agentId: defaultAgentId,
  });
  await writeWorkspaceInitState(workspaceRoot, {
    status: "initialized",
    initializedAt: new Date().toISOString(),
    gitRegistered: true,
    projectId,
    defaultAgentId,
    branchFamily: {
      workBranchName: gitReadback.branchFamily.workBranchName,
      cmpBranchName: gitReadback.branchFamily.cmpBranchName,
      mpBranchName: gitReadback.branchFamily.mpBranchName,
      tapBranchName: gitReadback.branchFamily.tapBranchName,
    },
    agentsPath: resolveWorkspaceRaxodeAgentsDir(workspaceRoot),
    artifactPath,
  });
  await refreshWorkspaceInitContext(state, workspaceRoot);
  state.initFlow = {
    status: "completed",
    repoState: reality.repoState,
    initState: "initialized",
    gitState: "registered",
    seedText,
    artifactPath,
    compiledSessionPreamble: compileResult.compiledSessionPreamble,
    completionSummary: compileResult.completionSummary,
    updatedAt: new Date().toISOString(),
    summaryLines: [],
    clarificationHistory,
  };
  state.pendingQuestion = undefined;
  await emitInitPanelSnapshot(state);
  await emitQuestionPanelSnapshot(state);
}

function formatQuestionAnswersAsClarifications(input: {
  prompt?: QuestionAskPayload;
  answers: Array<{
    questionId: string;
    selectedOptionLabel?: string;
    answerText?: string;
    annotation?: string;
  }>;
}): string[] {
  return input.answers.map((answer) => {
    const prompt = input.prompt?.questions.find((question) => question.id === answer.questionId);
    return [
      prompt?.prompt ?? answer.questionId,
      answer.answerText ? `回答: ${answer.answerText}` : `选择: ${answer.selectedOptionLabel ?? "(missing)"}`,
      answer.annotation ? `备注: ${answer.annotation}` : undefined,
    ].filter((part): part is string => Boolean(part)).join(" | ");
  });
}

function formatQuestionAnswersAsUserMessage(input: {
  prompt?: QuestionAskPayload;
  answers: Array<{
    questionId: string;
    selectedOptionLabel?: string;
    answerText?: string;
    annotation?: string;
  }>;
}): string {
  const totalCount = input.prompt?.questions.length ?? input.answers.length;
  return [
    `Questions ${input.answers.length}/${totalCount} answered`,
    ...input.answers.flatMap((answer) => {
      const prompt = input.prompt?.questions.find((question) => question.id === answer.questionId);
      return [
        `- ${prompt?.prompt ?? answer.questionId}`,
        `  answer: ${answer.answerText ?? answer.selectedOptionLabel ?? "(missing)"}`,
        ...(answer.annotation ? [`  note: ${answer.annotation}`] : []),
      ];
    }),
  ].join("\n");
}

function normalizeQuestionAskPayload(input: unknown): QuestionAskPayload | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return undefined;
  }
  const record = input as Record<string, unknown>;
  if (!Array.isArray(record.questions)) {
    return undefined;
  }
  const questions = record.questions.flatMap((entry): QuestionAskPayload["questions"] => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [];
    }
    const item = entry as Record<string, unknown>;
    const prompt = typeof item.prompt === "string"
      ? item.prompt.trim()
      : (typeof item.question === "string" ? item.question.trim() : "");
    const questionKind = item.kind === "freeform" ? "freeform" : "choice";
    const options = Array.isArray(item.options)
      ? item.options.flatMap((candidate) => {
        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
          return [];
        }
        const option = candidate as Record<string, unknown>;
        if (
          typeof option.id !== "string"
          || typeof option.label !== "string"
          || typeof option.description !== "string"
        ) {
          return [];
        }
        return [{
          id: option.id,
          label: option.label,
          description: option.description,
        }];
      })
      : [];
    if (typeof item.id !== "string" || !prompt) {
      return [];
    }
    if (questionKind === "freeform") {
      return [{
        kind: "freeform",
        id: item.id,
        prompt,
        ...(typeof item.placeholder === "string" && item.placeholder.trim().length > 0
          ? { placeholder: item.placeholder }
          : {}),
        ...(typeof item.notePrompt === "string" && item.notePrompt.trim().length > 0 ? { notePrompt: item.notePrompt } : {}),
        ...(typeof item.allowAnnotation === "boolean" ? { allowAnnotation: item.allowAnnotation } : {}),
        ...(typeof item.required === "boolean" ? { required: item.required } : {}),
      }];
    }
    if (options.length === 0) {
      return [];
    }
    return [{
      id: item.id,
      prompt,
      options,
      ...(typeof item.notePrompt === "string" && item.notePrompt.trim().length > 0 ? { notePrompt: item.notePrompt } : {}),
      ...(typeof item.allowAnnotation === "boolean" ? { allowAnnotation: item.allowAnnotation } : {}),
      ...(typeof item.required === "boolean" ? { required: item.required } : {}),
    }];
  });
  if (questions.length === 0) {
    return undefined;
  }
  return {
    requestId: typeof record.requestId === "string" && record.requestId.trim().length > 0
      ? record.requestId
      : randomUUID(),
    title: typeof record.title === "string" && record.title.trim().length > 0
      ? record.title
      : "Questions",
    instruction: typeof record.instruction === "string" && record.instruction.trim().length > 0
      ? record.instruction
      : "Please answer Raxode’s questions based on your requirements.",
    sourceKind: record.sourceKind === "init" ? "init" : "core",
    questions,
    ...(typeof record.submitLabel === "string" && record.submitLabel.trim().length > 0
      ? { submitLabel: record.submitLabel }
      : {}),
  };
}

function normalizeRequestUserInputPayload(input: unknown): QuestionAskPayload | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return undefined;
  }
  const record = input as Record<string, unknown>;
  if (!Array.isArray(record.questions)) {
    return undefined;
  }
  const questions = record.questions.flatMap((entry, questionIndex): QuestionAskPayload["questions"] => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [];
    }
    const item = entry as Record<string, unknown>;
    const prompt = typeof item.question === "string"
      ? item.question.trim()
      : (typeof item.prompt === "string" ? item.prompt.trim() : "");
    const questionKind = item.kind === "freeform" ? "freeform" : "choice";
    const options = Array.isArray(item.options)
      ? item.options.flatMap((candidate, optionIndex) => {
        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
          return [];
        }
        const option = candidate as Record<string, unknown>;
        const label = typeof option.label === "string" ? option.label.trim() : "";
        const description = typeof option.description === "string" ? option.description.trim() : "";
        if (!label || !description) {
          return [];
        }
        const optionId = typeof option.id === "string" && option.id.trim().length > 0
          ? option.id
          : `option_${optionIndex + 1}`;
        return [{
          id: optionId,
          label,
          description,
        }];
      })
      : [];
    const questionId = typeof item.id === "string" && item.id.trim().length > 0
      ? item.id
      : `request_user_input_${questionIndex + 1}`;
    if (!prompt) {
      return [];
    }
    if (questionKind === "freeform") {
      return [{
        kind: "freeform",
        id: questionId,
        prompt,
        ...(typeof item.placeholder === "string" && item.placeholder.trim().length > 0
          ? { placeholder: item.placeholder }
          : {}),
        ...(typeof item.notePrompt === "string" && item.notePrompt.trim().length > 0
          ? { notePrompt: item.notePrompt }
          : {}),
        allowAnnotation: typeof item.allowAnnotation === "boolean" ? item.allowAnnotation : false,
        ...(typeof item.required === "boolean" ? { required: item.required } : {}),
      }];
    }
    if (options.length === 0) {
      return [];
    }
    return [{
      id: questionId,
      prompt,
      options,
      ...(typeof item.notePrompt === "string" && item.notePrompt.trim().length > 0
        ? { notePrompt: item.notePrompt }
        : { notePrompt: "Please type the special annotations for this option." }),
      allowAnnotation: typeof item.allowAnnotation === "boolean" ? item.allowAnnotation : true,
      ...(typeof item.required === "boolean" ? { required: item.required } : {}),
    }];
  });
  if (questions.length === 0) {
    return undefined;
  }
  return {
    requestId: typeof record.requestId === "string" && record.requestId.trim().length > 0
      ? record.requestId
      : `request-user-input:${randomUUID()}`,
    title: typeof record.title === "string" && record.title.trim().length > 0
      ? record.title
      : "Raxode Questions",
    instruction: typeof record.instruction === "string" && record.instruction.trim().length > 0
      ? record.instruction
      : "Please answer Raxode’s questions so it can continue safely.",
    sourceKind: "core",
    questions,
    ...(typeof record.submitLabel === "string" && record.submitLabel.trim().length > 0
      ? { submitLabel: record.submitLabel }
      : { submitLabel: "Submit answers" }),
  };
}

function createBootingCmpPanelSnapshot(): CmpPanelSnapshotPayload {
  return {
    summaryLines: [
      "CMP viewer is warming up.",
      "Checking CMP readback truth and section availability.",
      "db=warming_up readback=warming_up",
    ],
    status: "booting",
    sourceKind: "warming_up",
    emptyReason: "CMP readback is still warming up.",
    truthStatus: "warming_up",
    readbackStatus: "warming_up",
    entries: [],
  };
}

function createBootingMpPanelSnapshot(cwd: string): MpPanelSnapshotPayload {
  const rootPath = resolve(cwd, "memory", "generated", "mp-overlay-cache");
  return {
    summaryLines: [
      "MP viewer is warming up.",
      `source=warming_up · ${rootPath}`,
      "Waiting for LanceDB and overlay bootstrap.",
    ],
    status: "booting",
    sourceKind: "warming_up",
    emptyReason: "MP LanceDB and memory overlay bootstrap are still warming up.",
    sourceClass: "warming_up",
    rootPath,
    recordCount: 0,
    entries: [],
  };
}

function createUnavailableCmpPanelSnapshot(error: unknown): CmpPanelSnapshotPayload {
  const message = error instanceof Error ? error.message : String(error);
  return {
    summaryLines: [
      "CMP snapshot unavailable",
      message,
      "db=unknown readback=unknown",
    ],
    status: "degraded",
    sourceKind: "runtime_fallback",
    emptyReason: message,
    truthStatus: "unknown",
    readbackStatus: "unknown",
    entries: [],
  };
}

function createUnavailableMpPanelSnapshot(cwd: string, error: unknown): MpPanelSnapshotPayload {
  const message = error instanceof Error ? error.message : String(error);
  return {
    summaryLines: [
      "MP snapshot unavailable",
      message,
      "0 memory records",
    ],
    status: "degraded",
    sourceKind: "repo_memory_fallback",
    emptyReason: message,
    sourceClass: "runtime_error",
    rootPath: resolve(cwd, "memory", "generated", "mp-overlay-cache"),
    recordCount: 0,
    entries: [],
  };
}

async function emitInitialViewerPanelSnapshots(state: LiveCliState): Promise<void> {
  const cwd = process.cwd();
  const cmpSnapshot = createBootingCmpPanelSnapshot();
  const mpSnapshot = createBootingMpPanelSnapshot(cwd);
  updateLiveCliViewerSnapshots(state, {
    cmp: cmpSnapshot,
    mp: mpSnapshot,
  });
  await Promise.all([
    state.logger.log("panel_snapshot", {
      panel: "cmp",
      snapshot: cmpSnapshot,
    }),
    state.logger.log("panel_snapshot", {
      panel: "mp",
      snapshot: mpSnapshot,
    }),
    state.logger.log("panel_snapshot", {
      panel: "capabilities",
      snapshot: buildCapabilitiesPanelSnapshot(state),
    }),
    state.logger.log("panel_snapshot", {
      panel: "init",
      snapshot: buildInitPanelSnapshot(state),
    }),
    state.logger.log("panel_snapshot", {
      panel: "question",
      snapshot: buildQuestionPanelSnapshot(state),
    }),
  ]);
}

async function emitViewerPanelSnapshots(state: LiveCliState): Promise<{
  cmp: CmpPanelSnapshotPayload;
  mp: MpPanelSnapshotPayload;
}> {
  const cwd = process.cwd();
  const emitSnapshot = async <T>(params: {
    panel: "cmp" | "mp" | "capabilities" | "init" | "question";
    build: () => Promise<T> | T;
    fallback: (error: unknown) => T;
  }): Promise<T> => {
    let snapshot: T;
    try {
      snapshot = await params.build();
    } catch (error) {
      snapshot = params.fallback(error);
    }
    await state.logger.log("panel_snapshot", {
      panel: params.panel,
      snapshot,
    });
    return snapshot;
  };

  const [cmp, mp] = await Promise.all([
    emitSnapshot({
      panel: "cmp",
      build: () => buildCmpPanelSnapshot(state),
      fallback: (error) => createUnavailableCmpPanelSnapshot(error),
    }),
    emitSnapshot({
      panel: "mp",
      build: () => buildMpPanelSnapshot(state),
      fallback: (error) => createUnavailableMpPanelSnapshot(cwd, error),
    }),
    emitSnapshot({
      panel: "capabilities",
      build: () => buildCapabilitiesPanelSnapshot(state),
      fallback: (error) => ({
        summaryLines: [
          "capabilities snapshot unavailable",
          error instanceof Error ? error.message : String(error),
        ],
        status: "degraded",
        sourceKind: "capabilities_error",
        emptyReason: error instanceof Error ? error.message : String(error),
        groups: [],
      }),
    }),
    emitSnapshot({
      panel: "init",
      build: () => buildInitPanelSnapshot(state),
      fallback: (error) => ({
        summaryLines: [],
        status: "failed",
        sourceKind: "init_error",
        errorMessage: error instanceof Error ? error.message : String(error),
      }),
    }),
    emitSnapshot({
      panel: "question",
      build: () => buildQuestionPanelSnapshot(state),
      fallback: () => ({
        status: "idle",
      }),
    }),
  ]);
  updateLiveCliViewerSnapshots(state, {
    cmp,
    mp,
  });
  return {
    cmp,
    mp,
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
    mode: LIVE_CHAT_TAP_OVERRIDE.requestedMode ?? "bapr",
    requestInput: request.input,
    metadata: {
      tapUserOverride: LIVE_CHAT_TAP_OVERRIDE,
      cliBridge: "core-action-envelope",
      cliTurnIndex: state.turnIndex,
    },
  });
  const canBypassForBapr = (LIVE_CHAT_TAP_OVERRIDE.requestedMode ?? "bapr") === "bapr"
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

function extractFirstHttpUrl(text: string): string | undefined {
  const match = text.match(/https?:\/\/[^\s)\]}>"'`]+/iu);
  return match?.[0];
}

const IMAGE_EXTENSION_PATTERN = /\.(png|jpe?g|gif|webp|bmp|svg)$/iu;
const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/bmp": ".bmp",
  "image/svg+xml": ".svg",
};

function resolveImageExtensionFromMimeType(mimeType?: string): string {
  if (!mimeType) {
    return ".png";
  }
  return MIME_EXTENSION_MAP[mimeType] ?? ".png";
}

async function readMimeTypeFromLocalFile(path: string): Promise<string> {
  const mimeInfo = await execFile("file", ["--mime-type", "-b", path], {
    encoding: "utf8",
    timeout: 10_000,
  });
  const mimeType = mimeInfo.stdout.trim();
  if (!mimeType.startsWith("image/")) {
    throw new Error(`Unsupported image MIME type: ${mimeType || "unknown"}.`);
  }
  return mimeType;
}

async function buildLocalImageDataUrl(path: string): Promise<{
  imageUrl: string;
  mimeType: string;
  byteLength: number;
}> {
  const [buffer, mimeType] = await Promise.all([
    readFile(path),
    readMimeTypeFromLocalFile(path),
  ]);
  return {
    imageUrl: `data:${mimeType};base64,${buffer.toString("base64")}`,
    mimeType,
    byteLength: buffer.length,
  };
}

async function ensureDirectImageTempDir(sessionId: string): Promise<string> {
  const directory = resolve(tmpdir(), "praxis-live-cli", sessionId);
  await mkdir(directory, { recursive: true });
  return directory;
}

async function downloadRemoteImageToTempFile(
  sessionId: string,
  remoteUrl: string,
): Promise<{
  localPath: string;
  mimeType: string;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(remoteUrl, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Image download failed with HTTP ${response.status}.`);
    }
    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim();
    let mimeType = contentType && contentType.startsWith("image/") ? contentType : undefined;
    let pathname = remoteUrl;
    try {
      pathname = new URL(remoteUrl).pathname;
    } catch {
      // keep original
    }
    if (!mimeType && !IMAGE_EXTENSION_PATTERN.test(pathname)) {
      throw new Error("Remote URL does not point to a supported image type.");
    }
    mimeType ??= "image/png";
    const bytes = Buffer.from(await response.arrayBuffer());
    const extension = extname(pathname) || resolveImageExtensionFromMimeType(mimeType);
    const tempDir = await ensureDirectImageTempDir(sessionId);
    const localPath = resolve(tempDir, `remote-image-${randomUUID()}${extension}`);
    await writeFile(localPath, bytes);
    return { localPath, mimeType };
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveDirectInputAttachmentImage(params: {
  state: LiveCliState;
  attachment: DirectInputImageAttachment;
  emitTelemetry: boolean;
}): Promise<string | undefined> {
  const { state, attachment, emitTelemetry } = params;
  const sourcePath = attachment.sourceKind !== "remote_url" ? attachment.localPath : undefined;
  const sourceUrl = attachment.sourceKind === "remote_url" ? attachment.remoteUrl : undefined;
  const sourceLabel = sourcePath ?? sourceUrl ?? attachment.displayName ?? attachment.id;
  const requestInput: Record<string, unknown> = {
    detail: "original",
    sourceKind: attachment.sourceKind,
    ...(sourcePath ? { sourcePath } : {}),
    ...(sourceUrl ? { sourceUrl } : {}),
  };

  const logStageStart = async () => {
    if (!emitTelemetry) {
      return;
    }
    await state.logger.log("stage_start", {
      turnIndex: state.turnIndex,
      stage: "core/capability_bridge",
      capabilityKey: "view_image",
      reason: "Need to inspect the provided image before the model answers.",
      inputSummary: sourceLabel ? `view ${sourceLabel}` : "view provided image",
      ...createCapabilityFamilyTelemetry({
        capabilityKey: "view_image",
        requestInput,
        inputSummary: sourceLabel ? `view ${sourceLabel}` : "view provided image",
      }),
    });
  };

  const logStageEnd = async (status: string, output?: unknown, error?: unknown) => {
    if (!emitTelemetry) {
      return;
    }
    await state.logger.log("stage_end", {
      turnIndex: state.turnIndex,
      stage: "core/capability_bridge",
      capabilityKey: "view_image",
      status,
      output: trimStructuredValue(output, 4_000),
      error: trimStructuredValue(error, 1_500),
      ...createCapabilityFamilyTelemetry({
        capabilityKey: "view_image",
        requestInput,
        inputSummary: sourceLabel ? `view ${sourceLabel}` : "view provided image",
        status,
        output,
        error,
      }),
    });
  };

  try {
    await logStageStart();
    const resolvedLocalPath = sourceUrl
      ? (await downloadRemoteImageToTempFile(state.sessionId, sourceUrl)).localPath
      : sourcePath;
    if (!resolvedLocalPath) {
      throw new Error("Image attachment is missing a usable path.");
    }
    const summary = await buildLocalImageDataUrl(resolvedLocalPath);
    const output = {
      capabilityKey: "view_image",
      operation: "view_image",
      path: sourcePath ?? basename(resolvedLocalPath),
      mimeType: summary.mimeType,
      imageUrl: summary.imageUrl,
      byteLength: summary.byteLength,
    };
    await logStageEnd("success", output);
    return summary.imageUrl;
  } catch (error) {
    const errorRecord = {
      code: "direct_view_image_failed",
      message: error instanceof Error ? error.message : String(error),
    };
    await logStageEnd("failed", undefined, errorRecord);
    return undefined;
  }
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

interface HeuristicBrowserIntent {
  url: string;
  allowedDomains?: string[];
  responseText: string;
  reason: string;
}

function inferHeuristicBrowserIntent(userMessage: string): HeuristicBrowserIntent | undefined {
  const normalized = userMessage.trim();
  const asksForBrowser = /(浏览器|browser|自动化|打开|点开|网页|google\.com|截图|可视化)/iu.test(normalized);
  if (!asksForBrowser) {
    return undefined;
  }

  const explicitUrl = extractFirstHttpUrl(normalized);
  if (explicitUrl) {
    let allowedDomains: string[] | undefined;
    try {
      const parsed = new URL(explicitUrl);
      allowedDomains = parsed.hostname ? [parsed.hostname] : undefined;
    } catch {
      allowedDomains = undefined;
    }
    return {
      url: explicitUrl,
      allowedDomains,
      responseText: "我先按你的要求打开目标网页。",
      reason: "User explicitly requested browser automation for a concrete URL.",
    };
  }

  if (/google\.com/iu.test(normalized) && /(搜索|查一下|查下|检索)/u.test(normalized)) {
    const query = buildGoogleSearchQueryFromUserMessage(normalized) ?? "国际金价 美元/盎司";
    return {
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      allowedDomains: ["google.com", "www.google.com"],
      responseText: "我先打开 Google 并按你的要求搜索。",
      reason: "User explicitly requested browser automation on google.com with a concrete search intent.",
    };
  }

  return undefined;
}

function inferDeterministicCoreActionEnvelope(
  state: LiveCliState,
  userMessage: string,
): CoreActionEnvelope | undefined {
  const available = new Set(
    state.runtime.capabilityPool.listCapabilities().map((manifest) => manifest.capabilityKey),
  );
  if (available.has("browser.playwright")) {
    const browserIntent = inferHeuristicBrowserIntent(userMessage);
    if (browserIntent) {
      return {
        action: "capability_call",
        responseText: browserIntent.responseText,
        capabilityRequest: {
          capabilityKey: "browser.playwright",
          reason: browserIntent.reason,
          requestedTier: "B2",
          timeoutMs: 20_000,
          input: {
            action: "navigate",
            url: browserIntent.url,
            ...(browserIntent.allowedDomains
              ? { allowedDomains: browserIntent.allowedDomains }
              : {}),
          },
        },
      };
    }
  }
  return undefined;
}

function inferDeterministicBrowserFollowupEnvelope(params: {
  userMessage: string;
  toolExecution: NonNullable<CoreTurnArtifacts["toolExecution"]>;
  summary: BrowserTurnSummary;
}): CoreActionEnvelope | undefined {
  if (params.toolExecution.capabilityKey !== "browser.playwright") {
    return undefined;
  }
  const output = params.toolExecution.output && typeof params.toolExecution.output === "object"
    ? params.toolExecution.output as Record<string, unknown>
    : undefined;
  if (!output) {
    return undefined;
  }

  const action = readString(output.action);
  const pageUrl = readString(output.pageUrl);
  const explicitUrl = extractFirstHttpUrl(params.userMessage);
  const wantsScreenshot = /(截图|screenshot)/iu.test(params.userMessage);
  const googleQuery = buildGoogleSearchQueryFromUserMessage(params.userMessage);
  const wantsGoldPrice = browserTaskWantsGoldPrice(params.userMessage);
  const requiresPageNativeEvidence = browserTaskRequiresPageNativeEvidence(params.userMessage);
  const currentHeadless = typeof output.headless === "boolean" ? output.headless : undefined;

  if (
    action === "navigate"
    && explicitUrl
    && pageUrl?.startsWith(explicitUrl)
    && wantsScreenshot
  ) {
    return {
      action: "capability_call",
      taskStatus: "incomplete",
      responseText: "继续补上页面截图。",
      capabilityRequest: {
        capabilityKey: "browser.playwright",
        reason: "The target page is open and now needs a screenshot to complete the current browser subtask.",
        requestedTier: "B1",
        timeoutMs: 15_000,
        input: {
          action: "screenshot",
        },
      },
    };
  }

  if (
    action === "screenshot"
    && googleQuery
    && !(pageUrl && /google\.com\/search/iu.test(pageUrl))
  ) {
    return {
      action: "capability_call",
      taskStatus: "incomplete",
      responseText: "继续打开 Google 搜索结果页。",
      capabilityRequest: {
        capabilityKey: "browser.playwright",
        reason: "The first page screenshot is done; continue to the requested Google search step.",
        requestedTier: "B1",
        timeoutMs: 15_000,
        input: {
          action: "navigate",
          url: `https://www.google.com/search?q=${encodeURIComponent(googleQuery)}`,
          allowedDomains: ["google.com", "www.google.com"],
        },
      },
    };
  }

  if (
    action === "navigate"
    && pageUrl
    && /google\.com\/search/iu.test(pageUrl)
  ) {
    return {
      action: "capability_call",
      taskStatus: "incomplete",
      responseText: "继续读取当前搜索结果页。",
      capabilityRequest: {
        capabilityKey: "browser.playwright",
        reason: "The Google results page is open; capture a snapshot so core can inspect visible result content.",
        requestedTier: "B1",
        timeoutMs: 15_000,
        input: {
          action: "snapshot",
        },
      },
    };
  }

  if (
    action === "snapshot"
    && pageUrl
    && /google\.com\/search/iu.test(pageUrl)
    && wantsGoldPrice
    && params.summary.candidateSourceUrl
    && params.summary.goldPriceEvidenceSource !== "verified_source"
  ) {
    let allowedDomains: string[] | undefined;
    try {
      const parsed = new URL(params.summary.candidateSourceUrl);
      allowedDomains = parsed.hostname ? [parsed.hostname] : undefined;
    } catch {
      allowedDomains = undefined;
    }
    return {
      action: "capability_call",
      taskStatus: "incomplete",
      responseText: "继续打开候选行情源页做求证。",
      capabilityRequest: {
        capabilityKey: "browser.playwright",
        reason: "The Google results page exposed a promising gold-price source, so open it and verify the USD/oz number on-page.",
        requestedTier: "B1",
        timeoutMs: 15_000,
        input: {
          action: "navigate",
          url: params.summary.candidateSourceUrl,
          ...(allowedDomains ? { allowedDomains } : {}),
        },
      },
    };
  }

  if (
    action === "navigate"
    && pageUrl
    && wantsGoldPrice
    && !/google\.com\/search/iu.test(pageUrl)
    && !pageUrl.startsWith("https://example.com")
    && params.summary.goldPriceEvidenceSource !== "verified_source"
  ) {
    return {
      action: "capability_call",
      taskStatus: "incomplete",
      responseText: "继续读取候选行情源页的可见内容。",
      capabilityRequest: {
        capabilityKey: "browser.playwright",
        reason: "The candidate source page is open; capture a snapshot so core can verify the visible USD/oz price.",
        requestedTier: "B1",
        timeoutMs: 15_000,
        input: {
          action: "snapshot",
        },
      },
    };
  }

  if (
    params.summary.activeObstruction
    && pageUrl
    && wantsGoldPrice
    && requiresPageNativeEvidence
    && !/google\.com\/search/iu.test(pageUrl)
    && !pageUrl.startsWith("https://example.com")
    && currentHeadless !== false
  ) {
    let allowedDomains: string[] | undefined;
    try {
      const parsed = new URL(pageUrl);
      allowedDomains = parsed.hostname ? [parsed.hostname] : undefined;
    } catch {
      allowedDomains = undefined;
    }
    return {
      action: "capability_call",
      taskStatus: "incomplete",
      responseText: "目标页被安全校验拦截，先用可视浏览器再重试一次。",
      capabilityRequest: {
        capabilityKey: "browser.playwright",
        reason: "The target page is blocked by a security verification gate, so retry once with a visible browser before giving up.",
        requestedTier: "B1",
        timeoutMs: 15_000,
        input: {
          action: "navigate",
          url: pageUrl,
          ...(allowedDomains ? { allowedDomains } : {}),
          headless: false,
        },
      },
    };
  }

  if (
    params.summary.activeObstruction
    && pageUrl
    && wantsGoldPrice
    && requiresPageNativeEvidence
    && !/google\.com\/search/iu.test(pageUrl)
    && !pageUrl.startsWith("https://example.com")
    && currentHeadless === false
  ) {
    return {
      action: "reply",
      taskStatus: "blocked",
      responseText: "当前目标页面仍停留在安全校验页，页面里没有出现你要求的价格和页面显示时间；这类页面内事实不能用联网检索结果冒充，所以当前任务还没完成。",
    };
  }

  return undefined;
}

function isEmptyCorePlaceholderAnswer(text: string | undefined): boolean {
  if (!text) {
    return true;
  }
  return text.trim() === "";
}

function looksLikeInterimPromise(text: string | undefined): boolean {
  if (!text) {
    return false;
  }
  const normalized = text.trim();
  return /然后我会/u.test(normalized)
    || /接下来我会/u.test(normalized)
    || /随后我会/u.test(normalized)
    || /先.+然后/u.test(normalized)
    || /^(我)?先.+再/u.test(normalized)
    || /^(我)?先(去|查|看|调用|读取|打开|确认|列出|补上|执行)/u.test(normalized)
    || /继续.+(回读|校验|确认|读取)/u.test(normalized);
}

function answerClaimsSpreadsheetRowsUnavailable(text: string | undefined): boolean {
  if (!text) {
    return false;
  }
  const normalized = text.trim();
  return /被截断/u.test(normalized)
    || /不可见/u.test(normalized)
    || /无法基于当前已返回内容/u.test(normalized)
    || /没有把单元格明细一并带回/u.test(normalized)
    || /无法逐字列出/u.test(normalized);
}

function buildBlockedBrowserPageNativeReply(summary: BrowserTurnSummary): string {
  return [
    "当前任务还没完成。",
    "目标页面仍停留在安全校验页，页面里没有出现你要求的价格和页面显示时间。",
    "这类页面原生事实不能用联网检索结果冒充。",
    summary.activeObstruction?.pageUrl ? `- 当前页面: ${summary.activeObstruction.pageUrl}` : undefined,
    summary.activeObstruction?.pageTitle ? `- 当前标题: ${summary.activeObstruction.pageTitle}` : undefined,
  ].filter((line): line is string => Boolean(line)).join("\n");
}

function browserTaskWantsPageTitle(userMessage: string): boolean {
  return /(页面标题|page title|title)/iu.test(userMessage);
}

function browserPartialCanCompleteTask(params: {
  userMessage: string;
  summary: BrowserTurnSummary;
}): boolean {
  const { userMessage, summary } = params;
  if (summary.activeObstruction) {
    return false;
  }
  if (browserTaskWantsGoldPrice(userMessage)) {
    if (!summary.goldPriceUsdPerOunce) {
      return false;
    }
    if (browserTaskRequiresPageNativeEvidence(userMessage)) {
      return Boolean(summary.verifiedSourceUrl && summary.goldPriceUsdPerOunce && summary.goldPriceObservedAt);
    }
    return Boolean(summary.verifiedSourceUrl && summary.goldPriceUsdPerOunce);
  }
  if (browserTaskWantsPageTitle(userMessage)) {
    return Boolean(summary.examplePageTitle || summary.verifiedSourceTitle || summary.googleSearchTitle);
  }
  if (browserTaskRequiresPageNativeEvidence(userMessage)) {
    return Boolean(summary.verifiedSourceUrl && (summary.goldPriceUsdPerOunce || summary.goldPriceObservedAt));
  }
  return false;
}

function extractFirstMatch(text: string, pattern: RegExp): string | undefined {
  const match = text.match(pattern);
  return match?.[1]?.trim();
}

function userMessageWantsEditedContentReadback(userMessage: string): boolean {
  return /(修改后|改后|回读|确认内容|文件内容|全文|告诉我.*内容|readback|read back)/iu.test(userMessage);
}

function inferReadbackCapabilityForPath(pathValue: string): {
  capabilityKey: string;
  input: Record<string, unknown>;
  responseText: string;
} | undefined {
  const normalizedPath = pathValue.replace(/\\/gu, "/");
  const lowerPath = normalizedPath.toLowerCase();

  if (lowerPath.endsWith(".xlsx") || lowerPath.endsWith(".csv") || lowerPath.endsWith(".tsv")) {
    return {
      capabilityKey: "spreadsheet.read",
      input: { path: normalizedPath, maxEntries: 20 },
      responseText: "继续回读修改后的表格内容。",
    };
  }

  if (lowerPath.endsWith(".docx")) {
    return {
      capabilityKey: "doc.read",
      input: { path: normalizedPath, maxEntries: 20, maxBytes: 12_000 },
      responseText: "继续回读修改后的文档内容。",
    };
  }

  if (lowerPath.endsWith(".pdf")) {
    return {
      capabilityKey: "read_pdf",
      input: { path: normalizedPath, pages: "1-3" },
      responseText: "继续回读修改后的 PDF 内容。",
    };
  }

  if (lowerPath.endsWith(".ipynb")) {
    return {
      capabilityKey: "read_notebook",
      input: { path: normalizedPath, maxEntries: 20 },
      responseText: "继续回读修改后的 notebook 内容。",
    };
  }

  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/iu.test(lowerPath)) {
    return {
      capabilityKey: "view_image",
      input: { path: normalizedPath, detail: "original" },
      responseText: "继续查看修改后的图片内容。",
    };
  }

  if (
    normalizedPath.startsWith("docs/")
    || normalizedPath.startsWith("memory/")
    || lowerPath.endsWith(".md")
    || lowerPath.endsWith(".txt")
  ) {
    return {
      capabilityKey: "docs.read",
      input: { path: normalizedPath, maxBytes: 12_000 },
      responseText: "继续回读修改后的文档内容。",
    };
  }

  return {
    capabilityKey: "code.read",
    input: { path: normalizedPath },
    responseText: "继续回读修改后的文件内容。",
  };
}

function inferDeterministicPostEditReadbackEnvelope(params: {
  userMessage: string;
  toolExecution: NonNullable<CoreTurnArtifacts["toolExecution"]>;
}): CoreActionEnvelope | undefined {
  if (params.toolExecution.capabilityKey !== "code.edit" || params.toolExecution.status !== "success") {
    return undefined;
  }
  if (!userMessageWantsEditedContentReadback(params.userMessage)) {
    return undefined;
  }
  const output = params.toolExecution.output && typeof params.toolExecution.output === "object"
    ? params.toolExecution.output as Record<string, unknown>
    : undefined;
  const editedPath = readString(output?.path);
  if (!editedPath) {
    return undefined;
  }
  const readback = inferReadbackCapabilityForPath(editedPath);
  if (!readback) {
    return undefined;
  }
  return {
    action: "capability_call",
    taskStatus: "incomplete",
    responseText: readback.responseText,
    capabilityRequest: {
      capabilityKey: readback.capabilityKey,
      reason: `Read back ${editedPath} after code.edit so the user can inspect the updated content.`,
      requestedTier: "B0",
      timeoutMs: 15_000,
      input: readback.input,
    },
  };
}

function inferDeterministicDocReadCompletionEnvelope(params: {
  toolExecution?: NonNullable<CoreTurnArtifacts["toolExecution"]>;
}): CoreActionEnvelope | undefined {
  if (params.toolExecution?.capabilityKey !== "doc.read" || params.toolExecution.status !== "success") {
    return undefined;
  }
  const answer = buildDocReadCompletionAnswer(
    extractDocReadFactSummary(params.toolExecution.output),
  );
  if (!answer) {
    return undefined;
  }
  return {
    action: "reply",
    taskStatus: "completed",
    responseText: answer,
  };
}

function synthesizeUserFacingToolAnswer(
  capabilityKey: string,
  output: unknown,
  executionStatus?: string,
  executionError?: unknown,
): string | undefined {
  const normalized = output && typeof output === "object"
    ? output as Record<string, unknown>
    : undefined;
  const errorRecord = executionError && typeof executionError === "object"
    ? executionError as Record<string, unknown>
    : undefined;
  const errorMessage = typeof errorRecord?.message === "string" ? errorRecord.message : "";
  if (capabilityKey === "spreadsheet.read") {
    return buildSpreadsheetReadCompletionAnswer(extractSpreadsheetReadFactSummary(output));
  }
  if (capabilityKey === "doc.read") {
    return buildDocReadCompletionAnswer(extractDocReadFactSummary(output));
  }
  if (executionStatus && executionStatus !== "success" && executionStatus !== "partial" && capabilityKey !== "browser.playwright") {
    const capabilityLabel = capabilityKey === "mcp.listTools"
      ? "MCP tools 查询"
      : capabilityKey === "mcp.listResources"
        ? "MCP resources 查询"
        : capabilityKey === "mcp.readResource"
          ? "MCP resource 读取"
          : capabilityKey === "mcp.call"
            ? "MCP tool 调用"
            : capabilityKey === "mcp.native.execute"
              ? "MCP native transport 调用"
              : capabilityKey === "repo.write"
                ? "仓库写入"
                : capabilityKey === "request_permissions"
                  ? "权限申请"
                  : capabilityKey === "write_todos"
                    ? "todo 工作流写入"
                    : capabilityKey === "skill.doc.generate"
                      ? "skill 文档生成"
                      : capabilityKey;
    return [
      `${capabilityLabel}这一步没有成功完成。`,
      errorMessage ? `失败原因：${errorMessage}` : undefined,
    ].filter((line): line is string => Boolean(line)).join("\n");
  }
  if (capabilityKey !== "browser.playwright") {
    return undefined;
  }
  const toolText = typeof normalized?.text === "string" ? normalized.text : "";
  const action = typeof normalized?.action === "string" ? normalized.action : "browser.playwright";
  const launchEvidence = normalized?.launchEvidence && typeof normalized.launchEvidence === "object"
    ? normalized.launchEvidence as Record<string, unknown>
    : undefined;
  const processVerifiedHeaded = typeof launchEvidence?.processVerifiedHeaded === "boolean"
    ? launchEvidence.processVerifiedHeaded
    : undefined;
  const requestedHeadless = typeof launchEvidence?.requestedHeadless === "boolean"
    ? launchEvidence.requestedHeadless
    : (typeof normalized?.headless === "boolean" ? normalized.headless : undefined);
  const pageUrl = typeof normalized?.pageUrl === "string"
    ? normalized.pageUrl
    : extractFirstMatch(toolText, /^- Page URL:\s+(.+)$/mu);
  const pageTitle = typeof normalized?.pageTitle === "string"
    ? normalized.pageTitle
    : extractFirstMatch(toolText, /^- Page Title:\s+(.+)$/mu);
  const snapshotRef = extractFirstMatch(toolText, /^- \[Snapshot\]\((.+)\)$/mu);
  const imageCount = typeof normalized?.imageCount === "number" ? normalized.imageCount : 0;
  const snapshotCaptured = Boolean(normalized?.snapshotCaptured);
  const interstitialRecovered = Boolean(normalized?.interstitialRecovered);

  if (executionStatus && executionStatus !== "success" && executionStatus !== "partial") {
    return [
      `浏览器自动化这一步没有成功完成。`,
      errorMessage ? `失败原因：${errorMessage}` : undefined,
    ].filter((line): line is string => Boolean(line)).join("\n");
  }

  if (pageUrl?.includes("/sorry/")) {
    return [
      `浏览器自动化没有完成用户要的业务目标。`,
      `当前打开到的页面是 Google 的拦截/验证页，而不是正常搜索结果页。`,
      pageUrl ? `页面地址：${pageUrl}` : undefined,
      pageTitle ? `页面标题：${pageTitle}` : undefined,
      snapshotRef ? `已生成页面快照：${snapshotRef}` : undefined,
      imageCount > 0 ? `已返回 ${imageCount} 张截图。` : undefined,
    ].filter((line): line is string => Boolean(line)).join("\n");
  }

  return [
    executionStatus === "partial"
      ? `浏览器自动化只完成了部分步骤，这一步实际执行了 \`${action}\`，但还不能直接算任务完成。`
      : `浏览器自动化已经执行成功，这一步实际完成了 \`${action}\`。`,
    requestedHeadless === false
      ? processVerifiedHeaded === true
        ? "这次走的是有头路径，并且进程级证据表明实际 Chrome 命令行不含 `--headless`。"
        : "这次请求了有头路径，但当前还没有拿到足够的进程级证据来证明浏览器一定是可见窗口。"
      : undefined,
    pageUrl ? `页面地址：${pageUrl}` : undefined,
    pageTitle ? `页面标题：${pageTitle}` : undefined,
    interstitialRecovered ? "初始导航曾短暂落到拦截页，但后续快照已经恢复到正常页面。" : undefined,
    snapshotCaptured ? "导航后已自动补抓一次页面快照，便于后续继续读取结果。" : undefined,
    snapshotRef ? `已生成页面快照：${snapshotRef}` : undefined,
    imageCount > 0 ? `已返回 ${imageCount} 张截图。` : undefined,
  ].filter((line): line is string => Boolean(line)).join("\n");
}

function deriveTerminalCoreTaskStatus(params: {
  capabilityKey?: string;
  toolExecutionStatus?: string;
  forceFinalAnswer?: boolean;
  envelope?: CoreActionEnvelope;
}): CoreTaskStatus {
  if (params.envelope) {
    return normalizeCoreTaskStatus(params.envelope);
  }
  const status = (params.toolExecutionStatus ?? "").trim().toLowerCase();
  if (
    status === "blocked"
    || status === "review_required"
    || status === "waiting_human"
    || status === "waiting_human_approval"
    || status === "baseline_missing"
  ) {
    return "blocked";
  }
  if (status === "partial") {
    return params.capabilityKey === "browser.playwright"
      || params.capabilityKey === "search.web"
      || params.capabilityKey === "search.ground"
      ? "incomplete"
      : "completed";
  }
  if (params.forceFinalAnswer || status === "failed") {
    return "exhausted";
  }
  return "completed";
}

async function runCoreTurn(
  state: LiveCliState,
  userMessage: string,
  cmp: CmpTurnArtifacts | undefined,
  config: ReturnType<typeof loadOpenAILiveConfig>,
  initialInputImageUrls?: string[],
): Promise<CoreTurnArtifacts> {
  const maxCapabilityLoops = 4;
  const maxIncompleteReplyRecoveries = 2;
  const initialContextPrompt = buildCoreActionPlannerInstructionText(state, "", cmp);
  let actionEnvelope: CoreActionEnvelope | undefined;
  let rawAnswer = "";
  let latestRunId = `${state.sessionId}:core-reply:${state.turnIndex}`;
  let latestEventTypes: string[] = [];
  let latestTaskStatus: CoreTaskStatus = "completed";
  let latestToolExecution: NonNullable<CoreTurnArtifacts["toolExecution"]> | undefined;
  let latestUsage: CoreTurnArtifacts["usage"] | undefined;
  let completedCapabilityLoops = 0;
  let browserTurnSummary: BrowserTurnSummary = {};
  let capabilityLoopHistory: string[] = [];
  let browserGroundingEvidenceText: string | undefined;
  let pendingToolResultText: string | undefined;
  let pendingInputImageUrls: string[] | undefined = initialInputImageUrls;
  let pendingIncompleteReplyText: string | undefined;
  let incompleteReplyRecoveries = 0;
  let latestContext = createCoreContextTelemetry({
    state,
    config,
    promptKind: "initial",
    promptText: initialContextPrompt,
  });

  const finalizeReply = (params: {
    runId: string;
    answer: string;
    plannerRawAnswer: string;
    eventTypes: string[];
    taskStatus?: CoreTaskStatus;
  }): CoreTurnArtifacts => {
    latestUsage = latestUsage ?? {
      inputTokens: latestContext.promptTokens,
      outputTokens: estimateContextTokens(params.answer),
      estimated: true,
    };
    return {
      runId: params.runId,
      answer: params.answer,
      dispatchStatus: "reply_only",
      taskStatus: params.taskStatus ?? latestTaskStatus,
      capabilityResultStatus: latestToolExecution?.status ?? "success",
      context: latestContext,
      usage: latestUsage,
      plannerRawAnswer: params.plannerRawAnswer,
      toolExecution: latestToolExecution,
      eventTypes: params.eventTypes,
    };
  };

  const deriveActionEnvelopeFromRaw = (text: string): CoreActionEnvelope | undefined => {
    try {
      return parseCoreActionEnvelope(text);
    } catch {
      return undefined;
    }
  };

  const deriveCapabilityEnvelopeFromTapRequest = (text: string): CoreActionEnvelope | undefined => {
    const tapRequest = parseTapRequest(text);
    if (!tapRequest) {
      return undefined;
    }
    return {
      action: "capability_call",
      responseText: text,
      capabilityRequest: {
        capabilityKey: tapRequest.capabilityKey,
        reason: `Core requested ${tapRequest.capabilityKey} from live CLI bridge.`,
        input: tapRequest.input,
        requestedTier: "B0",
        timeoutMs: readPositiveInteger(tapRequest.input.timeoutMs),
      },
    };
  };

  const deterministicFirstStep = inferDeterministicCoreActionEnvelope(state, userMessage);
  if (deterministicFirstStep?.action === "capability_call"
    && deterministicFirstStep.capabilityRequest?.capabilityKey === "browser.playwright") {
    actionEnvelope = deterministicFirstStep;
    rawAnswer = JSON.stringify(actionEnvelope);
  } else {
    try {
      latestContext = createCoreContextTelemetry({
        state,
        config,
        promptKind: "core_action",
        promptText: buildCoreActionPlannerInstructionText(state, userMessage),
      });
      const actionPlannerResult = await runCoreActionPlanner(state, userMessage, cmp, pendingInputImageUrls);
      actionEnvelope = actionPlannerResult.envelope;
      latestUsage = mergeCliUsageCounts(latestUsage, actionPlannerResult.usage);
      rawAnswer = JSON.stringify(actionEnvelope);
    } catch {
      actionEnvelope = deterministicFirstStep;
      rawAnswer = actionEnvelope ? JSON.stringify(actionEnvelope) : "";
    }
  }

  while (true) {
    if (!actionEnvelope) {
      const fallbackAssembly = createCoreUserInputAssembly({
        userMessage,
        transcript: state.transcript,
        cmp,
        mpRoutedPackage: state.mpRoutedPackage,
        runtime: state.runtime,
        skillEntries: state.skillOverlayEntries,
        memoryEntries: state.memoryOverlayEntries,
        toolResultText: pendingToolResultText,
        capabilityHistoryText: capabilityLoopHistory.join("\n\n"),
        groundingEvidenceText: browserGroundingEvidenceText,
        capabilityLoopIndex: completedCapabilityLoops,
        maxCapabilityLoops,
        previousTaskStatus: pendingIncompleteReplyText ? "incomplete" : undefined,
        previousReplyText: pendingIncompleteReplyText,
      });
      const fallbackUserInput = fallbackAssembly.promptText;
      latestContext = createCoreContextTelemetry({
        state,
        config,
        promptKind: "core_model_pass",
        promptText: fallbackUserInput,
      });
      const fallback = await runCoreModelPass({
        state,
        userInput: fallbackUserInput,
        promptBlocks: fallbackAssembly.promptBlocks,
        promptMessages: fallbackAssembly.promptMessages,
        cmp,
        config,
        inputImageUrls: pendingInputImageUrls,
        reasoningEffortOverride: undefined,
      });
      latestRunId = fallback.runId;
      latestEventTypes = fallback.eventTypes;
      latestUsage = mergeCliUsageCounts(latestUsage, fallback.usage);
      rawAnswer = fallback.answer;
      actionEnvelope = deriveActionEnvelopeFromRaw(rawAnswer)
        ?? inferDeterministicCoreActionEnvelope(state, userMessage)
        ?? deriveCapabilityEnvelopeFromTapRequest(rawAnswer);

      if (actionEnvelope?.action === "reply") {
        latestTaskStatus = normalizeCoreTaskStatus(actionEnvelope);
        if (actionEnvelope.responseText) {
          const replyQuestionnaire = deriveQuestionnairePayloadFromReplyText(actionEnvelope.responseText);
          if (replyQuestionnaire) {
            state.pendingQuestion = {
              ...replyQuestionnaire,
              requestId: `reply-questionnaire:${randomUUID()}`,
              sourceKind: "core",
            };
            await emitQuestionPanelSnapshot(state);
            return {
              runId: fallback.runId,
              answer: replyQuestionnaire.instruction,
              dispatchStatus: "reply_only",
              taskStatus: "blocked",
              capabilityResultStatus: latestToolExecution?.status ?? "blocked",
              context: latestContext,
              usage: latestUsage,
              plannerRawAnswer: rawAnswer,
              toolExecution: latestToolExecution,
              eventTypes: [
                ...fallback.eventTypes,
                "core.reply_questionnaire_salvaged",
              ],
            };
          }
        }
        if (
          latestTaskStatus === "incomplete"
          && pendingToolResultText
          && incompleteReplyRecoveries < maxIncompleteReplyRecoveries
        ) {
          incompleteReplyRecoveries += 1;
          pendingIncompleteReplyText = extractResponseTextMaybe(actionEnvelope.responseText);
          actionEnvelope = undefined;
          continue;
        }
        return finalizeReply({
          runId: fallback.runId,
          answer: extractResponseTextMaybe(actionEnvelope.responseText),
          plannerRawAnswer: rawAnswer,
          eventTypes: [
            ...fallback.eventTypes,
            "core.action_planner.reply",
          ],
          taskStatus: latestTaskStatus,
        });
      }

      if (!(actionEnvelope?.action === "capability_call" && actionEnvelope.capabilityRequest)) {
        return finalizeReply({
          runId: fallback.runId,
          answer: extractResponseTextMaybe(rawAnswer),
          plannerRawAnswer: rawAnswer || (actionEnvelope ? JSON.stringify(actionEnvelope) : rawAnswer),
          eventTypes: fallback.eventTypes,
          taskStatus: latestTaskStatus,
        });
      }
    }

    if (!(actionEnvelope?.action === "capability_call" && actionEnvelope.capabilityRequest)) {
      if (state.uiMode === "direct") {
        printDirectSub("直接回答，不调用额外能力");
      }
      return finalizeReply({
        runId: latestRunId,
        answer: extractResponseTextMaybe(actionEnvelope?.responseText ?? rawAnswer),
        plannerRawAnswer: rawAnswer,
        eventTypes: latestEventTypes.length > 0 ? latestEventTypes : ["core.action_planner.reply"],
        taskStatus: actionEnvelope ? normalizeCoreTaskStatus(actionEnvelope) : latestTaskStatus,
      });
    }

    const capabilityRequest = await applyCliDefaultsToCapabilityRequest(
      actionEnvelope.capabilityRequest,
      config,
      userMessage,
      latestToolExecution?.capabilityKey === "browser.playwright"
        && latestToolExecution.output
        && typeof latestToolExecution.output === "object"
        ? {
          headless: typeof (latestToolExecution.output as { headless?: unknown }).headless === "boolean"
            ? (latestToolExecution.output as { headless: boolean }).headless
            : undefined,
          browser: typeof (latestToolExecution.output as { browser?: unknown }).browser === "string"
            ? (latestToolExecution.output as { browser: string }).browser
            : undefined,
          isolated: typeof (latestToolExecution.output as { isolated?: unknown }).isolated === "boolean"
            ? (latestToolExecution.output as { isolated: boolean }).isolated
            : undefined,
        }
        : undefined,
      );
    if (state.uiMode === "direct") {
      printDirectSub(`调用能力 ${capabilityRequest.capabilityKey}`);
    }
    const familyTelemetry = createCapabilityFamilyTelemetry({
      capabilityKey: capabilityRequest.capabilityKey,
      requestInput: capabilityRequest.input,
      inputSummary: summarizeCapabilityRequestForLog(capabilityRequest),
    });
    await state.logger.log("stage_start", {
      turnIndex: state.turnIndex,
      stage: "core/capability_bridge",
      capabilityKey: capabilityRequest.capabilityKey,
      reason: capabilityRequest.reason,
      inputSummary: summarizeCapabilityRequestForLog(capabilityRequest),
      ...familyTelemetry,
    });
    const toolExecution = await executeCoreCapabilityRequest(
      state,
      capabilityRequest,
    );
    const resolvedToolExecution = toolExecution;
    if (state.uiMode === "direct") {
      printDirectSub(`能力返回 ${resolvedToolExecution.status}`);
    }
    await state.logger.log("stage_end", {
      turnIndex: state.turnIndex,
      stage: "core/capability_bridge",
      status: resolvedToolExecution.status,
      capabilityKey: resolvedToolExecution.capabilityKey,
      output: trimStructuredValue(resolvedToolExecution.output, 4_000),
      error: trimStructuredValue(resolvedToolExecution.error, 1_500),
      ...createCapabilityFamilyTelemetry({
        capabilityKey: resolvedToolExecution.capabilityKey || capabilityRequest.capabilityKey,
        requestInput: capabilityRequest.input,
        inputSummary: summarizeCapabilityRequestForLog(capabilityRequest),
        status: resolvedToolExecution.status,
        output: resolvedToolExecution.output,
        error: resolvedToolExecution.error,
      }),
    });

    const toolResultCapabilityKey = resolvedToolExecution.capabilityKey || capabilityRequest.capabilityKey;
    if (
      (toolResultCapabilityKey === "question.ask" || toolResultCapabilityKey === "request_user_input")
      && resolvedToolExecution.status === "blocked"
    ) {
      const blockedDetails =
        resolvedToolExecution.error
        && typeof resolvedToolExecution.error === "object"
          ? (resolvedToolExecution.error as Record<string, unknown>).details
          : undefined;
      const questionPayload = toolResultCapabilityKey === "request_user_input"
        ? normalizeRequestUserInputPayload(blockedDetails)
        : normalizeQuestionAskPayload(blockedDetails);
      if (questionPayload) {
        state.pendingQuestion = {
          ...questionPayload,
          sourceKind: questionPayload.sourceKind ?? "core",
        };
        await emitQuestionPanelSnapshot(state);
        return {
          runId: latestRunId,
          answer: questionPayload.instruction,
          dispatchStatus: "capability_executed",
          taskStatus: "blocked",
          capabilityKey: capabilityRequest.capabilityKey,
          capabilityResultStatus: resolvedToolExecution.status,
          context: latestContext,
          usage: latestUsage,
          plannerRawAnswer: rawAnswer,
          toolExecution: resolvedToolExecution,
          eventTypes: latestEventTypes.length > 0 ? latestEventTypes : ["core.capability_bridge.executed"],
        };
      }
    }
    const summarizedToolOutput =
      (toolResultCapabilityKey === "search.web" || toolResultCapabilityKey === "search.ground")
      && resolvedToolExecution.output
      && typeof resolvedToolExecution.output === "object"
        ? {
          ...(resolvedToolExecution.output as Record<string, unknown>),
          status: resolvedToolExecution.status,
          error: resolvedToolExecution.error,
        }
        : resolvedToolExecution.output ?? {};
    const toolResultSummary = summarizeToolOutputForCore(
      toolResultCapabilityKey,
      summarizedToolOutput,
      {
        preserveBody: state.uiMode === "direct",
      },
    );
    const toolResultText = resolvedToolExecution.error
      ? JSON.stringify({
        error: resolvedToolExecution.error,
        output: JSON.parse(toolResultSummary),
      }, null, 2)
      : toolResultSummary;
    const inputImageUrls = toolResultCapabilityKey === "view_image"
      && resolvedToolExecution.output
      && typeof resolvedToolExecution.output === "object"
      && typeof (resolvedToolExecution.output as { imageUrl?: unknown }).imageUrl === "string"
      ? [(resolvedToolExecution.output as { imageUrl: string }).imageUrl]
      : toolResultCapabilityKey === "browser.playwright"
        && resolvedToolExecution.output
        && typeof resolvedToolExecution.output === "object"
        && Array.isArray((resolvedToolExecution.output as { imageUrls?: unknown }).imageUrls)
        ? (resolvedToolExecution.output as { imageUrls: unknown[] }).imageUrls
          .filter((entry): entry is string => typeof entry === "string" && entry.startsWith("data:image/"))
        : undefined;

    latestToolExecution = resolvedToolExecution;
    latestTaskStatus = "incomplete";
    completedCapabilityLoops += 1;
    if (toolResultCapabilityKey === "browser.playwright") {
      browserTurnSummary = updateBrowserTurnSummary(browserTurnSummary, resolvedToolExecution.output);
      browserGroundingEvidenceText = buildBrowserGroundingEvidenceText(browserTurnSummary);
    }
    pendingToolResultText = toolResultText;
    pendingInputImageUrls = inputImageUrls;
    pendingIncompleteReplyText = undefined;
    incompleteReplyRecoveries = 0;
    capabilityLoopHistory = [
      ...capabilityLoopHistory,
      `Step ${completedCapabilityLoops} · ${toolResultCapabilityKey} · ${resolvedToolExecution.status}\n${toolResultText}`,
    ].slice(-4);
    const forceFinalAnswer = shouldStopCoreCapabilityLoop({
      capabilityResultStatus: resolvedToolExecution.status,
      completedLoops: completedCapabilityLoops,
      maxLoops: maxCapabilityLoops,
    });

    const deterministicFollowup = !forceFinalAnswer
      ? inferDeterministicPostEditReadbackEnvelope({
        userMessage,
        toolExecution: resolvedToolExecution,
      }) ?? inferDeterministicDocReadCompletionEnvelope({
        toolExecution: resolvedToolExecution,
      }) ?? inferDeterministicBrowserFollowupEnvelope({
          userMessage,
          toolExecution: resolvedToolExecution,
          summary: browserTurnSummary,
        })
      : undefined;
    if (deterministicFollowup) {
      latestTaskStatus = normalizeCoreTaskStatus(deterministicFollowup);
      if (deterministicFollowup.action === "capability_call" && deterministicFollowup.capabilityRequest) {
        actionEnvelope = deterministicFollowup;
        rawAnswer = JSON.stringify(deterministicFollowup);
        pendingToolResultText = undefined;
        pendingInputImageUrls = undefined;
        pendingIncompleteReplyText = undefined;
        continue;
      }
      if (deterministicFollowup.action === "reply") {
        return {
          runId: latestRunId,
          answer: extractResponseTextMaybe(deterministicFollowup.responseText),
          dispatchStatus: completedCapabilityLoops > 1 ? "capability_loop_completed" : "capability_executed",
          taskStatus: latestTaskStatus,
          capabilityKey: capabilityRequest.capabilityKey,
          capabilityResultStatus: resolvedToolExecution.status,
          context: latestContext,
          usage: latestUsage,
          plannerRawAnswer: JSON.stringify(deterministicFollowup),
          toolExecution: resolvedToolExecution,
          eventTypes: latestEventTypes.length > 0 ? latestEventTypes : ["core.action_planner.reply"],
        };
      }
    }

    const followupAssembly = createCoreUserInputAssembly({
      userMessage,
      transcript: state.transcript,
      cmp,
      mpRoutedPackage: state.mpRoutedPackage,
      runtime: state.runtime,
      skillEntries: state.skillOverlayEntries,
      memoryEntries: state.memoryOverlayEntries,
      toolResultText,
      capabilityHistoryText: capabilityLoopHistory.join("\n\n"),
      groundingEvidenceText: browserGroundingEvidenceText,
      forceFinalAnswer,
      capabilityLoopIndex: completedCapabilityLoops,
      maxCapabilityLoops,
    });
    const followupUserInput = followupAssembly.promptText;
    latestContext = createCoreContextTelemetry({
      state,
      config,
      promptKind: "core_model_pass",
      promptText: followupUserInput,
    });
    const followup = await runCoreModelPass({
      state,
      userInput: followupUserInput,
      promptBlocks: followupAssembly.promptBlocks,
      promptMessages: followupAssembly.promptMessages,
      cmp,
      config,
      inputImageUrls,
      reasoningEffortOverride: undefined,
    });
      latestRunId = followup.runId;
      latestUsage = mergeCliUsageCounts(latestUsage, followup.usage);
      latestEventTypes = [
        ...followup.eventTypes,
        "core.action_planner.capability_call",
        "core.capability_bridge.executed",
    ];
    const followupRawAnswer = followup.answer?.trim() ?? "";
    const followupEnvelope = deriveActionEnvelopeFromRaw(followupRawAnswer)
      ?? (!forceFinalAnswer ? deriveCapabilityEnvelopeFromTapRequest(followupRawAnswer) : undefined);
    const mustKeepBrowserBlocked =
      (toolResultCapabilityKey === "search.ground"
        || toolResultCapabilityKey === "browser.playwright")
      && shouldKeepBrowserTaskBlockedByObstruction({
        userMessage,
        summary: browserTurnSummary,
      });

    if (!forceFinalAnswer && followupEnvelope?.action === "capability_call" && followupEnvelope.capabilityRequest) {
      latestTaskStatus = normalizeCoreTaskStatus(followupEnvelope);
      actionEnvelope = followupEnvelope;
      rawAnswer = followupRawAnswer;
      pendingToolResultText = undefined;
      pendingInputImageUrls = undefined;
      pendingIncompleteReplyText = undefined;
      continue;
    }

    if (!forceFinalAnswer && followupEnvelope?.action === "reply") {
      const requestedTaskStatus = normalizeCoreTaskStatus(followupEnvelope);
      latestTaskStatus = mustKeepBrowserBlocked
        ? "blocked"
        : toolResultCapabilityKey === "browser.playwright"
          && resolvedToolExecution.status === "partial"
          && requestedTaskStatus === "completed"
          ? browserPartialCanCompleteTask({
            userMessage,
            summary: browserTurnSummary,
          })
            ? "completed"
            : "incomplete"
          : (toolResultCapabilityKey === "search.web" || toolResultCapabilityKey === "search.ground")
            && resolvedToolExecution.status === "partial"
            && requestedTaskStatus === "completed"
            ? "incomplete"
          : requestedTaskStatus;
      if (latestTaskStatus === "incomplete" && incompleteReplyRecoveries < maxIncompleteReplyRecoveries) {
        incompleteReplyRecoveries += 1;
        pendingIncompleteReplyText = extractResponseTextMaybe(followupEnvelope.responseText);
        actionEnvelope = undefined;
        rawAnswer = followupRawAnswer;
        continue;
      }
      return {
        runId: followup.runId,
        answer: extractResponseTextMaybe(followupEnvelope.responseText),
        dispatchStatus: "capability_executed",
        taskStatus: latestTaskStatus,
        capabilityKey: capabilityRequest.capabilityKey,
        capabilityResultStatus: resolvedToolExecution.status,
        context: latestContext,
        usage: latestUsage,
        plannerRawAnswer: rawAnswer,
        toolExecution: resolvedToolExecution,
        eventTypes: latestEventTypes,
      };
    }

    const modelFollowupAnswer = extractResponseTextMaybe(followupRawAnswer);
    const synthesizedToolAnswer = synthesizeUserFacingToolAnswer(
      toolResultCapabilityKey,
      resolvedToolExecution.output,
      resolvedToolExecution.status,
      resolvedToolExecution.error,
    );
    const followupAnswer = !isEmptyCorePlaceholderAnswer(modelFollowupAnswer)
      ? modelFollowupAnswer
      : synthesizedToolAnswer
        || actionEnvelope.responseText
        || rawAnswer;
    const shouldPreferSynthesizedAnswer =
      typeof synthesizedToolAnswer === "string"
      && (
        isEmptyCorePlaceholderAnswer(modelFollowupAnswer)
        || looksLikeInterimPromise(followupAnswer)
      );
    const shouldPreferSpreadsheetAnswer =
      toolResultCapabilityKey === "spreadsheet.read"
      && typeof synthesizedToolAnswer === "string"
      && (
        isEmptyCorePlaceholderAnswer(modelFollowupAnswer)
        || looksLikeInterimPromise(followupAnswer)
        || answerClaimsSpreadsheetRowsUnavailable(followupAnswer)
      );
    const effectiveFollowupAnswer = mustKeepBrowserBlocked
      ? buildBlockedBrowserPageNativeReply(browserTurnSummary)
      : shouldPreferSpreadsheetAnswer
        ? synthesizedToolAnswer!
        : shouldPreferSynthesizedAnswer
          ? synthesizedToolAnswer!
        : followupAnswer;
    if (
      !forceFinalAnswer
      && !shouldPreferSpreadsheetAnswer
      && !mustKeepBrowserBlocked
      && incompleteReplyRecoveries < maxIncompleteReplyRecoveries
      && (isEmptyCorePlaceholderAnswer(modelFollowupAnswer) || looksLikeInterimPromise(effectiveFollowupAnswer))
    ) {
      incompleteReplyRecoveries += 1;
      pendingIncompleteReplyText = extractResponseTextMaybe(effectiveFollowupAnswer);
      actionEnvelope = undefined;
      rawAnswer = followupRawAnswer;
      continue;
    }
    latestTaskStatus = mustKeepBrowserBlocked
      ? "blocked"
      : toolResultCapabilityKey === "browser.playwright" && resolvedToolExecution.status === "partial"
        ? browserPartialCanCompleteTask({
          userMessage,
          summary: browserTurnSummary,
        })
          ? "completed"
          : "incomplete"
      : shouldPreferSpreadsheetAnswer
        ? "completed"
        : followupEnvelope?.action === "reply"
          ? normalizeCoreTaskStatus(followupEnvelope)
        : toolResultCapabilityKey === "search.ground"
        && resolvedToolExecution.status === "success"
        && !isEmptyCorePlaceholderAnswer(effectiveFollowupAnswer)
            ? "completed"
            : deriveTerminalCoreTaskStatus({
              capabilityKey: toolResultCapabilityKey,
              toolExecutionStatus: resolvedToolExecution.status,
              forceFinalAnswer,
              envelope: followupEnvelope,
            });
    return {
      runId: followup.runId,
      answer: effectiveFollowupAnswer,
      dispatchStatus: completedCapabilityLoops > 1 ? "capability_loop_completed" : "capability_executed",
      taskStatus: latestTaskStatus,
      capabilityKey: capabilityRequest.capabilityKey,
      capabilityResultStatus: resolvedToolExecution.status,
      context: latestContext,
      usage: latestUsage,
      plannerRawAnswer: rawAnswer,
      toolExecution: resolvedToolExecution,
      eventTypes: latestEventTypes,
    };
  }
}

async function handleUserTurn(
  state: LiveCliState,
  inputPayload: {
    text: string;
    attachments?: DirectInputImageAttachment[];
    pastedContents?: DirectInputPastedContentAttachment[];
    fileRefs?: DirectInputFileReference[];
  },
  config: ReturnType<typeof loadOpenAILiveConfig>,
  options: {
    enableCmpSync?: boolean;
    inputSource?: "question_answer";
  } = {},
): Promise<void> {
  const userMessage = (inputPayload.pastedContents ?? []).reduce((value, entry) =>
    value.replaceAll(entry.tokenText, entry.text),
  inputPayload.text);
  const attachments = inputPayload.attachments ?? [];
  state.turnIndex += 1;
  await state.logger.log("turn_start", {
    turnIndex: state.turnIndex,
    userMessage,
    ...(options.inputSource ? { inputSource: options.inputSource } : {}),
    transcriptTail: state.transcript.slice(-6),
  });
  const backgroundCmpLabel = `[turn ${state.turnIndex}] CMP sidecar sync elapsed`;
  const previousCmp = state.latestCmp;
  const cmpStartedAt = Date.now();
  const coreStartedAt = Date.now();
  console.log("");
  console.log(state.uiMode === "direct"
    ? `You asked: ${truncate(userMessage, 96)}`
    : options.enableCmpSync === false
      ? `[turn ${state.turnIndex}] core starts immediately; CMP sidecar is skipped for this once-mode turn.`
      : `[turn ${state.turnIndex}] core starts immediately; CMP sidecar runs in background.`);
  if (state.uiMode === "direct") {
    printDirectBullet(`Working · turn ${state.turnIndex}`);
    printDirectSub("core 前台开始处理");
    printDirectSub(
      options.enableCmpSync === false
        ? "本轮跳过 CMP sidecar，同步把前台结果尽快返回"
        : "CMP sidecar 后台启动，不阻塞当前回合",
    );
  }

  let initialInputImageUrls: string[] | undefined;
  if (attachments.length > 0) {
    const resolvedImageUrls = await Promise.all(
      attachments.map((attachment) =>
        resolveDirectInputAttachmentImage({
          state,
          attachment,
          emitTelemetry: attachment.sourceKind !== "clipboard",
        })),
    );
    const normalizedImageUrls = resolvedImageUrls
      .filter((entry): entry is string => typeof entry === "string" && entry.startsWith("data:image/"));
    if (normalizedImageUrls.length > 0) {
      initialInputImageUrls = [...new Set(normalizedImageUrls)];
    }
  }

  if (options.enableCmpSync === false) {
    state.pendingCmpSync = undefined;
  } else {
    state.pendingCmpSync = (async () => {
      const cmp = await withStopwatch(backgroundCmpLabel, () => runCmpSidecarTurn({
        runtime: state.runtime,
        sessionId: state.sessionId,
        transcript: state.transcript,
        turnIndex: state.turnIndex,
        uiMode: state.uiMode,
        logger: state.logger,
        userMessage,
      }), {
        quiet: state.uiMode === "direct",
      });
      state.latestCmp = cmp;
      state.lastTurn = state.lastTurn
        ? { ...state.lastTurn, cmp }
        : state.lastTurn;
      await emitViewerPanelSnapshots(state);
      console.log(state.uiMode === "direct"
        ? `  ↳ CMP sidecar ${cmp.syncStatus === "failed" ? "失败" : "已同步"} (${formatElapsed(Date.now() - cmpStartedAt)})`
        : `[turn ${state.turnIndex}] CMP sidecar ${cmp.syncStatus}.`);
    })();
  }

  const coreLabel = `[turn ${state.turnIndex}] TAP + core dispatch elapsed`;
  await state.logger.log("stage_start", {
    turnIndex: state.turnIndex,
    stage: "core/run",
  });
  if (state.uiMode === "direct") {
    printDirectSub("core 正在规划下一步");
  }
  const core = await withStopwatch(coreLabel, () => runCoreTurn(state, userMessage, previousCmp, config, initialInputImageUrls), {
    quiet: state.uiMode === "direct",
  });
  await state.logger.log("stage_end", {
    turnIndex: state.turnIndex,
    stage: "core/run",
    status: "success",
    runId: core.runId,
    dispatchStatus: core.dispatchStatus,
    taskStatus: core.taskStatus ?? null,
    capabilityKey: core.capabilityKey ?? null,
  });
  if (state.uiMode === "direct") {
    printDirectSub(`core 已完成 (${formatElapsed(Date.now() - coreStartedAt)})`);
  } else {
    console.log("[turn] Core completed.");
  }

  state.transcript.push({ role: "user", text: userMessage });
  state.transcript.push({ role: "assistant", text: core.answer });
  const turnResultCoreLog =
    state.uiMode === "direct"
      ? {
        ...core,
        answer: core.answer,
        elapsedMs: Date.now() - coreStartedAt,
      }
      : trimStructuredValue(core, 5_000);
  state.lastTurn = {
    cmp: state.latestCmp ?? previousCmp ?? {
      syncStatus: options.enableCmpSync === false ? "skipped" : "warming",
      agentId: options.enableCmpSync === false ? "cmp-sidecar-skipped" : "cmp-sidecar-pending",
      packageId: options.enableCmpSync === false ? "skipped" : "pending",
      packageRef: options.enableCmpSync === false ? "skipped" : "pending",
      packageKind: options.enableCmpSync === false ? "historical_reply" : "active_reseed",
      packageMode: options.enableCmpSync === false ? "skipped" : "pending",
      fidelityLabel: options.enableCmpSync === false ? "skipped" : "pending",
      projectionId: options.enableCmpSync === false ? "skipped" : "pending",
      snapshotId: options.enableCmpSync === false ? "skipped" : "pending",
      summary: state.runtime.getCmpFiveAgentRuntimeSummary("cmp-live-cli-main"),
      intent: options.enableCmpSync === false ? "skipped in once mode" : "pending",
      operatorGuide: options.enableCmpSync === false
        ? "CMP sidecar was intentionally skipped so once mode could return immediately."
        : "CMP sidecar is still preparing or no prior package is available.",
      childGuide: options.enableCmpSync === false ? "skipped" : "pending",
      checkerReason: options.enableCmpSync === false ? "skipped" : "pending",
      routeRationale: options.enableCmpSync === false ? "skipped" : "pending",
      scopePolicy: options.enableCmpSync === false ? "skipped" : "pending",
      packageStrategy: options.enableCmpSync === false ? "skipped" : "pending",
      timelineStrategy: options.enableCmpSync === false ? "skipped" : "pending",
      failureReason: undefined,
    },
    core,
  };
  await state.logger.log("turn_result", {
    turnIndex: state.turnIndex,
    cmp: trimStructuredValue(state.lastTurn.cmp, 4_000),
    core: turnResultCoreLog,
    transcriptTail: trimStructuredValue(state.transcript.slice(-8), 2_000),
  });
  await emitViewerPanelSnapshots(state);

  if (state.uiMode === "direct") {
    printDirectStatus(state);
    printDirectAnswer(core);
  } else {
    printCmpArtifacts(state.lastTurn.cmp);
    printTapArtifacts(state.runtime, state.sessionId, core.runId);
    printCoreArtifacts(core);
  }
}

async function applyTranscriptRewind(
  state: LiveCliState,
  targetTurnIndex: number,
): Promise<{
  ok: boolean;
  removedTurns?: number;
  error?: string;
}> {
  if (!Number.isFinite(targetTurnIndex) || targetTurnIndex < 0) {
    const error = "rewind target must be a non-negative turn index";
    await state.logger.log("rewind_failed", {
      sessionId: state.sessionId,
      targetTurnId: String(targetTurnIndex),
      error,
    });
    return {
      ok: false,
      error,
    };
  }
  if (targetTurnIndex > state.turnIndex) {
    const error = `cannot rewind to turn ${targetTurnIndex}; current turn is ${state.turnIndex}`;
    await state.logger.log("rewind_failed", {
      sessionId: state.sessionId,
      targetTurnId: String(targetTurnIndex),
      error,
    });
    return {
      ok: false,
      error,
    };
  }

  const removedTurns = state.turnIndex - targetTurnIndex;
  if (removedTurns === 0) {
    await state.logger.log("rewind_applied", {
      sessionId: state.sessionId,
      targetTurnId: String(targetTurnIndex),
      removedTurns: 0,
      transcriptTail: trimStructuredValue(state.transcript.slice(-8), 2_000),
    });
    return {
      ok: true,
      removedTurns: 0,
    };
  }

  const rewound = rewindDialogueTranscript(
    state.transcript,
    state.turnIndex,
    targetTurnIndex,
  );
  state.transcript = rewound.transcript;
  state.turnIndex = rewound.nextTurnIndex;
  state.pendingCmpSync = undefined;
  state.latestCmp = undefined;
  state.lastTurn = undefined;
  await emitViewerPanelSnapshots(state);
  await state.logger.log("rewind_applied", {
    sessionId: state.sessionId,
    targetTurnId: String(targetTurnIndex),
    removedTurns: rewound.removedTurns,
    transcriptTail: trimStructuredValue(state.transcript.slice(-8), 2_000),
  });
  return {
    ok: true,
    removedTurns: rewound.removedTurns,
  };
}

function createRuntime() {
  const workspaceRoot = resolveConfiguredWorkspaceRoot();
  const cmpSqlitePath = resolve(workspaceRoot, "memory", "generated", "cmp-db", "cmp.sqlite");
  const reviewerRoute = toTapAgentModelRoute(LIVE_CHAT_MODEL_PLAN.tap.reviewer, "tap.reviewer");
  const toolReviewerRoute = toTapAgentModelRoute(LIVE_CHAT_MODEL_PLAN.tap.toolReviewer, "tap.toolReviewer");
  const provisionerRoute = toTapAgentModelRoute(LIVE_CHAT_MODEL_PLAN.tap.provisioner, "tap.provisioner");
  const persistedReadAllowRules = (() => {
    try {
      return loadRaxcodeConfigFile().permissions.persistedAllowRules.map((rule) => ({ ...rule }));
    } catch {
      return [];
    }
  })();

  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: "profile.live-cli.main",
      agentClass: "main-agent",
      baselineCapabilities: [
        "model.infer",
        "code.read",
        "code.ls",
        "code.glob",
        "code.grep",
        "code.read_many",
        "code.symbol_search",
        "code.lsp",
        "spreadsheet.read",
        "spreadsheet.write",
        "doc.read",
        "doc.write",
        "read_pdf",
        "read_notebook",
        "view_image",
        "browser.playwright",
        "request_user_input",
        "request_permissions",
        "audio.transcribe",
        "speech.synthesize",
        "image.generate",
        "docs.read",
        "repo.write",
        "code.edit",
        "code.patch",
        "code.diff",
        "remote.exec",
        "tracker.create",
        "shell.restricted",
        "shell.session",
        "test.run",
        "git.status",
        "git.diff",
        "git.commit",
        "git.push",
        "write_todos",
        "skill.doc.generate",
        "search.web",
        "search.fetch",
        "search.ground",
        "skill.use",
        "skill.mount",
        "skill.prepare",
        "mcp.listTools",
        "mcp.listResources",
        "mcp.readResource",
        "mcp.call",
        "mcp.native.execute",
      ],
      allowedCapabilityPatterns: ["*"],
      defaultMode: LIVE_CHAT_TAP_OVERRIDE.requestedMode ?? "bapr",
    }),
    workspaceRoot,
    persistedReadAllowRules,
    persistReadAllowRule: (rule) => {
      const configFile = loadRaxcodeConfigFile();
      const existing = configFile.permissions.persistedAllowRules.find((entry) =>
        entry.capabilityFamily === rule.capabilityFamily
        && entry.agentId === rule.agentId
        && entry.pathPrefix === rule.pathPrefix
      );
      if (existing) {
        existing.updatedAt = rule.updatedAt;
      } else {
        configFile.permissions.persistedAllowRules.push({
          ...rule,
        });
      }
      writeRaxcodeConfigFile(configFile);
    },
    modelInferenceExecutor: executeCliModelInference,
    tapAgentModelRoutes: {
      reviewer: reviewerRoute,
      toolReviewer: toolReviewerRoute,
      provisioner: provisionerRoute,
    },
    cmpInfraBackends: {
      git: createGitCliCmpGitBackend(),
      dbExecutor: createCmpDbSqliteLiveExecutor({
        connection: {
          databaseName: cmpSqlitePath,
        },
      }),
      mq: createRedisCliCmpRedisMqAdapter(),
    },
    cmpFiveAgentRuntime: createCmpFiveAgentRuntime({
      configuration: createCmpFiveAgentConfiguration({
        promptVariant: "workmode_v8",
      }),
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
          roleId: "cmp.icma",
          reasoningEffort: resolveReasoningEffort(LIVE_CHAT_MODEL_PLAN.cmp.icma),
          serviceTier: LIVE_CHAT_MODEL_PLAN.cmp.icma.serviceTier,
          maxOutputTokens: LIVE_CHAT_MODEL_PLAN.cmp.icma.maxOutputTokens,
          executor: executeCliModelInference,
        }),
        iterator: createCmpRoleLiveLlmModelExecutor({
          provider: "openai",
          model: LIVE_CHAT_MODEL_PLAN.cmp.iterator.model,
          layer: "api",
          variant: "responses",
          roleId: "cmp.iterator",
          reasoningEffort: resolveReasoningEffort(LIVE_CHAT_MODEL_PLAN.cmp.iterator),
          serviceTier: LIVE_CHAT_MODEL_PLAN.cmp.iterator.serviceTier,
          maxOutputTokens: LIVE_CHAT_MODEL_PLAN.cmp.iterator.maxOutputTokens,
          executor: executeCliModelInference,
        }),
        checker: createCmpRoleLiveLlmModelExecutor({
          provider: "openai",
          model: LIVE_CHAT_MODEL_PLAN.cmp.checker.model,
          layer: "api",
          variant: "responses",
          roleId: "cmp.checker",
          reasoningEffort: resolveReasoningEffort(LIVE_CHAT_MODEL_PLAN.cmp.checker),
          serviceTier: LIVE_CHAT_MODEL_PLAN.cmp.checker.serviceTier,
          maxOutputTokens: LIVE_CHAT_MODEL_PLAN.cmp.checker.maxOutputTokens,
          executor: executeCliModelInference,
        }),
        dbagent: createCmpRoleLiveLlmModelExecutor({
          provider: "openai",
          model: LIVE_CHAT_MODEL_PLAN.cmp.dbagent.model,
          layer: "api",
          variant: "responses",
          roleId: "cmp.dbagent",
          reasoningEffort: resolveReasoningEffort(LIVE_CHAT_MODEL_PLAN.cmp.dbagent),
          serviceTier: LIVE_CHAT_MODEL_PLAN.cmp.dbagent.serviceTier,
          maxOutputTokens: LIVE_CHAT_MODEL_PLAN.cmp.dbagent.maxOutputTokens,
          executor: executeCliModelInference,
        }),
        dispatcher: createCmpRoleLiveLlmModelExecutor({
          provider: "openai",
          model: LIVE_CHAT_MODEL_PLAN.cmp.dispatcher.model,
          layer: "api",
          variant: "responses",
          roleId: "cmp.dispatcher",
          reasoningEffort: resolveReasoningEffort(LIVE_CHAT_MODEL_PLAN.cmp.dispatcher),
          serviceTier: LIVE_CHAT_MODEL_PLAN.cmp.dispatcher.serviceTier,
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
      workspaceRoot,
    },
    includeFamilies: {
      foundation: true,
      websearch: true,
      skill: true,
      mcp: true,
      mp: true,
    },
  });

  return runtime;
}

async function bootstrapLiveCmpInfra(state: LiveCliState, workspaceRoot: string): Promise<void> {
  const projectId = "praxis-live-cli";
  if (state.runtime.getCmpProjectInfraBootstrapReceipt(projectId)) {
    return;
  }
  const repoRootPath = process.cwd();
  let defaultBranchName = "main";
  try {
    const { stdout } = await execFile("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: repoRootPath,
      encoding: "utf8",
      timeout: 5_000,
    });
    const candidate = stdout.trim();
    if (candidate.length > 0 && candidate !== "HEAD") {
      defaultBranchName = candidate;
    }
  } catch {
    // keep fallback main
  }
  const defaultAgentId = "cmp-live-cli-main";
  const sqlitePath = resolve(workspaceRoot, "memory", "generated", "cmp-db", "cmp.sqlite");
  await state.runtime.bootstrapCmpProjectInfra({
    projectId,
    repoName: basename(repoRootPath) || "praxis-live-cli",
    repoRootPath,
    agents: [
      { agentId: defaultAgentId, depth: 0 },
      { agentId: "core-live-cli", parentAgentId: defaultAgentId, depth: 1 },
    ],
    defaultAgentId,
    defaultBranchName,
    worktreeRootPath: resolve(workspaceRoot, ".cmp-worktrees"),
    storageEngine: "sqlite",
    databaseName: sqlitePath,
    dbSchemaName: "main",
    redisNamespaceRoot: "praxis",
    metadata: {
      source: "praxis-live-cli",
      dbEngine: "sqlite",
    },
  });
}

async function runStartupWarmupStage<T>(params: {
  state: LiveCliState;
  stage: "cmp/infra_bootstrap" | "core/skill_overlay_bootstrap" | "core/memory_overlay_bootstrap";
  run: () => Promise<T>;
  onSuccess?: (value: T) => void | Promise<void>;
}): Promise<T | undefined> {
  await params.state.logger.log("stage_start", {
    turnIndex: params.state.turnIndex,
    stage: params.stage,
  });
  try {
    const value = await params.run();
    await params.onSuccess?.(value);
    await params.state.logger.log("stage_end", {
      turnIndex: params.state.turnIndex,
      stage: params.stage,
      status: "success",
    });
    return value;
  } catch (error) {
    await params.state.logger.log("stage_end", {
      turnIndex: params.state.turnIndex,
      stage: params.stage,
      status: "failed",
      error: String(error),
    });
    return undefined;
  }
}

function startLiveCliStartupWarmup(
  state: LiveCliState,
  workspaceRoot: string,
): Promise<void> {
  state.cmpInfraReady = runStartupWarmupStage({
    state,
    stage: "cmp/infra_bootstrap",
    run: () => bootstrapLiveCmpInfra(state, workspaceRoot),
  }).then(() => undefined);

  state.skillOverlayReady = runStartupWarmupStage({
    state,
    stage: "core/skill_overlay_bootstrap",
    run: () => discoverLiveSkillOverlayEntries({
      cwd: workspaceRoot,
      objective: "general live chat skill overlay bootstrap",
    }),
    onSuccess: (entries) => {
      state.skillOverlayEntries = entries;
    },
  }).then(() => undefined);

  state.mpOverlayReady = runStartupWarmupStage({
    state,
    stage: "core/memory_overlay_bootstrap",
    run: () => discoverMpOverlayArtifacts({
      cwd: workspaceRoot,
      userMessage: "general live chat memory overlay bootstrap",
    }),
    onSuccess: (mpOverlay) => {
      state.memoryOverlayEntries = mpOverlay.entries;
      state.mpRoutedPackage = mpOverlay.routedPackage;
    },
  }).then(() => undefined);

  const warmup = Promise.allSettled([
    state.cmpInfraReady,
    state.skillOverlayReady,
    state.mpOverlayReady,
  ]).then(async () => {
    try {
      await emitViewerPanelSnapshots(state);
    } catch {
      // startup refresh should never block direct input readiness
    }
  });
  state.startupWarmupReady = warmup;
  return warmup;
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  CURRENT_UI_MODE = options.uiMode;
  const runtimeConfig = loadRaxcodeRuntimeConfigSnapshot();
  applyLiveChatRuntimeConfig({
    modelPlan: runtimeConfig.modelPlan,
    tapOverride: runtimeConfig.tapOverride,
    uiConfig: runtimeConfig.ui,
    permissionsConfig: runtimeConfig.permissions,
  });
  const workspaceRoot = resolveConfiguredWorkspaceRoot();
  await refreshOpenAIOAuthIfNeeded();
  const config = loadOpenAILiveConfig("core.main");
  const logPath = createLiveChatLogPath();
  await mkdir(resolveLiveReportsDir(), { recursive: true });
  const logger = new LiveChatLogger(logPath);
  const runtime = createRuntime();
  const session = runtime.createSession({
    sessionId: typeof process.env.PRAXIS_DIRECT_SESSION_ID === "string" && process.env.PRAXIS_DIRECT_SESSION_ID.trim().length > 0
      ? process.env.PRAXIS_DIRECT_SESSION_ID.trim()
      : undefined,
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
  await loadPersistedInitArtifactIntoState(state, workspaceRoot);

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
    context: createCoreContextTelemetry({
      state,
      config,
      promptKind: "initial",
      promptText: buildCoreActionPlannerInstructionText(state, ""),
    }),
  });
  await emitInitialViewerPanelSnapshots(state);
  const startupWarmup = startLiveCliStartupWarmup(state, workspaceRoot);

  try {
    if (options.once) {
      await startupWarmup;
      await handleUserTurn(state, {
        text: options.once,
      }, config, {
        enableCmpSync: false,
      });
      await executeCoreCapabilityRequest(state, {
        capabilityKey: "browser.playwright",
        reason: "Close once-mode browser sessions before returning control to the shell.",
        requestedTier: "B1",
        timeoutMs: 5_000,
        input: {
          action: "disconnect",
        },
      }).catch(() => undefined);
      return;
    }

    const readline = options.uiMode === "direct"
      ? undefined
      : createInterface({
          input,
          output,
          terminal: true,
        });
    const directFallbackReader = options.uiMode === "direct" && (!input.isTTY || !output.isTTY)
      ? createDirectFallbackReader()
      : undefined;

    if (options.uiMode === "direct") {
      console.log(`direct ready: ${state.sessionId}`);
      await logger.log("direct_input_loop_ready", {
        sessionId: state.sessionId,
      });
    } else {
      await startupWarmup;
    }

    try {
      while (true) {
        const raw = options.uiMode === "direct"
          ? (directFallbackReader
              ? await readDirectFallbackLine(directFallbackReader)
              : await promptDirectInputBox())
          : await readline!.question("\nYou> ");
        if (raw === null) {
          break;
        }
        const parsedInput = options.uiMode === "direct"
          ? parseDirectUserInputEnvelope(raw)
          : undefined;
        const initRequest = options.uiMode === "direct"
          ? parseDirectInitRequestEnvelope(raw)
          : undefined;
        const questionAnswer = options.uiMode === "direct"
          ? parseDirectQuestionAnswerEnvelope(raw)
          : undefined;
        const humanGateDecision = options.uiMode === "direct"
          ? parseHumanGateDecisionEnvelope(raw)
          : undefined;
        if (humanGateDecision) {
          const result = await state.runtime.submitTaHumanGateDecision({
            gateId: humanGateDecision.gateId,
            action: humanGateDecision.action,
            actorId: `direct-tui:${state.sessionId}`,
            note: humanGateDecision.note,
          });
          await emitViewerPanelSnapshots(state);
          if (state.uiMode !== "direct") {
            console.log(`Human gate ${humanGateDecision.gateId} -> ${result.status}`);
          }
          continue;
        }
        if (initRequest) {
          await handleInitRequest(state, initRequest.text, config, workspaceRoot);
          continue;
        }
        if (questionAnswer) {
          const pendingQuestion = state.pendingQuestion;
          if (!pendingQuestion || pendingQuestion.requestId !== questionAnswer.requestId) {
            if (state.uiMode !== "direct") {
              console.log("Question answer ignored because no matching prompt is pending.");
            }
            continue;
          }
          const clarifications = formatQuestionAnswersAsClarifications({
            prompt: pendingQuestion,
            answers: questionAnswer.answers,
          });
          state.pendingQuestion = undefined;
          await emitQuestionPanelSnapshot(state);
          if (pendingQuestion.sourceKind === "init") {
            state.initFlow = {
              ...(state.initFlow ?? {
                status: "asking_questions",
              }),
              status: "analyzing_repo",
              seedText: pendingQuestion.resumeSeedText ?? state.initFlow?.seedText,
              clarificationHistory: [
                ...(state.initFlow?.clarificationHistory ?? []),
                ...clarifications.map((answerText, index) => ({
                  questionId: questionAnswer.answers[index]?.questionId,
                  answerText,
                })),
              ],
            };
            await handleInitRequest(state, pendingQuestion.resumeSeedText ?? state.initFlow?.seedText ?? "", config, workspaceRoot);
            continue;
          }
          await handleUserTurn(state, {
            text: formatQuestionAnswersAsUserMessage({
              prompt: pendingQuestion,
              answers: questionAnswer.answers,
            }),
          }, config, {
            enableCmpSync: options.once === undefined,
            inputSource: "question_answer",
          });
          continue;
        }
        const messageText = parsedInput?.text ?? raw;
        const line = messageText.trim();

        if (!line) {
          continue;
        }

        if (line === "/exit" || line === "/quit") {
          break;
        }
        if (line === "/help") {
          printHelp(state.uiMode);
          continue;
        }
        if (line === "/model") {
          printModelView(config);
          continue;
        }
        if (line === "/status") {
          printStatus(state);
          continue;
        }
        if (line === "/mp") {
          await state.mpOverlayReady?.catch(() => undefined);
          const snapshots = await emitViewerPanelSnapshots(state);
          printMpViewerSnapshot(snapshots.mp);
          continue;
        }
        if (line === "/capabilities") {
          await emitViewerPanelSnapshots(state);
          printDirectCapabilities(state.runtime);
          continue;
        }
        if (line === "/init") {
          await handleInitRequest(state, "", config, workspaceRoot);
          continue;
        }
        if (line === "/resume") {
          printResumeViewPlaceholder();
          continue;
        }
        if (line === "/agents") {
          printAgentsViewPlaceholder();
          continue;
        }
        if (line === "/permissions") {
          printPermissionsView(state.runtime);
          continue;
        }
        if (line === "/workspace") {
          printWorkspaceView();
          continue;
        }
        if (line.startsWith("/workspace ")) {
          const targetInput = line.replace(/^\/workspace\b/u, "").trim();
          const nextWorkspace = targetInput === "~"
            ? (process.env.HOME ?? workspaceRoot)
            : targetInput.startsWith("~/")
              ? resolve(process.env.HOME ?? workspaceRoot, targetInput.slice(2))
              : resolve(workspaceRoot, targetInput);
          try {
            const targetStat = await stat(nextWorkspace);
            if (!targetStat.isDirectory()) {
              console.log("The target path is not a directory. Please check the input.");
              continue;
            }
            process.chdir(nextWorkspace);
            printWorkspaceView(process.cwd());
          } catch (error) {
            if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "ENOENT") {
              console.log("The directory does not exist. Please check the input.");
              continue;
            }
            console.log(`Workspace switch failed: ${error instanceof Error ? error.message : String(error)}`);
          }
          continue;
        }
        if (line === "/language") {
          printLanguageViewPlaceholder();
          continue;
        }
        if (line === "/cmp") {
          await state.cmpInfraReady?.catch(() => undefined);
          const snapshots = await emitViewerPanelSnapshots(state);
          printCmpViewerSnapshot(snapshots.cmp, state.latestCmp ?? state.lastTurn?.cmp);
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
        if (line.startsWith("/rewind")) {
          const parts = line.split(/\s+/u).filter((entry) => entry.length > 0);
          const targetTurnIndex = Number.parseInt(parts[1] ?? "", 10);
          const result = await applyTranscriptRewind(state, targetTurnIndex);
          if (state.uiMode !== "direct") {
            console.log(
              result.ok
                ? `Rewound conversation to turn ${targetTurnIndex}.`
                : `Rewind failed: ${result.error ?? "unknown error"}`,
            );
          }
          continue;
        }

        await handleUserTurn(state, {
          text: messageText,
          attachments: parsedInput?.attachments,
          pastedContents: parsedInput?.pastedContents,
          fileRefs: parsedInput?.fileRefs,
        }, config);
      }
    } finally {
      directFallbackReader?.close();
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

void main().catch((error: unknown) => {
  if (error instanceof RaxcodeConfigError) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
});
