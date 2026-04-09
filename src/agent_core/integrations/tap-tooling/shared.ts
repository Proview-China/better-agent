import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

import type {
  ProviderId,
  SdkLayer,
} from "../../../rax/index.js";
import type {
  CapabilityAdapter,
  CapabilityInvocationPlan,
  CapabilityManifest,
} from "../../capability-types/index.js";
import type { AccessRequestScope } from "../../ta-pool-types/index.js";
import type { CapabilityPackage } from "../../capability-package/index.js";
import type { TapToolingBaselineCapabilityKey } from "../../capability-package/index.js";
import type { ActivationAdapterFactoryContext } from "../../ta-pool-runtime/activation-factory-resolver.js";

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

export interface BrowserPlaywrightInput {
  action?: string;
  toolName?: string;
  name?: string;
  arguments?: Record<string, unknown>;
  args?: Record<string, unknown>;
  route?: Record<string, unknown>;
  provider?: string;
  model?: string;
  layer?: string;
  url?: string;
  allowedDomains?: string[];
  allowed_domains?: string[];
  headless?: boolean;
  browser?: string;
  isolated?: boolean;
  allowFileUploads?: boolean;
  allow_file_uploads?: boolean;
  maxOutputChars?: number;
  ref?: string;
  element?: string;
  button?: string;
  doubleClick?: boolean;
  double_click?: boolean;
  modifiers?: string[];
  text?: string;
  slowly?: boolean;
  submit?: boolean;
  fullPage?: boolean;
  full_page?: boolean;
  filename?: string;
  type?: string;
  time?: number;
  textGone?: string;
  text_gone?: string;
  level?: string;
  all?: boolean;
  filter?: string;
  requestBody?: boolean;
  requestHeaders?: boolean;
  static?: boolean;
  index?: number;
  tabAction?: string;
  tab_action?: string;
}

export interface WriteTodosInput {
  todos?: Array<{
    description?: string;
    status?: "pending" | "in_progress" | "completed" | "cancelled" | "blocked";
  }>;
}

export interface NormalizedRepoWriteEntry {
  absolutePath: string;
  relativeWorkspacePath: string;
  mode: NonNullable<RepoWriteEntry["mode"]>;
  content?: string;
  createParents: boolean;
}

export interface NormalizedSkillDocGenerateInput {
  entry: NormalizedRepoWriteEntry;
  format: "markdown" | "text";
  title?: string;
  sectionCount: number;
}

export interface NormalizedCommandInput {
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
  browserPlaywrightRuntime?: BrowserPlaywrightRuntimeLike;
  defaultShellTimeoutMs?: number;
  defaultTestTimeoutMs?: number;
}

export type BrowserPlaywrightBackendKind =
  | "openai-codex-browser-mcp-style"
  | "anthropic-claude-code-browser-mcp-style"
  | "gemini-cli-browser-agent-style"
  | "playwright-shared-runtime";

export interface BrowserPlaywrightRouteContext {
  provider?: ProviderId;
  model?: string;
  layer?: SdkLayer;
}

export interface BrowserPlaywrightConnectInput {
  connectionId?: string;
  workspaceRoot: string;
  headless: boolean;
  browser: "chrome" | "chromium" | "firefox" | "webkit";
  isolated: boolean;
}

export interface BrowserPlaywrightToolSummary {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  annotations?: Record<string, unknown>;
}

export interface BrowserPlaywrightToolCallResult {
  content?: unknown[];
  structuredContent?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
  isError?: boolean;
  errorMessage?: string;
  raw?: unknown;
}

export interface BrowserPlaywrightSessionLike {
  connectionId: string;
  tools(): Promise<{ tools: BrowserPlaywrightToolSummary[] }>;
  call(input: {
    toolName: string;
    arguments?: Record<string, unknown>;
  }): Promise<BrowserPlaywrightToolCallResult>;
  getLaunchEvidence?(): Promise<BrowserPlaywrightLaunchEvidence | undefined>;
  disconnect(): Promise<void>;
}

export interface BrowserPlaywrightRuntimeLike {
  use(input: BrowserPlaywrightConnectInput): Promise<BrowserPlaywrightSessionLike>;
}

export interface BrowserPlaywrightLaunchEvidence {
  requestedHeadless: boolean;
  appliedHeadless: boolean;
  requestedIsolated: boolean;
  appliedIsolated: boolean;
  verification: "process" | "config" | "unverified";
  processVerifiedHeaded?: boolean;
  processSample?: string[];
  configPath?: string;
  userDataDir?: string;
  proxyServer?: string;
}

export interface PreparedRepoWriteState {
  entries: NormalizedRepoWriteEntry[];
}

export interface NormalizedCodeEditInput {
  absolutePath: string;
  relativeWorkspacePath: string;
  oldString: string;
  newString: string;
  replaceAll: boolean;
  createParents: boolean;
}

export type ParsedPatchLineKind = "context" | "add" | "remove";

export interface ParsedPatchLine {
  kind: ParsedPatchLineKind;
  text: string;
}

export interface ParsedPatchHunk {
  header?: string;
  lines: ParsedPatchLine[];
}

export type ParsedPatchOperation =
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

