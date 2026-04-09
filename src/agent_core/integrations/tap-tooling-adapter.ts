import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

import type {
  CapabilityAdapter,
  CapabilityInvocationPlan,
  CapabilityLease,
  CapabilityManifest,
  PreparedCapabilityCall,
} from "../capability-types/index.js";
import { createPreparedCapabilityCall } from "../capability-invocation/index.js";
import { createCapabilityResultEnvelope } from "../capability-result/index.js";
import type { AccessRequestScope } from "../ta-pool-types/index.js";
import type { CapabilityPackage } from "../capability-package/index.js";
import {
  createTapToolingBaselineCapabilityPackages,
  createTapToolingCapabilityPackage,
  isTapToolingBaselineCapabilityKey,
  type TapToolingBaselineCapabilityKey,
} from "../capability-package/index.js";
import { materializeCapabilityManifestFromActivation } from "../ta-pool-runtime/activation-materializer.js";
import type { ActivationAdapterFactoryContext } from "../ta-pool-runtime/activation-factory-resolver.js";

export interface RepoWriteEntry {
  path: string;
  content?: string;
  mode?: "write_text" | "append_text" | "mkdir";
  createParents?: boolean;
}

export interface RepoWriteInput {
  path?: string;
  content?: string;
  mode?: RepoWriteEntry["mode"];
  createParents?: boolean;
  entries?: RepoWriteEntry[];
}

export interface CodeEditInput {
  path?: string;
  file_path?: string;
  old_string?: string;
  oldString?: string;
  new_string?: string;
  newString?: string;
  replace_all?: boolean;
  allow_multiple?: boolean;
  createParents?: boolean;
}

export interface CodePatchInput {
  patch?: string;
  diff?: string;
  input?: string;
}

export interface SkillDocSection {
  heading: string;
  body: string | string[];
}

export interface SkillDocGenerateInput {
  path?: string;
  title?: string;
  summary?: string;
  content?: string;
  format?: "markdown" | "text";
  createParents?: boolean;
  frontmatter?: Record<string, string>;
  sections?: SkillDocSection[];
}

interface NormalizedRepoWriteEntry {
  absolutePath: string;
  relativeWorkspacePath: string;
  mode: NonNullable<RepoWriteEntry["mode"]>;
  content?: string;
  createParents: boolean;
}

interface NormalizedSkillDocGenerateInput {
  entry: NormalizedRepoWriteEntry;
  format: "markdown" | "text";
  title?: string;
  sectionCount: number;
}

export interface ShellRestrictedInput {
  command: string | string[];
  args?: string[];
  cwd?: string;
  workdir?: string;
  dir_path?: string;
  timeoutMs?: number;
  timeout_ms?: number;
  timeout?: number;
  env?: Record<string, string>;
  runInBackground?: boolean;
  is_background?: boolean;
  tty?: boolean;
  yieldTimeMs?: number;
  yield_time_ms?: number;
  maxOutputChars?: number;
  max_output_tokens?: number;
  description?: string;
}

export interface ShellSessionInput extends ShellRestrictedInput {
  action?: "start" | "poll" | "write" | "terminate";
  sessionId?: string;
  session_id?: string;
  chars?: string;
}

export interface GitStatusInput {
  path?: string;
  cwd?: string;
  workdir?: string;
  dir_path?: string;
  includeIgnored?: boolean;
  include_ignored?: boolean;
  maxEntries?: number;
  maxOutputChars?: number;
}

export interface GitDiffInput {
  path?: string;
  paths?: string[];
  cwd?: string;
  workdir?: string;
  dir_path?: string;
  staged?: boolean;
  cached?: boolean;
  base?: string;
  rev?: string;
  maxOutputChars?: number;
}

export interface GitCommitInput {
  path?: string;
  paths?: string[];
  cwd?: string;
  workdir?: string;
  dir_path?: string;
  message?: string;
  commitMessage?: string;
  authorName?: string;
  author_name?: string;
  authorEmail?: string;
  author_email?: string;
  all?: boolean;
  amend?: boolean;
  noVerify?: boolean;
  no_verify?: boolean;
}

export interface GitPushInput {
  cwd?: string;
  workdir?: string;
  dir_path?: string;
  remote?: string;
  branch?: string;
  setUpstream?: boolean;
  set_upstream?: boolean;
  force?: boolean;
  forceWithLease?: boolean;
  force_with_lease?: boolean;
}

export interface CodeDiffInput {
  leftPath?: string;
  rightPath?: string;
  path?: string;
  before?: string;
  after?: string;
  base?: string;
  maxOutputChars?: number;
}

export interface WriteTodosInput {
  todos?: Array<{
    description?: string;
    status?: "pending" | "in_progress" | "completed" | "cancelled" | "blocked";
  }>;
}

interface NormalizedCommandInput {
  command: string;
  args: string[];
  cwd: string;
  relativeWorkspaceCwd: string;
  timeoutMs: number;
  env?: Record<string, string>;
  runInBackground: boolean;
  tty: boolean;
  yieldTimeMs?: number;
  maxOutputChars: number;
  commandSummary: string;
  commandKind: "search" | "read" | "list" | "write" | "test" | "general";
  description?: string;
}

export interface CommandExecutionResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface TapToolingAdapterOptions {
  workspaceRoot: string;
  repoWriteHandler?: (
    entries: NormalizedRepoWriteEntry[],
  ) => Promise<Array<Record<string, unknown>>>;
  commandRunner?: (
    input: NormalizedCommandInput,
  ) => Promise<CommandExecutionResult>;
  defaultShellTimeoutMs?: number;
  defaultTestTimeoutMs?: number;
}

interface PreparedRepoWriteState {
  entries: NormalizedRepoWriteEntry[];
}

interface NormalizedCodeEditInput {
  absolutePath: string;
  relativeWorkspacePath: string;
  oldString: string;
  newString: string;
  replaceAll: boolean;
  createParents: boolean;
}

type ParsedPatchLineKind = "context" | "add" | "remove";

interface ParsedPatchLine {
  kind: ParsedPatchLineKind;
  text: string;
}

interface ParsedPatchHunk {
  header?: string;
  lines: ParsedPatchLine[];
}

type ParsedPatchOperation =
  | {
    type: "add";
    path: string;
    lines: string[];
  }
  | {
    type: "delete";
    path: string;
  }
  | {
    type: "update";
    path: string;
    moveTo?: string;
    hunks: ParsedPatchHunk[];
  };

interface NormalizedCodePatchInput {
  patch: string;
  operations: ParsedPatchOperation[];
}

interface PreparedSkillDocState {
  input: NormalizedSkillDocGenerateInput;
}

interface PreparedCodeEditState {
  input: NormalizedCodeEditInput;
}

interface PreparedCodePatchState {
  input: NormalizedCodePatchInput;
  scope?: AccessRequestScope;
}

interface PreparedShellSessionState {
  input: NormalizedCommandInput & {
    action: "start" | "poll" | "write" | "terminate";
    sessionId?: string;
    chars?: string;
  };
}

interface GitStatusEntry {
  code: string;
  path: string;
}

interface PreparedGitStatusState {
  cwd: { absolutePath: string; relativeWorkspacePath: string };
  includeIgnored: boolean;
  maxEntries: number;
  maxOutputChars: number;
}

interface PreparedGitDiffState {
  cwd: { absolutePath: string; relativeWorkspacePath: string };
  paths?: string[];
  staged: boolean;
  base?: string;
  maxOutputChars: number;
}

interface PreparedGitCommitState {
  cwd: { absolutePath: string; relativeWorkspacePath: string };
  paths?: string[];
  stageAll: boolean;
  message: string;
  authorName?: string;
  authorEmail?: string;
  maxOutputChars: number;
}

interface PreparedGitPushState {
  cwd: { absolutePath: string; relativeWorkspacePath: string };
  remote: string;
  branch?: string;
  setUpstream: boolean;
  maxOutputChars: number;
}

interface PreparedCodeDiffState {
  cwd: { absolutePath: string; relativeWorkspacePath: string };
  leftPath?: string;
  rightPath?: string;
  before?: string;
  after?: string;
  base?: string;
  maxOutputChars: number;
  scope?: AccessRequestScope;
}

interface TodoEntry {
  description: string;
  status: "pending" | "in_progress" | "completed" | "cancelled" | "blocked";
}

interface PreparedWriteTodosState {
  sessionId: string;
  todos: TodoEntry[];
}

interface PreparedCommandState {
  input: NormalizedCommandInput;
}

interface ShellSessionRuntimeState {
  sessionId: string;
  child: ReturnType<typeof spawn>;
  stdoutBuffer: string;
  stderrBuffer: string;
  startedAt: number;
  closedAt?: number;
  exitCode?: number | null;
  signal?: NodeJS.Signals | null;
  cwd: string;
  relativeWorkspaceCwd: string;
  commandSummary: string;
  commandKind: NormalizedCommandInput["commandKind"];
  maxOutputChars: number;
}

const SHELL_SESSION_RUNTIME = new Map<string, ShellSessionRuntimeState>();
const WRITE_TODOS_RUNTIME = new Map<string, TodoEntry[]>();
let shellSessionSequence = 0;

function createShellSessionId(): string {
  shellSessionSequence += 1;
  return `shell-session-${shellSessionSequence}`;
}

export interface TapToolingRegistrationTarget {
  registerCapabilityAdapter(
    manifest: CapabilityManifest,
    adapter: CapabilityAdapter,
  ): unknown;
  registerTaActivationFactory(
    ref: string,
    factory: (context: ActivationAdapterFactoryContext) => CapabilityAdapter,
  ): void;
}

export interface RegisterTapToolingBaselineResult {
  capabilityKeys: TapToolingBaselineCapabilityKey[];
  manifests: CapabilityManifest[];
  packages: CapabilityPackage[];
  bindings: unknown[];
  activationFactoryRefs: string[];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value.filter((item): item is string => typeof item === "string");
  return normalized.length > 0 ? normalized : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asStringRecord(value: unknown): Record<string, string> | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const entries = Object.entries(record).filter(([, entry]) => typeof entry === "string");
  return entries.length > 0
    ? Object.fromEntries(entries) as Record<string, string>
    : undefined;
}

function escapeGlobPattern(pattern: string): string {
  return pattern.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function matchPathPattern(candidate: string, pattern: string): boolean {
  const escaped = escapeGlobPattern(pattern)
    .replace(/\*\*/g, "__DOUBLE_WILDCARD__")
    .replace(/\*/g, "[^/]*")
    .replace(/__DOUBLE_WILDCARD__/g, ".*");
  return new RegExp(`^${escaped}$`).test(candidate);
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) {
    return 0;
  }

  let count = 0;
  let index = 0;
  while (true) {
    const found = haystack.indexOf(needle, index);
    if (found < 0) {
      return count;
    }
    count += 1;
    index = found + Math.max(1, needle.length);
  }
}

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function restoreNewlines(value: string, template: string): string {
  return template.includes("\r\n") ? value.replace(/\n/g, "\r\n") : value;
}

