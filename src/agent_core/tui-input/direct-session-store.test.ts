import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  listDirectTuiAgents,
  listDirectTuiSessions,
  loadDirectTuiSessionSnapshot,
  renameDirectTuiAgent,
  saveDirectTuiAgent,
  renameDirectTuiSession,
  resolveDirectTuiSnapshotTurnIndex,
  restoreDirectTuiDialogueTurnsFromSnapshot,
  saveDirectTuiSessionSnapshot,
} from "./direct-session-store.js";

test("direct session store saves, lists, loads, and renames snapshots", () => {
  const home = mkdtempSync(join(tmpdir(), "praxis-direct-session-store-"));
  const oldHome = process.env.RAXCODE_HOME;
  process.env.RAXCODE_HOME = home;

  try {
    saveDirectTuiSessionSnapshot({
      schemaVersion: 1,
      sessionId: "session-1",
      agentId: "agent.core:main",
      name: "session one",
      workspace: "/tmp/workspace",
      route: "https://example.test",
      model: "gpt-5.4",
      createdAt: "2026-04-14T00:00:00.000Z",
      updatedAt: "2026-04-14T00:00:01.000Z",
      compiledInitPreamble: "Project initialization context",
      initArtifactPath: "/tmp/workspace/memory/generated/init-context.md",
      agents: [],
      messages: [
        {
          messageId: "assistant:1",
          kind: "assistant",
          text: "hello",
          createdAt: "2026-04-14T00:00:01.000Z",
          updatedAt: "2026-04-14T00:00:02.000Z",
          capabilityKey: "core.reply",
          title: "Reply",
          errorCode: "none",
          metadata: {
            source: "tool_summary",
          },
        },
      ],
    }, home);

    const listed = listDirectTuiSessions(home);
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.name, "session one");
    assert.equal(listed[0]?.lastAssistantText, "hello");

    const loaded = loadDirectTuiSessionSnapshot("session-1", home);
    assert.equal(loaded?.sessionId, "session-1");
    assert.equal(loaded?.agentId, "agent.core:main");
    assert.equal(loaded?.messages.length, 1);
    assert.equal(loaded?.messages[0]?.updatedAt, "2026-04-14T00:00:02.000Z");
    assert.equal(loaded?.messages[0]?.capabilityKey, "core.reply");
    assert.deepEqual(loaded?.messages[0]?.metadata, { source: "tool_summary" });
    assert.deepEqual(loaded?.agents, []);
    assert.equal(loaded?.compiledInitPreamble, "Project initialization context");
    assert.equal(loaded?.initArtifactPath, "/tmp/workspace/memory/generated/init-context.md");

    renameDirectTuiSession("session-1", "renamed session", home);
    assert.equal(listDirectTuiSessions(home)[0]?.name, "renamed session");
    assert.equal(loadDirectTuiSessionSnapshot("session-1", home)?.name, "renamed session");
  } finally {
    if (oldHome === undefined) {
      delete process.env.RAXCODE_HOME;
    } else {
      process.env.RAXCODE_HOME = oldHome;
    }
    rmSync(home, { recursive: true, force: true });
  }
});

