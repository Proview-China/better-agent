import { execFile as execFileCallback, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, statSync, writeSync } from "node:fs";
import { mkdir, open, rename, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, resolve } from "node:path";
import { Box, render, Text, useInput, type Instance as InkInstance } from "ink";
import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import stringWidth from "string-width";
import { promisify } from "node:util";

import { loadOpenAILiveConfig, type OpenAILiveConfig } from "../rax/live-config.js";
import {
  loadRaxcodeConfigFile as loadRaxodeConfigFile,
  loadRaxcodeRuntimeConfigSnapshot as loadRaxodeRuntimeConfigSnapshot,
  loadResolvedEmbeddingConfig,
  resolveConfiguredWorkspaceRoot,
  type RaxcodeAnimationMode as RaxodeAnimationMode,
  type RaxcodeConfigFile as RaxodeConfigFile,
  type RaxcodeRoleId,
  type RaxcodeReasoningEffort as RaxodeReasoningEffort,
  writeRaxcodeConfigFile as writeRaxodeConfigFile,
} from "../raxcode-config.js";
import { getOpenAIAuthStatus } from "../raxcode-openai-auth.js";
import { resolveAppRoot } from "../runtime-paths.js";
import {
  buildRaxodeTerminalTitle,
  RAXODE_TERMINAL_TITLE_MOON_PHASES,
  writeTerminalTitle,
} from "../terminal-title.js";
import { applySurfaceEvent, createInitialSurfaceState } from "./surface/reducer.js";
import {
  selectActiveTasks,
  selectInterruptibleTasks,
  selectTranscriptMessages,
} from "./surface/selectors.js";
import {
  createSurfaceMessage,
  createSurfaceOverlay,
  createSurfaceSession,
  createSurfaceTask,
  createSurfaceTurn,
  type SurfaceAppState,
  type SurfaceMessage,
  type SurfaceTask,
} from "./surface/types.js";
import {
  applyTuiTextInputKey,
  createTuiTextInputState,
  isBackwardDeleteInput,
  insertIntoTuiTextInput,
  setTuiTextInputValue,
  type TuiTextInputState,
} from "./tui-input/text-input.js";
import {
  applySlashSuggestion,
  computeSlashState,
  DEFAULT_PRAXIS_SLASH_COMMANDS,
} from "./tui-input/slash-engine.js";
import {
  cycleChoiceValue,
  findNextInteractiveFieldIndex,
  findPrimaryActionField,
  isInteractivePanelField,
  PRAXIS_LANGUAGE_OPTIONS,
  PRAXIS_MODEL_OPTIONS,
  PRAXIS_PERMISSION_MODE_OPTIONS,
  PRAXIS_REASONING_OPTIONS,
  type PraxisSlashPanelBodyLine,
  type PraxisSlashPanelField,
  type PraxisSlashPanelId,
  type PraxisSlashPanelView,
} from "./tui-input/slash-panels.js";
import {
  buildPermissionModeMatrixLines,
  describePermissionMode,
  findPermissionPanelFocusIndex,
  resolvePermissionPanelSelectedMode,
} from "./tui-input/permissions-panel.js";
import {
  buildHumanGatePanelBodyLines,
  buildHumanGatePanelFields,
  resolveHumanGatePendingSignature,
  type HumanGatePanelEntry,
} from "./tui-input/human-gate-panel.js";
import {
  findActiveFileMentionToken,
  replaceFileMentionToken,
  type ActiveFileMentionToken,
} from "./tui-input/composer-file-mentions.js";
import {
  COMPOSER_POPUP_PAGE_SIZE,
  formatComposerPopupOrdinal,
  moveComposerPopupSelection,
  paginateComposerPopupItems,
  renderComposerPopupRowText,
} from "./tui-input/composer-popup-pagination.js";
import {
  listDirectTuiAgents,
  listDirectTuiSessions,
  renameDirectTuiAgent,
  saveDirectTuiAgent,
  loadDirectTuiSessionSnapshot,
  renameDirectTuiSession,
  resolveDirectTuiSessionSnapshotPath,
  saveDirectTuiSessionSnapshot,
  type DirectTuiAgentRegistryRecord,
  type DirectTuiAgentSnapshot,
  type DirectTuiSessionExitSummary,
  type DirectTuiSessionMessageRecord,
  type DirectTuiSessionSnapshot,
  type DirectTuiSessionUsageEntry,
} from "./tui-input/direct-session-store.js";
import {
  buildDirectTuiSessionExitSummary,
  formatDirectTuiPercent,
  formatDirectTuiTokenCount,
  formatDirectTuiUsd,
} from "./tui-input/direct-session-summary.js";
import {
  appendDirectTuiCheckpointEvent,
  listDirectTuiTurnCheckpoints,
  upsertDirectTuiTurnCheckpoint,
  type DirectTuiTurnCheckpointRecord,
} from "./tui-input/direct-turn-checkpoints.js";
import {
  EMBEDDING_MODEL_CATALOG,
  buildChatModelAvailabilityScopeKey,
  buildEmbeddingModelAvailabilityScopeKey,
  getCachedModelAvailability,
  listAvailableChatModels,
  probeChatModelAvailability,
  probeEmbeddingModelAvailability,
  type ModelAvailabilityRecord,
  setCachedModelAvailability,
  type AvailableModelCatalogEntry,
} from "./tui-input/model-catalog.js";
import {
  composeStatusRateLimitDisplayView,
  readCachedStatusRateLimitRecord,
  refreshStatusRateLimitRecord,
  type StatusRateLimitCacheRecord,
} from "./tui-input/status-rate-limits.js";
import {
  buildDirectTuiRewindModeOptions,
  buildDirectTuiRewindTurnOptions,
  parseDirectTuiTurnIndex,
  rewindSurfaceStateToTurn,
  type DirectTuiRewindMode,
  type DirectTuiRewindModeOption,
  type DirectTuiRewindTurnOption,
} from "./tui-input/rewind-state.js";
import { resolveNextOptimisticTurnIndex } from "./tui-input/optimistic-turn-index.js";
import {
  formatHumanGateDecisionEnvelope,
} from "./live-agent-chat/human-gate-envelope.js";
import {
  deriveDirectTuiCmpStatusDescriptor,
  resolveDirectTuiAssistantTurnResultAction,
  shouldBreakDirectTuiAssistantSegmentOnStageStart,
  shouldRenderDirectTuiConversationHeader,
} from "./tui-input/direct-tui-presentation.js";
import {
  buildTerminalTableBodyLines,
  type TerminalTableRow,
} from "./tui-input/viewer-table-layout.js";
import {
  buildViewerStatusBlockLines,
  isViewerStatusTextAbnormal,
  parseViewerAssignmentEntries,
  parseViewerRoleEntries,
  type ViewerStatusEntry,
} from "./tui-input/viewer-status-blocks.js";
import { buildCapabilityViewerBodyLines } from "./tui-input/capability-viewer-panel.js";
import {
  resolveCapabilityFamilyDefinition,
  resolveFamilyOutcomeKind,
  shouldRenderCapabilityFamilyBlock,
} from "./live-agent-chat/family-telemetry.js";
import {
  searchWorkspaceDirectories,
  searchWorkspaceFiles,
  loadWorkspaceIndex,
  type WorkspaceIndexSearchResult,
  type WorkspaceIndexSnapshot,
} from "./tui-input/workspace-index.js";
import {
  type DirectInputImageAttachment,
  type DirectInputFileReference,
  type DirectInputPastedContentAttachment,
  decodeEscapedDisplayTextMaybe,
  extractResponseTextMaybe,
} from "./live-agent-chat/shared.js";
import {
  refineWebSearchToolSummary,
  summarizePendingComposerText,
} from "./tui-mini-summary.js";
import { TUI_THEME } from "./tui-theme.js";
import {
  resolveConfigRoot,
  resolveStateRoot,
} from "../runtime-paths.js";
import {
  type WorkspaceGitCheckpointRestoreResult,
  writeWorkspaceGitCheckpoint,
} from "./tui-input/workspace-git-checkpoint.js";
import { restoreWorkspaceGitCheckpointInSubprocess } from "./tui-input/workspace-git-checkpoint-subprocess.js";
import {
  readWorkspaceRaxodeGitReadback,
  upsertWorkspaceRaxodeAgent,
} from "./tui-input/workspace-raxode-store.js";

const execFile = promisify(execFileCallback);

type BackendStatus = "starting" | "ready" | "exited" | "failed";

interface LiveContextRecord {
  provider?: string;
  model?: string;
  windowTokens?: number;
  windowSource?: string;
  promptKind?: string;
  promptTokens?: number;
  transcriptTokens?: number;
  maxOutputTokens?: number | null;
}

interface LiveLogRecord {
  ts: string;
  event: string;
  sessionId?: string;
  targetTurnId?: string;
  removedTurns?: number;
  panel?: "cmp" | "mp" | "capabilities" | "init" | "question";
  snapshot?: unknown;
  turnIndex?: number;
  stage?: string;
  status?: string;
  label?: string;
  elapsedMs?: number;
  userMessage?: string;
  inputSource?: string;
  capabilityKey?: string | null;
  reason?: string;
  inputSummary?: string;
  tapFamilyKey?: string;
  tapFamilyTitle?: string;
  familyKey?: string;
  familyTitle?: string;
  familyIntentSummary?: string;
  familyOutcomeKind?: "succeeded" | "failed" | "blocked" | "timed_out" | "partial";
  familyResultSummary?: string[];
  resultMetadata?: {
    selectedBackend?: string;
    resolvedBackend?: string;
    fallbackApplied?: boolean;
    sourceTitles?: string[];
    sourceCount?: number;
    sourceKind?: string;
    errorCode?: string;
    errorDetailCode?: string;
    targetRefs?: string[];
    targetPaths?: string[];
    targetUrl?: string;
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
    itemCount?: number;
    resultCount?: number;
    targetName?: string;
    toolName?: string;
    resourceUri?: string;
    skillName?: string;
    mountCount?: number;
    outputCount?: number;
    requestKind?: string;
    durationMs?: number;
    todoCount?: number;
    trackerId?: string;
    commitHash?: string;
    branchName?: string;
    mimeType?: string;
  };
  output?: unknown;
  error?: unknown;
  core?: {
    answer?: string | {
      text?: string;
      truncated?: boolean;
      originalChars?: number;
    };
    dispatchStatus?: string;
    taskStatus?: string;
    capabilityKey?: string;
    capabilityResultStatus?: string;
    usage?: {
      inputTokens?: number;
      outputTokens?: number;
      thinkingTokens?: number;
      estimated?: boolean;
    };
    elapsedMs?: number;
    context?: LiveContextRecord;
  };
  context?: LiveContextRecord;
  text?: string;
  done?: boolean;
}

interface RenderLine {
  kind: SurfaceMessage["kind"] | "detail";
  text: string;
  fillChar?: string;
  fillColor?: string;
  segments?: Array<{
    text: string;
    color?: string;
    backgroundColor?: string;
  }>;
  continuationSegments?: Array<{
    text: string;
    color?: string;
    backgroundColor?: string;
  }>;
}

interface RenderBlock {
  key: string;
  lines: RenderLine[];
}

interface TuiImageAttachment extends DirectInputImageAttachment {
  displayName: string;
}

interface TuiPastedContentAttachment extends DirectInputPastedContentAttachment {
  displayName: string;
}

interface TuiFileReferenceAttachment extends DirectInputFileReference {
  displayName: string;
}

const IMAGE_URL_PATTERN = /https?:\/\/[^\s)\]}>"'`]+/gu;
const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*\]\(([^)\s]+)\)/gu;
const QUOTED_IMAGE_CANDIDATE_PATTERN = /["'`]([^"'`]+\.(?:png|jpe?g|gif|webp|bmp|svg))["'`]/giu;
const LOCAL_IMAGE_EXTENSION_PATTERN = /\.(png|jpe?g|gif|webp|bmp|svg)$/iu;
const CLIPBOARD_IMAGE_MIME_CANDIDATES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/svg+xml",
] as const;
const PASTED_CONTENT_COMPRESSION_THRESHOLD = 1000;
const COMPOSER_SPECIAL_TOKEN_PATTERN = /\[(?:Image #\d+|Pasted Content #\d+ with \d+ characters)\]/gu;
const PASTE_AGGREGATION_WINDOW_MS = 60;
const PERMISSIONS_PANEL_AUTO_RETURN_MS = 1_000;
const SESSION_SWITCH_TIMEOUT_MS = 5_000;
const VIEWER_PAGE_SIZE = 12;
const CAPABILITY_VIEWER_PAGE_SIZE = 1;

function normalizeClipboardText(text: string): string {
  return text.replace(/\r\n/gu, "\n");
}

function renderComposerLineFragments(
  line: string,
  color: string,
): Array<{ text: string; color: string }> {
  const fragments: Array<{ text: string; color: string }> = [];
  let lastIndex = 0;
  for (const match of line.matchAll(COMPOSER_SPECIAL_TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      fragments.push({
        text: line.slice(lastIndex, index),
        color,
      });
    }
    fragments.push({
      text: match[0],
      color: TUI_THEME.violet,
    });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < line.length) {
    fragments.push({
      text: line.slice(lastIndex),
      color,
    });
  }
  return fragments.length > 0 ? fragments : [{ text: line, color }];
}

function looksLikeImageUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return LOCAL_IMAGE_EXTENSION_PATTERN.test(parsed.pathname);
  } catch {
    return false;
  }
}

function trimImageCandidate(raw: string): string {
  return raw.replace(/^[("'`]+/u, "").replace(/[)"'`.,;!?]+$/u, "");
}

async function maybeResolveLocalImagePath(input: string, currentCwd: string): Promise<string | undefined> {
  const candidate = trimImageCandidate(input);
  if (!LOCAL_IMAGE_EXTENSION_PATTERN.test(candidate) || /^https?:\/\//iu.test(candidate)) {
    return undefined;
  }
  const absolutePath = expandWorkspaceInputPath(candidate, currentCwd);
  try {
    const entry = await stat(absolutePath);
    return entry.isFile() ? absolutePath : undefined;
  } catch {
    return undefined;
  }
}

async function detectAutoImageAttachments(
  text: string,
  currentCwd: string,
): Promise<DirectInputImageAttachment[]> {
  const discovered = new Map<string, DirectInputImageAttachment>();
  const maybeAdd = (key: string, attachment: DirectInputImageAttachment) => {
    if (!discovered.has(key)) {
      discovered.set(key, attachment);
    }
  };

  for (const match of text.matchAll(MARKDOWN_IMAGE_PATTERN)) {
    const candidate = trimImageCandidate(match[1] ?? "");
    if (looksLikeImageUrl(candidate)) {
      maybeAdd(`url:${candidate}`, {
        id: `auto-url:${candidate}`,
        sourceKind: "remote_url",
        remoteUrl: candidate,
        displayName: candidate,
      });
      continue;
    }
    const localPath = await maybeResolveLocalImagePath(candidate, currentCwd);
    if (localPath) {
      maybeAdd(`path:${localPath}`, {
        id: `auto-path:${localPath}`,
        sourceKind: "local_path",
        localPath,
        displayName: localPath,
      });
    }
  }

  for (const match of text.matchAll(QUOTED_IMAGE_CANDIDATE_PATTERN)) {
    const candidate = trimImageCandidate(match[1] ?? "");
    const localPath = await maybeResolveLocalImagePath(candidate, currentCwd);
    if (localPath) {
      maybeAdd(`path:${localPath}`, {
        id: `auto-path:${localPath}`,
        sourceKind: "local_path",
        localPath,
        displayName: localPath,
      });
    }
  }

  for (const rawCandidate of text.split(/\s+/u)) {
    const candidate = trimImageCandidate(rawCandidate);
    if (!candidate) {
      continue;
    }
    if (looksLikeImageUrl(candidate)) {
      maybeAdd(`url:${candidate}`, {
        id: `auto-url:${candidate}`,
        sourceKind: "remote_url",
        remoteUrl: candidate,
        displayName: candidate,
      });
      continue;
    }
    const localPath = await maybeResolveLocalImagePath(candidate, currentCwd);
    if (localPath) {
      maybeAdd(`path:${localPath}`, {
        id: `auto-path:${localPath}`,
        sourceKind: "local_path",
        localPath,
        displayName: localPath,
      });
    }
  }

  for (const match of text.matchAll(IMAGE_URL_PATTERN)) {
    const candidate = trimImageCandidate(match[0]);
    if (!looksLikeImageUrl(candidate)) {
      continue;
    }
    maybeAdd(`url:${candidate}`, {
      id: `auto-url:${candidate}`,
      sourceKind: "remote_url",
      remoteUrl: candidate,
      displayName: candidate,
    });
  }

  return [...discovered.values()];
}

async function readClipboardTargets(): Promise<string> {
  try {
    const { stdout } = await execFile("wl-paste", ["--list-types"], {
      encoding: "utf8",
      timeout: 5_000,
    });
    return stdout;
  } catch {
    const { stdout } = await execFile("xclip", ["-selection", "clipboard", "-t", "TARGETS", "-o"], {
      encoding: "utf8",
      timeout: 5_000,
    });
    return stdout;
  }
}

async function readClipboardImageBytes(mimeType: string): Promise<Buffer | undefined> {
  try {
    const { stdout } = await execFile("wl-paste", ["--type", mimeType], {
      encoding: "buffer",
      timeout: 5_000,
      maxBuffer: 20 * 1024 * 1024,
    });
    return Buffer.isBuffer(stdout) && stdout.length > 0 ? stdout : undefined;
  } catch {
    try {
      const { stdout } = await execFile("xclip", ["-selection", "clipboard", "-t", mimeType, "-o"], {
        encoding: "buffer",
        timeout: 5_000,
        maxBuffer: 20 * 1024 * 1024,
      });
      return Buffer.isBuffer(stdout) && stdout.length > 0 ? stdout : undefined;
    } catch {
      return undefined;
    }
  }
}

async function readClipboardText(): Promise<string | undefined> {
  try {
    const { stdout } = await execFile("wl-paste", ["--no-newline"], {
      encoding: "utf8",
      timeout: 5_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    return stdout.length > 0 ? normalizeClipboardText(stdout) : undefined;
  } catch {
    try {
      const { stdout } = await execFile("xclip", ["-selection", "clipboard", "-o"], {
        encoding: "utf8",
        timeout: 5_000,
        maxBuffer: 4 * 1024 * 1024,
      });
      return stdout.length > 0 ? normalizeClipboardText(stdout) : undefined;
    } catch {
      return undefined;
    }
  }
}

function createPastedContentAttachment(text: string, nextIndex: number): TuiPastedContentAttachment {
  const tokenText = `[Pasted Content #${nextIndex} with ${text.length} characters]`;
  return {
    id: `pasted-content-${nextIndex}`,
    tokenText,
    text,
    characterCount: text.length,
    displayName: tokenText,
  };
}

function restorePastedContentTokens(
  text: string,
  entries: readonly Pick<TuiPastedContentAttachment, "tokenText" | "text">[],
): string {
  let restored = text;
  for (const entry of entries) {
    if (entry.tokenText) {
      restored = restored.split(entry.tokenText).join(entry.text);
    }
  }
  return restored;
}

async function readClipboardImageAttachment(params: {
  sessionId: string;
  nextIndex: number;
}): Promise<TuiImageAttachment | undefined> {
  let targets = "";
  try {
    targets = await readClipboardTargets();
  } catch {
    return undefined;
  }
  const selectedMimeType = CLIPBOARD_IMAGE_MIME_CANDIDATES.find((candidate) => targets.includes(candidate));
  if (!selectedMimeType) {
    return undefined;
  }
  const bytes = await readClipboardImageBytes(selectedMimeType);
  if (!bytes || bytes.length === 0) {
    return undefined;
  }
  const extension = extname(`x.${selectedMimeType.split("/")[1] ?? "png"}`).replace(".svg+xml", ".svg")
    || ".png";
  const tempDir = resolve(tmpdir(), "praxis-live-cli", params.sessionId);
  await mkdir(tempDir, { recursive: true });
  const localPath = resolve(tempDir, `clipboard-image-${params.nextIndex}${extension}`);
  await writeFile(localPath, bytes);
  const tokenText = `[Image #${params.nextIndex}]`;
  return {
    id: `clipboard-image-${params.nextIndex}`,
    tokenText,
    sourceKind: "clipboard",
    displayName: tokenText,
    mimeType: selectedMimeType,
    localPath,
  };
}

function formatTurnUsageDetail(input?: {
  inputTokens?: number;
  outputTokens?: number;
  thinkingTokens?: number;
  elapsedMs?: number;
}): string | null {
  if (!input) {
    return null;
  }
  const parts: string[] = [];
  if (typeof input.inputTokens === "number" && Number.isFinite(input.inputTokens)) {
    parts.push(`input ${input.inputTokens} tokens`);
  }
  if (typeof input.outputTokens === "number" && Number.isFinite(input.outputTokens)) {
    parts.push(`output ${input.outputTokens} tokens`);
  }
  if (typeof input.thinkingTokens === "number" && Number.isFinite(input.thinkingTokens)) {
    parts.push(`thinking ${input.thinkingTokens} tokens`);
  }
  if (typeof input.elapsedMs === "number" && Number.isFinite(input.elapsedMs)) {
    const totalSeconds = Math.max(0, Math.floor(input.elapsedMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      parts.push(`${hours}h ${minutes}m ${String(seconds).padStart(2, "0")}s`);
    } else if (minutes > 0) {
      parts.push(`${minutes}m ${seconds}s`);
    } else {
      parts.push(`${seconds}s`);
    }
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function revealTextFromLeft(value: string, visibleWidth: number): string {
  if (visibleWidth <= 0) {
    return " ".repeat(stringWidth(value));
  }
  let output = "";
  let width = 0;
  for (const char of [...value]) {
    const charWidth = Math.max(1, stringWidth(char));
    if (width + charWidth > visibleWidth) {
      break;
    }
    output += char;
    width += charWidth;
  }
  return padTextToWidth(output, stringWidth(value));
}

function buildExitSummaryPanelLines(
  summary: DirectTuiSessionExitSummary,
  animationStep: number,
  terminalWidth: number,
): string[] {
  const resumeCommand = `Resume to RUN:  raxode resume ${summary.resumeSelector}`;
  const statsLines = [
    `Input Tokens:`,
    `Output Tokens:`,
    `Thinking Budget:`,
    `Total Price:`,
    `Success Rate:`,
    resumeCommand,
  ];
  const statsValues = [
    formatDirectTuiTokenCount(summary.inputTokens),
    formatDirectTuiTokenCount(summary.outputTokens),
    formatDirectTuiTokenCount(summary.thinkingTokens),
    formatDirectTuiUsd(summary.totalPriceUsd),
    formatDirectTuiPercent(summary.successRate),
    "",
  ];
  const availableInnerWidth = Math.max(88, Math.min(terminalWidth - 2, 118));
  const maxArtWidth = EXIT_SUMMARY_ART_LINES.reduce((max, line) => Math.max(max, stringWidth(line)), 0);
  const statsLabelWidth = Math.max(
    ...statsLines.slice(0, 5).map((line) => stringWidth(line)),
    stringWidth(resumeCommand),
  );
  const statsValueWidth = Math.max(
    12,
    ...statsValues.slice(0, 5).map((line) => stringWidth(line)),
  );
  const gapWidth = 2;
  const minStatsWidth = statsLabelWidth + 2 + statsValueWidth;
  const artWidth = Math.min(maxArtWidth, Math.max(36, availableInnerWidth - minStatsWidth - gapWidth));
  const statsWidth = Math.max(
    minStatsWidth,
    availableInnerWidth - artWidth - gapWidth,
  );
  const innerWidth = artWidth + gapWidth + statsWidth;
  const visibleArtWidth = Math.max(0, animationStep * EXIT_SUMMARY_REVEAL_WIDTH_PER_STEP);
  const totalRows = EXIT_SUMMARY_ART_LINES.length;
  const rows = Array.from({ length: totalRows }, (_, index) => {
    const art = EXIT_SUMMARY_ART_LINES[index] ?? "";
    const stats = index < 5
      ? `${padTextToWidth(statsLines[index] ?? "", statsLabelWidth)}  ${padTextToWidth(statsValues[index] ?? "", statsValueWidth)}`
      : padTextToWidth(statsLines[index] ?? "", statsWidth);
    const revealedArt = index < EXIT_SUMMARY_ART_LINES.length ? revealTextFromLeft(art, visibleArtWidth) : "";
    return `│${padTextToWidth(revealedArt, artWidth)}${" ".repeat(gapWidth)}${padTextToWidth(stats, statsWidth)}│`;
  });
  return [
    `┌${"─".repeat(innerWidth)}┐`,
    ...rows,
    `└${"─".repeat(innerWidth)}┘`,
  ];
}

function isRaxodeAnimationMode(value: string | undefined): value is RaxodeAnimationMode {
  return value === "fresh" || value === "resume" || value === "off";
}

const DEFAULT_CONTEXT_WINDOW = 1_050_000;
const CONTEXT_BAR_WIDTH = 10;
const STATUS_CONTEXT_BAR_WIDTH = 20;
const STARTUP_WORD = "RAXODE";
const STARTUP_ANIMATION_INTERVAL_MS = 200;
const ANIMATION_TICK_MS = 1000 / 60;
const TERMINAL_TITLE_SPINNER_INTERVAL_MS = 160;
const REWIND_SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;
const REWIND_SPINNER_FRAME_STEP = 3;
const COMPOSER_PLACEHOLDER =
  "Hold Shift to select, Ctrl+V to paste images, @ to choose files, / to choose commands";
const INIT_COMPOSER_PLACEHOLDER =
  "Ctrl+V to paste images, @ to choose files, ENTER to send for initialization";
const QUESTION_COMPOSER_PLACEHOLDER =
  "Type note for the current question, then press TAB to switch modes";
const QUESTION_WAITING_DOT_FRAMES = ["●○○", "○●○", "○○●", "○●○"] as const;
const LOG_TAIL_READ_CHUNK_BYTES = 32 * 1024;
const LOG_TAIL_PROCESS_BATCH_SIZE = 40;
const STARTUP_RAINBOW_BASE_COLORS = [
  "redBright",
  "yellow",
  "yellowBright",
  "greenBright",
  "cyanBright",
  "magenta",
  "magentaBright",
] as const;
const STARTUP_RAINBOW_COLORS = [
  ...STARTUP_RAINBOW_BASE_COLORS,
  ...STARTUP_RAINBOW_BASE_COLORS,
  ...STARTUP_RAINBOW_BASE_COLORS,
  "magentaBright",
] as const;
const CMP_CONTEXT_ANIMATION_COLORS = [
  "redBright",
  "yellow",
  "yellowBright",
  "greenBright",
  "cyanBright",
  "magenta",
  "magentaBright",
] as const;
const CMP_CONTEXT_SPINNER_FRAMES = ["◐", "◓", "◑", "◒"] as const;
const FOOTER_CONTEXT_BREATH_FRAMES = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"] as const;
const FOOTER_CONTEXT_BREATH_COLORS = ["gray", "cyan", "cyanBright", "greenBright", "cyanBright"] as const;
const FOOTER_CONTEXT_BREATH_INTERVAL_MS = 150;
const RUN_STATUS_DOT_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;
const SYNC_OUTPUT_BEGIN = "\u001B[?2026h";
const SYNC_OUTPUT_END = "\u001B[?2026l";

const composerCursorParking = {
  row: 1,
  column: 1,
  active: false,
};

const inkCursorAwareStdout = new Proxy(process.stdout, {
  get(target, property, receiver) {
    if (property === "write") {
      return (chunk: string | Uint8Array, ...args: unknown[]) => {
        if (target.isTTY) {
          target.write(SYNC_OUTPUT_BEGIN);
        }
        const result = target.write(chunk as never, ...(args as []));
        paintTerminalOverlayIfNeeded(target);
        if (composerCursorParking.active && target.isTTY) {
          target.write("\u001B[?25h");
          target.write(`\u001B[${composerCursorParking.row};${composerCursorParking.column}H`);
        }
        if (target.isTTY) {
          target.write(SYNC_OUTPUT_END);
        }
        return result;
      };
    }
    return Reflect.get(target, property, receiver);
  },
});

const MAX_RENDER_LINES = 1000;
const MAX_DEBUG_LINE_CHARS = 180;
const ACTIVE_TASK_GUARD_TEXT = "A task is currently running. Please stop the current work first.";
const WORKSPACE_DIRECTORY_MISSING_TEXT = "The directory does not exist. Please check the input.";
const WORKSPACE_NOT_DIRECTORY_TEXT = "The target path is not a directory. Please check the input.";
const REWIND_ESC_WINDOW_MS = 500;
const EXIT_SUMMARY_ART_LINES = [
  "  ██████╗   █████╗  ██╗  ██╗  ██████╗  ██████╗  ███████╗",
  "  ██╔══██╗ ██╔══██╗ ╚██╗██╔╝ ██╔═══██╗ ██╔══██╗ ██╔════╝",
  "  ██████╔╝ ███████║  ╚███╔╝  ██║   ██║ ██║  ██║ █████╗  ",
  "  ██╔══██╗ ██╔══██║  ██╔██╗  ██║   ██║ ██║  ██║ ██╔══╝  ",
  "  ██║  ██║ ██║  ██║ ██╔╝ ██╗ ╚██████╔╝ ██████╔╝ ███████╗",
  "  ╚═╝  ╚═╝ ╚═╝  ╚═╝ ╚═╝  ╚═╝  ╚═════╝  ╚═════╝  ╚══════╝",
] as const;
const EXIT_SUMMARY_FRAME_MS = 42;
const EXIT_SUMMARY_REVEAL_WIDTH_PER_STEP = 6;
const EXIT_SUMMARY_TOTAL_STEPS = Math.ceil(
  Math.max(...EXIT_SUMMARY_ART_LINES.map((line) => stringWidth(line))) / EXIT_SUMMARY_REVEAL_WIDTH_PER_STEP,
);

function isExitBlockingTask(task: Pick<SurfaceTask, "status">): boolean {
  return task.status === "queued" || task.status === "running";
}

function hasExitBlockingTasks(tasks: readonly Pick<SurfaceTask, "status">[]): boolean {
  return tasks.some((task) => isExitBlockingTask(task));
}
const EXIT_SUMMARY_DISPLAY_MS = EXIT_SUMMARY_TOTAL_STEPS * EXIT_SUMMARY_FRAME_MS + EXIT_SUMMARY_FRAME_MS;

type ExitPanelAction =
  | "close"
  | "force_exit"
  | "wait_then_exit"
  | "switch_to_running_task";

interface ExitSummaryDisplayState {
  summary: DirectTuiSessionExitSummary;
  animationStep: number;
  animated: boolean;
  startedAtMs: number;
  exitAtMs: number;
  finalLines: string[];
}

let directTuiInkInstance: InkInstance | null = null;
let persistedDirectTuiExitInFlight = false;
const DIRECT_TUI_EXIT_SUMMARY_FILE = process.env.PRAXIS_EXIT_SUMMARY_FILE;

async function persistDirectTuiExitSummaryFile(lines: string[]): Promise<"persisted" | "missing_path" | "write_failed"> {
  if (!DIRECT_TUI_EXIT_SUMMARY_FILE) {
    return "missing_path";
  }
  try {
    const tempPath = `${DIRECT_TUI_EXIT_SUMMARY_FILE}.tmp`;
    await writeFile(
      tempPath,
      `${JSON.stringify({ lines })}\n`,
      "utf8",
    );
    await rename(tempPath, DIRECT_TUI_EXIT_SUMMARY_FILE);
    return "persisted";
  } catch {
    return "write_failed";
  }
}

async function persistDirectTuiExitSummaryAndExit(input: {
  lines: string[];
  exitCode: number;
}): Promise<never> {
  if (persistedDirectTuiExitInFlight) {
    return await new Promise<never>(() => {});
  }
  persistedDirectTuiExitInFlight = true;

  const instance = directTuiInkInstance;
  if (instance) {
    try {
      composerCursorParking.active = false;
      terminalOverlaySnapshot = null;
      instance.unmount();
      await instance.waitUntilExit();
    } finally {
      instance.clear();
      instance.cleanup();
      directTuiInkInstance = null;
    }
  }

  if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function" && process.stdin.isRaw) {
    try {
      process.stdin.setRawMode(false);
    } catch {
      // ignore raw-mode teardown races during process shutdown
    }
  }
  process.stdin.pause();
  const persistResult = await persistDirectTuiExitSummaryFile(input.lines);
  if (persistResult !== "missing_path") {
    process.exit(input.exitCode);
  }
  const lineBreak = process.stdout.isTTY ? "\r\n" : "\n";
  const clearAndHome = process.stdout.isTTY
    ? [
        SYNC_OUTPUT_END,
        "\u001B[?25h",
        "\u001B[0m",
        "\u001B[2K",
        "\r",
        "\u001B[2J",
        "\u001B[3J",
        "\u001B[H",
      ].join("")
    : "";
  const summaryText = `${clearAndHome}${input.lines.join(lineBreak)}${lineBreak}${lineBreak}`;
  if (typeof process.stdout.fd === "number") {
    writeSync(process.stdout.fd, summaryText);
  } else {
    process.stdout.write(summaryText);
  }
  process.exit(input.exitCode);
}

type SlashPanelNoticeTone = "info" | "warning" | "danger" | "success";

interface SlashPanelNotice {
  tone: SlashPanelNoticeTone;
  text: string;
}

interface ComposerPopupItem {
  key: string;
  label: string;
  description?: string;
  path?: string;
}

interface ComposerPopupView {
  title: string;
  description: string;
  detailLines?: string[];
  items: ComposerPopupItem[];
  visibleItems: ComposerPopupItem[];
  selectedIndex: number;
  pageIndex: number;
  pageCount: number;
  totalCount: number;
  startIndex: number;
  numberWidth: 2 | 3;
  emptyText?: string;
  emptyTone?: string;
}


interface SlashPanelContext {
  backendStatus: BackendStatus;
  currentCwd: string;
  sessionId: string;
  sessionName: string;
  configFile: RaxodeConfigFile | null;
  runtimeConfig: ReturnType<typeof loadRaxodeRuntimeConfigSnapshot> | null;
  route: string;
  activeTaskCount: number;
  runLabel: string;
  cmpSummaryLines: string[];
  mpSummaryLines: string[];
  tapSummaryLines: string[];
  logPath: string | null;
  lastTurnSummary: string;
  backendContextSnapshot: ReturnType<typeof normalizeContextSnapshot>;
  contextWindowSize: number;
  contextWindowLabel: string;
  estimatedContextUsed: number;
  estimatedContextUsedLabel: string;
  statusContextUsageLine: string;
  contextPercent: string;
  draftContextTokens: number;
  sessions: ReturnType<typeof listDirectTuiSessions>;
  agents: DirectTuiAgentEntry[];
  selectedAgentId: string;
  openAIAuthStatus: ReturnType<typeof getOpenAIAuthStatus>;
  embeddingConfig: ReturnType<typeof loadResolvedEmbeddingConfig>;
  rateLimitRecord: StatusRateLimitCacheRecord | null;
  rateLimitRefreshState: "idle" | "loading";
  pendingInitNote?: string;
  cmpViewerSnapshot: CmpViewerSnapshot | null;
  mpViewerSnapshot: MpViewerSnapshot | null;
  capabilityViewerSnapshot: CapabilityViewerSnapshot | null;
  pendingHumanGates: HumanGatePanelEntry[];
  initViewerSnapshot: InitViewerSnapshot | null;
  questionViewerSnapshot: QuestionViewerSnapshot | null;
  questionPanelState: QuestionPanelState;
  questionComposerText: string;
  questionAnimationFrame: number;
  cmpStatusLabel: string;
}

type DirectSlashPanelId = PraxisSlashPanelId | "question";
type DirectSlashPanelView = Omit<PraxisSlashPanelView, "id"> & { id: DirectSlashPanelId };

interface DirectTuiAgentEntry {
  agentId: string;
  name: string;
  summary: string;
  status: string;
}

interface PendingSessionSwitch {
  targetSessionId: string;
  targetAgentId: string;
  targetWorkspace: string;
  targetSessionName: string;
  targetSurfaceState: SurfaceAppState;
  successNotice?: string;
  autoClose?: boolean;
}

interface CmpViewerEntry {
  sectionId: string;
  lifecycle: string;
  kind: string;
  agentId: string;
  ref: string;
  updatedAt: string;
}

interface CmpViewerSnapshot {
  summaryLines: string[];
  status?: string;
  sourceKind?: string;
  emptyReason?: string;
  truthStatus?: string;
  readbackStatus?: string;
  detailLines?: string[];
  roleLines?: string[];
  requestLines?: string[];
  issueLines?: string[];
  entries: CmpViewerEntry[];
}

interface MpViewerEntry {
  memoryId: string;
  label: string;
  summary: string;
  agentId?: string;
  scopeLevel?: string;
  updatedAt?: string;
  bodyRef?: string;
}

interface MpViewerSnapshot {
  summaryLines: string[];
  status?: string;
  sourceKind?: string;
  emptyReason?: string;
  sourceClass?: string;
  rootPath?: string;
  recordCount?: number;
  detailLines?: string[];
  roleLines?: string[];
  flowLines?: string[];
  issueLines?: string[];
  entries: MpViewerEntry[];
}

interface CapabilityViewerEntry {
  capabilityKey: string;
  description: string;
  bindingState: string;
}

interface CapabilityViewerGroup {
  groupKey: string;
  title: string;
  count: number;
  entries: CapabilityViewerEntry[];
}

interface CapabilityViewerSnapshot {
  summaryLines: string[];
  status?: string;
  registeredCount?: number;
  familyCount?: number;
  blockedCount?: number;
  pendingHumanGateCount?: number;
  pendingHumanGates: HumanGatePanelEntry[];
  groups: CapabilityViewerGroup[];
}

interface InitViewerSnapshot {
  summaryLines: string[];
  status?: string;
  sourceKind?: string;
}

interface QuestionViewerOption {
  id: string;
  label: string;
  description: string;
}

interface QuestionViewerChoicePrompt {
  id: string;
  kind?: "choice";
  prompt: string;
  options: QuestionViewerOption[];
  allowAnnotation?: boolean;
  notePrompt?: string;
  required?: boolean;
}

interface QuestionViewerFreeformPrompt {
  id: string;
  kind: "freeform";
  prompt: string;
  placeholder?: string;
  allowAnnotation?: boolean;
  notePrompt?: string;
  required?: boolean;
}

type QuestionViewerPrompt =
  | QuestionViewerChoicePrompt
  | QuestionViewerFreeformPrompt;

interface QuestionViewerSnapshot {
  requestId?: string;
  title?: string;
  instruction?: string;
  submitLabel?: string;
  status?: string;
  sourceKind?: string;
  questionIndex: number;
  noteMode: boolean;
  noteValue: string;
  questions: QuestionViewerPrompt[];
}

interface QuestionAnswerDraft {
  selectedOptionId?: string;
  selectedOptionLabel?: string;
  answerText?: string;
  annotation?: string;
}

interface QuestionPanelState {
  requestId?: string;
  currentQuestionIndex: number;
  activeOptionIndexByQuestionId: Record<string, number>;
  answersByQuestionId: Record<string, QuestionAnswerDraft>;
  noteModeByQuestionId: Record<string, boolean>;
}

function clampQuestionIndex(index: number, totalCount: number): number {
  if (totalCount <= 0) {
    return 0;
  }
  if (!Number.isFinite(index)) {
    return 0;
  }
  return Math.max(0, Math.min(Math.floor(index), totalCount - 1));
}

function createEmptyQuestionPanelState(): QuestionPanelState {
  return {
    requestId: undefined,
    currentQuestionIndex: 0,
    activeOptionIndexByQuestionId: {},
    answersByQuestionId: {},
    noteModeByQuestionId: {},
  };
}

function buildQuestionPanelState(
  snapshot: QuestionViewerSnapshot,
  previous?: QuestionPanelState,
): QuestionPanelState {
  const previousAnswers = previous?.requestId === snapshot.requestId
    ? (previous?.answersByQuestionId ?? {})
    : {};
  const previousOptionIndices = previous?.requestId === snapshot.requestId
    ? (previous?.activeOptionIndexByQuestionId ?? {})
    : {};
  const previousNoteModes = previous?.requestId === snapshot.requestId
    ? (previous?.noteModeByQuestionId ?? {})
    : {};
  const activeOptionIndexByQuestionId = Object.fromEntries(
    snapshot.questions.map((question) => {
      if (question.kind === "freeform") {
        return [question.id, 0];
      }
      const selectedOptionId = previousAnswers[question.id]?.selectedOptionId;
      const selectedOptionIndex = selectedOptionId
        ? question.options.findIndex((option) => option.id === selectedOptionId)
        : -1;
      const fallbackIndex = selectedOptionIndex >= 0
        ? selectedOptionIndex
        : (previousOptionIndices[question.id] ?? 0);
      return [question.id, clampQuestionIndex(fallbackIndex, question.options.length)];
    }),
  ) as Record<string, number>;
  const currentQuestionIndex = previous?.requestId === snapshot.requestId
    ? (previous?.currentQuestionIndex ?? snapshot.questionIndex)
    : snapshot.questionIndex;
  return {
    requestId: snapshot.requestId,
    currentQuestionIndex: clampQuestionIndex(currentQuestionIndex, snapshot.questions.length),
    activeOptionIndexByQuestionId,
    answersByQuestionId: previousAnswers,
    noteModeByQuestionId: Object.fromEntries(
      snapshot.questions.map((question) => [question.id, Boolean(previousNoteModes[question.id])]),
    ) as Record<string, boolean>,
  };
}

function isQuestionNoteModeActive(
  state: QuestionPanelState,
  question: QuestionViewerPrompt | undefined,
): boolean {
  if (!question) {
    return false;
  }
  return Boolean(state.noteModeByQuestionId[question.id]);
}

function resolveQuestionDraftText(
  input: {
    snapshot: QuestionViewerSnapshot | null;
    state: QuestionPanelState;
    composerValue: string;
  },
): string {
  if (!input.snapshot || input.snapshot.status !== "active") {
    return "";
  }
  const trimmedComposerValue = input.composerValue.trim();
  const question = input.snapshot.questions[clampQuestionIndex(
    input.state.currentQuestionIndex,
    input.snapshot.questions.length,
  )];
  if (!question) {
    return "";
  }
  const noteMode = isQuestionNoteModeActive(input.state, question);
  if (question.kind === "freeform" && !noteMode) {
    if (trimmedComposerValue.length > 0) {
      return trimmedComposerValue;
    }
    return input.state.answersByQuestionId[question.id]?.answerText ?? "";
  }
  if (trimmedComposerValue.length > 0) {
    return trimmedComposerValue;
  }
  return input.state.answersByQuestionId[question.id]?.annotation ?? "";
}

function buildNextQuestionAnswersByQuestionId(params: {
  state: QuestionPanelState;
  question: QuestionViewerPrompt;
  composerValue: string;
  noteMode: boolean;
}): Record<string, QuestionAnswerDraft> {
  const { state, question, composerValue, noteMode } = params;
  const existingEntry = state.answersByQuestionId[question.id] ?? {};
  if (question.kind === "freeform") {
    return {
      ...state.answersByQuestionId,
      [question.id]: {
        ...existingEntry,
        ...(noteMode
          ? (composerValue.length > 0 ? { annotation: composerValue } : {})
          : { answerText: composerValue }),
      },
    };
  }
  const activeOptionIndex = state.activeOptionIndexByQuestionId[question.id] ?? 0;
  const selectedOption = question.options[activeOptionIndex];
  return {
    ...state.answersByQuestionId,
    [question.id]: {
      ...existingEntry,
      ...(selectedOption
        ? {
            selectedOptionId: selectedOption.id,
            selectedOptionLabel: selectedOption.label,
          }
        : {}),
      ...(composerValue.length > 0 ? { annotation: composerValue } : {}),
    },
  };
}

function buildQuestionReceiptText(input: {
  snapshot: QuestionViewerSnapshot;
  answers: Array<{
    questionId: string;
    selectedOptionLabel?: string;
    answerText?: string;
    annotation?: string;
  }>;
}): string {
  const totalCount = input.snapshot.questions.length;
  return [
    `Questions ${input.answers.length}/${totalCount} answered`,
    ...input.answers.flatMap((answer) => {
      const prompt = input.snapshot.questions.find((question) => question.id === answer.questionId);
      return [
        `    • ${prompt?.prompt ?? answer.questionId}`,
        `          answer: ${answer.answerText ?? answer.selectedOptionLabel ?? "(missing)"}`,
        ...(answer.annotation ? [`          note: ${answer.annotation}`] : []),
      ];
    }),
  ].join("\n");
}

interface QuestionReceiptEntry {
  prompt: string;
  answer: string;
  note?: string;
}

interface QuestionReceiptPayload {
  answeredCount: number;
  totalCount: number;
  entries: QuestionReceiptEntry[];
}

function buildQuestionReceiptPayload(input: {
  snapshot: QuestionViewerSnapshot;
  answers: Array<{
    questionId: string;
    selectedOptionLabel?: string;
    answerText?: string;
    annotation?: string;
  }>;
}): QuestionReceiptPayload {
  return {
    answeredCount: input.answers.length,
    totalCount: input.snapshot.questions.length,
    entries: input.answers.map((answer) => {
      const prompt = input.snapshot.questions.find((question) => question.id === answer.questionId);
      return {
        prompt: prompt?.prompt ?? answer.questionId,
        answer: answer.answerText ?? answer.selectedOptionLabel ?? "(missing)",
        ...(answer.annotation ? { note: answer.annotation } : {}),
      };
    }),
  };
}

interface PendingOutboundTurn {
  submissionId: string;
  turnIndex: number;
  turnId: string;
  messageId: string;
  userText: string;
  queuedAt: string;
}

type ModelPickerSource = "chat" | "embedding";

interface ModelPickerOverlayState {
  open: boolean;
  source: ModelPickerSource;
  fieldKey: string;
  fieldLabel: string;
  availabilityScopeKey: string;
  loading: boolean;
  error?: string;
  models: AvailableModelCatalogEntry[];
  selectedModelIndex: number;
  selectedReasoningIndex: number;
  serviceTierFastEnabled: boolean;
  availabilityByModelId: Record<string, ModelAvailabilityRecord | undefined>;
}

interface ModelCatalogWarmState {
  status: "idle" | "loading" | "ready" | "error";
  error?: string;
}

interface RewindOverlayState {
  stage: "turn" | "mode";
  selectedTurnIndex: number;
  selectedModeIndex: number;
  notice: SlashPanelNotice | null;
}

interface PendingTranscriptRewind {
  agentId: string;
  selectedTurnId: string;
  selectedTurnIndex: number;
  rewindRequestTurnIndex: number;
  mode: DirectTuiRewindMode;
  transcriptCutMessageId?: string;
  workspaceCheckpointRef?: string;
  userText: string;
}

interface RewindInFlightState {
  mode: DirectTuiRewindMode;
  startedAt: string;
  phase: "pending_backend_rewind" | "pending_workspace_restore" | "finalizing";
}

interface TerminalOverlaySegment {
  text: string;
  color?: string;
}

interface TerminalOverlayLine {
  segments: TerminalOverlaySegment[];
}

interface TerminalOverlaySnapshot {
  top: number;
  left: number;
  lines: TerminalOverlayLine[];
}

let terminalOverlaySnapshot: TerminalOverlaySnapshot | null = null;

const RAXODE_DISPLAY_VERSION = "0.1.0";
const PRAXIS_DISPLAY_VERSION = "0.1.0";
const MODEL_PICKER_MAX_VISIBLE_MODELS = 10;

const LANGUAGE_LABELS: Record<string, string> = {
  "en-US": "English (US)",
  "zh-CN": "简体中文",
  "zh-HK": "繁體中文（香港）",
  "zh-TW": "繁體中文（台灣）",
  "ja-JP": "日本語",
  "ko-KR": "한국어",
  "de-DE": "Deutsch",
  "fr-FR": "français (France)",
  "es-ES": "español (España)",
  "es-419": "español (Latinoamérica)",
};

const LANGUAGE_LIST_LINES = [
  "001  English (US)",
  "002  Deutsch",
  "003  français (France)",
  "004  español (Latinoamérica)",
  "005  español (España)",
  "006  日本語",
  "007  한국어",
  "008  简体中文",
  "009  繁體中文（香港）",
  "010  繁體中文（台灣）",
  "... more languages remain",
];

function buildModelEffortOptions(): string[] {
  const options: string[] = [];
  for (const model of PRAXIS_MODEL_OPTIONS) {
    for (const reasoning of PRAXIS_REASONING_OPTIONS) {
      options.push(formatModelEffortLine(model, reasoning));
    }
  }
  return options;
}

function panelToneColor(tone: SlashPanelNoticeTone | PraxisSlashPanelField["tone"] | undefined): string {
  switch (tone) {
    case "danger":
      return TUI_THEME.red;
    case "warning":
      return TUI_THEME.yellow;
    case "success":
      return TUI_THEME.mint;
    case "green":
      return "greenBright";
    case "pink":
      return TUI_THEME.violet;
    case "brown":
      return "yellow";
    case "orange":
      return "red";
    case "info":
      return TUI_THEME.mintSoft;
    case "fast":
      return TUI_THEME.violet;
    default:
      return TUI_THEME.text;
  }
}

function panelStatusForBackendStatus(status: BackendStatus): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "starting":
      return "Starting";
    case "failed":
      return "Failed";
    case "exited":
      return "Exited";
  }
}

function resolvePanelDraftValue(
  draft: Record<string, string>,
  key: string,
  fallback: string,
): string {
  return draft[key] ?? fallback;
}

function createPendingOutboundSubmissionId(): string {
  return `submission:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

function parseDirectReadySessionId(line: string): string | null {
  if (!line.startsWith("direct ready: ")) {
    return null;
  }
  const sessionId = line.slice("direct ready: ".length).trim();
  return sessionId.length > 0 ? sessionId : null;
}

function shouldHideDirectTuiStartupStageFromTranscript(stage?: string): boolean {
  if (!stage) {
    return false;
  }
  return stage === "core/skill_overlay_bootstrap"
    || stage === "core/memory_overlay_bootstrap"
    || stage === "cmp/infra_bootstrap";
}

function isDirectTuiInitRunningStatus(status?: string): boolean {
  return status === "running"
    || status === "active"
    || status === "waiting"
    || status === "started";
}

function cloneRaxodeConfigFile(configFile: RaxodeConfigFile): RaxodeConfigFile {
  return {
    schemaVersion: configFile.schemaVersion,
    providerSlots: { ...configFile.providerSlots },
    profiles: configFile.profiles.map((profile) => ({
      ...profile,
      route: { ...profile.route },
    })),
    roleBindings: Object.fromEntries(
      Object.entries(configFile.roleBindings).map(([roleId, binding]) => [roleId, {
        ...binding,
        overrides: binding.overrides ? { ...binding.overrides } : undefined,
      }]),
    ) as RaxodeConfigFile["roleBindings"],
    embedding: {
      ...configFile.embedding,
    },
    workspace: { ...configFile.workspace },
    ui: { ...configFile.ui },
    permissions: {
      ...configFile.permissions,
      requireHumanOnRiskLevels: [...configFile.permissions.requireHumanOnRiskLevels],
      capabilityOverrides: configFile.permissions.capabilityOverrides.map((override) => ({ ...override })),
      shared15ViewMatrix: configFile.permissions.shared15ViewMatrix.map((entry) => ({ ...entry })),
    },
  };
}

function resolveRoleProfile(
  configFile: RaxodeConfigFile,
  roleId: "core.main" | "tui.main",
) {
  const binding = configFile.roleBindings[roleId];
  if (!binding) {
    return undefined;
  }
  return configFile.profiles.find((profile) => profile.id === binding.profileId);
}

function formatModelEffortLine(model: string, reasoning: string): string {
  return `${model} with ${reasoning} effort`;
}

function formatModelEffortDisplayLine(
  model: string,
  reasoning: string,
  fastEnabled = false,
): string {
  return `${formatModelEffortLine(model, reasoning)}${fastEnabled ? " [FAST]" : ""}`;
}

function parseModelEffortLine(value: string): { model: string; reasoning: RaxodeReasoningEffort; serviceTierFastEnabled: boolean } | null {
  const match = value.match(/^(.*) with (minimal|none|low|medium|high|xhigh) effort(?: \[FAST\])?$/u);
  if (!match) {
    return null;
  }
  const model = match[1]?.trim();
  const reasoning = match[2]?.trim() as RaxodeReasoningEffort | undefined;
  if (!model || !reasoning) {
    return null;
  }
  return {
    model,
    reasoning,
    serviceTierFastEnabled: /\s\[FAST\]$/u.test(value),
  };
}

function resolveModelFieldRoleId(fieldKey: string): RaxcodeRoleId | null {
  switch (fieldKey) {
    case "model:core.main":
      return "core.main";
    case "model:tui.main":
      return "tui.main";
    case "model:mp.icma":
      return "mp.icma";
    case "model:mp.dbagent":
      return "mp.dbagent";
    case "model:mp.iterator":
      return "mp.iterator";
    case "model:mp.checker":
      return "mp.checker";
    case "model:mp.dispatcher":
      return "mp.dispatcher";
    case "model:cmp.icma":
      return "cmp.icma";
    case "model:cmp.dbagent":
      return "cmp.dbagent";
    case "model:cmp.iterator":
      return "cmp.iterator";
    case "model:cmp.checker":
      return "cmp.checker";
    case "model:cmp.dispatcher":
      return "cmp.dispatcher";
    case "model:tap.reviewer":
      return "tap.reviewer";
    case "model:tap.toolReviewer":
      return "tap.toolReviewer";
    case "model:tap.provisioner":
      return "tap.provisioner";
    default:
      return null;
  }
}

function resolveFastEnabledForRole(
  configFile: RaxodeConfigFile | null,
  runtimeConfig: ReturnType<typeof loadRaxodeRuntimeConfigSnapshot> | null,
  roleId:
    | "core.main"
    | "tui.main"
    | "mp.icma"
    | "mp.dbagent"
    | "mp.iterator"
    | "mp.checker"
    | "mp.dispatcher"
    | "cmp.icma"
    | "cmp.dbagent"
    | "cmp.iterator"
    | "cmp.checker"
    | "cmp.dispatcher"
    | "tap.reviewer"
    | "tap.toolReviewer"
    | "tap.provisioner",
): boolean {
  if (configFile?.roleBindings[roleId]?.overrides?.serviceTier !== undefined) {
    return configFile.roleBindings[roleId]?.overrides?.serviceTier === "fast";
  }
  switch (roleId) {
    case "core.main":
      return runtimeConfig?.modelPlan.core.main.serviceTier === "fast";
    case "tui.main":
      return runtimeConfig?.modelPlan.tui.main.serviceTier === "fast";
    case "mp.icma":
      return runtimeConfig?.modelPlan.mp.icma.serviceTier === "fast";
    case "mp.dbagent":
      return runtimeConfig?.modelPlan.mp.dbagent.serviceTier === "fast";
    case "mp.iterator":
      return runtimeConfig?.modelPlan.mp.iterator.serviceTier === "fast";
    case "mp.checker":
      return runtimeConfig?.modelPlan.mp.checker.serviceTier === "fast";
    case "mp.dispatcher":
      return runtimeConfig?.modelPlan.mp.dispatcher.serviceTier === "fast";
    case "cmp.icma":
      return runtimeConfig?.modelPlan.cmp.icma.serviceTier === "fast";
    case "cmp.dbagent":
      return runtimeConfig?.modelPlan.cmp.dbagent.serviceTier === "fast";
    case "cmp.iterator":
      return runtimeConfig?.modelPlan.cmp.iterator.serviceTier === "fast";
    case "cmp.checker":
      return runtimeConfig?.modelPlan.cmp.checker.serviceTier === "fast";
    case "cmp.dispatcher":
      return runtimeConfig?.modelPlan.cmp.dispatcher.serviceTier === "fast";
    case "tap.reviewer":
      return runtimeConfig?.modelPlan.tap.reviewer.serviceTier === "fast";
    case "tap.toolReviewer":
      return runtimeConfig?.modelPlan.tap.toolReviewer.serviceTier === "fast";
    case "tap.provisioner":
      return runtimeConfig?.modelPlan.tap.provisioner.serviceTier === "fast";
  }
}

function buildLanguageInputPreview(languageCode: string): string {
  const label = LANGUAGE_LABELS[languageCode] ?? languageCode;
  return `Input:[${label === "简体中文" ? "我是你的心上人" : label}] -> ${label}`;
}

function padDisplayText(value: string, width: number): string {
  const currentWidth = stringWidth(value);
  if (currentWidth >= width) {
    return value;
  }
  return `${value}${" ".repeat(width - currentWidth)}`;
}

function createBodyKeyValueLine(
  label: string,
  value: string,
  options: {
    indent?: number;
    labelWidth?: number;
    gapWidth?: number;
    fieldKey?: string;
    labelTone?: PraxisSlashPanelField["tone"];
    valueTone?: PraxisSlashPanelField["tone"];
    valueSegments?: Array<{ text: string; tone?: PraxisSlashPanelField["tone"] }>;
  } = {},
): { text: string; fieldKey?: string; segments: Array<{ text: string; tone?: PraxisSlashPanelField["tone"] }> } {
  const indent = " ".repeat(options.indent ?? 4);
  const paddedLabel = padDisplayText(label, options.labelWidth ?? 28);
  const gap = " ".repeat(options.gapWidth ?? 4);
  const valueSegments = options.valueSegments ?? (
    value.endsWith(" [FAST]")
      ? [
          { text: value.slice(0, -7), tone: options.valueTone },
          { text: " [FAST]", tone: "fast" },
        ]
      : [{ text: value, tone: options.valueTone }]
  );
  return {
    text: `${indent}${paddedLabel}${gap}${value}`,
    fieldKey: options.fieldKey,
    segments: [
      { text: `${indent}${paddedLabel}`, tone: options.labelTone },
      { text: gap },
      ...valueSegments,
    ],
  };
}

function formatOpenAIAuthModeLabel(authMode: ReturnType<typeof getOpenAIAuthStatus>["authMode"]): string {
  switch (authMode) {
    case "chatgpt_oauth":
      return "ChatGPT subscription";
    case "api_key":
      return "API key";
    default:
      return "Unconfigured";
  }
}

function createStatusRateLimitLine(
  label: string,
  bar: string,
  summary: string,
  resetsAt?: string,
): { text: string; segments: Array<{ text: string; tone?: PraxisSlashPanelField["tone"] }> } {
  const valueSegments: Array<{ text: string; tone?: PraxisSlashPanelField["tone"] }> = [
    { text: bar, tone: "info" },
    { text: " " },
    { text: summary },
  ];
  if (resetsAt) {
    valueSegments.push({ text: ` (resets ${resetsAt})`, tone: "default" });
  }
  return createBodyKeyValueLine(label, `${bar} ${summary}${resetsAt ? ` (resets ${resetsAt})` : ""}`, {
    indent: 4,
    labelWidth: 28,
    valueSegments,
  });
}

type ViewerPanelId = "cmp" | "mp" | "capabilities";

function viewerPageDraftKey(panelId: ViewerPanelId): string {
  return `${panelId}:page`;
}

function resolveViewerPageIndex(
  panelId: ViewerPanelId,
  draft: Record<string, string>,
  totalItems: number,
  pageSize = VIEWER_PAGE_SIZE,
): number {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const raw = Number.parseInt(draft[viewerPageDraftKey(panelId)] ?? "0", 10);
  if (!Number.isFinite(raw) || raw < 0) {
    return 0;
  }
  return Math.min(raw, pageCount - 1);
}

function buildViewerPageMeta(
  pageIndex: number,
  totalItems: number,
  pageSize = VIEWER_PAGE_SIZE,
): { pageIndex: number; pageCount: number; start: number; end: number } {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const normalizedPageIndex = Math.max(0, Math.min(pageIndex, pageCount - 1));
  const start = normalizedPageIndex * pageSize;
  const end = Math.min(totalItems, start + pageSize);
  return {
    pageIndex: normalizedPageIndex,
    pageCount,
    start,
    end,
  };
}

function formatViewerPageLine(label: string, meta: { pageIndex: number; pageCount: number }, totalItems: number): string {
  return `    ${label} · page ${meta.pageIndex + 1}/${meta.pageCount} · ${totalItems} total`;
}

function findSnapshotDetailValue(lines: string[] | undefined, label: string): string | undefined {
  const prefix = `${label.toLowerCase()}:`;
  const line = lines?.find((entry) => entry.toLowerCase().startsWith(prefix));
  if (!line) {
    return undefined;
  }
  return line.slice(prefix.length).trim();
}

function buildOverviewEntries(params: {
  lines: string[] | undefined;
  excludedLines?: string[];
}): ViewerStatusEntry[] {
  const excluded = new Set((params.excludedLines ?? []).map((line) => line.trim()).filter(Boolean));
  return (params.lines ?? [])
    .map((line) => compactRuntimeText(line))
    .filter((line) => line.trim().length > 0 && !excluded.has(line.trim()))
    .slice(0, 2)
    .map((line) => ({
      value: line,
      abnormal: isViewerStatusTextAbnormal(line),
    }));
}

function buildIssueEntries(lines: string[] | undefined, fallback?: string): ViewerStatusEntry[] {
  const values = (lines && lines.length > 0 ? lines : (fallback ? [fallback] : []))
    .map((line) => compactRuntimeText(line))
    .filter((line) => line.trim().length > 0);
  if (values.length === 0) {
    return [{
      value: "none",
      abnormal: false,
    }];
  }
  return values.slice(0, 3).map((line) => ({
    value: line,
    abnormal: true,
  }));
}

function buildWorkflowEntries(detailValue: string | undefined): ViewerStatusEntry[] {
  if (!detailValue) {
    return [];
  }
  const normalized = detailValue.trim();
  if (!normalized) {
    return [];
  }
  const tokens = normalized.split(/\s+/u);
  const entries: ViewerStatusEntry[] = [];
  const firstToken = tokens[0] ?? "";
  if (firstToken && !/[=:]/u.test(firstToken)) {
    entries.push({
      key: "status",
      value: firstToken,
      abnormal: isViewerStatusTextAbnormal(firstToken),
    });
  }
  const remaining = firstToken && !/[=:]/u.test(firstToken)
    ? tokens.slice(1).join(" ")
    : normalized;
  return [
    ...entries,
    ...parseViewerAssignmentEntries(remaining),
  ];
}

function buildCmpViewerBodyLines(
  snapshot: CmpViewerSnapshot | null,
  pageIndex: number,
  lineWidth: number,
): { lines: PraxisSlashPanelBodyLine[]; meta: { pageIndex: number; pageCount: number } } {
  const entries = snapshot?.entries ?? [];
  const meta = buildViewerPageMeta(pageIndex, entries.length);
  const visibleEntries = entries.slice(meta.start, meta.end);
  const issueEntries = buildIssueEntries(snapshot?.issueLines, snapshot?.emptyReason);
  const lines: PraxisSlashPanelBodyLine[] = [
    { text: formatViewerPageLine("CMP sections", meta, entries.length), tone: "info" },
    ...buildViewerStatusBlockLines({
      label: "Overview",
      labelTone: "green",
      entries: buildOverviewEntries({
        lines: snapshot?.summaryLines,
        excludedLines: issueEntries.map((entry) => entry.value),
      }),
      lineWidth,
      emptyValue: "CMP summary is not available yet.",
    }),
    ...buildViewerStatusBlockLines({
      label: "Truth",
      labelTone: "warning",
      entries: parseViewerAssignmentEntries(findSnapshotDetailValue(snapshot?.detailLines, "truth") ?? ""),
      lineWidth,
      emptyValue: "truth unavailable",
    }),
    ...buildViewerStatusBlockLines({
      label: "Ready",
      labelTone: "pink",
      entries: parseViewerAssignmentEntries(findSnapshotDetailValue(snapshot?.detailLines, "readiness") ?? ""),
      lineWidth,
      emptyValue: "readiness unavailable",
    }),
    ...buildViewerStatusBlockLines({
      label: "Roles",
      labelTone: "brown",
      entries: parseViewerRoleEntries(snapshot?.roleLines),
      lineWidth,
      emptyValue: "no role telemetry yet",
    }),
    ...buildViewerStatusBlockLines({
      label: "Issue",
      labelTone: "orange",
      entries: issueEntries,
      lineWidth,
    }),
    ...buildTerminalTableBodyLines({
      columns: [
        {
          key: "lifecycle",
          title: "Lifecycle",
          minWidth: 9,
          maxWidth: 12,
          shrinkPriority: 4,
          growPriority: 4,
          value: (entry: CmpViewerEntry) => entry.lifecycle,
        },
        {
          key: "kind",
          title: "Kind",
          minWidth: 12,
          maxWidth: 20,
          shrinkPriority: 3,
          growPriority: 3,
          value: (entry: CmpViewerEntry) => entry.kind,
        },
        {
          key: "agent",
          title: "Agent",
          minWidth: 8,
          maxWidth: 12,
          shrinkPriority: 5,
          growPriority: 5,
          value: (entry: CmpViewerEntry) => entry.agentId,
        },
        {
          key: "ref",
          title: "Section Ref",
          minWidth: 18,
          shrinkPriority: 1,
          growPriority: 1,
          value: (entry: CmpViewerEntry) => compactRuntimeText(entry.ref),
        },
      ],
      rows: visibleEntries.map<TerminalTableRow<CmpViewerEntry>>((entry) => ({
        key: entry.sectionId,
        data: entry,
      })),
      lineWidth,
      emptyText: snapshot?.emptyReason ?? "No CMP section records yet.",
      emptyTone: snapshot?.status === "degraded" ? "warning" : undefined,
    }),
  ];
  return {
    lines,
    meta: {
      pageIndex: meta.pageIndex,
      pageCount: meta.pageCount,
    },
  };
}

function buildMpViewerBodyLines(
  snapshot: MpViewerSnapshot | null,
  pageIndex: number,
  lineWidth: number,
): { lines: PraxisSlashPanelBodyLine[]; meta: { pageIndex: number; pageCount: number } } {
  const entries = snapshot?.entries ?? [];
  const meta = buildViewerPageMeta(pageIndex, entries.length);
  const visibleEntries = entries.slice(meta.start, meta.end);
  const issueEntries = buildIssueEntries(snapshot?.issueLines, snapshot?.emptyReason);
  const sourceEntries: ViewerStatusEntry[] = [
    ...(snapshot?.sourceKind || snapshot?.sourceClass
      ? [{
          key: "kind",
          value: snapshot.sourceKind ?? snapshot.sourceClass ?? "unknown",
          abnormal: false,
        }]
      : []),
    ...(snapshot?.rootPath
      ? [{
          key: "path",
          value: shortenPath(snapshot.rootPath),
          abnormal: false,
        }]
      : []),
  ];
  const lines: PraxisSlashPanelBodyLine[] = [
    { text: formatViewerPageLine("Memory records", meta, entries.length), tone: "info" },
    ...buildViewerStatusBlockLines({
      label: "Overview",
      labelTone: "green",
      entries: buildOverviewEntries({
        lines: snapshot?.summaryLines,
        excludedLines: issueEntries.map((entry) => entry.value),
      }),
      lineWidth,
      emptyValue: "MP summary is not available yet.",
    }),
    ...buildViewerStatusBlockLines({
      label: "Source",
      labelTone: "warning",
      entries: sourceEntries,
      lineWidth,
      emptyValue: "source unavailable",
    }),
    ...buildViewerStatusBlockLines({
      label: "Flow",
      labelTone: "pink",
      entries: [
        ...buildWorkflowEntries(findSnapshotDetailValue(snapshot?.detailLines, "workflow")),
        ...parseViewerAssignmentEntries(findSnapshotDetailValue(snapshot?.flowLines, "readiness") ?? ""),
        ...parseViewerAssignmentEntries(findSnapshotDetailValue(snapshot?.flowLines, "flow") ?? ""),
      ],
      lineWidth,
      emptyValue: "workflow unavailable",
    }),
    ...buildViewerStatusBlockLines({
      label: "Roles",
      labelTone: "brown",
      entries: parseViewerRoleEntries(snapshot?.roleLines),
      lineWidth,
      emptyValue: "no role telemetry yet",
    }),
    ...buildViewerStatusBlockLines({
      label: "Issue",
      labelTone: "orange",
      entries: issueEntries,
      lineWidth,
    }),
    ...buildTerminalTableBodyLines({
      columns: [
        {
          key: "memory",
          title: "Memory Ref",
          minWidth: 14,
          maxWidth: 24,
          shrinkPriority: 4,
          growPriority: 4,
          value: (entry: MpViewerEntry) => `${entry.memoryId}${entry.bodyRef ? " *" : ""}`,
        },
        {
          key: "scope",
          title: "Scope",
          minWidth: 8,
          maxWidth: 12,
          shrinkPriority: 3,
          growPriority: 3,
          value: (entry: MpViewerEntry) => entry.scopeLevel ?? "-",
        },
        {
          key: "agent",
          title: "Agent",
          minWidth: 8,
          maxWidth: 12,
          shrinkPriority: 5,
          growPriority: 5,
          value: (entry: MpViewerEntry) => entry.agentId ?? "-",
        },
        {
          key: "summary",
          title: "Summary",
          minWidth: 18,
          shrinkPriority: 1,
          growPriority: 1,
          value: (entry: MpViewerEntry) => compactRuntimeText(entry.summary || entry.label),
        },
      ],
      rows: visibleEntries.map<TerminalTableRow<MpViewerEntry>>((entry) => ({
        key: entry.memoryId,
        data: entry,
      })),
      lineWidth,
      emptyText: snapshot?.emptyReason ?? "No MP memory records yet.",
      emptyTone: snapshot?.status === "degraded" ? "warning" : undefined,
    }),
  ];
  return {
    lines,
    meta: {
      pageIndex: meta.pageIndex,
      pageCount: meta.pageCount,
    },
  };
}

function buildModelValueSegments(
  model: string,
  reasoning: string,
  fastEnabled: boolean,
): Array<{ text: string; tone?: PraxisSlashPanelField["tone"] }> {
  return [
    { text: formatModelEffortLine(model, reasoning) },
    ...(fastEnabled ? [{ text: " [FAST]", tone: "fast" as const }] : []),
  ];
}

function transcriptMessagesToSessionRecords(
  messages: SurfaceMessage[],
): DirectTuiSessionMessageRecord[] {
  return messages.map((message) => ({
    messageId: message.messageId,
    kind: message.kind,
    text: message.text,
    createdAt: message.createdAt,
    turnId: message.turnId,
    status: message.status,
    updatedAt: message.updatedAt,
    metadata: message.metadata,
    capabilityKey: message.capabilityKey,
    title: message.title,
    errorCode: message.errorCode,
  }));
}

function buildAgentEntries(params: {
  agents: DirectTuiAgentRegistryRecord[];
  selectedAgentId: string;
}): DirectTuiAgentEntry[] {
  const sortedAgents = params.agents
    .slice()
    .sort((left, right) => {
      const leftSelected = left.agentId === params.selectedAgentId ? 1 : 0;
      const rightSelected = right.agentId === params.selectedAgentId ? 1 : 0;
      if (leftSelected !== rightSelected) {
        return rightSelected - leftSelected;
      }
      const leftActive = left.status === "active" ? 1 : 0;
      const rightActive = right.status === "active" ? 1 : 0;
      if (leftActive !== rightActive) {
        return rightActive - leftActive;
      }
      return right.updatedAt.localeCompare(left.updatedAt);
    });
  return sortedAgents.map((agent) => ({
    agentId: agent.agentId,
    name: agent.name,
    summary: agent.summary,
    status: agent.status,
  }));
}

function createWorkspaceAgentSnapshot(workspace: string): DirectTuiAgentRegistryRecord {
  const now = new Date().toISOString();
  return {
    agentId: `agent.task:${Date.now().toString(36)}`,
    name: "new-agent",
    kind: "task",
    status: "idle",
    summary: "new workspace agent",
    workspace,
    createdAt: now,
    updatedAt: now,
  };
}

function buildEmptySessionSnapshot(input: {
  agentId: string;
  workspace: string;
  route: string;
  model: string;
}): {
  sessionId: string;
  name: string;
  snapshot: {
    schemaVersion: 1;
    sessionId: string;
    agentId: string;
    name: string;
    workspace: string;
    route: string;
    model: string;
    createdAt: string;
    updatedAt: string;
    selectedAgentId: string;
    agents: DirectTuiAgentSnapshot[];
    messages: DirectTuiSessionMessageRecord[];
    usageLedger: DirectTuiSessionUsageEntry[];
  };
} {
  const now = new Date().toISOString();
  const sessionId = `direct-${Date.now()}`;
  const name = `session-${Date.now().toString(36)}`;
  return {
    sessionId,
    name,
    snapshot: {
      schemaVersion: 1,
      sessionId,
      agentId: input.agentId,
      name,
      workspace: input.workspace,
      route: input.route,
      model: input.model,
      createdAt: now,
      updatedAt: now,
      selectedAgentId: input.agentId,
      agents: [],
      messages: [],
      usageLedger: [],
    },
  };
}

function buildSurfaceStateFromSessionSnapshot(snapshot: DirectTuiSessionSnapshot): SurfaceAppState {
  let nextState = createInitialSurfaceState();
  nextState = applySurfaceEvent(nextState, {
    type: "session.started",
    at: snapshot.updatedAt,
    session: createSurfaceSession({
      sessionId: snapshot.sessionId,
      startedAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
      title: snapshot.name,
      status: "idle",
      uiMode: "direct",
      workspaceLabel: snapshot.workspace.split("/").slice(-1)[0] || snapshot.workspace,
      route: snapshot.route,
      transcriptMessageIds: [],
      taskIds: [],
    }),
  } as never);
  for (const message of snapshot.messages) {
    nextState = applySurfaceEvent(nextState, {
      type: "message.appended",
      at: message.createdAt,
      message: createSurfaceMessage({
        messageId: message.messageId,
        sessionId: snapshot.sessionId,
        turnId: message.turnId,
        kind: message.kind as SurfaceMessage["kind"],
        text: message.text,
        createdAt: message.createdAt,
        status: message.status,
        updatedAt: message.updatedAt,
        metadata: message.metadata,
        capabilityKey: message.capabilityKey,
        title: message.title,
        errorCode: message.errorCode,
      }),
    } as never);
  }
  return nextState;
}

function resolveInitialDirectTuiBootState(): {
  currentCwd: string;
  sessionId: string;
  sessionName: string;
  selectedAgentId: string;
  surfaceState: SurfaceAppState;
  conversationActivated: boolean;
  usageLedger: DirectTuiSessionUsageEntry[];
  exitSummary?: DirectTuiSessionExitSummary;
} {
  const currentCwd = (() => {
    try {
      return resolveConfiguredWorkspaceRoot(process.cwd());
    } catch {
      return process.cwd();
    }
  })();
  const requestedSessionId = typeof process.env.PRAXIS_DIRECT_SESSION_ID === "string"
    && process.env.PRAXIS_DIRECT_SESSION_ID.trim().length > 0
    ? process.env.PRAXIS_DIRECT_SESSION_ID.trim()
    : undefined;
  const restoredSnapshot = requestedSessionId
    ? loadDirectTuiSessionSnapshot(requestedSessionId, currentCwd)
    : null;
  if (!restoredSnapshot) {
    const sessionId = requestedSessionId ?? `direct-${Date.now()}`;
    return {
      currentCwd,
      sessionId,
      sessionName: `session-${Date.now().toString(36)}`,
      selectedAgentId: "",
      surfaceState: createInitialSurfaceState(),
      conversationActivated: false,
      usageLedger: [],
    };
  }
  const safeWorkspace = resolveValidWorkspacePath(restoredSnapshot.workspace, currentCwd);
  const normalizedSnapshot = safeWorkspace === restoredSnapshot.workspace
    ? restoredSnapshot
    : {
      ...restoredSnapshot,
      workspace: safeWorkspace,
    };
  return {
    currentCwd: safeWorkspace,
    sessionId: normalizedSnapshot.sessionId,
    sessionName: normalizedSnapshot.name,
    selectedAgentId: normalizedSnapshot.agentId ?? normalizedSnapshot.selectedAgentId ?? "",
    surfaceState: buildSurfaceStateFromSessionSnapshot(normalizedSnapshot),
    conversationActivated: normalizedSnapshot.messages.some((message) => message.kind === "user"),
    usageLedger: normalizedSnapshot.usageLedger ?? [],
    exitSummary: normalizedSnapshot.exitSummary,
  };
}

function buildSlashPanelView(
  id: DirectSlashPanelId,
  context: SlashPanelContext,
  draft: Record<string, string>,
  inputState: TuiTextInputState,
  focusIndex: number,
  renameTarget: { kind: "session" | "agent"; id: string } | null,
  notice: SlashPanelNotice | null,
  lineWidth: number,
): DirectSlashPanelView {
  const currentLanguage = context.configFile?.ui.language ?? context.runtimeConfig?.ui.language ?? "zh-CN";
  const coreProfile = context.configFile ? resolveRoleProfile(context.configFile, "core.main") : undefined;
  const tuiProfile = context.configFile ? resolveRoleProfile(context.configFile, "tui.main") : undefined;
  const currentCoreModel = coreProfile?.model ?? context.runtimeConfig?.modelPlan.core.main.model ?? "gpt-5.4";
  const currentCoreReasoning = (coreProfile?.reasoningEffort ?? context.runtimeConfig?.modelPlan.core.main.reasoning ?? "high") as string;
  const currentTuiModel = tuiProfile?.model ?? context.runtimeConfig?.modelPlan.tui.main.model ?? "gpt-5.4";
  const currentTuiReasoning = (tuiProfile?.reasoningEffort ?? context.runtimeConfig?.modelPlan.tui.main.reasoning ?? "low") as string;
  const currentWorkspaceDefault = context.configFile?.workspace.defaultPath ?? context.currentCwd;
  const requestedMode = context.configFile?.permissions.requestedMode ?? context.runtimeConfig?.permissions.requestedMode ?? "bapr";
  const modeChoice = resolvePanelDraftValue(draft, "requestedMode", requestedMode);
  const workspaceInputValue = inputState.value || resolvePanelDraftValue(draft, "workspacePath", context.currentCwd);
  const statusText = notice?.text ?? panelStatusForBackendStatus(context.backendStatus);
  const rateLimitView = composeStatusRateLimitDisplayView(context.rateLimitRecord);
  const openAIAuthModeLabel = formatOpenAIAuthModeLabel(context.openAIAuthStatus.authMode);
  const modelEffortOptions = buildModelEffortOptions();
  const visibleSessions = context.sessions.slice(0, 12);
  const visibleAgents = context.agents.slice(0, 12);
  const resolveRoleDisplayValue = (
    draftKey: string,
    roleId:
      | "core.main"
      | "tui.main"
      | "mp.icma"
      | "mp.dbagent"
      | "mp.iterator"
      | "mp.checker"
      | "mp.dispatcher"
      | "cmp.icma"
      | "cmp.dbagent"
      | "cmp.iterator"
      | "cmp.checker"
      | "cmp.dispatcher"
      | "tap.reviewer"
      | "tap.toolReviewer"
      | "tap.provisioner",
    fallbackModel: string,
    fallbackReasoning: string,
  ): string => resolvePanelDraftValue(
    draft,
    draftKey,
    formatModelEffortDisplayLine(
      fallbackModel,
      fallbackReasoning,
      resolveFastEnabledForRole(context.configFile, context.runtimeConfig, roleId),
    ),
  );

  switch (id) {
    case "human-gate": {
      const pendingHumanGates = context.pendingHumanGates;
      const requestedIndex = Number.parseInt(draft.humanGateIndex ?? "0", 10);
      const gateIndex = pendingHumanGates.length === 0
        ? 0
        : Math.max(0, Math.min(Number.isFinite(requestedIndex) ? requestedIndex : 0, pendingHumanGates.length - 1));
      const gate = pendingHumanGates[gateIndex] ?? null;
      const expanded = draft.humanGateDetails === "expanded";
      const bodyLines = gate
        ? buildHumanGatePanelBodyLines({
          entry: gate,
          expanded,
          currentIndex: gateIndex,
          totalCount: pendingHumanGates.length,
        })
        : [{
          text: "    No pending TAP human approvals in the current session.",
          tone: "success" as const,
        }];
      const fields = buildHumanGatePanelFields({
        entry: gate,
        expanded,
        noteValue: inputState.value,
        hasMultipleEntries: pendingHumanGates.length > 1,
      });
      return {
        id,
        title: "Human Gate",
        description: "Review TAP requests that are paused for human approval",
        status: gate
          ? `${pendingHumanGates.length} approval request(s) waiting`
          : "No pending human gate requests",
        bodyLines,
        fields,
        hints: gate
          ? [
            "Enter submits the selected action.",
            "Esc hides this panel without discarding the pending gate.",
          ]
          : ["Enter closes this panel."],
      };
    }
    case "model":
      return {
        id,
        title: "/model",
        description: "Choose model and provider-specific generation settings",
        status: statusText,
        showStatus: false,
        showFields: false,
        showHints: true,
        bodyLines: [
          createBodyKeyValueLine(
            "Core Model:",
            resolveRoleDisplayValue("model:core.main", "core.main", currentCoreModel, currentCoreReasoning),
            { indent: 4, labelWidth: 32, gapWidth: 6, fieldKey: "model:core.main" },
          ),
          createBodyKeyValueLine(
            "TUI miscellaneous tasks Model:",
            resolveRoleDisplayValue("model:tui.main", "tui.main", currentTuiModel, currentTuiReasoning),
            { indent: 4, labelWidth: 32, gapWidth: 6, fieldKey: "model:tui.main" },
          ),
          { text: "    Memory Pool", tone: "info" },
          createBodyKeyValueLine(
            "ICMA Model:",
            resolveRoleDisplayValue("model:mp.icma", "mp.icma", context.runtimeConfig?.modelPlan.mp.icma.model ?? "gpt-5.4-mini", context.runtimeConfig?.modelPlan.mp.icma.reasoning ?? "none"),
            { indent: 8, labelWidth: 24, gapWidth: 6, fieldKey: "model:mp.icma" },
          ),
          createBodyKeyValueLine(
            "DBAgent Model:",
            resolveRoleDisplayValue("model:mp.dbagent", "mp.dbagent", context.runtimeConfig?.modelPlan.mp.dbagent.model ?? "gpt-5.4", context.runtimeConfig?.modelPlan.mp.dbagent.reasoning ?? "low"),
            { indent: 8, labelWidth: 24, gapWidth: 6, fieldKey: "model:mp.dbagent" },
          ),
          createBodyKeyValueLine(
            "Iterator Model:",
            resolveRoleDisplayValue("model:mp.iterator", "mp.iterator", context.runtimeConfig?.modelPlan.mp.iterator.model ?? "gpt-5.4-mini", context.runtimeConfig?.modelPlan.mp.iterator.reasoning ?? "medium"),
            { indent: 8, labelWidth: 24, gapWidth: 6, fieldKey: "model:mp.iterator" },
          ),
          createBodyKeyValueLine(
            "Checker Model:",
            resolveRoleDisplayValue("model:mp.checker", "mp.checker", context.runtimeConfig?.modelPlan.mp.checker.model ?? "gpt-5.4-mini", context.runtimeConfig?.modelPlan.mp.checker.reasoning ?? "medium"),
            { indent: 8, labelWidth: 24, gapWidth: 6, fieldKey: "model:mp.checker" },
          ),
          createBodyKeyValueLine(
            "Dispatcher Model:",
            resolveRoleDisplayValue("model:mp.dispatcher", "mp.dispatcher", context.runtimeConfig?.modelPlan.mp.dispatcher.model ?? "gpt-5.4", context.runtimeConfig?.modelPlan.mp.dispatcher.reasoning ?? "low"),
            { indent: 8, labelWidth: 24, gapWidth: 6, fieldKey: "model:mp.dispatcher" },
          ),
          createBodyKeyValueLine(
            "LanceDB Embedding Model:",
            resolvePanelDraftValue(draft, "model:mp.embedding", context.configFile?.embedding.lanceDbModel ?? "text-embedding-3-large"),
            { indent: 8, labelWidth: 24, gapWidth: 6, fieldKey: "model:mp.embedding" },
          ),
          { text: "    Context Management Pool", tone: "info" },
          createBodyKeyValueLine(
            "ICMA Model:",
            resolveRoleDisplayValue("model:cmp.icma", "cmp.icma", context.runtimeConfig?.modelPlan.cmp.icma.model ?? "gpt-5.4-mini", context.runtimeConfig?.modelPlan.cmp.icma.reasoning ?? "none"),
            { indent: 8, labelWidth: 24, gapWidth: 6, fieldKey: "model:cmp.icma" },
          ),
          createBodyKeyValueLine(
            "DBAgent Model:",
            resolveRoleDisplayValue("model:cmp.dbagent", "cmp.dbagent", context.runtimeConfig?.modelPlan.cmp.dbagent.model ?? "gpt-5.4", context.runtimeConfig?.modelPlan.cmp.dbagent.reasoning ?? "low"),
            { indent: 8, labelWidth: 24, gapWidth: 6, fieldKey: "model:cmp.dbagent" },
          ),
          createBodyKeyValueLine(
            "Iterator Model:",
            resolveRoleDisplayValue("model:cmp.iterator", "cmp.iterator", context.runtimeConfig?.modelPlan.cmp.iterator.model ?? "gpt-5.4-mini", context.runtimeConfig?.modelPlan.cmp.iterator.reasoning ?? "medium"),
            { indent: 8, labelWidth: 24, gapWidth: 6, fieldKey: "model:cmp.iterator" },
          ),
          createBodyKeyValueLine(
            "Checker Model:",
            resolveRoleDisplayValue("model:cmp.checker", "cmp.checker", context.runtimeConfig?.modelPlan.cmp.checker.model ?? "gpt-5.4-mini", context.runtimeConfig?.modelPlan.cmp.checker.reasoning ?? "medium"),
            { indent: 8, labelWidth: 24, gapWidth: 6, fieldKey: "model:cmp.checker" },
          ),
          createBodyKeyValueLine(
            "Dispatcher Model:",
            resolveRoleDisplayValue("model:cmp.dispatcher", "cmp.dispatcher", context.runtimeConfig?.modelPlan.cmp.dispatcher.model ?? "gpt-5.4", context.runtimeConfig?.modelPlan.cmp.dispatcher.reasoning ?? "low"),
            { indent: 8, labelWidth: 24, gapWidth: 6, fieldKey: "model:cmp.dispatcher" },
          ),
          { text: "    Tool&Ability Pool", tone: "info" },
          createBodyKeyValueLine(
            "Reviewer Model:",
            resolveRoleDisplayValue("model:tap.reviewer", "tap.reviewer", context.runtimeConfig?.modelPlan.tap.reviewer.model ?? "gpt-5.4", context.runtimeConfig?.modelPlan.tap.reviewer.reasoning ?? "low"),
            { indent: 8, labelWidth: 24, gapWidth: 6, fieldKey: "model:tap.reviewer" },
          ),
          createBodyKeyValueLine(
            "ToolReviewer Model:",
            resolveRoleDisplayValue("model:tap.toolReviewer", "tap.toolReviewer", context.runtimeConfig?.modelPlan.tap.toolReviewer.model ?? "gpt-5.4-mini", context.runtimeConfig?.modelPlan.tap.toolReviewer.reasoning ?? "medium"),
            { indent: 8, labelWidth: 24, gapWidth: 6, fieldKey: "model:tap.toolReviewer" },
          ),
          createBodyKeyValueLine(
            "Provisioner Agent:",
            resolveRoleDisplayValue("model:tap.provisioner", "tap.provisioner", context.runtimeConfig?.modelPlan.tap.provisioner.model ?? "gpt-5.4", context.runtimeConfig?.modelPlan.tap.provisioner.reasoning ?? "medium"),
            { indent: 8, labelWidth: 24, gapWidth: 6, fieldKey: "model:tap.provisioner" },
          ),
        ],
        fields: [
          {
            kind: "choice",
            key: "model:core.main",
            label: "Core Model",
            value: resolveRoleDisplayValue("model:core.main", "core.main", currentCoreModel, currentCoreReasoning),
            options: modelEffortOptions,
          },
          {
            kind: "choice",
            key: "model:tui.main",
            label: "TUI miscellaneous tasks Model",
            value: resolveRoleDisplayValue("model:tui.main", "tui.main", currentTuiModel, currentTuiReasoning),
            options: modelEffortOptions,
          },
          {
            kind: "choice",
            key: "model:mp.icma",
            label: "Memory Pool ICMA Model",
            value: resolveRoleDisplayValue("model:mp.icma", "mp.icma", context.runtimeConfig?.modelPlan.mp.icma.model ?? "gpt-5.4-mini", context.runtimeConfig?.modelPlan.mp.icma.reasoning ?? "none"),
            options: modelEffortOptions,
          },
          {
            kind: "choice",
            key: "model:mp.dbagent",
            label: "Memory Pool DBAgent Model",
            value: resolveRoleDisplayValue("model:mp.dbagent", "mp.dbagent", context.runtimeConfig?.modelPlan.mp.dbagent.model ?? "gpt-5.4", context.runtimeConfig?.modelPlan.mp.dbagent.reasoning ?? "low"),
            options: modelEffortOptions,
          },
          {
            kind: "choice",
            key: "model:mp.iterator",
            label: "Memory Pool Iterator Model",
            value: resolveRoleDisplayValue("model:mp.iterator", "mp.iterator", context.runtimeConfig?.modelPlan.mp.iterator.model ?? "gpt-5.4-mini", context.runtimeConfig?.modelPlan.mp.iterator.reasoning ?? "medium"),
            options: modelEffortOptions,
          },
          {
            kind: "choice",
            key: "model:mp.checker",
            label: "Memory Pool Checker Model",
            value: resolveRoleDisplayValue("model:mp.checker", "mp.checker", context.runtimeConfig?.modelPlan.mp.checker.model ?? "gpt-5.4-mini", context.runtimeConfig?.modelPlan.mp.checker.reasoning ?? "medium"),
            options: modelEffortOptions,
          },
          {
            kind: "choice",
            key: "model:mp.dispatcher",
            label: "Memory Pool Dispatcher Model",
            value: resolveRoleDisplayValue("model:mp.dispatcher", "mp.dispatcher", context.runtimeConfig?.modelPlan.mp.dispatcher.model ?? "gpt-5.4", context.runtimeConfig?.modelPlan.mp.dispatcher.reasoning ?? "low"),
            options: modelEffortOptions,
          },
          {
            kind: "choice",
            key: "model:mp.embedding",
            label: "LanceDB Embedding Model",
            value: resolvePanelDraftValue(draft, "model:mp.embedding", context.configFile?.embedding.lanceDbModel ?? "text-embedding-3-large"),
            options: EMBEDDING_MODEL_CATALOG.map((entry) => entry.id),
          },
          {
            kind: "choice",
            key: "model:cmp.icma",
            label: "CMP ICMA Model",
            value: resolveRoleDisplayValue("model:cmp.icma", "cmp.icma", context.runtimeConfig?.modelPlan.cmp.icma.model ?? "gpt-5.4-mini", context.runtimeConfig?.modelPlan.cmp.icma.reasoning ?? "none"),
            options: modelEffortOptions,
          },
          {
            kind: "choice",
            key: "model:cmp.dbagent",
            label: "CMP DBAgent Model",
            value: resolveRoleDisplayValue("model:cmp.dbagent", "cmp.dbagent", context.runtimeConfig?.modelPlan.cmp.dbagent.model ?? "gpt-5.4", context.runtimeConfig?.modelPlan.cmp.dbagent.reasoning ?? "low"),
            options: modelEffortOptions,
          },
          {
            kind: "choice",
            key: "model:cmp.iterator",
            label: "CMP Iterator Model",
            value: resolveRoleDisplayValue("model:cmp.iterator", "cmp.iterator", context.runtimeConfig?.modelPlan.cmp.iterator.model ?? "gpt-5.4-mini", context.runtimeConfig?.modelPlan.cmp.iterator.reasoning ?? "medium"),
            options: modelEffortOptions,
          },
          {
            kind: "choice",
            key: "model:cmp.checker",
            label: "CMP Checker Model",
            value: resolveRoleDisplayValue("model:cmp.checker", "cmp.checker", context.runtimeConfig?.modelPlan.cmp.checker.model ?? "gpt-5.4-mini", context.runtimeConfig?.modelPlan.cmp.checker.reasoning ?? "medium"),
            options: modelEffortOptions,
          },
          {
            kind: "choice",
            key: "model:cmp.dispatcher",
            label: "CMP Dispatcher Model",
            value: resolveRoleDisplayValue("model:cmp.dispatcher", "cmp.dispatcher", context.runtimeConfig?.modelPlan.cmp.dispatcher.model ?? "gpt-5.4", context.runtimeConfig?.modelPlan.cmp.dispatcher.reasoning ?? "low"),
            options: modelEffortOptions,
          },
          {
            kind: "choice",
            key: "model:tap.reviewer",
            label: "Reviewer Model",
            value: resolveRoleDisplayValue("model:tap.reviewer", "tap.reviewer", context.runtimeConfig?.modelPlan.tap.reviewer.model ?? "gpt-5.4", context.runtimeConfig?.modelPlan.tap.reviewer.reasoning ?? "low"),
            options: modelEffortOptions,
          },
          {
            kind: "choice",
            key: "model:tap.toolReviewer",
            label: "ToolReviewer Model",
            value: resolveRoleDisplayValue("model:tap.toolReviewer", "tap.toolReviewer", context.runtimeConfig?.modelPlan.tap.toolReviewer.model ?? "gpt-5.4-mini", context.runtimeConfig?.modelPlan.tap.toolReviewer.reasoning ?? "medium"),
            options: modelEffortOptions,
          },
          {
            kind: "choice",
            key: "model:tap.provisioner",
            label: "Provisioner Agent",
            value: resolveRoleDisplayValue("model:tap.provisioner", "tap.provisioner", context.runtimeConfig?.modelPlan.tap.provisioner.model ?? "gpt-5.4", context.runtimeConfig?.modelPlan.tap.provisioner.reasoning ?? "medium"),
            options: modelEffortOptions,
          },
        ],
        hints: [
          "press ↑ to select up • press ↓ to select down",
          "press ENTER to edit selected model",
          "press ESC to return to previous page",
        ],
      };
    case "status":
      return {
        id,
        title: "/status",
        description: "View current working status",
        status: statusText,
        showStatus: false,
        showFields: false,
        showHints: true,
        bodyLines: [
          createBodyKeyValueLine("Current agent thread:", context.sessionId, { indent: 4, labelWidth: 28 }),
          createBodyKeyValueLine("Thread name:", context.sessionName, { indent: 4, labelWidth: 28 }),
          createBodyKeyValueLine("WorkSpace for current agent:", shortenPath(context.currentCwd), { indent: 4, labelWidth: 28 }),
          createBodyKeyValueLine(
            "Agent core model:",
            formatModelEffortDisplayLine(
              currentCoreModel,
              currentCoreReasoning,
              resolveFastEnabledForRole(context.configFile, context.runtimeConfig, "core.main"),
            ),
            { indent: 4, labelWidth: 28 },
          ),
          createBodyKeyValueLine("Current agent context usage", context.statusContextUsageLine, { indent: 4, labelWidth: 28 }),
          createBodyKeyValueLine("Raxode version:", RAXODE_DISPLAY_VERSION, { indent: 4, labelWidth: 28 }),
          createBodyKeyValueLine("Praxis package version:", PRAXIS_DISPLAY_VERSION, { indent: 4, labelWidth: 28 }),
          createBodyKeyValueLine("Permissions mode:", modeChoice, { indent: 4, labelWidth: 28 }),
          createBodyKeyValueLine("Active agents:", String(context.agents.length), { indent: 4, labelWidth: 28 }),
          createBodyKeyValueLine("OpenAI auth mode:", openAIAuthModeLabel, { indent: 4, labelWidth: 28 }),
          createBodyKeyValueLine("ChatGPT plan:", context.openAIAuthStatus.planType ?? "Unknown", { indent: 4, labelWidth: 28 }),
          createBodyKeyValueLine(
            "Embedding model:",
            context.embeddingConfig?.model ?? context.configFile?.embedding.lanceDbModel ?? "Unconfigured",
            { indent: 4, labelWidth: 28 },
          ),
          ...(rateLimitView.rows.length > 0
            ? rateLimitView.rows.map((row) => createStatusRateLimitLine(
              row.label,
              row.bar,
              row.summary,
              row.resetsAt,
            ))
            : [
                createBodyKeyValueLine(
                  "Official usage:",
                  context.openAIAuthStatus.authMode !== "chatgpt_oauth"
                    ? "Unavailable (ChatGPT subscription required)"
                    : rateLimitView.availability === "error"
                      ? `Unavailable (${rateLimitView.error ?? "refresh failed"})`
                      : context.rateLimitRefreshState === "loading"
                        ? "Refreshing official usage snapshot..."
                        : "Unavailable",
                  { indent: 4, labelWidth: 28 },
                ),
              ]),
        ],
        fields: [
          {
            kind: "value",
            key: "backend",
            label: "Backend status",
            value: panelStatusForBackendStatus(context.backendStatus),
          },
          {
            kind: "value",
            key: "run",
            label: "Run status",
            value: context.runLabel,
          },
          {
            kind: "value",
            key: "workspace",
            label: "Current workspace",
            value: shortenPath(context.currentCwd),
          },
          {
            kind: "value",
            key: "model",
            label: "Current model",
            value: `${currentCoreModel} · ${currentCoreReasoning}`,
          },
          {
            kind: "value",
            key: "contextUsage",
            label: "Current agent context usage",
            value: context.statusContextUsageLine,
          },
          {
            kind: "value",
            key: "language",
            label: "Current language",
            value: currentLanguage,
          },
          {
            kind: "action",
            key: "showLogPath",
            label: "Open live reports",
            value: context.logPath ? shortenPath(context.logPath) : "Log path pending",
          },
          {
            kind: "action",
            key: "refreshStatus",
            label: "Refresh",
            value: "Reload panel snapshot",
            primary: true,
          },
        ],
        hints: [
          "press ESC to return to previous page",
        ],
      };
    case "exit":
      return {
        id,
        title: "/exit",
        description: "Exit the current session",
        status: statusText,
        showStatus: false,
        showFields: false,
        showHints: true,
        bodyLines: [
          {
            text: "     Close this panel for now and wait a moment.",
            fieldKey: "exit:close",
          },
          {
            text: "     Force stop and exit.",
            fieldKey: "exit:force",
          },
          {
            text: "     Wait for the tasks to stop, then exit.",
            fieldKey: "exit:wait",
          },
          {
            text: context.activeTaskCount > 0
              ? "     Switch to the running task and view it without exiting."
              : "     Switch to the current task view without exiting.",
            fieldKey: "exit:switch",
          },
        ],
        fields: [
          {
            kind: "value",
            key: "sessionState",
            label: "Session state",
            value: context.activeTaskCount > 0 ? "Busy" : "Idle",
            tone: context.activeTaskCount > 0 ? "warning" : "success",
          },
          {
            kind: "value",
            key: "activeTaskCount",
            label: "Active tasks",
            value: String(context.activeTaskCount),
          },
          {
            kind: "action",
            key: "exit:close",
            label: "Close this panel for now and wait a moment",
            value: "Return to the current session",
            primary: true,
          },
          {
            kind: "action",
            key: "exit:force",
            label: "Force stop and exit",
            value: "Stop now and show the exit summary",
            tone: "danger",
          },
          {
            kind: "action",
            key: "exit:wait",
            label: "Wait for the tasks to stop, then exit",
            value: context.activeTaskCount > 0 ? "Auto-exit after the current work settles" : "Exit as soon as possible",
            tone: context.activeTaskCount > 0 ? "warning" : "success",
          },
          {
            kind: "action",
            key: "exit:switch",
            label: "Switch to the running task and view it without exiting",
            value: context.activeTaskCount > 0 ? "Stay in the current session and follow the task" : "Keep working in this session",
          },
        ],
        hints: [
          "press ↑ to select up • press ↓ to select down",
          "press ENTER to apply the selected exit method",
          "press ESC to return to previous page",
        ],
      };
    case "cmp":
      {
        const cmpPageIndex = resolveViewerPageIndex("cmp", draft, context.cmpViewerSnapshot?.entries.length ?? 0);
        const cmpViewer = buildCmpViewerBodyLines(context.cmpViewerSnapshot, cmpPageIndex, lineWidth);
      return {
        id,
        title: "/cmp",
        description: "View current context sections summary",
        status: statusText,
        viewerPage: {
          pageIndex: cmpViewer.meta.pageIndex,
          pageCount: cmpViewer.meta.pageCount,
          totalItems: context.cmpViewerSnapshot?.entries.length ?? 0,
        },
        showStatus: false,
        showFields: false,
        showHints: true,
        bodyLines: [
          { text: `    ${context.cmpStatusLabel}` },
          ...cmpViewer.lines,
        ],
        fields: [
          {
            kind: "action",
            key: "refreshCmp",
            label: "Refresh",
            value: "Reload current CMP snapshot",
            primary: true,
          },
        ],
        hints: [
          "press ← to previous page • press → to next page",
          "press ENTER to refresh current CMP summary",
          "press ESC to return to previous page",
        ],
      };
      }
    case "mp":
      {
        const mpPageIndex = resolveViewerPageIndex("mp", draft, context.mpViewerSnapshot?.entries.length ?? 0);
        const mpViewer = buildMpViewerBodyLines(context.mpViewerSnapshot, mpPageIndex, lineWidth);
      return {
        id,
        title: "/mp",
        description: "Browse current memory state",
        status: statusText,
        viewerPage: {
          pageIndex: mpViewer.meta.pageIndex,
          pageCount: mpViewer.meta.pageCount,
          totalItems: context.mpViewerSnapshot?.entries.length ?? 0,
        },
        showStatus: false,
        showFields: false,
        showHints: true,
        bodyLines: mpViewer.lines,
        fields: [
          {
            kind: "action",
            key: "refreshMp",
            label: "Refresh memory",
            value: "Reload current MP snapshot",
            primary: true,
          },
        ],
        hints: [
          "press ← to previous page • press → to next page",
          "press ENTER to refresh current memory state",
          "press ESC to return to previous page",
        ],
      };
      }
    case "capabilities":
      {
        const capabilityGroupCount = context.capabilityViewerSnapshot?.groups.length ?? 0;
        const capabilitiesPageIndex = resolveViewerPageIndex("capabilities", draft, capabilityGroupCount, CAPABILITY_VIEWER_PAGE_SIZE);
        const capabilityViewer = buildCapabilityViewerBodyLines({
          snapshot: context.capabilityViewerSnapshot,
          pageIndex: capabilitiesPageIndex,
          lineWidth,
        });
      return {
        id,
        title: "/capabilities",
        description: "View registered TAP capabilities",
        status: statusText,
        viewerPage: {
          pageIndex: capabilityViewer.meta.pageIndex,
          pageCount: capabilityViewer.meta.pageCount,
          totalItems: capabilityGroupCount,
        },
        showStatus: false,
        showFields: false,
        showHints: true,
        bodyLines: capabilityViewer.lines,
        fields: [
          {
            kind: "action",
            key: "refreshCapabilities",
            label: "Refresh",
            value: "Reload current TAP snapshot",
            primary: true,
          },
        ],
        hints: [
          "press ← to previous page • press → to next page",
          "press ENTER to refresh capability summary",
          "press ESC to return to previous page",
        ],
      };
      }
    case "init":
      if (context.initViewerSnapshot) {
        const initSnapshot = context.initViewerSnapshot;
        const summaryLines = initSnapshot.summaryLines.length > 0
          ? initSnapshot.summaryLines
          : (
            initSnapshot.status === "completed"
              ? [
                "Congratulations! Initialization complete!",
                "You are all set to start working with Raxode.",
              ]
              : [
                "Initialization is in progress.",
                "Raxode is preparing the current workspace.",
              ]
          );
        return {
          id,
          title: "/init",
          description: "Initialize the current workspace session",
          status: statusText,
          showStatus: false,
          showFields: false,
          showHints: !initSnapshot.status || !isDirectTuiInitRunningStatus(initSnapshot.status),
          bodyLines: summaryLines.map((line) => ({
            text: `    ${line}`,
            tone: (initSnapshot.status === "failed" ? "danger" : "info") as PraxisSlashPanelField["tone"],
          })),
          fields: [],
          hints: initSnapshot.status === "completed"
            ? [
              "panel will close automatically after completion",
              "press ESC to return immediately",
            ]
            : [
              "press ENTER in the main composer to send initialization notes",
              "press ESC to return to previous page",
            ],
        };
      }
      return {
        id,
        title: "/init",
        description: "Initialize the current workspace session",
        status: statusText,
        showStatus: false,
        showFields: false,
        showHints: true,
        bodyLines: [
          {
            text: "    (Please enter here the key points Raxode should pay attention to before init,",
            tone: "success",
          },
          {
            text: "    as well as the core direction of the work below, if none, please ignore.)",
            tone: "success",
          },
        ],
        fields: [],
        hints: [
          "press ENTER in the main composer to send initialization notes",
          "press ESC to return to previous page",
        ],
      };
    case "question": {
      const snapshot = context.questionViewerSnapshot;
      const questions = snapshot?.questions ?? [];
      const normalizedIndex = questions.length === 0
        ? 0
        : clampQuestionIndex(context.questionPanelState.currentQuestionIndex, questions.length);
      const currentQuestion = questions[normalizedIndex];
      const questionBodyLines: PraxisSlashPanelBodyLine[] = [];
      if (currentQuestion) {
        const waitingDots = QUESTION_WAITING_DOT_FRAMES[
          context.questionAnimationFrame % QUESTION_WAITING_DOT_FRAMES.length
        ] ?? QUESTION_WAITING_DOT_FRAMES[0];
        const selectedOptionId = context.questionPanelState.answersByQuestionId[currentQuestion.id]?.selectedOptionId;
        const noteMode = isQuestionNoteModeActive(context.questionPanelState, currentQuestion);
        const currentAnswerText = currentQuestion.kind === "freeform" && !noteMode
          ? context.questionComposerText
          : (context.questionPanelState.answersByQuestionId[currentQuestion.id]?.answerText ?? "");
        questionBodyLines.push(
          {
            text: "",
            segments: [
              { text: "    " },
              { text: waitingDots, tone: "info" },
              { text: " " },
              ...buildShimmerSegments("Raxode is waiting for your answers...", context.questionAnimationFrame).map((segment) => ({
                text: segment.text,
                tone: segment.color === TUI_THEME.textMuted ? "info" as const : undefined,
              })),
            ],
          },
          { text: `    Questions ${String(normalizedIndex + 1).padStart(2, "0")}/${String(questions.length).padStart(2, "0")}`, tone: "info" },
          { text: `    ${String(normalizedIndex + 1).padStart(2, "0")}.${currentQuestion.prompt}`, tone: "success" },
        );
        if (currentQuestion.kind === "freeform") {
          questionBodyLines.push(
            {
              text: `    Answer: ${currentAnswerText.length > 0 ? currentAnswerText : (currentQuestion.placeholder ?? "Type your answer in the main composer below.")}`,
              tone: currentAnswerText.length > 0 ? "success" : "info",
            },
          );
        } else {
          currentQuestion.options.forEach((option, optionIndex) => {
            const active = (context.questionPanelState.activeOptionIndexByQuestionId[currentQuestion.id] ?? 0) === optionIndex;
            const selected = selectedOptionId === option.id;
            const selectedHasNote = selected
              && Boolean(context.questionComposerText.trim());
            questionBodyLines.push(
              {
                text: "",
                segments: [
                  { text: active ? "    → " : "      ", tone: active ? "info" : undefined },
                  { text: option.label, tone: "fast" },
                  ...(selected ? [{ text: " ✔", tone: "success" as const }] : []),
                  ...(selectedHasNote ? [{ text: " [Note]", tone: "info" as const }] : []),
                ],
              },
              {
                text: `        ${option.description}`,
                tone: active ? "info" : undefined,
              },
            );
          });
        }
      } else {
        questionBodyLines.push({
          text: "    Waiting for backend question prompts...",
          tone: "info",
        });
      }
      return {
        id,
        title: snapshot?.title ?? "/question",
        description: snapshot?.instruction
          ?? (snapshot?.sourceKind === "init"
            ? "Answer the current initialization follow-up questions"
            : "Answer the current structured follow-up questions"),
        status: statusText,
        showStatus: false,
        showFields: false,
        showHints: true,
        bodyLines: questionBodyLines,
        fields: [],
        hints: [
          "TAB to append annotations • ESC to interrupt",
          "press ↑ to select up • press ↓ to select down",
          "press ← to go previous • press → to go next",
        ],
      };
    }
    case "resume":
      return {
        id,
        title: "/resume",
        description: "Resume the latest session or current work",
        status: statusText,
        showStatus: false,
        showFields: false,
        showHints: true,
        bodyLines: [
          {
            text: "    Create a new session with this agent",
            tone: "danger",
            fieldKey: "resume:create",
          },
          { text: "         Thread Code          Session Name", tone: "info" },
          ...visibleSessions.map((session, index) => ({
            text: session.sessionId === context.sessionId
              ? withCurrentRowMarker(`    ${String(index + 1).padStart(3, "0")}  ${(session.sessionId.slice(0, 19)).padEnd(19, " ")}  ${session.name}`)
              : `    ${String(index + 1).padStart(3, "0")}  ${(session.sessionId.slice(0, 19)).padEnd(19, " ")}  ${session.name}`,
            fieldKey: `resume:${session.sessionId}`,
          })),
          ...(renameTarget?.kind === "session"
            ? [{ text: `    Rename: ${inputState.value}`, fieldKey: "resumeRename" as const }]
            : []),
        ],
        fields: [
          ...(renameTarget?.kind === "session"
            ? [{
              kind: "input" as const,
              key: "resumeRename",
              label: "Rename session",
              value: inputState.value,
              placeholder: "session name",
            }]
            : []),
          {
            kind: "action" as const,
            key: "resume:create",
            label: "Create a new session with this agent",
            value: "Create and rename a new empty session",
            tone: "danger" as const,
          },
          ...visibleSessions.map((session) => ({
            kind: "action" as const,
            key: `resume:${session.sessionId}`,
            label: session.name,
            value: session.sessionId,
          })),
        ],
        hints: [
          "press ↑ to select up • press ↓ to select down",
          "press ENTER to create or switch selected session",
          "press SPACE to rename selected session",
          "press ESC to return to previous page",
        ],
      };
    case "agents":
      return {
        id,
        title: "/agents",
        description: "Switch to agents view",
        status: statusText,
        showStatus: false,
        showFields: false,
        showHints: true,
        bodyLines: [
          {
            text: "    Create a new agent working in this workspace",
            tone: "danger",
            fieldKey: "agent:create",
          },
          { text: "         Agent Name              Work Content Summary", tone: "info" },
          ...visibleAgents.map((agent, index) => ({
            text: agent.agentId === context.selectedAgentId
              ? withCurrentRowMarker(`    ${String(index + 1).padStart(3, "0")}  ${padDisplayText(agent.name, 22)}  ${agent.summary}`)
              : `    ${String(index + 1).padStart(3, "0")}  ${padDisplayText(agent.name, 22)}  ${agent.summary}`,
            fieldKey: `agent:${agent.agentId}`,
          })),
          ...(renameTarget?.kind === "agent"
            ? [{ text: `    Rename: ${inputState.value}`, fieldKey: "agentRename" as const }]
            : []),
        ],
        fields: [
          ...(renameTarget?.kind === "agent"
            ? [{
              kind: "input" as const,
              key: "agentRename",
              label: "Rename agent",
              value: inputState.value,
              placeholder: "agent name",
            }]
            : []),
          {
            kind: "action" as const,
            key: "agent:create",
            label: "Create a new agent working in this workspace",
            value: "Create and rename a new workspace agent",
            tone: "danger" as const,
          },
          ...visibleAgents.map((agent) => ({
            kind: "action" as const,
            key: `agent:${agent.agentId}`,
            label: agent.name,
            value: agent.summary,
          })),
        ],
        hints: [
          "press ↑ to select up • press ↓ to select down",
          "press ENTER to create or switch selected agent",
          "press SPACE to rename selected agent",
          "press ESC to return to previous page",
        ],
      };
    case "permissions":
      {
        const permissionFields: PraxisSlashPanelView["fields"] = [
          ...PRAXIS_PERMISSION_MODE_OPTIONS.map((mode) => ({
            kind: "action" as const,
            key: `permissions:mode:${mode}`,
            label: mode,
            value: describePermissionMode(mode),
          })),
        ];
        const selectedPermissionMode = resolvePermissionPanelSelectedMode(permissionFields, focusIndex, modeChoice);
      return {
        id,
        title: "/permissions",
        description: "View current permissions and approvals",
        status: statusText,
        showStatus: false,
        showFields: false,
        showHints: true,
        bodyLines: buildPermissionModeMatrixLines(selectedPermissionMode, {
          persistedAllowRuleCount: context.configFile?.permissions.persistedAllowRules.length
            ?? context.runtimeConfig?.permissions.persistedAllowRules.length
            ?? 0,
        }),
        fields: permissionFields,
        hints: [
          "press ↑ to select up • press ↓ to select down",
          "press ENTER to switch to selected permission mode",
          "press ESC to return to previous page",
        ],
      };
      }
    case "workspace":
      return {
        id,
        title: "/workspace",
        description: "Switch current workspace directory",
        status: statusText,
        showStatus: false,
        showFields: false,
        showHints: true,
        bodyLines: [
          { text: `    Current workspace: ${shortenPath(context.currentCwd)}` },
        ],
        fields: [
          {
            kind: "value",
            key: "currentWorkspace",
            label: "Current workspace",
            value: shortenPath(context.currentCwd),
          },
          {
            kind: "input",
            key: "workspacePath",
            label: "Target path",
            value: workspaceInputValue,
            placeholder: shortenPath(currentWorkspaceDefault),
            submitActionKey: "applyWorkspace",
          },
          {
            kind: "action",
            key: "useHome",
            label: "Use home",
            value: shortenPath(process.env.HOME ?? context.currentCwd),
          },
          {
            kind: "action",
            key: "applyWorkspace",
            label: "Apply workspace switch",
            value: "Change cwd, update config, restart backend",
            primary: true,
          },
        ],
        hints: [
          `default workspace: ${shortenPath(currentWorkspaceDefault)}`,
          "press ENTER to apply the workspace above",
          "press ESC to return to previous page",
        ],
      };
    case "language":
      const filteredLanguages = Object.entries(LANGUAGE_LABELS)
        .filter(([code, label]) => {
          const query = inputState.value.trim().toLowerCase();
          if (!query) {
            return true;
          }
          return code.toLowerCase().includes(query) || label.toLowerCase().includes(query);
        })
        .slice(0, 12);
      return {
        id,
        title: "/language",
        description: "Switch current language mode",
        status: statusText,
        showStatus: false,
        showFields: false,
        showHints: true,
        bodyLines: [
          { text: "    Enter any character of the language you use below" },
          { text: "    OR directly enter the language you want to use below" },
          { text: `    ${buildLanguageInputPreview(resolvePanelDraftValue(draft, "language", currentLanguage))} (press SPACE to select below)` },
          { text: `    Filter: ${inputState.value}`, fieldKey: "languageQuery" },
          { text: "         Language", tone: "info" },
          ...filteredLanguages.map(([code, label], index) => ({
            text: `    ${String(index + 1).padStart(3, "0")}  ${label}`,
            fieldKey: `language:${code}`,
          })),
        ],
        fields: [
          {
            kind: "input",
            key: "languageQuery",
            label: "Language filter",
            value: inputState.value,
            placeholder: currentLanguage,
          },
          {
            kind: "choice",
            key: "language",
            label: "Current language",
            value: resolvePanelDraftValue(draft, "language", currentLanguage),
            options: [...PRAXIS_LANGUAGE_OPTIONS],
          },
          ...filteredLanguages.map(([code, label]) => ({
            kind: "action" as const,
            key: `language:${code}`,
            label,
            value: code,
          })),
        ],
        hints: [
          "press ↑ to select up • press ↓ to select down",
          "press ENTER to switch to selected language",
          "press ESC to return to previous page",
        ],
      };
  }
}

const STARTUP_LETTER_ART: Record<string, string[]> = {
  R: [
    "██████╗ ",
    "██╔══██╗",
    "██████╔╝",
    "██╔══██╗",
    "██║  ██║",
    "╚═╝  ╚═╝",
  ],
  A: [
    " █████╗ ",
    "██╔══██╗",
    "███████║",
    "██╔══██║",
    "██║  ██║",
    "╚═╝  ╚═╝",
  ],
  X: [
    "██╗  ██╗",
    "╚██╗██╔╝",
    " ╚███╔╝ ",
    " ██╔██╗ ",
    "██╔╝ ██╗",
    "╚═╝  ╚═╝",
  ],
  C: [
    " ██████╗",
    "██╔════╝",
    "██║     ",
    "██║     ",
    "╚██████╗",
    " ╚═════╝",
  ],
  O: [
    " ██████╗ ",
    "██╔═══██╗",
    "██║   ██║",
    "██║   ██║",
    "╚██████╔╝",
    " ╚═════╝ ",
  ],
  D: [
    "██████╗ ",
    "██╔══██╗",
    "██║  ██║",
    "██║  ██║",
    "██████╔╝",
    "╚═════╝ ",
  ],
  E: [
    "███████╗",
    "██╔════╝",
    "█████╗  ",
    "██╔══╝  ",
    "███████╗",
    "╚══════╝",
  ],
};

function stripAnsi(value: string): string {
  return value
    .replace(/\u001B\][^\u0007]*(?:\u0007|\u001B\\)/gu, "")
    .replace(/\u001B\[[0-?]*[ -/]*[@-~]/gu, "")
    .replace(/\u001B[@-Z\\-_]/gu, "");
}

function ansiColorCode(color?: string): string {
  switch (color) {
    case "red":
    case "redBright":
      return "\u001B[91m";
    case "yellow":
    case "yellowBright":
      return "\u001B[93m";
    case "cyan":
    case "cyanBright":
      return "\u001B[96m";
    case "magenta":
    case "magentaBright":
      return "\u001B[95m";
    case "gray":
      return "\u001B[90m";
    case "white":
    case "whiteBright":
      return "\u001B[97m";
    default:
      return "";
  }
}

function truncateTextToWidth(text: string, maxWidth: number): string {
  if (stringWidth(text) <= maxWidth) {
    return text;
  }
  let output = "";
  for (const char of [...text]) {
    if (stringWidth(output + char) > Math.max(0, maxWidth - 1)) {
      break;
    }
    output += char;
  }
  return `${output}…`;
}

function padTextToWidth(text: string, width: number): string {
  const normalized = truncateTextToWidth(text, width);
  const remaining = Math.max(0, width - stringWidth(normalized));
  return `${normalized}${" ".repeat(remaining)}`;
}

function buildOverlayContentLine(
  innerWidth: number,
  content: TerminalOverlaySegment[],
): TerminalOverlayLine {
  const rawWidth = content.reduce((sum, segment) => sum + stringWidth(segment.text), 0);
  const pad = " ".repeat(Math.max(0, innerWidth - rawWidth));
  return {
    segments: [
      { text: "│", color: TUI_THEME.mintSoft },
      ...content,
      { text: pad },
      { text: "│", color: TUI_THEME.mintSoft },
    ],
  };
}

function buildModelPickerOverlaySnapshot(
  picker: ModelPickerOverlayState,
  terminalRows: number,
  terminalColumns: number,
): TerminalOverlaySnapshot {
  const width = Math.max(56, Math.min(terminalColumns - 8, 110));
  const innerWidth = width - 2;
  const selectedModel = picker.models[picker.selectedModelIndex];
  const reasoningLevels = selectedModel?.reasoningLevels ?? [];
  const selectedReasoning = reasoningLevels[picker.selectedReasoningIndex] ?? selectedModel?.defaultReasoningLevel;
  const visibleStart = Math.max(
    0,
    Math.min(
      Math.max(0, picker.models.length - MODEL_PICKER_MAX_VISIBLE_MODELS),
      picker.selectedModelIndex - Math.floor(MODEL_PICKER_MAX_VISIBLE_MODELS / 2),
    ),
  );
  const visibleEnd = Math.min(picker.models.length, visibleStart + MODEL_PICKER_MAX_VISIBLE_MODELS);
  const visibleModels = picker.models.slice(visibleStart, visibleEnd);
  const remainingAbove = visibleStart;
  const remainingBelow = Math.max(0, picker.models.length - visibleEnd);
  const reasoningSummary = reasoningLevels.length > 0
    ? `Reasoning: ${reasoningLevels.map((level) => level === selectedReasoning ? `[${level}]` : level).join(" · ")}`
    : "Reasoning: not supported";
  const fastSummary = picker.source === "embedding"
    ? "Embedding models do not support FAST mode."
    : selectedModel?.supportsFastServiceTier
      ? `FAST: ${picker.serviceTierFastEnabled ? "ON" : "OFF"} (service tier)`
      : "FAST: unavailable";
  const lines: TerminalOverlayLine[] = [];

  const pushLine = (content: TerminalOverlaySegment[]) => {
    lines.push(buildOverlayContentLine(innerWidth, content));
  };

  lines.push({
    segments: [{ text: `╭${"─".repeat(innerWidth)}╮`, color: TUI_THEME.mintSoft }],
  });
  pushLine([{ text: padTextToWidth(picker.fieldLabel, innerWidth), color: TUI_THEME.mintSoft }]);
  pushLine([{
    text: padTextToWidth(
      picker.source === "embedding"
        ? "API-backed embedding models"
        : "Available models for current login",
      innerWidth,
    ),
    color: TUI_THEME.textMuted,
  }]);

  pushLine([{
    text: padTextToWidth(remainingAbove > 0 ? `... ${remainingAbove} remain` : "", innerWidth),
    color: TUI_THEME.textMuted,
  }]);
  for (let index = 0; index < MODEL_PICKER_MAX_VISIBLE_MODELS; index += 1) {
    if (picker.loading && index === 0) {
      pushLine([{ text: padTextToWidth("Loading models...", innerWidth), color: TUI_THEME.textMuted }]);
      continue;
    }
    if (picker.error && index === 0) {
      pushLine([{ text: padTextToWidth(picker.error, innerWidth), color: TUI_THEME.red }]);
      continue;
    }
    const model = visibleModels[index];
    if (!model) {
      pushLine([{ text: " ".repeat(innerWidth) }]);
      continue;
    }
    const globalIndex = visibleStart + index;
    const active = globalIndex === picker.selectedModelIndex;
    const showFastBadge = picker.source === "chat"
      && model.id === selectedModel?.id
      && model.supportsFastServiceTier
      && picker.serviceTierFastEnabled;
    const availability = picker.availabilityByModelId[model.id];
    const availabilityBadge = availability?.status === "available"
      ? { text: " ✔", color: TUI_THEME.mintSoft }
      : availability?.status === "unavailable"
        ? { text: " ✘", color: TUI_THEME.red }
        : null;
    const reservedSuffixWidth = (showFastBadge ? 7 : 0) + (availabilityBadge ? stringWidth(availabilityBadge.text) : 0);
    pushLine([
      { text: active ? "→ " : "  ", color: active ? TUI_THEME.yellow : TUI_THEME.textMuted },
      {
        text: padTextToWidth(model.label, innerWidth - 2 - reservedSuffixWidth),
        color: active ? TUI_THEME.yellow : TUI_THEME.text,
      },
      ...(showFastBadge ? [{ text: " [FAST]", color: TUI_THEME.violet }] : []),
      ...(availabilityBadge ? [availabilityBadge] : []),
    ]);
  }
  pushLine([{
    text: padTextToWidth(remainingBelow > 0 ? `... ${remainingBelow} remain` : "", innerWidth),
    color: TUI_THEME.textMuted,
  }]);
  pushLine([{
    text: padTextToWidth(
      picker.source === "embedding"
        ? "Reasoning: not supported"
        : reasoningSummary,
      innerWidth,
    ),
    color: picker.source === "embedding" ? TUI_THEME.textMuted : TUI_THEME.violet,
  }]);
  pushLine([{
    text: padTextToWidth(fastSummary, innerWidth),
    color: picker.source === "embedding" ? TUI_THEME.textMuted : TUI_THEME.violet,
  }]);
  pushLine([{
    text: padTextToWidth(
      "↑↓ select · ←→ reasoning · Tab FAST · Enter confirm · Esc close",
      innerWidth,
    ),
    color: TUI_THEME.textMuted,
  }]);

  lines.push({
    segments: [{ text: `╰${"─".repeat(innerWidth)}╯`, color: TUI_THEME.mintSoft }],
  });

  const height = lines.length;
  return {
    top: Math.max(1, Math.floor((terminalRows - height) / 2)),
    left: Math.max(1, Math.floor((terminalColumns - width) / 2)),
    lines,
  };
}

function renderTerminalOverlayLine(line: TerminalOverlayLine): string {
  return `${line.segments.map((segment) => `${ansiColorCode(segment.color)}${segment.text}`).join("")}\u001B[0m`;
}

function paintTerminalOverlayIfNeeded(stdout: NodeJS.WriteStream): void {
  if (!stdout.isTTY || !terminalOverlaySnapshot) {
    return;
  }
  for (const [index, line] of terminalOverlaySnapshot.lines.entries()) {
    stdout.write(`\u001B[${terminalOverlaySnapshot.top + index};${terminalOverlaySnapshot.left}H${renderTerminalOverlayLine(line)}`);
  }
}

function shortenPath(value: string): string {
  const home = process.env.HOME;
  if (home && value.startsWith(home)) {
    return `~${value.slice(home.length)}`;
  }
  return value;
}

function appendClipped<T>(previous: T[], next: T[], max = MAX_RENDER_LINES): T[] {
  const merged = [...previous, ...next];
  return merged.length <= max ? merged : merged.slice(merged.length - max);
}

function formatElapsedFromMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function extractTurnResultAnswer(record: LiveLogRecord): string | null {
  const answer = record.core?.answer;
  if (typeof answer === "string") {
    return decodeEscapedDisplayTextMaybe(extractResponseTextMaybe(answer)).trim() || null;
  }
  if (answer && typeof answer === "object" && typeof answer.text === "string") {
    return decodeEscapedDisplayTextMaybe(extractResponseTextMaybe(answer.text)).trim() || null;
  }
  return null;
}

function compactRuntimeText(text: string): string {
  const normalized = text.replace(/\s+/gu, " ").trim();
  if (normalized.length <= MAX_DEBUG_LINE_CHARS) {
    return normalized;
  }
  return `${normalized.slice(0, MAX_DEBUG_LINE_CHARS - 1).trimEnd()}…`;
}

function resolveWorkspaceCheckpointFailure(input: {
  error: unknown;
  workspaceRoot: string;
}): {
  code: string;
  origin: string;
  uiError: string;
  rawMessage: string;
} {
  const rawMessage = input.error instanceof Error ? (input.error.message || input.error.name) : String(input.error);
  const normalized = compactRuntimeText(rawMessage);
  if (!isUsableWorkspaceDirectory(input.workspaceRoot)) {
    return {
      code: "workspace_unavailable",
      origin: "workspace_root",
      uiError: "workspace path unavailable",
      rawMessage: normalized,
    };
  }
  if (/EISDIR/u.test(rawMessage) || /illegal operation on a directory, copyfile/u.test(rawMessage)) {
    return {
      code: "nested_worktree_skipped",
      origin: "workspace_scan",
      uiError: "workspace checkpoint skipped nested worktree directory",
      rawMessage: normalized,
    };
  }
  if (/EACCES/u.test(rawMessage) || /permission denied/u.test(rawMessage)) {
    return {
      code: "workspace_unreadable",
      origin: "workspace_scan",
      uiError: "workspace checkpoint skipped unreadable path",
      rawMessage: normalized,
    };
  }
  if (/scandir/u.test(rawMessage) || /readdir/u.test(rawMessage) || /ls-files/u.test(rawMessage)) {
    return {
      code: "workspace_scan_failed",
      origin: "workspace_scan",
      uiError: "workspace checkpoint could not scan the workspace",
      rawMessage: normalized,
    };
  }
  if (/ENOENT/u.test(rawMessage) || /no such file or directory/u.test(rawMessage)) {
    return {
      code: "workspace_unavailable",
      origin: "workspace_scan",
      uiError: "workspace path unavailable",
      rawMessage: normalized,
    };
  }
  return {
    code: "checkpoint_failed",
    origin: "unknown",
    uiError: "workspace checkpoint failed",
    rawMessage: normalized,
  };
}

function estimateTerminalWidth(text: string): number {
  let width = 0;
  for (const char of [...text]) {
    const codePoint = char.codePointAt(0) ?? 0;
    width += codePoint >= 0x1100 ? 2 : 1;
  }
  return width;
}

function splitComposerLines(value: string): string[] {
  const lines = value.split("\n");
  return lines.length > 0 ? lines : [""];
}

function measureComposerCursor(value: string, cursorOffset: number): { line: number; column: number } {
  const beforeCursor = value.slice(0, cursorOffset);
  const lines = beforeCursor.split("\n");
  return {
    line: Math.max(0, lines.length - 1),
    column: estimateTerminalWidth(lines.at(-1) ?? ""),
  };
}

function summarizeRuntimeEnvelope(text: string): string | null {
  try {
    const parsed = JSON.parse(text) as {
      action?: unknown;
      taskStatus?: unknown;
      responseText?: unknown;
      capabilityKey?: unknown;
      output?: unknown;
    };
    const action = typeof parsed.action === "string" ? parsed.action : undefined;
    const taskStatus = typeof parsed.taskStatus === "string" ? parsed.taskStatus : undefined;
    const capabilityKey = typeof parsed.capabilityKey === "string" ? parsed.capabilityKey : undefined;

    if (!action) {
      return null;
    }

    if (action === "reply") {
      return taskStatus ? `core reply · ${taskStatus}` : "core reply";
    }
    if (action === "tool" && capabilityKey) {
      return taskStatus ? `${capabilityKey} · ${taskStatus}` : capabilityKey;
    }

    return taskStatus ? `${action} · ${taskStatus}` : action;
  } catch {
    return null;
  }
}

function summarizeStatusText(text: string): string {
  const envelopeSummary = summarizeRuntimeEnvelope(text);
  if (envelopeSummary) {
    return envelopeSummary;
  }
  return compactRuntimeText(text);
}

function summarizeNonPrimaryMessage(message: SurfaceMessage): SurfaceMessage {
  if (message.kind === "assistant" || message.kind === "user") {
    return message;
  }
  if (message.metadata?.source === "tool_summary" || message.metadata?.source === "question_receipt") {
    return message;
  }
  return {
    ...message,
    text: summarizeStatusText(message.text),
  };
}

function computeVisibleLines<T>(
  lines: T[],
  viewportLineCount: number,
  scrollOffset: number,
): T[] {
  if (lines.length <= viewportLineCount) {
    return lines;
  }
  const end = Math.max(viewportLineCount, lines.length - scrollOffset);
  const start = Math.max(0, end - viewportLineCount);
  return lines.slice(start, end);
}

const graphemeSegmenter = new Intl.Segmenter("zh", { granularity: "grapheme" });

function splitGraphemes(text: string): string[] {
  return Array.from(graphemeSegmenter.segment(text), (segment) => segment.segment);
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function wrapRenderText(text: string, maxWidth: number): string[] {
  if (text.length === 0) {
    return [" "];
  }
  if (maxWidth <= 0) {
    return [""];
  }

  const output: string[] = [];
  let current = "";
  let currentWidth = 0;

  for (const grapheme of splitGraphemes(text)) {
    const width = Math.max(1, stringWidth(grapheme));
    if (currentWidth > 0 && currentWidth + width > maxWidth) {
      output.push(current);
      current = grapheme;
      currentWidth = width;
      continue;
    }
    current += grapheme;
    currentWidth += width;
  }

  output.push(current);
  return output;
}

function buildAnimatedStartupWord(step: number): RenderLine[] {
  const visibleLetters = STARTUP_WORD.slice(0, Math.max(0, Math.min(step, STARTUP_WORD.length))).split("");
  const rows = Array.from({ length: 6 }, () => [] as Array<{ text: string; color?: string }>);
  const highlightedLetterIndex =
    step > 0 && step <= STARTUP_WORD.length
      ? visibleLetters.length - 1
      : -1;
  const showPoweredBy = step >= STARTUP_WORD.length;
  const rainbowIndex = Math.max(0, Math.min(
    STARTUP_RAINBOW_COLORS.length - 1,
    step - STARTUP_WORD.length,
  ));

  visibleLetters.forEach((letter, letterIndex) => {
    const glyph = STARTUP_LETTER_ART[letter];
    if (!glyph) {
      return;
    }
    const color = letterIndex === highlightedLetterIndex ? TUI_THEME.violet : undefined;
    for (let index = 0; index < rows.length; index += 1) {
      rows[index].push({
        text: `${glyph[index]} `,
        color,
      });
    }
  });

  if (showPoweredBy) {
    rows[0].push({ text: "powered by ", color: TUI_THEME.textMuted });
    rows[0].push({ text: "Praxis", color: STARTUP_RAINBOW_COLORS[rainbowIndex] });
  }

  if (step > STARTUP_WORD.length) {
    rows[5].push({
      text: "v0.1.0",
      color: TUI_THEME.textMuted,
    });
  }

  return rows.map((segments) => ({
    kind: "detail" as const,
    text: segments.map((segment) => segment.text).join(""),
    segments,
  }));
}

function wrapSegmentedLine(
  line: RenderLine,
  maxWidth: number,
): RenderLine[] {
  const segments = line.segments;
  const continuationSegments = line.continuationSegments ?? [];
  if (!segments || segments.length === 0) {
    return [line];
  }
  if (maxWidth <= 0) {
    return [{
      kind: line.kind,
      text: "",
      segments: [{
        text: "",
      }],
    }];
  }

  const wrappedLines: RenderLine[] = [];
  let currentSegments: Array<{ text: string; color?: string; backgroundColor?: string }> = [];
  let currentWidth = 0;
  let isFirstVisualLine = true;

  const flushCurrentLine = () => {
    if (line.kind === "user" && currentWidth < maxWidth) {
      currentSegments.push({
        text: " ".repeat(maxWidth - currentWidth),
        backgroundColor: TUI_THEME.surface,
      });
    }
    wrappedLines.push({
      kind: line.kind,
      text: currentSegments.map((segment) => segment.text).join(""),
      segments: currentSegments.length > 0 ? currentSegments : [{ text: " " }],
    });
    currentSegments = [];
    currentWidth = 0;
    isFirstVisualLine = false;
    if (!isFirstVisualLine && continuationSegments.length > 0) {
      currentSegments = continuationSegments.map((segment) => ({ ...segment }));
      currentWidth = continuationSegments.reduce(
        (sum, segment) => sum + stringWidth(segment.text),
        0,
      );
    }
  };

  for (const segment of segments) {
    for (const grapheme of splitGraphemes(segment.text)) {
      const graphemeWidth = Math.max(1, stringWidth(grapheme));
      if (currentWidth > 0 && currentWidth + graphemeWidth > maxWidth) {
        flushCurrentLine();
      }

      const previous = currentSegments[currentSegments.length - 1];
      if (
        previous
        && previous.color === segment.color
        && previous.backgroundColor === segment.backgroundColor
      ) {
        previous.text += grapheme;
      } else {
        currentSegments.push({
          text: grapheme,
          color: segment.color,
          backgroundColor: segment.backgroundColor,
        });
      }
      currentWidth += graphemeWidth;
    }
  }

  if (currentSegments.length > 0 || wrappedLines.length === 0) {
    flushCurrentLine();
  }

  return wrappedLines;
}

function expandRenderLinesForWidth(lines: RenderLine[], maxWidth: number): RenderLine[] {
  return lines.flatMap((line) => {
    if (line.fillChar && !line.segments) {
      return [{
        kind: line.kind,
        text: line.fillChar.repeat(Math.max(1, maxWidth)),
        segments: [{
          text: line.fillChar.repeat(Math.max(1, maxWidth)),
          color: line.fillColor ?? colorForRenderLine(line.kind),
        }],
      }];
    }
    if (line.segments) {
      const wrappedLines = wrapSegmentedLine(line, maxWidth);
      if (!line.fillChar) {
        return wrappedLines;
      }
      return wrappedLines.map((wrappedLine) => {
        const textWidth = stringWidth(wrappedLine.text);
        const fillWidth = Math.max(0, maxWidth - textWidth);
        if (fillWidth === 0) {
          return wrappedLine;
        }
        return {
          ...wrappedLine,
          text: `${wrappedLine.text}${line.fillChar!.repeat(fillWidth)}`,
          segments: [
            ...(wrappedLine.segments ?? [{ text: wrappedLine.text, color: colorForRenderLine(wrappedLine.kind) }]),
            {
              text: line.fillChar!.repeat(fillWidth),
              color: line.fillColor ?? colorForRenderLine(wrappedLine.kind),
            },
          ],
        };
      });
    }
    return wrapRenderText(line.text, maxWidth).map((segment) => ({
      kind: line.kind,
      text: segment,
    }));
  });
}

function renderMessagePrefix(kind: SurfaceMessage["kind"]): { label: string; color?: string } {
  switch (kind) {
    case "user":
      return { label: "[USR]", color: TUI_THEME.mint };
    case "assistant":
      return { label: "[SYS]", color: TUI_THEME.text };
    case "status":
      return { label: "[RUN]", color: TUI_THEME.mintSoft };
    case "notice":
      return { label: "", color: TUI_THEME.text };
    case "tool_use":
      return { label: "[USE]", color: TUI_THEME.yellow };
    case "tool_result":
      return { label: "[RES]", color: TUI_THEME.yellow };
    case "error":
      return { label: "[ERR]", color: TUI_THEME.red };
    default:
      return { label: "[LOG]", color: TUI_THEME.textMuted };
  }
}

function createMessagePrefix(kind: SurfaceMessage["kind"]): string {
  return renderMessagePrefix(kind).label;
}

function renderMarkdownSegments(line: string, baseColor: string): Array<{ text: string; color?: string }> {
  if (line.length === 0) {
    return [{ text: " ", color: baseColor }];
  }

  const headingMatch = line.match(/^(#{1,6}\s+)(.*)$/u);
  if (headingMatch) {
    const [, hashes, content] = headingMatch;
    return [
      { text: hashes, color: TUI_THEME.textMuted },
      { text: content, color: TUI_THEME.violet },
    ];
  }

  const segments: Array<{ text: string; color?: string }> = [];
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`)/gu;
  let lastIndex = 0;

  for (const match of line.matchAll(pattern)) {
    const token = match[0];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      segments.push({
        text: line.slice(lastIndex, index),
        color: baseColor,
      });
    }

    if (token.startsWith("**") || token.startsWith("__")) {
      segments.push({
        text: token.slice(2, -2),
        color: TUI_THEME.violet,
      });
    } else if (token.startsWith("`")) {
      segments.push({
        text: token.slice(1, -1),
        color: TUI_THEME.violet,
      });
    }

    lastIndex = index + token.length;
  }

  if (lastIndex < line.length) {
    segments.push({
      text: line.slice(lastIndex),
      color: baseColor,
    });
  }

  return segments.length > 0
    ? segments
    : [{ text: line, color: baseColor }];
}

function renderQuestionReceiptLines(payload: QuestionReceiptPayload): RenderLine[] {
  return [
    {
      kind: "detail",
      text: `Questions ${payload.answeredCount}/${payload.totalCount} answered`,
      segments: [
        {
          text: `Questions ${payload.answeredCount}/${payload.totalCount} answered`,
          color: "greenBright",
        },
      ],
    },
    ...payload.entries.flatMap((entry) => ([
      {
        kind: "detail" as const,
        text: `    • ${entry.prompt}`,
        segments: [
          { text: "    • ", color: TUI_THEME.textMuted },
          { text: entry.prompt, color: TUI_THEME.violet },
        ],
      },
      {
        kind: "detail" as const,
        text: `          answer: ${entry.answer}`,
        segments: [
          { text: "          ", color: TUI_THEME.text },
          { text: "answer:", color: TUI_THEME.mintSoft },
          { text: ` ${entry.answer}`, color: TUI_THEME.text },
        ],
      },
      ...(entry.note
        ? [{
            kind: "detail" as const,
            text: `          note: ${entry.note}`,
            segments: [
              { text: "          ", color: TUI_THEME.text },
              { text: "note:", color: TUI_THEME.mintSoft },
              { text: ` ${entry.note}`, color: TUI_THEME.text },
            ],
          }]
        : []),
    ])),
  ];
}

function flattenTranscript(messages: SurfaceMessage[], toolSummaryAnimationFrame = 0): RenderLine[] {
  return flattenTranscriptBlocks(messages, toolSummaryAnimationFrame).flatMap((block) => block.lines);
}

function toolSummaryTitleColor(familyKey: unknown): string {
  if (typeof familyKey !== "string") {
    return TUI_THEME.violet;
  }
  switch (familyKey.trim().toLowerCase()) {
    case "websearch":
      return TUI_THEME.violet;
    case "viewing_picture":
      return TUI_THEME.violet;
    case "code":
      return TUI_THEME.cyan;
    case "docs":
      return TUI_THEME.yellow;
    case "git":
      return TUI_THEME.mintSoft;
    case "mp":
      return TUI_THEME.text;
    case "mcp":
      return TUI_THEME.mintSoft;
    case "skill":
      return TUI_THEME.violet;
    case "useract":
      return TUI_THEME.red;
    case "workflow":
      return TUI_THEME.textMuted;
    case "shell":
      return TUI_THEME.yellow;
    case "browser":
      return TUI_THEME.cyan;
    case "repo":
      return TUI_THEME.mintSoft;
    default:
      return TUI_THEME.violet;
  }
}

function flattenTranscriptBlocks(messages: SurfaceMessage[], toolSummaryAnimationFrame = 0): RenderBlock[] {
  const blocks: RenderBlock[] = [];
  for (const message of messages) {
    const displayMessage = summarizeNonPrimaryMessage(message);
    const chunks = displayMessage.text.split("\n");
    const lines: RenderLine[] = [];
    const isTurnStats = displayMessage.kind === "status" && displayMessage.metadata?.source === "turn_stats";
    const isToolSummary = displayMessage.kind === "status" && displayMessage.metadata?.source === "tool_summary";
    const isQuestionReceipt = displayMessage.metadata?.source === "question_receipt";
    const toolSummaryActive = displayMessage.metadata?.summaryState === "active";
    const toolSummaryColor = toolSummaryTitleColor(displayMessage.metadata?.familyKey);

    if (displayMessage.kind === "assistant" || displayMessage.kind === "user") {
      const prefix = displayMessage.kind === "user" ? ">> " : "● ";
      const indent = displayMessage.kind === "user" ? "   " : "  ";
      const baseColor = TUI_THEME.text;
      const userBackground = displayMessage.kind === "user" ? TUI_THEME.surface : undefined;
      const continuationSegments = [
        {
          text: indent,
          color: displayMessage.kind === "assistant" ? TUI_THEME.textMuted : TUI_THEME.text,
          backgroundColor: userBackground,
        },
      ];

      chunks.forEach((chunk, index) => {
        const visibleText = chunk.length > 0 ? chunk : " ";
        lines.push({
          kind: displayMessage.kind,
          text: `${index === 0 ? prefix : indent}${visibleText}`,
          continuationSegments,
          segments: [
            {
              text: index === 0 ? prefix : indent,
              color: displayMessage.kind === "assistant" ? TUI_THEME.textMuted : TUI_THEME.mint,
              backgroundColor: userBackground,
            },
            ...renderMarkdownSegments(visibleText, baseColor).map((segment) => ({
              ...segment,
              backgroundColor: userBackground,
            })),
          ],
        });
      });
    } else if (isTurnStats) {
      chunks.forEach((chunk) => {
        lines.push({
          kind: "detail",
          text: `─ ${chunk} `,
          fillChar: "─",
          fillColor: TUI_THEME.textMuted,
          segments: [
            { text: "─ ", color: TUI_THEME.textMuted },
            { text: chunk, color: TUI_THEME.textMuted },
            { text: " ", color: TUI_THEME.textMuted },
          ],
        });
      });
    } else if (isToolSummary) {
      const intentLineCountRaw = displayMessage.metadata?.intentLineCount;
      const intentLineCount = typeof intentLineCountRaw === "number" && Number.isFinite(intentLineCountRaw)
        ? Math.max(0, Math.floor(intentLineCountRaw))
        : 0;
      chunks.forEach((chunk, index) => {
        if (index === 0) {
          const toolSummaryDotColor = toolSummaryActive
            ? (Math.floor(toolSummaryAnimationFrame / 3) % 2 === 0 ? TUI_THEME.textMuted : toolSummaryColor)
            : TUI_THEME.textMuted;
          lines.push({
            kind: "detail",
            text: `● ${chunk}`,
            segments: [
              { text: "● ", color: toolSummaryDotColor },
              { text: chunk, color: toolSummaryColor },
            ],
          });
          return;
        }
        const isIntentLine = index <= intentLineCount;
        const prefix = isIntentLine ? "  · " : "  └ ";
        const detailSegments = toolSummaryActive && index === 1
          ? buildShimmerSegments(chunk, toolSummaryAnimationFrame)
          : [{ text: chunk, color: TUI_THEME.text }];
        lines.push({
          kind: "detail",
          text: `${prefix}${chunk}`,
          segments: [
            { text: prefix, color: TUI_THEME.textMuted },
            ...detailSegments,
          ],
        });
      });
    } else if (isQuestionReceipt) {
      const payloadRecord = displayMessage.metadata?.receipt;
      const payload = payloadRecord && typeof payloadRecord === "object"
        ? payloadRecord as QuestionReceiptPayload
        : null;
      if (payload) {
        lines.push(...renderQuestionReceiptLines(payload));
      } else {
        chunks.forEach((chunk) => {
          lines.push({
            kind: "detail",
            text: chunk,
            segments: [{ text: chunk, color: TUI_THEME.text }],
          });
        });
      }
    } else {
      chunks.forEach((chunk, index) => {
        const prefix = index === 0
          ? createMessagePrefix(displayMessage.kind)
          : "      ";
        lines.push({
          kind: displayMessage.kind,
          text: `${prefix ? `${prefix} ` : ""}${chunk}`,
        });
      });
    }

    lines.push({
      kind: "detail",
      text: "",
    });
    blocks.push({
      key: message.messageId,
      lines,
    });
  }
  return blocks;
}


function colorForRenderLine(kind: RenderLine["kind"]): string | undefined {
  switch (kind) {
    case "user":
      return TUI_THEME.mint;
    case "assistant":
      return TUI_THEME.text;
    case "status":
      return TUI_THEME.mintSoft;
    case "notice":
      return TUI_THEME.text;
    case "tool_use":
    case "tool_result":
      return TUI_THEME.yellow;
    case "error":
      return TUI_THEME.red;
    case "detail":
      return TUI_THEME.text;
    default:
      return TUI_THEME.textMuted;
  }
}

function createTurnId(turnIndex?: number): string {
  return `turn-${turnIndex ?? 0}`;
}

function buildRewindComposerPrefix(animationTick: number): string {
  const frameIndex = (Math.floor(animationTick / REWIND_SPINNER_FRAME_STEP) + 1) % REWIND_SPINNER_FRAMES.length;
  return `${REWIND_SPINNER_FRAMES[frameIndex] ?? REWIND_SPINNER_FRAMES[0]} rewinding... `;
}

function isInterruptibleForegroundTask(task: {
  turnId?: string;
  foregroundable?: boolean;
}): boolean {
  if (task.foregroundable === false) {
    return false;
  }
  if (typeof task.turnId !== "string" || task.turnId.length === 0) {
    return false;
  }
  return parseDirectTuiTurnIndex(task.turnId) > 0;
}

function shouldConsumeRecordAfterTurnCompletion(record: LiveLogRecord): boolean {
  switch (record.event) {
    case "assistant_delta":
    case "stage_end":
    case "turn_result":
    case "stream_text":
    case "panel_snapshot":
    case "rewind_applied":
    case "rewind_failed":
      return true;
    default:
      return false;
  }
}

function shouldConsumeRecordAfterTurnInterrupt(record: LiveLogRecord): boolean {
  switch (record.event) {
    case "panel_snapshot":
    case "rewind_applied":
    case "rewind_failed":
      return true;
    default:
      return false;
  }
}

function createTaskId(record: LiveLogRecord): string {
  return `${record.stage ?? record.label ?? "stage"}:${record.turnIndex ?? 0}:${record.capabilityKey ?? "none"}`;
}

function formatStageStatus(record: LiveLogRecord, phase: "start" | "end"): string {
  const label = record.capabilityKey ?? record.label ?? record.stage ?? "stage";
  if (phase === "start") {
    return `${label} · running`;
  }
  if (record.status === "failed") {
    return `${label} · failed`;
  }
  return `${label} · ${record.status ?? "done"}`;
}

function formatCapabilitySummaryTitle(capabilityKey: string, status: string): string {
  const family = capabilityFamilySpec(capabilityKey);
  if (family) {
    return `${family.title} ${status === "failed" ? "Failed" : "Success"}`;
  }
  const normalized = capabilityKey.toLowerCase();
  if (normalized === "search.web" || normalized === "search.ground") {
    return `WebSearch ${status === "failed" ? "Failed" : "Success"}`;
  }
  const base = capabilityKey
    .split(".")
    .map((part) => part.length > 0 ? `${part.slice(0, 1).toUpperCase()}${part.slice(1)}` : part)
    .join("");
  return `${base} ${status === "failed" ? "Failed" : "Success"}`;
}

function capabilityFamilyKey(capabilityKey?: string | null): string | null {
  return resolveCapabilityFamilyDefinition(capabilityKey)?.familyKey ?? null;
}

function capabilityFamilySpec(capabilityKey?: string | null): { key: string; title: string } | null {
  const family = resolveCapabilityFamilyDefinition(capabilityKey);
  if (!family) {
    return null;
  }
  return {
    key: family.familyKey,
    title: family.familyTitle,
  };
}

function pickFirstSentence(text: string): string {
  const compacted = compactRuntimeText(text);
  const match = compacted.match(/^(.+?[。！？.!?])(?:\s|$)/u);
  if (match?.[1]) {
    return match[1].trim();
  }
  return compacted;
}

function summarizeWebSearchFailure(error: unknown, capabilityKey?: string | null): string[] {
  const lines: string[] = [];
  const normalized = capabilityKey?.trim().toLowerCase();
  if (normalized === "search.ground") {
    lines.push("ground search did not complete");
  } else if (normalized === "search.web") {
    lines.push("web search did not complete");
  }
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) {
      lines.push(compactRuntimeText(record.message));
    }
    if (record.details && typeof record.details === "object") {
      const detailRecord = record.details as Record<string, unknown>;
      if (typeof detailRecord.code === "string" && detailRecord.code.trim()) {
        lines.push(`reason: ${detailRecord.code}`);
      }
    }
    if (typeof record.code === "string" && record.code.trim()) {
      lines.push(`code: ${record.code}`);
    }
  } else if (typeof error === "string" && error.trim()) {
    lines.push(compactRuntimeText(error));
  }
  return [...new Set(lines.filter((line) => line.trim().length > 0))].slice(0, 3);
}

function summarizeWebSearchSuccess(output: unknown, hadPreviousFailure: boolean): string[] {
  const lines: string[] = [];
  if (hadPreviousFailure) {
    lines.push("fallback recovered with a second web search pass");
  }
  if (output && typeof output === "object") {
    const record = output as Record<string, unknown>;
    const resolvedBackend = typeof record.resolvedBackend === "string" && record.resolvedBackend.trim()
      ? compactRuntimeText(record.resolvedBackend)
      : undefined;
    const selectedBackend = typeof record.selectedBackend === "string" && record.selectedBackend.trim()
      ? compactRuntimeText(record.selectedBackend)
      : undefined;
    if (resolvedBackend || selectedBackend) {
      lines.push(`backend: ${resolvedBackend ?? selectedBackend}`);
    } else {
      lines.push("returned a grounded answer");
    }
    const resultCollections = [record.results, record.sources];
    for (const collection of resultCollections) {
      if (!Array.isArray(collection)) {
        continue;
      }
      for (const item of collection) {
        if (lines.length >= 3) {
          break;
        }
        if (!item || typeof item !== "object") {
          continue;
        }
        const title = (item as Record<string, unknown>).title;
        if (typeof title === "string" && title.trim()) {
          lines.push(`source: ${compactRuntimeText(title)}`);
        }
      }
    }
  }
  return [...new Set(lines.filter((line) => line.trim().length > 0))].slice(0, 3);
}

function summarizeCapabilitySummary(params: {
  capabilityKey?: string | null;
  status?: string | null;
  output: unknown;
  error: unknown;
  hadPreviousFailure: boolean;
}): { title: string; detailLines: string[] } {
  const normalized = params.capabilityKey?.trim().toLowerCase();
  if (normalized === "search.web" || normalized === "search.ground") {
    return params.status === "failed"
      ? {
        title: "WebSearch Failed",
        detailLines: summarizeWebSearchFailure(params.error, params.capabilityKey),
      }
      : {
        title: "WebSearch Success",
        detailLines: summarizeWebSearchSuccess(params.output, params.hadPreviousFailure),
      };
  }
  const detailLines = summarizeCapabilityOutputLines(params.output, params.error);
  return {
    title: formatCapabilitySummaryTitle(params.capabilityKey ?? "Capability", params.status ?? "completed"),
    detailLines: detailLines.length > 0 ? detailLines : ["result recorded"],
  };
}

function resolveWebSearchActionPhrase(capabilityKey?: string | null): string {
  return capabilityKey?.trim().toLowerCase() === "search.fetch"
    ? "Fetching and extracting"
    : "Searching and grounding";
}

function formatWebSearchIntentLine(inputSummary?: string | null, capabilityKey?: string | null): string {
  const cleaned = compactRuntimeText(inputSummary ?? "");
  const action = resolveWebSearchActionPhrase(capabilityKey);
  if (!cleaned) {
    return capabilityKey?.trim().toLowerCase() === "search.fetch"
      ? `${action} the requested page`
      : `${action} the requested topic`;
  }
  const normalized = cleaned.replace(/^["'`]+|["'`]+$/gu, "");
  return `${action} ${normalized}`;
}

function resolveWebSearchIntentLine(record: LiveLogRecord): string {
  if (typeof record.familyIntentSummary === "string" && record.familyIntentSummary.trim()) {
    return compactRuntimeText(record.familyIntentSummary);
  }
  return formatWebSearchIntentLine(record.inputSummary, record.capabilityKey);
}

function resolveWebSearchBlockTitle(input: {
  familyTitle?: string | null;
  familyOutcomeKind?: LiveLogRecord["familyOutcomeKind"];
  status?: string | null;
  hadFailure: boolean;
}): string {
  const baseTitle = typeof input.familyTitle === "string" && input.familyTitle.trim()
    ? compactRuntimeText(input.familyTitle)
    : "WebSearch";
  const statusLabel = resolveFamilyStatusLabel(input.familyOutcomeKind, input.status);
  if (input.hadFailure || statusLabel) {
    if (statusLabel && new RegExp(`${statusLabel}$`, "iu").test(baseTitle)) {
      return baseTitle;
    }
    return `${baseTitle} ${statusLabel ?? "failed"}`;
  }
  return baseTitle;
}

function resolveFamilyStatusLabel(
  outcomeKind?: LiveLogRecord["familyOutcomeKind"],
  status?: string | null,
): string | null {
  if (outcomeKind === "failed") {
    return "failed";
  }
  if (outcomeKind === "blocked") {
    return "blocked";
  }
  if (outcomeKind === "timed_out") {
    return "timed out";
  }
  if (outcomeKind === "partial") {
    return "partial";
  }
  const normalized = status?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized === "failed") {
    return "failed";
  }
  if (normalized === "blocked") {
    return "blocked";
  }
  if (normalized === "timeout") {
    return "timed out";
  }
  return null;
}

function resolveFamilyBlockTitle(input: {
  familyTitle?: string | null;
  familyKey?: string | null;
  capabilityKey?: string | null;
  familyOutcomeKind?: LiveLogRecord["familyOutcomeKind"];
  status?: string | null;
  hadFailure: boolean;
}): string {
  if ((input.familyKey ?? "").trim().toLowerCase() === "websearch") {
    return resolveWebSearchBlockTitle({
      familyTitle: input.familyTitle,
      familyOutcomeKind: input.familyOutcomeKind,
      status: input.status,
      hadFailure: input.hadFailure,
    });
  }
  const fallbackTitle = input.capabilityKey
    ? (capabilityFamilySpec(input.capabilityKey)?.title ?? compactRuntimeText(input.capabilityKey))
    : "Capability";
  const baseTitle = typeof input.familyTitle === "string" && input.familyTitle.trim()
    ? compactRuntimeText(input.familyTitle)
    : fallbackTitle;
  const statusLabel = resolveFamilyStatusLabel(input.familyOutcomeKind, input.status);
  if (input.hadFailure || statusLabel) {
    if (statusLabel && new RegExp(`${statusLabel}$`, "iu").test(baseTitle)) {
      return baseTitle;
    }
    return `${baseTitle} ${statusLabel ?? "failed"}`;
  }
  return baseTitle;
}

function formatWebSearchOutcomeLine(
  inputSummary: string | null | undefined,
  status?: string | null,
  capabilityKey?: string | null,
): string {
  const action = resolveWebSearchActionPhrase(capabilityKey);
  const base = formatWebSearchIntentLine(inputSummary, capabilityKey).replace(new RegExp(`^${action} `, "u"), "");
  if (status === "failed") {
    return `${action} ${base} failed`;
  }
  if (status === "success" || status === "completed") {
    return `${action} ${base} succeeded`;
  }
  return `${action} ${base}`;
}

function resolveWebSearchResultLines(record: LiveLogRecord): string[] {
  if (Array.isArray(record.familyResultSummary)) {
    const normalized = record.familyResultSummary
      .filter((line): line is string => typeof line === "string" && line.trim().length > 0)
      .map((line) => compactRuntimeText(line));
    if (normalized.length > 0) {
      return normalized.slice(0, 3);
    }
  }
  return [formatWebSearchOutcomeLine(record.inputSummary, record.status, record.capabilityKey)];
}

function resolveGenericFamilyIntentLine(record: LiveLogRecord): string | null {
  if (typeof record.familyIntentSummary === "string" && record.familyIntentSummary.trim()) {
    return compactRuntimeText(record.familyIntentSummary);
  }
  if (typeof record.inputSummary === "string" && record.inputSummary.trim()) {
    return compactRuntimeText(record.inputSummary);
  }
  if (typeof record.reason === "string" && record.reason.trim()) {
    return compactRuntimeText(record.reason);
  }
  return null;
}

function resolveGenericFamilyResultLines(record: LiveLogRecord): string[] {
  if (Array.isArray(record.familyResultSummary)) {
    const normalized = record.familyResultSummary
      .filter((line): line is string => typeof line === "string" && line.trim().length > 0)
      .map((line) => compactRuntimeText(line));
    if (normalized.length > 0) {
      return normalized.slice(0, 3);
    }
  }
  const fallback = summarizeCapabilitySummary({
    capabilityKey: record.capabilityKey,
    status: record.status,
    output: record.output,
    error: record.error,
    hadPreviousFailure: record.status === "failed",
  });
  return fallback.detailLines.slice(0, 3);
}

function isBoilerplateFamilySummaryLine(record: LiveLogRecord, line: string): boolean {
  const intent = typeof record.familyIntentSummary === "string" ? compactRuntimeText(record.familyIntentSummary) : "";
  if (!intent) {
    return false;
  }
  const normalizedLine = compactRuntimeText(line).toLowerCase();
  const normalizedIntent = intent.toLowerCase();
  const suffixes = [
    "succeeded",
    "failed",
    "blocked",
    "timed out",
    "partial",
  ];
  return suffixes.some((suffix) => normalizedLine === `${normalizedIntent} ${suffix}`);
}

function compactGenericFamilyResultLines(record: LiveLogRecord, resultLines: string[], metadataLines: string[]): string[] {
  const familyKey = typeof record.familyKey === "string" ? record.familyKey.trim().toLowerCase() : "";
  const secondBatchFamily = familyKey === "code"
    || familyKey === "docs"
    || familyKey === "git";
  const thirdBatchFamily = familyKey === "mp"
    || familyKey === "mcp"
    || familyKey === "skill"
    || familyKey === "useract"
    || familyKey === "workflow";
  const fourthBatchFamily = familyKey === "shell"
    || familyKey === "browser"
    || familyKey === "repo";
  if (!secondBatchFamily && !thirdBatchFamily && !fourthBatchFamily) {
    return [...resultLines, ...metadataLines];
  }

  const outcomeKind = record.familyOutcomeKind ?? resolveFamilyOutcomeKind(record.status);
  const hasReasonLine = metadataLines.some((line) => /^Reason:/u.test(line));
  const hasConcreteResultLine = resultLines.some((line) => !isBoilerplateFamilySummaryLine(record, line));
  const shouldDropBoilerplate =
    ((outcomeKind === "succeeded" || outcomeKind === "partial") && (metadataLines.length > 0 || hasConcreteResultLine))
    || ((outcomeKind === "failed" || outcomeKind === "blocked" || outcomeKind === "timed_out") && (hasReasonLine || metadataLines.length > 0));

  const compactedResultLines = shouldDropBoilerplate
    ? resultLines.filter((line) => !isBoilerplateFamilySummaryLine(record, line))
    : resultLines;

  return [...compactedResultLines, ...metadataLines];
}

function resolveWebSearchMetadataLines(record: LiveLogRecord): string[] {
  const metadata = record.resultMetadata;
  if (!metadata || typeof metadata !== "object") {
    return [];
  }

  const lines: string[] = [];
  const sourceTitles = Array.isArray(metadata.sourceTitles)
    ? metadata.sourceTitles
      .filter((title): title is string => typeof title === "string" && title.trim().length > 0)
      .map((title) => compactRuntimeText(title))
      .slice(0, 3)
    : [];

  if (sourceTitles.length === 1) {
    lines.push(`Source: ${sourceTitles[0]}`);
  } else if (sourceTitles.length > 1) {
    lines.push(`Sources: ${sourceTitles.join(", ")}`);
  } else if (typeof metadata.sourceCount === "number" && metadata.sourceCount > 0) {
    lines.push(`Sources: ${metadata.sourceCount}`);
  }

  if (metadata.fallbackApplied && typeof metadata.resolvedBackend === "string" && metadata.resolvedBackend.trim()) {
    lines.push(`Recovered via ${compactRuntimeText(metadata.resolvedBackend)}`);
  } else if (
    typeof metadata.resolvedBackend === "string"
    && metadata.resolvedBackend.trim()
    && typeof metadata.selectedBackend === "string"
    && metadata.selectedBackend.trim()
    && metadata.resolvedBackend.trim() !== metadata.selectedBackend.trim()
  ) {
    lines.push(`Backend: ${compactRuntimeText(metadata.resolvedBackend)}`);
  }

  const reasonCode = typeof metadata.errorDetailCode === "string" && metadata.errorDetailCode.trim()
    ? metadata.errorDetailCode
    : typeof metadata.errorCode === "string" && metadata.errorCode.trim()
      ? metadata.errorCode
      : undefined;
  if (reasonCode) {
    lines.push(`Reason: ${compactRuntimeText(reasonCode)}`);
  }

  return [...new Set(lines)].slice(0, 3);
}

function resolveGenericFamilyMetadataLines(
  record: LiveLogRecord,
  phase: "start" | "end" = "end",
): string[] {
  const metadata = record.resultMetadata;
  if (!metadata || typeof metadata !== "object") {
    return [];
  }
  const familyKey = typeof record.familyKey === "string" ? record.familyKey.trim().toLowerCase() : "";
  const resultSummaryText = Array.isArray(record.familyResultSummary)
    ? record.familyResultSummary.join(" ").toLowerCase()
    : "";
  const lines: string[] = [];
  const metadataRecord = metadata as Record<string, unknown>;
  const targetRefs = Array.isArray(metadataRecord.targetRefs)
    ? (metadataRecord.targetRefs as unknown[])
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      .map((entry) => compactRuntimeText(entry))
      .slice(0, 3)
    : [];
  const targetPaths = Array.isArray(metadataRecord.targetPaths)
    ? (metadataRecord.targetPaths as unknown[])
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      .map((entry) => compactRuntimeText(entry))
      .filter((entry) => entry !== "." && entry !== "./")
      .slice(0, 3)
    : [];
  const hasPathSummary = targetPaths.length > 0;
  const hasRefSummary = targetRefs.length > 0;
  const branchName = typeof metadataRecord.branchName === "string"
    ? compactRuntimeText(metadataRecord.branchName as string)
    : undefined;
  const targetName = typeof metadataRecord.targetName === "string"
    ? compactRuntimeText(metadataRecord.targetName as string)
    : undefined;
  const targetUrl = typeof metadataRecord.targetUrl === "string"
    ? compactRuntimeText(metadataRecord.targetUrl as string)
    : undefined;
  const sourceKind = typeof metadataRecord.sourceKind === "string"
    ? compactRuntimeText(metadataRecord.sourceKind as string)
    : undefined;
  const mimeType = typeof metadataRecord.mimeType === "string"
    ? compactRuntimeText(metadataRecord.mimeType as string)
    : undefined;
  const toolName = typeof metadataRecord.toolName === "string"
    ? compactRuntimeText(metadataRecord.toolName as string)
    : undefined;
  const resourceUri = typeof metadataRecord.resourceUri === "string"
    ? compactRuntimeText(metadataRecord.resourceUri as string)
    : undefined;
  const skillName = typeof metadataRecord.skillName === "string"
    ? compactRuntimeText(metadataRecord.skillName as string)
    : undefined;
  const requestKind = typeof metadataRecord.requestKind === "string"
    ? compactRuntimeText(metadataRecord.requestKind as string)
    : undefined;
  const trackerId = typeof metadataRecord.trackerId === "string"
    ? compactRuntimeText(metadataRecord.trackerId as string)
    : undefined;
  const errorCode = typeof metadataRecord.errorCode === "string"
    ? compactRuntimeText(metadataRecord.errorCode as string)
    : undefined;
  const errorRecord = record.error && typeof record.error === "object"
    ? record.error as Record<string, unknown>
    : undefined;
  const errorMessage = typeof errorRecord?.message === "string" && errorRecord.message.trim().length > 0
    ? compactRuntimeText(errorRecord.message)
    : undefined;
  const commitHash = typeof metadataRecord.commitHash === "string"
    ? compactRuntimeText(metadataRecord.commitHash as string)
    : undefined;
  const outcomeKind = record.familyOutcomeKind ?? resolveFamilyOutcomeKind(record.status);
  const failureLikeOutcome = outcomeKind === "failed"
    || outcomeKind === "blocked"
    || outcomeKind === "timed_out";

  const pushPathSummary = () => {
    if (targetPaths.length === 1) {
      lines.push(`Path: ${targetPaths[0]}`);
    } else if (targetPaths.length > 1) {
      lines.push(`Paths: ${targetPaths.join(", ")}`);
    }
  };

  const pushRefSummary = () => {
    if (targetRefs.length === 1) {
      lines.push(`Ref: ${targetRefs[0]}`);
    } else if (targetRefs.length > 1) {
      lines.push(`Refs: ${targetRefs.join(", ")}`);
    }
  };

  if (phase === "start") {
    switch (familyKey) {
      case "viewing_picture":
        if (targetUrl) {
          lines.push(`URL: ${targetUrl}`);
        } else {
          pushPathSummary();
        }
        break;
      case "mp":
        pushRefSummary();
        break;
      case "mcp":
        if (targetName) {
          lines.push(`Target: ${targetName}`);
        }
        if (toolName) {
          lines.push(`Tool: ${toolName}`);
        }
        if (resourceUri) {
          lines.push(`Resource: ${resourceUri}`);
        }
        break;
      case "skill":
        if (skillName) {
          lines.push(`Skill: ${skillName}`);
        }
        break;
      case "useract":
        if (requestKind) {
          lines.push(`Request: ${requestKind}`);
        }
        break;
      case "workflow":
        if (trackerId) {
          lines.push(`Tracker: ${trackerId.slice(0, 12)}`);
        }
        break;
      case "git":
        if (branchName) {
          lines.push(`Branch: ${branchName}`);
        }
        break;
      default:
        pushPathSummary();
        pushRefSummary();
        if (targetName) {
          lines.push(`Target: ${targetName}`);
        }
        break;
    }
    if (errorCode) {
      lines.push(`Reason: ${errorCode}`);
    }
    return [...new Set(lines)].slice(0, 3);
  }

  const countFields: Array<[string, string]> = familyKey === "code"
    ? [
      ["matchCount", "Matches"],
      ["symbolCount", "Symbols"],
      ["changedFileCount", "Files changed"],
      ["pathCount", "Paths"],
    ]
      : familyKey === "docs"
      ? [
        ["sheetCount", "Sheets"],
        ["pageCount", "Pages"],
        ["paragraphCount", "Paragraphs"],
        ["imageCount", "Images"],
        ["pathCount", "Paths"],
      ]
      : familyKey === "viewing_picture"
        ? [
          ["imageCount", "Images"],
        ]
      : familyKey === "git"
        ? [
          ["aheadCount", "Ahead"],
          ["behindCount", "Behind"],
          ["changedFileCount", "Files changed"],
        ]
        : familyKey === "mp"
          ? [
            ["resultCount", "Results"],
            ["itemCount", "Items"],
          ]
          : familyKey === "mcp"
            ? [
              ["itemCount", "Items"],
            ]
            : familyKey === "skill"
              ? [
                ["outputCount", "Outputs"],
                ["mountCount", "Mounts"],
              ]
              : familyKey === "useract"
                ? [
                  ["durationMs", "DurationMs"],
                  ["itemCount", "Items"],
                ]
                  : familyKey === "workflow"
                    ? [
                      ["todoCount", "Todos"],
                      ["itemCount", "Items"],
                    ]
                  : familyKey === "shell"
                    ? [
                      ["changedFileCount", "Files changed"],
                      ["durationMs", "DurationMs"],
                      ["itemCount", "Items"],
                    ]
                    : familyKey === "browser"
                      ? [
                        ["itemCount", "Items"],
                        ["durationMs", "DurationMs"],
                      ]
                      : familyKey === "repo"
                        ? [
                          ["changedFileCount", "Files changed"],
                          ["itemCount", "Items"],
                        ]
        : [
          ["pathCount", "Paths"],
          ["matchCount", "Matches"],
          ["symbolCount", "Symbols"],
          ["changedFileCount", "Files changed"],
          ["sheetCount", "Sheets"],
          ["pageCount", "Pages"],
          ["paragraphCount", "Paragraphs"],
          ["imageCount", "Images"],
          ["aheadCount", "Ahead"],
          ["behindCount", "Behind"],
          ["itemCount", "Items"],
          ["resultCount", "Results"],
          ["mountCount", "Mounts"],
          ["outputCount", "Outputs"],
          ["durationMs", "DurationMs"],
          ["todoCount", "Todos"],
        ];

  switch (familyKey) {
    case "viewing_picture":
      if (targetUrl) {
        lines.push(`URL: ${targetUrl}`);
      } else {
        pushPathSummary();
      }
      if (sourceKind) {
        lines.push(`Source: ${sourceKind === "remote_url" ? "remote URL" : "local file"}`);
      }
      if (mimeType) {
        lines.push(`Type: ${mimeType}`);
      }
      break;
    case "mp":
      pushRefSummary();
      break;
    case "mcp":
      if (targetName) {
        lines.push(`Target: ${targetName}`);
      }
      if (toolName) {
        lines.push(`Tool: ${toolName}`);
      }
      if (resourceUri) {
        lines.push(`Resource: ${resourceUri}`);
      }
      break;
    case "skill":
      if (skillName) {
        lines.push(`Skill: ${skillName}`);
      }
      break;
    case "useract":
      if (requestKind) {
        lines.push(`Request: ${requestKind}`);
      }
      break;
    case "workflow":
      if (trackerId && !resultSummaryText.includes("tracker")) {
        lines.push(`Tracker: ${trackerId.slice(0, 12)}`);
      }
      break;
    case "shell":
    case "browser":
    case "repo":
      pushPathSummary();
      break;
    case "git":
      if (branchName) {
        lines.push(`Branch: ${branchName}`);
      }
      break;
    default:
      pushPathSummary();
      pushRefSummary();
      break;
  }

  if (failureLikeOutcome && (errorMessage || errorCode)) {
    lines.push(`Reason: ${errorMessage ?? errorCode}`);
  }

  for (const [key, label] of countFields) {
    const value = metadataRecord[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      if (key === "pathCount" && hasPathSummary) {
        continue;
      }
      if (key === "itemCount" && hasRefSummary && familyKey === "mp") {
        continue;
      }
      if (key === "itemCount" && familyKey === "repo") {
        continue;
      }
      if (key === "itemCount" && familyKey === "browser" && resultSummaryText.includes("captured")) {
        continue;
      }
      if (key === "itemCount" && familyKey === "shell" && resultSummaryText.includes("session")) {
        continue;
      }
      if (key === "changedFileCount" && resultSummaryText.includes("file") && resultSummaryText.includes("changed")) {
        continue;
      }
      if (key === "durationMs") {
        const totalSeconds = Math.max(0, Math.floor(value / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        lines.push(minutes > 0 ? `Duration: ${minutes}m ${seconds}s` : `Duration: ${seconds}s`);
        continue;
      }
      lines.push(`${label}: ${value}`);
    }
  }
  if (commitHash && !resultSummaryText.includes("commit")) {
    lines.push(`Commit: ${commitHash.slice(0, 12)}`);
  }
  if (!failureLikeOutcome && (errorMessage || errorCode)) {
    lines.push(`Reason: ${errorMessage ?? errorCode}`);
  }
  return [...new Set(lines)].slice(0, 3);
}

async function maybeRefineWebSearchSummary(input: {
  sessionId: string;
  runId: string;
  title: string;
  intentLines: string[];
  resultLines: string[];
  metadataLines: string[];
}): Promise<{ title: string; lines: string[] } | null> {
  try {
    return await refineWebSearchToolSummary(input);
  } catch {
    return null;
  }
}

function buildCapabilityRunIndicatorLabel(record: LiveLogRecord): string {
  if (record.familyKey === "websearch") {
    return `core tackling ${compactRuntimeText(record.familyTitle ?? "WebSearch")}`;
  }
  if (record.familyTitle && record.familyTitle.trim()) {
    return `core tackling ${compactRuntimeText(record.familyTitle)}`;
  }
  if (record.familyKey && record.familyKey.trim()) {
    return `core tackling ${compactRuntimeText(record.familyKey)}`;
  }
  return `core tackling ${record.capabilityKey ?? "capability"}`;
}

function buildTapPanelSummary(record: LiveLogRecord, phase: "start" | "end"): string {
  const familyTitle = typeof record.familyTitle === "string" && record.familyTitle.trim()
    ? compactRuntimeText(record.familyTitle)
    : undefined;
  const intentSummary = typeof record.familyIntentSummary === "string" && record.familyIntentSummary.trim()
    ? compactRuntimeText(record.familyIntentSummary)
    : undefined;
  const resultSummary = Array.isArray(record.familyResultSummary)
    ? (
      record.familyResultSummary.find((line): line is string =>
        typeof line === "string"
        && line.trim().length > 0
        && !isBoilerplateFamilySummaryLine(record, line),
      )
      ?? record.familyResultSummary.find((line): line is string => typeof line === "string" && line.trim().length > 0)
    )
    : undefined;

  if (phase === "start") {
    if (familyTitle && intentSummary) {
      return `${familyTitle}: ${intentSummary}`;
    }
    if (familyTitle) {
      return `${familyTitle} running`;
    }
  } else {
    if (familyTitle && resultSummary) {
      return `${familyTitle}: ${compactRuntimeText(resultSummary)}`;
    }
    if (familyTitle) {
      const label = resolveFamilyStatusLabel(record.familyOutcomeKind, record.status) ?? (record.status ?? "completed");
      return `${familyTitle}: ${label}`;
    }
  }

  return phase === "start"
    ? (record.capabilityKey ? `capability running: ${record.capabilityKey}` : "capability bridge running")
    : (record.capabilityKey ? `capability done: ${record.capabilityKey}` : "capability bridge completed");
}

function mapCoreTaskStatusToSurfaceTurnStatus(taskStatus?: string | null): "running" | "blocked" | "completed" {
  const normalized = taskStatus?.trim().toLowerCase();
  if (normalized === "blocked" || normalized === "exhausted") {
    return "blocked";
  }
  if (normalized === "completed" || normalized === "incomplete") {
    return "completed";
  }
  return "running";
}

function mapCoreTaskStatusToRunPanelStatus(taskStatus?: string | null): "acting" | "completed" | "paused" {
  const normalized = taskStatus?.trim().toLowerCase();
  if (normalized === "completed" || normalized === "incomplete") {
    return "completed";
  }
  if (normalized === "blocked" || normalized === "exhausted") {
    return "paused";
  }
  return "acting";
}

function summarizeCapabilityOutputLines(output: unknown, error: unknown): string[] {
  if (error) {
    if (typeof error === "string") {
      return [compactRuntimeText(error)];
    }
    if (typeof error === "object" && error !== null) {
      const record = error as Record<string, unknown>;
      const lines: string[] = [];
      if (typeof record.message === "string" && record.message.trim()) {
        lines.push(compactRuntimeText(record.message));
      }
      if (record.details && typeof record.details === "object") {
        const detailRecord = record.details as Record<string, unknown>;
        if (typeof detailRecord.code === "string" && detailRecord.code.trim()) {
          lines.push(`code: ${detailRecord.code}`);
        }
      }
      if (typeof record.code === "string" && record.code.trim()) {
        lines.push(`reason: ${record.code}`);
      }
      return lines.length > 0 ? lines.slice(0, 3) : [compactRuntimeText(JSON.stringify(record))];
    }
    return [compactRuntimeText(String(error))];
  }
  if (typeof output === "string") {
    return [compactRuntimeText(output)];
  }
  if (!output || typeof output !== "object") {
    return [];
  }
  const record = output as Record<string, unknown>;
  const picked: string[] = [];
  const answerValue = record.answer;
  if (typeof answerValue === "string" && answerValue.trim()) {
    picked.push(compactRuntimeText(answerValue));
  } else if (answerValue && typeof answerValue === "object") {
    const answerText = (answerValue as { text?: unknown }).text;
    if (typeof answerText === "string" && answerText.trim()) {
      picked.push(compactRuntimeText(answerText));
    }
  }
  const candidateKeys = ["summary", "answer", "text", "finalUrl", "pageTitle", "selectedBackend", "resolvedBackend", "status"];
  for (const key of candidateKeys) {
    const value = record[key];
    if (key === "answer" && answerValue && typeof answerValue === "object") {
      continue;
    }
    if (typeof value === "string" && value.trim()) {
      picked.push(`${key}: ${compactRuntimeText(value)}`);
    }
  }
  if (Array.isArray(record.items)) {
    for (const item of record.items.slice(0, 3)) {
      if (typeof item === "string" && item.trim()) {
        picked.push(compactRuntimeText(item));
      }
    }
  }
  if (Array.isArray(record.results)) {
    for (const item of record.results.slice(0, 3)) {
      if (typeof item === "string" && item.trim()) {
        picked.push(compactRuntimeText(item));
      } else if (item && typeof item === "object") {
        const title = (item as Record<string, unknown>).title;
        const url = (item as Record<string, unknown>).url;
        if (typeof title === "string" && title.trim()) {
          picked.push(typeof url === "string" && url.trim()
            ? compactRuntimeText(`${title} · ${url}`)
            : compactRuntimeText(title));
        }
      }
    }
  }
  if (Array.isArray(record.sources)) {
    for (const item of record.sources.slice(0, 2)) {
      if (item && typeof item === "object") {
        const title = (item as Record<string, unknown>).title;
        if (typeof title === "string" && title.trim()) {
          picked.push(`source: ${compactRuntimeText(title)}`);
        }
      }
    }
  }
  if (picked.length > 0) {
    return picked.slice(0, 3);
  }
  return [compactRuntimeText(JSON.stringify(record))];
}

function estimateContextUnits(text: string): number {
  return Math.max(0, Math.ceil(text.length / 4));
}

function normalizeContextSnapshot(
  input: LiveContextRecord | null | undefined,
): {
  provider?: string;
  model?: string;
  windowTokens: number;
  windowSource?: string;
  promptKind?: string;
  promptTokens: number;
  transcriptTokens: number;
  maxOutputTokens?: number;
} | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  const windowTokens = typeof input.windowTokens === "number" && Number.isFinite(input.windowTokens)
    ? input.windowTokens
    : undefined;
  const promptTokens = typeof input.promptTokens === "number" && Number.isFinite(input.promptTokens)
    ? input.promptTokens
    : undefined;
  const transcriptTokens = typeof input.transcriptTokens === "number" && Number.isFinite(input.transcriptTokens)
    ? input.transcriptTokens
    : undefined;
  if (!windowTokens || promptTokens === undefined || transcriptTokens === undefined) {
    return null;
  }
  return {
    provider: typeof input.provider === "string" ? input.provider : undefined,
    model: typeof input.model === "string" ? input.model : undefined,
    windowTokens,
    windowSource: typeof input.windowSource === "string" ? input.windowSource : undefined,
    promptKind: typeof input.promptKind === "string" ? input.promptKind : undefined,
    promptTokens,
    transcriptTokens,
    maxOutputTokens: typeof input.maxOutputTokens === "number" && Number.isFinite(input.maxOutputTokens)
      ? input.maxOutputTokens
      : undefined,
  };
}

function normalizeCmpViewerSnapshot(input: unknown): CmpViewerSnapshot | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  const record = input as Record<string, unknown>;
  const summaryLines = Array.isArray(record.summaryLines)
    ? record.summaryLines.filter((line): line is string => typeof line === "string" && line.trim().length > 0)
    : [];
  const entries = Array.isArray(record.entries)
    ? record.entries.flatMap((entry): CmpViewerEntry[] => {
      if (!entry || typeof entry !== "object") {
        return [];
      }
      const item = entry as Record<string, unknown>;
      if (
        typeof item.sectionId !== "string"
        || typeof item.lifecycle !== "string"
        || typeof item.kind !== "string"
        || typeof item.agentId !== "string"
        || typeof item.ref !== "string"
        || typeof item.updatedAt !== "string"
      ) {
        return [];
      }
      return [{
        sectionId: item.sectionId,
        lifecycle: item.lifecycle,
        kind: item.kind,
        agentId: item.agentId,
        ref: item.ref,
        updatedAt: item.updatedAt,
      }];
    })
    : [];
  return {
    summaryLines,
    status: typeof record.status === "string" ? record.status : undefined,
    sourceKind: typeof record.sourceKind === "string" ? record.sourceKind : undefined,
    emptyReason: typeof record.emptyReason === "string" ? record.emptyReason : undefined,
    truthStatus: typeof record.truthStatus === "string" ? record.truthStatus : undefined,
    readbackStatus: typeof record.readbackStatus === "string" ? record.readbackStatus : undefined,
    detailLines: Array.isArray(record.detailLines)
      ? record.detailLines.filter((line): line is string => typeof line === "string" && line.trim().length > 0)
      : undefined,
    roleLines: Array.isArray(record.roleLines)
      ? record.roleLines.filter((line): line is string => typeof line === "string" && line.trim().length > 0)
      : undefined,
    requestLines: Array.isArray(record.requestLines)
      ? record.requestLines.filter((line): line is string => typeof line === "string" && line.trim().length > 0)
      : undefined,
    issueLines: Array.isArray(record.issueLines)
      ? record.issueLines.filter((line): line is string => typeof line === "string" && line.trim().length > 0)
      : undefined,
    entries,
  };
}

function normalizeMpViewerSnapshot(input: unknown): MpViewerSnapshot | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  const record = input as Record<string, unknown>;
  const summaryLines = Array.isArray(record.summaryLines)
    ? record.summaryLines.filter((line): line is string => typeof line === "string" && line.trim().length > 0)
    : [];
  const entries = Array.isArray(record.entries)
    ? record.entries.flatMap((entry): MpViewerEntry[] => {
      if (!entry || typeof entry !== "object") {
        return [];
      }
      const item = entry as Record<string, unknown>;
      if (
        typeof item.memoryId !== "string"
        || typeof item.label !== "string"
        || typeof item.summary !== "string"
      ) {
        return [];
      }
        return [{
          memoryId: item.memoryId,
          label: item.label,
          summary: item.summary,
          agentId: typeof item.agentId === "string" ? item.agentId : undefined,
          scopeLevel: typeof item.scopeLevel === "string" ? item.scopeLevel : undefined,
          updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : undefined,
          bodyRef: typeof item.bodyRef === "string" ? item.bodyRef : undefined,
        }];
      })
    : [];
  return {
    summaryLines,
    status: typeof record.status === "string" ? record.status : undefined,
    sourceKind: typeof record.sourceKind === "string" ? record.sourceKind : undefined,
    emptyReason: typeof record.emptyReason === "string" ? record.emptyReason : undefined,
    sourceClass: typeof record.sourceClass === "string" ? record.sourceClass : undefined,
    rootPath: typeof record.rootPath === "string" ? record.rootPath : undefined,
    recordCount: typeof record.recordCount === "number" && Number.isFinite(record.recordCount)
      ? record.recordCount
      : undefined,
    detailLines: Array.isArray(record.detailLines)
      ? record.detailLines.filter((line): line is string => typeof line === "string" && line.trim().length > 0)
      : undefined,
    roleLines: Array.isArray(record.roleLines)
      ? record.roleLines.filter((line): line is string => typeof line === "string" && line.trim().length > 0)
      : undefined,
    flowLines: Array.isArray(record.flowLines)
      ? record.flowLines.filter((line): line is string => typeof line === "string" && line.trim().length > 0)
      : undefined,
    issueLines: Array.isArray(record.issueLines)
      ? record.issueLines.filter((line): line is string => typeof line === "string" && line.trim().length > 0)
      : undefined,
    entries,
  };
}

function normalizeCapabilityViewerSnapshot(input: unknown): CapabilityViewerSnapshot | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  const record = input as Record<string, unknown>;
  const summaryLines = Array.isArray(record.summaryLines)
    ? record.summaryLines.filter((line): line is string => typeof line === "string" && line.trim().length > 0)
    : [];
  const groups = Array.isArray(record.groups)
    ? record.groups.flatMap((group): CapabilityViewerGroup[] => {
      if (!group || typeof group !== "object") {
        return [];
      }
      const item = group as Record<string, unknown>;
      if (
        typeof item.groupKey !== "string"
        || typeof item.title !== "string"
        || typeof item.count !== "number"
        || !Array.isArray(item.entries)
      ) {
        return [];
      }
      const entries = item.entries.flatMap((entry): CapabilityViewerEntry[] => {
        if (!entry || typeof entry !== "object") {
          return [];
        }
        const capability = entry as Record<string, unknown>;
        if (
          typeof capability.capabilityKey !== "string"
          || typeof capability.description !== "string"
          || typeof capability.bindingState !== "string"
        ) {
          return [];
        }
        return [{
          capabilityKey: capability.capabilityKey,
          description: capability.description,
          bindingState: capability.bindingState,
        }];
      });
      return [{
        groupKey: item.groupKey,
        title: item.title,
        count: item.count,
        entries,
      }];
    })
    : [];
  const pendingHumanGates = Array.isArray(record.pendingHumanGates)
    ? record.pendingHumanGates.flatMap((gate): HumanGatePanelEntry[] => {
      if (!gate || typeof gate !== "object") {
        return [];
      }
      const item = gate as Record<string, unknown>;
      const risk = item.plainLanguageRisk;
      if (
        typeof item.gateId !== "string"
        || typeof item.requestId !== "string"
        || typeof item.capabilityKey !== "string"
        || typeof item.requestedTier !== "string"
        || typeof item.mode !== "string"
        || typeof item.reason !== "string"
        || !risk
        || typeof risk !== "object"
      ) {
        return [];
      }
      const riskRecord = risk as Record<string, unknown>;
      const availableUserActions = Array.isArray(riskRecord.availableUserActions)
        ? riskRecord.availableUserActions.flatMap((action) => {
          if (!action || typeof action !== "object") {
            return [];
          }
          const candidate = action as Record<string, unknown>;
          if (
            typeof candidate.actionId !== "string"
            || typeof candidate.label !== "string"
            || typeof candidate.kind !== "string"
            || !["approve", "deny", "defer", "view_details", "ask_for_safer_alternative"].includes(candidate.kind)
          ) {
            return [];
          }
          return [{
            actionId: candidate.actionId,
            label: candidate.label,
            kind: candidate.kind as "approve" | "deny" | "defer" | "view_details" | "ask_for_safer_alternative",
            description: typeof candidate.description === "string" ? candidate.description : undefined,
            metadata: candidate.metadata && typeof candidate.metadata === "object"
              ? candidate.metadata as Record<string, unknown>
              : undefined,
          }];
        })
        : [];
      if (
        typeof riskRecord.plainLanguageSummary !== "string"
        || typeof riskRecord.requestedAction !== "string"
        || typeof riskRecord.riskLevel !== "string"
        || !["normal", "risky", "dangerous"].includes(riskRecord.riskLevel)
        || typeof riskRecord.whyItIsRisky !== "string"
        || typeof riskRecord.possibleConsequence !== "string"
        || typeof riskRecord.whatHappensIfNotRun !== "string"
      ) {
        return [];
      }
      return [{
        gateId: item.gateId,
        requestId: item.requestId,
        capabilityKey: item.capabilityKey,
        requestedTier: item.requestedTier,
        mode: item.mode,
        reason: item.reason,
        createdAt: typeof item.createdAt === "string" ? item.createdAt : undefined,
        updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : undefined,
        externalPathPrefixes: Array.isArray(item.externalPathPrefixes)
          ? item.externalPathPrefixes.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
          : [],
        plainLanguageRisk: {
          plainLanguageSummary: riskRecord.plainLanguageSummary,
          requestedAction: riskRecord.requestedAction,
          riskLevel: riskRecord.riskLevel as "normal" | "risky" | "dangerous",
          whyItIsRisky: riskRecord.whyItIsRisky,
          possibleConsequence: riskRecord.possibleConsequence,
          whatHappensIfNotRun: riskRecord.whatHappensIfNotRun,
          availableUserActions,
          metadata: riskRecord.metadata && typeof riskRecord.metadata === "object"
            ? riskRecord.metadata as Record<string, unknown>
            : undefined,
        },
      }];
    })
    : [];
  return {
    summaryLines,
    status: typeof record.status === "string" ? record.status : undefined,
    registeredCount: typeof record.registeredCount === "number" && Number.isFinite(record.registeredCount)
      ? record.registeredCount
      : undefined,
    familyCount: typeof record.familyCount === "number" && Number.isFinite(record.familyCount)
      ? record.familyCount
      : undefined,
    blockedCount: typeof record.blockedCount === "number" && Number.isFinite(record.blockedCount)
      ? record.blockedCount
      : undefined,
    pendingHumanGateCount: typeof record.pendingHumanGateCount === "number" && Number.isFinite(record.pendingHumanGateCount)
      ? record.pendingHumanGateCount
      : pendingHumanGates.length,
    pendingHumanGates,
    groups,
  };
}

function normalizeInitViewerSnapshot(input: unknown): InitViewerSnapshot | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  const record = input as Record<string, unknown>;
  return {
    summaryLines: Array.isArray(record.summaryLines)
      ? record.summaryLines.filter((line): line is string => typeof line === "string" && line.trim().length > 0)
      : [],
    status: typeof record.status === "string" ? record.status : undefined,
    sourceKind: typeof record.sourceKind === "string" ? record.sourceKind : undefined,
  };
}

const QUESTION_NONE_OF_ABOVE_LABEL = "None options is what I want.";
const QUESTION_NONE_OF_ABOVE_DESCRIPTION = "I have opinions and insights that differ from the options above.";

function appendQuestionFallbackOption(
  questionId: string,
  options: QuestionViewerOption[],
): QuestionViewerOption[] {
  const fallbackId = `${questionId}::none_of_above`;
  const hasExistingFallback = options.some((option) =>
    option.id === fallbackId
    || option.label === QUESTION_NONE_OF_ABOVE_LABEL,
  );
  if (hasExistingFallback) {
    return options;
  }
  return [
    ...options,
    {
      id: fallbackId,
      label: QUESTION_NONE_OF_ABOVE_LABEL,
      description: QUESTION_NONE_OF_ABOVE_DESCRIPTION,
    },
  ];
}

function normalizeQuestionViewerSnapshot(input: unknown): QuestionViewerSnapshot | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  const record = input as Record<string, unknown>;
  const questions = Array.isArray(record.questions)
    ? record.questions.flatMap((entry): QuestionViewerPrompt[] => {
      if (!entry || typeof entry !== "object") {
        return [];
      }
      const item = entry as Record<string, unknown>;
      const prompt = typeof item.prompt === "string"
        ? item.prompt
        : (typeof item.question === "string" ? item.question : null);
      const questionId = typeof item.id === "string" && item.id.trim().length > 0
        ? item.id
        : null;
      const questionKind = item.kind === "freeform" ? "freeform" : "choice";
      const options = Array.isArray(item.options)
        ? item.options.flatMap((candidate): QuestionViewerOption[] => {
          if (!candidate || typeof candidate !== "object") {
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
      if (!prompt || !questionId) {
        return [];
      }
      if (questionKind === "freeform") {
        return [{
          kind: "freeform",
          id: questionId,
          prompt,
          ...(typeof item.placeholder === "string" ? { placeholder: item.placeholder } : {}),
          allowAnnotation: typeof item.allowAnnotation === "boolean" ? item.allowAnnotation : undefined,
          notePrompt: typeof item.notePrompt === "string" ? item.notePrompt : undefined,
          required: typeof item.required === "boolean" ? item.required : undefined,
        }];
      }
      if (options.length === 0) {
        return [];
      }
      return [{
        id: questionId,
        prompt,
        options: appendQuestionFallbackOption(questionId, options),
        allowAnnotation: typeof item.allowAnnotation === "boolean" ? item.allowAnnotation : undefined,
        notePrompt: typeof item.notePrompt === "string" ? item.notePrompt : undefined,
        required: typeof item.required === "boolean" ? item.required : undefined,
      }];
    })
    : [];
  const rawIndex = typeof record.questionIndex === "number" && Number.isFinite(record.questionIndex)
    ? record.questionIndex
    : (typeof record.activeQuestionIndex === "number" && Number.isFinite(record.activeQuestionIndex)
      ? record.activeQuestionIndex
      : 0);
  return {
    requestId: typeof record.requestId === "string" ? record.requestId : undefined,
    title: typeof record.title === "string" ? record.title : undefined,
    instruction: typeof record.instruction === "string" ? record.instruction : undefined,
    submitLabel: typeof record.submitLabel === "string" ? record.submitLabel : undefined,
    status: typeof record.status === "string" ? record.status : undefined,
    sourceKind: typeof record.sourceKind === "string" ? record.sourceKind : undefined,
    questionIndex: Math.max(0, Math.floor(rawIndex)),
    noteMode: Boolean(record.noteMode),
    noteValue: typeof record.noteValue === "string" ? record.noteValue : "",
    questions,
  };
}

function formatContextWindowLabel(size: number): string {
  if (size >= 1_000_000) {
    return `${(size / 1_000_000).toFixed(2)}M`;
  }
  if (size >= 1_000) {
    return `${(size / 1_000).toFixed(0)}K`;
  }
  return String(size);
}

function renderContextBar(used: number, total: number, width = CONTEXT_BAR_WIDTH): string {
  const ratio = total <= 0 ? 0 : Math.max(0, Math.min(1, used / total));
  const filled = ratio <= 0
    ? 0
    : Math.min(width, Math.floor(ratio * width) + 1);
  return `${"█".repeat(filled)}${"░".repeat(Math.max(0, width - filled))}`;
}

function formatContextUsagePercent(used: number, total: number): string {
  const ratio = total <= 0 ? 0 : Math.max(0, Math.min(1, used / total));
  if (used === 0) {
    return "0%";
  }
  return ratio < 0.01 ? "<1%" : `${Math.round(ratio * 100)}%`;
}

function formatStatusContextUsageLine(used: number, total: number): string {
  const contextBar = renderContextBar(used, total, STATUS_CONTEXT_BAR_WIDTH);
  const percent = formatContextUsagePercent(used, total);
  return `${contextBar} ${percent} as ${formatContextWindowLabel(used)} of ${formatContextWindowLabel(total)} tokens`;
}

function isCreateEntryFieldKey(fieldKey?: string): boolean {
  return fieldKey === "agent:create" || fieldKey === "resume:create";
}

function shouldShowSelectedBodyLineArrow(panelId: DirectSlashPanelId, fieldKey?: string, activeFieldKey?: string): boolean {
  if (!fieldKey || fieldKey !== activeFieldKey) {
    return false;
  }
  return panelId === "agents"
    || panelId === "resume"
    || panelId === "model"
    || panelId === "permissions"
    || panelId === "exit";
}

function withSelectedBodyLineArrow(text: string): string {
  if (text.startsWith("     ")) {
    return `   →   ${text.slice(5)}`;
  }
  return text.startsWith("  ") ? `→ ${text.slice(2)}` : `→ ${text}`;
}

function shouldReplaceSelectedBodyLineArrowInline(panelId: DirectSlashPanelId): boolean {
  return panelId === "permissions";
}

function withCurrentRowMarker(text: string): string {
  return text.startsWith("    ") ? `    • ${text.slice(4)}` : `• ${text}`;
}

function buildShimmerSegments(text: string, frame: number): Array<{ text: string; color?: string }> {
  const activeText = text.trimEnd();
  const activeUnits = splitGraphemes(activeText);
  if (activeUnits.length === 0) {
    return [{ text: "", color: TUI_THEME.text }];
  }
  const highlightIndex = frame % activeUnits.length;
  const shadowIndices = new Set([
    (highlightIndex - 1 + activeUnits.length) % activeUnits.length,
    highlightIndex,
  ]);

  const shimmered = activeUnits.map((unit, index) => ({
    text: unit,
    color: shadowIndices.has(index) ? TUI_THEME.textMuted : TUI_THEME.text,
  }));
  const trailingSpaces = text.slice(activeText.length);
  return trailingSpaces.length > 0
    ? [
      ...shimmered,
      { text: trailingSpaces, color: TUI_THEME.text },
    ]
    : shimmered;
}

function buildRunStatusLine(
  indicator: { startedAt: string; label: string } | null,
  frame: number,
  lineWidth: number,
): RenderLine | null {
  if (!indicator) {
    return null;
  }

  const dotFrame = RUN_STATUS_DOT_FRAMES[frame % RUN_STATUS_DOT_FRAMES.length] ?? "··";
  const runningLabel = "Running";
  const taskText = indicator.label;
  const elapsedText = formatElapsedFromMs(Date.now() - Date.parse(indicator.startedAt));
  const suffixText = ` (${elapsedText} · press esc to interrupt)`;
  const prefixWidth = stringWidth(dotFrame) + 1 + stringWidth(runningLabel) + 1 + stringWidth(suffixText);
  const bodyWidth = Math.max(10, lineWidth - prefixWidth);

  let visibleTaskText = "";
  let visibleTaskWidth = 0;
  for (const unit of splitGraphemes(taskText)) {
    const nextWidth = visibleTaskWidth + Math.max(1, stringWidth(unit));
    if (nextWidth > bodyWidth) {
      break;
    }
    visibleTaskText += unit;
    visibleTaskWidth = nextWidth;
  }
  if (visibleTaskWidth < bodyWidth) {
    visibleTaskText += " ".repeat(bodyWidth - visibleTaskWidth);
  }

  return {
    kind: "detail",
    text: `${dotFrame} ${runningLabel} ${visibleTaskText}${suffixText}`,
    segments: [
      { text: dotFrame, color: TUI_THEME.text },
      { text: " " },
      { text: runningLabel, color: TUI_THEME.mintSoft },
      { text: " " },
      ...buildShimmerSegments(visibleTaskText, frame),
      { text: suffixText, color: TUI_THEME.textMuted },
    ],
  };
}

function applyScrollDelta(current: number, delta: number, max: number): number {
  return Math.max(0, Math.min(max, current + delta));
}

function expandWorkspaceInputPath(input: string, currentCwd: string): string {
  const trimmed = input.trim();
  if (trimmed === "~") {
    return process.env.HOME ?? currentCwd;
  }
  if (trimmed.startsWith("~/")) {
    return resolve(process.env.HOME ?? currentCwd, trimmed.slice(2));
  }
  return resolve(currentCwd, trimmed);
}

function hasSuspiciousPathGlyphs(value: string): boolean {
  return /[\u0000-\u001f\u007f-\u009f\uFFFD]/u.test(value);
}

function isUsableWorkspaceDirectory(value: string): boolean {
  if (!value || hasSuspiciousPathGlyphs(value)) {
    return false;
  }
  try {
    return statSync(value).isDirectory();
  } catch {
    return false;
  }
}

function resolveValidWorkspacePath(value: string | undefined, fallback: string): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      const absoluteCandidate = trimmed.startsWith("~")
        ? expandWorkspaceInputPath(trimmed, fallback)
        : resolve(trimmed);
      if (isUsableWorkspaceDirectory(absoluteCandidate)) {
        return absoluteCandidate;
      }
    }
  }
  return fallback;
}

function parseMouseScrollDelta(inputText: string): number | null {
  // Ink strips the first ESC byte for some unhandled sequences, so mouse
  // reports can arrive as "[<64;..M", "<64;..M", or multiple reports glued
  // together in one chunk. Consume all of them before input handling.
  const matches = [...inputText.matchAll(/(?:\u001B)?\[?<(\d+);\d+;\d+[mM]/gu)];
  if (matches.length === 0) {
    return null;
  }

  let delta = 0;
  for (const match of matches) {
    const code = Number(match[1]);
    if (code === 64) {
      delta += 3;
    } else if (code === 65) {
      delta -= 3;
    }
  }
  return delta;
}

function excerptRewindUserText(value: string, max = 72): string {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, max - 1)}…`;
}

function formatRewindTurnOrdinal(turnIndex: number): string {
  if (!Number.isFinite(turnIndex) || turnIndex < 0) {
    return "???";
  }
  return String(Math.floor(turnIndex)).padStart(3, "0");
}

function shouldSummarizeRewindUserText(value: string, maxWidth = 72): boolean {
  return estimateTerminalWidth(value.replace(/\s+/gu, " ").trim()) > maxWidth;
}

async function buildRewindDisplayUserText(params: {
  sessionId: string;
  turnId: string;
  userText: string;
}): Promise<{
  displayUserText: string;
  displayUserTextSource: "raw" | "mini_summary" | "fallback_excerpt";
}> {
  const normalized = params.userText.replace(/\s+/gu, " ").trim();
  if (!normalized) {
    return {
      displayUserText: "",
      displayUserTextSource: "raw",
    };
  }
  if (!shouldSummarizeRewindUserText(normalized)) {
    return {
      displayUserText: normalized,
      displayUserTextSource: "raw",
    };
  }
  try {
    const summary = await summarizePendingComposerText({
      sessionId: params.sessionId,
      runId: params.turnId,
      text: normalized,
    });
    if (summary && summary.trim()) {
      return {
        displayUserText: summary.trim(),
        displayUserTextSource: "mini_summary",
      };
    }
  } catch {
    // fall through to excerpt
  }
  return {
    displayUserText: excerptRewindUserText(normalized),
    displayUserTextSource: "fallback_excerpt",
  };
}

function sliceOverlayWindow<T>(items: readonly T[], selectedIndex: number, maxItems: number): {
  visibleItems: readonly T[];
  startIndex: number;
} {
  if (items.length <= maxItems) {
    return {
      visibleItems: items,
      startIndex: 0,
    };
  }
  const clampedIndex = Math.max(0, Math.min(selectedIndex, items.length - 1));
  const halfWindow = Math.floor(maxItems / 2);
  const startIndex = Math.max(0, Math.min(clampedIndex - halfWindow, items.length - maxItems));
  return {
    visibleItems: items.slice(startIndex, startIndex + maxItems),
    startIndex,
  };
}

const TranscriptPane = memo(function TranscriptPane({
  visibleLines,
  viewportLineCount,
  transientStatusLine,
}: {
  visibleLines: RenderLine[];
  viewportLineCount: number;
  transientStatusLine: RenderLine | null;
}): JSX.Element {
  const renderedLineCount = visibleLines.length + (transientStatusLine ? 1 : 0);
  const fillerCount = Math.max(0, viewportLineCount - renderedLineCount);

  return (
    <Box flexDirection="column" flexGrow={1} flexShrink={1}>
      <Box flexDirection="column" height={viewportLineCount} flexGrow={1} flexShrink={1}>
        {visibleLines.map((line, index) => (
          <Text key={`body-${index}-${line.text}`} color={colorForRenderLine(line.kind)}>
            {line.segments
              ? line.segments.map((segment, segmentIndex) => (
                <Text
                  key={`body-${index}-${segmentIndex}-${segment.text}`}
                  color={segment.color}
                  backgroundColor={segment.backgroundColor}
                >
                  {segment.text}
                </Text>
              ))
              : line.text}
          </Text>
        ))}
        {transientStatusLine ? (
          <Text key={`transient-status-${transientStatusLine.text}`} color={colorForRenderLine(transientStatusLine.kind)}>
            {transientStatusLine.segments?.map((segment, segmentIndex) => (
              <Text
                key={`transient-status-${segmentIndex}-${segment.text}`}
                color={segment.color}
                backgroundColor={segment.backgroundColor}
              >
                {segment.text}
              </Text>
            ))}
          </Text>
        ) : null}
        {Array.from({ length: fillerCount }, (_, index) => (
          <Text key={`filler-${index}`}> </Text>
        ))}
      </Box>
    </Box>
  );
});

const RewindOverlayPane = memo(function RewindOverlayPane({
  viewportLineCount,
  options,
  selectedTurnIndex,
  modeOptions,
  selectedModeIndex,
  stage,
  notice,
}: {
  viewportLineCount: number;
  options: DirectTuiRewindTurnOption[];
  selectedTurnIndex: number;
  modeOptions: DirectTuiRewindModeOption[];
  selectedModeIndex: number;
  stage: "turn" | "mode";
  notice: SlashPanelNotice | null;
}): JSX.Element {
  const selectedTurn = options[selectedTurnIndex];
  const lines: JSX.Element[] = [];
  lines.push(
    <Text key="rewind:title">
      <Text color={TUI_THEME.violet}>Rewind</Text>
      <Text color={TUI_THEME.textMuted}>  pick a user turn from this session</Text>
    </Text>,
  );
  if (notice) {
    lines.push(
      <Text key="rewind:notice" color={panelToneColor(notice.tone)}>
        {notice.text}
      </Text>,
    );
  }

  if (stage === "turn") {
    const availableRows = Math.max(1, viewportLineCount - lines.length - 3);
    const { visibleItems, startIndex } = sliceOverlayWindow(options, selectedTurnIndex, availableRows);
    if (visibleItems.length === 0) {
      lines.push(
        <Text key="rewind:empty" color={TUI_THEME.textMuted}>
          No user turns available yet.
        </Text>,
      );
    } else {
      visibleItems.forEach((option, index) => {
        const absoluteIndex = startIndex + index;
        const active = absoluteIndex === selectedTurnIndex;
        const checkpointColor = option.checkpointState === "workspace_ready"
          ? TUI_THEME.cyan
          : option.checkpointState === "tool_used_no_checkpoint"
            ? TUI_THEME.yellow
            : option.checkpointState === "checkpoint_error"
              ? TUI_THEME.red
              : TUI_THEME.textMuted;
        lines.push(
          <Text key={`rewind:turn:${option.turnId}`}>
            <Text color={active ? TUI_THEME.violet : TUI_THEME.textMuted}>{active ? "› " : "  "}</Text>
            <Text color={active ? TUI_THEME.violet : TUI_THEME.text}>{formatRewindTurnOrdinal(option.turnIndex).padEnd(5, " ")}</Text>
            <Text color={TUI_THEME.text}> {excerptRewindUserText(option.displayUserText)}</Text>
            <Text color={checkpointColor}>  · {option.checkpointLabel}</Text>
          </Text>,
        );
      });
    }
    lines.push(
      <Text key="rewind:hints" color={TUI_THEME.textMuted}>
        press ↑/↓ to select • press Enter to choose rewind mode • press Esc to close
      </Text>,
    );
  } else {
    lines.push(
      <Text key="rewind:selected" color={TUI_THEME.textMuted}>
        {selectedTurn
          ? `target ${formatRewindTurnOrdinal(selectedTurn.turnIndex)} · ${excerptRewindUserText(selectedTurn.displayUserText, 88)}`
          : "target turn unavailable"}
      </Text>,
    );
    modeOptions.forEach((option, index) => {
      const active = index === selectedModeIndex;
      const color = option.disabled ? TUI_THEME.textMuted : active ? TUI_THEME.violet : TUI_THEME.text;
      lines.push(
        <Text key={`rewind:mode:${option.mode}`}>
          <Text color={active ? TUI_THEME.violet : TUI_THEME.textMuted}>{active ? "› " : "  "}</Text>
          <Text color={color}>{option.label}</Text>
          <Text color={TUI_THEME.cyan}>  · {option.description}</Text>
          {option.disabled && option.reason ? (
            <Text color={TUI_THEME.red}>{`  (${option.reason})`}</Text>
          ) : null}
        </Text>,
      );
    });
    lines.push(
      <Text key="rewind:mode-hints" color={TUI_THEME.textMuted}>
        press ↑/↓ to choose • press Enter to execute • press Esc to go back
      </Text>,
    );
  }

  const fillerCount = Math.max(0, viewportLineCount - lines.length);
  return (
    <Box flexDirection="column" flexGrow={1} flexShrink={1}>
      <Box flexDirection="column" height={viewportLineCount} flexGrow={1} flexShrink={1}>
        {lines}
        {Array.from({ length: fillerCount }, (_, index) => (
          <Text key={`rewind:filler:${index}`}> </Text>
        ))}
      </Box>
    </Box>
  );
});

const ExitSummaryPane = memo(function ExitSummaryPane({
  lines,
}: {
  lines: string[];
}): JSX.Element {
  return (
    <Box marginTop={1} flexDirection="column">
      {lines.map((line, index) => (
        <Text key={`exit-summary:${index}`} color={TUI_THEME.text}>
          {line}
        </Text>
      ))}
    </Box>
  );
});


const ComposerPane = memo(function ComposerPane({
  showSlashMenu,
  slashPanel,
  composerPopup,
  slashPanelFocusIndex,
  slashPanelNotice,
  commandPaletteItems,
  selectedSlashIndex,
  composerValue,
  composerLines,
  composerPlaceholder,
  composerPrefix,
  composerPrefixColor,
  composerInputLocked,
  workspaceLabel,
  contextBar,
  contextPercent,
  contextWindowLabel,
  lineWidth,
  cmpStatusLabel,
  cmpContextActive,
  cmpContextColor,
}: {
  showSlashMenu: boolean;
  slashPanel: DirectSlashPanelView | null;
  composerPopup: ComposerPopupView | null;
  slashPanelFocusIndex: number;
  slashPanelNotice: SlashPanelNotice | null;
  commandPaletteItems: Array<{ key: string; label: string; description?: string }>;
  selectedSlashIndex: number;
  composerValue: string;
  composerLines: string[];
  composerPlaceholder: string;
  composerPrefix: string;
  composerPrefixColor?: string;
  composerInputLocked: boolean;
  workspaceLabel: string;
  contextBar: string;
  contextPercent: string;
  contextWindowLabel: string;
  lineWidth: number;
  cmpStatusLabel: string;
  cmpContextActive: boolean;
  cmpContextColor?: string;
}): JSX.Element {
  const maxLabelWidth = commandPaletteItems.reduce((max, item) => Math.max(max, item.label.length), 0);
  const panelLabelWidth = slashPanel
    ? slashPanel.fields.reduce((max, field) => Math.max(max, field.label.length), 0)
    : 0;
  const [contextBreathFrameIndex, setContextBreathFrameIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setContextBreathFrameIndex((previous) => (previous + 1) % FOOTER_CONTEXT_BREATH_FRAMES.length);
    }, FOOTER_CONTEXT_BREATH_INTERVAL_MS);
    return () => {
      clearInterval(timer);
    };
  }, []);
  const contextBreathFrame = FOOTER_CONTEXT_BREATH_FRAMES[contextBreathFrameIndex] ?? FOOTER_CONTEXT_BREATH_FRAMES[0];
  const contextBreathColor = FOOTER_CONTEXT_BREATH_COLORS[contextBreathFrameIndex] ?? TUI_THEME.mint;

  return (
    <Box marginTop={1} flexDirection="column">
      {slashPanel ? (
        <Box marginBottom={1} flexDirection="column">
          {(() => {
            const activeFieldKey = slashPanel.fields[slashPanelFocusIndex]?.key
              ?? (slashPanel.id === "exit" ? findPrimaryActionField(slashPanel.fields)?.key : undefined);
            return (
              <>
          {slashPanel.showChrome !== false ? (
            <>
              <Text>
                <Text color={TUI_THEME.violet}>{slashPanel.title}</Text>
                <Text color={TUI_THEME.textMuted}>  {slashPanel.description}</Text>
              </Text>
              {slashPanelNotice ? (
                <Text color={panelToneColor(slashPanelNotice.tone)}>
                  {slashPanelNotice.text}
                </Text>
              ) : slashPanel.showStatus !== false ? (
                <Text color={TUI_THEME.textMuted}>
                  {slashPanel.status}
                </Text>
              ) : null}
            </>
          ) : null}
          {slashPanel.bodyLines?.map((line, index) => (
            slashPanel.id === "exit" && line.fieldKey ? (
              <Text
                key={`${slashPanel.id}:body:${index}`}
                color={line.fieldKey === activeFieldKey ? TUI_THEME.red : TUI_THEME.text}
              >
                {line.fieldKey === activeFieldKey ? withSelectedBodyLineArrow(line.text) : line.text}
              </Text>
            ) : (
            <Text
              key={`${slashPanel.id}:body:${index}`}
              color={line.fieldKey && line.fieldKey === activeFieldKey
                ? (isCreateEntryFieldKey(line.fieldKey)
                  ? TUI_THEME.red
                  : (slashPanel.id === "exit"
                      ? TUI_THEME.red
                      : (slashPanel.id === "model" ? TUI_THEME.yellow : TUI_THEME.mint)))
                : (slashPanel.id === "exit"
                    ? TUI_THEME.text
                    : (isCreateEntryFieldKey(line.fieldKey) ? TUI_THEME.violet : panelToneColor(line.tone)))}
            >
              {line.segments?.length
                ? (
                  <>
                    {shouldShowSelectedBodyLineArrow(slashPanel.id, line.fieldKey, activeFieldKey)
                    && !shouldReplaceSelectedBodyLineArrowInline(slashPanel.id) ? (
                      <Text color={slashPanel.id === "exit" ? TUI_THEME.red : (slashPanel.id === "model" ? TUI_THEME.yellow : TUI_THEME.mint)}>→ </Text>
                    ) : null}
                    {line.segments.map((segment, segmentIndex) => {
                      const selectedWithInlineArrow =
                        segmentIndex === 0
                        && shouldShowSelectedBodyLineArrow(slashPanel.id, line.fieldKey, activeFieldKey)
                        && shouldReplaceSelectedBodyLineArrowInline(slashPanel.id);
                      return (
                      <Text
                        key={`${slashPanel.id}:body:${index}:segment:${segmentIndex}`}
                        color={line.fieldKey && line.fieldKey === activeFieldKey
                          ? (isCreateEntryFieldKey(line.fieldKey)
                            ? TUI_THEME.red
                            : (slashPanel.id === "exit"
                                ? TUI_THEME.red
                            : (segment.tone === "fast"
                              ? TUI_THEME.violet
                              : (slashPanel.id === "model" ? TUI_THEME.yellow : TUI_THEME.mint))))
                          : (slashPanel.id === "exit"
                              ? TUI_THEME.text
                              : (isCreateEntryFieldKey(line.fieldKey) ? TUI_THEME.violet : panelToneColor(segment.tone)))}
                      >
                        {selectedWithInlineArrow ? withSelectedBodyLineArrow(segment.text) : segment.text}
                      </Text>
                      );
                    })}
                  </>
                )
                : (shouldShowSelectedBodyLineArrow(slashPanel.id, line.fieldKey, activeFieldKey)
                  ? withSelectedBodyLineArrow(line.text)
                  : line.text)}
            </Text>
            )
          ))}
          {slashPanel.showFields !== false ? slashPanel.fields.map((field, index) => {
            const active = index === slashPanelFocusIndex;
            const label = field.label.padEnd(panelLabelWidth, " ");
            const prefix = active ? "› " : "  ";
            const value =
              field.kind === "action"
                ? field.value ?? "Press Enter"
                : field.kind === "choice" || field.kind === "value" || field.kind === "input"
                  ? field.value
                  : "";
            const renderedValue =
              field.kind === "input" && active
                ? `${value || field.placeholder || ""}▌`
                : value || (field.kind === "input" ? field.placeholder ?? "" : "");
            return (
              <Text key={`${slashPanel.id}:${field.key}`}>
                <Text color={active ? TUI_THEME.violet : TUI_THEME.textMuted}>{prefix}{label}</Text>
                <Text color={TUI_THEME.textMuted}>  </Text>
                <Text color={active ? panelToneColor(field.tone) : panelToneColor(field.tone)}>
                  {renderedValue}
                </Text>
                {field.note ? (
                  <>
                    <Text color={TUI_THEME.textMuted}>  </Text>
                    <Text color={TUI_THEME.textMuted}>{field.note}</Text>
                  </>
                ) : null}
              </Text>
            );
          }) : null}
          {slashPanel.showHints !== false ? slashPanel.hints.map((hint, index) => (
            <Text key={`${slashPanel.id}:hint:${index}`} color={TUI_THEME.textMuted}>
              {hint}
            </Text>
          )) : null}
              </>
            );
          })()}
        </Box>
      ) : showSlashMenu ? (
        <Box marginBottom={1} flexDirection="column">
          {commandPaletteItems.map((item, index) => {
            const active = index === selectedSlashIndex;
            const paddedLabel = item.label.padEnd(maxLabelWidth, " ");
            return (
              <Text key={item.key}>
                <Text color={active ? TUI_THEME.violet : TUI_THEME.textMuted}>
                  {`${String(index + 1).padStart(2, "0")} ${paddedLabel}`}
                </Text>
                {item.description ? (
                  <>
                    <Text color={TUI_THEME.textMuted}>  </Text>
                    <Text color={active ? TUI_THEME.violet : TUI_THEME.textMuted}>{item.description}</Text>
                  </>
                ) : null}
              </Text>
            );
          })}
        </Box>
      ) : composerPopup ? (
        <Box marginBottom={1} flexDirection="column">
          <Text>
            <Text color={TUI_THEME.violet}>{composerPopup.title}</Text>
            <Text color={TUI_THEME.textMuted}>  {composerPopup.description}</Text>
          </Text>
          {(composerPopup.detailLines ?? []).map((line, index) => (
            <Text key={`${composerPopup.title}:detail:${index}`} color={TUI_THEME.textMuted}>
              {line}
            </Text>
          ))}
          {composerPopup.visibleItems.length === 0 ? (
            <Text color={composerPopup.emptyTone ?? TUI_THEME.textMuted}>
              {composerPopup.emptyText ?? "No matches found."}
            </Text>
          ) : composerPopup.visibleItems.map((item, index) => {
            const active = index === composerPopup.selectedIndex;
            const ordinal = formatComposerPopupOrdinal(composerPopup.startIndex + index + 1, composerPopup.totalCount);
            return (
              <Text key={item.key} color={active ? TUI_THEME.violet : TUI_THEME.text}>
                {renderComposerPopupRowText({
                  ordinal,
                  label: item.label,
                  active,
                })}
              </Text>
            );
          })}
          {composerPopup.totalCount > 0 ? (
            <Text color={TUI_THEME.textMuted}>
              {`    Page ${composerPopup.pageIndex + 1}/${Math.max(1, composerPopup.pageCount)} · ${composerPopup.totalCount} results`}
            </Text>
          ) : null}
          <Text color={TUI_THEME.textMuted}>
            {composerPopup.pageCount > 1
              ? "    press ↑/↓ to select • press PageUp/PageDown to change page • press ENTER to choose • press ESC to cancel"
              : "    press ↑/↓ to select • press ENTER to choose • press ESC to cancel"}
          </Text>
        </Box>
      ) : null}
      <Text color={TUI_THEME.line}>{"─".repeat(lineWidth)}</Text>
      {composerLines.map((line, index) => (
        <Text key={`composer-line-${index}`}>
          <Text color={composerPrefixColor ?? TUI_THEME.mint}>{index === 0 ? composerPrefix : "   "}</Text>
          {composerValue.length === 0 && index === 0 ? (
            <Text color={TUI_THEME.textMuted}>{composerPlaceholder}</Text>
          ) : (
            <>
              {renderComposerLineFragments(
                line.length > 0 ? line : (composerInputLocked && index === 0 ? "" : " "),
                TUI_THEME.text,
              ).map((fragment, fragmentIndex) => (
                <Text key={`composer-fragment-${index}-${fragmentIndex}`} color={fragment.color}>
                  {fragment.text}
                </Text>
              ))}
            </>
          )}
        </Text>
      ))}
      <Text color={TUI_THEME.line}>{"─".repeat(lineWidth)}</Text>
      <Text wrap="truncate-end">
        <Text color={TUI_THEME.textMuted}>WorkSpace: </Text>
        <Text color={TUI_THEME.text}>{workspaceLabel}</Text>
        <Text color={TUI_THEME.text}>    </Text>
        <Text color={cmpContextActive ? contextBreathColor : TUI_THEME.text}>{cmpContextActive ? `${contextBreathFrame} ` : "  "}</Text>
        <Text color={cmpContextColor}>Context </Text>
        <Text color={TUI_THEME.text}>{contextBar} </Text>
        <Text color={TUI_THEME.text}>{contextPercent} </Text>
        <Text color={TUI_THEME.textMuted}>of </Text>
        <Text color={TUI_THEME.text}>{contextWindowLabel}</Text>
      </Text>
    </Box>
  );
});

function PraxisDirectTuiApp(): JSX.Element {
  const appRoot = useMemo(() => resolveAppRoot(process.cwd()), []);
  const initialBootState = useMemo(() => resolveInitialDirectTuiBootState(), []);
  const [configRevision, setConfigRevision] = useState(0);
  const [activeSlashPanelId, setActiveSlashPanelId] = useState<DirectSlashPanelId | null>(null);
  const [slashPanelFocusIndex, setSlashPanelFocusIndex] = useState(0);
  const [slashPanelDraft, setSlashPanelDraft] = useState<Record<string, string>>({});
  const [slashPanelInputState, setSlashPanelInputState] = useState(() => createTuiTextInputState());
  const [slashPanelNotice, setSlashPanelNotice] = useState<SlashPanelNotice | null>(null);
  const [dismissedHumanGateSignature, setDismissedHumanGateSignature] = useState<string | null>(null);
  const [sessionIndexRevision, setSessionIndexRevision] = useState(0);
  const [sessionUsageRevision, setSessionUsageRevision] = useState(0);
  const [checkpointRevision, setCheckpointRevision] = useState(0);
  const [sessionName, setSessionName] = useState(initialBootState.sessionName);
  const [selectedAgentId, setSelectedAgentId] = useState(initialBootState.selectedAgentId);
  const [pendingInitNote, setPendingInitNote] = useState<string | null>(null);
  const [panelRenameTarget, setPanelRenameTarget] = useState<{ kind: "session" | "agent"; id: string } | null>(null);
  const [modelPicker, setModelPicker] = useState<ModelPickerOverlayState | null>(null);
  const [modelCatalogWarmState, setModelCatalogWarmState] = useState<ModelCatalogWarmState>({ status: "idle" });
  const [statusRateLimitRecord, setStatusRateLimitRecord] = useState<StatusRateLimitCacheRecord | null>(() => {
    try {
      return readCachedStatusRateLimitRecord(loadOpenAILiveConfig("core.main"), appRoot);
    } catch {
      return null;
    }
  });
  const [statusRateLimitRefreshState, setStatusRateLimitRefreshState] = useState<"idle" | "loading">("idle");
  const runtimeConfig = useMemo(() => {
    try {
      return loadRaxodeRuntimeConfigSnapshot(appRoot);
    } catch {
      return null;
    }
  }, [appRoot, configRevision]);
  const configFile = useMemo(() => {
    try {
      return loadRaxodeConfigFile(appRoot);
    } catch {
      return null;
    }
  }, [appRoot, configRevision]);
  const config = useMemo(() => {
    try {
      return loadOpenAILiveConfig("core.main");
    } catch {
      return null;
    }
  }, [configRevision]);
  const openAIAuthStatus = useMemo(() => getOpenAIAuthStatus(appRoot), [appRoot, configRevision]);
  const embeddingConfig = useMemo(() => {
    try {
      return loadResolvedEmbeddingConfig(appRoot);
    } catch {
      return null;
    }
  }, [appRoot, configRevision]);
  const supportsRawInput = Boolean(process.stdin.isTTY && typeof process.stdin.setRawMode === "function");
  const [currentCwd, setCurrentCwd] = useState(initialBootState.currentCwd);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("starting");
  const [agentRegistryRevision, setAgentRegistryRevision] = useState(0);
  const [composerState, setComposerState] = useState(() => createTuiTextInputState());
  const [composerAttachments, setComposerAttachments] = useState<TuiImageAttachment[]>([]);
  const [composerPastedContents, setComposerPastedContents] = useState<TuiPastedContentAttachment[]>([]);
  const [composerFileReferences, setComposerFileReferences] = useState<TuiFileReferenceAttachment[]>([]);
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const [selectedComposerPopupIndex, setSelectedComposerPopupIndex] = useState(0);
  const [composerPopupPageIndex, setComposerPopupPageIndex] = useState(0);
  const [backendEpoch, setBackendEpoch] = useState(0);
  const [logPath, setLogPath] = useState<string | null>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [animationTick, setAnimationTick] = useState(0);
  const [surfaceState, setSurfaceState] = useState<SurfaceAppState>(initialBootState.surfaceState);
  const [backendContextSnapshot, setBackendContextSnapshot] = useState<ReturnType<typeof normalizeContextSnapshot>>(null);
  const [cmpViewerSnapshot, setCmpViewerSnapshot] = useState<CmpViewerSnapshot | null>(null);
  const [mpViewerSnapshot, setMpViewerSnapshot] = useState<MpViewerSnapshot | null>(null);
  const [capabilityViewerSnapshot, setCapabilityViewerSnapshot] = useState<CapabilityViewerSnapshot | null>(null);
  const [initViewerSnapshot, setInitViewerSnapshot] = useState<InitViewerSnapshot | null>(null);
  const [questionViewerSnapshot, setQuestionViewerSnapshot] = useState<QuestionViewerSnapshot | null>(null);
  const [questionPanelState, setQuestionPanelState] = useState<QuestionPanelState>(() => createEmptyQuestionPanelState());
  const [runIndicator, setRunIndicator] = useState<{ startedAt: string; label: string } | null>(null);
  const [workspaceIndexSnapshot, setWorkspaceIndexSnapshot] = useState<WorkspaceIndexSnapshot | null>(null);
  const [workspaceIndexStatus, setWorkspaceIndexStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [workspaceIndexError, setWorkspaceIndexError] = useState<string | null>(null);
  const [workspacePickerInputState, setWorkspacePickerInputState] = useState<TuiTextInputState | null>(null);
  const [pendingSessionSwitch, setPendingSessionSwitch] = useState<PendingSessionSwitch | null>(null);
  const [pendingExitAction, setPendingExitAction] = useState<ExitPanelAction | null>(null);
  const [exitSummaryDisplay, setExitSummaryDisplay] = useState<ExitSummaryDisplayState | null>(null);
  const [rewindOverlayState, setRewindOverlayState] = useState<RewindOverlayState | null>(null);
  const [rewindInFlight, setRewindInFlight] = useState<RewindInFlightState | null>(null);
  const [conversationActivated, setConversationActivated] = useState(initialBootState.conversationActivated);
  const [terminalSize, setTerminalSize] = useState(() => ({
    rows: process.stdout.rows ?? 24,
    columns: process.stdout.columns ?? 80,
  }));
  const childRef = useRef<ChildProcessWithoutNullStreams | null>(null);
  const stdoutRemainderRef = useRef("");
  const stderrRemainderRef = useRef("");
  const processedLogByteOffsetRef = useRef(0);
  const logFileRemainderRef = useRef("");
  const logTickInFlightRef = useRef(false);
  const sessionIdRef = useRef(initialBootState.sessionId);
  const previousTranscriptLineCountRef = useRef(0);
  const assistantSegmentIndexRef = useRef(new Map<string, number>());
  const activeAssistantMessageIdRef = useRef(new Map<string, string>());
  const emittedAssistantTextRef = useRef(new Map<string, string>());
  const rawAssistantDeltaTextRef = useRef(new Map<string, string>());
  const interruptPendingRef = useRef(false);
  const backendRestartPendingRef = useRef(false);
  const interruptedTurnIdsRef = useRef(new Set<string>());
  const completedTurnIdsRef = useRef(new Set<string>());
  const activeTasksRef = useRef<ReturnType<typeof selectActiveTasks>>([]);
  const interruptibleTasksRef = useRef<ReturnType<typeof selectInterruptibleTasks>>([]);
  const activeTurnIdsRef = useRef(new Set<string>());
  const toolFamilyStateRef = useRef(new Map<string, {
    hadFailure: boolean;
    intentLines: string[];
    resultLines: string[];
  }>());
  const toolSummaryRevisionRef = useRef(new Map<string, number>());
  const nextComposerImageIndexRef = useRef(1);
  const nextComposerPastedContentIndexRef = useRef(1);
  const pendingSessionSwitchRef = useRef<PendingSessionSwitch | null>(null);
  const pendingPasteTextRef = useRef("");
  const pendingPasteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const permissionsPanelReturnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSessionSwitchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backendLaunchWorkspaceRef = useRef<string | null>(null);
  const backendLaunchSessionIdRef = useRef<string | null>(null);
  const dismissedFilePopupTokenRef = useRef<string | null>(null);
  const modelCatalogCacheRef = useRef(new Map<string, AvailableModelCatalogEntry[]>());
  const modelAvailabilityProbeInFlightRef = useRef(new Set<string>());
  const rewindPrimedAtRef = useRef(0);
  const pendingTranscriptRewindRef = useRef<PendingTranscriptRewind | null>(null);
  const turnUserTextRef = useRef(new Map<string, string>());
  const transcriptMessagesRef = useRef<SurfaceMessage[]>([]);
  const pendingOutboundTurnsRef = useRef<PendingOutboundTurn[]>([]);
  const initCompletedAutoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingInitCompletedPanelRef = useRef(false);
  const sessionUsageLedgerRef = useRef<DirectTuiSessionUsageEntry[]>(initialBootState.usageLedger);
  const exitSummaryPersistRequestedRef = useRef(false);
  const exitSummaryFilePersistedRef = useRef<string | null>(null);
  const surfaceStateRef = useRef(surfaceState);

  const dispatchSurfaceEvent = (event: Record<string, unknown>) => {
    setSurfaceState((previous) => applySurfaceEvent(previous, event as never));
  };

  useEffect(() => {
    surfaceStateRef.current = surfaceState;
  }, [surfaceState]);

  const appendInlineError = (text: string) => {
    const at = new Date().toISOString();
    dispatchSurfaceEvent({
      type: "message.appended",
      at,
      message: createSurfaceMessage({
        messageId: `inline-error:${at}`,
        sessionId: sessionIdRef.current,
        kind: "error",
        text,
        createdAt: at,
      }),
    });
  };

  const appendInlineStatus = (text: string, kind: SurfaceMessage["kind"] = "status") => {
    const at = new Date().toISOString();
    dispatchSurfaceEvent({
      type: "message.appended",
      at,
      message: createSurfaceMessage({
        messageId: `inline-status:${at}`,
        sessionId: sessionIdRef.current,
        kind,
        text,
        createdAt: at,
      }),
    });
  };

  const beginRewindInFlight = (
    mode: DirectTuiRewindMode,
    phase: RewindInFlightState["phase"],
  ) => {
    setRewindInFlight({
      mode,
      startedAt: new Date().toISOString(),
      phase,
    });
  };

  const setRewindInFlightPhase = (phase: RewindInFlightState["phase"]) => {
    setRewindInFlight((current) => current ? {
      ...current,
      phase,
    } : current);
  };

  const finishRewindInFlight = () => {
    setRewindInFlight(null);
  };

  const recordSessionUsage = (entry: DirectTuiSessionUsageEntry) => {
    const existingIndex = sessionUsageLedgerRef.current.findIndex((candidate) => candidate.requestId === entry.requestId);
    if (existingIndex >= 0) {
      const nextLedger = sessionUsageLedgerRef.current.slice();
      nextLedger[existingIndex] = entry;
      sessionUsageLedgerRef.current = nextLedger;
    } else {
      sessionUsageLedgerRef.current = [...sessionUsageLedgerRef.current, entry];
    }
    setSessionUsageRevision((previous) => previous + 1);
  };

  const buildCurrentExitSummary = (generatedAt = new Date().toISOString()): DirectTuiSessionExitSummary => {
    const knownSessions = listDirectTuiSessions(currentCwd)
      .filter((session) => session.sessionId !== sessionIdRef.current);
    return buildDirectTuiSessionExitSummary({
      snapshot: {
        sessionId: sessionIdRef.current,
        name: sessionName,
        usageLedger: sessionUsageLedgerRef.current,
      },
      sessions: [
        ...knownSessions,
        {
          sessionId: sessionIdRef.current,
          name: sessionName,
        },
      ],
      generatedAt,
    });
  };

  const requestExitSummaryFilePersistence = (lines: string[]) => {
    if (!DIRECT_TUI_EXIT_SUMMARY_FILE) {
      return;
    }
    const serializedLines = JSON.stringify(lines);
    if (exitSummaryFilePersistedRef.current === serializedLines) {
      return;
    }
    exitSummaryFilePersistedRef.current = serializedLines;
    void persistDirectTuiExitSummaryFile(lines);
  };

  const beginExitSummarySequence = (generatedAt = new Date().toISOString()) => {
    closeSlashPanel();
    setPendingExitAction(null);
    const animated = directTuiAnimationMode !== "off";
    const startedAtMs = Date.now();
    const summary = buildCurrentExitSummary(generatedAt);
    const finalLines = buildExitSummaryPanelLines(
      summary,
      EXIT_SUMMARY_TOTAL_STEPS,
      terminalSize.columns,
    );
    exitSummaryPersistRequestedRef.current = false;
    requestExitSummaryFilePersistence(finalLines);
    setExitSummaryDisplay({
      summary,
      animationStep: animated ? 0 : EXIT_SUMMARY_TOTAL_STEPS,
      animated,
      startedAtMs,
      exitAtMs: startedAtMs + EXIT_SUMMARY_DISPLAY_MS,
      finalLines,
    });
  };

  const appendQuestionReceipt = (payload: QuestionReceiptPayload, text: string) => {
    const at = new Date().toISOString();
    dispatchSurfaceEvent({
      type: "message.appended",
      at,
      message: createSurfaceMessage({
        messageId: `question-receipt:${at}`,
        sessionId: sessionIdRef.current,
        kind: "status",
        text,
        createdAt: at,
        metadata: {
          source: "question_receipt",
          receipt: payload,
        },
      }),
    });
  };

  const closeModelPicker = () => {
    setModelPicker(null);
  };

  const consumePendingOutboundTurn = (turnId: string): PendingOutboundTurn | null => {
    const directMatchIndex = pendingOutboundTurnsRef.current.findIndex((entry) => entry.turnId === turnId);
    const nextIndex = directMatchIndex >= 0 ? directMatchIndex : 0;
    if (nextIndex < 0 || nextIndex >= pendingOutboundTurnsRef.current.length) {
      return null;
    }
    const [entry] = pendingOutboundTurnsRef.current.splice(nextIndex, 1);
    return entry ?? null;
  };

  const failPendingOutboundTurns = (reason: string) => {
    if (pendingOutboundTurnsRef.current.length === 0) {
      return;
    }
    const at = new Date().toISOString();
    for (const entry of pendingOutboundTurnsRef.current) {
      dispatchSurfaceEvent({
        type: "message.updated",
        at,
        message: createSurfaceMessage({
          messageId: entry.messageId,
          sessionId: sessionIdRef.current,
          turnId: entry.turnId,
          kind: "user",
          text: entry.userText,
          createdAt: entry.queuedAt,
          updatedAt: at,
          metadata: {
            optimistic: false,
            submissionId: entry.submissionId,
            deliveryState: "failed",
            failureReason: reason,
          },
        }),
      });
    }
    pendingOutboundTurnsRef.current = [];
  };

  const clearPermissionsPanelReturnTimer = () => {
    if (permissionsPanelReturnTimerRef.current) {
      clearTimeout(permissionsPanelReturnTimerRef.current);
      permissionsPanelReturnTimerRef.current = null;
    }
  };

  const clearInitCompletedAutoCloseTimer = () => {
    if (initCompletedAutoCloseTimerRef.current) {
      clearTimeout(initCompletedAutoCloseTimerRef.current);
      initCompletedAutoCloseTimerRef.current = null;
    }
  };

  const scheduleSlashPanelAutoClose = (delayMs = PERMISSIONS_PANEL_AUTO_RETURN_MS) => {
    clearPermissionsPanelReturnTimer();
    permissionsPanelReturnTimerRef.current = setTimeout(() => {
      permissionsPanelReturnTimerRef.current = null;
      closeSlashPanel();
    }, delayMs);
  };

  const clearPendingSessionSwitchTimeout = () => {
    if (pendingSessionSwitchTimeoutRef.current) {
      clearTimeout(pendingSessionSwitchTimeoutRef.current);
      pendingSessionSwitchTimeoutRef.current = null;
    }
  };

  const closeWorkspacePicker = () => {
    setWorkspacePickerInputState(null);
    setSelectedComposerPopupIndex(0);
    setComposerPopupPageIndex(0);
  };

  const resolveModelCatalogCacheKey = (authConfig: OpenAILiveConfig) => `${authConfig.authMode}:${authConfig.baseURL}`;

  const hydrateModelAvailabilityFromCache = (
    scopeKey: string,
    models: AvailableModelCatalogEntry[],
  ): Record<string, ModelAvailabilityRecord | undefined> => Object.fromEntries(
    models.map((model) => [model.id, getCachedModelAvailability(scopeKey, model.id, appRoot)]),
  );

  const probePickerModelAvailability = async (
    scopeKey: string,
    source: ModelPickerSource,
    models: AvailableModelCatalogEntry[],
    roleId: RaxcodeRoleId,
  ) => {
    for (const model of models) {
      const probeKey = `${scopeKey}:${model.id}`;
      if (getCachedModelAvailability(scopeKey, model.id, appRoot) || modelAvailabilityProbeInFlightRef.current.has(probeKey)) {
        continue;
      }
      modelAvailabilityProbeInFlightRef.current.add(probeKey);
      const record = source === "embedding"
        ? await probeEmbeddingModelAvailability(model.id as "text-embedding-3-large" | "text-embedding-3-small")
        : await probeChatModelAvailability(
          model.id,
          loadOpenAILiveConfig(roleId),
          model.defaultReasoningLevel ?? model.reasoningLevels[0] ?? "low",
        );
      modelAvailabilityProbeInFlightRef.current.delete(probeKey);
      setCachedModelAvailability(scopeKey, model.id, record, appRoot);
      setModelPicker((current) => current && current.availabilityScopeKey === scopeKey ? {
        ...current,
        availabilityByModelId: {
          ...current.availabilityByModelId,
          [model.id]: record,
        },
      } : current);
    }
  };

  const resolveModelPickerSelection = (
    models: AvailableModelCatalogEntry[],
    parsed: ReturnType<typeof parseModelEffortLine>,
  ) => {
    const selectedModelIndex = Math.max(0, models.findIndex((entry) => entry.id === parsed?.model));
    const selectedModel = models[selectedModelIndex];
    const selectedReasoningIndex = Math.max(
      0,
      (selectedModel?.reasoningLevels ?? []).findIndex((entry) => entry === parsed?.reasoning),
    );
    return {
      selectedModelIndex,
      selectedReasoningIndex: selectedReasoningIndex >= 0 ? selectedReasoningIndex : 0,
      serviceTierFastEnabled: Boolean(
        parsed?.serviceTierFastEnabled
        && selectedModel?.supportsFastServiceTier,
      ),
    };
  };

  const loadChatModelCatalog = async (roleId: RaxcodeRoleId = "core.main") => {
    const authConfig = loadOpenAILiveConfig(roleId);
    const cacheKey = resolveModelCatalogCacheKey(authConfig);
    const cached = modelCatalogCacheRef.current.get(cacheKey);
    if (cached) {
      return cached;
    }
    const models = await listAvailableChatModels(authConfig);
    modelCatalogCacheRef.current.set(cacheKey, models);
    return models;
  };

  useEffect(() => {
    if (activeSlashPanelId !== "model") {
      return;
    }
    let cancelled = false;
    let authConfig: OpenAILiveConfig;
    try {
      authConfig = loadOpenAILiveConfig("core.main");
    } catch (error) {
      setModelCatalogWarmState({
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    const cacheKey = resolveModelCatalogCacheKey(authConfig);
    if (modelCatalogCacheRef.current.has(cacheKey)) {
      setModelCatalogWarmState({ status: "ready" });
      return;
    }
    setModelCatalogWarmState({ status: "loading" });
    void listAvailableChatModels(authConfig)
      .then((models) => {
        if (cancelled) {
          return;
        }
        modelCatalogCacheRef.current.set(cacheKey, models);
        setModelCatalogWarmState({ status: "ready" });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setModelCatalogWarmState({
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [activeSlashPanelId, configRevision]);

  useEffect(() => {
    let cancelled = false;
    try {
      const config = loadOpenAILiveConfig("core.main");
      const cached = readCachedStatusRateLimitRecord(config, appRoot);
      if (!cancelled) {
        setStatusRateLimitRecord(cached);
      }
      if (activeSlashPanelId !== "status" || config.authMode !== "chatgpt_oauth") {
        if (!cancelled) {
          setStatusRateLimitRefreshState("idle");
        }
        return () => {
          cancelled = true;
        };
      }
      const cachedView = composeStatusRateLimitDisplayView(cached);
      if (cachedView.availability !== "missing" && cachedView.availability !== "stale") {
        if (!cancelled) {
          setStatusRateLimitRefreshState("idle");
        }
        return () => {
          cancelled = true;
        };
      }
      setStatusRateLimitRefreshState("loading");
      void refreshStatusRateLimitRecord(config, appRoot)
        .then((record) => {
          if (cancelled) {
            return;
          }
          setStatusRateLimitRecord(record);
          setStatusRateLimitRefreshState("idle");
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }
          setStatusRateLimitRefreshState("idle");
          setStatusRateLimitRecord((previous) => previous ?? cached);
          setSlashPanelNotice({
            tone: "warning",
            text: error instanceof Error ? error.message : String(error),
          });
        });
    } catch {
      if (!cancelled) {
        setStatusRateLimitRecord(null);
        setStatusRateLimitRefreshState("idle");
      }
    }
    return () => {
      cancelled = true;
    };
  }, [activeSlashPanelId, appRoot, configRevision]);

  const openModelPicker = async (field: Extract<PraxisSlashPanelField, { kind: "choice" }>) => {
    const source: ModelPickerSource = field.key === "model:mp.embedding" ? "embedding" : "chat";
    const currentValue = slashPanelDraft[field.key] ?? field.value;
    const parsed = source === "chat" ? parseModelEffortLine(currentValue) : null;
    const roleId = resolveModelFieldRoleId(field.key) ?? "core.main";
    let authConfig: OpenAILiveConfig | null = null;
    if (source === "chat") {
      try {
        authConfig = loadOpenAILiveConfig(roleId);
      } catch (error) {
        setSlashPanelNotice({
          tone: "danger",
          text: error instanceof Error ? error.message : String(error),
        });
        return;
      }
    }
    const cacheKey = authConfig ? resolveModelCatalogCacheKey(authConfig) : "";
    const embeddingConfig = source === "embedding" ? loadResolvedEmbeddingConfig(appRoot) : null;
    const availabilityScopeKey = source === "embedding"
      ? buildEmbeddingModelAvailabilityScopeKey(embeddingConfig ?? {
        baseURL: configFile?.embedding.baseURL?.trim() ?? "",
        authProfileId: configFile?.embedding.authProfileId?.trim() ?? "",
        apiKey: "",
      })
      : buildChatModelAvailabilityScopeKey(authConfig!);
    const cachedModels = source === "chat" ? modelCatalogCacheRef.current.get(cacheKey) ?? [] : [];
    const initialModels = source === "embedding" ? EMBEDDING_MODEL_CATALOG : cachedModels;
    const initialSelectedIndex = source === "embedding"
      ? Math.max(0, EMBEDDING_MODEL_CATALOG.findIndex((entry) => entry.id === currentValue))
      : 0;
    const cachedSelection = source === "chat"
      ? resolveModelPickerSelection(cachedModels, parsed)
      : {
          selectedModelIndex: initialSelectedIndex >= 0 ? initialSelectedIndex : 0,
          selectedReasoningIndex: 0,
          serviceTierFastEnabled: false,
        };

    setModelPicker({
      open: true,
      source,
      fieldKey: field.key,
      fieldLabel: field.label,
      availabilityScopeKey,
      loading: source === "chat" && cachedModels.length === 0,
      models: initialModels,
      selectedModelIndex: cachedSelection.selectedModelIndex,
      selectedReasoningIndex: cachedSelection.selectedReasoningIndex,
      serviceTierFastEnabled: cachedSelection.serviceTierFastEnabled,
      availabilityByModelId: hydrateModelAvailabilityFromCache(availabilityScopeKey, initialModels),
      error: source === "chat" && cachedModels.length === 0 && modelCatalogWarmState.status === "error"
        ? modelCatalogWarmState.error
        : undefined,
    });
    if (initialModels.length > 0) {
      void probePickerModelAvailability(availabilityScopeKey, source, initialModels, roleId);
    }
    if (source === "embedding" || cachedModels.length > 0) {
      return;
    }
    try {
      const models = await loadChatModelCatalog(roleId);
      const nextSelection = resolveModelPickerSelection(models, parsed);
      setModelPicker((current) => current && current.fieldKey === field.key ? {
        ...current,
        loading: false,
        models,
        selectedModelIndex: nextSelection.selectedModelIndex,
        selectedReasoningIndex: nextSelection.selectedReasoningIndex,
        serviceTierFastEnabled: nextSelection.serviceTierFastEnabled,
        availabilityByModelId: hydrateModelAvailabilityFromCache(availabilityScopeKey, models),
      } : current);
      void probePickerModelAvailability(availabilityScopeKey, source, models, roleId);
    } catch (error) {
      setModelPicker((current) => current && current.fieldKey === field.key ? {
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      } : current);
    }
  };

  const closeSlashPanel = () => {
    closeModelPicker();
    clearPermissionsPanelReturnTimer();
    clearInitCompletedAutoCloseTimer();
    pendingInitCompletedPanelRef.current = false;
    closeWorkspacePicker();
    setActiveSlashPanelId(null);
    setSlashPanelFocusIndex(0);
    setSlashPanelDraft({});
    setSlashPanelInputState(createTuiTextInputState());
    setSlashPanelNotice(null);
    setPanelRenameTarget(null);
  };

  const closeHumanGatePanel = (dismissCurrent = false) => {
    if (dismissCurrent && pendingHumanGateSignature.length > 0) {
      setDismissedHumanGateSignature(pendingHumanGateSignature);
    }
    closeModelPicker();
    clearPermissionsPanelReturnTimer();
    clearInitCompletedAutoCloseTimer();
    closeWorkspacePicker();
    setActiveSlashPanelId(null);
    setSlashPanelFocusIndex(0);
    setSlashPanelDraft({});
    setSlashPanelInputState(createTuiTextInputState());
    setSlashPanelNotice(null);
    setPanelRenameTarget(null);
  };

  const returnToSlashMenu = () => {
    clearPermissionsPanelReturnTimer();
    closeSlashPanel();
    setComposerState(createTuiTextInputState("/"));
    setComposerAttachments([]);
    setComposerPastedContents([]);
    setSelectedSlashIndex(0);
  };

  const openHumanGatePanel = (options?: { gateIndex?: number; autoOpen?: boolean }) => {
    const gateIndex = Math.max(0, options?.gateIndex ?? 0);
    clearPermissionsPanelReturnTimer();
    closeWorkspacePicker();
    closeModelPicker();
    setActiveSlashPanelId("human-gate");
    setSlashPanelDraft({
      humanGateIndex: String(gateIndex),
      humanGateDetails: "collapsed",
    });
    setSlashPanelInputState(createTuiTextInputState());
    setSlashPanelFocusIndex(0);
    setSlashPanelNotice(options?.autoOpen ? {
      tone: "warning",
      text: "TAP is waiting for a human gate decision.",
    } : null);
    setPanelRenameTarget(null);
    if (!options?.autoOpen) {
      setDismissedHumanGateSignature(null);
    }
  };

  const openSlashPanel = (panelId: DirectSlashPanelId, initialValue = "") => {
    if (panelId === "human-gate") {
      openHumanGatePanel();
      return;
    }
    clearPermissionsPanelReturnTimer();
    closeWorkspacePicker();
    const initialFocusIndex = panelId === "permissions"
      ? Math.max(0, PRAXIS_PERMISSION_MODE_OPTIONS.indexOf(
        (configFile?.permissions.requestedMode ?? runtimeConfig?.permissions.requestedMode ?? "bapr") as typeof PRAXIS_PERMISSION_MODE_OPTIONS[number],
      ))
      : 0;
    setActiveSlashPanelId(panelId);
    setSlashPanelFocusIndex(initialFocusIndex);
    setSlashPanelDraft({});
    setSlashPanelInputState(createTuiTextInputState(initialValue));
    setSlashPanelNotice(null);
    setPanelRenameTarget(null);
    setComposerState(createTuiTextInputState());
    setComposerAttachments([]);
    setComposerPastedContents([]);
  };

  const resolveActiveQuestionSnapshot = () =>
    questionViewerSnapshot && questionViewerSnapshot.status === "active"
      ? questionViewerSnapshot
      : null;

  const resolveCurrentQuestionPrompt = (snapshot = resolveActiveQuestionSnapshot()) => {
    if (!snapshot) {
      return undefined;
    }
    return snapshot.questions[clampQuestionIndex(
      questionPanelState.currentQuestionIndex,
      snapshot.questions.length,
    )];
  };

  const resolveCurrentQuestionComposerText = () => restorePastedContentTokens(
    composerState.value,
    composerPastedContents.filter((entry) => composerState.value.includes(entry.tokenText)),
  ).trim();

  const persistCurrentQuestionDraft = () => {
    const snapshot = resolveActiveQuestionSnapshot();
    const currentQuestion = resolveCurrentQuestionPrompt(snapshot);
    if (!snapshot || !currentQuestion) {
      return;
    }
    const value = resolveCurrentQuestionComposerText();
    const noteMode = isQuestionNoteModeActive(questionPanelState, currentQuestion);
    setQuestionPanelState((previous) => {
      const existing = previous.answersByQuestionId[currentQuestion.id];
      if (!existing && value.length === 0) {
        return previous;
      }
      const nextAnswers = {
        ...previous.answersByQuestionId,
      };
      const shouldDeleteEntry = value.length === 0
        && !existing?.selectedOptionId
        && !existing?.selectedOptionLabel
        && !existing?.answerText
        && !existing?.annotation;
      if (shouldDeleteEntry) {
        delete nextAnswers[currentQuestion.id];
      } else {
        const nextEntry: QuestionAnswerDraft = {
          ...(existing ?? {}),
        };
        if (currentQuestion.kind === "freeform" && !noteMode) {
          if (value.length > 0) {
            nextEntry.answerText = value;
          } else {
            delete nextEntry.answerText;
          }
        } else {
          if (value.length > 0) {
            nextEntry.annotation = value;
          } else {
            delete nextEntry.annotation;
          }
        }
        nextAnswers[currentQuestion.id] = nextEntry;
      }
      return {
        ...previous,
        answersByQuestionId: nextAnswers,
      };
    });
  };

  const moveQuestionPrompt = (delta: -1 | 1) => {
    const snapshot = resolveActiveQuestionSnapshot();
    if (!snapshot || snapshot.questions.length === 0) {
      return;
    }
    persistCurrentQuestionDraft();
    setQuestionPanelState((previous) => ({
      ...previous,
      currentQuestionIndex: clampQuestionIndex(previous.currentQuestionIndex + delta, snapshot.questions.length),
    }));
    setSlashPanelNotice(null);
  };

  const moveQuestionOption = (delta: -1 | 1) => {
    const snapshot = resolveActiveQuestionSnapshot();
    const currentQuestion = resolveCurrentQuestionPrompt(snapshot);
    if (!snapshot || !currentQuestion || currentQuestion.kind === "freeform" || currentQuestion.options.length === 0) {
      return;
    }
    setQuestionPanelState((previous) => {
      const currentIndex = previous.activeOptionIndexByQuestionId[currentQuestion.id] ?? 0;
      const nextIndex = (currentIndex + delta + currentQuestion.options.length) % currentQuestion.options.length;
      return {
        ...previous,
        activeOptionIndexByQuestionId: {
          ...previous.activeOptionIndexByQuestionId,
          [currentQuestion.id]: nextIndex,
        },
      };
    });
    setSlashPanelNotice(null);
  };

  const toggleCurrentQuestionNoteMode = () => {
    const snapshot = resolveActiveQuestionSnapshot();
    const currentQuestion = resolveCurrentQuestionPrompt(snapshot);
    if (!snapshot || !currentQuestion) {
      return;
    }
    const currentValue = resolveCurrentQuestionComposerText();
    const currentlyNoteMode = isQuestionNoteModeActive(questionPanelState, currentQuestion);
    const nextNoteMode = !currentlyNoteMode;
    const nextAnswersByQuestionId = currentlyNoteMode
      ? buildNextQuestionAnswersByQuestionId({
          state: questionPanelState,
          question: currentQuestion,
          composerValue: currentValue,
          noteMode: true,
        })
      : questionPanelState.answersByQuestionId;
    setQuestionPanelState((previous) => ({
      ...previous,
      answersByQuestionId: currentlyNoteMode ? nextAnswersByQuestionId : previous.answersByQuestionId,
      noteModeByQuestionId: {
        ...previous.noteModeByQuestionId,
        [currentQuestion.id]: nextNoteMode,
      },
    }));
    setSlashPanelNotice(null);
  };

  const findFirstUnansweredQuestionIndex = (
    snapshot: QuestionViewerSnapshot,
    answersByQuestionId: Record<string, QuestionAnswerDraft>,
    currentQuestionId?: string,
    currentAnswerText = "",
  ): number => snapshot.questions.findIndex((question) => {
    const entry = answersByQuestionId[question.id];
    if (question.kind === "freeform") {
      if (question.id === currentQuestionId && currentAnswerText.trim().length > 0) {
        return false;
      }
      return !(entry?.answerText && entry.answerText.trim().length > 0);
    }
    return !entry?.selectedOptionId || !entry.selectedOptionLabel;
  });

  const submitAllQuestionAnswers = (
    snapshot: QuestionViewerSnapshot,
    answersByQuestionId: Record<string, QuestionAnswerDraft> = questionPanelState.answersByQuestionId,
  ) => {
    if (!snapshot.requestId) {
      setSlashPanelNotice({
        tone: "warning",
        text: "Question prompt is not ready yet.",
      });
      return;
    }
    const answers: Array<{
      questionId: string;
      selectedOptionId?: string;
      selectedOptionLabel?: string;
      answerText?: string;
      annotation?: string;
    }> = [];
    snapshot.questions.forEach((question) => {
      const existing = answersByQuestionId[question.id];
      if (question.kind === "freeform") {
        const answerText = existing?.answerText;
        if (!answerText) {
          return;
        }
        answers.push({
          questionId: question.id,
          answerText,
          ...(existing?.annotation ? { annotation: existing.annotation } : {}),
        });
        return;
      }
      if (!existing?.selectedOptionId || !existing.selectedOptionLabel) {
        return;
      }
      answers.push({
        questionId: question.id,
        selectedOptionId: existing.selectedOptionId,
        selectedOptionLabel: existing.selectedOptionLabel,
        ...(existing.annotation ? { annotation: existing.annotation } : {}),
      });
    });
    if (answers.length !== snapshot.questions.length) {
      const firstMissingIndex = findFirstUnansweredQuestionIndex(snapshot, answersByQuestionId);
      if (firstMissingIndex >= 0) {
        setQuestionPanelState((previous) => ({
          ...previous,
          currentQuestionIndex: firstMissingIndex,
        }));
      }
      setSlashPanelNotice({
        tone: "danger",
        text: "You still have unanswered questions.",
      });
      return;
    }
    const child = childRef.current;
    if (!child || child.killed || backendStatus === "failed") {
      appendInlineError("backend unavailable, cannot submit question answers");
      setSlashPanelNotice({
        tone: "danger",
        text: "Backend unavailable, cannot submit answers",
      });
      return;
    }
    const requestedAt = new Date().toISOString();
    try {
      child.stdin.write(`${JSON.stringify({
        type: "direct_question_answer",
        requestId: snapshot.requestId,
        answers,
        currentIndex: questionPanelState.currentQuestionIndex,
        isFinal: true,
      })}\u0000`);
    } catch (error) {
      appendInlineError(`Failed to submit answers: ${error instanceof Error ? error.message : String(error)}`);
      setSlashPanelNotice({
        tone: "danger",
        text: "Question answer submission failed",
      });
      return;
    }
    setConversationActivated(true);
    setRunIndicator({
      startedAt: requestedAt,
      label: "submitting answers",
    });
    const receiptPayload = buildQuestionReceiptPayload({
      snapshot,
      answers,
    });
    appendQuestionReceipt(
      receiptPayload,
      buildQuestionReceiptText({
        snapshot,
        answers,
      }),
    );
    setComposerState(createTuiTextInputState());
    setComposerAttachments([]);
    setComposerPastedContents([]);
    setComposerFileReferences([]);
    setQuestionPanelState(createEmptyQuestionPanelState());
    setSlashPanelNotice(null);
    setActiveSlashPanelId(null);
  };

  const confirmCurrentQuestionAnswer = () => {
    const snapshot = resolveActiveQuestionSnapshot();
    const currentQuestion = resolveCurrentQuestionPrompt(snapshot);
    if (!snapshot || !currentQuestion) {
      return;
    }
    const noteMode = isQuestionNoteModeActive(questionPanelState, currentQuestion);
    const currentValue = resolveCurrentQuestionComposerText();
    if (currentQuestion.kind === "freeform" && !noteMode) {
      if (currentValue.length === 0) {
        setSlashPanelNotice({
          tone: "danger",
          text: "You still have unanswered questions.",
        });
        return;
      }
    } else if (currentQuestion.kind === "choice") {
      const activeOptionIndex = questionPanelState.activeOptionIndexByQuestionId[currentQuestion.id] ?? 0;
      const selectedOption = currentQuestion.options[activeOptionIndex];
      if (!selectedOption) {
        setSlashPanelNotice({
          tone: "danger",
          text: "You still have unanswered questions.",
        });
        return;
      }
    }

    const nextAnswersByQuestionId = buildNextQuestionAnswersByQuestionId({
      state: questionPanelState,
      question: currentQuestion,
      composerValue: currentValue,
      noteMode,
    });
    const isLastQuestion = questionPanelState.currentQuestionIndex >= snapshot.questions.length - 1;
    if (!isLastQuestion) {
      setQuestionPanelState((previous) => ({
        ...previous,
        answersByQuestionId: nextAnswersByQuestionId,
        noteModeByQuestionId: noteMode
          ? {
              ...previous.noteModeByQuestionId,
              [currentQuestion.id]: false,
            }
          : previous.noteModeByQuestionId,
        currentQuestionIndex: clampQuestionIndex(previous.currentQuestionIndex + 1, snapshot.questions.length),
      }));
      setSlashPanelNotice(null);
      return;
    }
    const firstMissingIndex = findFirstUnansweredQuestionIndex(
      snapshot,
      nextAnswersByQuestionId,
      currentQuestion.kind === "freeform" && !noteMode ? currentQuestion.id : undefined,
      currentQuestion.kind === "freeform" && !noteMode ? currentValue : "",
    );
    if (firstMissingIndex >= 0) {
      setQuestionPanelState((previous) => ({
        ...previous,
        answersByQuestionId: nextAnswersByQuestionId,
        noteModeByQuestionId: noteMode
          ? {
              ...previous.noteModeByQuestionId,
              [currentQuestion.id]: false,
            }
          : previous.noteModeByQuestionId,
        currentQuestionIndex: firstMissingIndex,
      }));
      setSlashPanelNotice({
        tone: "danger",
        text: "You still have unanswered questions.",
      });
      return;
    }
    submitAllQuestionAnswers(snapshot, nextAnswersByQuestionId);
  };

  const openWorkspacePicker = (initialQuery = "") => {
    closeModelPicker();
    clearPermissionsPanelReturnTimer();
    setActiveSlashPanelId(null);
    setSlashPanelDraft({});
    setSlashPanelInputState(createTuiTextInputState());
    setSlashPanelNotice(null);
    setPanelRenameTarget(null);
    setWorkspacePickerInputState(createTuiTextInputState(initialQuery));
    setSelectedComposerPopupIndex(0);
    setComposerPopupPageIndex(0);
    setComposerState(createTuiTextInputState());
    setComposerAttachments([]);
    setComposerPastedContents([]);
    setComposerFileReferences([]);
  };

  const exitWorkspacePickerToNormalComposer = () => {
    closeWorkspacePicker();
    setComposerState(createTuiTextInputState());
  };

  useEffect(() => {
    setComposerAttachments((previous) =>
      previous.filter((attachment) =>
        attachment.tokenText ? composerState.value.includes(attachment.tokenText) : true));
  }, [composerState.value]);
  useEffect(() => {
    setComposerPastedContents((previous) =>
      previous.filter((entry) => composerState.value.includes(entry.tokenText)));
  }, [composerState.value]);
  useEffect(() => {
    setComposerFileReferences((previous) =>
      previous.filter((entry) => composerState.value.includes(entry.tokenText)));
  }, [composerState.value]);
  useEffect(() => {
    let cancelled = false;
    setWorkspaceIndexStatus("loading");
    setWorkspaceIndexError(null);
    void loadWorkspaceIndex(currentCwd)
      .then((snapshot) => {
        if (cancelled) {
          return;
        }
        setWorkspaceIndexSnapshot(snapshot);
        setWorkspaceIndexStatus("ready");
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setWorkspaceIndexSnapshot(null);
        setWorkspaceIndexStatus("error");
        setWorkspaceIndexError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [currentCwd]);

  const insertPastedText = (text: string) => {
    if (!text) {
      return;
    }
    if (text.length > PASTED_CONTENT_COMPRESSION_THRESHOLD) {
      const nextIndex = nextComposerPastedContentIndexRef.current;
      nextComposerPastedContentIndexRef.current += 1;
      const pastedContent = createPastedContentAttachment(text, nextIndex);
      setComposerPastedContents((previous) => [...previous, pastedContent]);
      setComposerState((previous) => insertIntoTuiTextInput(previous, pastedContent.tokenText));
      return;
    }
    setComposerState((previous) => insertIntoTuiTextInput(previous, text));
  };

  const flushPendingPasteText = () => {
    if (pendingPasteTimerRef.current) {
      clearTimeout(pendingPasteTimerRef.current);
      pendingPasteTimerRef.current = null;
    }
    const text = pendingPasteTextRef.current;
    pendingPasteTextRef.current = "";
    if (!text) {
      return;
    }
    insertPastedText(text);
  };

  const enqueuePastedText = (text: string) => {
    if (!text) {
      return;
    }
    pendingPasteTextRef.current += text;
    if (pendingPasteTimerRef.current) {
      clearTimeout(pendingPasteTimerRef.current);
    }
    pendingPasteTimerRef.current = setTimeout(() => {
      flushPendingPasteText();
    }, PASTE_AGGREGATION_WINDOW_MS);
  };

  useEffect(() => () => {
    if (pendingPasteTimerRef.current) {
      clearTimeout(pendingPasteTimerRef.current);
    }
  }, []);
  useEffect(() => () => {
    closeWorkspacePicker();
  }, []);
  useEffect(() => () => {
    clearPermissionsPanelReturnTimer();
  }, []);

  const startAssistantSegment = (turnId: string): string => {
    const nextIndex = (assistantSegmentIndexRef.current.get(turnId) ?? 0) + 1;
    assistantSegmentIndexRef.current.set(turnId, nextIndex);
    const messageId = `assistant:${turnId}:${nextIndex}`;
    activeAssistantMessageIdRef.current.set(turnId, messageId);
    return messageId;
  };

  const closeAssistantSegment = (turnId: string) => {
    activeAssistantMessageIdRef.current.delete(turnId);
  };

  const resetAssistantTurnState = (turnId: string) => {
    assistantSegmentIndexRef.current.delete(turnId);
    activeAssistantMessageIdRef.current.delete(turnId);
    emittedAssistantTextRef.current.delete(turnId);
    rawAssistantDeltaTextRef.current.delete(turnId);
  };

  const resetSwitchRuntimeState = () => {
    completedTurnIdsRef.current.clear();
    interruptedTurnIdsRef.current.clear();
    activeTasksRef.current = [];
    activeTurnIdsRef.current = new Set<string>();
    assistantSegmentIndexRef.current.clear();
    activeAssistantMessageIdRef.current.clear();
    emittedAssistantTextRef.current.clear();
    rawAssistantDeltaTextRef.current.clear();
    turnUserTextRef.current.clear();
    toolFamilyStateRef.current.clear();
    toolSummaryRevisionRef.current.clear();
    pendingTranscriptRewindRef.current = null;
    pendingOutboundTurnsRef.current = [];
    rewindPrimedAtRef.current = 0;
    stdoutRemainderRef.current = "";
    stderrRemainderRef.current = "";
    processedLogByteOffsetRef.current = 0;
    setRunIndicator(null);
    setLogPath(null);
    setRewindOverlayState(null);
    setRewindInFlight(null);
  };

  const updateWorkspaceSurface = (nextCwd: string) => {
    const at = new Date().toISOString();
    const currentSession = surfaceState.session;
    dispatchSurfaceEvent({
      type: "session.updated",
      at,
      session: createSurfaceSession({
        sessionId: sessionIdRef.current,
        startedAt: currentSession?.startedAt ?? at,
        updatedAt: at,
        title: currentSession?.title,
        status: currentSession?.status,
        activeTurnId: currentSession?.activeTurnId,
        currentRunId: currentSession?.currentRunId,
        uiMode: "direct",
        workspaceLabel: nextCwd.split("/").slice(-1)[0] || nextCwd,
        route: config?.baseURL ?? "(unconfigured)",
        model: currentSession?.model,
        transcriptMessageIds: currentSession?.transcriptMessageIds ?? [],
        taskIds: currentSession?.taskIds ?? [],
      }),
    });
  };

  useEffect(() => {
    if (initialBootState.surfaceState.session) {
      return;
    }
    const startedAt = new Date().toISOString();
    dispatchSurfaceEvent({
      type: "session.started",
      at: startedAt,
      session: createSurfaceSession({
        sessionId: sessionIdRef.current,
        startedAt,
        updatedAt: startedAt,
        uiMode: "direct",
        workspaceLabel: currentCwd.split("/").slice(-1)[0] || currentCwd,
        route: config?.baseURL ?? "(unconfigured)",
        transcriptMessageIds: [],
        taskIds: [],
      }),
    });
  }, [initialBootState.surfaceState.session]);

  useEffect(() => {
    const handleResize = () => {
      setTerminalSize({
        rows: process.stdout.rows ?? 24,
        columns: process.stdout.columns ?? 80,
      });
    };
    process.stdout.on("resize", handleResize);
    return () => {
      process.stdout.off("resize", handleResize);
    };
  }, [backendEpoch]);

  const activeTasks = useMemo(
    () => selectActiveTasks(surfaceState),
    [surfaceState],
  );
  const interruptibleTasks = useMemo(
    () => selectInterruptibleTasks(surfaceState).filter((task) => isInterruptibleForegroundTask(task)),
    [surfaceState],
  );
  const activeCmpTask = useMemo(
    () => activeTasks.find((task) => task.kind === "cmp_sync"),
    [activeTasks],
  );
  const activeCmpStage = useMemo(() => {
    const stageFromMetadata = activeCmpTask?.metadata?.stage;
    const candidate = typeof stageFromMetadata === "string" && stageFromMetadata.trim().length > 0
      ? stageFromMetadata
      : (activeCmpTask?.title ?? activeCmpTask?.summary);
    return typeof candidate === "string" && candidate.startsWith("cmp/")
      ? candidate
      : undefined;
  }, [activeCmpTask?.metadata, activeCmpTask?.summary, activeCmpTask?.title]);
  const transcriptMessages = useMemo(
    () => selectTranscriptMessages(surfaceState),
    [surfaceState],
  );
  const turnCheckpointRecords = useMemo(
    () => listDirectTuiTurnCheckpoints(sessionIdRef.current, currentCwd),
    [checkpointRevision, currentCwd],
  );
  const rewindTurnOptions = useMemo(
    () => buildDirectTuiRewindTurnOptions({
      messages: transcriptMessages,
      checkpoints: turnCheckpointRecords,
    }),
    [transcriptMessages, turnCheckpointRecords],
  );
  const rewindModeOptions = useMemo(
    () => buildDirectTuiRewindModeOptions(
      rewindOverlayState ? rewindTurnOptions[rewindOverlayState.selectedTurnIndex] : undefined,
    ),
    [rewindOverlayState, rewindTurnOptions],
  );
  useEffect(() => {
    if (transcriptMessages.some((message) => message.kind === "user")) {
      setConversationActivated(true);
    }
  }, [transcriptMessages]);
  useEffect(() => {
    transcriptMessagesRef.current = transcriptMessages;
  }, [transcriptMessages]);
  const allSessionRecords = useMemo(
    () => listDirectTuiSessions(currentCwd),
    [currentCwd, sessionIndexRevision],
  );
  const persistedAgentRegistry = useMemo(
    () => listDirectTuiAgents(currentCwd),
    [agentRegistryRevision, currentCwd],
  );
  const persistedSessionSnapshot = useMemo(
    () => loadDirectTuiSessionSnapshot(sessionIdRef.current, currentCwd),
    [currentCwd, selectedAgentId, sessionIndexRevision, sessionName],
  );
  const mergedAgentRegistry = useMemo(() => persistedAgentRegistry, [persistedAgentRegistry]);
  const agentEntries = useMemo(
    () => buildAgentEntries({
      agents: mergedAgentRegistry,
      selectedAgentId,
    }),
    [mergedAgentRegistry, selectedAgentId],
  );
  const sessionRecords = useMemo(
    () => allSessionRecords.filter((session) => session.agentId === selectedAgentId),
    [allSessionRecords, selectedAgentId],
  );
  const activeTurnIds = useMemo(
    () => new Set(
      interruptibleTasks
        .map((task) => task.turnId)
        .filter((turnId): turnId is string => typeof turnId === "string" && turnId.length > 0),
    ),
    [interruptibleTasks],
  );
  const terminalTitleBusy = Boolean(runIndicator) || interruptibleTasks.length > 0;
  useEffect(() => {
    writeTerminalTitle(buildRaxodeTerminalTitle());
    if (!terminalTitleBusy) {
      return;
    }
    let frameIndex = 0;
    writeTerminalTitle(buildRaxodeTerminalTitle(frameIndex));
    const timer = setInterval(() => {
      frameIndex = (frameIndex + 1) % RAXODE_TERMINAL_TITLE_MOON_PHASES.length;
      writeTerminalTitle(buildRaxodeTerminalTitle(frameIndex));
    }, TERMINAL_TITLE_SPINNER_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      writeTerminalTitle(buildRaxodeTerminalTitle());
    };
  }, [terminalTitleBusy]);
  useEffect(() => {
    activeTasksRef.current = activeTasks;
    interruptibleTasksRef.current = interruptibleTasks;
    activeTurnIdsRef.current = activeTurnIds;
  }, [activeTasks, activeTurnIds, interruptibleTasks]);
  useEffect(() => {
    if (!rewindOverlayState) {
      rewindPrimedAtRef.current = 0;
      return;
    }
    setRewindOverlayState((previous) => {
      if (!previous) {
        return previous;
      }
      const selectedTurnIndex = rewindTurnOptions.length === 0
        ? 0
        : Math.min(previous.selectedTurnIndex, rewindTurnOptions.length - 1);
      const selectedModeIndex = rewindModeOptions.length === 0
        ? 0
        : Math.min(previous.selectedModeIndex, rewindModeOptions.length - 1);
      if (
        selectedTurnIndex === previous.selectedTurnIndex
        && selectedModeIndex === previous.selectedModeIndex
      ) {
        return previous;
      }
      return {
        ...previous,
        selectedTurnIndex,
        selectedModeIndex,
      };
    });
  }, [rewindModeOptions.length, rewindOverlayState, rewindTurnOptions.length]);

  const resetRewindPriming = () => {
    rewindPrimedAtRef.current = 0;
  };

  const closeRewindOverlay = () => {
    setRewindOverlayState(null);
    resetRewindPriming();
  };

  const openRewindOverlay = (notice?: SlashPanelNotice) => {
    if (rewindTurnOptions.length === 0) {
      appendInlineStatus("No user turns are available for rewind yet.", "notice");
      resetRewindPriming();
      return;
    }
    setRewindOverlayState({
      stage: "turn",
      selectedTurnIndex: 0,
      selectedModeIndex: 0,
      notice: notice ?? null,
    });
    resetRewindPriming();
  };

  const restoreWorkspaceFromCheckpoint = async (
    option: Pick<
      DirectTuiRewindTurnOption,
      "agentId" | "turnId" | "turnIndex" | "messageId" | "createdAt" | "userText" | "workspaceCheckpointRef"
    >,
  ): Promise<WorkspaceGitCheckpointRestoreResult> => {
    if (!option.workspaceCheckpointRef) {
      throw new Error("No workspace checkpoint is available for the selected turn.");
    }
    return await restoreWorkspaceGitCheckpointInSubprocess({
      appRoot,
      sessionId: sessionIdRef.current,
      workspaceRoot: currentCwd,
      checkpointRef: option.workspaceCheckpointRef,
      agentId: option.agentId,
    });
  };

  const finalizeTranscriptRewind = (
    pending: PendingTranscriptRewind,
    at: string,
  ): void => {
    setRewindInFlightPhase("finalizing");
    const rewoundSurfaceState = rewindSurfaceStateToTurn(
      surfaceStateRef.current,
      pending.selectedTurnId,
      at,
      pending.transcriptCutMessageId,
    );
    setSurfaceState(rewoundSurfaceState);
    completedTurnIdsRef.current = new Set([...completedTurnIdsRef.current]
      .filter((turnId) => parseDirectTuiTurnIndex(turnId) < pending.selectedTurnIndex));
    interruptedTurnIdsRef.current = new Set([...interruptedTurnIdsRef.current]
      .filter((turnId) => parseDirectTuiTurnIndex(turnId) < pending.selectedTurnIndex));
    activeTasksRef.current = [];
    activeTurnIdsRef.current.clear();
    toolFamilyStateRef.current.clear();
    toolSummaryRevisionRef.current.clear();
    assistantSegmentIndexRef.current.clear();
    activeAssistantMessageIdRef.current.clear();
    emittedAssistantTextRef.current.clear();
    rawAssistantDeltaTextRef.current.clear();
    turnUserTextRef.current = new Map(
      [...turnUserTextRef.current.entries()]
        .filter(([turnId]) => parseDirectTuiTurnIndex(turnId) < pending.selectedTurnIndex),
    );
    setRunIndicator(null);
    const rewoundMessages = Array.isArray((rewoundSurfaceState as { messages?: SurfaceMessage[] }).messages)
      ? (rewoundSurfaceState as { messages: SurfaceMessage[] }).messages
      : [];
    setConversationActivated(rewoundMessages.some((message) => message.kind === "user"));
    setComposerState(createTuiTextInputState(pending.userText));
    setComposerAttachments([]);
    setComposerPastedContents([]);
    setComposerFileReferences([]);
    setScrollOffset(0);
    finishRewindInFlight();
  };

  const requestTranscriptRewind = (
    option: DirectTuiRewindTurnOption,
    mode: DirectTuiRewindMode,
  ) => {
    const child = childRef.current;
    if (!child || child.killed || backendStatus === "failed") {
      appendInlineError("Backend unavailable, cannot rewind conversation right now.");
      return;
    }
    const rewindRequestTurnIndex = Math.max(0, option.turnIndex - 1);
    pendingTranscriptRewindRef.current = {
      agentId: option.agentId,
      selectedTurnId: option.turnId,
      selectedTurnIndex: option.turnIndex,
      rewindRequestTurnIndex,
      mode,
      transcriptCutMessageId: option.transcriptCutMessageId,
      workspaceCheckpointRef: option.workspaceCheckpointRef,
      userText: option.userText,
    };
    beginRewindInFlight(mode, "pending_backend_rewind");
    try {
      child.stdin.write(`/rewind ${rewindRequestTurnIndex}\u0000`);
    } catch (error) {
      pendingTranscriptRewindRef.current = null;
      finishRewindInFlight();
      appendInlineError(`Failed to request rewind: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    closeRewindOverlay();
  };

  const persistPreTurnCheckpoint = async (params: {
    turnId: string;
    createdAt: string;
    userText: string;
    transcriptCutMessageId?: string;
  }): Promise<void> => {
    const displayUser = await buildRewindDisplayUserText({
      sessionId: sessionIdRef.current,
      turnId: params.turnId,
      userText: params.userText,
    });
    const gitReadback = await readWorkspaceRaxodeGitReadback({
      workspaceRoot: currentCwd,
      agentId: selectedAgentId || "agent.core:main",
    }).catch(() => undefined);
    try {
      const checkpoint = await writeWorkspaceGitCheckpoint({
        sessionId: sessionIdRef.current,
        turnId: params.turnId,
        workspaceRoot: currentCwd,
        agentId: selectedAgentId || "agent.core:main",
      });
      upsertDirectTuiTurnCheckpoint(sessionIdRef.current, {
        sessionId: sessionIdRef.current,
        agentId: selectedAgentId || "agent.core:main",
        turnId: params.turnId,
        turnIndex: parseDirectTuiTurnIndex(params.turnId),
        messageId: `user:${params.turnId}`,
        transcriptCutMessageId: params.transcriptCutMessageId,
        createdAt: params.createdAt,
        userText: params.userText,
        displayUserText: displayUser.displayUserText,
        displayUserTextSource: displayUser.displayUserTextSource,
        workspaceRoot: currentCwd,
        git: gitReadback,
        workspaceCheckpointRef: checkpoint.checkpointRef,
        workspaceCheckpointCommit: checkpoint.commitSha,
      }, currentCwd);
      appendDirectTuiCheckpointEvent({
        sessionId: sessionIdRef.current,
        turnId: params.turnId,
        workspaceRoot: currentCwd,
        createdAt: params.createdAt,
        status: "checkpoint_written",
        checkpointRef: checkpoint.checkpointRef,
        checkpointCommit: checkpoint.commitSha,
      });
    } catch (error) {
      const failure = resolveWorkspaceCheckpointFailure({
        error,
        workspaceRoot: currentCwd,
      });
      upsertDirectTuiTurnCheckpoint(sessionIdRef.current, {
        sessionId: sessionIdRef.current,
        agentId: selectedAgentId || "agent.core:main",
        turnId: params.turnId,
        turnIndex: parseDirectTuiTurnIndex(params.turnId),
        messageId: `user:${params.turnId}`,
        transcriptCutMessageId: params.transcriptCutMessageId,
        createdAt: params.createdAt,
        userText: params.userText,
        displayUserText: displayUser.displayUserText,
        displayUserTextSource: displayUser.displayUserTextSource,
        workspaceRoot: currentCwd,
        git: gitReadback,
        workspaceCheckpointError: failure.uiError,
        workspaceCheckpointErrorCode: failure.code,
        workspaceCheckpointErrorOrigin: failure.origin,
        workspaceCheckpointErrorMessage: failure.rawMessage,
      }, currentCwd);
      appendDirectTuiCheckpointEvent({
        sessionId: sessionIdRef.current,
        turnId: params.turnId,
        workspaceRoot: currentCwd,
        createdAt: params.createdAt,
        status: "checkpoint_failed",
        errorCode: failure.code,
        errorOrigin: failure.origin,
        errorMessage: failure.rawMessage,
      });
    } finally {
      setCheckpointRevision((previous) => previous + 1);
    }
  };

  useEffect(() => {
    if (!selectedAgentId && agentEntries.length > 0) {
      setSelectedAgentId(agentEntries[0]?.agentId ?? "");
    }
  }, [agentEntries, selectedAgentId]);
  useEffect(() => {
    if (persistedAgentRegistry.some((agent) => agent.agentId === "agent.core:main")) {
      return;
    }
    saveDirectTuiAgent({
      agentId: "agent.core:main",
      name: "core",
      kind: "core",
      status: "idle",
      summary: "current direct shell agent",
      workspace: currentCwd,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, currentCwd);
    setAgentRegistryRevision((previous) => previous + 1);
  }, [currentCwd, persistedAgentRegistry]);
  useEffect(() => {
    const now = new Date().toISOString();
    const existing = loadDirectTuiSessionSnapshot(sessionIdRef.current, currentCwd);
    const usageLedger = sessionUsageLedgerRef.current.slice();
    const resumeSessions = listDirectTuiSessions(currentCwd)
      .filter((session) => session.sessionId !== sessionIdRef.current);
    const exitSummary = buildDirectTuiSessionExitSummary({
      snapshot: {
        sessionId: sessionIdRef.current,
        name: sessionName,
        usageLedger,
      },
      sessions: [
        ...resumeSessions,
        {
          sessionId: sessionIdRef.current,
          name: sessionName,
        },
      ],
      generatedAt: now,
    });
    saveDirectTuiSessionSnapshot({
      schemaVersion: 1,
      sessionId: sessionIdRef.current,
      agentId: selectedAgentId || existing?.agentId || "agent.core:main",
      name: sessionName,
      workspace: currentCwd,
      route: config?.baseURL ?? "(unconfigured)",
      model: runtimeConfig?.modelPlan.core.main.model ?? "gpt-5.4",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      selectedAgentId,
      agents: existing?.agents ?? [],
      messages: transcriptMessagesToSessionRecords(transcriptMessages),
      usageLedger,
      exitSummary,
    }, currentCwd);
  }, [config?.baseURL, currentCwd, runtimeConfig?.modelPlan.core.main.model, selectedAgentId, sessionName, sessionUsageRevision, transcriptMessages]);
  useEffect(() => {
    if (!selectedAgentId) {
      return;
    }
    const existing = persistedAgentRegistry.find((agent) => agent.agentId === selectedAgentId);
    const latestAssistant = [...transcriptMessages].reverse().find((message) => message.kind === "assistant")?.text;
    const nextSummary = latestAssistant ? compactRuntimeText(latestAssistant) : (existing?.summary ?? "current direct shell agent");
    const nextStatus = activeTasks.length > 0 ? "active" : "idle";
    const nextName = existing?.name ?? (selectedAgentId === "agent.core:main" ? "core" : "new-agent");
    const nextKind = existing?.kind ?? (selectedAgentId.startsWith("agent.core:") ? "core" : "task");
    if (
      existing
      && existing.name === nextName
      && existing.kind === nextKind
      && existing.status === nextStatus
      && existing.summary === nextSummary
      && existing.workspace === currentCwd
      && existing.lastSessionId === sessionIdRef.current
    ) {
      return;
    }
    saveDirectTuiAgent({
      agentId: selectedAgentId,
      name: nextName,
      kind: nextKind,
      status: nextStatus,
      summary: nextSummary,
      workspace: currentCwd,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSessionId: sessionIdRef.current,
    }, currentCwd);
    setAgentRegistryRevision((previous) => previous + 1);
  }, [activeTasks.length, currentCwd, persistedAgentRegistry, selectedAgentId, transcriptMessages]);
  useEffect(() => {
    if (!selectedAgentId) {
      return;
    }
    let cancelled = false;
    void readWorkspaceRaxodeGitReadback({
      workspaceRoot: currentCwd,
      agentId: selectedAgentId,
    }).then((gitReadback) => {
      if (cancelled) {
        return;
      }
      const now = new Date().toISOString();
      upsertWorkspaceRaxodeAgent({
        agentId: selectedAgentId,
        workspaceRoot: currentCwd,
        currentSessionId: sessionIdRef.current,
        depth: 0,
        createdAt: now,
        updatedAt: now,
        git: gitReadback,
      });
    }).catch(() => {
      // local workspace metadata should not block TUI interaction
    });
    return () => {
      cancelled = true;
    };
  }, [currentCwd, selectedAgentId]);
  const cmpStatusDescriptor = useMemo(
    () => deriveDirectTuiCmpStatusDescriptor({
      activeStage: activeCmpStage,
      snapshot: cmpViewerSnapshot,
    }),
    [activeCmpStage, cmpViewerSnapshot],
  );
  const directTuiAnimationMode = useMemo<RaxodeAnimationMode>(() => {
    const envMode = process.env.PRAXIS_BOOTSTRAP_MODE;
    if (isRaxodeAnimationMode(envMode)) {
      return envMode;
    }
    if (isRaxodeAnimationMode(configFile?.ui.animationMode)) {
      return configFile.ui.animationMode;
    }
    if (isRaxodeAnimationMode(runtimeConfig?.ui.animationMode)) {
      return runtimeConfig.ui.animationMode;
    }
    return "fresh";
  }, [configFile?.ui.animationMode, runtimeConfig?.ui.animationMode]);
  const cmpContextActive = cmpStatusDescriptor.animated;
  const startupAnimationStep = useMemo(() => {
    const maxStep = STARTUP_WORD.length + STARTUP_RAINBOW_COLORS.length;
    if (directTuiAnimationMode !== "fresh") {
      return maxStep;
    }
    const step = Math.floor((animationTick * ANIMATION_TICK_MS) / STARTUP_ANIMATION_INTERVAL_MS);
    return Math.min(maxStep, step);
  }, [animationTick, directTuiAnimationMode]);
  const cmpContextAnimationFrame = cmpContextActive
    ? Math.floor(animationTick / 8)
    : 0;
  const runStatusAnimationFrame = runIndicator
    ? Math.floor(animationTick / 8)
    : 0;
  const rewindAnimationFrame = rewindInFlight
    ? Math.floor(animationTick / REWIND_SPINNER_FRAME_STEP)
    : 0;
  const questionPanelActive = activeSlashPanelId === "question" && questionViewerSnapshot?.status === "active";
  const questionAnimationFrame = Math.floor(animationTick / 6);
  const toolSummaryAnimationFrame = Math.floor(animationTick / 5);
  const shouldAnimate =
    (directTuiAnimationMode === "fresh" && startupAnimationStep < STARTUP_WORD.length + STARTUP_RAINBOW_COLORS.length)
    || cmpContextActive
    || Boolean(runIndicator)
    || Boolean(rewindInFlight)
    || questionPanelActive;

  useEffect(() => {
    if (!shouldAnimate) {
      return;
    }
    const timer = setInterval(() => {
      setAnimationTick((previous) => previous + 1);
    }, ANIMATION_TICK_MS);
    return () => {
      clearInterval(timer);
    };
  }, [shouldAnimate]);

  useEffect(() => {
    if (!process.stdout.isTTY) {
      return;
    }
    process.stdout.write("\u001B[?1000h\u001B[?1006h");
    return () => {
      process.stdout.write("\u001B[?1000l\u001B[?1006l");
    };
  }, []);

  useEffect(() => {
    clearInitCompletedAutoCloseTimer();
    dispatchSurfaceEvent({
      type: "composer.updated",
      at: new Date().toISOString(),
      composer: {
        value: "",
        buffer: "",
        cursorOffset: 0,
        disabled: backendStatus === "failed",
      },
    });
  }, [backendStatus]);
  useEffect(() => {
    if (backendStatus === "ready" && pendingInitNote) {
      setPendingInitNote(null);
    }
  }, [backendStatus, pendingInitNote]);
  useEffect(() => {
    if (backendStatus !== "failed" || !pendingSessionSwitch) {
      return;
    }
    clearPendingSessionSwitchTimeout();
    setSlashPanelNotice({
      tone: "danger",
      text: "Session switch failed because the backend did not restart correctly.",
    });
    setPendingSessionSwitch(null);
    backendLaunchWorkspaceRef.current = currentCwd;
    backendLaunchSessionIdRef.current = sessionIdRef.current;
    backendRestartPendingRef.current = true;
    setBackendStatus("starting");
    setBackendEpoch((previous) => previous + 1);
  }, [backendStatus, currentCwd, pendingSessionSwitch]);
  useEffect(() => {
    pendingSessionSwitchRef.current = pendingSessionSwitch;
  }, [pendingSessionSwitch]);
  useEffect(() => {
    clearPendingSessionSwitchTimeout();
    if (!pendingSessionSwitch) {
      return;
    }
    pendingSessionSwitchTimeoutRef.current = setTimeout(() => {
      pendingSessionSwitchTimeoutRef.current = null;
      if (pendingSessionSwitchRef.current?.targetSessionId !== pendingSessionSwitch.targetSessionId) {
        return;
      }
      setSlashPanelNotice({
        tone: "danger",
        text: `Timed out while restoring ${pendingSessionSwitch.targetSessionName}.`,
      });
      setPendingSessionSwitch(null);
      backendLaunchWorkspaceRef.current = currentCwd;
      backendLaunchSessionIdRef.current = sessionIdRef.current;
      backendRestartPendingRef.current = true;
      setBackendStatus("starting");
      setBackendEpoch((previous) => previous + 1);
    }, SESSION_SWITCH_TIMEOUT_MS);
    return () => {
      clearPendingSessionSwitchTimeout();
    };
  }, [currentCwd, pendingSessionSwitch]);

  useEffect(() => {
    const tsxBin = resolve(appRoot, "node_modules/.bin/tsx");
    const sourceBackendPath = resolve(appRoot, "src/agent_core/live-agent-chat.ts");
    const distBackendPath = resolve(appRoot, "dist/agent_core/live-agent-chat.js");
    const configRoot = resolveConfigRoot(appRoot);
    const stateRoot = resolveStateRoot(appRoot);
    const launchWorkspace = backendLaunchWorkspaceRef.current ?? currentCwd;
    const launchSessionId = backendLaunchSessionIdRef.current ?? sessionIdRef.current;
    backendLaunchWorkspaceRef.current = null;
    backendLaunchSessionIdRef.current = null;
    const backendCommand = existsSync(sourceBackendPath) ? tsxBin : process.execPath;
    const backendArgs = existsSync(sourceBackendPath)
      ? [sourceBackendPath, "--ui=direct"]
      : [distBackendPath, "--ui=direct"];
    const child = spawn(
      backendCommand,
      backendArgs,
      {
        cwd: launchWorkspace,
        env: {
          ...process.env,
          PRAXIS_APP_ROOT: appRoot,
          PRAXIS_CONFIG_ROOT: configRoot,
          PRAXIS_STATE_ROOT: stateRoot,
          PRAXIS_WORKSPACE_ROOT: launchWorkspace,
          PRAXIS_DIRECT_SESSION_ID: launchSessionId,
          ...(pendingInitNote
            ? {
              PRAXIS_DIRECT_INIT_NOTE: pendingInitNote,
            }
            : {}),
        },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    childRef.current = child;

    const flushChunk = (chunk: string, stream: "stdout" | "stderr") => {
      const clean = stripAnsi(chunk).replace(/\r/gu, "");
      const previousRemainder = stream === "stdout" ? stdoutRemainderRef.current : stderrRemainderRef.current;
      const combined = previousRemainder + clean;
      const parts = combined.split("\n");
      const remainder = parts.pop() ?? "";
      if (stream === "stdout") {
        stdoutRemainderRef.current = remainder;
      } else {
        stderrRemainderRef.current = remainder;
      }

      for (const rawLine of parts) {
        const line = rawLine.trimEnd();
        if (!line) {
          continue;
        }
        if (line.startsWith("log file: ")) {
          setLogPath(line.slice("log file: ".length).trim());
          continue;
        }
        const readySessionId = parseDirectReadySessionId(line);
        if (readySessionId) {
          if (readySessionId === sessionIdRef.current || readySessionId === launchSessionId) {
            setBackendStatus("ready");
          }
          continue;
        }
        if (stream === "stderr") {
          const at = new Date().toISOString();
          dispatchSurfaceEvent({
            type: "error.reported",
            at,
            message: createSurfaceMessage({
              messageId: `stderr:${at}`,
              kind: "error",
              createdAt: at,
              text: line,
              status: "warning",
            }),
          });
        }
      }
    };

    child.stdout.on("data", (chunk: Buffer | string) => {
      flushChunk(typeof chunk === "string" ? chunk : chunk.toString("utf8"), "stdout");
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      flushChunk(typeof chunk === "string" ? chunk : chunk.toString("utf8"), "stderr");
    });
    child.on("error", (error) => {
      setRunIndicator(null);
      setBackendStatus("failed");
      const at = new Date().toISOString();
      dispatchSurfaceEvent({
        type: "error.reported",
        at,
        message: createSurfaceMessage({
          messageId: `spawn:${at}`,
          kind: "error",
          createdAt: at,
          text: `backend spawn failed: ${error.message}`,
        }),
      });
    });
    child.on("close", (code, signal) => {
      setRunIndicator(null);
      const wasInterrupted = interruptPendingRef.current;
      const restartPending = backendRestartPendingRef.current;
      const wasReplaced = childRef.current !== child;
      interruptPendingRef.current = false;
      backendRestartPendingRef.current = false;
      if (wasInterrupted) {
        interruptedTurnIdsRef.current.clear();
      }
      const stderrTail = stderrRemainderRef.current.trim();
      stdoutRemainderRef.current = "";
      stderrRemainderRef.current = "";
      processedLogByteOffsetRef.current = 0;
      logFileRemainderRef.current = "";
      logTickInFlightRef.current = false;
      setLogPath(null);
      if (stderrTail) {
        const at = new Date().toISOString();
        dispatchSurfaceEvent({
          type: "error.reported",
          at,
          message: createSurfaceMessage({
            messageId: `stderr-tail:${at}`,
            kind: "error",
            createdAt: at,
            text: stderrTail,
          }),
        });
      }
      failPendingOutboundTurns(code === 0 || signal === "SIGTERM"
        ? "backend exited before confirming the queued input"
        : "backend closed before confirming the queued input");
      if (wasInterrupted) {
        setBackendStatus("starting");
        setBackendEpoch((previous) => previous + 1);
        return;
      }
      if (wasReplaced) {
        return;
      }
      if (restartPending) {
        setBackendStatus("starting");
        return;
      }
      setBackendStatus(code === 0 || signal === "SIGTERM" ? "exited" : "failed");
    });

    return () => {
      if (!child.killed) {
        child.kill("SIGTERM");
      }
    };
  }, [appRoot, backendEpoch, pendingInitNote]);

  useEffect(() => {
    if (!logPath) {
      return;
    }

    let cancelled = false;
    const tick = async () => {
      if (logTickInFlightRef.current) {
        return;
      }
      logTickInFlightRef.current = true;
      try {
        while (!cancelled) {
          const handle = await open(logPath, "r");
          let nextSize = 0;
          let nextOffset = processedLogByteOffsetRef.current;
          let bytesRead = 0;
          let chunkText = "";
          try {
            const stats = await handle.stat();
            nextSize = stats.size;
            const currentOffset = processedLogByteOffsetRef.current;
            if (nextSize <= currentOffset) {
              break;
            }
            const chunkLength = Math.min(nextSize - currentOffset, LOG_TAIL_READ_CHUNK_BYTES);
            const buffer = Buffer.alloc(chunkLength);
            const readResult = await handle.read(buffer, 0, chunkLength, currentOffset);
            bytesRead = readResult.bytesRead;
            if (bytesRead <= 0) {
              break;
            }
            nextOffset = currentOffset + bytesRead;
            chunkText = buffer.toString("utf8", 0, bytesRead);
          } finally {
            await handle.close();
          }
          if (cancelled) {
            return;
          }
          processedLogByteOffsetRef.current = nextOffset;
          const raw = `${logFileRemainderRef.current}${chunkText}`;
          const splitRows = raw.split("\n");
          logFileRemainderRef.current = splitRows.pop() ?? "";
          const rows = splitRows.filter((entry) => entry.trim().length > 0);
          let processedRowCount = 0;

          for (const row of rows) {
          let record: LiveLogRecord;
          try {
            record = JSON.parse(row) as LiveLogRecord;
          } catch {
            continue;
          }

          const at = record.ts;
          const turnId = createTurnId(record.turnIndex);
          if (
            interruptedTurnIdsRef.current.has(turnId)
            && !shouldConsumeRecordAfterTurnInterrupt(record)
          ) {
            continue;
          }
          if (
            completedTurnIdsRef.current.has(turnId)
            && record.event !== "turn_start"
            && !shouldConsumeRecordAfterTurnCompletion(record)
          ) {
            continue;
          }

          if (record.event === "session_start") {
            const sessionContext = normalizeContextSnapshot(record.context);
            const activePendingSwitch = pendingSessionSwitchRef.current;
            if (
              activePendingSwitch
              && typeof record.sessionId === "string"
              && record.sessionId === activePendingSwitch.targetSessionId
            ) {
              finalizePendingSessionSwitch(activePendingSwitch, sessionContext ?? undefined);
              continue;
            }
            if (sessionContext) {
              setBackendContextSnapshot(sessionContext);
            }
            continue;
          }

          if (record.event === "panel_snapshot") {
            if (record.panel === "cmp") {
              const snapshot = normalizeCmpViewerSnapshot(record.snapshot);
              if (snapshot) {
                setCmpViewerSnapshot(snapshot);
                dispatchSurfaceEvent({
                  type: "panel.updated",
                  at,
                  panel: "cmp",
                  snapshot: {
                    title: "CMP",
                    summaryLines: snapshot.summaryLines,
                  },
                });
              }
            } else if (record.panel === "mp") {
              const snapshot = normalizeMpViewerSnapshot(record.snapshot);
              if (snapshot) {
                setMpViewerSnapshot(snapshot);
                dispatchSurfaceEvent({
                  type: "panel.updated",
                  at,
                  panel: "mp",
                  snapshot: {
                    title: "MP",
                    summaryLines: snapshot.summaryLines,
                  },
                });
              }
            } else if (record.panel === "capabilities") {
              const snapshot = normalizeCapabilityViewerSnapshot(record.snapshot);
              if (snapshot) {
                setCapabilityViewerSnapshot(snapshot);
                dispatchSurfaceEvent({
                  type: "panel.updated",
                  at,
                  panel: "tap",
                  snapshot: {
                    title: "TAP",
                    summaryLines: snapshot.summaryLines,
                  },
                });
              }
            } else if (record.panel === "init") {
              const snapshot = normalizeInitViewerSnapshot(record.snapshot);
              if (snapshot) {
                setInitViewerSnapshot(snapshot);
                if (snapshot.status === "completed") {
                  pendingInitCompletedPanelRef.current = activeSlashPanelId === "question";
                  setActiveSlashPanelId("init");
                  setSlashPanelFocusIndex(0);
                }
              }
            } else if (record.panel === "question") {
              const snapshot = normalizeQuestionViewerSnapshot(record.snapshot);
              if (snapshot) {
                setQuestionViewerSnapshot(snapshot);
                if (snapshot.status === "active") {
                  setActiveSlashPanelId("question");
                  setSlashPanelFocusIndex(0);
                } else if (pendingInitCompletedPanelRef.current) {
                  pendingInitCompletedPanelRef.current = false;
                  setActiveSlashPanelId("init");
                  setSlashPanelFocusIndex(0);
                } else if (activeSlashPanelId === "question") {
                  closeSlashPanel();
                }
              }
            }
            continue;
          }

          if (record.event === "rewind_applied" && typeof record.targetTurnId === "string") {
            const pending = pendingTranscriptRewindRef.current;
            pendingTranscriptRewindRef.current = null;
            const rewindRequestTurnIndex = Number.parseInt(record.targetTurnId, 10);
            const rewindMode = pending?.rewindRequestTurnIndex === rewindRequestTurnIndex
              ? pending
              : {
                agentId: selectedAgentId || "agent.core:main",
                selectedTurnId: Number.isFinite(rewindRequestTurnIndex)
                  ? createTurnId(rewindRequestTurnIndex)
                  : record.targetTurnId,
                selectedTurnIndex: Number.isFinite(rewindRequestTurnIndex)
                  ? rewindRequestTurnIndex
                  : parseDirectTuiTurnIndex(record.targetTurnId),
                rewindRequestTurnIndex: Number.isFinite(rewindRequestTurnIndex)
                  ? rewindRequestTurnIndex
                  : Math.max(0, parseDirectTuiTurnIndex(record.targetTurnId) - 1),
                mode: "rewind_turn_only" as const,
                userText: turnUserTextRef.current.get(
                  Number.isFinite(rewindRequestTurnIndex)
                    ? createTurnId(rewindRequestTurnIndex)
                    : record.targetTurnId,
                ) ?? "",
              };
            finalizeTranscriptRewind(rewindMode, at);
            continue;
          }

          if (record.event === "rewind_failed") {
            pendingTranscriptRewindRef.current = null;
            finishRewindInFlight();
            appendInlineError(
              typeof record.error === "string"
                ? `Rewind failed: ${record.error}`
                : "Rewind failed.",
            );
            continue;
          }

          if (record.event === "turn_start") {
            completedTurnIdsRef.current.delete(turnId);
            interruptedTurnIdsRef.current.delete(turnId);
            resetAssistantTurnState(turnId);
            const pendingOutboundTurn = consumePendingOutboundTurn(turnId);
            const normalizedUserMessage = record.userMessage?.trim()
              ?? pendingOutboundTurn?.userText
              ?? "";
            if (normalizedUserMessage) {
              turnUserTextRef.current.set(turnId, normalizedUserMessage);
            }
            dispatchSurfaceEvent({
              type: "turn.started",
              at,
              turn: createSurfaceTurn({
                turnId,
                sessionId: sessionIdRef.current,
                turnIndex: record.turnIndex ?? 0,
                status: "running",
                startedAt: at,
                updatedAt: at,
                outputMessageIds: [],
                taskIds: [],
              }),
            });
            if (normalizedUserMessage && record.inputSource !== "question_answer") {
              dispatchSurfaceEvent({
                type: "message.appended",
                at,
                message: createSurfaceMessage({
                  messageId: `user:${turnId}`,
                  sessionId: sessionIdRef.current,
                  turnId,
                  kind: "user",
                  text: normalizedUserMessage,
                  createdAt: pendingOutboundTurn?.queuedAt ?? at,
                  updatedAt: at,
                  metadata: pendingOutboundTurn
                    ? {
                      optimistic: false,
                      submissionId: pendingOutboundTurn.submissionId,
                      deliveryState: "delivered",
                    }
                    : undefined,
                }),
              });
            }
            setRunIndicator((previous) => ({
              startedAt: previous?.startedAt ?? at,
              label: "core thinking",
            }));
            continue;
          }

          if (record.event === "stage_start") {
            if (shouldBreakDirectTuiAssistantSegmentOnStageStart(record.stage)) {
              closeAssistantSegment(turnId);
            }
            dispatchSurfaceEvent({
              type: "task.upserted",
              at,
              task: createSurfaceTask({
                taskId: createTaskId(record),
                sessionId: sessionIdRef.current,
                turnId,
                kind: record.stage?.startsWith("cmp/")
                  ? "cmp_sync"
                  : (record.capabilityKey ? "capability_run" : "core_turn"),
                status: "running",
                title: record.capabilityKey ?? record.label ?? record.stage ?? "stage",
                summary: record.inputSummary ?? record.reason ?? record.label ?? record.stage,
                capabilityKey: record.capabilityKey ?? undefined,
                startedAt: at,
                updatedAt: at,
                foregroundable: true,
                metadata: {
                  stage: record.stage ?? undefined,
                },
              }),
            });
            if (record.stage === "core/run") {
              setRunIndicator({ startedAt: at, label: "core thinking" });
            } else if (record.stage === "core/capability_bridge") {
              setRunIndicator((previous) => ({
                startedAt: previous?.startedAt ?? at,
                label: buildCapabilityRunIndicatorLabel(record),
              }));
              const familyKeyFromTelemetry = typeof record.familyKey === "string" && record.familyKey.trim()
                ? record.familyKey.trim().toLowerCase()
                : null;
              const familyKey = familyKeyFromTelemetry ?? capabilityFamilyKey(record.capabilityKey);
              const shouldRenderFamilyBlock = shouldRenderCapabilityFamilyBlock({
                familyKey: familyKeyFromTelemetry,
                capabilityKey: record.capabilityKey,
              });
              if (familyKey && shouldRenderFamilyBlock) {
                const stateKey = `${turnId}:${familyKey}`;
                const previousFamily = toolFamilyStateRef.current.get(stateKey) ?? {
                  hadFailure: false,
                  intentLines: [],
                  resultLines: [],
                };
                const nextIntentLine = familyKey === "websearch"
                  ? resolveWebSearchIntentLine(record)
                  : resolveGenericFamilyIntentLine(record);
                const nextMetadataLines = familyKey === "websearch"
                  ? []
                  : resolveGenericFamilyMetadataLines(record, "start");
                const nextFamily = {
                  ...previousFamily,
                  intentLines: nextIntentLine
                    ? (
                      previousFamily.intentLines.includes(nextIntentLine)
                        ? previousFamily.intentLines
                        : [...previousFamily.intentLines, nextIntentLine]
                    )
                    : previousFamily.intentLines,
                  resultLines: [
                    ...previousFamily.resultLines,
                    ...nextMetadataLines,
                  ].filter((line, index, lines) => line.trim().length > 0 && lines.indexOf(line) === index).slice(0, 3),
                };
                toolFamilyStateRef.current.set(stateKey, nextFamily);
                dispatchSurfaceEvent({
                  type: "message.appended",
                  at,
                  message: createSurfaceMessage({
                    messageId: `tool-family:${stateKey}`,
                    sessionId: sessionIdRef.current,
                    turnId,
                    kind: "status",
                    text: [
                      resolveFamilyBlockTitle({
                        familyTitle: record.familyTitle,
                        familyKey,
                        capabilityKey: record.capabilityKey,
                        familyOutcomeKind: record.familyOutcomeKind,
                        status: record.status,
                        hadFailure: nextFamily.hadFailure,
                      }),
                      ...nextFamily.intentLines,
                      ...nextFamily.resultLines,
                    ].join("\n"),
                    createdAt: at,
                    metadata: {
                      source: "tool_summary",
                      familyKey,
                      tapFamilyKey: record.tapFamilyKey,
                      summaryRole: "family",
                      summaryState: "active",
                      intentLineCount: nextFamily.intentLines.length,
                    },
                  }),
                });
              }
            }
            if (
              !record.stage?.startsWith("cmp/")
              && record.stage !== "core/run"
              && record.stage !== "core/capability_bridge"
              && !shouldHideDirectTuiStartupStageFromTranscript(record.stage)
            ) {
              dispatchSurfaceEvent({
                type: "message.appended",
                at,
                message: createSurfaceMessage({
                  messageId: `stage-start:${createTaskId(record)}:${at}`,
                  sessionId: sessionIdRef.current,
                  turnId,
                  kind: "status",
                  text: formatStageStatus(record, "start"),
                  createdAt: at,
                  capabilityKey: record.capabilityKey ?? undefined,
                }),
              });
            }

            if (record.stage?.startsWith("cmp/")) {
              dispatchSurfaceEvent({
                type: "panel.updated",
                at,
                panel: "cmp",
                snapshot: {
                  summary: `${record.label ?? record.stage} running`,
                  readbackStatus: "running",
                  rows: [{
                    section: "health",
                    label: "stage",
                    value: record.stage,
                  }],
                },
              });
            }

            if (record.stage === "core/capability_bridge") {
              dispatchSurfaceEvent({
                type: "panel.updated",
                at,
                panel: "tap",
                snapshot: {
                  summary: buildTapPanelSummary(record, "start"),
                  currentLayer: "runtime",
                  pendingHumanGateCount: 0,
                  blockingCapabilityKeys: [],
                },
              });
            }

            continue;
          }

          if (record.event === "stage_end") {
            dispatchSurfaceEvent({
              type: "task.completed",
              at,
              taskId: createTaskId(record),
              status: record.status === "failed" ? "failed" : "completed",
              summary: record.text ?? `${record.stage ?? "stage"} ${record.status ?? "completed"}`,
            });
            if (record.stage === "core/capability_bridge") {
              setRunIndicator((previous) =>
                previous
                  ? {
                    startedAt: previous.startedAt,
                    label: "core thinking",
                  }
                  : null);
              const familyKeyFromTelemetry = typeof record.familyKey === "string" && record.familyKey.trim()
                ? record.familyKey.trim().toLowerCase()
                : null;
              const familyKey = familyKeyFromTelemetry ?? capabilityFamilyKey(record.capabilityKey);
              const shouldRenderFamilyBlock = shouldRenderCapabilityFamilyBlock({
                familyKey: familyKeyFromTelemetry,
                capabilityKey: record.capabilityKey,
              });
              const familyStateKey = familyKey ? `${turnId}:${familyKey}` : null;
              const previousFamilyState = familyStateKey
                ? toolFamilyStateRef.current.get(familyStateKey)
                : undefined;
              if (familyKey && familyStateKey && shouldRenderFamilyBlock) {
                const previousFamily = previousFamilyState ?? {
                  hadFailure: false,
                  intentLines: [],
                  resultLines: [],
                };
                const nextIntentLine = familyKey === "websearch"
                  ? resolveWebSearchIntentLine(record)
                  : resolveGenericFamilyIntentLine(record);
                const nextResultLines = familyKey === "websearch"
                  ? resolveWebSearchResultLines(record)
                  : resolveGenericFamilyResultLines(record);
                const nextMetadataLines = familyKey === "websearch"
                  ? resolveWebSearchMetadataLines(record)
                  : resolveGenericFamilyMetadataLines(record, "end");
                const combinedResultLines = (
                  familyKey === "websearch"
                    ? [
                      ...previousFamily.resultLines,
                      ...nextResultLines,
                      ...nextMetadataLines,
                    ]
                    : [
                      ...compactGenericFamilyResultLines(record, nextResultLines, nextMetadataLines),
                      ...(nextResultLines.length === 0 && nextMetadataLines.length === 0
                        ? previousFamily.resultLines
                        : []),
                    ]
                ).filter((line, index, lines) => line.trim().length > 0 && lines.indexOf(line) === index);
                const nextFamily = {
                  ...previousFamily,
                  hadFailure: previousFamily.hadFailure || record.status === "failed",
                  intentLines: nextIntentLine
                    ? (
                      previousFamily.intentLines.includes(nextIntentLine)
                        ? previousFamily.intentLines
                        : [...previousFamily.intentLines, nextIntentLine]
                    )
                    : previousFamily.intentLines,
                  resultLines: combinedResultLines.slice(0, 3),
                };
                toolFamilyStateRef.current.set(familyStateKey, nextFamily);
                const blockTitle = resolveFamilyBlockTitle({
                  familyTitle: record.familyTitle,
                  familyKey,
                  capabilityKey: record.capabilityKey,
                  familyOutcomeKind: record.familyOutcomeKind,
                  status: record.status,
                  hadFailure: nextFamily.hadFailure,
                });
                dispatchSurfaceEvent({
                  type: "message.appended",
                  at,
                    message: createSurfaceMessage({
                      messageId: `tool-family:${familyStateKey}`,
                      sessionId: sessionIdRef.current,
                      turnId,
                      kind: "status",
                      text: [
                        blockTitle,
                        ...nextFamily.intentLines,
                        ...nextFamily.resultLines,
                      ].join("\n"),
                      createdAt: at,
                      metadata: {
                        source: "tool_summary",
                        familyKey,
                        tapFamilyKey: record.tapFamilyKey,
                        summaryRole: "family",
                        summaryState: "idle",
                        intentLineCount: nextFamily.intentLines.length,
                        resultMetadata: record.resultMetadata,
                      },
                    }),
                });
                dispatchSurfaceEvent({
                  type: "panel.updated",
                  at,
                  panel: "tap",
                  snapshot: {
                    summary: buildTapPanelSummary(record, "end"),
                    currentLayer: "runtime",
                    pendingHumanGateCount: 0,
                    blockingCapabilityKeys: [],
                  },
                });
                if (familyKey === "websearch") {
                  const summaryMessageId = `tool-family:${familyStateKey}`;
                  const revision = (toolSummaryRevisionRef.current.get(summaryMessageId) ?? 0) + 1;
                  toolSummaryRevisionRef.current.set(summaryMessageId, revision);
                  void maybeRefineWebSearchSummary({
                    sessionId: sessionIdRef.current,
                    runId: turnId,
                    title: blockTitle,
                    intentLines: nextFamily.intentLines,
                    resultLines: nextFamily.resultLines,
                    metadataLines: nextMetadataLines,
                  }).then((refined) => {
                    if (!refined) {
                      return;
                    }
                    if (toolSummaryRevisionRef.current.get(summaryMessageId) !== revision) {
                      return;
                    }
                    dispatchSurfaceEvent({
                      type: "message.appended",
                      at: new Date().toISOString(),
                      message: createSurfaceMessage({
                        messageId: summaryMessageId,
                        sessionId: sessionIdRef.current,
                        turnId,
                        kind: "status",
                        text: [refined.title, ...refined.lines].join("\n"),
                        createdAt: at,
                        metadata: {
                          source: "tool_summary",
                          familyKey,
                          tapFamilyKey: record.tapFamilyKey,
                          summaryRole: "family",
                          summaryState: "idle",
                          intentLineCount: Math.min(nextFamily.intentLines.length, refined.lines.length),
                          refinedByMini: true,
                          resultMetadata: record.resultMetadata,
                        },
                      }),
                    });
                  });
                }
              } else {
                const summary = summarizeCapabilitySummary({
                  capabilityKey: record.capabilityKey,
                  status: record.status,
                  output: record.output,
                  error: record.error,
                  hadPreviousFailure: previousFamilyState?.hadFailure ?? false,
                });
                if (familyStateKey) {
                  toolFamilyStateRef.current.set(familyStateKey, {
                    hadFailure: (previousFamilyState?.hadFailure ?? false) || record.status === "failed",
                    intentLines: previousFamilyState?.intentLines ?? [],
                    resultLines: previousFamilyState?.resultLines ?? [],
                  });
                }
                dispatchSurfaceEvent({
                  type: "message.appended",
                  at,
                  message: createSurfaceMessage({
                    messageId: familyStateKey ?? `tool-summary:${createTaskId(record)}:${at}`,
                    sessionId: sessionIdRef.current,
                    turnId,
                    kind: "status",
                    text: [summary.title, ...summary.detailLines].join("\n"),
                    createdAt: at,
                    metadata: {
                      source: "tool_summary",
                      familyKey: familyKey ?? undefined,
                    },
                    }),
                });
                dispatchSurfaceEvent({
                  type: "panel.updated",
                  at,
                  panel: "tap",
                  snapshot: {
                    summary: buildTapPanelSummary(record, "end"),
                    currentLayer: "runtime",
                    pendingHumanGateCount: 0,
                    blockingCapabilityKeys: [],
                  },
                });
              }
            } else if (
              !record.stage?.startsWith("cmp/")
              && record.stage !== "core/run"
              && !shouldHideDirectTuiStartupStageFromTranscript(record.stage)
            ) {
              dispatchSurfaceEvent({
                type: "message.appended",
                at,
                message: createSurfaceMessage({
                  messageId: `stage-end:${createTaskId(record)}:${at}`,
                  sessionId: sessionIdRef.current,
                  turnId,
                  kind: record.status === "failed" ? "error" : "status",
                  text: record.text ?? formatStageStatus(record, "end"),
                  createdAt: at,
                }),
              });
            }
            if (record.stage === "core/run") {
              setRunIndicator(null);
            }
            continue;
          }

          if (record.event === "turn_result") {
            const turnContext = normalizeContextSnapshot(record.core?.context);
            if (turnContext) {
              setBackendContextSnapshot(turnContext);
            }
            const answer = extractTurnResultAnswer(record);
            const emittedAssistantText = emittedAssistantTextRef.current.get(turnId) ?? "";
            if (answer) {
              const finalAnswerAction = resolveDirectTuiAssistantTurnResultAction({
                finalAnswer: answer,
                streamedText: emittedAssistantText,
                activeMessageId: activeAssistantMessageIdRef.current.get(turnId),
              });
              if (finalAnswerAction.kind === "append") {
                const assistantMessageId = startAssistantSegment(turnId);
                dispatchSurfaceEvent({
                  type: "message.appended",
                  at,
                  message: createSurfaceMessage({
                    messageId: assistantMessageId,
                    sessionId: sessionIdRef.current,
                    turnId,
                    kind: "assistant",
                    text: finalAnswerAction.text,
                    createdAt: at,
                    capabilityKey: record.core?.capabilityKey,
                    status: record.core?.capabilityResultStatus,
                  }),
                });
              } else if (finalAnswerAction.kind === "update") {
                dispatchSurfaceEvent({
                  type: "message.updated",
                  at,
                  message: createSurfaceMessage({
                    messageId: finalAnswerAction.messageId,
                    sessionId: sessionIdRef.current,
                    turnId,
                    kind: "assistant",
                    text: finalAnswerAction.text,
                    createdAt: at,
                    updatedAt: at,
                    capabilityKey: record.core?.capabilityKey,
                    status: record.core?.capabilityResultStatus,
                  }),
                });
              }
              emittedAssistantTextRef.current.set(turnId, answer);
              rawAssistantDeltaTextRef.current.set(turnId, answer);
            }
            const usageDetail = formatTurnUsageDetail({
              inputTokens: record.core?.usage?.inputTokens ?? turnContext?.promptTokens,
              outputTokens: record.core?.usage?.outputTokens ?? (answer ? estimateContextUnits(answer) : undefined),
              thinkingTokens: record.core?.usage?.thinkingTokens,
              elapsedMs: record.core?.elapsedMs ?? record.elapsedMs,
            });
            recordSessionUsage({
              requestId: `turn:${sessionIdRef.current}:${turnId}`,
              turnId,
              kind: "core_turn",
              provider: turnContext?.provider,
              model: turnContext?.model,
              status: record.core?.taskStatus === "completed"
                ? "success"
                : record.core?.taskStatus === "blocked"
                  ? "blocked"
                  : "failed",
              inputTokens: record.core?.usage?.inputTokens ?? turnContext?.promptTokens,
              outputTokens: record.core?.usage?.outputTokens ?? (answer ? estimateContextUnits(answer) : undefined),
              thinkingTokens: record.core?.usage?.thinkingTokens,
              estimated: record.core?.usage?.estimated === true,
              startedAt: at,
              endedAt: at,
              errorCode: typeof record.resultMetadata?.errorCode === "string" ? record.resultMetadata.errorCode : undefined,
            });
            if (usageDetail) {
              dispatchSurfaceEvent({
                type: "message.appended",
                at,
                message: createSurfaceMessage({
                  messageId: `turn-stats:${turnId}:${at}`,
                  sessionId: sessionIdRef.current,
                  turnId,
                  kind: "status",
                  text: usageDetail,
                  createdAt: at,
                  metadata: {
                    source: "turn_stats",
                  },
                }),
              });
            }
            dispatchSurfaceEvent({
              type: "turn.completed",
              at,
              turn: createSurfaceTurn({
                turnId,
                status: mapCoreTaskStatusToSurfaceTurnStatus(record.core?.taskStatus),
                updatedAt: at,
                completedAt: at,
              }),
            });
            for (const task of activeTasksRef.current.filter((task) => task.turnId === turnId)) {
              dispatchSurfaceEvent({
                type: "task.completed",
                at,
                taskId: task.taskId,
                status: mapCoreTaskStatusToSurfaceTurnStatus(record.core?.taskStatus) === "blocked" ? "blocked" : "completed",
                summary: task.summary,
              });
            }
            dispatchSurfaceEvent({
              type: "panel.updated",
              at,
              panel: "core",
              snapshot: {
                runId: turnId,
                runStatus: mapCoreTaskStatusToRunPanelStatus(record.core?.taskStatus),
                dispatchStatus: record.core?.dispatchStatus,
                taskStatus: record.core?.taskStatus ?? "unknown",
                capabilityKey: record.core?.capabilityKey,
                eventTypes: ["turn_result"],
              },
            });
            setRunIndicator(null);
            completedTurnIdsRef.current.add(turnId);
            for (const key of [...toolFamilyStateRef.current.keys()]) {
              if (key.startsWith(`${turnId}:`)) {
                toolFamilyStateRef.current.delete(key);
              }
            }
            for (const key of [...toolSummaryRevisionRef.current.keys()]) {
              if (key.startsWith(`tool-family:${turnId}:`)) {
                toolSummaryRevisionRef.current.delete(key);
              }
            }
            closeAssistantSegment(turnId);
            continue;
          }

          if (record.event === "assistant_delta" && typeof record.text === "string" && record.text.length > 0) {
            const isAssistantReplyStream =
              record.label === "core/model.infer"
              || record.label === "core/action";
            if (!isAssistantReplyStream) {
              continue;
            }
            const rawAccumulatedText = `${rawAssistantDeltaTextRef.current.get(turnId) ?? ""}${record.text}`;
            rawAssistantDeltaTextRef.current.set(turnId, rawAccumulatedText);
            const decodedText = decodeEscapedDisplayTextMaybe(rawAccumulatedText);
            const previousDisplayedText = emittedAssistantTextRef.current.get(turnId) ?? "";
            emittedAssistantTextRef.current.set(turnId, decodedText);
            const activeAssistantMessageId = activeAssistantMessageIdRef.current.get(turnId);
            if (!activeAssistantMessageId) {
              const assistantMessageId = startAssistantSegment(turnId);
              dispatchSurfaceEvent({
                type: "message.appended",
                at,
                message: createSurfaceMessage({
                  messageId: assistantMessageId,
                  sessionId: sessionIdRef.current,
                  turnId,
                  kind: "assistant",
                  text: decodedText,
                  createdAt: at,
                  }),
              });
              continue;
            }
            if (!decodedText.startsWith(previousDisplayedText)) {
              dispatchSurfaceEvent({
                type: "message.updated",
                at,
                message: createSurfaceMessage({
                  messageId: activeAssistantMessageId,
                  sessionId: sessionIdRef.current,
                  turnId,
                  kind: "assistant",
                  text: decodedText,
                  createdAt: at,
                  updatedAt: at,
                }),
              });
              continue;
            }
            const nextDelta = decodedText.slice(previousDisplayedText.length);
            if (!nextDelta) {
              continue;
            }
            dispatchSurfaceEvent({
              type: "message.delta",
              at,
              messageId: activeAssistantMessageId,
              textDelta: nextDelta,
              done: record.done,
            });
            continue;
          }

          if (record.event === "stream_text" && typeof record.text === "string" && record.text.trim()) {
            dispatchSurfaceEvent({
              type: "message.appended",
              at,
              message: createSurfaceMessage({
                messageId: `stream:${turnId}:${at}`,
                sessionId: sessionIdRef.current,
                turnId,
                kind: "status",
                text: record.text,
                createdAt: at,
                status: "streaming",
              }),
            });
          }
            processedRowCount += 1;
            if (processedRowCount % LOG_TAIL_PROCESS_BATCH_SIZE === 0) {
              await yieldToEventLoop();
              if (cancelled) {
                return;
              }
            }
          }
          if (processedLogByteOffsetRef.current < nextSize) {
            await yieldToEventLoop();
            continue;
          }
          break;
        }
      } catch {
        // startup races are expected
      } finally {
        logTickInFlightRef.current = false;
      }
    };

    void tick();
    const timer = setInterval(() => {
      void tick();
    }, 350);

    return () => {
      cancelled = true;
      logTickInFlightRef.current = false;
      clearInterval(timer);
    };
  }, [logPath]);

  const refreshConfigSnapshots = () => {
    setConfigRevision((previous) => previous + 1);
  };

  const finalizePendingSessionSwitch = (
    nextSwitch: PendingSessionSwitch,
    sessionContext?: ReturnType<typeof normalizeContextSnapshot>,
  ) => {
    clearPendingSessionSwitchTimeout();
    const safeWorkspace = resolveValidWorkspacePath(nextSwitch.targetWorkspace, currentCwd);
    sessionIdRef.current = nextSwitch.targetSessionId;
    setSessionName(nextSwitch.targetSessionName);
    setSelectedAgentId(nextSwitch.targetAgentId);
    setCurrentCwd(safeWorkspace);
    setSurfaceState(nextSwitch.targetSurfaceState);
    const restoredSnapshot = loadDirectTuiSessionSnapshot(nextSwitch.targetSessionId, safeWorkspace);
    sessionUsageLedgerRef.current = restoredSnapshot?.usageLedger ?? [];
    setSessionUsageRevision((previous) => previous + 1);
    setScrollOffset(0);
    setConversationActivated(nextSwitch.targetSurfaceState.messages.some((message) => message.kind === "user"));
    if (sessionContext) {
      setBackendContextSnapshot(sessionContext);
    }
    if (nextSwitch.successNotice) {
      setSlashPanelNotice({
        tone: safeWorkspace === nextSwitch.targetWorkspace ? "success" : "warning",
        text: safeWorkspace === nextSwitch.targetWorkspace
          ? nextSwitch.successNotice
          : `${nextSwitch.successNotice} (workspace path was reset to the current valid directory)`,
      });
    }
    if (nextSwitch.autoClose) {
      scheduleSlashPanelAutoClose();
    }
    setPendingSessionSwitch(null);
  };

  const restartBackendInPlace = (input?: {
    nextWorkspace?: string;
    nextSessionId?: string;
  }) => {
    backendRestartPendingRef.current = true;
    setBackendStatus("starting");
    backendLaunchWorkspaceRef.current = input?.nextWorkspace ?? null;
    backendLaunchSessionIdRef.current = input?.nextSessionId ?? null;
    setBackendEpoch((previous) => previous + 1);
  };

  const persistConfigFile = (mutator: (draft: RaxodeConfigFile) => void): RaxodeConfigFile | null => {
    if (!configFile) {
      appendInlineError("Raxode config is unavailable. Please check ~/.raxcode/config.json.");
      setSlashPanelNotice({
        tone: "danger",
        text: "Config unavailable",
      });
      return null;
    }
    const nextConfig = cloneRaxodeConfigFile(configFile);
    mutator(nextConfig);
    writeRaxodeConfigFile(nextConfig, appRoot);
    refreshConfigSnapshots();
    return nextConfig;
  };

  const applyWorkspaceSwitch = async (targetInput: string): Promise<boolean> => {
    const nextCwd = expandWorkspaceInputPath(targetInput, currentCwd);
    try {
      const targetStat = await stat(nextCwd);
      if (!targetStat.isDirectory()) {
        appendInlineError(WORKSPACE_NOT_DIRECTORY_TEXT);
        setSlashPanelNotice({
          tone: "danger",
          text: WORKSPACE_NOT_DIRECTORY_TEXT,
        });
        return false;
      }
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "ENOENT") {
        appendInlineError(WORKSPACE_DIRECTORY_MISSING_TEXT);
        setSlashPanelNotice({
          tone: "danger",
          text: WORKSPACE_DIRECTORY_MISSING_TEXT,
        });
        return false;
      }
      const messageText = error instanceof Error ? error.message : String(error);
      appendInlineError(`Workspace switch failed: ${messageText}`);
      setSlashPanelNotice({
        tone: "danger",
        text: `Workspace switch failed: ${messageText}`,
      });
      return false;
    }

    try {
      process.chdir(nextCwd);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      appendInlineError(`Workspace switch failed: ${messageText}`);
      setSlashPanelNotice({
        tone: "danger",
        text: `Workspace switch failed: ${messageText}`,
      });
      return false;
    }

    persistConfigFile((draft) => {
      draft.workspace.defaultPath = process.cwd();
    });
    setCurrentCwd(process.cwd());
    updateWorkspaceSurface(process.cwd());
    appendInlineStatus(`Workspace switched to ${shortenPath(process.cwd())}`);
    setSlashPanelNotice({
      tone: "success",
      text: `Workspace switched to ${shortenPath(process.cwd())}`,
    });
    restartBackendInPlace({
      nextWorkspace: process.cwd(),
    });
    return true;
  };

  const applyComposerFileReferenceSelection = (token: ActiveFileMentionToken, selectedPath: string) => {
    const nextState = replaceFileMentionToken(composerState, token, selectedPath);
    const normalizedRelativePath = selectedPath === "." ? "." : selectedPath;
    const tokenText = nextState.value.slice(token.start, nextState.cursorOffset).trimEnd();
    setComposerState(nextState);
    setComposerFileReferences((previous) => {
      const nextEntry: TuiFileReferenceAttachment = {
        id: `file-ref:${normalizedRelativePath}`,
        tokenText,
        relativePath: normalizedRelativePath,
        absolutePath: resolve(currentCwd, normalizedRelativePath),
        displayName: normalizedRelativePath,
      };
      return [
        ...previous.filter((entry) => entry.tokenText !== tokenText),
        nextEntry,
      ];
    });
    dismissedFilePopupTokenRef.current = null;
    setSelectedComposerPopupIndex(0);
    setComposerPopupPageIndex(0);
  };

  const applyModelPickerSelection = async () => {
    if (!modelPicker?.open) {
      return;
    }
    const selectedModel = modelPicker.models[modelPicker.selectedModelIndex];
    if (!selectedModel) {
      return;
    }
    if (modelPicker.source === "embedding") {
      const nextConfig = persistConfigFile((draft) => {
        draft.embedding.lanceDbModel = selectedModel.id as typeof draft.embedding.lanceDbModel;
      });
      if (!nextConfig) {
        return;
      }
      setSlashPanelDraft((previous) => ({
        ...previous,
        [modelPicker.fieldKey]: selectedModel.id,
      }));
      setSlashPanelNotice({
        tone: "success",
        text: `Embedding model switched to ${selectedModel.id}`,
      });
      closeModelPicker();
      return;
    }

    const reasoningLevels = selectedModel.reasoningLevels;
    const selectedReasoning = reasoningLevels[modelPicker.selectedReasoningIndex]
      ?? selectedModel.defaultReasoningLevel
      ?? reasoningLevels[0]
      ?? "low";
    const nextValue = formatModelEffortDisplayLine(selectedModel.id, selectedReasoning, modelPicker.serviceTierFastEnabled);
    const nextConfig = persistConfigFile((draft) => {
      const parsed = parseModelEffortLine(nextValue);
      if (!parsed) {
        return;
      }
      const roleId = modelPicker.fieldKey.replace(/^model:/u, "") as
        | "core.main"
        | "tui.main"
        | "mp.icma"
        | "mp.dbagent"
        | "mp.iterator"
        | "mp.checker"
        | "mp.dispatcher"
        | "cmp.icma"
        | "cmp.dbagent"
        | "cmp.iterator"
        | "cmp.checker"
        | "cmp.dispatcher"
        | "tap.reviewer"
        | "tap.toolReviewer"
        | "tap.provisioner";
      const binding = draft.roleBindings[roleId];
      if (!binding) {
        return;
      }
      const profile = draft.profiles.find((entry) => entry.id === binding.profileId);
      if (!profile) {
        return;
      }
      binding.overrides = {
        ...binding.overrides,
        serviceTier: parsed.serviceTierFastEnabled && selectedModel.supportsFastServiceTier ? "fast" : undefined,
      };
      profile.model = parsed.model;
      profile.reasoningEffort = parsed.reasoning;
    });
    if (!nextConfig) {
      return;
    }
    setSlashPanelDraft((previous) => ({
      ...previous,
      [modelPicker.fieldKey]: nextValue,
    }));
    setSlashPanelNotice({
      tone: "success",
      text: `${modelPicker.fieldLabel} switched to ${nextValue}`,
    });
    closeModelPicker();
    restartBackendInPlace();
  };

  const restoreSessionSnapshot = (sessionId: string) => {
    const indexedSession = allSessionRecords.find((session) => session.sessionId === sessionId);
    const snapshot = loadDirectTuiSessionSnapshot(sessionId, currentCwd);
    if (!snapshot) {
      const snapshotPath = resolveDirectTuiSessionSnapshotPath(sessionId, currentCwd);
      const detailText = !indexedSession
        ? `Session ${sessionId} is not in the local resume index.`
        : !existsSync(snapshotPath)
          ? `Snapshot file is missing for ${sessionId}.`
          : `Snapshot file for ${sessionId} exists but could not be parsed.`;
      setSlashPanelNotice({
        tone: "danger",
        text: detailText,
      });
      return;
    }
    const effectiveWorkspace = resolveValidWorkspacePath(snapshot.workspace, currentCwd);
    if (!persistedAgentRegistry.some((agent) => agent.agentId === snapshot.agentId)) {
      saveDirectTuiAgent({
        agentId: snapshot.agentId,
        name: snapshot.agentId.startsWith("agent.core:") ? "core" : "restored-agent",
        kind: snapshot.agentId.startsWith("agent.core:") ? "core" : "task",
        status: "idle",
        summary: "restored session agent",
        workspace: effectiveWorkspace,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
        lastSessionId: snapshot.sessionId,
      }, currentCwd);
      setAgentRegistryRevision((previous) => previous + 1);
    }
    const normalizedSnapshot = effectiveWorkspace === snapshot.workspace
      ? snapshot
      : {
        ...snapshot,
        workspace: effectiveWorkspace,
      };
    resetSwitchRuntimeState();
    setConversationActivated(buildSurfaceStateFromSessionSnapshot(normalizedSnapshot).messages.some((message) => message.kind === "user"));
    setSlashPanelNotice({
      tone: effectiveWorkspace === snapshot.workspace ? "info" : "warning",
      text: effectiveWorkspace === snapshot.workspace
        ? `Resuming ${snapshot.name}...`
        : `Resuming ${snapshot.name} with the current valid workspace...`,
    });
    setPendingSessionSwitch({
      targetSessionId: snapshot.sessionId,
      targetAgentId: snapshot.agentId ?? snapshot.selectedAgentId ?? "agent.core:main",
      targetWorkspace: effectiveWorkspace,
      targetSessionName: snapshot.name,
      targetSurfaceState: buildSurfaceStateFromSessionSnapshot(normalizedSnapshot),
      successNotice: `Resumed ${snapshot.name}`,
      autoClose: true,
    });
    restartBackendInPlace({
      nextWorkspace: effectiveWorkspace,
      nextSessionId: snapshot.sessionId,
    });
  };

  const persistAgentRename = (agentId: string, nextName: string) => {
    const existing = persistedAgentRegistry.find((agent) => agent.agentId === agentId);
    if (existing) {
      renameDirectTuiAgent(agentId, nextName, currentCwd);
    } else {
      saveDirectTuiAgent({
        agentId,
        name: nextName,
        kind: agentId.startsWith("agent.core:") ? "core" : "task",
        status: "idle",
        summary: "new workspace agent",
        workspace: currentCwd,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, currentCwd);
    }
    setAgentRegistryRevision((previous) => previous + 1);
  };

  const createWorkspaceAgent = () => {
    const nextAgent = createWorkspaceAgentSnapshot(currentCwd);
    saveDirectTuiAgent(nextAgent, currentCwd);
    setAgentRegistryRevision((previous) => previous + 1);
    createSessionWithCurrentAgent(nextAgent.agentId, false, null);
    setPanelRenameTarget({
      kind: "agent",
      id: nextAgent.agentId,
    });
    setSlashPanelInputState(createTuiTextInputState(nextAgent.name));
    setSlashPanelFocusIndex(0);
    setSlashPanelNotice({
      tone: "info",
      text: "Rename agent and press Enter to save.",
    });
  };

  const createSessionWithCurrentAgent = (
    agentIdOverride?: string,
    enterRename = true,
    successNoticeOverride?: string | null,
  ) => {
    const effectiveAgentId = agentIdOverride ?? selectedAgentId;
    const currentAgent = persistedAgentRegistry.find((agent) => agent.agentId === effectiveAgentId)
      ?? persistedAgentRegistry[0];
    const { sessionId, name, snapshot } = buildEmptySessionSnapshot({
      agentId: currentAgent?.agentId ?? effectiveAgentId ?? "agent.core:main",
      workspace: currentCwd,
      route: config?.baseURL ?? "(unconfigured)",
      model: runtimeConfig?.modelPlan.core.main.model ?? "gpt-5.4",
    });
    saveDirectTuiSessionSnapshot(snapshot, currentCwd);
    resetSwitchRuntimeState();
    sessionUsageLedgerRef.current = [];
    setSessionUsageRevision((previous) => previous + 1);
    setConversationActivated(false);
    setSessionIndexRevision((previous) => previous + 1);
    setPanelRenameTarget(enterRename
      ? {
        kind: "session",
        id: sessionId,
      }
      : null);
    setSlashPanelInputState(createTuiTextInputState(enterRename ? name : ""));
    setSlashPanelFocusIndex(0);
    if (enterRename) {
      setSlashPanelNotice({
        tone: "info",
        text: "Rename session and press Enter to save.",
      });
    } else {
      setSlashPanelNotice({
        tone: "info",
        text: `Creating ${name}...`,
      });
    }
    setPendingSessionSwitch({
      targetSessionId: sessionId,
      targetAgentId: snapshot.agentId,
      targetWorkspace: currentCwd,
      targetSessionName: name,
      targetSurfaceState: buildSurfaceStateFromSessionSnapshot(snapshot),
      successNotice: successNoticeOverride === undefined
        ? (enterRename ? "Rename session and press Enter to save." : "Created a blank session for this agent.")
        : successNoticeOverride ?? undefined,
      autoClose: !enterRename,
    });
    restartBackendInPlace({
      nextWorkspace: currentCwd,
      nextSessionId: sessionId,
    });
  };

  const switchToAgent = (agentId: string) => {
    const latestSession = allSessionRecords
      .filter((session) => session.agentId === agentId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
    if (latestSession) {
      restoreSessionSnapshot(latestSession.sessionId);
      return;
    }
    createSessionWithCurrentAgent(agentId, false);
  };

  const requestImmediateQuit = (options?: { force?: boolean }) => {
    const hasBlockingTasks = hasExitBlockingTasks(activeTasksRef.current)
      || interruptibleTasksRef.current.length > 0
      || activeTurnIdsRef.current.size > 0;
    if (!options?.force && hasBlockingTasks) {
      openSlashPanel("exit");
      setSlashPanelNotice({
        tone: "warning",
        text: ACTIVE_TASK_GUARD_TEXT,
      });
      return false;
    }
    const generatedAt = new Date().toISOString();
    if (options?.force) {
      const syntheticCancelledEntries = activeTasksRef.current.map((task, index) => ({
        requestId: `forced-exit:${sessionIdRef.current}:${index}:${generatedAt}`,
        turnId: task.turnId,
        kind: "session" as const,
        status: "cancelled" as const,
        startedAt: task.startedAt,
        endedAt: generatedAt,
        errorCode: "forced_exit",
      }));
      if (syntheticCancelledEntries.length > 0) {
        sessionUsageLedgerRef.current = [
          ...sessionUsageLedgerRef.current,
          ...syntheticCancelledEntries,
        ];
        setSessionUsageRevision((previous) => previous + 1);
      }
    }
    const child = childRef.current;
    if (child && !child.killed) {
      try {
        child.stdin.write("/exit\u0000");
      } catch {
        // ignore write races during shutdown
      }
      if (options?.force) {
        setTimeout(() => {
          if (!child.killed) {
            child.kill("SIGTERM");
          }
        }, 120);
      }
    }
    beginExitSummarySequence(generatedAt);
    return true;
  };

  useEffect(() => {
    if (!pendingExitAction || hasExitBlockingTasks(activeTasks)) {
      return;
    }
    requestImmediateQuit({
      force: pendingExitAction === "force_exit",
    });
  }, [activeTasks, pendingExitAction]);

  useEffect(() => {
    if (!exitSummaryDisplay?.animated) {
      return;
    }
    const animationTimer = setInterval(() => {
      setExitSummaryDisplay((current) => {
        if (!current || !current.animated || current.animationStep >= EXIT_SUMMARY_TOTAL_STEPS) {
          return current;
        }
        return {
          ...current,
          animationStep: current.animationStep + 1,
        };
      });
    }, EXIT_SUMMARY_FRAME_MS);
    return () => {
      clearInterval(animationTimer);
    };
  }, [exitSummaryDisplay?.animated, exitSummaryDisplay?.startedAtMs]);

  useEffect(() => {
    if (!DIRECT_TUI_EXIT_SUMMARY_FILE || !exitSummaryDisplay) {
      return;
    }
    requestExitSummaryFilePersistence(exitSummaryDisplay.finalLines);
  }, [exitSummaryDisplay]);

  useEffect(() => {
    if (!exitSummaryDisplay) {
      return;
    }
    const closeTimer = setTimeout(() => {
      if (exitSummaryPersistRequestedRef.current) {
        return;
      }
      exitSummaryPersistRequestedRef.current = true;
      const child = childRef.current;
      if (child && !child.killed) {
        try {
          child.kill("SIGTERM");
        } catch {
          // ignore backend shutdown races while the direct TUI exits
        }
      }
      void persistDirectTuiExitSummaryAndExit({
        lines: exitSummaryDisplay.finalLines,
        exitCode: 0,
      });
    }, Math.max(0, exitSummaryDisplay.exitAtMs - Date.now()));
    return () => {
      clearTimeout(closeTimer);
    };
  }, [exitSummaryDisplay?.exitAtMs, exitSummaryDisplay?.finalLines, exitSummaryDisplay?.startedAtMs]);

  const requestViewerRefresh = (command: "/cmp" | "/mp" | "/capabilities") => {
    const child = childRef.current;
    if (!child || child.killed || backendStatus === "failed") {
      refreshConfigSnapshots();
      setSlashPanelNotice({
        tone: "warning",
        text: "Backend unavailable, fell back to local refresh only.",
      });
      return;
    }
    child.stdin.write(`${command}\u0000`);
  };

  const applySlashPanelAction = async (actionKey: string) => {
    const dispatchInitRequest = (noteText: string) => {
      const child = childRef.current;
      if (!child || child.killed || backendStatus === "failed") {
        appendInlineError("backend unavailable, cannot start initialization");
        setSlashPanelNotice({
          tone: "danger",
          text: "Backend unavailable, cannot start initialization",
        });
        return false;
      }
      const requestedAt = new Date().toISOString();
      try {
        child.stdin.write(`${JSON.stringify({
          type: "direct_init_request",
          text: noteText,
        })}\u0000`);
      } catch (error) {
        appendInlineError(`Failed to start initialization: ${error instanceof Error ? error.message : String(error)}`);
        setSlashPanelNotice({
          tone: "danger",
          text: "Initialization request failed to send",
        });
        return false;
      }
      setConversationActivated(true);
      setRunIndicator({
        startedAt: requestedAt,
        label: "initializing",
      });
      setPendingInitNote(null);
      setSlashPanelNotice({
        tone: "success",
        text: noteText.length > 0 ? "Initialization started with notes" : "Initialization started",
      });
      appendInlineStatus(
        noteText.length > 0
          ? `Initialization started with notes: ${compactRuntimeText(noteText)}`
          : "Initialization started in the current workspace.",
      );
      return true;
    };

    if (actionKey.startsWith("humanGate:")) {
      const requestedIndex = Number.parseInt(slashPanelDraft.humanGateIndex ?? "0", 10);
      const gateIndex = pendingHumanGates.length === 0
        ? 0
        : Math.max(0, Math.min(Number.isFinite(requestedIndex) ? requestedIndex : 0, pendingHumanGates.length - 1));
      const gate = pendingHumanGates[gateIndex] ?? null;
      const sendHumanGateDecision = (action: "approve" | "approve_always" | "reject", note?: string) => {
        const child = childRef.current;
        if (!child || child.killed || backendStatus === "failed") {
          setSlashPanelNotice({
            tone: "danger",
            text: "Backend unavailable. Cannot submit human gate decision.",
          });
          return;
        }
        if (!gate) {
          setSlashPanelNotice({
            tone: "warning",
            text: "No pending human gate is selected.",
          });
          return;
        }
        child.stdin.write(`${formatHumanGateDecisionEnvelope({
          gateId: gate.gateId,
          action,
          note,
        })}\u0000`);
        setDismissedHumanGateSignature(null);
        setSlashPanelNotice({
          tone: action === "reject" ? "warning" : "success",
          text: action === "approve_always"
            ? "Persistent approval sent to TAP."
            : (action === "approve"
              ? "Approval sent to TAP."
              : "Rejection sent to TAP."),
        });
      };
      switch (actionKey) {
        case "humanGate:close":
          closeHumanGatePanel(false);
          return;
        case "humanGate:toggleDetails":
          setSlashPanelDraft((previous) => ({
            ...previous,
            humanGateDetails: previous.humanGateDetails === "expanded" ? "collapsed" : "expanded",
          }));
          setSlashPanelNotice(null);
          return;
        case "humanGate:prev":
          setSlashPanelDraft((previous) => ({
            ...previous,
            humanGateIndex: String(
              pendingHumanGates.length === 0
                ? 0
                : (gateIndex - 1 + pendingHumanGates.length) % pendingHumanGates.length,
            ),
          }));
          setSlashPanelInputState(createTuiTextInputState());
          setSlashPanelNotice(null);
          return;
        case "humanGate:next":
          setSlashPanelDraft((previous) => ({
            ...previous,
            humanGateIndex: String(
              pendingHumanGates.length === 0
                ? 0
                : (gateIndex + 1) % pendingHumanGates.length,
            ),
          }));
          setSlashPanelInputState(createTuiTextInputState());
          setSlashPanelNotice(null);
          return;
        case "humanGate:approveOnce":
          sendHumanGateDecision("approve");
          return;
        case "humanGate:approveAlways":
          sendHumanGateDecision("approve_always");
          return;
        case "humanGate:deny":
          sendHumanGateDecision("reject");
          return;
        case "humanGate:denyWithInstruction": {
          const note = slashPanelInputState.value.trim();
          if (note.length === 0) {
            setSlashPanelNotice({
              tone: "warning",
              text: "Tell Raxode what to do instead before submitting.",
            });
            return;
          }
          sendHumanGateDecision("reject", note);
          setSlashPanelInputState(createTuiTextInputState());
          setSlashPanelDraft((previous) => ({
            ...previous,
            "humanGate:note": "",
          }));
          return;
        }
        default:
          setSlashPanelNotice({
            tone: "warning",
            text: `${actionKey} is not wired yet`,
          });
          return;
      }
    }
    if (actionKey.startsWith("model:")) {
      const selectedValue = slashPanelDraft[actionKey];
      if (!selectedValue) {
        return;
      }
      const nextConfig = persistConfigFile((draft) => {
        if (actionKey === "model:mp.embedding") {
          return;
        }
        const parsed = parseModelEffortLine(selectedValue);
        if (!parsed) {
          return;
        }
        const roleId = actionKey.replace(/^model:/u, "") as
          | "core.main"
          | "tui.main"
          | "mp.icma"
          | "mp.dbagent"
          | "mp.iterator"
          | "mp.checker"
          | "mp.dispatcher"
          | "cmp.icma"
          | "cmp.dbagent"
          | "cmp.iterator"
          | "cmp.checker"
          | "cmp.dispatcher"
          | "tap.reviewer"
          | "tap.toolReviewer"
          | "tap.provisioner";
        const binding = draft.roleBindings[roleId];
        if (!binding) {
          return;
        }
        const profile = draft.profiles.find((entry) => entry.id === binding.profileId);
        if (!profile) {
          return;
        }
        binding.overrides = {
          ...binding.overrides,
          serviceTier: parsed.serviceTierFastEnabled ? "fast" : undefined,
        };
        profile.model = parsed.model;
        profile.reasoningEffort = parsed.reasoning;
      });
      if (!nextConfig) {
        return;
      }
      setSlashPanelNotice({
        tone: "success",
        text: `${actionKey.replace(/^model:/u, "")} updated`,
      });
      restartBackendInPlace();
      return;
    }
    if (actionKey === "resume:create") {
      createSessionWithCurrentAgent();
      return;
    }
    if (actionKey.startsWith("resume:")) {
      restoreSessionSnapshot(actionKey.replace(/^resume:/u, ""));
      return;
    }
    if (actionKey === "exit:close") {
      closeSlashPanel();
      return;
    }
    if (actionKey === "exit:force") {
      setPendingExitAction("force_exit");
      requestImmediateQuit({ force: true });
      return;
    }
    if (actionKey === "exit:wait") {
      if (!hasExitBlockingTasks(activeTasksRef.current)) {
        requestImmediateQuit();
        return;
      }
      setPendingExitAction("wait_then_exit");
      setSlashPanelNotice({
        tone: "warning",
        text: "Raxode will exit once the current tasks stop.",
      });
      return;
    }
    if (actionKey === "exit:switch") {
      setPendingExitAction(null);
      closeSlashPanel();
      setScrollOffset(0);
      return;
    }
    if (actionKey === "agent:create") {
      createWorkspaceAgent();
      return;
    }
    if (actionKey.startsWith("agent:")) {
      const agentId = actionKey.replace(/^agent:/u, "");
      switchToAgent(agentId);
      return;
    }
    if (actionKey.startsWith("language:")) {
      const nextLanguage = actionKey.replace(/^language:/u, "");
      const nextConfig = persistConfigFile((draft) => {
        draft.ui.language = nextLanguage;
      });
      if (!nextConfig) {
        return;
      }
      setSlashPanelDraft((previous) => ({
        ...previous,
        language: nextLanguage,
      }));
      setSlashPanelInputState(createTuiTextInputState(""));
      setSlashPanelNotice({
        tone: "success",
        text: `Language switched to ${nextLanguage}`,
      });
      return;
    }
    if (actionKey.startsWith("permissions:mode:")) {
      clearPermissionsPanelReturnTimer();
      const nextMode = actionKey.replace(/^permissions:mode:/u, "");
      const nextConfig = persistConfigFile((draft) => {
        draft.permissions.requestedMode = nextMode as typeof draft.permissions.requestedMode;
      });
      if (!nextConfig) {
        return;
      }
      setSlashPanelDraft((previous) => ({
        ...previous,
        requestedMode: nextMode,
      }));
      setSlashPanelNotice({
        tone: "success",
        text: `Permissions mode switched to ${nextMode}`,
      });
      restartBackendInPlace();
      permissionsPanelReturnTimerRef.current = setTimeout(() => {
        permissionsPanelReturnTimerRef.current = null;
        returnToSlashMenu();
      }, PERMISSIONS_PANEL_AUTO_RETURN_MS);
      return;
    }
    if (actionKey === "language") {
      const nextLanguage = slashPanelDraft.language ?? configFile?.ui.language;
      if (nextLanguage) {
        await applySlashPanelAction(`language:${nextLanguage}`);
      }
      return;
    }
    switch (actionKey) {
      case "applyModel": {
        const nextConfig = persistConfigFile((draft) => {
          const coreProfile = resolveRoleProfile(draft, "core.main");
          const tuiProfile = resolveRoleProfile(draft, "tui.main");
          if (coreProfile) {
            coreProfile.model = slashPanelDraft.coreModel ?? coreProfile.model;
            coreProfile.reasoningEffort = (slashPanelDraft.coreReasoning ?? coreProfile.reasoningEffort ?? "high") as RaxodeReasoningEffort;
          }
          if (tuiProfile) {
            tuiProfile.model = slashPanelDraft.tuiModel ?? tuiProfile.model;
            tuiProfile.reasoningEffort = (slashPanelDraft.tuiReasoning ?? tuiProfile.reasoningEffort ?? "high") as RaxodeReasoningEffort;
          }
        });
        if (!nextConfig) {
          return;
        }
        setSlashPanelNotice({
          tone: "success",
          text: "Model settings saved",
        });
        appendInlineStatus("Model settings updated.");
        restartBackendInPlace();
        return;
      }
      case "applyPermissions": {
        const nextConfig = persistConfigFile((draft) => {
          draft.permissions.requestedMode = (
            slashPanelDraft.requestedMode ?? draft.permissions.requestedMode
          ) as typeof draft.permissions.requestedMode;
          draft.permissions.automationDepth = (
            slashPanelDraft.automationDepth ?? draft.permissions.automationDepth
          ) as typeof draft.permissions.automationDepth;
        });
        if (!nextConfig) {
          return;
        }
        setSlashPanelNotice({
          tone: "success",
          text: "Permissions saved",
        });
        appendInlineStatus("Permissions settings updated.");
        restartBackendInPlace();
        return;
      }
      case "requestedMode": {
        if (!slashPanelDraft.requestedMode) {
          return;
        }
        clearPermissionsPanelReturnTimer();
        const nextConfig = persistConfigFile((draft) => {
          draft.permissions.requestedMode = slashPanelDraft.requestedMode as typeof draft.permissions.requestedMode;
        });
        if (!nextConfig) {
          return;
        }
        setSlashPanelNotice({
          tone: "success",
          text: `Permissions mode switched to ${slashPanelDraft.requestedMode}`,
        });
        restartBackendInPlace();
        permissionsPanelReturnTimerRef.current = setTimeout(() => {
          permissionsPanelReturnTimerRef.current = null;
          returnToSlashMenu();
        }, PERMISSIONS_PANEL_AUTO_RETURN_MS);
        return;
      }
      case "automationDepth": {
        if (!slashPanelDraft.automationDepth) {
          return;
        }
        const nextConfig = persistConfigFile((draft) => {
          draft.permissions.automationDepth = slashPanelDraft.automationDepth as typeof draft.permissions.automationDepth;
        });
        if (!nextConfig) {
          return;
        }
        setSlashPanelNotice({
          tone: "success",
          text: `Automation depth switched to ${slashPanelDraft.automationDepth}`,
        });
        restartBackendInPlace();
        return;
      }
      case "applyLanguage": {
        const nextConfig = persistConfigFile((draft) => {
          draft.ui.language = slashPanelDraft.language ?? draft.ui.language;
        });
        if (!nextConfig) {
          return;
        }
        setSlashPanelNotice({
          tone: "success",
          text: "Language updated",
        });
        appendInlineStatus(`Language switched to ${slashPanelDraft.language ?? nextConfig.ui.language}`);
        return;
      }
      case "applyAgentsView": {
        const nextConfig = persistConfigFile((draft) => {
          draft.ui.startupView = slashPanelDraft.startupView ?? draft.ui.startupView;
          draft.ui.defaultAgentsView = slashPanelDraft.agentsView ?? draft.ui.defaultAgentsView;
        });
        if (!nextConfig) {
          return;
        }
        setSlashPanelNotice({
          tone: "success",
          text: "Agents view preference saved",
        });
        appendInlineStatus("Agents view preference updated.");
        return;
      }
      case "applyWorkspace": {
        if (runIndicator || activeTasksRef.current.length > 0) {
          appendInlineError(ACTIVE_TASK_GUARD_TEXT);
          setSlashPanelNotice({
            tone: "danger",
            text: ACTIVE_TASK_GUARD_TEXT,
          });
          return;
        }
        await applyWorkspaceSwitch(slashPanelInputState.value.trim() || currentCwd);
        return;
      }
      case "useHome": {
        const home = process.env.HOME ?? currentCwd;
        setSlashPanelInputState(createTuiTextInputState(home));
        setSlashPanelDraft((previous) => ({
          ...previous,
          workspacePath: home,
        }));
        setSlashPanelNotice({
          tone: "info",
          text: "Target path set to home",
        });
        return;
      }
      case "quitNow": {
        requestImmediateQuit();
        return;
      }
      case "initSession": {
        const noteText = restorePastedContentTokens(
          composerState.value.trim(),
          composerPastedContents.filter((entry) => composerState.value.includes(entry.tokenText)),
        ).trim();
        if (!dispatchInitRequest(noteText)) {
          return;
        }
        setComposerState(createTuiTextInputState());
        setComposerAttachments([]);
        setComposerPastedContents([]);
        return;
      }
      case "refreshStatus":
      case "refreshCmp":
      case "refreshMp":
      case "refreshCapabilities": {
        refreshConfigSnapshots();
        if (actionKey === "refreshCmp") {
          requestViewerRefresh("/cmp");
        } else if (actionKey === "refreshMp") {
          requestViewerRefresh("/mp");
        } else if (actionKey === "refreshCapabilities") {
          requestViewerRefresh("/capabilities");
        } else {
          try {
            const config = loadOpenAILiveConfig("core.main");
            if (config.authMode === "chatgpt_oauth") {
              setStatusRateLimitRefreshState("loading");
              void refreshStatusRateLimitRecord(config, appRoot)
                .then((record) => {
                  setStatusRateLimitRecord(record);
                  setStatusRateLimitRefreshState("idle");
                  setSlashPanelNotice({
                    tone: "info",
                    text: "Panel refreshed",
                  });
                })
                .catch((error) => {
                  setStatusRateLimitRefreshState("idle");
                  setSlashPanelNotice({
                    tone: "warning",
                    text: error instanceof Error ? error.message : String(error),
                  });
                });
            } else {
              setSlashPanelNotice({
                tone: "info",
                text: "Panel refreshed",
              });
            }
          } catch {
            setSlashPanelNotice({
              tone: "info",
              text: "Panel refreshed",
            });
          }
        }
        return;
      }
      case "showLogPath": {
        appendInlineStatus(logPath ? `Live report: ${logPath}` : "Live report path is not ready yet.");
        setSlashPanelNotice({
          tone: "info",
          text: logPath ? "Live report path shown in transcript" : "Log path pending",
        });
        return;
      }
      default:
        setSlashPanelNotice({
          tone: "warning",
          text: `${actionKey} is not wired yet`,
        });
    }
  };

  const submitInput = async () => {
    if (rewindInFlight) {
      return;
    }
    const dispatchInitRequest = (noteText: string) => {
      const child = childRef.current;
      if (!child || child.killed || backendStatus === "failed") {
        appendInlineError("backend unavailable, cannot start initialization");
        setSlashPanelNotice({
          tone: "danger",
          text: "Backend unavailable, cannot start initialization",
        });
        return false;
      }
      const requestedAt = new Date().toISOString();
      try {
        child.stdin.write(`${JSON.stringify({
          type: "direct_init_request",
          text: noteText,
        })}\u0000`);
      } catch (error) {
        appendInlineError(`Failed to start initialization: ${error instanceof Error ? error.message : String(error)}`);
        setSlashPanelNotice({
          tone: "danger",
          text: "Initialization request failed to send",
        });
        return false;
      }
      setConversationActivated(true);
      setRunIndicator({
        startedAt: requestedAt,
        label: "initializing",
      });
      setPendingInitNote(null);
      setSlashPanelNotice({
        tone: "success",
        text: noteText.length > 0 ? "Initialization started with notes" : "Initialization started",
      });
      appendInlineStatus(
        noteText.length > 0
          ? `Initialization started with notes: ${compactRuntimeText(noteText)}`
          : "Initialization started in the current workspace.",
      );
      return true;
    };

    const message = composerState.value.trim();
    const tokenBackedPastedContents = composerPastedContents.filter((entry) =>
      message.includes(entry.tokenText));
    const tokenBackedFileRefs = composerFileReferences.filter((entry) =>
      message.includes(entry.tokenText));
    if (activeSlashPanelId === "init") {
      const restoredInitNote = restorePastedContentTokens(message, tokenBackedPastedContents).trim();
      if (!dispatchInitRequest(restoredInitNote)) {
        return;
      }
      setComposerState(createTuiTextInputState());
      setComposerAttachments([]);
      setComposerPastedContents([]);
      setComposerFileReferences([]);
      setSlashPanelInputState(createTuiTextInputState());
      setScrollOffset(0);
      return;
    }
    const outboundMessage = pendingInitNote
      ? `[Init Note]\n${pendingInitNote}\n\n[User Task]\n${message}`
      : message;
    const tokenBackedAttachments = composerAttachments.filter((attachment) =>
      attachment.tokenText ? message.includes(attachment.tokenText) : true);
    const autoDetectedAttachments = await detectAutoImageAttachments(message, currentCwd);
    const attachments = [
      ...tokenBackedAttachments,
      ...autoDetectedAttachments.filter((attachment) =>
        !tokenBackedAttachments.some((existing) =>
          (attachment.remoteUrl && existing.remoteUrl === attachment.remoteUrl)
          || (attachment.localPath && existing.localPath === attachment.localPath))),
    ];
    if (!message && attachments.length === 0 && tokenBackedPastedContents.length === 0 && tokenBackedFileRefs.length === 0) {
      return;
    }
    const normalizedMessage = message.toLowerCase();
    const isExitCommand = normalizedMessage === "/exit" || normalizedMessage === "/quit";
    const isWorkspaceCommand = normalizedMessage === "/workspace" || normalizedMessage.startsWith("/workspace ");

    if (isWorkspaceCommand && (runIndicator || activeTasksRef.current.length > 0)) {
      appendInlineError(ACTIVE_TASK_GUARD_TEXT);
      return;
    }

    if (isWorkspaceCommand) {
      const targetInput = message.replace(/^\/workspace\b/u, "").trim();
      if (!targetInput) {
        appendInlineStatus(`Current workspace: ${shortenPath(currentCwd)}`);
      setComposerState(createTuiTextInputState());
      setComposerAttachments([]);
      setComposerPastedContents([]);
      setComposerFileReferences([]);
      return;
    }
      setComposerState(createTuiTextInputState());
      setComposerAttachments([]);
      setComposerPastedContents([]);
      setScrollOffset(0);
      await applyWorkspaceSwitch(targetInput);
      return;
    }

    if (isExitCommand) {
      requestImmediateQuit();
      return;
    }

    if (pendingSessionSwitch) {
      const at = new Date().toISOString();
      dispatchSurfaceEvent({
        type: "error.reported",
        at,
        message: createSurfaceMessage({
          messageId: `submit-pending-switch:${at}`,
          kind: "error",
          createdAt: at,
          text: `Session switch still in progress for ${pendingSessionSwitch.targetSessionName}. Please wait a moment.`,
        }),
      });
      setSlashPanelNotice({
        tone: "warning",
        text: "Session switch still in progress. Please wait a moment.",
      });
      return;
    }

    const child = childRef.current;
    if (!child || child.killed || backendStatus === "failed") {
      const at = new Date().toISOString();
      dispatchSurfaceEvent({
        type: "error.reported",
        at,
        message: createSurfaceMessage({
          messageId: `submit-error:${at}`,
          kind: "error",
          createdAt: at,
          text: "backend unavailable, cannot send message",
        }),
      });
      return;
    }
    const optimisticTurnIndex = resolveNextOptimisticTurnIndex({
      existingTurns: surfaceState.turns,
      transcriptMessages: transcriptMessagesRef.current,
      usageLedger: sessionUsageLedgerRef.current,
      pendingOutboundTurns: pendingOutboundTurnsRef.current,
    });
    const optimisticTurnId = createTurnId(optimisticTurnIndex);
    const optimisticMessageId = `user:${optimisticTurnId}`;
    const queuedAt = new Date().toISOString();
    const submissionId = createPendingOutboundSubmissionId();
    const preTurnTranscriptCutMessageId = transcriptMessagesRef.current[transcriptMessagesRef.current.length - 1]?.messageId;
    const payload = attachments.length > 0
      ? JSON.stringify({
        type: "direct_user_input",
        text: outboundMessage,
        attachments: attachments.map((attachment) => ({
          id: attachment.id,
          tokenText: attachment.tokenText,
          sourceKind: attachment.sourceKind,
          displayName: attachment.displayName,
          mimeType: attachment.mimeType,
          localPath: attachment.localPath,
          remoteUrl: attachment.remoteUrl,
        })),
        ...(tokenBackedPastedContents.length > 0
          ? {
            pastedContents: tokenBackedPastedContents.map((entry) => ({
              id: entry.id,
              tokenText: entry.tokenText,
              text: entry.text,
              characterCount: entry.characterCount,
            })),
          }
          : {}),
        ...(tokenBackedFileRefs.length > 0
          ? {
            fileRefs: tokenBackedFileRefs.map((entry) => ({
              id: entry.id,
              tokenText: entry.tokenText,
              relativePath: entry.relativePath,
              absolutePath: entry.absolutePath,
              displayName: entry.displayName,
            })),
          }
          : {}),
      })
      : tokenBackedPastedContents.length > 0 || tokenBackedFileRefs.length > 0
        ? JSON.stringify({
          type: "direct_user_input",
          text: outboundMessage,
          ...(tokenBackedPastedContents.length > 0
            ? {
              pastedContents: tokenBackedPastedContents.map((entry) => ({
                id: entry.id,
                tokenText: entry.tokenText,
                text: entry.text,
                characterCount: entry.characterCount,
              })),
            }
            : {}),
          ...(tokenBackedFileRefs.length > 0
            ? {
              fileRefs: tokenBackedFileRefs.map((entry) => ({
                id: entry.id,
                tokenText: entry.tokenText,
                relativePath: entry.relativePath,
                absolutePath: entry.absolutePath,
                displayName: entry.displayName,
              })),
            }
            : {}),
        })
        : outboundMessage;
    turnUserTextRef.current.set(optimisticTurnId, outboundMessage.trim());
    void persistPreTurnCheckpoint({
      turnId: optimisticTurnId,
      createdAt: queuedAt,
      userText: outboundMessage.trim(),
      transcriptCutMessageId: preTurnTranscriptCutMessageId,
    });
    dispatchSurfaceEvent({
      type: "turn.started",
      at: queuedAt,
      turn: createSurfaceTurn({
        turnId: optimisticTurnId,
        sessionId: sessionIdRef.current,
        turnIndex: optimisticTurnIndex,
        status: "waiting",
        startedAt: queuedAt,
        updatedAt: queuedAt,
        userText: outboundMessage.trim(),
        outputMessageIds: [],
        taskIds: [],
      }),
    });
    dispatchSurfaceEvent({
      type: "message.appended",
      at: queuedAt,
      message: createSurfaceMessage({
        messageId: optimisticMessageId,
        sessionId: sessionIdRef.current,
        turnId: optimisticTurnId,
        kind: "user",
        text: outboundMessage.trim(),
        createdAt: queuedAt,
        metadata: {
          optimistic: true,
          submissionId,
          deliveryState: "queued",
        },
      }),
    });
    pendingOutboundTurnsRef.current.push({
      submissionId,
      turnIndex: optimisticTurnIndex,
      turnId: optimisticTurnId,
      messageId: optimisticMessageId,
      userText: outboundMessage.trim(),
      queuedAt,
    });
    setConversationActivated(true);
    setRunIndicator({
      startedAt: queuedAt,
      label: backendStatus === "ready" ? "queued" : "waiting for backend",
    });
    try {
      child.stdin.write(`${payload}\u0000`);
    } catch (error) {
      pendingOutboundTurnsRef.current = pendingOutboundTurnsRef.current.filter((entry) => entry.submissionId !== submissionId);
      dispatchSurfaceEvent({
        type: "message.updated",
        at: queuedAt,
        message: createSurfaceMessage({
          messageId: optimisticMessageId,
          sessionId: sessionIdRef.current,
          turnId: optimisticTurnId,
          kind: "user",
          text: outboundMessage.trim(),
          createdAt: queuedAt,
          updatedAt: queuedAt,
          metadata: {
            optimistic: false,
            submissionId,
            deliveryState: "failed",
            failureReason: error instanceof Error ? error.message : String(error),
          },
        }),
      });
      appendInlineError(`Failed to queue the message: ${error instanceof Error ? error.message : String(error)}`);
      setRunIndicator(null);
      return;
    }
    if (pendingInitNote) {
      setPendingInitNote(null);
    }
    setComposerState(createTuiTextInputState());
    setComposerAttachments([]);
    setComposerPastedContents([]);
    setComposerFileReferences([]);
    setScrollOffset(0);
  };

  const interruptActiveRun = (announceNotice: boolean) => {
    const child = childRef.current;
    if (!child || child.killed) {
      return false;
    }
    if (!(runIndicator || interruptibleTasksRef.current.length > 0 || activeTurnIdsRef.current.size > 0)) {
      return false;
    }
    interruptPendingRef.current = true;
    setRunIndicator(null);
    const at = new Date().toISOString();
    for (const task of interruptibleTasksRef.current) {
      dispatchSurfaceEvent({
        type: "task.completed",
        at,
        taskId: task.taskId,
        status: "cancelled",
        summary: "interrupted by user",
      });
    }
    for (const turnId of activeTurnIdsRef.current) {
      interruptedTurnIdsRef.current.add(turnId);
      dispatchSurfaceEvent({
        type: "turn.completed",
        at,
        turn: createSurfaceTurn({
          turnId,
          status: "blocked",
          updatedAt: at,
          completedAt: at,
        }),
      });
    }
    for (const message of selectTranscriptMessages(surfaceState)) {
      if (
        message.metadata?.source !== "tool_summary"
        || message.metadata?.summaryState !== "active"
        || !message.turnId
        || !activeTurnIdsRef.current.has(message.turnId)
      ) {
        continue;
      }
      dispatchSurfaceEvent({
        type: "message.appended",
        at,
        message: createSurfaceMessage({
          messageId: message.messageId,
          sessionId: message.sessionId,
          turnId: message.turnId,
          kind: message.kind,
          text: message.text,
          createdAt: message.createdAt,
          metadata: {
            ...(message.metadata ?? {}),
            summaryState: "idle",
            interrupted: true,
          },
        }),
      });
    }
    for (const turnId of activeTurnIdsRef.current) {
      for (const key of [...toolFamilyStateRef.current.keys()]) {
        if (key.startsWith(`${turnId}:`)) {
          toolFamilyStateRef.current.delete(key);
        }
      }
      for (const key of [...toolSummaryRevisionRef.current.keys()]) {
        if (key.startsWith(`tool-family:${turnId}:`)) {
          toolSummaryRevisionRef.current.delete(key);
        }
      }
    }
    if (announceNotice) {
      dispatchSurfaceEvent({
        type: "message.appended",
        at,
        message: createSurfaceMessage({
          messageId: `interrupt:${at}`,
          sessionId: sessionIdRef.current,
          kind: "notice",
          text: "Stopped. Tell Raxode what to do next.",
          createdAt: at,
        }),
      });
    }
    dispatchSurfaceEvent({
      type: "panel.updated",
      at,
      panel: "core",
      snapshot: {
        runId: sessionIdRef.current,
        runStatus: "paused",
        dispatchStatus: "interrupted",
        taskStatus: "cancelled",
        capabilityKey: undefined,
        eventTypes: ["interrupt"],
      },
    });
    child.kill("SIGINT");
    return true;
  };

  useInput((inputText, key) => {
    if (rewindInFlight) {
      if (key.ctrl && inputText === "c") {
        flushPendingPasteText();
        requestImmediateQuit({ force: true });
      }
      return;
    }
    const mouseScrollDelta = parseMouseScrollDelta(inputText);
    if (mouseScrollDelta !== null) {
      if (mouseScrollDelta !== 0) {
        setScrollOffset((previous) => applyScrollDelta(previous, mouseScrollDelta, maxScrollOffset));
      }
      return;
    }
    const focusedPanelField = slashPanelView?.fields[slashPanelFocusIndex];
    const panelInputActive = focusedPanelField?.kind === "input";

    const looksLikePastedChunk =
      Boolean(inputText)
      && (
        inputText.includes("\n")
        || inputText.length > 1
      )
      && !key.ctrl
      && !key.meta
      && !key.escape
      && !key.return
      && !key.tab
      && !key.leftArrow
      && !key.rightArrow
      && !key.upArrow
      && !key.downArrow
      && !key.backspace
      && !key.delete;

    if (looksLikePastedChunk) {
      if (panelInputActive) {
        const nextState = insertIntoTuiTextInput(slashPanelInputState, inputText);
        setSlashPanelInputState(nextState);
        setSlashPanelDraft((current) => ({
          ...current,
          [focusedPanelField.key]: nextState.value,
        }));
        return;
      }
      enqueuePastedText(inputText);
      return;
    }

    if (!inputText && pendingPasteTextRef.current) {
      flushPendingPasteText();
    }

    if (key.ctrl && inputText === "c") {
      flushPendingPasteText();
      requestImmediateQuit({ force: true });
      return;
    }

    if (key.ctrl && inputText === "v") {
      if (panelInputActive) {
        void (async () => {
          const clipboardText = await readClipboardText();
          if (clipboardText) {
            const nextState = insertIntoTuiTextInput(slashPanelInputState, clipboardText);
            setSlashPanelInputState(nextState);
            setSlashPanelDraft((current) => ({
              ...current,
              [focusedPanelField.key]: nextState.value,
            }));
          }
        })();
        return;
      }
      void (async () => {
        const attachment = await readClipboardImageAttachment({
          sessionId: sessionIdRef.current,
          nextIndex: nextComposerImageIndexRef.current,
        });
        if (attachment) {
          nextComposerImageIndexRef.current += 1;
          setComposerAttachments((previous) => [...previous, attachment]);
          setComposerState((previous) => insertIntoTuiTextInput(previous, attachment.tokenText ?? ""));
          return;
        }
        const clipboardText = await readClipboardText();
        if (clipboardText) {
          enqueuePastedText(clipboardText);
        }
      })();
      return;
    }

    if (!rewindOverlayState && !key.escape) {
      resetRewindPriming();
    }

    if (rewindOverlayState) {
      if (key.escape) {
        if (rewindOverlayState.stage === "mode") {
          setRewindOverlayState((previous) => previous ? {
            ...previous,
            stage: "turn",
            selectedModeIndex: 0,
            notice: null,
          } : previous);
        } else {
          closeRewindOverlay();
        }
        return;
      }
      if (key.upArrow) {
        setRewindOverlayState((previous) => previous ? {
          ...previous,
          selectedTurnIndex: previous.stage === "turn"
            ? Math.max(0, previous.selectedTurnIndex - 1)
            : previous.selectedTurnIndex,
          selectedModeIndex: previous.stage === "mode"
            ? Math.max(0, previous.selectedModeIndex - 1)
            : previous.selectedModeIndex,
          notice: null,
        } : previous);
        return;
      }
      if (key.downArrow) {
        setRewindOverlayState((previous) => {
          if (!previous) {
            return previous;
          }
          return {
            ...previous,
            selectedTurnIndex: previous.stage === "turn"
              ? Math.min(Math.max(0, rewindTurnOptions.length - 1), previous.selectedTurnIndex + 1)
              : previous.selectedTurnIndex,
            selectedModeIndex: previous.stage === "mode"
              ? Math.min(Math.max(0, rewindModeOptions.length - 1), previous.selectedModeIndex + 1)
              : previous.selectedModeIndex,
            notice: null,
          };
        });
        return;
      }
      if (key.return) {
        const selectedTurn = rewindTurnOptions[rewindOverlayState.selectedTurnIndex];
        if (!selectedTurn) {
          setRewindOverlayState((previous) => previous ? {
            ...previous,
            notice: {
              tone: "warning",
              text: "No rewind target is selected.",
            },
          } : previous);
          return;
        }
        if (rewindOverlayState.stage === "turn") {
          setRewindOverlayState((previous) => previous ? {
            ...previous,
            stage: "mode",
            selectedModeIndex: 0,
            notice: null,
          } : previous);
          return;
        }
        const selectedMode = rewindModeOptions[rewindOverlayState.selectedModeIndex];
        if (!selectedMode) {
          return;
        }
        if (selectedMode.disabled) {
          setRewindOverlayState((previous) => previous ? {
            ...previous,
            notice: {
              tone: "warning",
              text: selectedMode.reason ?? "This rewind mode is not available for the selected turn.",
            },
          } : previous);
          return;
        }
        if (selectedMode.mode === "rewind_workspace_only") {
          closeRewindOverlay();
          beginRewindInFlight(selectedMode.mode, "pending_workspace_restore");
          void restoreWorkspaceFromCheckpoint(selectedTurn)
            .catch((error) => {
              appendInlineError(`Workspace rewind failed: ${error instanceof Error ? error.message : String(error)}`);
            })
            .finally(() => {
              finishRewindInFlight();
            });
          return;
        }
        if (selectedMode.mode === "rewind_turn_and_workspace") {
          closeRewindOverlay();
          beginRewindInFlight(selectedMode.mode, "pending_workspace_restore");
          void restoreWorkspaceFromCheckpoint(selectedTurn)
            .then(() => {
              requestTranscriptRewind(selectedTurn, selectedMode.mode);
            })
            .catch((error) => {
              appendInlineError(`Rewind failed: ${error instanceof Error ? error.message : String(error)}`);
              finishRewindInFlight();
            });
          return;
        }
        requestTranscriptRewind(selectedTurn, selectedMode.mode);
        return;
      }
      return;
    }

    if (key.escape) {
      if (modelPicker?.open) {
        closeModelPicker();
        return;
      }
      if (activeSlashPanelId) {
        if (activeSlashPanelId === "human-gate") {
          if (slashPanelDraft.humanGateDetails === "expanded") {
            setSlashPanelDraft((previous) => ({
              ...previous,
              humanGateDetails: "collapsed",
            }));
            setSlashPanelNotice(null);
            return;
          }
          if (slashPanelInputState.value.length > 0) {
            setSlashPanelInputState(createTuiTextInputState());
            setSlashPanelDraft((previous) => ({
              ...previous,
              "humanGate:note": "",
            }));
            setSlashPanelNotice(null);
            return;
          }
          closeHumanGatePanel(true);
          return;
        }
        if (activeSlashPanelId === "question") {
          closeSlashPanel();
          setComposerState(createTuiTextInputState());
          setComposerAttachments([]);
          setComposerPastedContents([]);
          setComposerFileReferences([]);
          return;
        }
        returnToSlashMenu();
        return;
      }
      flushPendingPasteText();
      if (runIndicator || interruptibleTasksRef.current.length > 0 || activeTurnIdsRef.current.size > 0) {
        interruptActiveRun(true);
        return;
      }
      if (showSlashMenu) {
        setSelectedSlashIndex(0);
        return;
      }
      const composerIsEmpty =
        composerState.value.trim().length === 0
        && composerAttachments.length === 0
        && composerPastedContents.length === 0
        && composerFileReferences.length === 0;
      if (composerIsEmpty) {
        if (pendingTranscriptRewindRef.current) {
          appendInlineStatus("A rewind request is already in flight.", "notice");
          return;
        }
        const now = Date.now();
        if (now - rewindPrimedAtRef.current <= REWIND_ESC_WINDOW_MS) {
          openRewindOverlay();
        } else {
          rewindPrimedAtRef.current = now;
        }
        return;
      }
      resetRewindPriming();
      return;
    }

    if (modelPicker?.open) {
      if (key.upArrow) {
        setModelPicker((current) => current ? {
          ...current,
          selectedModelIndex: current.models.length === 0
            ? 0
            : (current.selectedModelIndex - 1 + current.models.length) % current.models.length,
          serviceTierFastEnabled: (() => {
            const nextModelIndex = current.models.length === 0
              ? 0
              : (current.selectedModelIndex - 1 + current.models.length) % current.models.length;
            return Boolean(current.serviceTierFastEnabled && current.models[nextModelIndex]?.supportsFastServiceTier);
          })(),
        } : current);
        return;
      }
      if (key.downArrow) {
        setModelPicker((current) => current ? {
          ...current,
          selectedModelIndex: current.models.length === 0
            ? 0
            : (current.selectedModelIndex + 1) % current.models.length,
          serviceTierFastEnabled: (() => {
            const nextModelIndex = current.models.length === 0
              ? 0
              : (current.selectedModelIndex + 1) % current.models.length;
            return Boolean(current.serviceTierFastEnabled && current.models[nextModelIndex]?.supportsFastServiceTier);
          })(),
        } : current);
        return;
      }
      if (key.tab) {
        setModelPicker((current) => {
          if (!current) {
            return current;
          }
          const selectedModel = current.models[current.selectedModelIndex];
          if (!selectedModel?.supportsFastServiceTier) {
            return current;
          }
          return {
            ...current,
            serviceTierFastEnabled: !current.serviceTierFastEnabled,
          };
        });
        return;
      }
      if (key.leftArrow || key.rightArrow) {
        setModelPicker((current) => {
          if (!current) {
            return current;
          }
          const selectedModel = current.models[current.selectedModelIndex];
          const levels = selectedModel?.reasoningLevels ?? [];
          if (levels.length === 0) {
            return current;
          }
          const delta = key.leftArrow ? -1 : 1;
          return {
            ...current,
            selectedReasoningIndex: (current.selectedReasoningIndex + delta + levels.length) % levels.length,
          };
        });
        return;
      }
      if (key.return) {
        void applyModelPickerSelection();
        return;
      }
      return;
    }

    if (workspacePickerInputState && composerPopup) {
      if (
        workspacePickerInputState.value.length === 0
        && workspacePickerInputState.cursorOffset === 0
        && isBackwardDeleteInput(inputText, key)
      ) {
        exitWorkspacePickerToNormalComposer();
        return;
      }
      if (key.pageUp || key.pageDown || key.leftArrow || key.rightArrow) {
        const delta = (key.pageUp || key.leftArrow) ? -1 : 1;
        setComposerPopupPageIndex((previous) => {
          if (composerPopup.pageCount === 0) {
            return 0;
          }
          return Math.max(0, Math.min(previous + delta, composerPopup.pageCount - 1));
        });
        setSelectedComposerPopupIndex(0);
        return;
      }
      if (key.upArrow) {
        const nextSelection = moveComposerPopupSelection({
          totalCount: composerPopup.totalCount,
          pageSize: COMPOSER_POPUP_PAGE_SIZE,
          pageIndex: composerPopup.pageIndex,
          selectedIndex: selectedComposerPopupIndex,
          direction: -1,
        });
        setComposerPopupPageIndex(nextSelection.pageIndex);
        setSelectedComposerPopupIndex(nextSelection.selectedIndex);
        return;
      }
      if (key.downArrow) {
        const nextSelection = moveComposerPopupSelection({
          totalCount: composerPopup.totalCount,
          pageSize: COMPOSER_POPUP_PAGE_SIZE,
          pageIndex: composerPopup.pageIndex,
          selectedIndex: selectedComposerPopupIndex,
          direction: 1,
        });
        setComposerPopupPageIndex(nextSelection.pageIndex);
        setSelectedComposerPopupIndex(nextSelection.selectedIndex);
        return;
      }
      if (key.escape) {
        returnToSlashMenu();
        return;
      }
      if (key.return) {
        const selectedItem = composerPopup.visibleItems[selectedComposerPopupIndex];
        if (selectedItem?.path) {
          const nextWorkspacePath = selectedItem.path;
          void (async () => {
            const switched = await applyWorkspaceSwitch(nextWorkspacePath);
            if (switched) {
              closeWorkspacePicker();
              setComposerState(createTuiTextInputState());
            }
          })();
        }
        return;
      }
      const inputResult = applyTuiTextInputKey(workspacePickerInputState, inputText, key);
      if (inputResult.handled) {
        setWorkspacePickerInputState(inputResult.nextState);
      }
      return;
    }

    if (activeFileMention && composerPopup) {
      if (key.pageUp || key.pageDown) {
        const delta = key.pageUp ? -1 : 1;
        setComposerPopupPageIndex((previous) => {
          if (composerPopup.pageCount === 0) {
            return 0;
          }
          return Math.max(0, Math.min(previous + delta, composerPopup.pageCount - 1));
        });
        setSelectedComposerPopupIndex(0);
        return;
      }
      if (key.upArrow) {
        const nextSelection = moveComposerPopupSelection({
          totalCount: composerPopup.totalCount,
          pageSize: COMPOSER_POPUP_PAGE_SIZE,
          pageIndex: composerPopup.pageIndex,
          selectedIndex: selectedComposerPopupIndex,
          direction: -1,
        });
        setComposerPopupPageIndex(nextSelection.pageIndex);
        setSelectedComposerPopupIndex(nextSelection.selectedIndex);
        return;
      }
      if (key.downArrow) {
        const nextSelection = moveComposerPopupSelection({
          totalCount: composerPopup.totalCount,
          pageSize: COMPOSER_POPUP_PAGE_SIZE,
          pageIndex: composerPopup.pageIndex,
          selectedIndex: selectedComposerPopupIndex,
          direction: 1,
        });
        setComposerPopupPageIndex(nextSelection.pageIndex);
        setSelectedComposerPopupIndex(nextSelection.selectedIndex);
        return;
      }
      if (key.escape) {
        dismissedFilePopupTokenRef.current = activeFileMention.tokenText;
        setSelectedComposerPopupIndex(0);
        setComposerPopupPageIndex(0);
        return;
      }
      if (key.return) {
        const selectedItem = composerPopup.visibleItems[selectedComposerPopupIndex];
        if (selectedItem?.path) {
          applyComposerFileReferenceSelection(activeFileMention, selectedItem.path);
        }
        return;
      }
      const inputResult = applyTuiTextInputKey(composerState, inputText, key);
      if (inputResult.handled) {
        setComposerState(inputResult.nextState);
      }
      return;
    }

    if (activeSlashPanelId === "question" && questionViewerSnapshot?.status === "active") {
      if (key.leftArrow) {
        moveQuestionPrompt(-1);
        return;
      }
      if (key.rightArrow) {
        moveQuestionPrompt(1);
        return;
      }
      if (key.upArrow) {
        moveQuestionOption(-1);
        return;
      }
      if (key.downArrow) {
        moveQuestionOption(1);
        return;
      }
      if (key.tab) {
        toggleCurrentQuestionNoteMode();
        return;
      }
      if (key.return) {
        confirmCurrentQuestionAnswer();
        return;
      }
    }

    if (
      activeSlashPanelId
      && slashPanelView?.viewerPage
      && (activeSlashPanelId === "cmp" || activeSlashPanelId === "mp" || activeSlashPanelId === "capabilities")
      && (key.leftArrow || key.rightArrow)
    ) {
      const viewerPage = slashPanelView.viewerPage;
      const draftKey = viewerPageDraftKey(activeSlashPanelId);
      const delta = key.leftArrow ? -1 : 1;
      const pageCount = viewerPage.pageCount;
      setSlashPanelDraft((previous) => {
        const pageSize = activeSlashPanelId === "capabilities"
          ? CAPABILITY_VIEWER_PAGE_SIZE
          : VIEWER_PAGE_SIZE;
        const currentPage = resolveViewerPageIndex(
          activeSlashPanelId,
          previous,
          viewerPage.totalItems ?? 0,
          pageSize,
        );
        const nextPage = Math.max(0, Math.min(currentPage + delta, pageCount - 1));
        return {
          ...previous,
          [draftKey]: String(nextPage),
        };
      });
      return;
    }

    if (activeSlashPanelId && slashPanelView && focusedPanelField) {
      if (key.upArrow) {
        setSlashPanelFocusIndex((previous) => findNextInteractiveFieldIndex(slashPanelView.fields, previous, -1));
        return;
      }
      if (key.downArrow) {
        setSlashPanelFocusIndex((previous) => findNextInteractiveFieldIndex(slashPanelView.fields, previous, 1));
        return;
      }

      if (focusedPanelField.kind === "choice") {
        const currentValue = slashPanelDraft[focusedPanelField.key] ?? focusedPanelField.value;
        if (inputText === " " && activeSlashPanelId === "model") {
          return;
        }
        if (inputText === " ") {
          if (activeSlashPanelId === "agents") {
            setSlashPanelNotice({
              tone: "warning",
              text: "Rename selected agent is reserved for the next pass.",
            });
            return;
          }
          if (activeSlashPanelId === "language") {
            setSlashPanelDraft((previous) => ({
              ...previous,
              [focusedPanelField.key]: cycleChoiceValue(focusedPanelField, currentValue, 1),
            }));
            return;
          }
        }
        if (activeSlashPanelId === "model") {
          if (key.return) {
            void openModelPicker(focusedPanelField);
            return;
          }
          return;
        }
        if (key.leftArrow) {
          setSlashPanelDraft((previous) => ({
            ...previous,
            [focusedPanelField.key]: cycleChoiceValue(focusedPanelField, currentValue, -1),
          }));
          return;
        }
        if (key.rightArrow) {
          setSlashPanelDraft((previous) => ({
            ...previous,
            [focusedPanelField.key]: cycleChoiceValue(focusedPanelField, currentValue, 1),
          }));
          return;
        }
        if (key.return) {
          void applySlashPanelAction(focusedPanelField.key);
          return;
        }
        return;
      }

      if (focusedPanelField.kind === "action") {
        if (key.return || inputText === " ") {
          if (inputText === " " && activeSlashPanelId === "permissions") {
            return;
          }
          if (inputText === " " && activeSlashPanelId === "resume") {
            setPanelRenameTarget({
              kind: "session",
              id: focusedPanelField.key.replace(/^resume:/u, ""),
            });
            setSlashPanelInputState(createTuiTextInputState(focusedPanelField.label));
            setSlashPanelFocusIndex(0);
            setSlashPanelNotice({
              tone: "info",
              text: "Rename session and press Enter to save.",
            });
            return;
          }
          if (inputText === " " && activeSlashPanelId === "agents") {
            setPanelRenameTarget({
              kind: "agent",
              id: focusedPanelField.key.replace(/^agent:/u, ""),
            });
            setSlashPanelInputState(createTuiTextInputState(focusedPanelField.label));
            setSlashPanelFocusIndex(0);
            setSlashPanelNotice({
              tone: "info",
              text: "Rename agent and press Enter to save.",
            });
            return;
          }
          void applySlashPanelAction(focusedPanelField.key);
        }
        return;
      }

      if (focusedPanelField.kind === "input") {
        if (key.return) {
          if (activeSlashPanelId === "language" && focusedPanelField.key === "languageQuery") {
            const query = slashPanelInputState.value.trim().toLowerCase();
            const firstMatch = Object.entries(LANGUAGE_LABELS).find(([code, label]) =>
              query.length === 0
              || code.toLowerCase().includes(query)
              || label.toLowerCase().includes(query),
            );
            if (firstMatch) {
              void applySlashPanelAction(`language:${firstMatch[0]}`);
              return;
            }
          }
          if (panelRenameTarget) {
            const nextName = slashPanelInputState.value.trim();
            if (nextName.length === 0) {
              setSlashPanelNotice({
                tone: "danger",
                text: "Name cannot be empty.",
              });
              return;
            }
            if (panelRenameTarget.kind === "session") {
              renameDirectTuiSession(panelRenameTarget.id, nextName, currentCwd);
              if (panelRenameTarget.id === sessionIdRef.current) {
                setSessionName(nextName);
              }
              setSessionIndexRevision((previous) => previous + 1);
              setSlashPanelNotice({
                tone: "success",
                text: `Renamed session to ${nextName}`,
              });
            } else {
              persistAgentRename(panelRenameTarget.id, nextName);
              setSlashPanelNotice({
                tone: "success",
                text: `Renamed agent to ${nextName}`,
              });
            }
            setPanelRenameTarget(null);
            setSlashPanelInputState(createTuiTextInputState());
            return;
          }
          const submitKey = focusedPanelField.submitActionKey ?? findPrimaryActionField(slashPanelView.fields)?.key;
          if (submitKey) {
            void applySlashPanelAction(submitKey);
          }
          return;
        }
        const inputResult = applyTuiTextInputKey(slashPanelInputState, inputText, key);
        if (inputResult.handled) {
          setSlashPanelInputState(inputResult.nextState);
          setSlashPanelDraft((previous) => ({
            ...previous,
            [focusedPanelField.key]: inputResult.nextState.value,
          }));
        }
        return;
      }
    }

    if (showSlashMenu && !composerState.value.includes("\n")) {
      if (key.upArrow) {
        flushPendingPasteText();
        setSelectedSlashIndex((previous) =>
          slashState.suggestions.length === 0
            ? 0
            : (previous - 1 + slashState.suggestions.length) % slashState.suggestions.length);
        return;
      }
      if (key.downArrow) {
        flushPendingPasteText();
        setSelectedSlashIndex((previous) =>
          slashState.suggestions.length === 0
            ? 0
            : (previous + 1) % slashState.suggestions.length);
        return;
      }
    }

    if (key.upArrow) {
      flushPendingPasteText();
      const inputResult = applyTuiTextInputKey(composerState, inputText, key);
      const movedInsideComposer =
        composerState.value.includes("\n")
        && (
          inputResult.nextState.cursorOffset !== composerState.cursorOffset
          || inputResult.nextState.value !== composerState.value
        );
      if (movedInsideComposer) {
        setComposerState(inputResult.nextState);
        return;
      }
      setScrollOffset((previous) => applyScrollDelta(previous, 1, maxScrollOffset));
      return;
    }

    if (key.downArrow) {
      flushPendingPasteText();
      const inputResult = applyTuiTextInputKey(composerState, inputText, key);
      const movedInsideComposer =
        composerState.value.includes("\n")
        && (
          inputResult.nextState.cursorOffset !== composerState.cursorOffset
          || inputResult.nextState.value !== composerState.value
        );
      if (movedInsideComposer) {
        setComposerState(inputResult.nextState);
        return;
      }
      setScrollOffset((previous) => applyScrollDelta(previous, -1, maxScrollOffset));
      return;
    }

    if (key.pageUp) {
      flushPendingPasteText();
      setScrollOffset((previous) => applyScrollDelta(previous, Math.max(6, Math.floor(transcriptViewportLineCount / 2)), maxScrollOffset));
      return;
    }

    if (key.pageDown) {
      flushPendingPasteText();
      setScrollOffset((previous) => applyScrollDelta(previous, -Math.max(6, Math.floor(transcriptViewportLineCount / 2)), maxScrollOffset));
      return;
    }

    if (showSlashMenu) {
      if (key.return) {
        flushPendingPasteText();
        const selectedSuggestion = slashState.suggestions[selectedSlashIndex];
        const slashHasArgs = composerState.value.trim().includes(" ");
        if (selectedSuggestion && !slashHasArgs) {
          if (selectedSuggestion.command.id === "exit") {
            requestImmediateQuit();
            return;
          }
          if (selectedSuggestion.command.id === "workspace") {
            openWorkspacePicker("");
            return;
          }
          openSlashPanel(
            selectedSuggestion.command.id as PraxisSlashPanelId,
            selectedSuggestion.command.id === "workspace" ? currentCwd : "",
          );
          return;
        }
      }
      if (key.tab) {
        flushPendingPasteText();
        const selectedSuggestion = slashState.suggestions[selectedSlashIndex];
        if (selectedSuggestion) {
          const applied = applySlashSuggestion(composerState.value, selectedSuggestion);
          setComposerState((previous) =>
            setTuiTextInputValue(previous, applied.nextInput, applied.nextCursorOffset));
          return;
        }
      }
    }

    flushPendingPasteText();
    const inputResult = applyTuiTextInputKey(composerState, inputText, key);
    if (inputResult.submit) {
      void submitInput();
      return;
    }
    if (inputResult.handled) {
      setComposerState(inputResult.nextState);
      if (!inputResult.nextState.value.trimStart().startsWith("/")) {
        setSelectedSlashIndex(0);
      }
    }
  }, {
    isActive: supportsRawInput,
  });

  const terminalRows = terminalSize.rows;
  const terminalColumns = terminalSize.columns;
  const transcriptLineWidth = Math.max(1, terminalColumns - 2);
  const composerDisplayState = rewindInFlight
    ? createTuiTextInputState()
    : workspacePickerInputState
      ? setTuiTextInputValue(
        createTuiTextInputState(),
        `/workspace ${workspacePickerInputState.value}`,
        "/workspace ".length + workspacePickerInputState.cursorOffset,
      )
      : composerState;
  const composerLines = splitComposerLines(composerDisplayState.value);
  const composerPrefix = rewindInFlight
    ? buildRewindComposerPrefix(rewindAnimationFrame)
    : ">> ";
  const composerPrefixColor = rewindInFlight ? TUI_THEME.cyan : TUI_THEME.mint;
  const startupModelLabel = runtimeConfig
    ? formatModelEffortDisplayLine(
      runtimeConfig.modelPlan.core.main.model,
      runtimeConfig.modelPlan.core.main.reasoning,
      runtimeConfig.modelPlan.core.main.serviceTier === "fast",
    )
    : "Model configuration pending";
  const conversationHeaderLines = useMemo<RenderLine[]>(
    () => [
      ...buildAnimatedStartupWord(startupAnimationStep),
      {
        kind: "detail",
        text: startupModelLabel,
        segments: [
          {
            text: runtimeConfig?.modelPlan.core.main.model ?? "Model",
            color: TUI_THEME.text,
          },
          { text: " with ", color: TUI_THEME.textMuted },
          {
            text: runtimeConfig?.modelPlan.core.main.reasoning ?? "pending",
            color: TUI_THEME.text,
          },
          { text: " effort", color: TUI_THEME.textMuted },
          ...(runtimeConfig?.modelPlan.core.main.serviceTier === "fast"
            ? [{ text: " [FAST]", color: TUI_THEME.violet }]
            : []),
        ],
      },
      {
        kind: "detail",
        text: `WorkSpace: ${shortenPath(currentCwd)}`,
        segments: [
          { text: "WorkSpace: ", color: TUI_THEME.textMuted },
          { text: shortenPath(currentCwd), color: TUI_THEME.text },
        ],
      },
      { kind: "detail", text: "" },
    ],
    [currentCwd, runtimeConfig, startupAnimationStep, startupModelLabel],
  );
  const conversationHeaderExpandedLines = useMemo(
    () => expandRenderLinesForWidth(conversationHeaderLines, transcriptLineWidth),
    [conversationHeaderLines, transcriptLineWidth],
  );
  const transcriptLines = useMemo(
    () => flattenTranscript(transcriptMessages, toolSummaryAnimationFrame),
    [toolSummaryAnimationFrame, transcriptMessages],
  );
  const hasActiveToolSummary = useMemo(
    () => transcriptMessages.some((message) =>
      message.metadata?.source === "tool_summary"
      && message.metadata?.summaryState === "active"
      && !!message.turnId
      && activeTurnIds.has(message.turnId)),
    [activeTurnIds, transcriptMessages],
  );
  const transientRunStatusLine = useMemo(
    () => hasActiveToolSummary
      ? null
      : buildRunStatusLine(runIndicator, runStatusAnimationFrame, transcriptLineWidth),
    [hasActiveToolSummary, runIndicator, runStatusAnimationFrame, transcriptLineWidth],
  );
  const slashState = useMemo(
    () => computeSlashState(composerState.value, DEFAULT_PRAXIS_SLASH_COMMANDS),
    [composerState.value],
  );
  const pendingHumanGates = useMemo(
    () => capabilityViewerSnapshot?.pendingHumanGates ?? [],
    [capabilityViewerSnapshot],
  );
  const pendingHumanGateSignature = useMemo(
    () => resolveHumanGatePendingSignature(pendingHumanGates),
    [pendingHumanGates],
  );
  const cmpSummaryLines = useMemo(
    () => ("cmp" in surfaceState.panels && surfaceState.panels.cmp?.summaryLines) ? surfaceState.panels.cmp.summaryLines : [],
    [surfaceState.panels],
  );
  const mpSummaryLines = useMemo(
    () => ("mp" in surfaceState.panels && surfaceState.panels.mp?.summaryLines) ? surfaceState.panels.mp.summaryLines : [],
    [surfaceState.panels],
  );
  const tapSummaryLines = useMemo(
    () => ("tap" in surfaceState.panels && surfaceState.panels.tap?.summaryLines) ? surfaceState.panels.tap.summaryLines : [],
    [surfaceState.panels],
  );
  const lastTurnSummary = useMemo(() => {
    const latestAssistant = [...transcriptMessages].reverse().find((message) => message.kind === "assistant");
    if (!latestAssistant?.text) {
      return "Last turn: no assistant answer yet";
    }
    return `Last turn: ${compactRuntimeText(latestAssistant.text)}`;
  }, [transcriptMessages]);
  const contextWindowSize = backendContextSnapshot?.windowTokens ?? DEFAULT_CONTEXT_WINDOW;
  const statusContextUsed = backendContextSnapshot?.promptTokens ?? 0;
  const statusContextUsageLine = useMemo(
    () => formatStatusContextUsageLine(statusContextUsed, contextWindowSize),
    [statusContextUsed, contextWindowSize],
  );
  const draftContextTokens = estimateContextUnits(composerState.value);
  const estimatedContextUsed = useMemo(
    () => (backendContextSnapshot?.promptTokens ?? 0) + draftContextTokens,
    [backendContextSnapshot?.promptTokens, draftContextTokens],
  );
  const contextPercent = formatContextUsagePercent(estimatedContextUsed, contextWindowSize);
  const contextBar = useMemo(
    () => renderContextBar(estimatedContextUsed, contextWindowSize),
    [estimatedContextUsed, contextWindowSize],
  );
  const contextWindowLabel = formatContextWindowLabel(contextWindowSize);
  const baseShouldShowConversationHeader = shouldRenderDirectTuiConversationHeader({
    conversationActivated,
    messages: transcriptMessages,
    pendingSessionSwitch: Boolean(pendingSessionSwitch),
  });
  const shouldShowConversationHeader = directTuiAnimationMode === "resume"
    ? false
    : baseShouldShowConversationHeader;
  const slashPanelContext = useMemo<SlashPanelContext>(() => ({
    backendStatus,
    currentCwd,
    sessionId: sessionIdRef.current,
    sessionName,
    configFile,
    runtimeConfig,
    route: config?.baseURL ?? "(unconfigured)",
    activeTaskCount: activeTasks.length,
    runLabel: runIndicator?.label ?? (activeTasks.length > 0 ? "Working" : "Idle"),
    cmpSummaryLines,
    mpSummaryLines,
    tapSummaryLines,
    logPath,
    lastTurnSummary,
    backendContextSnapshot,
    contextWindowSize,
    contextWindowLabel,
    statusContextUsageLine,
    estimatedContextUsed,
    estimatedContextUsedLabel: formatContextWindowLabel(estimatedContextUsed),
    contextPercent,
    draftContextTokens,
    sessions: sessionRecords,
    agents: agentEntries,
    selectedAgentId,
    openAIAuthStatus,
    embeddingConfig,
    rateLimitRecord: statusRateLimitRecord,
    rateLimitRefreshState: statusRateLimitRefreshState,
    pendingInitNote: pendingInitNote ?? undefined,
    cmpViewerSnapshot,
    mpViewerSnapshot,
    capabilityViewerSnapshot,
    pendingHumanGates,
    initViewerSnapshot,
    questionViewerSnapshot,
    questionPanelState,
    questionComposerText: resolveQuestionDraftText({
      snapshot: questionViewerSnapshot,
      state: questionPanelState,
      composerValue: composerState.value,
    }),
    questionAnimationFrame,
    cmpStatusLabel: cmpStatusDescriptor.label,
  }), [
    activeTasks.length,
    agentEntries,
    backendStatus,
    backendContextSnapshot,
    capabilityViewerSnapshot,
    cmpSummaryLines,
    cmpViewerSnapshot,
    config?.baseURL,
    configFile,
    contextPercent,
    contextWindowLabel,
    contextWindowSize,
    currentCwd,
    draftContextTokens,
    estimatedContextUsed,
    embeddingConfig,
    statusContextUsageLine,
    lastTurnSummary,
    logPath,
    mpSummaryLines,
    openAIAuthStatus,
    pendingInitNote,
    statusRateLimitRefreshState,
    statusRateLimitRecord,
    initViewerSnapshot,
    questionAnimationFrame,
    questionPanelState,
    questionViewerSnapshot,
    runIndicator?.label,
    runtimeConfig,
    selectedAgentId,
    sessionName,
    sessionRecords,
    tapSummaryLines,
    mpViewerSnapshot,
    pendingHumanGates,
    composerState.value,
    cmpStatusDescriptor.label,
  ]);
  const slashPanelView = useMemo(
    () => activeSlashPanelId
      ? buildSlashPanelView(
        activeSlashPanelId,
        slashPanelContext,
        slashPanelDraft,
        slashPanelInputState,
        slashPanelFocusIndex,
        panelRenameTarget,
        slashPanelNotice,
        Math.max(40, terminalColumns - 6),
      )
      : null,
    [activeSlashPanelId, panelRenameTarget, slashPanelContext, slashPanelDraft, slashPanelFocusIndex, slashPanelInputState, slashPanelNotice, terminalColumns],
  );
  useEffect(() => {
    if (pendingHumanGates.length === 0) {
      setDismissedHumanGateSignature(null);
      if (activeSlashPanelId === "human-gate") {
        closeHumanGatePanel(false);
      }
      return;
    }
    if (
      activeSlashPanelId !== "human-gate"
      && pendingHumanGateSignature.length > 0
      && pendingHumanGateSignature !== dismissedHumanGateSignature
    ) {
      openHumanGatePanel({ autoOpen: true });
    }
  }, [
    activeSlashPanelId,
    dismissedHumanGateSignature,
    pendingHumanGateSignature,
    pendingHumanGates.length,
  ]);
  useEffect(() => {
    if (!questionViewerSnapshot || questionViewerSnapshot.status !== "active") {
      setQuestionPanelState((previous) =>
        previous.requestId
          ? createEmptyQuestionPanelState()
          : previous);
      return;
    }
    setQuestionPanelState((previous) => buildQuestionPanelState(questionViewerSnapshot, previous));
  }, [questionViewerSnapshot]);
  useEffect(() => {
    if (activeSlashPanelId !== "question" || questionViewerSnapshot?.status !== "active") {
      return;
    }
    const currentQuestion = questionViewerSnapshot.questions[clampQuestionIndex(
      questionPanelState.currentQuestionIndex,
      questionViewerSnapshot.questions.length,
    )];
    const noteMode = isQuestionNoteModeActive(questionPanelState, currentQuestion);
    const nextDraft = currentQuestion?.kind === "freeform" && !noteMode
      ? (questionPanelState.answersByQuestionId[currentQuestion.id]?.answerText ?? "")
      : (questionPanelState.answersByQuestionId[currentQuestion?.id ?? ""]?.annotation ?? "");
    setComposerState((previous) =>
      previous.value === nextDraft
        ? previous
        : createTuiTextInputState(nextDraft));
    setComposerAttachments([]);
    setComposerPastedContents([]);
    setComposerFileReferences([]);
  }, [
    activeSlashPanelId,
    questionPanelState.answersByQuestionId,
    questionPanelState.currentQuestionIndex,
    questionPanelState.noteModeByQuestionId,
    questionViewerSnapshot,
  ]);
  useEffect(() => {
    if (activeSlashPanelId === "init" && initViewerSnapshot?.status === "completed") {
      clearInitCompletedAutoCloseTimer();
      initCompletedAutoCloseTimerRef.current = setTimeout(() => {
        initCompletedAutoCloseTimerRef.current = null;
        closeSlashPanel();
      }, 2_000);
      return () => {
        clearInitCompletedAutoCloseTimer();
      };
    }
    clearInitCompletedAutoCloseTimer();
    return undefined;
  }, [activeSlashPanelId, initViewerSnapshot?.status]);
  useEffect(() => {
    if (activeSlashPanelId !== "human-gate" || pendingHumanGates.length === 0) {
      return;
    }
    setSlashPanelDraft((previous) => {
      const requestedIndex = Number.parseInt(previous.humanGateIndex ?? "0", 10);
      const nextIndex = Math.max(
        0,
        Math.min(Number.isFinite(requestedIndex) ? requestedIndex : 0, pendingHumanGates.length - 1),
      );
      if ((previous.humanGateIndex ?? "0") === String(nextIndex)) {
        return previous;
      }
      return {
        ...previous,
        humanGateIndex: String(nextIndex),
      };
    });
  }, [activeSlashPanelId, pendingHumanGates.length]);
  useEffect(() => {
    setSelectedSlashIndex((previous) => {
      if (slashState.suggestions.length === 0) {
        return 0;
      }
      return Math.min(previous, slashState.suggestions.length - 1);
    });
  }, [slashState.suggestions.length]);
  const commandPaletteItems = useMemo(
    () => slashState.suggestions.map((suggestion) => ({
      key: suggestion.displayText,
      label: suggestion.displayText,
      description: suggestion.description,
    })),
    [slashState.suggestions],
  );
  const rawActiveFileMention = useMemo<ActiveFileMentionToken | undefined>(
    () => {
      if (activeSlashPanelId || modelPicker?.open || workspacePickerInputState || composerState.value.trimStart().startsWith("/")) {
        return undefined;
      }
      return findActiveFileMentionToken(composerState.value, composerState.cursorOffset);
    },
    [activeSlashPanelId, composerState.cursorOffset, composerState.value, modelPicker?.open, workspacePickerInputState],
  );
  useEffect(() => {
    if (!rawActiveFileMention || dismissedFilePopupTokenRef.current !== rawActiveFileMention.tokenText) {
      dismissedFilePopupTokenRef.current = null;
    }
  }, [rawActiveFileMention]);
  useEffect(() => {
    setComposerPopupPageIndex(0);
    setSelectedComposerPopupIndex(0);
  }, [rawActiveFileMention?.tokenText, workspacePickerInputState?.value]);
  const activeFileMention = dismissedFilePopupTokenRef.current === rawActiveFileMention?.tokenText
    ? undefined
    : rawActiveFileMention;
  const filePopupItems = useMemo(() => {
    if (!activeFileMention || !workspaceIndexSnapshot) {
      return [];
    }
    const mergedEntries = new Map<string, { path: string; label: string; score: number; sourceRank: number }>();
    for (const entry of [
      ...searchWorkspaceDirectories(
        workspaceIndexSnapshot,
        activeFileMention.query,
        workspaceIndexSnapshot.directories.length,
      ).filter((candidate) => candidate.path !== ".").map((candidate) => ({
        path: candidate.path,
        label: candidate.displayName,
        score: candidate.score,
        sourceRank: 0,
      })),
      ...searchWorkspaceFiles(
        workspaceIndexSnapshot,
        activeFileMention.query,
        workspaceIndexSnapshot.files.length,
      ).filter((candidate) => candidate.path !== ".").map((candidate) => ({
        path: candidate.path,
        label: candidate.displayName,
        score: candidate.score,
        sourceRank: 1,
      })),
    ]) {
      const previous = mergedEntries.get(entry.path);
      if (
        !previous
        || entry.score > previous.score
        || (entry.score === previous.score && entry.sourceRank < previous.sourceRank)
      ) {
        mergedEntries.set(entry.path, entry);
      }
    }
    return [...mergedEntries.values()]
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        if (left.sourceRank !== right.sourceRank) {
          return left.sourceRank - right.sourceRank;
        }
        if (left.path.length !== right.path.length) {
          return left.path.length - right.path.length;
        }
        return left.path.localeCompare(right.path);
      })
      .map((entry) => ({
        key: `path:${entry.path}`,
        label: entry.label,
        path: entry.path,
      }));
  }, [activeFileMention, workspaceIndexSnapshot]);
  const workspacePopupItems = useMemo(
    () => workspacePickerInputState && workspaceIndexSnapshot
      ? searchWorkspaceDirectories(workspaceIndexSnapshot, workspacePickerInputState.value.trim(), workspaceIndexSnapshot.directories.length)
        .filter((entry) => entry.path !== ".")
        .map((entry) => ({
        key: `workspace:${entry.path}`,
        label: entry.displayName,
        path: entry.path,
      }))
      : [],
    [workspaceIndexSnapshot, workspacePickerInputState],
  );
  const composerPopup = useMemo<ComposerPopupView | null>(() => {
    if (workspacePickerInputState) {
      const page = paginateComposerPopupItems(workspacePopupItems, composerPopupPageIndex, COMPOSER_POPUP_PAGE_SIZE);
      return {
        title: "/workspace",
        description: "Switch current workspace directory",
        detailLines: [
          `    Pick a directory under ${shortenPath(currentCwd)} · query: ${workspacePickerInputState.value || "(type to filter)"}`,
        ],
        items: workspacePopupItems,
        visibleItems: page.visibleItems,
        selectedIndex: selectedComposerPopupIndex,
        pageIndex: page.pageIndex,
        pageCount: page.pageCount,
        totalCount: page.totalCount,
        startIndex: page.startIndex,
        numberWidth: page.numberWidth,
        emptyText: workspaceIndexStatus === "loading"
          ? "Indexing workspace directories..."
          : workspaceIndexStatus === "error"
            ? `Workspace index failed: ${workspaceIndexError ?? "unknown error"}`
            : "If you want to switch outside the current directory, exit first, change to the target directory in your terminal, then use Raxode again.",
        emptyTone: workspaceIndexStatus === "ready" ? TUI_THEME.violet : undefined,
      };
    }
    if (activeFileMention) {
      const page = paginateComposerPopupItems(filePopupItems, composerPopupPageIndex, COMPOSER_POPUP_PAGE_SIZE);
      return {
        title: "@",
        description: "Choose files from the current workspace",
        detailLines: [
          `    Search files under ${shortenPath(currentCwd)} · query: ${activeFileMention.query || "(type to filter)"}`,
        ],
        items: filePopupItems,
        visibleItems: page.visibleItems,
        selectedIndex: selectedComposerPopupIndex,
        pageIndex: page.pageIndex,
        pageCount: page.pageCount,
        totalCount: page.totalCount,
        startIndex: page.startIndex,
        numberWidth: page.numberWidth,
        emptyText: workspaceIndexStatus === "loading"
          ? "Indexing workspace files..."
          : workspaceIndexStatus === "error"
            ? `Workspace index failed: ${workspaceIndexError ?? "unknown error"}`
            : "No matching files found.",
      };
    }
    return null;
  }, [
    activeFileMention,
    composerPopupPageIndex,
    currentCwd,
    filePopupItems,
    selectedComposerPopupIndex,
    workspaceIndexError,
    workspaceIndexStatus,
    workspacePickerInputState,
    workspacePopupItems,
  ]);
  useEffect(() => {
    if (!composerPopup) {
      setSelectedComposerPopupIndex(0);
      setComposerPopupPageIndex(0);
      return;
    }
    setComposerPopupPageIndex((previous) =>
      composerPopup.pageCount === 0
        ? 0
        : Math.min(previous, composerPopup.pageCount - 1));
    setSelectedComposerPopupIndex((previous) =>
      composerPopup.visibleItems.length === 0
        ? 0
        : Math.min(previous, composerPopup.visibleItems.length - 1));
  }, [composerPopup]);
  useEffect(() => {
    if (!slashPanelView) {
      return;
    }
    setSlashPanelFocusIndex((previous) => {
      const currentField = slashPanelView.fields[previous];
      if (currentField && isInteractivePanelField(currentField)) {
        return previous;
      }
      if (slashPanelView.id === "permissions") {
        return findPermissionPanelFocusIndex(
          slashPanelView.fields,
          configFile?.permissions.requestedMode ?? runtimeConfig?.permissions.requestedMode ?? "bapr",
        );
      }
      return findNextInteractiveFieldIndex(slashPanelView.fields, 0, 1);
    });
  }, [configFile?.permissions.requestedMode, runtimeConfig?.permissions.requestedMode, slashPanelView]);
  const showSlashMenu = !activeSlashPanelId && slashState.active && slashState.suggestions.length > 0;
  const exitSummaryLines = useMemo(
    () => exitSummaryDisplay
      ? buildExitSummaryPanelLines(
        exitSummaryDisplay.summary,
        exitSummaryDisplay.animationStep,
        terminalColumns,
      )
      : [],
    [exitSummaryDisplay, terminalColumns],
  );
  const exitSummaryLineCount = exitSummaryDisplay ? exitSummaryLines.length + 1 : 0;
  const slashPanelLineCount = slashPanelView
    ? (slashPanelView.bodyLines?.length ?? 0)
      + (slashPanelView.showChrome === false ? 0 : 1)
      + (slashPanelNotice ? 1 : (slashPanelView.showStatus === false || slashPanelView.showChrome === false ? 0 : 1))
      + (slashPanelView.showFields === false ? 0 : slashPanelView.fields.length)
      + (slashPanelView.showHints === false ? 0 : slashPanelView.hints.length)
      + 1
    : 0;
  const composerPopupLineCount = composerPopup
    ? 1
      + (composerPopup.detailLines?.length ?? 0)
      + Math.max(1, composerPopup.visibleItems.length)
      + (composerPopup.totalCount > 0 ? 1 : 0)
      + 1
      + 1
    : 0;
  const footerLineCount =
    exitSummaryDisplay
      ? exitSummaryLineCount
      : (slashPanelView
        ? slashPanelLineCount
        : composerPopup
          ? composerPopupLineCount
          : (showSlashMenu ? commandPaletteItems.length + 1 : 0))
      + 1
      + composerLines.length
      + 1
      + 1
      + 1;
  const transcriptViewportLineCount = Math.max(6, terminalRows - footerLineCount);
  const transcriptScrollLines = useMemo(
    () => [
      ...(shouldShowConversationHeader ? conversationHeaderExpandedLines : []),
      ...expandRenderLinesForWidth(transcriptLines, transcriptLineWidth),
    ],
    [shouldShowConversationHeader, conversationHeaderExpandedLines, transcriptLineWidth, transcriptLines],
  );
  const maxScrollOffset = Math.max(0, transcriptScrollLines.length - transcriptViewportLineCount);
  useEffect(() => {
    const previous = previousTranscriptLineCountRef.current;
    const next = transcriptScrollLines.length;
    if (scrollOffset > 0 && next > previous) {
      setScrollOffset((current) => Math.min(maxScrollOffset, current + (next - previous)));
    }
    previousTranscriptLineCountRef.current = next;
  }, [maxScrollOffset, scrollOffset, transcriptScrollLines.length]);
  useEffect(() => {
    if (scrollOffset > maxScrollOffset) {
      setScrollOffset(maxScrollOffset);
    }
  }, [maxScrollOffset, scrollOffset]);
  const visibleTranscriptLines = useMemo(
    () => computeVisibleLines(transcriptScrollLines, transcriptViewportLineCount, scrollOffset),
    [scrollOffset, transcriptScrollLines, transcriptViewportLineCount],
  );
  const cwdLabel = shortenPath(currentCwd);
  const activeQuestionPrompt = questionViewerSnapshot?.status === "active"
    ? questionViewerSnapshot.questions[clampQuestionIndex(
      questionPanelState.currentQuestionIndex,
      questionViewerSnapshot.questions.length,
    )]
    : undefined;
  const activeQuestionNoteMode = isQuestionNoteModeActive(questionPanelState, activeQuestionPrompt);
  const composerPlaceholder = activeSlashPanelId === "init"
    ? INIT_COMPOSER_PLACEHOLDER
    : activeSlashPanelId === "question"
      ? (activeQuestionPrompt?.kind === "freeform" && !activeQuestionNoteMode
          ? (activeQuestionPrompt.placeholder ?? "Type the answer for the current question, then press ENTER to confirm")
          : QUESTION_COMPOSER_PLACEHOLDER)
      : COMPOSER_PLACEHOLDER;
  const cmpContextColor = cmpContextActive
    ? CMP_CONTEXT_ANIMATION_COLORS[Math.floor(cmpContextAnimationFrame / 3) % CMP_CONTEXT_ANIMATION_COLORS.length]
    : cmpStatusDescriptor.tone === "danger"
      ? TUI_THEME.red
      : cmpStatusDescriptor.tone === "warning"
        ? TUI_THEME.yellow
        : TUI_THEME.textMuted;
  const composerCursor = measureComposerCursor(composerDisplayState.value, composerDisplayState.cursorOffset);
  const composerCursorRow = Math.max(
    1,
    terminalRows - 2 - ((composerLines.length - 1) - composerCursor.line),
  );
  const composerCursorColumn = Math.max(1, 5 + composerCursor.column);
  composerCursorParking.row = composerCursorRow;
  composerCursorParking.column = composerCursorColumn;
  composerCursorParking.active = exitSummaryDisplay === null && !rewindInFlight;

  useEffect(() => {
    composerCursorParking.active = exitSummaryDisplay === null && !rewindInFlight;
    return () => {
      composerCursorParking.active = false;
    };
  }, [exitSummaryDisplay, rewindInFlight]);
  terminalOverlaySnapshot = modelPicker?.open
    ? buildModelPickerOverlaySnapshot(modelPicker, terminalRows, terminalColumns)
    : null;

  return (
    <Box flexDirection="column" paddingX={1} height={terminalRows}>
      {rewindOverlayState ? (
        <RewindOverlayPane
          viewportLineCount={transcriptViewportLineCount}
          options={rewindTurnOptions}
          selectedTurnIndex={rewindOverlayState.selectedTurnIndex}
          modeOptions={rewindModeOptions}
          selectedModeIndex={rewindOverlayState.selectedModeIndex}
          stage={rewindOverlayState.stage}
          notice={rewindOverlayState.notice}
        />
      ) : (
        <TranscriptPane
          visibleLines={visibleTranscriptLines}
          viewportLineCount={transcriptViewportLineCount}
          transientStatusLine={transientRunStatusLine}
        />
      )}
      {exitSummaryDisplay ? (
        <ExitSummaryPane lines={exitSummaryLines} />
      ) : (
        <ComposerPane
          showSlashMenu={showSlashMenu}
          slashPanel={slashPanelView}
          composerPopup={composerPopup}
          slashPanelFocusIndex={slashPanelFocusIndex}
          slashPanelNotice={slashPanelNotice}
          commandPaletteItems={commandPaletteItems}
          selectedSlashIndex={selectedSlashIndex}
          composerValue={composerDisplayState.value}
          composerLines={composerLines}
          composerPlaceholder={rewindInFlight ? "" : composerPlaceholder}
          composerPrefix={composerPrefix}
          composerPrefixColor={composerPrefixColor}
          composerInputLocked={Boolean(rewindInFlight)}
          workspaceLabel={cwdLabel}
          contextBar={contextBar}
          contextPercent={contextPercent}
          contextWindowLabel={contextWindowLabel}
          lineWidth={Math.max(1, terminalColumns - 2)}
          cmpStatusLabel={cmpStatusDescriptor.label}
          cmpContextActive={cmpContextActive}
          cmpContextColor={cmpContextColor}
        />
      )}
    </Box>
  );
}

directTuiInkInstance = render(<PraxisDirectTuiApp />, {
  stdout: inkCursorAwareStdout,
  stdin: process.stdin,
  stderr: process.stderr,
});
