import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type {
  CapabilityAdapter,
  CapabilityInvocationPlan,
  CapabilityLease,
  PreparedCapabilityCall,
} from "../../capability-types/index.js";
import { createPreparedCapabilityCall } from "../../capability-invocation/index.js";
import { createCapabilityResultEnvelope } from "../../capability-result/index.js";
import type { TapToolingBaselineCapabilityKey } from "../../capability-package/index.js";
import {
  buildBrowserPlaywrightSessionFingerprint,
  maybeCaptureBrowserPlaywrightPostNavigateSnapshot,
  maybeRecoverBrowserPlaywrightInterstitial,
  mergeBrowserPlaywrightToolResults,
  normalizeBrowserPlaywrightToolResult,
  SharedBrowserPlaywrightRuntime,
} from "./browser-playwright.js";
import {
  buildShellSessionEnvelope,
  createDefaultCommandRunner,
  createDefaultRepoWriteHandler,
  createGitCommandInput,
  createShellSessionId,
  runSimpleCommand,
  SHELL_SESSION_RUNTIME,
  trimCommandOutput,
  waitForShellSessionWindow,
  WRITE_TODOS_RUNTIME,
} from "./command-runtime.js";
import { parseGitStatusEntries } from "./git-parsers.js";
import {
  countPatchLineChanges,
  normalizeBrowserPlaywrightInput,
  normalizeCodeDiffInput,
  normalizeCodeEditInput,
  normalizeCodePatchInput,
  normalizeCommandInput,
  normalizeGitCommitInput,
  normalizeGitDiffInput,
  normalizeGitPushInput,
  normalizeGitStatusInput,
  normalizeRepoWriteEntries,
  normalizeShellSessionInput,
  normalizeSkillDocGenerateInput,
  normalizeWriteTodosInput,
  SECRET_LIKE_GIT_PATH_PATTERNS,
} from "./normalizers.js";
import { resolvePathWithinWorkspace } from "./paths-and-permissions.js";
import {
  countLines,
  countOccurrences,
  getGrantedScope,
  normalizeNewlines,
  readTextFileIfExists,
  restoreNewlines,
  type BrowserPlaywrightRuntimeLike,
  type BrowserPlaywrightSessionLike,
  type CommandExecutionResult,
  type NormalizedCommandInput,
  type NormalizedRepoWriteEntry,
  type PreparedBrowserPlaywrightState,
  type PreparedCodeDiffState,
  type PreparedCodeEditState,
  type PreparedCodePatchState,
  type PreparedCommandState,
  type PreparedGitCommitState,
  type PreparedGitDiffState,
  type PreparedGitPushState,
  type PreparedGitStatusState,
  type PreparedRepoWriteState,
  type PreparedShellSessionState,
  type PreparedSkillDocState,
  type PreparedWriteTodosState,
  type ShellSessionRuntimeState,
  type TapToolingAdapterOptions,
} from "./shared.js";

export class RepoWriteCapabilityAdapter implements CapabilityAdapter {
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

export class CodeEditCapabilityAdapter implements CapabilityAdapter {
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

export class CodePatchCapabilityAdapter implements CapabilityAdapter {
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

export class ShellSessionCapabilityAdapter implements CapabilityAdapter {
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

export class GitStatusCapabilityAdapter implements CapabilityAdapter {
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

