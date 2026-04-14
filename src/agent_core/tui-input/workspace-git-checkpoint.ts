import { execFile as execFileCallback } from "node:child_process";
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import { createCmpGitBranchFamily } from "../cmp-git/cmp-git-types.js";
import { ensureWorkspaceRewindDir } from "./workspace-raxode-store.js";

const execFile = promisify(execFileCallback);
const DEFAULT_CHECKPOINT_BRANCH = "main";
const DEFAULT_GIT_USER_NAME = "Praxis Direct TUI";
const DEFAULT_GIT_USER_EMAIL = "direct-tui@praxis.local";
const COMMIT_TRAILER = "Co-authored-by: Codex <noreply@openai.com>";
const INTERNAL_WORKTREE_PREFIX = ".cmp-worktrees/";
const INTERNAL_RAXODE_PREFIX = ".raxode/";

export interface WorkspaceGitCheckpointWriteResult {
  checkpointRef: string;
  commitSha: string;
  fileCount: number;
  reusedHead: boolean;
}

export interface WorkspaceGitCheckpointRestoreResult {
  checkpointRef: string;
  commitSha: string;
  restoredFileCount: number;
  removedFileCount: number;
}

async function runGit(params: {
  cwd: string;
  args: string[];
  allowFailure?: boolean;
  encoding?: "utf8" | "buffer";
}): Promise<{
  stdout: string | Buffer;
  stderr: string | Buffer;
  exitCode: number;
}> {
  const encoding = params.encoding ?? "utf8";
  try {
    const result = await execFile("git", params.args, {
      cwd: params.cwd,
      encoding,
      maxBuffer: 64 * 1024 * 1024,
    });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: 0,
    };
  } catch (error) {
    const execError = error as NodeJS.ErrnoException & {
      stdout?: string | Buffer;
      stderr?: string | Buffer;
      code?: number | string;
    };
    if (params.allowFailure) {
      return {
        stdout: execError.stdout ?? (encoding === "buffer" ? Buffer.alloc(0) : ""),
        stderr: execError.stderr ?? (encoding === "buffer" ? Buffer.alloc(0) : ""),
        exitCode: typeof execError.code === "number" ? execError.code : 1,
      };
    }
    const stderr = typeof execError.stderr === "string"
      ? execError.stderr.trim()
      : execError.stderr?.toString("utf8").trim();
    throw new Error(stderr || execError.message);
  }
}

function sanitizePathSegment(value: string): string {
  return encodeURIComponent(value).replace(/%/gu, "_");
}

function resolveShadowRepoPath(params: {
  workspaceRoot: string;
  agentId: string;
}): string {
  const branchFamily = createCmpGitBranchFamily(params.agentId);
  return join(
    ensureWorkspaceRewindDir(params.workspaceRoot),
    "checkpoints",
    sanitizePathSegment(branchFamily.agentId),
    "repo",
  );
}

function isExecutableMode(mode: string): boolean {
  return mode === "100755";
}

async function ensureShadowRepo(repoPath: string): Promise<void> {
  await mkdir(repoPath, { recursive: true });
  const gitDir = join(repoPath, ".git");
  try {
    const gitStat = await stat(gitDir);
    if (gitStat.isDirectory()) {
      return;
    }
  } catch {
    // fall through
  }
  await runGit({
    cwd: repoPath,
    args: ["init", "--initial-branch", DEFAULT_CHECKPOINT_BRANCH],
  });
  await runGit({
    cwd: repoPath,
    args: ["config", "user.name", DEFAULT_GIT_USER_NAME],
  });
  await runGit({
    cwd: repoPath,
    args: ["config", "user.email", DEFAULT_GIT_USER_EMAIL],
  });
}

async function listRecursiveFiles(rootPath: string): Promise<string[]> {
  const entries = await readdir(rootPath, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    if (entry.name === ".git") {
      return [];
    }
    const absolutePath = join(rootPath, entry.name);
    if (entry.isDirectory()) {
      const children = await listRecursiveFiles(absolutePath);
      return children.map((child) => join(entry.name, child));
    }
    if (entry.isFile()) {
      return [entry.name];
    }
    return [];
  }));
  return nested.flat().sort();
}