async function readTextFileIfExists(absolutePath: string): Promise<string | undefined> {
  try {
    return await readFile(absolutePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function countLines(value: string): number {
  if (!value) {
    return 0;
  }
  return normalizeNewlines(value).split("\n").length;
}

function getGrantedScope(plan: CapabilityInvocationPlan): AccessRequestScope | undefined {
  const metadata = asRecord(plan.metadata);
  const scope = metadata?.grantedScope;
  return asRecord(scope) as AccessRequestScope | undefined;
}

function assertOperationAllowed(
  scope: AccessRequestScope | undefined,
  operationCandidates: string[],
): void {
  if (!scope?.allowedOperations || scope.allowedOperations.length === 0) {
    return;
  }

  if (!operationCandidates.some((candidate) => scope.allowedOperations?.includes(candidate))) {
    throw new Error(
      `Granted scope does not allow any of the required operations: ${operationCandidates.join(", ")}.`,
    );
  }
}

function resolvePathWithinWorkspace(params: {
  workspaceRoot: string;
  candidatePath: string;
  scope?: AccessRequestScope;
  operationCandidates: string[];
  label: string;
}): { absolutePath: string; relativeWorkspacePath: string } {
  const workspaceRoot = path.resolve(params.workspaceRoot);
  const resolved = path.resolve(workspaceRoot, params.candidatePath);
  const relative = path.relative(workspaceRoot, resolved);
  if (!relative || relative === "") {
    const workspaceRelative = "workspace/";
    if (params.scope?.pathPatterns?.length) {
      const allowed = params.scope.pathPatterns.some((pattern) =>
        matchPathPattern(workspaceRelative, pattern)
      );
      if (!allowed) {
        throw new Error(
          `${params.label} ${params.candidatePath} is outside the granted workspace path patterns.`,
        );
      }
    }
    assertOperationAllowed(params.scope, params.operationCandidates);
    return {
      absolutePath: resolved,
      relativeWorkspacePath: ".",
    };
  }

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${params.label} ${params.candidatePath} escapes the workspace root.`);
  }

  const workspaceRelative = `workspace/${relative.split(path.sep).join("/")}`;
  if (params.scope?.denyPatterns?.some((pattern) => matchPathPattern(workspaceRelative, pattern))) {
    throw new Error(`${params.label} ${params.candidatePath} is denied by the granted scope.`);
  }
  if (params.scope?.pathPatterns?.length) {
    const allowed = params.scope.pathPatterns.some((pattern) =>
      matchPathPattern(workspaceRelative, pattern)
    );
    if (!allowed) {
      throw new Error(
        `${params.label} ${params.candidatePath} is outside the granted workspace path patterns.`,
      );
    }
  }

  assertOperationAllowed(params.scope, params.operationCandidates);
  return {
    absolutePath: resolved,
    relativeWorkspacePath: relative.split(path.sep).join("/"),
  };
}

function createDefaultRepoWriteHandler() {
  return async (entries: NormalizedRepoWriteEntry[]): Promise<Array<Record<string, unknown>>> => {
    const results: Array<Record<string, unknown>> = [];
    for (const entry of entries) {
      if (entry.createParents) {
        await mkdir(path.dirname(entry.absolutePath), { recursive: true });
      }

      if (entry.mode === "mkdir") {
        await mkdir(entry.absolutePath, { recursive: true });
        results.push({
          mode: entry.mode,
          path: entry.relativeWorkspacePath,
        });
        continue;
      }

      if (entry.content === undefined) {
        throw new Error(`Repo write entry ${entry.relativeWorkspacePath} is missing content.`);
      }

      if (entry.mode === "append_text") {
        await appendFile(entry.absolutePath, entry.content, "utf8");
      } else {
        await writeFile(entry.absolutePath, entry.content, "utf8");
      }

      results.push({
        mode: entry.mode,
        path: entry.relativeWorkspacePath,
        bytesWritten: Buffer.byteLength(entry.content),
      });
    }
    return results;
  };
}

function createDefaultCommandRunner() {
  return async (input: NormalizedCommandInput): Promise<CommandExecutionResult> => {
    return await new Promise<CommandExecutionResult>((resolve, reject) => {
      const child = spawn(input.command, input.args, {
        cwd: input.cwd,
        env: input.env ? { ...process.env, ...input.env } : process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        setTimeout(() => {
          child.kill("SIGKILL");
        }, 250).unref();
      }, input.timeoutMs);

      child.stdout?.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr?.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on("close", (exitCode, signal) => {
        clearTimeout(timer);
        resolve({
          exitCode,
          signal,
          stdout,
          stderr,
          timedOut,
        });
      });
    });
  };
}

const DEFAULT_RESTRICTED_COMMAND_DENY_PATTERNS = [
  /^sudo$/i,
  /^rm$/i,
  /^dd$/i,
  /^mkfs/i,
];

const DEFAULT_RESTRICTED_ARG_DENY_PATTERNS = [
  /^-rf$/,
  /^--no-preserve-root$/,
  /^--hard$/,
];

const DEFAULT_TEST_COMMAND_ALLOWLIST = new Set([
  "npm",
  "pnpm",
  "yarn",
  "bun",
  "npx",
  "tsx",
  "vitest",
  "jest",
  "node",
]);

const SEARCH_COMMANDS = new Set(["rg", "grep", "find", "fd", "ag", "ack"]);
const READ_COMMANDS = new Set(["cat", "sed", "head", "tail", "less", "more"]);
const LIST_COMMANDS = new Set(["ls", "tree", "du"]);
const WRITE_COMMANDS = new Set(["cp", "mv", "touch", "mkdir", "ln"]);

function summarizeCommand(command: string, args: string[], capabilityKey: TapToolingBaselineCapabilityKey): {
  summary: string;
  kind: "search" | "read" | "list" | "write" | "test" | "general";
} {
  const base = path.basename(command);
  const joined = [base, ...args].join(" ").trim();
  if (capabilityKey === "test.run") {
    return {
      summary: joined || base,
      kind: "test",
    };
  }
  if (SEARCH_COMMANDS.has(base)) {
    return { summary: joined || base, kind: "search" };
  }
  if (READ_COMMANDS.has(base)) {
    return { summary: joined || base, kind: "read" };
  }
  if (LIST_COMMANDS.has(base)) {
    return { summary: joined || base, kind: "list" };
  }
  if (WRITE_COMMANDS.has(base)) {
    return { summary: joined || base, kind: "write" };
  }
  return { summary: joined || base, kind: "general" };
}

function trimCommandOutput(value: string, maxChars: number): { text: string; truncated: boolean; originalChars: number } {
  if (value.length <= maxChars) {
    return {
      text: value,
      truncated: false,
      originalChars: value.length,
    };
  }
  const head = Math.max(0, Math.floor(maxChars * 0.65));
  const tail = Math.max(0, maxChars - head - 32);
  return {
    text: `${value.slice(0, head)}\n...[truncated ${value.length - head - tail} chars]...\n${value.slice(Math.max(head, value.length - tail))}`,
    truncated: true,
    originalChars: value.length,
  };
}

function normalizeCommandInput(params: {
  plan: CapabilityInvocationPlan;
  workspaceRoot: string;
  defaultTimeoutMs: number;
  capabilityKey: TapToolingBaselineCapabilityKey;
  operationCandidates: string[];
}): NormalizedCommandInput {
  const inputRecord = asRecord(params.plan.input) ?? {};
  const commandValue = inputRecord.command;
  const commandArray = asStringArray(commandValue);
  const command = commandArray?.[0] ?? asString(commandValue);
  if (!command) {
    throw new Error(`${params.capabilityKey} requires a non-empty command.`);
  }

  const args = commandArray
    ? [...commandArray.slice(1), ...(asStringArray(inputRecord.args) ?? [])]
    : asStringArray(inputRecord.args) ?? [];
  if (params.capabilityKey === "shell.restricted") {
    if (DEFAULT_RESTRICTED_COMMAND_DENY_PATTERNS.some((pattern) => pattern.test(command))) {
      throw new Error(`shell.restricted rejects command ${command}.`);
    }
    if (args.some((arg) => DEFAULT_RESTRICTED_ARG_DENY_PATTERNS.some((pattern) => pattern.test(arg)))) {
      throw new Error("shell.restricted rejects destructive arguments.");
    }
  }

  if (
    params.capabilityKey === "test.run"
    && !DEFAULT_TEST_COMMAND_ALLOWLIST.has(path.basename(command))
  ) {
    throw new Error(`test.run only allows test-oriented commands, got ${command}.`);
  }

  const scope = getGrantedScope(params.plan);
  const cwd = resolvePathWithinWorkspace({
    workspaceRoot: params.workspaceRoot,
    candidatePath:
      asString(inputRecord.cwd)
      ?? asString(inputRecord.workdir)
      ?? asString(inputRecord.dir_path)
      ?? ".",
    scope,
    operationCandidates: params.operationCandidates,
    label: `${params.capabilityKey} cwd`,
  });

  const timeoutMs =
    asNumber(inputRecord.timeoutMs)
    ?? asNumber(inputRecord.timeout_ms)
    ?? asNumber(inputRecord.timeout)
    ?? params.plan.timeoutMs
    ?? params.defaultTimeoutMs;
  const commandSummary = summarizeCommand(command, args, params.capabilityKey);
  const maxOutputChars = asNumber(inputRecord.maxOutputChars)
    ?? (() => {
      const tokenBudget = asNumber(inputRecord.max_output_tokens);
      return tokenBudget ? Math.max(1000, tokenBudget * 4) : undefined;
    })()
    ?? (params.capabilityKey === "test.run" ? 20_000 : 12_000);

  return {
    command,
    args,
    cwd: cwd.absolutePath,
    relativeWorkspaceCwd: cwd.relativeWorkspacePath,
    timeoutMs,
    env: asStringRecord(inputRecord.env),
    runInBackground: inputRecord.runInBackground === true || inputRecord.is_background === true,
    tty: inputRecord.tty === true,
    yieldTimeMs: asNumber(inputRecord.yieldTimeMs) ?? asNumber(inputRecord.yield_time_ms),
    maxOutputChars,
    commandSummary: commandSummary.summary,
    commandKind: commandSummary.kind,
    description: asString(inputRecord.description),
  };
}

function normalizeRepoWriteEntries(
  plan: CapabilityInvocationPlan,
  workspaceRoot: string,
): NormalizedRepoWriteEntry[] {
  const scope = getGrantedScope(plan);
  const record = asRecord(plan.input) ?? {};
  const entries = Array.isArray(record.entries)
    ? record.entries as RepoWriteEntry[]
    : [{
      path: asString(record.path) ?? "",
      content: asString(record.content),
      mode: (asString(record.mode) as RepoWriteEntry["mode"] | undefined) ?? "write_text",
      createParents: typeof record.createParents === "boolean" ? record.createParents : true,
    }];

  if (entries.length === 0) {
    throw new Error("repo.write requires at least one write entry.");
  }

  return entries.map((entry) => {
    const candidatePath = asString(entry.path);
    if (!candidatePath) {
      throw new Error("repo.write entry requires a non-empty path.");
    }
    const mode = entry.mode ?? "write_text";
    if (
      mode !== "write_text"
      && mode !== "append_text"
      && mode !== "mkdir"
    ) {
      throw new Error(`repo.write entry has unsupported mode ${String(entry.mode)}.`);
    }

    const resolved = resolvePathWithinWorkspace({
      workspaceRoot,
      candidatePath,
      scope,
      operationCandidates: [mode === "mkdir" ? "mkdir" : mode === "append_text" ? "append" : "write", "repo.write"],
      label: "repo.write path",
    });

    return {
      absolutePath: resolved.absolutePath,
      relativeWorkspacePath: resolved.relativeWorkspacePath,
      mode,
      content: entry.content,
      createParents: entry.createParents ?? true,
    };
  });
}

function normalizeCodeEditInput(
  plan: CapabilityInvocationPlan,
  workspaceRoot: string,
): NormalizedCodeEditInput {
  const scope = getGrantedScope(plan);
  const record = asRecord(plan.input) ?? {};
  const candidatePath = asString(record.path) ?? asString(record.file_path) ?? asString(record.filePath);
  if (!candidatePath) {
    throw new Error("code.edit requires a non-empty path or file_path.");
  }
  const oldString = asString(record.old_string) ?? asString(record.oldString);
  const newString = asString(record.new_string) ?? asString(record.newString);
  if (oldString === undefined || newString === undefined) {
    throw new Error("code.edit requires old_string and new_string.");
  }
  if (oldString === newString) {
    throw new Error("code.edit requires old_string and new_string to differ.");
  }

  const resolved = resolvePathWithinWorkspace({
    workspaceRoot,
    candidatePath,
    scope,
    operationCandidates: ["read", "write", "mkdir", "code.edit"],
    label: "code.edit path",
  });

  return {
    absolutePath: resolved.absolutePath,
    relativeWorkspacePath: resolved.relativeWorkspacePath,
    oldString,
    newString,
    replaceAll: asBoolean(record.replace_all) ?? asBoolean(record.allow_multiple) ?? false,
    createParents: asBoolean(record.createParents) ?? true,
  };
}

function parseCodePatchDocument(patchText: string): ParsedPatchOperation[] {
  const normalized = normalizeNewlines(patchText);
  const lines = normalized.split("\n");
  if (lines[0] !== "*** Begin Patch") {
    throw new Error("code.patch requires a Codex-style patch starting with *** Begin Patch.");
  }
  const endIndex = lines.lastIndexOf("*** End Patch");
  if (endIndex < 0) {
    throw new Error("code.patch requires a closing *** End Patch marker.");
  }

  const operations: ParsedPatchOperation[] = [];
  let index = 1;
  while (index < endIndex) {
    const line = lines[index];
    if (!line) {
      index += 1;
      continue;
    }

    if (line.startsWith("*** Add File: ")) {
      const filePath = line.slice("*** Add File: ".length).trim();
      const addedLines: string[] = [];
      index += 1;
      while (index < endIndex && !lines[index].startsWith("*** ")) {
        const current = lines[index];
        if (!current.startsWith("+")) {
          throw new Error(`code.patch add file ${filePath} expects only + lines.`);
        }
        addedLines.push(current.slice(1));
        index += 1;
      }
      if (addedLines.length === 0) {
        throw new Error(`code.patch add file ${filePath} requires at least one + line.`);
      }
      operations.push({
        type: "add",
        path: filePath,
        lines: addedLines,
      });
      continue;
    }

    if (line.startsWith("*** Delete File: ")) {
      operations.push({
        type: "delete",
        path: line.slice("*** Delete File: ".length).trim(),
      });
      index += 1;
      continue;
    }

    if (line.startsWith("*** Update File: ")) {
      const filePath = line.slice("*** Update File: ".length).trim();
      let moveTo: string | undefined;
      const hunks: ParsedPatchHunk[] = [];
      index += 1;
      if (index < endIndex && lines[index].startsWith("*** Move to: ")) {
        moveTo = lines[index].slice("*** Move to: ".length).trim();
        index += 1;
      }

      while (index < endIndex && !lines[index].startsWith("*** ")) {
        const headerLine = lines[index];
        if (!headerLine.startsWith("@@")) {
          throw new Error(`code.patch update ${filePath} expects @@ hunk headers.`);
        }
        const header = headerLine.length > 2 ? headerLine.slice(2).trim() || undefined : undefined;
        index += 1;
        const hunkLines: ParsedPatchLine[] = [];
        while (index < endIndex && !lines[index].startsWith("@@") && !lines[index].startsWith("*** ")) {
          const current = lines[index];
          if (current === "*** End of File") {
            index += 1;
            break;
          }
          const prefix = current[0];
          if (prefix !== " " && prefix !== "+" && prefix !== "-") {
            throw new Error(`code.patch update ${filePath} contains invalid hunk line ${current}.`);
          }
          hunkLines.push({
            kind: prefix === " " ? "context" : prefix === "+" ? "add" : "remove",
            text: current.slice(1),
          });
          index += 1;
        }
        if (hunkLines.length === 0) {
          throw new Error(`code.patch update ${filePath} contains an empty hunk.`);
        }
        hunks.push({ header, lines: hunkLines });
      }

      if (hunks.length === 0) {
        throw new Error(`code.patch update ${filePath} requires at least one hunk.`);
      }
      operations.push({
        type: "update",
        path: filePath,
        moveTo,
        hunks,
      });
      continue;
    }

    throw new Error(`code.patch encountered an unknown directive: ${line}`);
  }

  if (operations.length === 0) {
    throw new Error("code.patch requires at least one file operation.");
  }
  return operations;
}

function normalizeCodePatchInput(
  plan: CapabilityInvocationPlan,
): NormalizedCodePatchInput {
  const record = asRecord(plan.input) ?? {};
  const patch = asString(record.patch) ?? asString(record.diff) ?? asString(record.input);
  if (!patch) {
    throw new Error("code.patch requires a non-empty patch string.");
  }

  return {
    patch,
    operations: parseCodePatchDocument(patch),
  };
}

function countPatchLineChanges(lines: ParsedPatchLine[]): {
  addedLines: number;
  removedLines: number;
} {
  let addedLines = 0;
  let removedLines = 0;
  for (const line of lines) {
    if (line.kind === "add") {
      addedLines += 1;
    } else if (line.kind === "remove") {
      removedLines += 1;
    }
  }
  return { addedLines, removedLines };
}

function normalizeSkillDocSections(value: unknown): Array<{ heading: string; body: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((section, index) => {
    const record = asRecord(section);
    const heading = record ? asString(record.heading) : undefined;
    if (!heading) {
      throw new Error(`skill.doc.generate section ${index + 1} requires a heading.`);
    }

    const bodyValue = record?.body;
    if (typeof bodyValue === "string") {
      return {
        heading,
        body: bodyValue,
      };
    }

    if (Array.isArray(bodyValue) && bodyValue.every((entry) => typeof entry === "string")) {
      return {
        heading,
        body: bodyValue.join("\n"),
      };
    }

    throw new Error(`skill.doc.generate section ${index + 1} requires string body content.`);
  });
}

function createSkillDocContent(input: {
  format: "markdown" | "text";
  title?: string;
  summary?: string;
  content?: string;
  frontmatter?: Record<string, string>;
  sections: Array<{ heading: string; body: string }>;
}): string {
  const chunks: string[] = [];
  if (input.format === "markdown" && input.frontmatter && Object.keys(input.frontmatter).length > 0) {
    const frontmatterLines = Object.entries(input.frontmatter)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
    chunks.push(["---", ...frontmatterLines, "---"].join("\n"));
  }

  if (input.content) {
    chunks.push(input.content);
    return chunks.join("\n\n");
  }

  if (input.title) {
    chunks.push(input.format === "markdown" ? `# ${input.title}` : input.title);
  }

  if (input.summary) {
    chunks.push(input.summary);
  }

  for (const section of input.sections) {
    if (input.format === "markdown") {
      chunks.push(`## ${section.heading}\n\n${section.body}`);
      continue;
    }

    chunks.push(`${section.heading}\n${"-".repeat(section.heading.length)}\n${section.body}`);
  }

  if (chunks.length === 0) {
    throw new Error("skill.doc.generate requires content, title, summary, or sections.");
  }

  return chunks.join("\n\n");
}

function normalizeSkillDocGenerateInput(
  plan: CapabilityInvocationPlan,
  workspaceRoot: string,
): NormalizedSkillDocGenerateInput {
  const scope = getGrantedScope(plan);
  const record = asRecord(plan.input) ?? {};
  const candidatePath = asString(record.path);
  if (!candidatePath) {
    throw new Error("skill.doc.generate requires a non-empty path.");
  }

  const resolved = resolvePathWithinWorkspace({
    workspaceRoot,
    candidatePath,
    scope,
    operationCandidates: ["write", "mkdir", "skill.doc.generate"],
    label: "skill.doc.generate path",
  });
  const normalizedPath = resolved.relativeWorkspacePath.toLowerCase();
  const inferredFormat = normalizedPath.endsWith(".txt")
    ? "text"
    : normalizedPath.endsWith(".md") || normalizedPath.endsWith(".mdx")
      ? "markdown"
      : undefined;
  const requestedFormat = asString(record.format);
  const format = requestedFormat === "text" || requestedFormat === "markdown"
    ? requestedFormat
    : inferredFormat;
  if (!format) {
    throw new Error("skill.doc.generate only supports .md, .mdx, or .txt outputs.");
  }
  if (format === "markdown" && inferredFormat === "text") {
    throw new Error("skill.doc.generate markdown output requires a .md or .mdx path.");
  }
  if (format === "text" && inferredFormat !== "text") {
    throw new Error("skill.doc.generate text output requires a .txt path.");
  }

  const sections = normalizeSkillDocSections(record.sections);
  const content = createSkillDocContent({
    format,
    title: asString(record.title),
    summary: asString(record.summary),
    content: asString(record.content),
    frontmatter: asStringRecord(record.frontmatter),
    sections,
  });

  return {
    entry: {
      absolutePath: resolved.absolutePath,
      relativeWorkspacePath: resolved.relativeWorkspacePath,
      mode: "write_text",
      content,
      createParents: typeof record.createParents === "boolean" ? record.createParents : true,
    },
    format,
    title: asString(record.title),
    sectionCount: sections.length,
  };
}

function normalizeShellSessionAction(value: unknown): "start" | "poll" | "write" | "terminate" {
  return value === "poll" || value === "write" || value === "terminate" ? value : "start";
}

function normalizeShellSessionInput(params: {
  plan: CapabilityInvocationPlan;
  workspaceRoot: string;
  defaultTimeoutMs: number;
}): PreparedShellSessionState["input"] {
  const record = asRecord(params.plan.input) ?? {};
  const action = normalizeShellSessionAction(record.action);
  const sessionId = asString(record.sessionId) ?? asString(record.session_id);
  const chars = asString(record.chars) ?? "";
  if (action === "poll" || action === "write" || action === "terminate") {
    if (!sessionId) {
      throw new Error(`shell.session action ${action} requires sessionId.`);
    }
    return {
      action,
      sessionId,
      chars,
      command: "",
      args: [],
      cwd: params.workspaceRoot,
      relativeWorkspaceCwd: ".",
      timeoutMs:
        asNumber(record.timeoutMs)
        ?? asNumber(record.timeout_ms)
        ?? asNumber(record.timeout)
        ?? params.plan.timeoutMs
        ?? params.defaultTimeoutMs,
      env: asStringRecord(record.env),
      runInBackground: false,
      tty: record.tty === true,
      yieldTimeMs: asNumber(record.yieldTimeMs) ?? asNumber(record.yield_time_ms) ?? 250,
      maxOutputChars:
        asNumber(record.maxOutputChars)
        ?? (() => {
          const tokenBudget = asNumber(record.max_output_tokens);
          return tokenBudget ? Math.max(1000, tokenBudget * 4) : undefined;
        })()
        ?? 12_000,
      commandSummary: `session:${action}`,
      commandKind: "general",
      description: asString(record.description),
    };
  }

  return {
    action,
    ...normalizeCommandInput({
      plan: params.plan,
      workspaceRoot: params.workspaceRoot,
      defaultTimeoutMs: params.defaultTimeoutMs,
      capabilityKey: "shell.session" as TapToolingBaselineCapabilityKey,
      operationCandidates: ["exec", "shell.session"],
    }),
    sessionId,
    chars,
  };
}

function normalizeGitCwd(
  plan: CapabilityInvocationPlan,
  workspaceRoot: string,
  operationCandidates: string[],
  label: string,
) {
  const record = asRecord(plan.input) ?? {};
  return resolvePathWithinWorkspace({
    workspaceRoot,
    candidatePath:
      asString(record.cwd)
      ?? asString(record.workdir)
      ?? asString(record.dir_path)
      ?? ".",
    scope: getGrantedScope(plan),
    operationCandidates,
    label,
  });
}

function normalizeGitStatusInput(
  plan: CapabilityInvocationPlan,
  workspaceRoot: string,
): PreparedGitStatusState {
  const record = asRecord(plan.input) ?? {};
  return {
    cwd: normalizeGitCwd(plan, workspaceRoot, ["read", "git.status"], "git.status cwd"),
    includeIgnored: asBoolean(record.includeIgnored) ?? asBoolean(record.include_ignored) ?? false,
    maxEntries: asNumber(record.maxEntries) ?? 200,
    maxOutputChars:
      asNumber(record.maxOutputChars)
      ?? (() => {
        const tokenBudget = asNumber(record.max_output_tokens);
        return tokenBudget ? Math.max(1000, tokenBudget * 4) : undefined;
      })()
      ?? 10_000,
  };
}

function normalizeGitDiffInput(
  plan: CapabilityInvocationPlan,
  workspaceRoot: string,
): PreparedGitDiffState {
  const record = asRecord(plan.input) ?? {};
  const scope = getGrantedScope(plan);
  const rawPaths = asStringArray(record.paths) ?? (asString(record.path) ? [asString(record.path)!] : undefined);
  const paths = rawPaths?.map((candidatePath) =>
    resolvePathWithinWorkspace({
      workspaceRoot,
      candidatePath,
      scope,
      operationCandidates: ["read", "git.diff"],
      label: "git.diff path",
    }).relativeWorkspacePath,
  );
  return {
    cwd: normalizeGitCwd(plan, workspaceRoot, ["read", "git.diff"], "git.diff cwd"),
    paths,
    staged: asBoolean(record.staged) ?? asBoolean(record.cached) ?? false,
    base: asString(record.base) ?? asString(record.rev),
    maxOutputChars:
      asNumber(record.maxOutputChars)
      ?? (() => {
        const tokenBudget = asNumber(record.max_output_tokens);
        return tokenBudget ? Math.max(1000, tokenBudget * 4) : undefined;
      })()
      ?? 16_000,
  };
}

const SECRET_LIKE_GIT_PATH_PATTERNS = [
  /(^|\/)\.env(\.|$|\/)/i,
  /(^|\/)\.npmrc$/i,
  /(^|\/)\.pypirc$/i,
  /(^|\/)credentials(\.[^.\/]+)?\.json$/i,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i,
  /\.pem$/i,
  /\.key$/i,
];

function normalizeGitCommitInput(
  plan: CapabilityInvocationPlan,
  workspaceRoot: string,
): PreparedGitCommitState {
  const record = asRecord(plan.input) ?? {};
  if (asBoolean(record.amend) === true) {
    throw new Error("git.commit does not allow amend; create a new commit instead.");
  }
  if ((asBoolean(record.noVerify) ?? asBoolean(record.no_verify)) === true) {
    throw new Error("git.commit does not allow skipping hooks or verification.");
  }

  const scope = getGrantedScope(plan);
  const rawPaths = asStringArray(record.paths) ?? (asString(record.path) ? [asString(record.path)!] : undefined);
  const stageAll = asBoolean(record.all) === true;
  if (!stageAll && (!rawPaths || rawPaths.length === 0)) {
    throw new Error("git.commit requires explicit path(s) unless all=true is provided.");
  }

  const paths = rawPaths?.map((candidatePath) =>
    resolvePathWithinWorkspace({
      workspaceRoot,
      candidatePath,
      scope,
      operationCandidates: ["read", "write", "exec", "git.commit"],
      label: "git.commit path",
    }).relativeWorkspacePath,
  );

  for (const candidate of paths ?? []) {
    if (SECRET_LIKE_GIT_PATH_PATTERNS.some((pattern) => pattern.test(candidate))) {
      throw new Error(`git.commit blocks secret-like path ${candidate}.`);
    }
  }

  const message = asString(record.message) ?? asString(record.commitMessage);
  if (!message || message.trim().length === 0) {
    throw new Error("git.commit requires a non-empty commit message.");
  }

  return {
    cwd: normalizeGitCwd(plan, workspaceRoot, ["read", "write", "exec", "git.commit"], "git.commit cwd"),
    paths,
    stageAll,
    message: message.trim(),
    authorName: asString(record.authorName) ?? asString(record.author_name),
    authorEmail: asString(record.authorEmail) ?? asString(record.author_email),
    maxOutputChars:
      asNumber(record.maxOutputChars)
      ?? (() => {
        const tokenBudget = asNumber(record.max_output_tokens);
        return tokenBudget ? Math.max(1000, tokenBudget * 4) : undefined;
      })()
      ?? 10_000,
  };
}

function normalizeGitPushInput(
  plan: CapabilityInvocationPlan,
  workspaceRoot: string,
): PreparedGitPushState {
  const record = asRecord(plan.input) ?? {};
  if (asBoolean(record.force) === true || (asBoolean(record.forceWithLease) ?? asBoolean(record.force_with_lease)) === true) {
    throw new Error("git.push does not allow force push or force-with-lease.");
  }

  return {
    cwd: normalizeGitCwd(plan, workspaceRoot, ["read", "write", "exec", "git.push"], "git.push cwd"),
    remote: asString(record.remote)?.trim() || "origin",
    branch: asString(record.branch)?.trim() || undefined,
    setUpstream: asBoolean(record.setUpstream) ?? asBoolean(record.set_upstream) ?? false,
    maxOutputChars:
      asNumber(record.maxOutputChars)
      ?? (() => {
        const tokenBudget = asNumber(record.max_output_tokens);
        return tokenBudget ? Math.max(1000, tokenBudget * 4) : undefined;
      })()
      ?? 10_000,
  };
}

function normalizeCodeDiffInput(
  plan: CapabilityInvocationPlan,
  workspaceRoot: string,
): PreparedCodeDiffState {
  const record = asRecord(plan.input) ?? {};
  const leftPath = asString(record.leftPath) ?? asString(record.path);
  const rightPath = asString(record.rightPath);
  const before = asString(record.before);
  const after = asString(record.after);
  const base = asString(record.base);
  if (!before && !leftPath) {
    throw new Error("code.diff requires leftPath/path or before.");
  }
  if (!after && !rightPath && !base) {
    throw new Error("code.diff requires rightPath/after or base.");
  }
  return {
    cwd: normalizeGitCwd(plan, workspaceRoot, ["read", "code.diff"], "code.diff cwd"),
    leftPath,
    rightPath,
    before,
    after,
    base,
    scope: getGrantedScope(plan),
    maxOutputChars:
      asNumber(record.maxOutputChars)
      ?? (() => {
        const tokenBudget = asNumber(record.max_output_tokens);
        return tokenBudget ? Math.max(1000, tokenBudget * 4) : undefined;
      })()
      ?? 16_000,
  };
}

function normalizeWriteTodosInput(
  plan: CapabilityInvocationPlan,
): PreparedWriteTodosState {
  const record = asRecord(plan.input) ?? {};
  const todosValue = record.todos;
  if (!Array.isArray(todosValue)) {
    throw new Error("write_todos requires a todos array.");
  }

  const todos = todosValue.map((todo, index) => {
    const entry = asRecord(todo);
    const description = entry ? asString(entry.description) : undefined;
    const status = entry ? asString(entry.status) : undefined;
    if (!description) {
      throw new Error(`write_todos item ${index + 1} requires a non-empty description.`);
    }
    if (
      status !== "pending"
      && status !== "in_progress"
      && status !== "completed"
      && status !== "cancelled"
      && status !== "blocked"
    ) {
      throw new Error(`write_todos item ${index + 1} has unsupported status ${String(status)}.`);
    }
    return { description, status };
  });

  if (todos.filter((todo) => todo.status === "in_progress").length > 1) {
    throw new Error("write_todos allows at most one in_progress item.");
  }

  return {
    sessionId: plan.sessionId,
    todos: todos as TodoEntry[],
  };
}

async function waitForMs(value: number | undefined): Promise<void> {
  if (!value || value <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, value));
}

function drainSessionOutput(state: ShellSessionRuntimeState) {
  const stdout = trimCommandOutput(state.stdoutBuffer, state.maxOutputChars);
  const stderr = trimCommandOutput(state.stderrBuffer, state.maxOutputChars);
  state.stdoutBuffer = "";
  state.stderrBuffer = "";
  return { stdout, stderr };
}

async function runSimpleCommand(
  commandRunner: (input: NormalizedCommandInput) => Promise<CommandExecutionResult>,
  input: NormalizedCommandInput,
) {
  return await commandRunner(input);
}

function createGitCommandInput(params: {
  cwd: { absolutePath: string; relativeWorkspacePath: string };
  capabilityKey: "git.status" | "git.diff" | "git.commit" | "git.push" | "code.diff";
  args: string[];
  maxOutputChars: number;
}): NormalizedCommandInput {
  const summary = summarizeCommand("git", params.args, "shell.restricted");
  return {
    command: "git",
    args: params.args,
    cwd: params.cwd.absolutePath,
    relativeWorkspaceCwd: params.cwd.relativeWorkspacePath,
    timeoutMs: 15_000,
    runInBackground: false,
    tty: false,
    maxOutputChars: params.maxOutputChars,
    commandSummary: summary.summary,
    commandKind: summary.kind,
  };
}

async function waitForShellSessionWindow(state: ShellSessionRuntimeState, yieldTimeMs?: number) {
  await waitForMs(yieldTimeMs ?? 0);
}

function buildShellSessionEnvelope(params: {
  preparedId: string;
  state: ShellSessionRuntimeState;
  action: "start" | "poll" | "write" | "terminate";
}) {
  const drained = drainSessionOutput(params.state);
  const output = {
    sessionId: params.state.sessionId,
    action: params.action,
    state: params.state.closedAt === undefined ? "running" : params.state.exitCode === 0 ? "completed" : "failed",
    running: params.state.closedAt === undefined,
    completed: params.state.closedAt !== undefined,
    stdout: drained.stdout.text,
    stderr: drained.stderr.text,
    stdoutTruncated: drained.stdout.truncated,
    stderrTruncated: drained.stderr.truncated,
    stdoutChars: drained.stdout.originalChars,
    stderrChars: drained.stderr.originalChars,
    exitCode: params.state.exitCode,
    signal: params.state.signal,
    cwd: params.state.relativeWorkspaceCwd,
    commandSummary: params.state.commandSummary,
    commandKind: params.state.commandKind,
  };

  if ((params.state.exitCode ?? 0) !== 0 && params.action !== "terminate") {
    return createCapabilityResultEnvelope({
      executionId: params.preparedId,
      status: "failed",
      output,
      error: {
        code: "shell_session_non_zero_exit",
        message: `shell.session exited with code ${String(params.state.exitCode)}.`,
      },
      metadata: {
        capabilityKey: "shell.session",
        runtimeKind: "local-tooling",
        commandSummary: params.state.commandSummary,
        commandKind: params.state.commandKind,
      },
    });
  }

  return createCapabilityResultEnvelope({
    executionId: params.preparedId,
    status: "success",
    output,
    metadata: {
      capabilityKey: "shell.session",
      runtimeKind: "local-tooling",
      commandSummary: params.state.commandSummary,
      commandKind: params.state.commandKind,
    },
  });
}

function parseGitStatusEntries(output: string, maxEntries: number): {
  branch?: string;
  entries: GitStatusEntry[];
  truncated: boolean;
} {
  const lines = normalizeNewlines(output).split("\n").filter((line) => line.length > 0);
  const branch = lines[0]?.startsWith("## ") ? lines[0].slice(3) : undefined;
  const statusLines = branch ? lines.slice(1) : lines;
  const entries = statusLines.slice(0, maxEntries).map((line) => ({
    code: line.slice(0, 2),
    path: line.slice(3),
  }));
  return {
    branch,
    entries,
    truncated: statusLines.length > maxEntries,
  };
}

function parseGitDiffFiles(output: string): string[] {
  const files = new Set<string>();
  for (const match of normalizeNewlines(output).matchAll(/^diff --git a\/(.+?) b\/.+$/gm)) {
    if (match[1]) {
      files.add(match[1]);
    }
  }
  return [...files];
}

class RepoWriteCapabilityAdapter implements CapabilityAdapter {
  readonly id = "adapter.repo.write";
  readonly runtimeKind = "local-tooling";
  readonly #workspaceRoot: string;
  readonly #repoWriteHandler: (
    entries: NormalizedRepoWriteEntry[],
  ) => Promise<Array<Record<string, unknown>>>;
  readonly #prepared = new Map<string, PreparedRepoWriteState>();

  constructor(options: TapToolingAdapterOptions) {
    this.#workspaceRoot = path.resolve(options.workspaceRoot);
    this.#repoWriteHandler = options.repoWriteHandler ?? createDefaultRepoWriteHandler();
  }

  supports(plan: CapabilityInvocationPlan): boolean {
    if (plan.capabilityKey !== "repo.write") {
      return false;
    }

    try {
      normalizeRepoWriteEntries(plan, this.#workspaceRoot);
      return true;
    } catch {
      return false;
    }
  }

  async prepare(plan: CapabilityInvocationPlan, lease: CapabilityLease): Promise<PreparedCapabilityCall> {
    const entries = normalizeRepoWriteEntries(plan, this.#workspaceRoot);
    const prepared = createPreparedCapabilityCall({
      lease,
      plan,
      executionMode: "direct",
      preparedPayloadRef: `repo-write:${plan.planId}`,
      metadata: {
        planId: plan.planId,
        workspaceRoot: this.#workspaceRoot,
      },
    });
    this.#prepared.set(prepared.preparedId, { entries });
    return prepared;
  }

  async execute(prepared: PreparedCapabilityCall) {
    const state = this.#prepared.get(prepared.preparedId);
    if (!state) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        error: {
          code: "repo_write_prepared_state_missing",
          message: `Prepared repo.write state for ${prepared.preparedId} was not found.`,
        },
      });
    }
    this.#prepared.delete(prepared.preparedId);

    const results = await this.#repoWriteHandler(state.entries);
    return createCapabilityResultEnvelope({
      executionId: prepared.preparedId,
      status: "success",
      output: {
        writes: results,
      },
      metadata: {
        capabilityKey: "repo.write",
        runtimeKind: this.runtimeKind,
      },
    });
  }
}

