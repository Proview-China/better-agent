import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  restoreWorkspaceGitCheckpoint,
  writeWorkspaceGitCheckpoint,
} from "./workspace-git-checkpoint.js";

function runGit(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
  }).trim();
}

test("workspace git checkpoint writes a shadow snapshot and restores workspace files", async () => {
  const home = mkdtempSync(join(tmpdir(), "praxis-workspace-checkpoint-home-"));
  const workspace = mkdtempSync(join(tmpdir(), "praxis-workspace-checkpoint-workspace-"));
  const oldHome = process.env.RAXCODE_HOME;
  process.env.RAXCODE_HOME = home;

  try {
    mkdirSync(join(workspace, "src"), { recursive: true });
    mkdirSync(join(workspace, ".raxode", "rewind"), { recursive: true });
    writeFileSync(join(workspace, "src", "main.ts"), "export const value = 1;\n", "utf8");
    writeFileSync(join(workspace, "README.md"), "# first\n", "utf8");
    writeFileSync(join(workspace, ".raxode", "rewind", "ignore.txt"), "ignore me\n", "utf8");

    const first = await writeWorkspaceGitCheckpoint({
      sessionId: "session-1",
      turnId: "1",
      workspaceRoot: workspace,
      agentId: "agent.core:main",
    });
    assert.match(first.checkpointRef, /^refs\/sessions\/session-1\/turns\//u);
    assert.equal(first.fileCount, 2);
    assert.equal(existsSync(join(workspace, ".raxode", "rewind", "checkpoints")), true);

    writeFileSync(join(workspace, "src", "main.ts"), "export const value = 2;\n", "utf8");
    writeFileSync(join(workspace, "notes.txt"), "scratch\n", "utf8");

    const second = await writeWorkspaceGitCheckpoint({
      sessionId: "session-1",
      turnId: "2",
      workspaceRoot: workspace,
      agentId: "agent.core:main",
    });
    assert.notEqual(second.commitSha, first.commitSha);

    const restored = await restoreWorkspaceGitCheckpoint({
      sessionId: "session-1",
      workspaceRoot: workspace,
      checkpointRef: first.checkpointRef,
      agentId: "agent.core:main",
    });
    assert.equal(restored.commitSha, first.commitSha);
    assert.equal(readFileSync(join(workspace, "src", "main.ts"), "utf8"), "export const value = 1;\n");
    assert.equal(readFileSync(join(workspace, "README.md"), "utf8"), "# first\n");
    assert.equal(existsSync(join(workspace, "notes.txt")), false);
  } finally {
    if (oldHome === undefined) {
      delete process.env.RAXCODE_HOME;
    } else {
      process.env.RAXCODE_HOME = oldHome;
    }
    rmSync(home, { recursive: true, force: true });
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("workspace git checkpoint skips nested cmp worktree directories and gitlink-style entries", async () => {
  const home = mkdtempSync(join(tmpdir(), "praxis-workspace-checkpoint-home-"));
  const workspace = mkdtempSync(join(tmpdir(), "praxis-workspace-checkpoint-workspace-"));
  const oldHome = process.env.RAXCODE_HOME;
  process.env.RAXCODE_HOME = home;

  try {
    runGit(workspace, ["init", "--initial-branch", "main"]);
    runGit(workspace, ["config", "user.name", "Test User"]);
    runGit(workspace, ["config", "user.email", "test@example.com"]);
    writeFileSync(join(workspace, "tracked.txt"), "hello\n", "utf8");
    runGit(workspace, ["add", "tracked.txt"]);
    runGit(workspace, ["commit", "-m", "init"]);

    const nestedWorktree = join(workspace, ".cmp-worktrees", "cmp__child");
    mkdirSync(nestedWorktree, { recursive: true });
    runGit(nestedWorktree, ["init", "--initial-branch", "main"]);
    runGit(nestedWorktree, ["config", "user.name", "Nested User"]);
    runGit(nestedWorktree, ["config", "user.email", "nested@example.com"]);
    writeFileSync(join(nestedWorktree, "child.txt"), "child\n", "utf8");
    runGit(nestedWorktree, ["add", "child.txt"]);
    runGit(nestedWorktree, ["commit", "-m", "child init"]);

    const nestedHead = runGit(nestedWorktree, ["rev-parse", "HEAD"]);
    runGit(workspace, ["update-index", "--add", "--cacheinfo", `160000,${nestedHead},.cmp-worktrees/cmp__child`]);

    const checkpoint = await writeWorkspaceGitCheckpoint({
      sessionId: "session-2",
      turnId: "1",
      workspaceRoot: workspace,
      agentId: "agent.core:main",
    });

    assert.equal(checkpoint.fileCount, 1);
    assert.match(checkpoint.checkpointRef, /^refs\/sessions\/session-2\/turns\//u);
  } finally {
    if (oldHome === undefined) {
      delete process.env.RAXCODE_HOME;
    } else {
      process.env.RAXCODE_HOME = oldHome;
    }
    rmSync(home, { recursive: true, force: true });
    rmSync(workspace, { recursive: true, force: true });
  }
});
