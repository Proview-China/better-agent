import assert from "node:assert/strict";
import test from "node:test";

import type { LiveCliState } from "../live-agent-chat/shared.js";
import {
  createPanelsFromLiveCliState,
  createSurfaceStateSeedFromLiveCliState,
  mapLiveLogRecordToSurfaceMessages,
  mapLiveLogRecordToSurfaceTasks,
  mapTranscriptToSurfaceMessages,
} from "./live-chat-adapter.js";

test("transcript adapter maps dialogue turns to surface messages", () => {
  const messages = mapTranscriptToSurfaceMessages("session-1", [
    { role: "user", text: "你好" },
    { role: "assistant", text: "你好，我是 Praxis。" },
  ]);

  assert.equal(messages.length, 2);
  assert.equal(messages[0]?.kind, "user");
  assert.equal(messages[1]?.kind, "assistant");
});

test("live log adapter maps turn results and stages into messages and tasks", () => {
  const taskRecords = mapLiveLogRecordToSurfaceTasks({
    ts: "2026-04-11T00:00:00.000Z",
    event: "stage_start",
    stage: "core/capability_bridge",
    capabilityKey: "search.ground",
    inputSummary: "search docs",
  });
  assert.equal(taskRecords.length, 1);
  assert.equal(taskRecords[0]?.kind, "capability_run");

  const assistantMessages = mapLiveLogRecordToSurfaceMessages({
    ts: "2026-04-11T00:00:01.000Z",
    event: "turn_result",
    turnIndex: 1,
    core: {
      answer: "最终回答",
      capabilityKey: "search.ground",
      capabilityResultStatus: "success",
    },
  });
  assert.equal(assistantMessages.length, 1);
  assert.equal(assistantMessages[0]?.kind, "assistant");
  assert.equal(assistantMessages[0]?.text, "最终回答");
});

test("live log adapter decodes escaped turn_result answers for assistant messages", () => {
  const assistantMessages = mapLiveLogRecordToSurfaceMessages({
    ts: "2026-04-11T00:00:01.000Z",
    event: "turn_result",
    turnIndex: 2,
    core: {
      answer: "第一段\\n\\n第二段\\u4f60\\u597d",
      capabilityResultStatus: "success",
    },
  });

  assert.equal(assistantMessages.length, 1);
  assert.equal(assistantMessages[0]?.text, "第一段\n\n第二段你好");
});

test("live cli state seed exposes session messages and panels", () => {
  const state = {
    sessionId: "session-1",
    transcript: [
      { role: "user", text: "你好" },
      { role: "assistant", text: "hello" },
    ],
    turnIndex: 2,
    uiMode: "direct",
    runtime: {
      getTapUserSurfaceSnapshot() {
        return {
          visibleMode: "bapr",
          automationDepth: "prefer_auto",
          explanationStyle: "plain_language",
          currentLayer: "runtime",
          pendingHumanGateCount: 0,
          blockingCapabilityKeys: [],
          activeCapabilityKeys: [],
          canToggleMode: true,
          canToggleAutomationDepth: true,
          canOverrideToolPolicy: true,
          summary: "tap ready",
        };
      },
    },
    logger: { path: "/tmp/log.jsonl" },
    lastTurn: undefined,
    pendingCmpSync: undefined,
  } as unknown as LiveCliState;

  const seed = createSurfaceStateSeedFromLiveCliState(state);
  const panels = createPanelsFromLiveCliState(state);

  assert.equal(seed.session?.sessionId, "session-1");
  assert.equal(seed.messages.length, 2);
  assert.equal(panels.tap?.summary, "tap ready");
  assert.equal(panels.history?.summaryLines[1], "turns=2");
});
