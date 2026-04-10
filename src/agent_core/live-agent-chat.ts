import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import OpenAI from "openai";

import {
  buildBrowserGroundingEvidenceText,
  type BrowserTurnSummary,
  updateBrowserTurnSummary,
} from "./live-agent-chat/browser-grounding.js";
import {
  createCmpFiveAgentRuntime,
  createCmpRoleLiveLlmModelExecutor,
} from "./cmp-five-agent/index.js";
import {
  executeModelInference,
  type ModelInferenceExecutionParams,
  type ModelInferenceExecutionResult,
} from "./integrations/model-inference.js";
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
import type { DialogueTurn } from "./live-agent-chat/shared.js";
import {
  applyCliDefaultsToCapabilityRequest,
  createLiveChatLogPath,
  type CoreTaskStatus,
  extractResponseTextMaybe,
  extractTextFromResponseLike,
  formatElapsed,
  formatNowStamp,
  formatTranscript,
  inferStreamLabel,
  type CmpTurnArtifacts,
  type CoreActionEnvelope,
  type CoreCapabilityRequest,
  type CoreTurnArtifacts,
  LIVE_CHAT_MODEL_PLAN,
  LiveChatLogger,
  type LiveCliState,
  LIVE_CHAT_TAP_OVERRIDE,
  normalizeCoreTaskStatus,
  type ParsedTapRequest,
  parseCliOptions,
  parseCoreActionEnvelope,
  parseTapRequest,
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
  withStopwatch,
} from "./live-agent-chat/shared.js";
import {
  createDirectFallbackReader,
  printCmpArtifacts,
  printCoreArtifacts,
  printDirectAnswer,
  printDirectBullet,
  printDirectCapabilities,
  printDirectStatus,
  printDirectSub,
  printEvents,
  printHelp,
  printHistory,
  printStartup,
  printStartupDirect,
  printStatus,
  printTapArtifacts,
  promptDirectInputBox,
  readDirectFallbackLine,
} from "./live-agent-chat/ui.js";
import {
  createAgentLineage,
  createCmpBranchFamily,
} from "./cmp-types/index.js";
import { rax } from "../rax/index.js";
import { loadOpenAILiveConfig } from "../rax/live-config.js";