class CodeEditCapabilityAdapter implements CapabilityAdapter {
  readonly id = "adapter.code.edit";
  readonly runtimeKind = "local-tooling";
  readonly #workspaceRoot: string;
  readonly #prepared = new Map<string, PreparedCodeEditState>();

  constructor(options: TapToolingAdapterOptions) {
    this.#workspaceRoot = path.resolve(options.workspaceRoot);
  }

  supports(plan: CapabilityInvocationPlan): boolean {
    if (plan.capabilityKey !== "code.edit") {
      return false;
    }

    try {
      normalizeCodeEditInput(plan, this.#workspaceRoot);
      return true;
    } catch {
      return false;
    }
  }

  async prepare(plan: CapabilityInvocationPlan, lease: CapabilityLease): Promise<PreparedCapabilityCall> {
    const input = normalizeCodeEditInput(plan, this.#workspaceRoot);
    const prepared = createPreparedCapabilityCall({
      lease,
      plan,
      executionMode: "direct",
      preparedPayloadRef: `code-edit:${plan.planId}`,
      metadata: {
        planId: plan.planId,
        workspaceRoot: this.#workspaceRoot,
      },
    });
    this.#prepared.set(prepared.preparedId, { input });
    return prepared;
  }

  async execute(prepared: PreparedCapabilityCall) {
    const state = this.#prepared.get(prepared.preparedId);
    if (!state) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        error: {
          code: "code_edit_prepared_state_missing",
          message: `Prepared code.edit state for ${prepared.preparedId} was not found.`,
        },
      });
    }
    this.#prepared.delete(prepared.preparedId);