async function listWorkspaceFiles(workspaceRoot: string): Promise<string[]> {
  const gitCheck = await runGit({
    cwd: workspaceRoot,
    args: ["rev-parse", "--is-inside-work-tree"],
    allowFailure: true,
  });
  if (gitCheck.exitCode === 0) {
    const listed = await runGit({
      cwd: workspaceRoot,
      args: ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
      encoding: "buffer",
    });
    return (listed.stdout as Buffer)
      .toString("utf8")
      .split("\u0000")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .sort();
  }
  return listRecursiveFiles(workspaceRoot);
}

function shouldExcludeWorkspacePath(relativePath: string): boolean {
  return relativePath === ".cmp-worktrees"
    || relativePath.startsWith(INTERNAL_WORKTREE_PREFIX)
    || relativePath === ".raxode"
    || relativePath.startsWith(INTERNAL_RAXODE_PREFIX);
}

async function filterWorkspaceRegularFiles(params: {
  workspaceRoot: string;
  candidates: string[];
}): Promise<string[]> {
  const regularFiles: string[] = [];
  for (const relativePath of params.candidates) {
    if (!relativePath || shouldExcludeWorkspacePath(relativePath)) {
      continue;
    }
    const sourcePath = join(params.workspaceRoot, relativePath);
    let sourceStat;
    try {
      sourceStat = await lstat(sourcePath);
    } catch {
      continue;
    }
    if (!sourceStat.isFile()) {
      continue;
    }
    regularFiles.push(relativePath);
  }
  return regularFiles.sort();
}

async function removeEmptyDirectories(rootPath: string): Promise<void> {
  const entries = await readdir(rootPath, { withFileTypes: true });
  await Promise.all(entries.map(async (entry) => {
    if (!entry.isDirectory() || entry.name === ".git") {
      return;
    }
    const absolutePath = join(rootPath, entry.name);
    await removeEmptyDirectories(absolutePath);
    const remaining = await readdir(absolutePath);
    if (remaining.length === 0) {
      await rm(absolutePath, { recursive: true, force: true });
    }
  }));
}

async function syncWorkspaceIntoShadowRepo(params: {
  workspaceRoot: string;
  repoPath: string;
  workspaceFiles: string[];
}): Promise<void> {
  const existingFiles = await listRecursiveFiles(params.repoPath);
  const sourceSet = new Set(params.workspaceFiles);

  await Promise.all(existingFiles
    .filter((relativePath) => !sourceSet.has(relativePath))
    .map((relativePath) => rm(join(params.repoPath, relativePath), { force: true })));

  await Promise.all(params.workspaceFiles.map(async (relativePath) => {
    const sourcePath = join(params.workspaceRoot, relativePath);
    const destinationPath = join(params.repoPath, relativePath);
    await mkdir(dirname(destinationPath), { recursive: true });
    await copyFile(sourcePath, destinationPath);
  }));

  await removeEmptyDirectories(params.repoPath);
}

function buildCheckpointCommitMessage(turnId: string): string {
  return `direct tui checkpoint ${turnId}\n\n${COMMIT_TRAILER}`;
}

async function readTreeEntries(repoPath: string, ref: string): Promise<Array<{
  mode: string;
  path: string;
}>> {
  const listed = await runGit({
    cwd: repoPath,
    args: ["ls-tree", "-r", "-z", "--full-tree", ref],
    encoding: "buffer",
  });
  return (listed.stdout as Buffer)
    .toString("utf8")
    .split("\u0000")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const [meta, filePath] = entry.split("\t");
      const [mode] = meta.split(/\s+/u);
      return {
        mode,
        path: filePath ?? "",
      };
    })
    .filter((entry) => entry.path.length > 0);
}