let CURRENT_UI_MODE: "full" | "direct" = "full";

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
    "Your job is to finish the user task, not merely to make one tool call.",
    "If the task is not yet complete and another registered capability can move it forward, keep issuing capability_call steps until the task is actually done.",
    "Only stop and ask the user for help when you have determined that both your own reasoning and the currently registered TAP capability window cannot make further safe progress.",
    !input.forceFinalAnswer
      ? "Always set taskStatus in your JSON: completed, incomplete, blocked, or exhausted."
      : "",
    !input.forceFinalAnswer
      ? "Use taskStatus=completed only when the user's actual request has been fulfilled. Use taskStatus=incomplete when more tool work is still needed. Use blocked or exhausted only when you truly cannot continue safely."
      : "",
    !input.forceFinalAnswer
      ? "If taskStatus would be incomplete and another registered capability can still advance the task, emit action=capability_call instead of stopping with action=reply."
      : "",
    !input.forceFinalAnswer
      ? "For browser.playwright, emit exactly one reviewed action per capability_call."
      : "",
    !input.forceFinalAnswer
      ? "Do not emit browser steps arrays, actions arrays, or bundled browser master plans in one request. Let later loop iterations issue the next browser action."
      : "",
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
    "If the user asks what you can do, what abilities are in the TAP pool, or asks for a capability introduction, answer directly from the registered capability inventory below instead of calling a tool.",
    "Do not use MCP capabilities merely to inspect your own already-registered TAP inventory.",
    input.toolResultText && !input.forceFinalAnswer
      ? `You are inside an active agent loop after tool step ${input.capabilityLoopIndex ?? 0}/${input.maxCapabilityLoops ?? 0}. If the latest tool result does not yet fully complete the user's task and another registered capability can advance the task, emit another capability_call instead of stopping early.`
      : "",
    input.previousTaskStatus === "incomplete" && !input.forceFinalAnswer
      ? `Your previous follow-up reply still marked the task as incomplete${input.previousReplyText ? `: ${truncate(input.previousReplyText, 180)}` : ""}. Do not stop there. Emit the next capability_call unless the task is now truly completed, blocked, or exhausted.`
      : "",
    input.forceFinalAnswer
      ? "A TAP tool result is already available. Do not emit another tool request. Answer the user directly."
      : "If the user asks to inspect or operate the local workspace/system, or asks for current online information, emit a structured action envelope immediately whenever a fitting capability exists.",
    input.forceFinalAnswer
      ? "Summarize the actual tool result and continue the task."
      : "Exact JSON schema: {\"action\":\"reply|capability_call\",\"taskStatus\":\"completed|incomplete|blocked|exhausted\",\"responseText\":\"短中文句子\",\"capabilityRequest\":{\"capabilityKey\":\"shell.restricted|shell.session|test.run|repo.write|spreadsheet.write|doc.write|code.edit|code.patch|code.diff|git.status|git.diff|git.commit|git.push|browser.playwright|write_todos|code.read|code.ls|code.glob|code.grep|code.read_many|code.symbol_search|code.lsp|spreadsheet.read|doc.read|read_pdf|read_notebook|view_image|docs.read|search.web|search.fetch|search.ground|skill.use|skill.mount|skill.prepare|mcp.listTools|mcp.listResources|mcp.readResource|mcp.call|mcp.native.execute|request_user_input|request_permissions|audio.transcribe|speech.synthesize|image.generate\",\"reason\":\"为什么要用\",\"requestedTier\":\"B0|B1|B2|B3\",\"timeoutMs\":15000,\"input\":{}}}",
    input.forceFinalAnswer
      ? "Do not return JSON in the final answer."
      : "Return strict JSON only. No markdown fences. No prose outside JSON.",
    input.forceFinalAnswer
      ? ""
      : "For shell.restricted/test.run, use structured input like {\"command\":\"zsh\",\"args\":[\"--version\"],\"cwd\":\".\",\"timeoutMs\":15000}. For shell.session, use {\"action\":\"start\",\"command\":\"python3\",\"args\":[\"-i\"],\"cwd\":\".\",\"yield_time_ms\":500} and later {\"action\":\"write\",\"sessionId\":\"...\",\"chars\":\"print(1)\\n\"}. For code.edit, use {\"path\":\"src/file.ts\",\"old_string\":\"旧文本\",\"new_string\":\"新文本\",\"allow_multiple\":false}. For code.patch, use {\"patch\":\"*** Begin Patch\\n*** Update File: path\\n@@\\n-旧\\n+新\\n*** End Patch\\n\"}. For git.status/git.diff use bounded cwd/path inputs. For git.commit, use explicit paths like {\"cwd\":\".\",\"paths\":[\"src/file.ts\"],\"message\":\"Clear commit reason\"} and avoid sweeping unrelated dirty files. For git.push, use normal push input like {\"cwd\":\".\",\"remote\":\"origin\",\"branch\":\"feature-name\"} and never request force semantics. For browser.playwright, use actions like {\"action\":\"navigate\",\"url\":\"https://example.com\",\"allowedDomains\":[\"example.com\"],\"headless\":true}, then {\"action\":\"snapshot\"} or {\"action\":\"screenshot\"}; file uploads stay blocked unless allowFileUploads=true. For spreadsheet.read, use {\"path\":\"data/report.xlsx\",\"maxEntries\":20} or {\"path\":\"data/table.csv\",\"maxEntries\":20}; optional sheet can narrow one workbook tab. For spreadsheet.write, use {\"path\":\"artifacts/report.xlsx\",\"headers\":[\"name\",\"value\"],\"rows\":[[\"gold\",4755.44]]}. For doc.read, use {\"path\":\"docs/file.docx\",\"maxEntries\":20,\"maxBytes\":12000}. For doc.write, use {\"path\":\"artifacts/status.docx\",\"title\":\"Status\",\"content\":\"...\",\"sections\":[{\"heading\":\"Observation\",\"body\":[\"...\"]}]}. For audio.transcribe, use {\"path\":\"artifacts/meeting.mp3\",\"language\":\"zh\",\"prompt\":\"保留关键专有名词\"}. For speech.synthesize, use {\"input\":\"要播报的文本\",\"voice\":\"alloy\",\"path\":\"memory/generated/tts.mp3\"}. For image.generate, use {\"prompt\":\"A precise technical illustration...\",\"path\":\"memory/generated/diagram.png\",\"size\":\"1024x1024\"}. For request_user_input use {\"questions\":[...]} and for request_permissions use {\"permissions\":{...},\"reason\":\"...\"}. For code.symbol_search, use {\"query\":\"SymbolName\",\"path\":\".\"}. For code.lsp, use {\"path\":\"src/file.ts\",\"operation\":\"document_symbol|definition|references|hover\",\"line\":1,\"character\":1}. For read_pdf, use {\"path\":\"docs/file.pdf\",\"pages\":\"1-3\"}. For read_notebook, use {\"path\":\"notebooks/demo.ipynb\",\"maxEntries\":20}. For view_image, use {\"path\":\"assets/mockup.png\",\"detail\":\"original\"} when the user wants you to inspect a local image. For write_todos use {\"todos\":[{\"description\":\"...\",\"status\":\"pending|in_progress|completed|blocked|cancelled\"}]}. Do not use shell operators like ||, &&, pipes, redirects, or inline shell strings. For code.glob/code.grep/code.read_many, prefer bounded path/pattern inputs instead of huge raw dumps.",
    input.forceFinalAnswer
      ? ""
      : "If the user asks for latest/current web information, browsing, live situation, or anything explicitly requiring the internet, prefer search.ground; use search.web for broad discovery and search.fetch for targeted page retrieval.",
    input.forceFinalAnswer
      ? ""
      : "For search.web/search.ground, use input like {\"query\":\"问题本体\",\"freshness\":\"day\",\"citations\":\"preferred|required\"}. Provider/model defaults will be supplied by the CLI. For search.fetch, use input like {\"url\":\"https://...\",\"prompt\":\"要抽取什么\"}.",
    input.forceFinalAnswer
      ? ""
      : "When using shell.restricted, prefer bounded output. Avoid commands that dump an entire large tree or huge raw search results in one go.",
    input.forceFinalAnswer
      ? ""
      : "For skill.use / skill.mount / skill.prepare, provide route fields like provider/model and include the skill source or container in input.",
    input.forceFinalAnswer
      ? ""
      : "For MCP capabilities, provide route.provider, route.model, and structured input. Examples: mcp.listTools => {\"route\":{...},\"input\":{\"connectionId\":\"...\"}}, mcp.listResources => {\"route\":{...},\"input\":{\"connectionId\":\"...\"}}, mcp.call => {\"route\":{...},\"input\":{\"connectionId\":\"...\",\"toolName\":\"...\",\"arguments\":{}}}.",
    input.forceFinalAnswer
      ? ""
      : "If shell.restricted, shell.session, test.run, repo.write, spreadsheet.write, doc.write, code.edit, code.patch, code.diff, git.status, git.diff, git.commit, git.push, browser.playwright, write_todos, code.symbol_search, code.lsp, spreadsheet.read, doc.read, read_pdf, read_notebook, view_image, search.web, search.fetch, search.ground, request_user_input, request_permissions, audio.transcribe, speech.synthesize, or image.generate is already registered, treat it as ready-to-use TAP inventory rather than something that still needs user approval.",
    `Currently registered TAP capabilities: ${availableCapabilities || "(none)"}.`,
    "",
    "Latest user message:",
    input.userMessage,
    "",
    "Recent dialogue:",
    formatTranscript(recentTurns),
    "",
    ...cmpSummaryBlock,
    ...(input.capabilityHistoryText
      ? [
        "",
        "Capability results collected so far this turn:",
        input.capabilityHistoryText,
      ]
      : []),
    ...(input.toolResultText
      ? [
        "",
        "Latest TAP tool result:",
        input.toolResultText,
      ]
      : []),
    ...(input.groundingEvidenceText
      ? [
        "",
        "Normalized grounding evidence extracted from browser/tool results:",
        input.groundingEvidenceText,
      ]
      : []),
    "",
    "Return JSON only. No markdown fences. No prose outside JSON. Use Chinese in responseText unless the user asks for another language.",
  ].join("\n");
}

