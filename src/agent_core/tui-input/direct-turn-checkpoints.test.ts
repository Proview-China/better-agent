import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

import {
  getDirectTuiTurnCheckpoint,
  listDirectTuiTurnCheckpoints,
  upsertDirectTuiTurnCheckpoint,
} from "./direct-turn-checkpoints.js";

test("direct turn checkpoints save, list, and replace records by turn id", () => {
  const home = mkdtempSync(join(tmpdir(), "praxis-direct-turn-checkpoints-"));
  const workspaceRoot = join(home, "workspace");
  const oldHome = process.env.RAXCODE_HOME;
  process.env.RAXCODE_HOME = home;

  try {
    rmSync(workspaceRoot, { recursive: true, force: true });
    upsertDirectTuiTurnCheckpoint("session-1", {
      sessionId: "session-1",
      agentId: "agent.core:main",
      turnId: "1",
      turnIndex: 1,
      messageId: "user:1",
      transcriptCutMessageId: "assistant:1:1",
      createdAt: "2026-04-14T00:00:01.000Z",
      userText: "first",
      workspaceRoot,
      workspaceCheckpointRef: "refs/checkpoints/1",
      workspaceCheckpointCommit: "abc123",
    }, workspaceRoot);
    upsertDirectTuiTurnCheckpoint("session-1", {
      sessionId: "session-1",
      agentId: "agent.core:main",
      turnId: "2",
      turnIndex: 2,
      messageId: "user:2",
      transcriptCutMessageId: "assistant:2:1",
      createdAt: "2026-04-14T00:00:02.000Z",
      userText: "second",
      workspaceRoot,
      workspaceCheckpointError: "snapshot failed",
    }, workspaceRoot);
    upsertDirectTuiTurnCheckpoint("session-1", {
      sessionId: "session-1",
      agentId: "agent.core:main",
      turnId: "2",
      turnIndex: 2,
      messageId: "user:2",
      transcriptCutMessageId: "assistant:2:1",
      createdAt: "2026-04-14T00:00:02.000Z",
      userText: "second updated",
      workspaceRoot,
      workspaceCheckpointRef: "refs/checkpoints/2",
      workspaceCheckpointCommit: "def456",
    }, workspaceRoot);

    const listed = listDirectTuiTurnCheckpoints("session-1", workspaceRoot);
    assert.equal(listed.length, 2);
    assert.equal(listed[0]?.turnId, "1");
    assert.equal(listed[1]?.userText, "second updated");
    assert.equal(getDirectTuiTurnCheckpoint("session-1", "2", workspaceRoot)?.workspaceCheckpointCommit, "def456");
  } finally {
    if (oldHome === undefined) {
      delete process.env.RAXCODE_HOME;
    } else {
      process.env.RAXCODE_HOME = oldHome;
    }
    rmSync(home, { recursive: true, force: true });
  }
});