    const parsed = parseGitStatusEntries(result.stdout, state.maxEntries);
    return createCapabilityResultEnvelope({
      executionId: prepared.preparedId,
      status: "success",
      output: {
        cwd: state.cwd.relativeWorkspacePath,
        branch: parsed.branch,
        clean: parsed.entries.length === 0,
        entries: parsed.entries,
        entryCount: parsed.entries.length,
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

export class GitDiffCapabilityAdapter implements CapabilityAdapter {
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

export class GitCommitCapabilityAdapter implements CapabilityAdapter {
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

export class GitPushCapabilityAdapter implements CapabilityAdapter {
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

export class WriteTodosCapabilityAdapter implements CapabilityAdapter {
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

export class SkillDocGenerateCapabilityAdapter implements CapabilityAdapter {
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

export class RestrictedShellCapabilityAdapter implements CapabilityAdapter {
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

export class TestRunCapabilityAdapter implements CapabilityAdapter {
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

export class CodeDiffCapabilityAdapter implements CapabilityAdapter {
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

export class BrowserPlaywrightCapabilityAdapter implements CapabilityAdapter {
  readonly id = "adapter.browser.playwright";
  readonly runtimeKind = "local-tooling";

  #runtime: BrowserPlaywrightRuntimeLike;
  #session?: BrowserPlaywrightSessionLike;
  #sessionFingerprint?: string;
  readonly #prepared = new Map<string, PreparedBrowserPlaywrightState>();

  constructor(private readonly options: TapToolingAdapterOptions) {
    this.#runtime = options.browserPlaywrightRuntime ?? new SharedBrowserPlaywrightRuntime(options.workspaceRoot);
  }

  supports(plan: CapabilityInvocationPlan): boolean {
    if (plan.capabilityKey !== "browser.playwright") {
      return false;
    }
    try {
      normalizeBrowserPlaywrightInput(plan);
      return true;
    } catch {
      return false;
    }
  }

  async prepare(
    plan: CapabilityInvocationPlan,
    lease: CapabilityLease,
  ): Promise<PreparedCapabilityCall> {
    if (plan.capabilityKey !== "browser.playwright") {
      throw new Error("BrowserPlaywrightCapabilityAdapter received a mismatched capability key.");
    }

    const normalized = normalizeBrowserPlaywrightInput(plan);
    const prepared = createPreparedCapabilityCall({
      lease,
      plan,
      executionMode: "direct",
      preparedPayloadRef: `browser-playwright:${plan.planId}`,
      metadata: {
        planId: plan.planId,
        action: normalized.action,
      },
    });
    this.#prepared.set(prepared.preparedId, {
      input: normalized,
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
          code: "browser_playwright_prepared_state_missing",
          message: `Prepared browser.playwright state for ${prepared.preparedId} was not found.`,
        },
      });
    }
    this.#prepared.delete(prepared.preparedId);

    const sessionFingerprint = buildBrowserPlaywrightSessionFingerprint(state.input);

    if (state.input.action === "disconnect") {
      if (this.#session) {
        await this.#session.disconnect().catch(() => undefined);
        this.#session = undefined;
        this.#sessionFingerprint = undefined;
      }
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "success",
        output: {
          action: "disconnect",
          disconnected: true,
        },
        metadata: {
          capabilityKey: "browser.playwright",
          runtimeKind: this.runtimeKind,
          selectedBackend: state.input.selectedBackend,
          resolvedBackend: state.input.resolvedBackend,
        },
      });
    }

    if (!this.#session || this.#sessionFingerprint !== sessionFingerprint) {
      if (this.#session) {
        await this.#session.disconnect().catch(() => undefined);
      }
      this.#session = await this.#runtime.use({
        connectionId: "browser-playwright-shared",
        workspaceRoot: this.options.workspaceRoot,
        headless: state.input.headless,
        browser: state.input.browser,
        isolated: state.input.isolated,
      });
      this.#sessionFingerprint = sessionFingerprint;
    }

    const session = this.#session;

    if (state.input.action === "connect" || state.input.action === "list_tools") {
      const tools = await session.tools();
      const launchEvidence = await session.getLaunchEvidence?.();
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "success",
        output: {
          action: state.input.action,
          connectionId: session.connectionId,
          toolCount: tools.tools.length,
          tools: tools.tools.slice(0, 24),
          selectedBackend: state.input.selectedBackend,
          resolvedBackend: state.input.resolvedBackend,
          headless: state.input.headless,
          browser: state.input.browser,
          isolated: state.input.isolated,
          launchEvidence,
        },
        metadata: {
          capabilityKey: "browser.playwright",
          runtimeKind: this.runtimeKind,
          selectedBackend: state.input.selectedBackend,
          resolvedBackend: state.input.resolvedBackend,
        },
      });
    }

    const toolName = state.input.toolName;
    if (!toolName) {
      throw new Error("browser.playwright is missing toolName after normalization.");
    }

    const result = await session.call({
      toolName,
      arguments: state.input.arguments,
    });
    const normalizedResult = normalizeBrowserPlaywrightToolResult(
      result,
      state.input.maxOutputChars,
    );
    const recoveredInterstitialResult = !result.isError && normalizedResult.blockedByInterstitial
      ? await maybeRecoverBrowserPlaywrightInterstitial(session, state.input)
      : undefined;
    const effectivePrimaryResult = recoveredInterstitialResult && !recoveredInterstitialResult.blockedByInterstitial
      ? {
        ...mergeBrowserPlaywrightToolResults(normalizedResult, recoveredInterstitialResult, state.input.maxOutputChars),
        blockedByInterstitial: false,
        pageUrl: recoveredInterstitialResult.pageUrl ?? normalizedResult.pageUrl,
        pageTitle: recoveredInterstitialResult.pageTitle ?? normalizedResult.pageTitle,
      }
      : normalizedResult;
    const snapshotResult = !result.isError && !effectivePrimaryResult.blockedByInterstitial
      ? await maybeCaptureBrowserPlaywrightPostNavigateSnapshot(session, state.input)
      : undefined;
    const mergedResult = mergeBrowserPlaywrightToolResults(
      effectivePrimaryResult,
      snapshotResult,
      state.input.maxOutputChars,
    );
    const launchEvidence = await session.getLaunchEvidence?.();

    if (result.isError) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        output: {
          action: state.input.action,
          toolName,
          connectionId: session.connectionId,
          arguments: state.input.arguments,
          text: mergedResult.text,
          imageUrls: mergedResult.imageUrls,
          imageCount: mergedResult.imageCount,
          headless: state.input.headless,
          browser: state.input.browser,
          isolated: state.input.isolated,
          pageUrl: mergedResult.pageUrl,
          pageTitle: mergedResult.pageTitle,
          interstitialRecovered: Boolean(recoveredInterstitialResult && !recoveredInterstitialResult.blockedByInterstitial),
          launchEvidence,
        },
        error: {
          code: "browser_playwright_tool_error",
          message: mergedResult.text ?? result.errorMessage ?? `${toolName} failed.`,
        },
        metadata: {
          capabilityKey: "browser.playwright",
          runtimeKind: this.runtimeKind,
          selectedBackend: state.input.selectedBackend,
          resolvedBackend: state.input.resolvedBackend,
        },
      });
    }