async function runCoreModelPass(input: {
  state: LiveCliState;
  userInput: string;
  cmp?: CmpTurnArtifacts;
  config: ReturnType<typeof loadOpenAILiveConfig>;
  inputImageUrls?: string[];
  reasoningEffortOverride?: "low" | "medium" | "high";
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
        reasoningEffort: input.reasoningEffortOverride ?? resolveReasoningEffort(LIVE_CHAT_MODEL_PLAN.core),
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
  const recentTranscript = state.transcript.slice(-6);
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
        "Your goal is to actually finish the user task, not just to emit a single tool call.",
        "If the current task is still incomplete and another available capability can advance it, keep emitting capability_call actions until the task is genuinely done.",
        "Only fall back to a direct reply that asks the user for help after you have determined that neither core reasoning nor the currently registered TAP capability window can safely make further progress.",
        "Always set taskStatus in your JSON: completed, incomplete, blocked, or exhausted.",
        "Use taskStatus=completed only when the user's actual request has been fulfilled. Use taskStatus=incomplete when more tool work is still needed. Use blocked or exhausted only when you truly cannot continue safely.",
        "If taskStatus would be incomplete and another available capability can still advance the task, choose action=capability_call instead of action=reply.",
        "If a fitting capability exists, choose capability_call instead of reply.",
        "Do not ask the user to approve, to run local commands themselves, or to paste command output when a fitting capability already exists.",
        "Do not say you cannot act if the capability window already contains a matching tool.",
        "If the user asks what you can do, what abilities you have, or what is currently in the TAP pool, answer directly from the available capability inventory instead of calling any tool.",
        "Do not use mcp.* just to inspect your own registered inventory.",
        "If the user asks for current, latest, online, web, or live information and search.ground is available, choose capability_call with search.ground instead of saying you cannot browse. Use search.web for broad discovery and search.fetch for targeted page reads.",
        "For shell.restricted and test.run, prefer bounded output and avoid commands likely to dump an entire large repository or massive raw result in one step.",
        "For browser.playwright, emit exactly one reviewed action per capability_call.",
        "Do not emit browser steps arrays, actions arrays, or bundled browser master plans in one request. Let later loop iterations issue the next browser action.",
        "Schema:",
        '{"action":"reply|capability_call","taskStatus":"completed|incomplete|blocked|exhausted","responseText":"user-facing text","capabilityRequest":{"capabilityKey":"shell.restricted|shell.session|test.run|repo.write|spreadsheet.write|doc.write|code.edit|code.patch|code.diff|git.status|git.diff|git.commit|git.push|browser.playwright|write_todos|code.read|code.ls|code.glob|code.grep|code.read_many|code.symbol_search|code.lsp|spreadsheet.read|doc.read|read_pdf|read_notebook|view_image|search.web|search.fetch|search.ground|skill.use|skill.mount|skill.prepare|mcp.listTools|mcp.listResources|mcp.readResource|mcp.call|mcp.native.execute|request_user_input|request_permissions|audio.transcribe|speech.synthesize|image.generate|...","reason":"short reason","input":{"command":"...","args":["..."],"cwd":"."},"requestedTier":"B0|B1|B2|B3","timeoutMs":20000}}',
        "If action=reply, omit capabilityRequest.",
        "If action=capability_call, responseText should briefly tell the user what tool you are using and then proceed.",
        "For search.web/search.ground, emit input like {\"query\":\"...\",\"freshness\":\"day\",\"citations\":\"preferred|required\"}. The CLI will supply provider/model defaults. For search.fetch, emit input like {\"url\":\"https://...\",\"prompt\":\"extract the needed facts\"}.",
        "For skill.* and mcp.* capabilities, include structured route/input objects rather than vague prose.",
        "Recent transcript window:",
        formatTranscript(recentTranscript),
        "If the recent transcript shows a capability failure and the user asks you to retry, try another suitable available capability or a revised retry, rather than asking them to restate the request.",
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
  const wantsGoldPrice = /(金价|黄金|美元\/盎司|美刀\/盎司|usd\/oz|XAU\/USD)/iu.test(params.userMessage);

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

  return undefined;
}

function isEmptyCorePlaceholderAnswer(text: string | undefined): boolean {
  if (!text) {
    return true;
  }
  return text.trim() === "" || /^Core 没有返回正文，但链路已经跑完。?$/u.test(text.trim());
}

function extractFirstMatch(text: string, pattern: RegExp): string | undefined {
  const match = text.match(pattern);
  return match?.[1]?.trim();
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
  if (capabilityKey !== "browser.playwright") {
    return undefined;
  }
  const errorRecord = executionError && typeof executionError === "object"
    ? executionError as Record<string, unknown>
    : undefined;
  const errorMessage = typeof errorRecord?.message === "string" ? errorRecord.message : "";
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
    `浏览器自动化已经执行成功，这一步实际完成了 \`${action}\`。`,
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
): Promise<CoreTurnArtifacts> {
  const maxCapabilityLoops = 4;
  const maxIncompleteReplyRecoveries = 2;
  let actionEnvelope: CoreActionEnvelope | undefined;
  let rawAnswer = "";
  let latestRunId = `${state.sessionId}:core-reply:${state.turnIndex}`;
  let latestEventTypes: string[] = [];
  let latestTaskStatus: CoreTaskStatus = "completed";
  let latestToolExecution: NonNullable<CoreTurnArtifacts["toolExecution"]> | undefined;
  let completedCapabilityLoops = 0;
  let browserTurnSummary: BrowserTurnSummary = {};
  let capabilityLoopHistory: string[] = [];
  let browserGroundingEvidenceText: string | undefined;
  let pendingToolResultText: string | undefined;
  let pendingInputImageUrls: string[] | undefined;
  let pendingIncompleteReplyText: string | undefined;
  let incompleteReplyRecoveries = 0;

  const finalizeReply = (params: {
    runId: string;
    answer: string;
    plannerRawAnswer: string;
    eventTypes: string[];
    taskStatus?: CoreTaskStatus;
  }): CoreTurnArtifacts => ({
    runId: params.runId,
    answer: params.answer,
    dispatchStatus: "reply_only",
    taskStatus: params.taskStatus ?? latestTaskStatus,
    capabilityResultStatus: latestToolExecution?.status ?? "success",
    plannerRawAnswer: params.plannerRawAnswer,
    toolExecution: latestToolExecution,
    eventTypes: params.eventTypes,
  });

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
      actionEnvelope = await runCoreActionPlanner(state, userMessage);
      rawAnswer = JSON.stringify(actionEnvelope);
    } catch {
      actionEnvelope = deterministicFirstStep;
      rawAnswer = actionEnvelope ? JSON.stringify(actionEnvelope) : "";
    }
  }

  while (true) {
    if (!actionEnvelope) {
      const fallback = await runCoreModelPass({
        state,
        userInput: buildCoreUserInput({
          userMessage,
          transcript: state.transcript,
          cmp,
          runtime: state.runtime,
          toolResultText: pendingToolResultText,
          capabilityHistoryText: capabilityLoopHistory.join("\n\n"),
          groundingEvidenceText: browserGroundingEvidenceText,
          capabilityLoopIndex: completedCapabilityLoops,
          maxCapabilityLoops,
          previousTaskStatus: pendingIncompleteReplyText ? "incomplete" : undefined,
          previousReplyText: pendingIncompleteReplyText,
        }),
        cmp,
        config,
        inputImageUrls: pendingInputImageUrls,
        reasoningEffortOverride: pendingToolResultText ? "low" : undefined,
      });
      latestRunId = fallback.runId;
      latestEventTypes = fallback.eventTypes;
      rawAnswer = fallback.answer;
      actionEnvelope = deriveActionEnvelopeFromRaw(rawAnswer)
        ?? inferDeterministicCoreActionEnvelope(state, userMessage)
        ?? deriveCapabilityEnvelopeFromTapRequest(rawAnswer);

      if (actionEnvelope?.action === "reply") {
        latestTaskStatus = normalizeCoreTaskStatus(actionEnvelope);
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
    await state.logger.log("stage_start", {
      turnIndex: state.turnIndex,
      stage: "core/capability_bridge",
      capabilityKey: capabilityRequest.capabilityKey,
      reason: capabilityRequest.reason,
      inputSummary: summarizeCapabilityRequestForLog(capabilityRequest),
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
    });

    const toolResultCapabilityKey = resolvedToolExecution.capabilityKey || capabilityRequest.capabilityKey;
    const toolResultText = resolvedToolExecution.error
      ? JSON.stringify({ error: resolvedToolExecution.error }, null, 2)
      : summarizeToolOutputForCore(toolResultCapabilityKey, resolvedToolExecution.output ?? {});
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
      ? inferDeterministicBrowserFollowupEnvelope({
        userMessage,
        toolExecution: resolvedToolExecution,
        summary: browserTurnSummary,
      })
      : undefined;
    if (deterministicFollowup?.action === "capability_call" && deterministicFollowup.capabilityRequest) {
      latestTaskStatus = normalizeCoreTaskStatus(deterministicFollowup);
      actionEnvelope = deterministicFollowup;
      rawAnswer = JSON.stringify(deterministicFollowup);
      pendingToolResultText = undefined;
      pendingInputImageUrls = undefined;
      pendingIncompleteReplyText = undefined;
      continue;
    }

    const followup = await runCoreModelPass({
      state,
      userInput: buildCoreUserInput({
        userMessage,
        transcript: state.transcript,
        cmp,
        runtime: state.runtime,
        toolResultText,
        capabilityHistoryText: capabilityLoopHistory.join("\n\n"),
        groundingEvidenceText: browserGroundingEvidenceText,
        forceFinalAnswer,
        capabilityLoopIndex: completedCapabilityLoops,
        maxCapabilityLoops,
      }),
      cmp,
      config,
      inputImageUrls,
      reasoningEffortOverride: "low",
    });
    latestRunId = followup.runId;
    latestEventTypes = [
      ...followup.eventTypes,
      "core.action_planner.capability_call",
      "core.capability_bridge.executed",
    ];
    const followupRawAnswer = followup.answer?.trim() ?? "";
    const followupEnvelope = !forceFinalAnswer
      ? (deriveActionEnvelopeFromRaw(followupRawAnswer) ?? deriveCapabilityEnvelopeFromTapRequest(followupRawAnswer))
      : undefined;

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
      latestTaskStatus = normalizeCoreTaskStatus(followupEnvelope);
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
    latestTaskStatus = toolResultCapabilityKey === "search.ground"
      && (resolvedToolExecution.status === "success" || resolvedToolExecution.status === "partial")
      && !isEmptyCorePlaceholderAnswer(followupAnswer)
      ? "completed"
      : deriveTerminalCoreTaskStatus({
        toolExecutionStatus: resolvedToolExecution.status,
        forceFinalAnswer,
        envelope: followupEnvelope,
      });
    return {
      runId: followup.runId,
      answer: followupAnswer,
      dispatchStatus: completedCapabilityLoops > 1 ? "capability_loop_completed" : "capability_executed",
      taskStatus: latestTaskStatus,
      capabilityKey: capabilityRequest.capabilityKey,
      capabilityResultStatus: resolvedToolExecution.status,
      plannerRawAnswer: rawAnswer,
      toolExecution: resolvedToolExecution,
      eventTypes: latestEventTypes,
    };
  }
}

async function handleUserTurn(
  state: LiveCliState,
  userMessage: string,
  config: ReturnType<typeof loadOpenAILiveConfig>,
  options: {
    enableCmpSync?: boolean;
  } = {},
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
  if (options.enableCmpSync === false) {
    state.pendingCmpSync = undefined;
  } else {
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
  }

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
  state.lastTurn = {
    cmp: state.latestCmp ?? previousCmp ?? {
      agentId: options.enableCmpSync === false ? "cmp-sidecar-skipped" : "cmp-sidecar-pending",
      packageId: options.enableCmpSync === false ? "skipped" : "pending",
      packageRef: options.enableCmpSync === false ? "skipped" : "pending",
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
    },
    core,
  };
  await state.logger.log("turn_result", {
    turnIndex: state.turnIndex,
    cmp: trimStructuredValue(state.lastTurn.cmp, 4_000),
    core: trimStructuredValue(core, 5_000),
    transcriptTail: trimStructuredValue(state.transcript.slice(-8), 2_000),
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

function createRuntime() {
  const reviewerRoute = toTapAgentModelRoute(LIVE_CHAT_MODEL_PLAN.tap.reviewer);
  const toolReviewerRoute = toTapAgentModelRoute(LIVE_CHAT_MODEL_PLAN.tap.toolReviewer);
  const provisionerRoute = toTapAgentModelRoute(LIVE_CHAT_MODEL_PLAN.tap.provisioner);

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

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  CURRENT_UI_MODE = options.uiMode;
  const config = loadOpenAILiveConfig();
  const logPath = createLiveChatLogPath();
  await mkdir(resolve(process.cwd(), "memory/live-reports"), { recursive: true });
  const logger = new LiveChatLogger(logPath);
  const runtime = createRuntime();
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
      await handleUserTurn(state, options.once, config, {
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
        const line = raw.trim();

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
      directFallbackReader?.readline.close();
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
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
});