export async function writeWorkspaceGitCheckpoint(params: {
  sessionId: string;
  turnId: string;
  workspaceRoot: string;
  agentId: string;
}): Promise<WorkspaceGitCheckpointWriteResult> {
  const repoPath = resolveShadowRepoPath({
    workspaceRoot: params.workspaceRoot,
    agentId: params.agentId,
  });
  await ensureShadowRepo(repoPath);
  const workspaceFiles = await filterWorkspaceRegularFiles({
    workspaceRoot: params.workspaceRoot,
    candidates: await listWorkspaceFiles(params.workspaceRoot),
  });
  await syncWorkspaceIntoShadowRepo({
    workspaceRoot: params.workspaceRoot,
    repoPath,
    workspaceFiles,
  });
  await runGit({
    cwd: repoPath,
    args: ["add", "-A"],
  });

  const status = await runGit({
    cwd: repoPath,
    args: ["status", "--porcelain"],
  });
  const hasChanges = typeof status.stdout === "string" && status.stdout.trim().length > 0;
  const head = await runGit({
    cwd: repoPath,
    args: ["rev-parse", "--verify", "HEAD"],
    allowFailure: true,
  });
  const hasHead = head.exitCode === 0 && typeof head.stdout === "string" && head.stdout.trim().length > 0;

  if (!hasHead || hasChanges) {
    await runGit({
      cwd: repoPath,
      args: ["commit", "--allow-empty", "-m", buildCheckpointCommitMessage(params.turnId)],
    });
  }

  const commit = await runGit({
    cwd: repoPath,
    args: ["rev-parse", "--verify", "HEAD"],
  });
  const commitSha = String(commit.stdout).trim();
  const checkpointRef = `refs/sessions/${sanitizePathSegment(params.sessionId)}/turns/${sanitizePathSegment(params.turnId)}`;
  await runGit({
    cwd: repoPath,
    args: ["update-ref", checkpointRef, commitSha],
  });
  return {
    checkpointRef,
    commitSha,
    fileCount: workspaceFiles.length,
    reusedHead: hasHead && !hasChanges,
  };
}

export async function restoreWorkspaceGitCheckpoint(params: {
  sessionId: string;
  workspaceRoot: string;
  checkpointRef: string;
  agentId: string;
}): Promise<WorkspaceGitCheckpointRestoreResult> {
  const repoPath = resolveShadowRepoPath({
    workspaceRoot: params.workspaceRoot,
    agentId: params.agentId,
  });
  await ensureShadowRepo(repoPath);
  const commit = await runGit({
    cwd: repoPath,
    args: ["rev-parse", "--verify", params.checkpointRef],
  });
  const commitSha = String(commit.stdout).trim();
  const targetEntries = await readTreeEntries(repoPath, commitSha);
  const targetFileSet = new Set(targetEntries.map((entry) => entry.path));
  const currentFiles = await filterWorkspaceRegularFiles({
    workspaceRoot: params.workspaceRoot,
    candidates: await listWorkspaceFiles(params.workspaceRoot),
  });

  const filesToRemove = currentFiles.filter((relativePath) => !targetFileSet.has(relativePath));
  await Promise.all(filesToRemove.map((relativePath) =>
    rm(join(params.workspaceRoot, relativePath), { force: true })));

  await Promise.all(targetEntries.map(async (entry) => {
    const blob = await runGit({
      cwd: repoPath,
      args: ["cat-file", "blob", `${commitSha}:${entry.path}`],
      encoding: "buffer",
    });
    const destinationPath = join(params.workspaceRoot, entry.path);
    await mkdir(dirname(destinationPath), { recursive: true });
    await writeFile(destinationPath, blob.stdout as Buffer);
    await chmod(destinationPath, isExecutableMode(entry.mode) ? 0o755 : 0o644);
  }));

  await removeEmptyDirectories(params.workspaceRoot);
  return {
    checkpointRef: params.checkpointRef,
    commitSha,
    restoredFileCount: targetEntries.length,
    removedFileCount: filesToRemove.length,
  };
}