    if (mergedResult.blockedByInterstitial) {
      return createCapabilityResultEnvelope({
        executionId: prepared.preparedId,
        status: "failed",
        output: {
          action: state.input.action,
          toolName,
          connectionId: session.connectionId,
          arguments: state.input.arguments,
          text: mergedResult.text,
          imageUrls: mergedResult.imageUrls,
          imageCount: mergedResult.imageCount,
          pageUrl: mergedResult.pageUrl,
          pageTitle: mergedResult.pageTitle,
          selectedBackend: state.input.selectedBackend,
          resolvedBackend: state.input.resolvedBackend,
          headless: state.input.headless,
          browser: state.input.browser,
          isolated: state.input.isolated,
          interstitialRecovered: Boolean(recoveredInterstitialResult && !recoveredInterstitialResult.blockedByInterstitial),
          launchEvidence,
        },
        error: {
          code: "browser_playwright_navigation_interstitial",
          message: `browser.playwright reached an interstitial or anti-bot page at ${mergedResult.pageUrl ?? "the target URL"}.`,
        },
        metadata: {
          capabilityKey: "browser.playwright",
          runtimeKind: this.runtimeKind,
          selectedBackend: state.input.selectedBackend,
          resolvedBackend: state.input.resolvedBackend,
        },
      });
    }

    return createCapabilityResultEnvelope({
      executionId: prepared.preparedId,
      status: mergedResult.truncated ? "partial" : "success",
      output: {
        action: state.input.action,
        toolName,
        connectionId: session.connectionId,
        arguments: state.input.arguments,
        text: mergedResult.text,
        imageUrls: mergedResult.imageUrls,
        imageCount: mergedResult.imageCount,
        selectedBackend: state.input.selectedBackend,
        resolvedBackend: state.input.resolvedBackend,
        headless: state.input.headless,
        browser: state.input.browser,
        isolated: state.input.isolated,
        pageUrl: mergedResult.pageUrl,
        pageTitle: mergedResult.pageTitle,
        snapshotCaptured: Boolean(snapshotResult),
        interstitialRecovered: Boolean(recoveredInterstitialResult && !recoveredInterstitialResult.blockedByInterstitial),
        launchEvidence,
      },
      metadata: {
        capabilityKey: "browser.playwright",
        runtimeKind: this.runtimeKind,
        selectedBackend: state.input.selectedBackend,
        resolvedBackend: state.input.resolvedBackend,
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
    case "browser.playwright":
      return new BrowserPlaywrightCapabilityAdapter(options);
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
