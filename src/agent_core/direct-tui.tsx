import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { open, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { Box, render, Text, useApp, useInput } from "ink";
import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import stringWidth from "string-width";

import { loadOpenAILiveConfig } from "../rax/live-config.js";
import { applySurfaceEvent, createInitialSurfaceState } from "./surface/reducer.js";
import {
  selectActiveTasks,
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
} from "./surface/types.js";
import {
  applyTuiTextInputKey,
  createTuiTextInputState,
  setTuiTextInputValue,
} from "./tui-input/text-input.js";
import {
  applySlashSuggestion,
  computeSlashState,
  DEFAULT_PRAXIS_SLASH_COMMANDS,
} from "./tui-input/slash-engine.js";
import { resolveCapabilityFamilyDefinition, resolveFamilyOutcomeKind } from "./live-agent-chat/family-telemetry.js";
import { refineWebSearchToolSummary } from "./tui-mini-summary.js";
import { TUI_THEME } from "./tui-theme.js";
import {
  resolveAppRoot,
  resolveConfigRoot,
  resolveStateRoot,
  resolveWorkspaceRoot,
} from "../runtime-paths.js";

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
  turnIndex?: number;
  stage?: string;
  status?: string;
  label?: string;
  elapsedMs?: number;
  userMessage?: string;
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
    errorCode?: string;
    errorDetailCode?: string;
    targetRefs?: string[];
    targetPaths?: string[];
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

function formatTurnUsageDetail(input?: {
  inputTokens?: number;
  outputTokens?: number;
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

const DEFAULT_CONTEXT_WINDOW = 1_050_000;
const CONTEXT_BAR_WIDTH = 24;
const STARTUP_WORD = "RAXCODE";
const STARTUP_ANIMATION_INTERVAL_MS = 200;
const ANIMATION_TICK_MS = 1000 / 60;
const COMPOSER_PLACEHOLDER =
  "Hold Shift to select, Ctrl+V to paste images, @ to choose files, / to choose commands";
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

function decodeEscapedDisplayText(text: string): string {
  if (!/\\[nrt]/u.test(text)) {
    return text;
  }
  try {
    return JSON.parse(`"${text.replace(/\\/gu, "\\\\").replace(/"/gu, "\\\"")}"`) as string;
  } catch {
    return text;
  }
}

function extractTurnResultAnswer(record: LiveLogRecord): string | null {
  const answer = record.core?.answer;
  if (typeof answer === "string") {
    return decodeEscapedDisplayText(answer).trim() || null;
  }
  if (answer && typeof answer === "object" && typeof answer.text === "string") {
    return decodeEscapedDisplayText(answer.text).trim() || null;
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
  if (message.metadata?.source === "tool_summary") {
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
    } else {
      chunks.forEach((chunk, index) => {
        lines.push({
          kind: displayMessage.kind,
          text: `${index === 0 ? `${createMessagePrefix(displayMessage.kind)} ` : "      "}${chunk}`,
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

function formatContextWindowLabel(size: number): string {
  if (size >= 1_000_000) {
    return `${(size / 1_000_000).toFixed(2)}M`;
  }
  if (size >= 1_000) {
    return `${(size / 1_000).toFixed(0)}K`;
  }
  return String(size);
}

function renderContextBar(used: number, total: number): string {
  const ratio = total <= 0 ? 0 : Math.max(0, Math.min(1, used / total));
  const filled = used > 0
    ? Math.max(1, Math.round(ratio * CONTEXT_BAR_WIDTH))
    : 0;
  return `${"█".repeat(filled)}${"░".repeat(Math.max(0, CONTEXT_BAR_WIDTH - filled))}`;
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


const ComposerPane = memo(function ComposerPane({
  showSlashMenu,
  commandPaletteItems,
  selectedSlashIndex,
  composerValue,
  composerLines,
  workspaceLabel,
  contextBar,
  contextPercent,
  contextWindowLabel,
  lineWidth,
  cmpContextActive,
  cmpContextColor,
  cmpSpinnerFrame,
}: {
  showSlashMenu: boolean;
  commandPaletteItems: Array<{ key: string; label: string; description?: string }>;
  selectedSlashIndex: number;
  composerValue: string;
  composerLines: string[];
  workspaceLabel: string;
  contextBar: string;
  contextPercent: string;
  contextWindowLabel: string;
  lineWidth: number;
  cmpContextActive: boolean;
  cmpContextColor?: string;
  cmpSpinnerFrame: string;
}): JSX.Element {
  const maxLabelWidth = commandPaletteItems.reduce((max, item) => Math.max(max, item.label.length), 0);

  return (
    <Box marginTop={1} flexDirection="column">
      {showSlashMenu ? (
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
      ) : null}
      <Text color={TUI_THEME.line}>{"─".repeat(lineWidth)}</Text>
      {composerLines.map((line, index) => (
        <Text key={`composer-line-${index}`}>
          <Text color={TUI_THEME.mint}>{index === 0 ? ">> " : "   "}</Text>
          <Text color={composerValue.length === 0 && index === 0 ? TUI_THEME.textMuted : TUI_THEME.text}>
            {composerValue.length === 0 && index === 0
              ? COMPOSER_PLACEHOLDER
              : (line.length > 0 ? line : " ")}
          </Text>
        </Text>
      ))}
      <Text color={TUI_THEME.line}>{"─".repeat(lineWidth)}</Text>
      <Text wrap="truncate-end">
        <Text color={TUI_THEME.textMuted}>WorkSpace: </Text>
        <Text color={TUI_THEME.text}>{workspaceLabel}</Text>
        <Text color={TUI_THEME.text}>    </Text>
        <Text color={TUI_THEME.text}>{cmpContextActive ? `${cmpSpinnerFrame} ` : "  "}</Text>
        <Text color={cmpContextActive ? cmpContextColor : TUI_THEME.textMuted}>Context </Text>
        <Text color={TUI_THEME.text}>{contextBar} </Text>
        <Text color={TUI_THEME.text}>{contextPercent} </Text>
        <Text color={TUI_THEME.textMuted}>of </Text>
        <Text color={TUI_THEME.text}>{contextWindowLabel}</Text>
      </Text>
    </Box>
  );
});

function PraxisDirectTuiApp(): JSX.Element {
  const { exit } = useApp();
  const appRoot = useMemo(() => resolveAppRoot(process.cwd()), []);
  const config = useMemo(() => loadOpenAILiveConfig(), []);
  const supportsRawInput = Boolean(process.stdin.isTTY && typeof process.stdin.setRawMode === "function");
  const [currentCwd, setCurrentCwd] = useState(() => resolveWorkspaceRoot());
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("starting");
  const [composerState, setComposerState] = useState(() => createTuiTextInputState());
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const [backendEpoch, setBackendEpoch] = useState(0);
  const [logPath, setLogPath] = useState<string | null>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [animationTick, setAnimationTick] = useState(0);
  const [surfaceState, setSurfaceState] = useState<SurfaceAppState>(() => createInitialSurfaceState());
  const [backendContextSnapshot, setBackendContextSnapshot] = useState<ReturnType<typeof normalizeContextSnapshot>>(null);
  const [runIndicator, setRunIndicator] = useState<{ startedAt: string; label: string } | null>(null);
  const [terminalSize, setTerminalSize] = useState(() => ({
    rows: process.stdout.rows ?? 24,
    columns: process.stdout.columns ?? 80,
  }));
  const childRef = useRef<ChildProcessWithoutNullStreams | null>(null);
  const stdoutRemainderRef = useRef("");
  const stderrRemainderRef = useRef("");
  const processedLogByteOffsetRef = useRef(0);
  const sessionIdRef = useRef(`direct-${Date.now()}`);
  const previousTranscriptLineCountRef = useRef(0);
  const assistantDeltaStartedRef = useRef(new Set<string>());
  const interruptPendingRef = useRef(false);
  const backendRestartPendingRef = useRef(false);
  const interruptedTurnIdsRef = useRef(new Set<string>());
  const activeTasksRef = useRef<ReturnType<typeof selectActiveTasks>>([]);
  const activeTurnIdsRef = useRef(new Set<string>());
  const toolFamilyStateRef = useRef(new Map<string, {
    hadFailure: boolean;
    intentLines: string[];
    resultLines: string[];
  }>());
  const toolSummaryRevisionRef = useRef(new Map<string, number>());

  const dispatchSurfaceEvent = (event: Record<string, unknown>) => {
    setSurfaceState((previous) => applySurfaceEvent(previous, event as never));
  };

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
        route: config.baseURL,
        model: currentSession?.model,
        transcriptMessageIds: currentSession?.transcriptMessageIds ?? [],
        taskIds: currentSession?.taskIds ?? [],
      }),
    });
  };

  useEffect(() => {
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
        route: config.baseURL,
        transcriptMessageIds: [],
        taskIds: [],
      }),
    });
  }, [config.baseURL]);

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
  const activeTurnIds = useMemo(
    () => new Set(
      activeTasks
        .map((task) => task.turnId)
        .filter((turnId): turnId is string => typeof turnId === "string" && turnId.length > 0),
    ),
    [activeTasks],
  );
  useEffect(() => {
    activeTasksRef.current = activeTasks;
    activeTurnIdsRef.current = activeTurnIds;
  }, [activeTasks, activeTurnIds]);
  const cmpContextActive = useMemo(
    () => activeTasks.some((task) => task.kind === "cmp_sync"),
    [activeTasks],
  );
  const startupAnimationStep = useMemo(() => {
    const maxStep = STARTUP_WORD.length + STARTUP_RAINBOW_COLORS.length;
    const step = Math.floor((animationTick * ANIMATION_TICK_MS) / STARTUP_ANIMATION_INTERVAL_MS);
    return Math.min(maxStep, step);
  }, [animationTick]);
  const cmpContextAnimationFrame = cmpContextActive
    ? Math.floor(animationTick / 8)
    : 0;
  const runStatusAnimationFrame = runIndicator
    ? Math.floor(animationTick / 8)
    : 0;
  const toolSummaryAnimationFrame = Math.floor(animationTick / 5);
  const shouldAnimate =
    startupAnimationStep < STARTUP_WORD.length + STARTUP_RAINBOW_COLORS.length
    || cmpContextActive
    || Boolean(runIndicator);

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
    const tsxBin = resolve(appRoot, "node_modules/.bin/tsx");
    const backendPath = resolve(appRoot, "src/agent_core/live-agent-chat.ts");
    const configRoot = resolveConfigRoot(appRoot);
    const stateRoot = resolveStateRoot(appRoot);
    const child = spawn(
      tsxBin,
      [backendPath, "--ui=direct"],
      {
        cwd: currentCwd,
        env: {
          ...process.env,
          PRAXIS_APP_ROOT: appRoot,
          PRAXIS_CONFIG_ROOT: configRoot,
          PRAXIS_STATE_ROOT: stateRoot,
          PRAXIS_WORKSPACE_ROOT: currentCwd,
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
          setBackendStatus("ready");
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
  }, [appRoot, backendEpoch, currentCwd]);

  useEffect(() => {
    if (!logPath) {
      return;
    }

    let cancelled = false;
    const tick = async () => {
      try {
        const handle = await open(logPath, "r");
        const stats = await handle.stat();
        const nextSize = stats.size;
        const currentOffset = processedLogByteOffsetRef.current;
        if (nextSize <= currentOffset) {
          await handle.close();
          return;
        }
        const chunkLength = nextSize - currentOffset;
        const buffer = Buffer.alloc(chunkLength);
        await handle.read(buffer, 0, chunkLength, currentOffset);
        await handle.close();
        if (cancelled) {
          return;
        }
        processedLogByteOffsetRef.current = nextSize;
        const raw = buffer.toString("utf8");
        const rows = raw.split("\n").filter((entry) => entry.trim().length > 0);

        for (const row of rows) {
          let record: LiveLogRecord;
          try {
            record = JSON.parse(row) as LiveLogRecord;
          } catch {
            continue;
          }

          const at = record.ts;
          const turnId = createTurnId(record.turnIndex);
          if (interruptedTurnIdsRef.current.has(turnId)) {
            continue;
          }

          if (record.event === "session_start") {
            const sessionContext = normalizeContextSnapshot(record.context);
            if (sessionContext) {
              setBackendContextSnapshot(sessionContext);
            }
            continue;
          }

          if (record.event === "turn_start") {
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
            if (record.userMessage?.trim()) {
              dispatchSurfaceEvent({
                type: "message.appended",
                at,
                message: createSurfaceMessage({
                  messageId: `user:${turnId}`,
                  sessionId: sessionIdRef.current,
                  turnId,
                  kind: "user",
                  text: record.userMessage.trim(),
                  createdAt: at,
                }),
              });
            }
            continue;
          }

          if (record.event === "stage_start") {
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
              const shouldRenderFamilyBlock = familyKey === "websearch" || Boolean(familyKeyFromTelemetry);
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
              const shouldRenderFamilyBlock = familyKey === "websearch" || Boolean(familyKeyFromTelemetry);
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
            } else if (!record.stage?.startsWith("cmp/") && record.stage !== "core/run") {
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
            const assistantMessageId = `assistant:${turnId}`;
            if (answer) {
              dispatchSurfaceEvent({
                type: "message.appended",
                at,
                message: createSurfaceMessage({
                  messageId: assistantMessageId,
                  sessionId: sessionIdRef.current,
                  turnId,
                  kind: "assistant",
                  text: answer,
                  createdAt: at,
                  capabilityKey: record.core?.capabilityKey,
                  status: record.core?.capabilityResultStatus,
                }),
              });
            }
            const usageDetail = formatTurnUsageDetail({
              inputTokens: record.core?.usage?.inputTokens ?? turnContext?.promptTokens,
              outputTokens: record.core?.usage?.outputTokens ?? (answer ? estimateContextUnits(answer) : undefined),
              elapsedMs: record.core?.elapsedMs ?? record.elapsedMs,
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
            assistantDeltaStartedRef.current.delete(`assistant:${turnId}`);
            continue;
          }

          if (record.event === "assistant_delta" && typeof record.text === "string" && record.text.length > 0) {
            if (record.label !== "core/model.infer") {
              continue;
            }
            const assistantMessageId = `assistant:${turnId}`;
            if (!assistantDeltaStartedRef.current.has(assistantMessageId)) {
              assistantDeltaStartedRef.current.add(assistantMessageId);
              dispatchSurfaceEvent({
                type: "message.appended",
                at,
                message: createSurfaceMessage({
                  messageId: assistantMessageId,
                  sessionId: sessionIdRef.current,
                  turnId,
                  kind: "assistant",
                  text: record.text,
                  createdAt: at,
                }),
              });
              continue;
            }
            dispatchSurfaceEvent({
              type: "message.delta",
              at,
              messageId: assistantMessageId,
              textDelta: record.text,
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
        }
      } catch {
        // startup races are expected
      }
    };

    void tick();
    const timer = setInterval(() => {
      void tick();
    }, 350);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [logPath]);

  const submitInput = async () => {
    const message = composerState.value.trim();
    if (!message) {
      return;
    }
    const normalizedMessage = message.toLowerCase();
    const isExitCommand = normalizedMessage === "/exit" || normalizedMessage === "/quit";
    const isWorkspaceCommand = normalizedMessage === "/workspace" || normalizedMessage.startsWith("/workspace ");

    if ((isExitCommand || isWorkspaceCommand) && (runIndicator || activeTasksRef.current.length > 0)) {
      appendInlineError(ACTIVE_TASK_GUARD_TEXT);
      return;
    }

    if (isWorkspaceCommand) {
      const targetInput = message.replace(/^\/workspace\b/u, "").trim();
      if (!targetInput) {
        const at = new Date().toISOString();
        dispatchSurfaceEvent({
          type: "message.appended",
          at,
          message: createSurfaceMessage({
            messageId: `workspace-status:${at}`,
            sessionId: sessionIdRef.current,
            kind: "status",
            text: `Current workspace: ${shortenPath(currentCwd)}`,
            createdAt: at,
          }),
        });
        setComposerState(createTuiTextInputState());
        return;
      }

      const nextCwd = expandWorkspaceInputPath(targetInput, currentCwd);
      try {
        const targetStat = await stat(nextCwd);
        if (!targetStat.isDirectory()) {
          appendInlineError(WORKSPACE_NOT_DIRECTORY_TEXT);
          return;
        }
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "ENOENT") {
          appendInlineError(WORKSPACE_DIRECTORY_MISSING_TEXT);
          return;
        }
        const messageText = error instanceof Error ? error.message : String(error);
        appendInlineError(`Workspace switch failed: ${messageText}`);
        return;
      }

      try {
        process.chdir(nextCwd);
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error);
        appendInlineError(`Workspace switch failed: ${messageText}`);
        return;
      }

      backendRestartPendingRef.current = true;
      setBackendStatus("starting");
      setCurrentCwd(process.cwd());
      setComposerState(createTuiTextInputState());
      setScrollOffset(0);
      updateWorkspaceSurface(process.cwd());
      const at = new Date().toISOString();
      dispatchSurfaceEvent({
        type: "message.appended",
        at,
        message: createSurfaceMessage({
          messageId: `workspace-switched:${at}`,
          sessionId: sessionIdRef.current,
          kind: "status",
          text: `Workspace switched to ${shortenPath(process.cwd())}`,
          createdAt: at,
        }),
      });
      return;
    }

    if (isExitCommand) {
      if (childRef.current && !childRef.current.killed) {
        childRef.current.stdin.write("/exit\u0000");
      }
      exit();
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
    child.stdin.write(`${message}\u0000`);
    setComposerState(createTuiTextInputState());
    setScrollOffset(0);
  };

  useInput((inputText, key) => {
    const mouseScrollDelta = parseMouseScrollDelta(inputText);
    if (mouseScrollDelta !== null) {
      if (mouseScrollDelta !== 0) {
        setScrollOffset((previous) => applyScrollDelta(previous, mouseScrollDelta, maxScrollOffset));
      }
      return;
    }

    if (key.ctrl && inputText === "c") {
      const child = childRef.current;
      if (child && !child.killed) {
        child.stdin.write("/exit\u0000");
      }
      exit();
      return;
    }

    if (key.escape) {
      if (runIndicator || activeTasksRef.current.length > 0 || activeTurnIdsRef.current.size > 0) {
        const child = childRef.current;
        if (child && !child.killed) {
          interruptPendingRef.current = true;
          setRunIndicator(null);
          const at = new Date().toISOString();
          for (const task of activeTasksRef.current) {
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
          dispatchSurfaceEvent({
            type: "message.appended",
            at,
            message: createSurfaceMessage({
              messageId: `interrupt:${at}`,
              sessionId: sessionIdRef.current,
              kind: "error",
              text: "Stopped. Tell Raxcode what to do next.",
              createdAt: at,
            }),
          });
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
        }
        return;
      }
      if (showSlashMenu) {
        setSelectedSlashIndex(0);
        return;
      }
      return;
    }

    if (showSlashMenu && !composerState.value.includes("\n")) {
      if (key.upArrow) {
        setSelectedSlashIndex((previous) =>
          slashState.suggestions.length === 0
            ? 0
            : (previous - 1 + slashState.suggestions.length) % slashState.suggestions.length);
        return;
      }
      if (key.downArrow) {
        setSelectedSlashIndex((previous) =>
          slashState.suggestions.length === 0
            ? 0
            : (previous + 1) % slashState.suggestions.length);
        return;
      }
    }

    if (key.upArrow) {
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
      setScrollOffset((previous) => applyScrollDelta(previous, Math.max(6, Math.floor(transcriptViewportLineCount / 2)), maxScrollOffset));
      return;
    }

    if (key.pageDown) {
      setScrollOffset((previous) => applyScrollDelta(previous, -Math.max(6, Math.floor(transcriptViewportLineCount / 2)), maxScrollOffset));
      return;
    }

    if (showSlashMenu) {
      if (key.tab || key.return) {
        const selectedSuggestion = slashState.suggestions[selectedSlashIndex];
        if (selectedSuggestion) {
          const applied = applySlashSuggestion(composerState.value, selectedSuggestion);
          setComposerState((previous) =>
            setTuiTextInputValue(previous, applied.nextInput, applied.nextCursorOffset));
          if (!key.return) {
            return;
          }
          if (composerState.value.trim() !== applied.nextInput.trim()) {
            return;
          }
        }
      }
    }

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

  const transcriptMessages = useMemo(
    () => selectTranscriptMessages(surfaceState),
    [surfaceState],
  );
  const terminalRows = terminalSize.rows;
  const terminalColumns = terminalSize.columns;
  const transcriptLineWidth = Math.max(1, terminalColumns - 2);
  const composerLines = splitComposerLines(composerState.value);
  const startupPreludeLines = useMemo<RenderLine[]>(
    () => [
      ...buildAnimatedStartupWord(startupAnimationStep),
      {
        kind: "detail",
        text: "GPT-5.4 with high effort",
        segments: [
          { text: "GPT-5.4", color: TUI_THEME.text },
          { text: " with ", color: TUI_THEME.textMuted },
          { text: "high", color: TUI_THEME.text },
          { text: " effort", color: TUI_THEME.textMuted },
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
    [startupAnimationStep],
  );
  const startupPreludeExpandedLines = useMemo(
    () => expandRenderLinesForWidth(startupPreludeLines, transcriptLineWidth),
    [startupPreludeLines, transcriptLineWidth],
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
  const showSlashMenu = slashState.active && slashState.suggestions.length > 0;
  const footerLineCount =
    (showSlashMenu ? commandPaletteItems.length + 1 : 0)
    + 1
    + composerLines.length
    + 1
    + 1
    + 1;
  const transcriptViewportLineCount = Math.max(6, terminalRows - footerLineCount);
  const transcriptScrollLines = useMemo(
    () => [...startupPreludeExpandedLines, ...expandRenderLinesForWidth(transcriptLines, transcriptLineWidth)],
    [startupPreludeExpandedLines, transcriptLineWidth, transcriptLines],
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
  const contextWindowSize = backendContextSnapshot?.windowTokens ?? DEFAULT_CONTEXT_WINDOW;
  const draftContextTokens = estimateContextUnits(composerState.value);
  const estimatedContextUsed = useMemo(
    () => (backendContextSnapshot?.promptTokens ?? 0) + draftContextTokens,
    [backendContextSnapshot?.promptTokens, draftContextTokens],
  );
  const contextRatio = Math.max(0, Math.min(1, estimatedContextUsed / contextWindowSize));
  const contextPercent = estimatedContextUsed === 0
    ? "0%"
    : contextRatio < 0.01
      ? "<1%"
      : `${Math.round(contextRatio * 100)}%`;
  const contextBar = useMemo(
    () => renderContextBar(estimatedContextUsed, contextWindowSize),
    [estimatedContextUsed, contextWindowSize],
  );
  const cmpContextColor = cmpContextActive
    ? CMP_CONTEXT_ANIMATION_COLORS[Math.floor(cmpContextAnimationFrame / 3) % CMP_CONTEXT_ANIMATION_COLORS.length]
    : TUI_THEME.textMuted;
  const cmpSpinnerFrame = cmpContextActive
    ? CMP_CONTEXT_SPINNER_FRAMES[Math.floor(cmpContextAnimationFrame / 2) % CMP_CONTEXT_SPINNER_FRAMES.length]
    : "";
  const contextWindowLabel = formatContextWindowLabel(contextWindowSize);
  const composerCursor = measureComposerCursor(composerState.value, composerState.cursorOffset);
  const composerCursorRow = Math.max(
    1,
    terminalRows - 2 - ((composerLines.length - 1) - composerCursor.line),
  );
  const composerCursorColumn = Math.max(1, 5 + composerCursor.column);
  composerCursorParking.row = composerCursorRow;
  composerCursorParking.column = composerCursorColumn;
  composerCursorParking.active = true;

  useEffect(() => {
    composerCursorParking.active = true;
    return () => {
      composerCursorParking.active = false;
    };
  }, []);

  return (
    <Box flexDirection="column" paddingX={1} height={terminalRows}>
      <TranscriptPane
        visibleLines={visibleTranscriptLines}
        viewportLineCount={transcriptViewportLineCount}
        transientStatusLine={transientRunStatusLine}
      />
      <ComposerPane
        showSlashMenu={showSlashMenu}
        commandPaletteItems={commandPaletteItems}
        selectedSlashIndex={selectedSlashIndex}
        composerValue={composerState.value}
        composerLines={composerLines}
        workspaceLabel={cwdLabel}
        contextBar={contextBar}
        contextPercent={contextPercent}
        contextWindowLabel={contextWindowLabel}
        lineWidth={Math.max(1, terminalColumns - 2)}
        cmpContextActive={cmpContextActive}
        cmpContextColor={cmpContextColor}
        cmpSpinnerFrame={cmpSpinnerFrame}
      />
    </Box>
  );
}

render(<PraxisDirectTuiApp />, {
  stdout: inkCursorAwareStdout,
  stdin: process.stdin,
  stderr: process.stderr,
});