test("direct session store reads legacy snapshots with agentLabels and no agents", () => {
  const home = mkdtempSync(join(tmpdir(), "praxis-direct-session-store-legacy-"));
  const oldHome = process.env.RAXCODE_HOME;
  process.env.RAXCODE_HOME = home;

  try {
    const sessionsDir = join(home, "sessions");
    mkdirSync(sessionsDir, { recursive: true });
    writeFileSync(join(sessionsDir, "direct-tui-index.json"), `${JSON.stringify({
      schemaVersion: 1,
      sessions: [{
        sessionId: "legacy-session",
        name: "legacy",
        workspace: "/tmp/workspace",
        route: "https://example.test",
        model: "gpt-5.4",
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:01.000Z",
        messageCount: 0,
      }],
    }, null, 2)}\n`, "utf8");
    writeFileSync(join(sessionsDir, "legacy-session.json"), `${JSON.stringify({
      schemaVersion: 1,
      sessionId: "legacy-session",
      agentId: "agent.core:legacy-session",
      name: "legacy",
      workspace: "/tmp/workspace",
      route: "https://example.test",
      model: "gpt-5.4",
      createdAt: "2026-04-14T00:00:00.000Z",
      updatedAt: "2026-04-14T00:00:01.000Z",
      selectedAgentId: "agent.core:legacy-session",
      agentLabels: {
        "agent.core:legacy-session": "legacy core",
      },
      messages: [],
    }, null, 2)}\n`, "utf8");

    const loaded = loadDirectTuiSessionSnapshot("legacy-session", home);
    assert.equal(loaded?.agentId, "agent.core:legacy-session");
    assert.equal(loaded?.selectedAgentId, "agent.core:legacy-session");
    assert.deepEqual(loaded?.agents, []);
    assert.deepEqual(loaded?.agentLabels, {
      "agent.core:legacy-session": "legacy core",
    });
  } finally {
    if (oldHome === undefined) {
      delete process.env.RAXCODE_HOME;
    } else {
      process.env.RAXCODE_HOME = oldHome;
    }
    rmSync(home, { recursive: true, force: true });
  }
});

test("direct agent registry saves, lists, and renames agents", () => {
  const home = mkdtempSync(join(tmpdir(), "praxis-direct-agent-store-"));
  const oldHome = process.env.RAXCODE_HOME;
  process.env.RAXCODE_HOME = home;

  try {
    saveDirectTuiAgent({
      agentId: "agent.core:main",
      name: "core",
      kind: "core",
      status: "idle",
      summary: "current direct shell agent",
      workspace: "/tmp/workspace",
      createdAt: "2026-04-14T00:00:00.000Z",
      updatedAt: "2026-04-14T00:00:01.000Z",
      lastSessionId: "session-1",
    }, home);

    assert.equal(listDirectTuiAgents(home)[0]?.name, "core");
    renameDirectTuiAgent("agent.core:main", "renamed core", home);
    assert.equal(listDirectTuiAgents(home)[0]?.name, "renamed core");
  } finally {
    if (oldHome === undefined) {
      delete process.env.RAXCODE_HOME;
    } else {
      process.env.RAXCODE_HOME = oldHome;
    }
    rmSync(home, { recursive: true, force: true });
  }
});

test("direct session snapshot restore helpers recover dialogue turns and turn index", () => {
  const snapshot = {
    schemaVersion: 1 as const,
    sessionId: "session-restore",
    agentId: "agent.core:main",
    name: "restore target",
    workspace: "/tmp/workspace",
    route: "https://example.test",
    model: "gpt-5.4",
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:03.000Z",
    agents: [],
    messages: [
      {
        messageId: "status:1",
        kind: "status",
        text: "warming up",
        createdAt: "2026-04-14T00:00:00.000Z",
      },
      {
        messageId: "user:turn-1",
        kind: "user",
        text: "你好",
        createdAt: "2026-04-14T00:00:01.000Z",
        turnId: "turn-1",
      },
      {
        messageId: "assistant:turn-1:1",
        kind: "assistant",
        text: "你好，有什么我可以帮你的？",
        createdAt: "2026-04-14T00:00:02.000Z",
        turnId: "turn-1",
      },
      {
        messageId: "user:turn-2",
        kind: "user",
        text: "继续帮我搜索",
        createdAt: "2026-04-14T00:00:03.000Z",
        turnId: "turn-2",
      },
    ],
  };

  assert.deepEqual(restoreDirectTuiDialogueTurnsFromSnapshot(snapshot), [
    { role: "user", text: "你好" },
    { role: "assistant", text: "你好，有什么我可以帮你的？" },
    { role: "user", text: "继续帮我搜索" },
  ]);
  assert.equal(resolveDirectTuiSnapshotTurnIndex(snapshot), 2);
});