    const existingContent = await readTextFileIfExists(state.input.absolutePath);
    const existed = existingContent !== undefined;
    const normalizedOldString = normalizeNewlines(state.input.oldString);
    const normalizedNewString = normalizeNewlines(state.input.newString);

    if (!existed) {
      if (normalizedOldString !== "") {
        return createCapabilityResultEnvelope({
          executionId: prepared.preparedId,
          status: "failed",
          error: {
            code: "code_edit_missing_file",
            message: `code.edit could not find ${state.input.relativeWorkspacePath}. Use empty old_string to create a new file.`,
          },
        });
      }
      if (state.input.createParents) {
        await mkdir(path.dirname(state.input.absolutePath), { recursive: true });
      }
      await writeFile(state.input.absolutePath, state.input.newString, "utf8");
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "success",
        output: {
          path: state.input.relativeWorkspacePath,
          created: true,
          replacedCount: 1,
          replaceAll: state.input.replaceAll,
          bytesWritten: Buffer.byteLength(state.input.newString, "utf8"),
          beforeChars: 0,
          afterChars: state.input.newString.length,
          lineDelta: countLines(state.input.newString),
        },
        metadata: {
          capabilityKey: "code.edit",
          runtimeKind: this.runtimeKind,
        },
      });
    }

    const currentContent = existingContent;
    const normalizedCurrentContent = normalizeNewlines(currentContent);
    if (normalizedOldString === "") {
      if (normalizedCurrentContent.length > 0) {
        return createCapabilityResultEnvelope({
          executionId: prepared.preparedId,
          status: "failed",
          error: {
            code: "code_edit_existing_file_requires_old_string",
            message: `code.edit requires a non-empty old_string when ${state.input.relativeWorkspacePath} already has content.`,
          },
        });
      }
      if (state.input.createParents) {
        await mkdir(path.dirname(state.input.absolutePath), { recursive: true });
      }
      const restored = restoreNewlines(normalizedNewString, currentContent);
      await writeFile(state.input.absolutePath, restored, "utf8");
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "success",
        output: {
          path: state.input.relativeWorkspacePath,
          created: false,
          replacedCount: 1,
          replaceAll: state.input.replaceAll,
          bytesWritten: Buffer.byteLength(restored, "utf8"),
          beforeChars: currentContent.length,
          afterChars: restored.length,
          lineDelta: countLines(restored) - countLines(currentContent),
        },
        metadata: {
          capabilityKey: "code.edit",
          runtimeKind: this.runtimeKind,
        },
      });
    }

    const occurrences = countOccurrences(normalizedCurrentContent, normalizedOldString);
    if (occurrences === 0) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        error: {
          code: "code_edit_old_string_not_found",
          message: `code.edit could not find old_string in ${state.input.relativeWorkspacePath}.`,
        },
      });
    }
    if (!state.input.replaceAll && occurrences !== 1) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        error: {
          code: "code_edit_ambiguous_match",
          message: `code.edit found ${occurrences} matches in ${state.input.relativeWorkspacePath}; set replace_all or allow_multiple to true to replace every exact match.`,
        },
      });
    }

    const updatedNormalizedContent = state.input.replaceAll
      ? normalizedCurrentContent.replaceAll(normalizedOldString, normalizedNewString)
      : normalizedCurrentContent.replace(normalizedOldString, normalizedNewString);
    const restored = restoreNewlines(updatedNormalizedContent, currentContent);
    await writeFile(state.input.absolutePath, restored, "utf8");

    return createCapabilityResultEnvelope({
      executionId: prepared.preparedId,
      status: "success",
      output: {
        path: state.input.relativeWorkspacePath,
        created: false,
        replacedCount: state.input.replaceAll ? occurrences : 1,
        replaceAll: state.input.replaceAll,
        bytesWritten: Buffer.byteLength(restored, "utf8"),
        beforeChars: currentContent.length,
        afterChars: restored.length,
        lineDelta: countLines(restored) - countLines(currentContent),
      },
      metadata: {
        capabilityKey: "code.edit",
        runtimeKind: this.runtimeKind,
      },
    });
  }
}

