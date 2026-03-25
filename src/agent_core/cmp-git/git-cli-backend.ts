import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { promisify } from "node:util";

import type { CmpGitAgentBranchRuntime } from "./branch-runtime.js";
import {
  createCmpGitAdapterError,
  type CmpGitBackend,
  type CmpGitBackendBootstrapReceipt,
  type CmpGitRefReadback,
} from "./git-backend.js";
import type { CmpGitProjectRepoBootstrapPlan } from "./project-repo-bootstrap.js";

const execFileAsync = promisify(execFile);

const DEFAULT_BOOTSTRAP_USER_NAME = "Praxis CMP";
const DEFAULT_BOOTSTRAP_USER_EMAIL = "cmp@praxis.local";

function normalizeError(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) {
    return error.message;
  }
  return fallbackMessage;
}

async function runGit(params: {
  cwd: string;
  args: string[];
  allowFailure?: boolean;
}): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const result = await execFileAsync("git", params.args, {
      cwd: params.cwd,
      encoding: "utf8",
    });
    return {
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
      exitCode: 0,
    };
  } catch (error) {
    const execError = error as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
      code?: number | string;
    };
    const exitCode = typeof execError.code === "number" ? execError.code : 1;
    if (params.allowFailure) {
      return {
        stdout: execError.stdout?.trim() ?? "",
        stderr: execError.stderr?.trim() ?? "",
        exitCode,
      };
    }
    throw createCmpGitAdapterError({
      code: "unsupported_operation",
      message: execError.stderr?.trim() || execError.message,
      metadata: {
        cwd: params.cwd,
        args: params.args,
      },
    });
  }
}

async function ensureBootstrapCommit(params: {
  repoRootPath: string;
  defaultBranchName: string;
}): Promise<string> {
  const status = await runGit({
    cwd: params.repoRootPath,
    args: ["rev-parse", "--verify", params.defaultBranchName],
    allowFailure: true,
  });
  if (status.exitCode === 0 && status.stdout) {
    return status.stdout;
  }

  await runGit({
    cwd: params.repoRootPath,
    args: ["config", "user.name", DEFAULT_BOOTSTRAP_USER_NAME],
  });
  await runGit({
    cwd: params.repoRootPath,
    args: ["config", "user.email", DEFAULT_BOOTSTRAP_USER_EMAIL],
  });
  await runGit({
    cwd: params.repoRootPath,
    args: ["commit", "--allow-empty", "-m", "cmp bootstrap"],
  });

  const readback = await runGit({
    cwd: params.repoRootPath,
    args: ["rev-parse", "--verify", params.defaultBranchName],
  });
  return readback.stdout;
}

async function readOptionalRef(params: {
  repoRootPath: string;
  ref: string;
}): Promise<string | undefined> {
  const readback = await runGit({
    cwd: params.repoRootPath,
    args: ["rev-parse", "--verify", params.ref],
    allowFailure: true,
  });
  return readback.exitCode === 0 && readback.stdout ? readback.stdout : undefined;
}

async function ensureBranch(params: {
  repoRootPath: string;
  branchName: string;
  targetRef: string;
}): Promise<boolean> {
  const existing = await runGit({
    cwd: params.repoRootPath,
    args: ["show-ref", "--verify", `refs/heads/${params.branchName}`],
    allowFailure: true,
  });
  if (existing.exitCode === 0) {
    return false;
  }

  await runGit({
    cwd: params.repoRootPath,
    args: ["branch", params.branchName, params.targetRef],
  });
  return true;
}

async function listWorktrees(repoRootPath: string): Promise<Set<string>> {
  const result = await runGit({
    cwd: repoRootPath,
    args: ["worktree", "list", "--porcelain"],
  });
  const lines = result.stdout.split("\n").map((line) => line.trim()).filter(Boolean);
  const worktrees = new Set<string>();
  for (const line of lines) {
    if (line.startsWith("worktree ")) {
      worktrees.add(line.slice("worktree ".length));
    }
  }
  return worktrees;
}

