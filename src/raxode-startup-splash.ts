import { writeSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import stringWidth from "string-width";
import type { RaxcodeAnimationMode } from "./raxcode-config.js";
import { buildRaxodeTerminalTitle, writeTerminalTitle } from "./terminal-title.js";

const require = createRequire(import.meta.url);
const nodePty = require("node-pty") as typeof import("node-pty");

export interface RaxodeStartupLaunchPlan {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  animationMode?: RaxcodeAnimationMode;
}

interface PersistedExitSummaryPayload {
  lines?: string[];
}

const EXIT_SUMMARY_WAIT_TIMEOUT_MS = 450;
const EXIT_SUMMARY_WAIT_POLL_MS = 25;

const INPUT_PROMPT_PREFIX = ">> ";
const INPUT_PROMPT_TEXT = "Hello, AI World!";
const INPUT_PROMPT_WIDTH = stringWidth(INPUT_PROMPT_TEXT) + 1;
const INPUT_TYPING_STEP_MS = 52;
const INPUT_HOLD_MS = 500;
const PRAXIS_HOLD_MS = 120;
const PRAXIS_REVEAL_COLUMNS_PER_FRAME = 14;
const PRAXIS_REVEAL_STEP_MS = 14;
const PRAXIS_ERASE_COLUMNS_PER_FRAME = 15;
const PRAXIS_ERASE_STEP_MS = 14;
const PTY_READY_GRACE_MS = 6_000;

const PRAXIS_ART_LINES = [
  "████████╗",
  "██╔════██╗                            ██╗",
  "██║    ██║ ██████╗  ██████╗  ██╗  ██╗ ╚═╝ ███████╗",
  "████████╔╝ ██╔══██╗ ╚═══███╗ ╚██╗██╔╝ ██╗ ██╔════╝",
  "██╔═════╝  ██║  ╚═╝ ███████║  ╚███╔╝  ██║ ███████╗",
  "██║        ██║      ██╔══██║  ██╔██╗  ██║ ╚════██║",
  "██║        ██║      ╚██████║ ██╔╝ ██╗ ██║ ███████║",
  "╚═╝        ╚═╝       ╚═════╝ ╚═╝  ╚═╝ ╚═╝ ╚══════╝",
] as const;

function countVisibleColumns(value: string): number {
  return stringWidth(value);
}

function revealTextByColumns(value: string, visibleColumns: number): string {
  if (visibleColumns <= 0) {
    return "";
  }
  let output = "";
  let width = 0;
  for (const char of [...value]) {
    const charWidth = Math.max(1, stringWidth(char));
    if (width + charWidth > visibleColumns) {
      break;
    }
    output += char;
    width += charWidth;
  }
  return output;
}

function eraseTextByColumns(value: string, erasedColumns: number): string {
  if (erasedColumns <= 0) {
    return value;
  }
  let width = 0;
  let index = 0;
  const chars = [...value];
  while (index < chars.length && width < erasedColumns) {
    width += Math.max(1, stringWidth(chars[index] ?? ""));
    index += 1;
  }
  return chars.slice(index).join("");
}

function renderCenteredFrame(lines: string[]): string {
  const columns = process.stdout.columns ?? 80;
  const rows = process.stdout.rows ?? 24;
  const contentWidth = lines.reduce((max, line) => Math.max(max, countVisibleColumns(line)), 0);
  const top = Math.max(1, Math.floor((rows - lines.length) / 2) + 1);
  const left = Math.max(1, Math.floor((columns - contentWidth) / 2) + 1);
  const output: string[] = ["\u001B[2J", "\u001B[H"];
  lines.forEach((line, index) => {
    output.push(`\u001B[${top + index};${left}H${line}`);
  });
  return output.join("");
}

function buildTypingFrame(visibleChars: number): string[] {
  const typed = INPUT_PROMPT_TEXT.slice(0, Math.max(0, Math.min(visibleChars, INPUT_PROMPT_TEXT.length)));
  const line = `${INPUT_PROMPT_PREFIX}${typed}█`;
  const remaining = Math.max(0, INPUT_PROMPT_WIDTH - stringWidth(`${typed}█`));
  return [`${line}${" ".repeat(remaining)}`];
}

function buildPraxisRevealFrame(lineIndex: number, visibleColumns: number): string[] {
  return PRAXIS_ART_LINES.map((line, index) => {
    if (index < lineIndex) {
      return line;
    }
    if (index === lineIndex) {
      return revealTextByColumns(line, visibleColumns);
    }
    return "";
  });
}

function buildPraxisEraseFrame(lineIndex: number, erasedColumns: number): string[] {
  return PRAXIS_ART_LINES.map((line, index) => {
    if (index < lineIndex) {
      return "";
    }
    if (index === lineIndex) {
      return eraseTextByColumns(line, erasedColumns);
    }
    return line;
  });
}

function enterAltScreen(): void {
  process.stdout.write("\u001B[?1049h\u001B[?25l");
}

function leaveAltScreen(): void {
  process.stdout.write("\u001B[?25h\u001B[?1049l");
}

async function readPersistedExitSummaryLines(summaryPath: string): Promise<string[] | null> {
  try {
    const payload = JSON.parse(await readFile(summaryPath, "utf8")) as PersistedExitSummaryPayload;
    if (!Array.isArray(payload.lines) || payload.lines.some((line) => typeof line !== "string")) {
      return null;
    }
    return payload.lines;
  } catch {
    return null;
  }
}

async function waitForPersistedExitSummaryLines(
  summaryPath: string,
  options: {
    timeoutMs?: number;
    pollMs?: number;
  } = {},
): Promise<string[] | null> {
  const timeoutMs = options.timeoutMs ?? EXIT_SUMMARY_WAIT_TIMEOUT_MS;
  const pollMs = options.pollMs ?? EXIT_SUMMARY_WAIT_POLL_MS;
  const deadline = Date.now() + Math.max(0, timeoutMs);
  while (Date.now() <= deadline) {
    const lines = await readPersistedExitSummaryLines(summaryPath);
    if (lines && lines.length > 0) {
      return lines;
    }
    if (Date.now() >= deadline) {
      break;
    }
    await delay(pollMs);
  }
  return null;
}

function buildFallbackExitSummaryLines(sessionId?: string): string[] {
  const command = sessionId ? `raxode resume ${sessionId}` : "raxode resume";
  const body = [
    "RAXODE EXIT SUMMARY UNAVAILABLE",
    "Session finished, but the summary payload could not be recovered.",
    `Resume to RUN:  ${command}`,
  ];
  const width = body.reduce((max, line) => Math.max(max, countVisibleColumns(line)), 0);
  return [
    `┌${"─".repeat(width + 2)}┐`,
    ...body.map((line) => `│ ${line}${" ".repeat(width - countVisibleColumns(line))} │`),
    `└${"─".repeat(width + 2)}┘`,
  ];
}

function writePersistedExitSummaryToTerminal(lines: string[]): void {
  if (lines.length === 0) {
    return;
  }
  const lineBreak = process.stdout.isTTY ? "\r\n" : "\n";
  const summaryText = `${
    process.stdout.isTTY
      ? "\u001B[?25h\u001B[0m\u001B[2K\r\u001B[2J\u001B[3J\u001B[H"
      : ""
  }${lines.join(lineBreak)}${lineBreak}${lineBreak}`;
  if (typeof process.stdout.fd === "number") {
    writeSync(process.stdout.fd, summaryText);
    return;
  }
  process.stdout.write(summaryText);
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

function isRenderablePtyChunk(chunk: string): boolean {
  return chunk.length > 0;
}

export async function runRaxodeTuiWithStartupSplash(
  launchPlan: RaxodeStartupLaunchPlan,
): Promise<number> {
  if (!process.stdin.isTTY || !process.stdout.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error("TTY startup splash requires interactive stdin/stdout.");
  }

  const previousRawMode = process.stdin.isRaw === true;
  let handedOff = false;
  let cleanedUp = false;
  let inAltScreen = false;
  let childExited = false;
  let childExitCode = 1;
  let bufferedOutput = "";
  const shouldPlaySplash = (launchPlan.animationMode ?? "fresh") === "fresh";
  const exitSummaryDir = await mkdtemp(join(tmpdir(), "raxode-exit-summary-"));
  const exitSummaryPath = join(exitSummaryDir, "summary.json");
  const childReady = createDeferred<void>();
  const childFinished = createDeferred<number>();
  const childReadyGate = Promise.race([
    childReady.promise,
    delay(PTY_READY_GRACE_MS),
  ]);
  const pty = nodePty.spawn(launchPlan.command, launchPlan.args, {
    name: process.env.TERM ?? "xterm-256color",
    cols: process.stdout.columns ?? 80,
    rows: process.stdout.rows ?? 24,
    cwd: launchPlan.cwd,
    env: {
      ...Object.fromEntries(
        Object.entries(launchPlan.env).map(([key, value]) => [key, value === undefined ? "" : value]),
      ),
      PRAXIS_BOOTSTRAP_MODE: launchPlan.animationMode ?? "fresh",
      PRAXIS_EXIT_SUMMARY_FILE: exitSummaryPath,
    },
  });

  let readyResolved = false;
  let lastFrameLines: string[] = buildTypingFrame(0);

  const enterAltScreenOnce = () => {
    if (inAltScreen) {
      return;
    }
    inAltScreen = true;
    enterAltScreen();
  };

  const leaveAltScreenOnce = () => {
    if (!inAltScreen) {
      return;
    }
    inAltScreen = false;
    leaveAltScreen();
  };

  const cleanup = () => {
    if (cleanedUp) {
      return;
    }
    cleanedUp = true;
    process.stdin.off("data", onInput);
    process.stdout.off("resize", onResize);
    if (!previousRawMode) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
    leaveAltScreenOnce();
  };

  const finalizeChildSession = async (): Promise<number> => {
    const exitCode = await childFinished.promise;
    const summaryLines = await waitForPersistedExitSummaryLines(exitSummaryPath);
    cleanup();
    if (summaryLines && summaryLines.length > 0) {
      writePersistedExitSummaryToTerminal(summaryLines);
    } else {
      writePersistedExitSummaryToTerminal(
        buildFallbackExitSummaryLines(launchPlan.env.PRAXIS_DIRECT_SESSION_ID),
      );
    }
    return exitCode;
  };

  const render = (lines: string[]) => {
    lastFrameLines = lines;
    process.stdout.write(renderCenteredFrame(lines));
  };

  const markReady = () => {
    if (readyResolved) {
      return;
    }
    readyResolved = true;
    childReady.resolve(undefined);
  };

  const onResize = () => {
    pty.resize(process.stdout.columns ?? 80, process.stdout.rows ?? 24);
    if (!handedOff) {
      render(lastFrameLines);
    }
  };

  const onInput = (chunk: Buffer | string) => {
    const data = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk;
    if (!handedOff) {
      if (data.includes("\u0003")) {
        pty.kill("SIGINT");
      }
      return;
    }
    pty.write(data);
  };

  pty.onData((data) => {
    if (isRenderablePtyChunk(data)) {
      markReady();
    }
    if (handedOff) {
      process.stdout.write(data);
      return;
    }
    bufferedOutput += data;
  });

  pty.onExit(({ exitCode }) => {
    childExited = true;
    childExitCode = exitCode;
    markReady();
    childFinished.resolve(exitCode);
  });

  enterAltScreenOnce();
  writeTerminalTitle(buildRaxodeTerminalTitle());
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on("data", onInput);
  process.stdout.on("resize", onResize);

  try {
    if (!shouldPlaySplash) {
      handedOff = true;
      process.stdout.write("\u001B[2J\u001B[H");
      if (bufferedOutput.length > 0) {
        process.stdout.write(bufferedOutput);
        bufferedOutput = "";
      }
      return await finalizeChildSession();
    }

    render(buildTypingFrame(0));
    for (let index = 1; index <= INPUT_PROMPT_TEXT.length; index += 1) {
      if (childExited) {
        break;
      }
      render(buildTypingFrame(index));
      await delay(INPUT_TYPING_STEP_MS);
    }

    if (!childExited) {
      await delay(INPUT_HOLD_MS);
    }

    if (!childExited) {
      for (let lineIndex = 0; lineIndex < PRAXIS_ART_LINES.length; lineIndex += 1) {
        const lineWidth = countVisibleColumns(PRAXIS_ART_LINES[lineIndex] ?? "");
        for (let visibleColumns = PRAXIS_REVEAL_COLUMNS_PER_FRAME; visibleColumns <= lineWidth; visibleColumns += PRAXIS_REVEAL_COLUMNS_PER_FRAME) {
          render(buildPraxisRevealFrame(lineIndex, visibleColumns));
          await delay(PRAXIS_REVEAL_STEP_MS);
        }
        render(buildPraxisRevealFrame(lineIndex, lineWidth));
      }

      await delay(PRAXIS_HOLD_MS);

      if (!readyResolved) {
        await childReadyGate;
      }

      for (let lineIndex = 0; lineIndex < PRAXIS_ART_LINES.length; lineIndex += 1) {
        const lineWidth = countVisibleColumns(PRAXIS_ART_LINES[lineIndex] ?? "");
        for (let erasedColumns = PRAXIS_ERASE_COLUMNS_PER_FRAME; erasedColumns <= lineWidth; erasedColumns += PRAXIS_ERASE_COLUMNS_PER_FRAME) {
          render(buildPraxisEraseFrame(lineIndex, erasedColumns));
          await delay(PRAXIS_ERASE_STEP_MS);
        }
        render(buildPraxisEraseFrame(lineIndex, lineWidth));
      }
    }

    if (childExited) {
      return await finalizeChildSession();
    }

    handedOff = true;
    process.stdout.write("\u001B[2J\u001B[H");
    if (bufferedOutput.length > 0) {
      process.stdout.write(bufferedOutput);
      bufferedOutput = "";
    }

    return await finalizeChildSession();
  } catch (error) {
    cleanup();
    try {
      pty.kill("SIGTERM");
    } catch {
      // ignore shutdown races
    }
    throw error;
  } finally {
    await rm(exitSummaryDir, { recursive: true, force: true }).catch(() => {});
  }
}

export const raxodeStartupSplashTestUtils = {
  buildTypingFrame,
  buildPraxisRevealFrame,
  buildPraxisEraseFrame,
  revealTextByColumns,
  eraseTextByColumns,
  buildFallbackExitSummaryLines,
  readPersistedExitSummaryLines,
  waitForPersistedExitSummaryLines,
};