class CodePatchCapabilityAdapter implements CapabilityAdapter {
  readonly id = "adapter.code.patch";
  readonly runtimeKind = "local-tooling";
  readonly #workspaceRoot: string;
  readonly #prepared = new Map<string, PreparedCodePatchState>();

  constructor(options: TapToolingAdapterOptions) {
    this.#workspaceRoot = path.resolve(options.workspaceRoot);
  }

  supports(plan: CapabilityInvocationPlan): boolean {
    if (plan.capabilityKey !== "code.patch") {
      return false;
    }

    try {
      normalizeCodePatchInput(plan);
      return true;
    } catch {
      return false;
    }
  }

  async prepare(plan: CapabilityInvocationPlan, lease: CapabilityLease): Promise<PreparedCapabilityCall> {
    const input = normalizeCodePatchInput(plan);
    const prepared = createPreparedCapabilityCall({
      lease,
      plan,
      executionMode: "direct",
      preparedPayloadRef: `code-patch:${plan.planId}`,
      metadata: {
        planId: plan.planId,
        workspaceRoot: this.#workspaceRoot,
      },
    });
    this.#prepared.set(prepared.preparedId, {
      input,
      scope: getGrantedScope(plan),
    });
    return prepared;
  }

  async execute(prepared: PreparedCapabilityCall) {
    const state = this.#prepared.get(prepared.preparedId);
    if (!state) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        error: {
          code: "code_patch_prepared_state_missing",
          message: `Prepared code.patch state for ${prepared.preparedId} was not found.`,
        },
      });
    }
    this.#prepared.delete(prepared.preparedId);

    const scope = state.scope;
    const changes: Array<Record<string, unknown>> = [];

    for (const operation of state.input.operations) {
      if (path.isAbsolute(operation.path)) {
        return createCapabilityResultEnvelope({
          executionId: prepared.preparedId,
          status: "failed",
          error: {
            code: "code_patch_absolute_path_rejected",
            message: `code.patch only accepts relative paths, got ${operation.path}.`,
          },
        });
      }

      if (operation.type === "add") {
        const resolved = resolvePathWithinWorkspace({
          workspaceRoot: this.#workspaceRoot,
          candidatePath: operation.path,
          scope,
          operationCandidates: ["write", "mkdir", "code.patch"],
          label: "code.patch add path",
        });
        const exists = await readTextFileIfExists(resolved.absolutePath);
        if (exists !== undefined) {
          return createCapabilityResultEnvelope({
            executionId: prepared.preparedId,
            status: "failed",
            error: {
              code: "code_patch_add_target_exists",
              message: `code.patch add target ${resolved.relativeWorkspacePath} already exists.`,
            },
          });
        }
        await mkdir(path.dirname(resolved.absolutePath), { recursive: true });
        const content = operation.lines.join("\n");
        await writeFile(resolved.absolutePath, content, "utf8");
        changes.push({
          action: "add",
          path: resolved.relativeWorkspacePath,
          bytesWritten: Buffer.byteLength(content, "utf8"),
          addedLines: operation.lines.length,
          removedLines: 0,
        });
        continue;
      }

      if (operation.type === "delete") {
        const resolved = resolvePathWithinWorkspace({
          workspaceRoot: this.#workspaceRoot,
          candidatePath: operation.path,
          scope,
          operationCandidates: ["delete", "code.patch"],
          label: "code.patch delete path",
        });
        const existing = await readTextFileIfExists(resolved.absolutePath);
        if (existing === undefined) {
          return createCapabilityResultEnvelope({
            executionId: prepared.preparedId,
            status: "failed",
            error: {
              code: "code_patch_delete_target_missing",
              message: `code.patch delete target ${resolved.relativeWorkspacePath} does not exist.`,
            },
          });
        }
        await rm(resolved.absolutePath, { force: false });
        changes.push({
          action: "delete",
          path: resolved.relativeWorkspacePath,
          bytesRemoved: Buffer.byteLength(existing, "utf8"),
          removedLines: countLines(existing),
          addedLines: 0,
        });
        continue;
      }

      const resolvedSource = resolvePathWithinWorkspace({
        workspaceRoot: this.#workspaceRoot,
        candidatePath: operation.path,
        scope,
        operationCandidates: ["read", "write", "delete", "mkdir", "code.patch"],
        label: "code.patch update path",
      });
      const sourceContent = await readTextFileIfExists(resolvedSource.absolutePath);
      if (sourceContent === undefined) {
        return createCapabilityResultEnvelope({
          executionId: prepared.preparedId,
          status: "failed",
          error: {
            code: "code_patch_update_target_missing",
            message: `code.patch update target ${resolvedSource.relativeWorkspacePath} does not exist.`,
          },
        });
      }

      let updatedNormalized = normalizeNewlines(sourceContent);
      let searchStart = 0;
      let addedLines = 0;
      let removedLines = 0;
      for (const hunk of operation.hunks) {
        const oldChunk = hunk.lines
          .filter((line) => line.kind !== "add")
          .map((line) => line.text)
          .join("\n");
        const newChunk = hunk.lines
          .filter((line) => line.kind !== "remove")
          .map((line) => line.text)
          .join("\n");
        const locatedAt = updatedNormalized.indexOf(oldChunk, searchStart);
        if (locatedAt < 0) {
          return createCapabilityResultEnvelope({
            executionId: prepared.preparedId,
            status: "failed",
            error: {
              code: "code_patch_hunk_not_found",
              message: `code.patch could not match a hunk for ${resolvedSource.relativeWorkspacePath}${hunk.header ? ` (${hunk.header})` : ""}.`,
            },
          });
        }
        updatedNormalized = `${updatedNormalized.slice(0, locatedAt)}${newChunk}${updatedNormalized.slice(locatedAt + oldChunk.length)}`;
        searchStart = locatedAt + newChunk.length;
        const counts = countPatchLineChanges(hunk.lines);
        addedLines += counts.addedLines;
        removedLines += counts.removedLines;
      }

      const targetRelativePath = operation.moveTo ?? operation.path;
      if (path.isAbsolute(targetRelativePath)) {
        return createCapabilityResultEnvelope({
          executionId: prepared.preparedId,
          status: "failed",
          error: {
            code: "code_patch_absolute_move_target_rejected",
            message: `code.patch move target must stay relative, got ${targetRelativePath}.`,
          },
        });
      }
      const resolvedTarget = resolvePathWithinWorkspace({
        workspaceRoot: this.#workspaceRoot,
        candidatePath: targetRelativePath,
        scope,
        operationCandidates: ["write", "mkdir", "delete", "code.patch"],
        label: "code.patch target path",
      });
      const restoredContent = restoreNewlines(updatedNormalized, sourceContent);

      await mkdir(path.dirname(resolvedTarget.absolutePath), { recursive: true });
      if (resolvedTarget.absolutePath === resolvedSource.absolutePath) {
        await writeFile(resolvedTarget.absolutePath, restoredContent, "utf8");
      } else {
        await writeFile(resolvedTarget.absolutePath, restoredContent, "utf8");
        await rm(resolvedSource.absolutePath, { force: false });
      }

      changes.push({
        action: operation.moveTo ? "move_update" : "update",
        path: resolvedSource.relativeWorkspacePath,
        targetPath: resolvedTarget.relativeWorkspacePath,
        bytesWritten: Buffer.byteLength(restoredContent, "utf8"),
        addedLines,
        removedLines,
        hunkCount: operation.hunks.length,
      });
    }

    return createCapabilityResultEnvelope({
      executionId: prepared.preparedId,
      status: "success",
      output: {
        operationCount: state.input.operations.length,
        changes,
        patchChars: state.input.patch.length,
      },
      metadata: {
        capabilityKey: "code.patch",
        runtimeKind: this.runtimeKind,
      },
    });
  }
}

class ShellSessionCapabilityAdapter implements CapabilityAdapter {
  readonly id = "adapter.shell.session";
  readonly runtimeKind = "local-tooling";
  readonly #workspaceRoot: string;
  readonly #defaultTimeoutMs: number;
  readonly #prepared = new Map<string, PreparedShellSessionState>();

  constructor(options: TapToolingAdapterOptions) {
    this.#workspaceRoot = path.resolve(options.workspaceRoot);
    this.#defaultTimeoutMs = options.defaultShellTimeoutMs ?? 15_000;
  }

  supports(plan: CapabilityInvocationPlan): boolean {
    if (plan.capabilityKey !== "shell.session") {
      return false;
    }
    try {
      normalizeShellSessionInput({
        plan,
        workspaceRoot: this.#workspaceRoot,
        defaultTimeoutMs: this.#defaultTimeoutMs,
      });
      return true;
    } catch {
      return false;
    }
  }

  async prepare(plan: CapabilityInvocationPlan, lease: CapabilityLease): Promise<PreparedCapabilityCall> {
    const input = normalizeShellSessionInput({
      plan,
      workspaceRoot: this.#workspaceRoot,
      defaultTimeoutMs: this.#defaultTimeoutMs,
    });
    const prepared = createPreparedCapabilityCall({
      lease,
      plan,
      executionMode: "streaming",
      preparedPayloadRef: `shell-session:${plan.planId}`,
      metadata: {
        planId: plan.planId,
        workspaceRoot: this.#workspaceRoot,
      },
    });
    this.#prepared.set(prepared.preparedId, { input });
    return prepared;
  }

  async execute(prepared: PreparedCapabilityCall) {
    const preparedState = this.#prepared.get(prepared.preparedId);
    if (!preparedState) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        error: {
          code: "shell_session_prepared_state_missing",
          message: `Prepared shell.session state for ${prepared.preparedId} was not found.`,
        },
      });
    }
    this.#prepared.delete(prepared.preparedId);

    const input = preparedState.input;
    if (input.action === "start") {
      const sessionId = createShellSessionId();
      const child = spawn(input.command, input.args, {
        cwd: input.cwd,
        env: input.env ? { ...process.env, ...input.env } : process.env,
        stdio: ["pipe", "pipe", "pipe"],
      });
      const state: ShellSessionRuntimeState = {
        sessionId,
        child,
        stdoutBuffer: "",
        stderrBuffer: "",
        startedAt: Date.now(),
        cwd: input.cwd,
        relativeWorkspaceCwd: input.relativeWorkspaceCwd,
        commandSummary: input.commandSummary,
        commandKind: input.commandKind,
        maxOutputChars: input.maxOutputChars,
      };
      child.stdout?.on("data", (chunk) => {
        state.stdoutBuffer += chunk.toString();
      });
      child.stderr?.on("data", (chunk) => {
        state.stderrBuffer += chunk.toString();
      });
      child.on("close", (exitCode, signal) => {
        state.closedAt = Date.now();
        state.exitCode = exitCode;
        state.signal = signal;
      });
      child.on("error", (error) => {
        state.stderrBuffer += `\n${error.message}`;
        state.closedAt = Date.now();
        state.exitCode = 1;
        state.signal = null;
      });
      SHELL_SESSION_RUNTIME.set(sessionId, state);
      await waitForShellSessionWindow(state, input.yieldTimeMs);
      return buildShellSessionEnvelope({
        preparedId: prepared.preparedId,
        state,
        action: "start",
      });
    }

    const state = SHELL_SESSION_RUNTIME.get(input.sessionId ?? "");
    if (!state) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        error: {
          code: "shell_session_not_found",
          message: `shell.session could not find session ${input.sessionId}.`,
        },
      });
    }

    if (input.action === "write") {
      if (state.closedAt !== undefined || !state.child.stdin?.writable) {
        return createCapabilityResultEnvelope({
          executionId: prepared.preparedId,
          status: "failed",
          error: {
            code: "shell_session_write_after_close",
            message: `shell.session ${state.sessionId} is no longer writable.`,
          },
        });
      }
      state.child.stdin.write(input.chars ?? "");
      await waitForShellSessionWindow(state, input.yieldTimeMs);
      return buildShellSessionEnvelope({
        preparedId: prepared.preparedId,
        state,
        action: "write",
      });
    }

    if (input.action === "terminate") {
      if (state.closedAt === undefined) {
        state.child.kill("SIGTERM");
        await waitForShellSessionWindow(state, input.yieldTimeMs);
        if (state.closedAt === undefined) {
          state.child.kill("SIGKILL");
          await waitForShellSessionWindow(state, 50);
        }
      }
      SHELL_SESSION_RUNTIME.delete(state.sessionId);
      return buildShellSessionEnvelope({
        preparedId: prepared.preparedId,
        state,
        action: "terminate",
      });
    }

    await waitForShellSessionWindow(state, input.yieldTimeMs);
    return buildShellSessionEnvelope({
      preparedId: prepared.preparedId,
      state,
      action: "poll",
    });
  }
}