export class GitCliCmpGitBackend implements CmpGitBackend {
  async bootstrapProjectRepo(
    plan: CmpGitProjectRepoBootstrapPlan,
  ): Promise<CmpGitBackendBootstrapReceipt> {
    await mkdir(plan.repoRootPath, { recursive: true });

    const isRepo = await runGit({
      cwd: plan.repoRootPath,
      args: ["rev-parse", "--is-inside-work-tree"],
      allowFailure: true,
    });

    if (isRepo.exitCode !== 0) {
      await runGit({
        cwd: plan.repoRootPath,
        args: ["init", "--initial-branch", plan.defaultBranchName],
      });
      await ensureBootstrapCommit({
        repoRootPath: plan.repoRootPath,
        defaultBranchName: plan.defaultBranchName,
      });
      return {
        projectRepo: plan.projectRepo,
        repoRootPath: plan.repoRootPath,
        defaultBranchName: plan.defaultBranchName,
        createdBranchNames: plan.branchKinds.map((kind) => `${kind}/${plan.projectRepo.defaultAgentId}`),
        status: "bootstrapped",
        metadata: {
          worktreeRootPath: plan.worktreeRootPath,
          ...(plan.metadata ?? {}),
        },
      };
    }

    const currentHead = await runGit({
      cwd: plan.repoRootPath,
      args: ["symbolic-ref", "--short", "HEAD"],
      allowFailure: true,
    });
    if (currentHead.exitCode === 0 && currentHead.stdout && currentHead.stdout !== plan.defaultBranchName) {
      throw createCmpGitAdapterError({
        code: "branch_conflict",
        message: `CMP git repo ${plan.projectRepo.repoName} already uses default branch ${currentHead.stdout}, expected ${plan.defaultBranchName}.`,
        metadata: {
          repoRootPath: plan.repoRootPath,
          expectedDefaultBranch: plan.defaultBranchName,
          actualDefaultBranch: currentHead.stdout,
        },
      });
    }

    await ensureBootstrapCommit({
      repoRootPath: plan.repoRootPath,
      defaultBranchName: plan.defaultBranchName,
    });

    return {
      projectRepo: plan.projectRepo,
      repoRootPath: plan.repoRootPath,
      defaultBranchName: plan.defaultBranchName,
      createdBranchNames: plan.branchKinds.map((kind) => `${kind}/${plan.projectRepo.defaultAgentId}`),
      status: "already_exists",
      metadata: {
        worktreeRootPath: plan.worktreeRootPath,
        ...(plan.metadata ?? {}),
      },
    };
  }

  async bootstrapAgentBranchRuntime(
    runtime: CmpGitAgentBranchRuntime,
  ): Promise<readonly string[]> {
    const created: string[] = [];
    const defaultHead = await runGit({
      cwd: runtime.repoRootPath,
      args: ["rev-parse", "--verify", "HEAD"],
    });
    const targetRef = defaultHead.stdout;

    for (const branch of [
      runtime.branchFamily.work,
      runtime.branchFamily.cmp,
      runtime.branchFamily.mp,
      runtime.branchFamily.tap,
    ]) {
      const didCreate = await ensureBranch({
        repoRootPath: runtime.repoRootPath,
        branchName: branch.branchName,
        targetRef,
      });
      if (didCreate) {
        created.push(branch.branchName);
      }
    }

    await mkdir(runtime.worktreeRootPath, { recursive: true });
    const worktrees = await listWorktrees(runtime.repoRootPath);
    if (worktrees.has(runtime.cmpWorktreePath)) {
      return created;
    }

    const pathStatus = await runGit({
      cwd: runtime.repoRootPath,
      args: ["status", "--porcelain"],
      allowFailure: true,
    });
    void pathStatus;
    await mkdir(runtime.cmpWorktreePath, { recursive: true });
    const addResult = await runGit({
      cwd: runtime.repoRootPath,
      args: ["worktree", "add", runtime.cmpWorktreePath, runtime.branchFamily.cmp.branchName],
      allowFailure: true,
    });
    if (
      addResult.exitCode !== 0
      && !addResult.stderr.includes("is already checked out")
      && !addResult.stderr.includes("already exists")
    ) {
      throw createCmpGitAdapterError({
        code: "bootstrap_failed",
        message: addResult.stderr || `CMP git worktree bootstrap failed for ${runtime.agentId}.`,
        metadata: {
          repoRootPath: runtime.repoRootPath,
          cmpWorktreePath: runtime.cmpWorktreePath,
          branchName: runtime.branchFamily.cmp.branchName,
        },
      });
    }
    return created;
  }

