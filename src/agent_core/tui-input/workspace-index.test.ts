import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  loadWorkspaceIndex,
  searchWorkspaceDirectories,
  searchWorkspaceFiles,
  type WorkspaceIndexSnapshot,
} from "./workspace-index.js";

const FIXTURE: WorkspaceIndexSnapshot = {
  root: "/tmp/repo",
  files: [
    "README.md",
    "src/agent_core/direct-tui.tsx",
    "src/agent_core/live-agent-chat.ts",
    "src/agent_core/tui-input/slash-engine.ts",
    "docs/ability/68-praxis-work-mode-report-for-tui-gui.md",
  ],
  directories: [
    ".",
    "docs",
    "docs/ability",
    "src",
    "src/agent_core",
    "src/agent_core/tui-input",
  ],
  fileStatus: "ready",
  directoryStatus: "ready",
  fileError: null,
};

test("searchWorkspaceFiles prefers basename and prefix matches", () => {
  const results = searchWorkspaceFiles(FIXTURE, "direct", 5);
  assert.equal(results[0]?.path, "src/agent_core/direct-tui.tsx");
});

test("searchWorkspaceDirectories returns directory-only matches", () => {
  const results = searchWorkspaceDirectories(FIXTURE, "agent", 5);
  assert.deepEqual(results.map((entry) => entry.path), [
    "src/agent_core",
    "src/agent_core/tui-input",
  ]);
});

test("empty workspace queries prefer shallow entries first", () => {
  const results = searchWorkspaceFiles(FIXTURE, "", 3);
  assert.deepEqual(results.map((entry) => entry.path), [
    "README.md",
    "src/agent_core/direct-tui.tsx",
    "src/agent_core/live-agent-chat.ts",
  ]);
});

test("searchWorkspaceFiles never returns the workspace root placeholder", () => {
  const snapshot: WorkspaceIndexSnapshot = {
    ...FIXTURE,
    files: [".", ...FIXTURE.files],
  };
  const results = searchWorkspaceFiles(snapshot, "", 5);
  assert.ok(results.every((entry) => entry.path !== "."));
});

test("loadWorkspaceIndex includes empty directories without deriving them from files", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "praxis-workspace-index-"));
  await mkdir(path.join(rootDir, "empty-dir"), { recursive: true });
  await mkdir(path.join(rootDir, "nested", "child"), { recursive: true });
  await mkdir(path.join(rootDir, "src"), { recursive: true });
  await writeFile(path.join(rootDir, "src", "main.ts"), "export {};\n", "utf8");

  const snapshot = await loadWorkspaceIndex(rootDir);

  assert.equal(snapshot.fileStatus === "ready" || snapshot.fileStatus === "truncated", true);
  assert.equal(snapshot.directoryStatus === "ready" || snapshot.directoryStatus === "truncated", true);
  assert.equal(snapshot.fileError, null);
  assert.ok(snapshot.directories.includes("."));
  assert.ok(snapshot.directories.includes("empty-dir"));
  assert.ok(snapshot.directories.includes("nested"));
  assert.ok(snapshot.directories.includes("nested/child"));
  assert.ok(snapshot.files.includes("src/main.ts"));
});