class GitStatusCapabilityAdapter implements CapabilityAdapter {
  readonly id = "adapter.git.status";
  readonly runtimeKind = "local-tooling";
  readonly #workspaceRoot: string;
  readonly #commandRunner: (
    input: NormalizedCommandInput,
  ) => Promise<CommandExecutionResult>;
  readonly #prepared = new Map<string, PreparedGitStatusState>();

  constructor(options: TapToolingAdapterOptions) {
    this.#workspaceRoot = path.resolve(options.workspaceRoot);
    this.#commandRunner = options.commandRunner ?? createDefaultCommandRunner();
  }

  supports(plan: CapabilityInvocationPlan): boolean {
    if (plan.capabilityKey !== "git.status") {
      return false;
    }
    try {
      normalizeGitStatusInput(plan, this.#workspaceRoot);
      return true;
    } catch {
      return false;
    }
  }

  async prepare(plan: CapabilityInvocationPlan, lease: CapabilityLease): Promise<PreparedCapabilityCall> {
    const input = normalizeGitStatusInput(plan, this.#workspaceRoot);
    const prepared = createPreparedCapabilityCall({
      lease,
      plan,
      executionMode: "direct",
      preparedPayloadRef: `git-status:${plan.planId}`,
      metadata: {
        planId: plan.planId,
        workspaceRoot: this.#workspaceRoot,
      },
    });
    this.#prepared.set(prepared.preparedId, input);
    return prepared;
  }

  async execute(prepared: PreparedCapabilityCall) {
    const state = this.#prepared.get(prepared.preparedId);
    if (!state) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        error: {
          code: "git_status_prepared_state_missing",
          message: `Prepared git.status state for ${prepared.preparedId} was not found.`,
        },
      });
    }
    this.#prepared.delete(prepared.preparedId);

    const result = await runSimpleCommand(
      this.#commandRunner,
      createGitCommandInput({
        cwd: state.cwd,
        capabilityKey: "git.status",
        args: [
          "-c",
          "color.ui=never",
          "status",
          "--short",
          "--branch",
          state.includeIgnored ? "--ignored=traditional" : "--untracked-files=normal",
        ],
        maxOutputChars: state.maxOutputChars,
      }),
    );
    const stdout = trimCommandOutput(result.stdout, state.maxOutputChars);
    const stderr = trimCommandOutput(result.stderr, state.maxOutputChars);
    if (result.timedOut) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "timeout",
        output: { stdout: stdout.text, stderr: stderr.text },
        error: {
          code: "git_status_timeout",
          message: "git.status timed out.",
        },
      });
    }
    if (result.exitCode !== 0) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        output: { stdout: stdout.text, stderr: stderr.text },
        error: {
          code: "git_status_non_zero_exit",
          message: `git.status exited with code ${String(result.exitCode)}.`,
        },
      });
    }

    const lines = result.stdout.split(/\r?\n/).filter(Boolean);
    const branch = lines[0]?.startsWith("## ") ? lines[0].slice(3) : undefined;
    const entries = lines
      .slice(branch ? 1 : 0, (branch ? 1 : 0) + state.maxEntries)
      .map((line) => ({
        code: line.slice(0, 2),
        path: line.slice(3),
      } satisfies GitStatusEntry));

    return createCapabilityResultEnvelope({
      executionId: prepared.preparedId,
      status: "success",
      output: {
        cwd: state.cwd.relativeWorkspacePath,
        branch,
        clean: entries.length === 0,
        entries,
        entryCount: entries.length,
        rawStatus: stdout.text,
        truncated: stdout.truncated,
      },
      metadata: {
        capabilityKey: "git.status",
        runtimeKind: this.runtimeKind,
      },
    });
  }
}

class GitDiffCapabilityAdapter implements CapabilityAdapter {
  readonly id = "adapter.git.diff";
  readonly runtimeKind = "local-tooling";
  readonly #workspaceRoot: string;
  readonly #commandRunner: (
    input: NormalizedCommandInput,
  ) => Promise<CommandExecutionResult>;
  readonly #prepared = new Map<string, PreparedGitDiffState>();

  constructor(options: TapToolingAdapterOptions) {
    this.#workspaceRoot = path.resolve(options.workspaceRoot);
    this.#commandRunner = options.commandRunner ?? createDefaultCommandRunner();
  }

  supports(plan: CapabilityInvocationPlan): boolean {
    if (plan.capabilityKey !== "git.diff") {
      return false;
    }
    try {
      normalizeGitDiffInput(plan, this.#workspaceRoot);
      return true;
    } catch {
      return false;
    }
  }

  async prepare(plan: CapabilityInvocationPlan, lease: CapabilityLease): Promise<PreparedCapabilityCall> {
    const input = normalizeGitDiffInput(plan, this.#workspaceRoot);
    const prepared = createPreparedCapabilityCall({
      lease,
      plan,
      executionMode: "direct",
      preparedPayloadRef: `git-diff:${plan.planId}`,
      metadata: {
        planId: plan.planId,
        workspaceRoot: this.#workspaceRoot,
      },
    });
    this.#prepared.set(prepared.preparedId, input);
    return prepared;
  }

  async execute(prepared: PreparedCapabilityCall) {
    const state = this.#prepared.get(prepared.preparedId);
    if (!state) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        error: {
          code: "git_diff_prepared_state_missing",
          message: `Prepared git.diff state for ${prepared.preparedId} was not found.`,
        },
      });
    }
    this.#prepared.delete(prepared.preparedId);

    const args = ["-c", "color.ui=never", "diff", "--no-ext-diff", "--no-color"];
    if (state.staged) {
      args.push("--staged");
    }
    if (state.base) {
      args.push(state.base);
    }
    if (state.paths?.length) {
      args.push("--", ...state.paths);
    }

    const result = await runSimpleCommand(
      this.#commandRunner,
      createGitCommandInput({
        cwd: state.cwd,
        capabilityKey: "git.diff",
        args,
        maxOutputChars: state.maxOutputChars,
      }),
    );
    const stdout = trimCommandOutput(result.stdout, state.maxOutputChars);
    const stderr = trimCommandOutput(result.stderr, state.maxOutputChars);
    if (result.timedOut) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "timeout",
        output: { stdout: stdout.text, stderr: stderr.text },
        error: {
          code: "git_diff_timeout",
          message: "git.diff timed out.",
        },
      });
    }
    if (result.exitCode !== 0) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        output: { stdout: stdout.text, stderr: stderr.text },
        error: {
          code: "git_diff_non_zero_exit",
          message: `git.diff exited with code ${String(result.exitCode)}.`,
        },
      });
    }

    return createCapabilityResultEnvelope({
      executionId: prepared.preparedId,
      status: "success",
      output: {
        cwd: state.cwd.relativeWorkspacePath,
        staged: state.staged,
        base: state.base,
        paths: state.paths,
        diff: stdout.text,
        diffChars: stdout.originalChars,
        truncated: stdout.truncated,
      },
      metadata: {
        capabilityKey: "git.diff",
        runtimeKind: this.runtimeKind,
      },
    });
  }
}

class GitCommitCapabilityAdapter implements CapabilityAdapter {
  readonly id = "adapter.git.commit";
  readonly runtimeKind = "local-tooling";
  readonly #workspaceRoot: string;
  readonly #commandRunner: (
    input: NormalizedCommandInput,
  ) => Promise<CommandExecutionResult>;
  readonly #prepared = new Map<string, PreparedGitCommitState>();

  constructor(options: TapToolingAdapterOptions) {
    this.#workspaceRoot = path.resolve(options.workspaceRoot);
    this.#commandRunner = options.commandRunner ?? createDefaultCommandRunner();
  }

  supports(plan: CapabilityInvocationPlan): boolean {
    if (plan.capabilityKey !== "git.commit") {
      return false;
    }
    try {
      normalizeGitCommitInput(plan, this.#workspaceRoot);
      return true;
    } catch {
      return false;
    }
  }

  async prepare(plan: CapabilityInvocationPlan, lease: CapabilityLease): Promise<PreparedCapabilityCall> {
    const input = normalizeGitCommitInput(plan, this.#workspaceRoot);
    const prepared = createPreparedCapabilityCall({
      lease,
      plan,
      executionMode: "direct",
      preparedPayloadRef: `git-commit:${plan.planId}`,
      metadata: {
        planId: plan.planId,
        workspaceRoot: this.#workspaceRoot,
      },
    });
    this.#prepared.set(prepared.preparedId, input);
    return prepared;
  }

  async execute(prepared: PreparedCapabilityCall) {
    const state = this.#prepared.get(prepared.preparedId);
    if (!state) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        error: {
          code: "git_commit_prepared_state_missing",
          message: `Prepared git.commit state for ${prepared.preparedId} was not found.`,
        },
      });
    }
    this.#prepared.delete(prepared.preparedId);

    const addArgs = ["add"];
    if (state.stageAll) {
      addArgs.push("--all");
    } else if (state.paths?.length) {
      addArgs.push("--", ...state.paths);
    }
    const addResult = await runSimpleCommand(
      this.#commandRunner,
      createGitCommandInput({
        cwd: state.cwd,
        capabilityKey: "git.commit",
        args: addArgs,
        maxOutputChars: state.maxOutputChars,
      }),
    );
    if (addResult.timedOut) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "timeout",
        output: { stdout: addResult.stdout, stderr: addResult.stderr },
        error: {
          code: "git_commit_stage_timeout",
          message: "git.commit timed out while staging files.",
        },
      });
    }
    if (addResult.exitCode !== 0) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        output: { stdout: addResult.stdout, stderr: addResult.stderr },
        error: {
          code: "git_commit_stage_failed",
          message: `git.commit could not stage files (exit ${String(addResult.exitCode)}).`,
        },
      });
    }

    const stagedNameOnly = await runSimpleCommand(
      this.#commandRunner,
      createGitCommandInput({
        cwd: state.cwd,
        capabilityKey: "git.commit",
        args: ["diff", "--cached", "--name-only"],
        maxOutputChars: state.maxOutputChars,
      }),
    );
    const stagedFiles = normalizeNewlines(stagedNameOnly.stdout)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (stagedFiles.length === 0) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "blocked",
        output: {
          cwd: state.cwd.relativeWorkspacePath,
          stagedFiles: [],
          message: state.message,
        },
        error: {
          code: "git_commit_no_changes",
          message: "git.commit found no staged changes to commit.",
        },
      });
    }
    const secretLike = stagedFiles.find((candidate) =>
      SECRET_LIKE_GIT_PATH_PATTERNS.some((pattern) => pattern.test(candidate))
    );
    if (secretLike) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "blocked",
        output: {
          cwd: state.cwd.relativeWorkspacePath,
          stagedFiles,
          blockedPath: secretLike,
        },
        error: {
          code: "git_commit_secret_like_path_blocked",
          message: `git.commit blocked secret-like path ${secretLike}.`,
        },
      });
    }

    const commitArgs = [];
    if (state.authorName) {
      commitArgs.push("-c", `user.name=${state.authorName}`);
    }
    if (state.authorEmail) {
      commitArgs.push("-c", `user.email=${state.authorEmail}`);
    }
    commitArgs.push("commit", "-m", state.message);
    const commitResult = await runSimpleCommand(
      this.#commandRunner,
      createGitCommandInput({
        cwd: state.cwd,
        capabilityKey: "git.commit",
        args: commitArgs,
        maxOutputChars: state.maxOutputChars,
      }),
    );
    const stdout = trimCommandOutput(commitResult.stdout, state.maxOutputChars);
    const stderr = trimCommandOutput(commitResult.stderr, state.maxOutputChars);
    if (commitResult.timedOut) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "timeout",
        output: { stdout: stdout.text, stderr: stderr.text, stagedFiles },
        error: {
          code: "git_commit_timeout",
          message: "git.commit timed out during commit creation.",
        },
      });
    }
    if (commitResult.exitCode !== 0) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        output: { stdout: stdout.text, stderr: stderr.text, stagedFiles },
        error: {
          code: "git_commit_non_zero_exit",
          message: `git.commit exited with code ${String(commitResult.exitCode)}.`,
        },
      });
    }

    const commitHashResult = await runSimpleCommand(
      this.#commandRunner,
      createGitCommandInput({
        cwd: state.cwd,
        capabilityKey: "git.commit",
        args: ["rev-parse", "HEAD"],
        maxOutputChars: 256,
      }),
    );
    const commitHash = normalizeNewlines(commitHashResult.stdout).trim() || undefined;

    return createCapabilityResultEnvelope({
      executionId: prepared.preparedId,
      status: "success",
      output: {
        cwd: state.cwd.relativeWorkspacePath,
        message: state.message,
        stagedFiles,
        committedFiles: stagedFiles,
        commitHash,
        stdout: stdout.text,
        stderr: stderr.text,
        truncated: stdout.truncated || stderr.truncated,
      },
      metadata: {
        capabilityKey: "git.commit",
        runtimeKind: this.runtimeKind,
      },
    });
  }
}