  async readBranchHead(runtime: CmpGitAgentBranchRuntime): Promise<CmpGitRefReadback> {
    const headCommitSha = await readOptionalRef({
      repoRootPath: runtime.repoRootPath,
      ref: runtime.branchFamily.cmp.fullRef,
    });
    const checkedCommitSha = await readOptionalRef({
      repoRootPath: runtime.repoRootPath,
      ref: runtime.checkedRefName,
    });
    const promotedCommitSha = await readOptionalRef({
      repoRootPath: runtime.repoRootPath,
      ref: runtime.promotedRefName,
    });

    return {
      branchRef: runtime.branchFamily.cmp,
      headCommitSha,
      checkedRefName: runtime.checkedRefName,
      promotedRefName: runtime.promotedRefName,
      checkedCommitSha,
      promotedCommitSha,
      metadata: {
        cmpWorktreePath: runtime.cmpWorktreePath,
        lineageId: runtime.lineageId,
      },
    };
  }

  async writeCheckedRef(
    runtime: CmpGitAgentBranchRuntime,
    commitSha: string,
  ): Promise<CmpGitRefReadback> {
    const normalizedCommitSha = commitSha.trim();
    if (!normalizedCommitSha) {
      throw createCmpGitAdapterError({
        code: "ref_write_failed",
        message: `CMP git checked ref for ${runtime.agentId} requires a non-empty commit SHA.`,
      });
    }
    const commit = await runGit({
      cwd: runtime.repoRootPath,
      args: ["rev-parse", "--verify", `${normalizedCommitSha}^{commit}`],
      allowFailure: true,
    });
    if (commit.exitCode !== 0) {
      throw createCmpGitAdapterError({
        code: "ref_write_failed",
        message: commit.stderr || `CMP git commit ${normalizedCommitSha} does not exist.`,
        metadata: {
          repoRootPath: runtime.repoRootPath,
          commitSha: normalizedCommitSha,
        },
      });
    }

    await runGit({
      cwd: runtime.repoRootPath,
      args: ["update-ref", runtime.checkedRefName, normalizedCommitSha],
    });
    return this.readBranchHead(runtime);
  }

  async writePromotedRef(
    runtime: CmpGitAgentBranchRuntime,
    commitSha: string,
  ): Promise<CmpGitRefReadback> {
    const normalizedCommitSha = commitSha.trim();
    const readback = await this.readBranchHead(runtime);
    if (!readback.checkedCommitSha) {
      throw createCmpGitAdapterError({
        code: "ref_write_failed",
        message: `CMP git promoted ref for ${runtime.agentId} requires an active checked ref first.`,
        metadata: {
          repoRootPath: runtime.repoRootPath,
          branchName: runtime.branchFamily.cmp.branchName,
        },
      });
    }
    if (readback.checkedCommitSha !== normalizedCommitSha) {
      throw createCmpGitAdapterError({
        code: "ref_write_failed",
        message: `CMP git promoted ref for ${runtime.agentId} must match checked commit ${readback.checkedCommitSha}.`,
        metadata: {
          repoRootPath: runtime.repoRootPath,
          branchName: runtime.branchFamily.cmp.branchName,
          checkedCommitSha: readback.checkedCommitSha,
          requestedCommitSha: normalizedCommitSha,
        },
      });
    }

    await runGit({
      cwd: runtime.repoRootPath,
      args: ["update-ref", runtime.promotedRefName, normalizedCommitSha],
    });
    return this.readBranchHead(runtime);
  }
}

export function createGitCliCmpGitBackend(): GitCliCmpGitBackend {
  return new GitCliCmpGitBackend();
}

export async function assertGitCliAvailable(): Promise<void> {
  try {
    await execFileAsync("git", ["--version"], {
      encoding: "utf8",
    });
  } catch (error) {
    throw createCmpGitAdapterError({
      code: "unsupported_operation",
      message: `CMP git CLI backend requires git to be installed: ${normalizeError(error, "git unavailable")}.`,
    });
  }
}
