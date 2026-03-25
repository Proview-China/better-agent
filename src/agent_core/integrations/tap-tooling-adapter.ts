import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
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
  command: string;
  args?: string[];
  cwd?: string;
  timeoutMs?: number;
  env?: Record<string, string>;
}

interface NormalizedCommandInput {
  command: string;
  args: string[];
  cwd: string;
  relativeWorkspaceCwd: string;
  timeoutMs: number;
  env?: Record<string, string>;
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

interface PreparedSkillDocState {
  input: NormalizedSkillDocGenerateInput;
}

interface PreparedCommandState {
  input: NormalizedCommandInput;
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

function normalizeCommandInput(params: {
  plan: CapabilityInvocationPlan;
  workspaceRoot: string;
  defaultTimeoutMs: number;
  capabilityKey: TapToolingBaselineCapabilityKey;
  operationCandidates: string[];
}): NormalizedCommandInput {
  const command = asString(params.plan.input.command);
  if (!command) {
    throw new Error(`${params.capabilityKey} requires a non-empty command.`);
  }

  const args = asStringArray(params.plan.input.args) ?? [];
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
    candidatePath: asString(params.plan.input.cwd) ?? ".",
    scope,
    operationCandidates: params.operationCandidates,
    label: `${params.capabilityKey} cwd`,
  });

  const timeoutMs = typeof params.plan.input.timeoutMs === "number"
    ? params.plan.input.timeoutMs
    : params.plan.timeoutMs ?? params.defaultTimeoutMs;

  return {
    command,
    args,
    cwd: cwd.absolutePath,
    relativeWorkspaceCwd: cwd.relativeWorkspacePath,
    timeoutMs,
    env: asStringRecord(params.plan.input.env),
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
    if (result.timedOut) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "timeout",
        output: {
          stdout: result.stdout,
          stderr: result.stderr,
        },
        error: {
          code: "shell_restricted_timeout",
          message: `shell.restricted timed out after ${state.input.timeoutMs}ms.`,
        },
        metadata: {
          capabilityKey: "shell.restricted",
          runtimeKind: this.runtimeKind,
        },
      });
    }

    if (result.exitCode !== 0) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        output: {
          stdout: result.stdout,
          stderr: result.stderr,
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
        },
      });
    }

    return createCapabilityResultEnvelope({
      executionId: prepared.preparedId,
      status: "success",
      output: {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        cwd: state.input.relativeWorkspaceCwd,
      },
      metadata: {
        capabilityKey: "shell.restricted",
        runtimeKind: this.runtimeKind,
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
    if (result.timedOut) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "timeout",
        output: {
          stdout: result.stdout,
          stderr: result.stderr,
        },
        error: {
          code: "test_run_timeout",
          message: `test.run timed out after ${state.input.timeoutMs}ms.`,
        },
        metadata: {
          capabilityKey: "test.run",
          runtimeKind: this.runtimeKind,
        },
      });
    }

    if (result.exitCode !== 0) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        output: {
          stdout: result.stdout,
          stderr: result.stderr,
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
        },
      });
    }

    return createCapabilityResultEnvelope({
      executionId: prepared.preparedId,
      status: "success",
      output: {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        cwd: state.input.relativeWorkspaceCwd,
      },
      metadata: {
        capabilityKey: "test.run",
        runtimeKind: this.runtimeKind,
      },
    });
  }
}

export function createTapToolingCapabilityAdapter(
  capabilityKey: TapToolingBaselineCapabilityKey,
  options: TapToolingAdapterOptions,
): CapabilityAdapter {
  switch (capabilityKey) {
    case "repo.write":
      return new RepoWriteCapabilityAdapter(options);
    case "skill.doc.generate":
      return new SkillDocGenerateCapabilityAdapter(options);
    case "shell.restricted":
      return new RestrictedShellCapabilityAdapter(options);
    case "test.run":
      return new TestRunCapabilityAdapter(options);
  }
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
): CapabilityPackage[] {
  const packages = createTapToolingBaselineCapabilityPackages();

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
    const adapter = createTapToolingCapabilityAdapter(capabilityKey, options);
    target.registerCapabilityAdapter(manifest, adapter);
    target.registerTaActivationFactory(
      activationSpec.adapterFactoryRef,
      createTapToolingActivationFactory(capabilityKey, options),
    );
  }

  return packages;
}

export function createTapToolingProvisioningPackage(
  capabilityKey: string,
): CapabilityPackage | undefined {
  if (!isTapToolingBaselineCapabilityKey(capabilityKey)) {
    return undefined;
  }

  return createTapToolingCapabilityPackage(capabilityKey);
}