class GitPushCapabilityAdapter implements CapabilityAdapter {
  readonly id = "adapter.git.push";
  readonly runtimeKind = "local-tooling";
  readonly #workspaceRoot: string;
  readonly #commandRunner: (
    input: NormalizedCommandInput,
  ) => Promise<CommandExecutionResult>;
  readonly #prepared = new Map<string, PreparedGitPushState>();

  constructor(options: TapToolingAdapterOptions) {
    this.#workspaceRoot = path.resolve(options.workspaceRoot);
    this.#commandRunner = options.commandRunner ?? createDefaultCommandRunner();
  }

  supports(plan: CapabilityInvocationPlan): boolean {
    if (plan.capabilityKey !== "git.push") {
      return false;
    }
    try {
      normalizeGitPushInput(plan, this.#workspaceRoot);
      return true;
    } catch {
      return false;
    }
  }

  async prepare(plan: CapabilityInvocationPlan, lease: CapabilityLease): Promise<PreparedCapabilityCall> {
    const input = normalizeGitPushInput(plan, this.#workspaceRoot);
    const prepared = createPreparedCapabilityCall({
      lease,
      plan,
      executionMode: "direct",
      preparedPayloadRef: `git-push:${plan.planId}`,
      metadata: {
        planId: plan.planId,
        workspaceRoot: this.#workspaceRoot,
      },
    });
    this.#prepared.set(prepared.preparedId, input);
    return prepared;
  }

  async execute(prepared: PreparedCapabilityCall) {
    const state = this.#prepared.get(prepared.preparedId);
    if (!state) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        error: {
          code: "git_push_prepared_state_missing",
          message: `Prepared git.push state for ${prepared.preparedId} was not found.`,
        },
      });
    }
    this.#prepared.delete(prepared.preparedId);

    let branch = state.branch;
    if (!branch) {
      const branchResult = await runSimpleCommand(
        this.#commandRunner,
        createGitCommandInput({
          cwd: state.cwd,
          capabilityKey: "git.push",
          args: ["branch", "--show-current"],
          maxOutputChars: 256,
        }),
      );
      branch = normalizeNewlines(branchResult.stdout).trim() || undefined;
    }
    if (!branch) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        output: {
          cwd: state.cwd.relativeWorkspacePath,
          remote: state.remote,
        },
        error: {
          code: "git_push_missing_branch",
          message: "git.push could not determine the current branch.",
        },
      });
    }

    const args = ["push"];
    if (state.setUpstream) {
      args.push("--set-upstream");
    }
    args.push(state.remote, branch);
    const result = await runSimpleCommand(
      this.#commandRunner,
      createGitCommandInput({
        cwd: state.cwd,
        capabilityKey: "git.push",
        args,
        maxOutputChars: state.maxOutputChars,
      }),
    );
    const stdout = trimCommandOutput(result.stdout, state.maxOutputChars);
    const stderr = trimCommandOutput(result.stderr, state.maxOutputChars);
    if (result.timedOut) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "timeout",
        output: { stdout: stdout.text, stderr: stderr.text, remote: state.remote, branch },
        error: {
          code: "git_push_timeout",
          message: "git.push timed out.",
        },
      });
    }
    if (result.exitCode !== 0) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        output: { stdout: stdout.text, stderr: stderr.text, remote: state.remote, branch },
        error: {
          code: "git_push_non_zero_exit",
          message: `git.push exited with code ${String(result.exitCode)}.`,
        },
      });
    }

    return createCapabilityResultEnvelope({
      executionId: prepared.preparedId,
      status: "success",
      output: {
        cwd: state.cwd.relativeWorkspacePath,
        remote: state.remote,
        branch,
        setUpstream: state.setUpstream,
        stdout: stdout.text,
        stderr: stderr.text,
        truncated: stdout.truncated || stderr.truncated,
      },
      metadata: {
        capabilityKey: "git.push",
        runtimeKind: this.runtimeKind,
      },
    });
  }
}

class WriteTodosCapabilityAdapter implements CapabilityAdapter {
  readonly id = "adapter.write_todos";
  readonly runtimeKind = "local-tooling";
  readonly #prepared = new Map<string, PreparedWriteTodosState>();

  supports(plan: CapabilityInvocationPlan): boolean {
    if (plan.capabilityKey !== "write_todos") {
      return false;
    }
    try {
      normalizeWriteTodosInput(plan);
      return true;
    } catch {
      return false;
    }
  }

  async prepare(plan: CapabilityInvocationPlan, lease: CapabilityLease): Promise<PreparedCapabilityCall> {
    const normalized = normalizeWriteTodosInput(plan);
    const prepared = createPreparedCapabilityCall({
      lease,
      plan,
      executionMode: "direct",
      preparedPayloadRef: `write-todos:${plan.planId}`,
      metadata: {
        planId: plan.planId,
      },
    });
    this.#prepared.set(prepared.preparedId, {
      sessionId: plan.sessionId,
      todos: normalized.todos,
    });
    return prepared;
  }

  async execute(prepared: PreparedCapabilityCall) {
    const state = this.#prepared.get(prepared.preparedId);
    if (!state) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        error: {
          code: "write_todos_prepared_state_missing",
          message: `Prepared write_todos state for ${prepared.preparedId} was not found.`,
        },
      });
    }
    this.#prepared.delete(prepared.preparedId);

    const oldTodos = WRITE_TODOS_RUNTIME.get(state.sessionId) ?? [];
    WRITE_TODOS_RUNTIME.set(state.sessionId, state.todos);
    return createCapabilityResultEnvelope({
      executionId: prepared.preparedId,
      status: "success",
      output: {
        oldTodos,
        newTodos: state.todos,
        todos: state.todos,
        count: state.todos.length,
      },
      metadata: {
        capabilityKey: "write_todos",
        runtimeKind: this.runtimeKind,
      },
    });
  }
}

class SkillDocGenerateCapabilityAdapter implements CapabilityAdapter {
  readonly id = "adapter.skill.doc.generate";
  readonly runtimeKind = "local-tooling";
  readonly #workspaceRoot: string;
  readonly #repoWriteHandler: (
    entries: NormalizedRepoWriteEntry[],
  ) => Promise<Array<Record<string, unknown>>>;
  readonly #prepared = new Map<string, PreparedSkillDocState>();

  constructor(options: TapToolingAdapterOptions) {
    this.#workspaceRoot = path.resolve(options.workspaceRoot);
    this.#repoWriteHandler = options.repoWriteHandler ?? createDefaultRepoWriteHandler();
  }

  supports(plan: CapabilityInvocationPlan): boolean {
    if (plan.capabilityKey !== "skill.doc.generate") {
      return false;
    }
    try {
      normalizeSkillDocGenerateInput(plan, this.#workspaceRoot);
      return true;
    } catch {
      return false;
    }
  }

  async prepare(plan: CapabilityInvocationPlan, lease: CapabilityLease): Promise<PreparedCapabilityCall> {
    const input = normalizeSkillDocGenerateInput(plan, this.#workspaceRoot);
    const prepared = createPreparedCapabilityCall({
      lease,
      plan,
      executionMode: "direct",
      preparedPayloadRef: `skill-doc-generate:${plan.planId}`,
      metadata: {
        planId: plan.planId,
        workspaceRoot: this.#workspaceRoot,
      },
    });
    this.#prepared.set(prepared.preparedId, { input });
    return prepared;
  }

  async execute(prepared: PreparedCapabilityCall) {
    const state = this.#prepared.get(prepared.preparedId);
    if (!state) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        error: {
          code: "skill_doc_generate_prepared_state_missing",
          message: `Prepared skill.doc.generate state for ${prepared.preparedId} was not found.`,
        },
      });
    }
    this.#prepared.delete(prepared.preparedId);

    const results = await this.#repoWriteHandler([state.input.entry]);
    return createCapabilityResultEnvelope({
      executionId: prepared.preparedId,
      status: "success",
      output: {
        documents: results,
        format: state.input.format,
        title: state.input.title,
        sectionCount: state.input.sectionCount,
      },
      metadata: {
        capabilityKey: "skill.doc.generate",
        runtimeKind: this.runtimeKind,
      },
    });
  }
}

class RestrictedShellCapabilityAdapter implements CapabilityAdapter {
  readonly id = "adapter.shell.restricted";
  readonly runtimeKind = "local-tooling";
  readonly #workspaceRoot: string;
  readonly #commandRunner: (
    input: NormalizedCommandInput,
  ) => Promise<CommandExecutionResult>;
  readonly #defaultTimeoutMs: number;
  readonly #prepared = new Map<string, PreparedCommandState>();

  constructor(options: TapToolingAdapterOptions) {
    this.#workspaceRoot = path.resolve(options.workspaceRoot);
    this.#commandRunner = options.commandRunner ?? createDefaultCommandRunner();
    this.#defaultTimeoutMs = options.defaultShellTimeoutMs ?? 15_000;
  }

  supports(plan: CapabilityInvocationPlan): boolean {
    if (plan.capabilityKey !== "shell.restricted") {
      return false;
    }
    try {
      normalizeCommandInput({
        plan,
        workspaceRoot: this.#workspaceRoot,
        defaultTimeoutMs: this.#defaultTimeoutMs,
        capabilityKey: "shell.restricted",
        operationCandidates: ["exec", "shell.restricted"],
      });
      return true;
    } catch {
      return false;
    }
  }

  async prepare(plan: CapabilityInvocationPlan, lease: CapabilityLease): Promise<PreparedCapabilityCall> {
    const input = normalizeCommandInput({
      plan,
      workspaceRoot: this.#workspaceRoot,
      defaultTimeoutMs: this.#defaultTimeoutMs,
      capabilityKey: "shell.restricted",
      operationCandidates: ["exec", "shell.restricted"],
    });
    const prepared = createPreparedCapabilityCall({
      lease,
      plan,
      executionMode: "direct",
      preparedPayloadRef: `shell-restricted:${plan.planId}`,
      metadata: {
        planId: plan.planId,
        workspaceRoot: this.#workspaceRoot,
      },
    });
    this.#prepared.set(prepared.preparedId, { input });
    return prepared;
  }

  async execute(prepared: PreparedCapabilityCall) {
    const state = this.#prepared.get(prepared.preparedId);
    if (!state) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        error: {
          code: "shell_restricted_prepared_state_missing",
          message: `Prepared shell.restricted state for ${prepared.preparedId} was not found.`,
        },
      });
    }
    this.#prepared.delete(prepared.preparedId);

    const result = await this.#commandRunner(state.input);
    const stdout = trimCommandOutput(result.stdout, state.input.maxOutputChars);
    const stderr = trimCommandOutput(result.stderr, state.input.maxOutputChars);
    if (result.timedOut) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "timeout",
        output: {
          stdout: stdout.text,
          stderr: stderr.text,
          stdoutTruncated: stdout.truncated,
          stderrTruncated: stderr.truncated,
        },
        error: {
          code: "shell_restricted_timeout",
          message: `shell.restricted timed out after ${state.input.timeoutMs}ms.`,
        },
        metadata: {
          capabilityKey: "shell.restricted",
          runtimeKind: this.runtimeKind,
          commandSummary: state.input.commandSummary,
          commandKind: state.input.commandKind,
          backgroundRequested: state.input.runInBackground,
          backgroundApplied: false,
          ttyRequested: state.input.tty,
          ttyApplied: false,
        },
      });
    }

    if (result.exitCode !== 0) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        output: {
          stdout: stdout.text,
          stderr: stderr.text,
          stdoutTruncated: stdout.truncated,
          stderrTruncated: stderr.truncated,
          exitCode: result.exitCode,
          signal: result.signal,
        },
        error: {
          code: "shell_restricted_non_zero_exit",
          message: `shell.restricted exited with code ${String(result.exitCode)}.`,
        },
        metadata: {
          capabilityKey: "shell.restricted",
          runtimeKind: this.runtimeKind,
          commandSummary: state.input.commandSummary,
          commandKind: state.input.commandKind,
          backgroundRequested: state.input.runInBackground,
          backgroundApplied: false,
          ttyRequested: state.input.tty,
          ttyApplied: false,
        },
      });
    }

    return createCapabilityResultEnvelope({
      executionId: prepared.preparedId,
      status: "success",
      output: {
        stdout: stdout.text,
        stderr: stderr.text,
        stdoutTruncated: stdout.truncated,
        stderrTruncated: stderr.truncated,
        stdoutChars: stdout.originalChars,
        stderrChars: stderr.originalChars,
        exitCode: result.exitCode,
        cwd: state.input.relativeWorkspaceCwd,
        commandSummary: state.input.commandSummary,
        commandKind: state.input.commandKind,
        backgroundRequested: state.input.runInBackground,
        backgroundApplied: false,
        ttyRequested: state.input.tty,
        ttyApplied: false,
      },
      metadata: {
        capabilityKey: "shell.restricted",
        runtimeKind: this.runtimeKind,
        commandSummary: state.input.commandSummary,
        commandKind: state.input.commandKind,
        backgroundRequested: state.input.runInBackground,
        backgroundApplied: false,
        ttyRequested: state.input.tty,
        ttyApplied: false,
      },
    });
  }
}