export interface NormalizedCodePatchInput {
  patch: string;
  operations: ParsedPatchOperation[];
}

export interface PreparedSkillDocState {
  input: NormalizedSkillDocGenerateInput;
}

export interface PreparedCodeEditState {
  input: NormalizedCodeEditInput;
}

export interface PreparedCodePatchState {
  input: NormalizedCodePatchInput;
  scope?: AccessRequestScope;
}

export interface PreparedShellSessionState {
  input: NormalizedCommandInput & {
    action: "start" | "poll" | "write" | "terminate";
    sessionId?: string;
    chars?: string;
  };
}

export interface GitStatusEntry {
  code: string;
  path: string;
}

export interface PreparedGitStatusState {
  cwd: { absolutePath: string; relativeWorkspacePath: string };
  includeIgnored: boolean;
  maxEntries: number;
  maxOutputChars: number;
}

export interface PreparedGitDiffState {
  cwd: { absolutePath: string; relativeWorkspacePath: string };
  paths?: string[];
  staged: boolean;
  base?: string;
  maxOutputChars: number;
}

export interface PreparedGitCommitState {
  cwd: { absolutePath: string; relativeWorkspacePath: string };
  paths?: string[];
  stageAll: boolean;
  message: string;
  authorName?: string;
  authorEmail?: string;
  maxOutputChars: number;
}

export interface PreparedGitPushState {
  cwd: { absolutePath: string; relativeWorkspacePath: string };
  remote: string;
  branch?: string;
  setUpstream: boolean;
  maxOutputChars: number;
}

export interface PreparedCodeDiffState {
  cwd: { absolutePath: string; relativeWorkspacePath: string };
  leftPath?: string;
  rightPath?: string;
  before?: string;
  after?: string;
  base?: string;
  maxOutputChars: number;
  scope?: AccessRequestScope;
}

export interface NormalizedBrowserPlaywrightInput {
  action:
    | "connect"
    | "list_tools"
    | "disconnect"
    | "navigate"
    | "navigate_back"
    | "snapshot"
    | "screenshot"
    | "click"
    | "hover"
    | "type"
    | "press_key"
    | "select_option"
    | "drag"
    | "fill_form"
    | "handle_dialog"
    | "resize"
    | "wait_for"
    | "console_messages"
    | "network_requests"
    | "tabs"
    | "close"
    | "raw";
  toolName?: string;
  arguments?: Record<string, unknown>;
  route?: BrowserPlaywrightRouteContext;
  selectedBackend: BrowserPlaywrightBackendKind;
  resolvedBackend: "playwright-shared-runtime";
  allowedDomains?: string[];
  headless: boolean;
  browser: "chrome" | "chromium" | "firefox" | "webkit";
  isolated: boolean;
  allowFileUploads: boolean;
  maxOutputChars: number;
}

export interface PreparedBrowserPlaywrightState {
  input: NormalizedBrowserPlaywrightInput;
  scope?: AccessRequestScope;
}

export interface NormalizedBrowserPlaywrightToolResult {
  text?: string;
  truncated: boolean;
  imageUrls: string[];
  imageCount: number;
  pageUrl?: string;
  pageTitle?: string;
  blockedByInterstitial: boolean;
}

export interface TodoEntry {
  description: string;
  status: "pending" | "in_progress" | "completed" | "cancelled" | "blocked";
}

export interface PreparedWriteTodosState {
  sessionId: string;
  todos: TodoEntry[];
}

export interface PreparedCommandState {
  input: NormalizedCommandInput;
}

export interface ShellSessionRuntimeState {
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

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return undefined;
  }

  return value as Record<string, unknown>;
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value.filter((item): item is string => typeof item === "string");
  return normalized.length > 0 ? normalized : undefined;
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function asStringRecord(value: unknown): Record<string, string> | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const entries = Object.entries(record).filter(([, entry]) => typeof entry === "string");
  return entries.length > 0
    ? Object.fromEntries(entries) as Record<string, string>
    : undefined;
}

export function escapeGlobPattern(pattern: string): string {
  return pattern.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

export function matchPathPattern(candidate: string, pattern: string): boolean {
  const escaped = escapeGlobPattern(pattern)
    .replace(/\*\*/g, "__DOUBLE_WILDCARD__")
    .replace(/\*/g, "[^/]*")
    .replace(/__DOUBLE_WILDCARD__/g, ".*");
  return new RegExp(`^${escaped}$`).test(candidate);
}

export function countOccurrences(haystack: string, needle: string): number {
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

export function normalizeNewlines(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

export function restoreNewlines(value: string, template: string): string {
  return template.includes("\r\n") ? value.replace(/\n/g, "\r\n") : value;
}

export async function readTextFileIfExists(absolutePath: string): Promise<string | undefined> {
  try {
    return await readFile(absolutePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

export function countLines(value: string): number {
  if (!value) {
    return 0;
  }
  return normalizeNewlines(value).split("\n").length;
}

export function getGrantedScope(plan: CapabilityInvocationPlan): AccessRequestScope | undefined {
  const metadata = asRecord(plan.metadata);
  const scope = metadata?.grantedScope;
  return asRecord(scope) as AccessRequestScope | undefined;
}
