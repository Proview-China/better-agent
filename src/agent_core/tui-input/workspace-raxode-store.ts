import { execFile as execFileCallback } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

import { createCmpGitBranchFamily } from "../cmp-git/cmp-git-types.js";
import {
  resolveWorkspaceRaxodeAgentsDir,
  resolveWorkspaceRaxodeRewindDir,
  resolveWorkspaceRaxodeRoot,
} from "../../runtime-paths.js";

const execFile = promisify(execFileCallback);

export interface WorkspaceRaxodeGitReadback {
  repoRootPath?: string;
  currentBranchName?: string;
  headCommitSha?: string;
  worktreeRootPath?: string;
  cmpWorktreePath?: string;
  checkedRefName: string;
  promotedRefName: string;
  checkedCommitSha?: string;
  promotedCommitSha?: string;
  branchFamily: {
    agentId: string;
    workBranchName: string;
    cmpBranchName: string;
    mpBranchName: string;
    tapBranchName: string;
  };
}

export interface WorkspaceRaxodeAgentRecord {
  agentId: string;
  workspaceRoot: string;
  currentSessionId?: string;
  parentAgentId?: string;
  depth: number;
  createdAt: string;
  updatedAt: string;
  git: WorkspaceRaxodeGitReadback;
}

async function runGit(params: {
  cwd: string;
  args: string[];
  allowFailure?: boolean;
}): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  try {
    const result = await execFile("git", params.args, {
      cwd: params.cwd,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
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
    if (params.allowFailure) {
      return {
        stdout: execError.stdout?.trim() ?? "",
        stderr: execError.stderr?.trim() ?? "",
        exitCode: typeof execError.code === "number" ? execError.code : 1,
      };
    }
    throw new Error(execError.stderr?.trim() || execError.message);
  }
}

function sanitizePathSegment(value: string): string {
  return encodeURIComponent(value).replace(/%/gu, "_");
}

function ensureWorkspaceRaxodeRoot(workspaceRoot: string): string {
  const directory = resolveWorkspaceRaxodeRoot(workspaceRoot);
  mkdirSync(directory, { recursive: true });
  return directory;
}

function ensureWorkspaceAgentsDir(workspaceRoot: string): string {
  ensureWorkspaceRaxodeRoot(workspaceRoot);
  const directory = resolveWorkspaceRaxodeAgentsDir(workspaceRoot);
  mkdirSync(directory, { recursive: true });
  return directory;
}

function agentPath(workspaceRoot: string, agentId: string): string {
  return join(ensureWorkspaceAgentsDir(workspaceRoot), `${sanitizePathSegment(agentId)}.json`);
}

export function ensureWorkspaceRewindDir(workspaceRoot: string): string {
  ensureWorkspaceRaxodeRoot(workspaceRoot);
  const directory = resolveWorkspaceRaxodeRewindDir(workspaceRoot);
  mkdirSync(directory, { recursive: true });
  return directory;
}

export async function readWorkspaceRaxodeGitReadback(params: {
  workspaceRoot: string;
  agentId: string;
}): Promise<WorkspaceRaxodeGitReadback> {
  const branchFamily = createCmpGitBranchFamily(params.agentId);
  const checkedRefName = `refs/praxis/cmp/checked/${branchFamily.agentId}`;
  const promotedRefName = `refs/praxis/cmp/promoted/${branchFamily.agentId}`;
  const repoRoot = await runGit({
    cwd: params.workspaceRoot,
    args: ["rev-parse", "--show-toplevel"],
    allowFailure: true,
  });
  const repoRootPath = repoRoot.exitCode === 0 && repoRoot.stdout ? repoRoot.stdout : undefined;
  const currentBranch = repoRootPath
    ? await runGit({
      cwd: repoRootPath,
      args: ["symbolic-ref", "--short", "HEAD"],
      allowFailure: true,
    })
    : { stdout: "", stderr: "", exitCode: 1 };
  const headCommit = repoRootPath
    ? await runGit({
      cwd: repoRootPath,
      args: ["rev-parse", "--verify", "HEAD"],
      allowFailure: true,
    })
    : { stdout: "", stderr: "", exitCode: 1 };
  const checkedCommit = repoRootPath
    ? await runGit({
      cwd: repoRootPath,
      args: ["rev-parse", "--verify", checkedRefName],
      allowFailure: true,
    })
    : { stdout: "", stderr: "", exitCode: 1 };
  const promotedCommit = repoRootPath
    ? await runGit({
      cwd: repoRootPath,
      args: ["rev-parse", "--verify", promotedRefName],
      allowFailure: true,
    })
    : { stdout: "", stderr: "", exitCode: 1 };
  const worktreeRootPath = repoRootPath ? `${repoRootPath}/.cmp-worktrees` : undefined;

  return {
    repoRootPath,
    currentBranchName: currentBranch.exitCode === 0 && currentBranch.stdout ? currentBranch.stdout : undefined,
    headCommitSha: headCommit.exitCode === 0 && headCommit.stdout ? headCommit.stdout : undefined,
    worktreeRootPath,
    cmpWorktreePath: worktreeRootPath
      ? `${worktreeRootPath}/${branchFamily.cmp.branchName.replaceAll("/", "__")}`
      : undefined,
    checkedRefName,
    promotedRefName,
    checkedCommitSha: checkedCommit.exitCode === 0 && checkedCommit.stdout ? checkedCommit.stdout : undefined,
    promotedCommitSha: promotedCommit.exitCode === 0 && promotedCommit.stdout ? promotedCommit.stdout : undefined,
    branchFamily: {
      agentId: branchFamily.agentId,
      workBranchName: branchFamily.work.branchName,
      cmpBranchName: branchFamily.cmp.branchName,
      mpBranchName: branchFamily.mp.branchName,
      tapBranchName: branchFamily.tap.branchName,
    },
  };
}

export function loadWorkspaceRaxodeAgent(
  workspaceRoot: string,
  agentId: string,
): WorkspaceRaxodeAgentRecord | null {
  const filePath = agentPath(workspaceRoot, agentId);
  if (!existsSync(filePath)) {
    return null;
  }
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Partial<WorkspaceRaxodeAgentRecord>;
  if (!parsed || typeof parsed !== "object" || typeof parsed.agentId !== "string" || typeof parsed.workspaceRoot !== "string") {
    return null;
  }
  return {
    agentId: parsed.agentId,
    workspaceRoot: parsed.workspaceRoot,
    currentSessionId: typeof parsed.currentSessionId === "string" ? parsed.currentSessionId : undefined,
    parentAgentId: typeof parsed.parentAgentId === "string" ? parsed.parentAgentId : undefined,
    depth: typeof parsed.depth === "number" ? parsed.depth : 0,
    createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    git: parsed.git as WorkspaceRaxodeGitReadback,
  };
}

export function upsertWorkspaceRaxodeAgent(
  record: WorkspaceRaxodeAgentRecord,
): void {
  const existing = loadWorkspaceRaxodeAgent(record.workspaceRoot, record.agentId);
  writeFileSync(
    agentPath(record.workspaceRoot, record.agentId),
    `${JSON.stringify({
      ...record,
      createdAt: existing?.createdAt ?? record.createdAt,
      updatedAt: record.updatedAt,
    }, null, 2)}\n`,
    "utf8",
  );
}