class TestRunCapabilityAdapter implements CapabilityAdapter {
  readonly id = "adapter.test.run";
  readonly runtimeKind = "local-tooling";
  readonly #workspaceRoot: string;
  readonly #commandRunner: (
    input: NormalizedCommandInput,
  ) => Promise<CommandExecutionResult>;
  readonly #defaultTimeoutMs: number;
  readonly #prepared = new Map<string, PreparedCommandState>();

  constructor(options: TapToolingAdapterOptions) {
    this.#workspaceRoot = path.resolve(options.workspaceRoot);
    this.#commandRunner = options.commandRunner ?? createDefaultCommandRunner();
    this.#defaultTimeoutMs = options.defaultTestTimeoutMs ?? 30_000;
  }

  supports(plan: CapabilityInvocationPlan): boolean {
    if (plan.capabilityKey !== "test.run") {
      return false;
    }
    try {
      normalizeCommandInput({
        plan,
        workspaceRoot: this.#workspaceRoot,
        defaultTimeoutMs: this.#defaultTimeoutMs,
        capabilityKey: "test.run",
        operationCandidates: ["exec", "test", "test.run"],
      });
      return true;
    } catch {
      return false;
    }
  }

  async prepare(plan: CapabilityInvocationPlan, lease: CapabilityLease): Promise<PreparedCapabilityCall> {
    const input = normalizeCommandInput({
      plan,
      workspaceRoot: this.#workspaceRoot,
      defaultTimeoutMs: this.#defaultTimeoutMs,
      capabilityKey: "test.run",
      operationCandidates: ["exec", "test", "test.run"],
    });
    const prepared = createPreparedCapabilityCall({
      lease,
      plan,
      executionMode: "direct",
      preparedPayloadRef: `test-run:${plan.planId}`,
      metadata: {
        planId: plan.planId,
        workspaceRoot: this.#workspaceRoot,
      },
    });
    this.#prepared.set(prepared.preparedId, { input });
    return prepared;
  }

  async execute(prepared: PreparedCapabilityCall) {
    const state = this.#prepared.get(prepared.preparedId);
    if (!state) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        error: {
          code: "test_run_prepared_state_missing",
          message: `Prepared test.run state for ${prepared.preparedId} was not found.`,
        },
      });
    }
    this.#prepared.delete(prepared.preparedId);

    const result = await this.#commandRunner(state.input);
    const stdout = trimCommandOutput(result.stdout, state.input.maxOutputChars);
    const stderr = trimCommandOutput(result.stderr, state.input.maxOutputChars);
    if (result.timedOut) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "timeout",
        output: {
          stdout: stdout.text,
          stderr: stderr.text,
          stdoutTruncated: stdout.truncated,
          stderrTruncated: stderr.truncated,
        },
        error: {
          code: "test_run_timeout",
          message: `test.run timed out after ${state.input.timeoutMs}ms.`,
        },
        metadata: {
          capabilityKey: "test.run",
          runtimeKind: this.runtimeKind,
          commandSummary: state.input.commandSummary,
          commandKind: state.input.commandKind,
        },
      });
    }

    if (result.exitCode !== 0) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        output: {
          stdout: stdout.text,
          stderr: stderr.text,
          stdoutTruncated: stdout.truncated,
          stderrTruncated: stderr.truncated,
          exitCode: result.exitCode,
          signal: result.signal,
        },
        error: {
          code: "test_run_non_zero_exit",
          message: `test.run exited with code ${String(result.exitCode)}.`,
        },
        metadata: {
          capabilityKey: "test.run",
          runtimeKind: this.runtimeKind,
          commandSummary: state.input.commandSummary,
          commandKind: state.input.commandKind,
        },
      });
    }

    return createCapabilityResultEnvelope({
      executionId: prepared.preparedId,
      status: "success",
      output: {
        stdout: stdout.text,
        stderr: stderr.text,
        stdoutTruncated: stdout.truncated,
        stderrTruncated: stderr.truncated,
        stdoutChars: stdout.originalChars,
        stderrChars: stderr.originalChars,
        exitCode: result.exitCode,
        cwd: state.input.relativeWorkspaceCwd,
        commandSummary: state.input.commandSummary,
        commandKind: state.input.commandKind,
      },
      metadata: {
        capabilityKey: "test.run",
        runtimeKind: this.runtimeKind,
        commandSummary: state.input.commandSummary,
        commandKind: state.input.commandKind,
      },
    });
  }
}

class CodeDiffCapabilityAdapter implements CapabilityAdapter {
  readonly id = "adapter.code.diff";
  readonly runtimeKind = "local-tooling";
  readonly #workspaceRoot: string;
  readonly #commandRunner: (
    input: NormalizedCommandInput,
  ) => Promise<CommandExecutionResult>;
  readonly #prepared = new Map<string, PreparedCodeDiffState>();

  constructor(options: TapToolingAdapterOptions) {
    this.#workspaceRoot = path.resolve(options.workspaceRoot);
    this.#commandRunner = options.commandRunner ?? createDefaultCommandRunner();
  }

  supports(plan: CapabilityInvocationPlan): boolean {
    if (plan.capabilityKey !== "code.diff") {
      return false;
    }
    try {
      normalizeCodeDiffInput(plan, this.#workspaceRoot);
      return true;
    } catch {
      return false;
    }
  }

  async prepare(plan: CapabilityInvocationPlan, lease: CapabilityLease): Promise<PreparedCapabilityCall> {
    const normalized = normalizeCodeDiffInput(plan, this.#workspaceRoot);
    const prepared = createPreparedCapabilityCall({
      lease,
      plan,
      executionMode: "direct",
      preparedPayloadRef: `code-diff:${plan.planId}`,
      metadata: {
        planId: plan.planId,
        workspaceRoot: this.#workspaceRoot,
      },
    });
    this.#prepared.set(prepared.preparedId, normalized);
    return prepared;
  }

  async execute(prepared: PreparedCapabilityCall) {
    const state = this.#prepared.get(prepared.preparedId);
    if (!state) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        error: {
          code: "code_diff_prepared_state_missing",
          message: `Prepared code.diff state for ${prepared.preparedId} was not found.`,
        },
      });
    }
    this.#prepared.delete(prepared.preparedId);

    const tempRoot = await mkdtemp(path.join(tmpdir(), "praxis-code-diff-"));
    try {
      let leftContent = state.before;
      let rightContent = state.after;

      if (!leftContent && state.leftPath) {
        const leftResolved = resolvePathWithinWorkspace({
          workspaceRoot: this.#workspaceRoot,
          candidatePath: state.leftPath,
          scope: state.scope,
          operationCandidates: ["read", "code.diff"],
          label: "code.diff left path",
        });
        leftContent = await readFile(leftResolved.absolutePath, "utf8");
      }
      if (!rightContent && state.rightPath) {
        const rightResolved = resolvePathWithinWorkspace({
          workspaceRoot: this.#workspaceRoot,
          candidatePath: state.rightPath,
          scope: state.scope,
          operationCandidates: ["read", "code.diff"],
          label: "code.diff right path",
        });
        rightContent = await readFile(rightResolved.absolutePath, "utf8");
      }
      if (!leftContent && state.base && state.leftPath) {
        const baseResult = await runSimpleCommand(this.#commandRunner, {
          command: "git",
          args: ["show", `${state.base}:${state.leftPath}`],
          cwd: state.cwd.absolutePath,
          relativeWorkspaceCwd: state.cwd.relativeWorkspacePath,
          timeoutMs: 15_000,
          maxOutputChars: state.maxOutputChars,
          commandSummary: `git show ${state.base}:${state.leftPath}`,
          commandKind: "read",
          runInBackground: false,
          tty: false,
        });
        if (baseResult.exitCode === 0) {
          leftContent = baseResult.stdout;
        }
      }

      leftContent = leftContent ?? "";
      rightContent = rightContent ?? "";

      const leftFile = path.join(tempRoot, "left.txt");
      const rightFile = path.join(tempRoot, "right.txt");
      await writeFile(leftFile, leftContent, "utf8");
      await writeFile(rightFile, rightContent, "utf8");

      const diffResult = await runSimpleCommand(this.#commandRunner, {
        command: "git",
        args: ["diff", "--no-index", "--no-ext-diff", "--", leftFile, rightFile],
        cwd: state.cwd.absolutePath,
        relativeWorkspaceCwd: state.cwd.relativeWorkspacePath,
        timeoutMs: 15_000,
        maxOutputChars: state.maxOutputChars,
        commandSummary: "git diff --no-index",
        commandKind: "read",
        runInBackground: false,
        tty: false,
      });
      const diff = trimCommandOutput(diffResult.stdout, state.maxOutputChars);
      if (![0, 1].includes(diffResult.exitCode ?? 0)) {
        return createCapabilityResultEnvelope({
          executionId: prepared.preparedId,
          status: "failed",
          output: {
            stdout: diff.text,
            stderr: diffResult.stderr,
            exitCode: diffResult.exitCode,
          },
          error: {
            code: "code_diff_failed",
            message: `code.diff exited with code ${String(diffResult.exitCode)}.`,
          },
          metadata: {
            capabilityKey: "code.diff",
            runtimeKind: this.runtimeKind,
          },
        });
      }
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: diff.truncated ? "partial" : "success",
        output: {
          diff: diff.text,
          diffChars: diff.originalChars,
          truncated: diff.truncated,
          leftChars: leftContent.length,
          rightChars: rightContent.length,
        },
        metadata: {
          capabilityKey: "code.diff",
          runtimeKind: this.runtimeKind,
        },
      });
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }
}

export function createTapToolingCapabilityAdapter(
  capabilityKey: TapToolingBaselineCapabilityKey,
  options: TapToolingAdapterOptions,
): CapabilityAdapter {
  switch (capabilityKey) {
    case "repo.write":
      return new RepoWriteCapabilityAdapter(options);
    case "code.edit":
      return new CodeEditCapabilityAdapter(options);
    case "code.patch":
      return new CodePatchCapabilityAdapter(options);
    case "shell.session":
      return new ShellSessionCapabilityAdapter(options);
    case "git.status":
      return new GitStatusCapabilityAdapter(options);
    case "git.diff":
      return new GitDiffCapabilityAdapter(options);
    case "git.commit":
      return new GitCommitCapabilityAdapter(options);
    case "git.push":
      return new GitPushCapabilityAdapter(options);
    case "code.diff":
      return new CodeDiffCapabilityAdapter(options);
    case "write_todos":
      return new WriteTodosCapabilityAdapter();
    case "skill.doc.generate":
      return new SkillDocGenerateCapabilityAdapter(options);
    case "shell.restricted":
      return new RestrictedShellCapabilityAdapter(options);
    case "test.run":
      return new TestRunCapabilityAdapter(options);
  }
  throw new Error(`Unsupported tap tooling capability ${capabilityKey}.`);
}

export function createTapToolingActivationFactory(
  capabilityKey: TapToolingBaselineCapabilityKey,
  options: TapToolingAdapterOptions,
) {
  return () => createTapToolingCapabilityAdapter(capabilityKey, options);
}

export function registerTapToolingBaseline(
  target: TapToolingRegistrationTarget,
  options: TapToolingAdapterOptions,
): RegisterTapToolingBaselineResult {
  const packages = createTapToolingBaselineCapabilityPackages();
  const manifests: CapabilityManifest[] = [];
  const bindings: unknown[] = [];
  const activationFactoryRefs = new Set<string>();
  const capabilityKeys: TapToolingBaselineCapabilityKey[] = [];

  for (const capabilityPackage of packages) {
    const capabilityKey = capabilityPackage.manifest.capabilityKey;
    if (!isTapToolingBaselineCapabilityKey(capabilityKey)) {
      continue;
    }

    const activationSpec = capabilityPackage.activationSpec;
    if (!activationSpec) {
      throw new Error(`Capability package ${capabilityKey} is missing an activation spec.`);
    }

    const manifest = materializeCapabilityManifestFromActivation({
      capabilityPackage,
      activationSpec,
      capabilityIdPrefix: "capability",
    });
    manifests.push(manifest);
    capabilityKeys.push(capabilityKey);
    const adapter = createTapToolingCapabilityAdapter(capabilityKey, options);
    bindings.push(target.registerCapabilityAdapter(manifest, adapter));
    target.registerTaActivationFactory(
      activationSpec.adapterFactoryRef,
      createTapToolingActivationFactory(capabilityKey, options),
    );
    activationFactoryRefs.add(activationSpec.adapterFactoryRef);
  }

  return {
    capabilityKeys,
    manifests,
    packages,
    bindings,
    activationFactoryRefs: [...activationFactoryRefs],
  };
}

export function createTapToolingProvisioningPackage(
  capabilityKey: string,
): CapabilityPackage | undefined {
  if (!isTapToolingBaselineCapabilityKey(capabilityKey)) {
    return undefined;
  }

  return createTapToolingCapabilityPackage(capabilityKey);
}
