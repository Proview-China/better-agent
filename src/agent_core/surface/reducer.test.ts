import assert from "node:assert/strict";
import test from "node:test";

import { createSurfaceEvent } from "./events.js";
import {
  applySurfaceEvent,
  createInitialSurfaceState,
  reduceSurfaceEvents,
} from "./reducer.js";
import {
  createSurfaceMessage,
  createSurfaceOverlay,
  createSurfaceSession,
  createSurfaceTask,
  createSurfaceTurn,
} from "./types.js";

test("surface reducer seeds Wave 0 defaults across transcript, task, panel, overlay, and composer layers", () => {
  const state = createInitialSurfaceState();

  assert.equal(state.session, undefined);
  assert.equal(state.messages.length, 0);
  assert.equal(state.tasks.length, 0);
  assert.equal(state.overlays.length, 0);
  assert.equal(state.composer.mode, "prompt");
  assert.equal(state.panels.status?.headline, "Ready");
  assert.equal(state.panels.history?.transcriptSize, 0);
});

test("surface reducer folds turn, message, overlay, and composer events into shared foreground state", () => {
  const state = reduceSurfaceEvents(createInitialSurfaceState(), [
    createSurfaceEvent({
      eventId: "event:session.started:session-1",
      type: "session.started",
      emittedAt: "2026-04-11T08:00:00.000Z",
      at: "2026-04-11T08:00:00.000Z",
      source: "core",
      session: createSurfaceSession({
        sessionId: "session-1",
        startedAt: "2026-04-11T08:00:00.000Z",
        updatedAt: "2026-04-11T08:00:00.000Z",
        uiMode: "direct",
        transcriptMessageIds: [],
        taskIds: [],
      }),
    }),
    createSurfaceEvent({
      eventId: "event:turn.started:turn-1",
      type: "turn.started",
      emittedAt: "2026-04-11T08:00:01.000Z",
      at: "2026-04-11T08:00:01.000Z",
      source: "core",
      turn: createSurfaceTurn({
        turnId: "turn-1",
        id: "turn-1",
        turnIndex: 0,
        status: "running",
        startedAt: "2026-04-11T08:00:01.000Z",
        updatedAt: "2026-04-11T08:00:01.000Z",
        outputMessageIds: [],
        taskIds: [],
      }),
    }),
    createSurfaceEvent({
      eventId: "event:message.appended:msg-user-1",
      type: "message.appended",
      emittedAt: "2026-04-11T08:00:02.000Z",
      at: "2026-04-11T08:00:02.000Z",
      source: "ui",
      message: createSurfaceMessage({
        messageId: "msg-user-1",
        id: "msg-user-1",
        kind: "user",
        createdAt: "2026-04-11T08:00:02.000Z",
        turnId: "turn-1",
        text: "你好",
      }),
    }),
    createSurfaceEvent({
      eventId: "event:message.appended:msg-assistant-1",
      type: "message.appended",
      emittedAt: "2026-04-11T08:00:03.000Z",
      at: "2026-04-11T08:00:03.000Z",
      source: "ui",
      message: createSurfaceMessage({
        messageId: "msg-assistant-1",
        id: "msg-assistant-1",
        kind: "assistant",
        createdAt: "2026-04-11T08:00:03.000Z",
        turnId: "turn-1",
        text: "正在",
      }),
    }),
    createSurfaceEvent({
      eventId: "event:message.delta:msg-assistant-1",
      type: "message.delta",
      emittedAt: "2026-04-11T08:00:04.000Z",
      at: "2026-04-11T08:00:04.000Z",
      source: "ui",
      messageId: "msg-assistant-1",
      textDelta: "处理",
    }),
    createSurfaceEvent({
      eventId: "event:overlay.opened:overlay-search",
      type: "overlay.opened",
      emittedAt: "2026-04-11T08:00:05.000Z",
      at: "2026-04-11T08:00:05.000Z",
      source: "ui",
      overlay: createSurfaceOverlay({
        overlayId: "overlay-search",
        id: "overlay-search",
        kind: "search",
        title: "Search",
        createdAt: "2026-04-11T08:00:05.000Z",
        openedAt: "2026-04-11T08:00:05.000Z",
      }),
    }),
    createSurfaceEvent({
      eventId: "event:composer.updated:080006",
      type: "composer.updated",
      emittedAt: "2026-04-11T08:00:06.000Z",
      at: "2026-04-11T08:00:06.000Z",
      source: "ui",
      composer: {
        value: "下一步做什么",
        disabled: false,
      },
    }),
    createSurfaceEvent({
      eventId: "event:overlay.closed:overlay-search",
      type: "overlay.closed",
      emittedAt: "2026-04-11T08:00:07.000Z",
      at: "2026-04-11T08:00:07.000Z",
      source: "ui",
      overlayId: "overlay-search",
    }),
  ]);

  assert.equal(state.session?.sessionId, "session-1");
  assert.equal(state.currentTurnId, "turn-1");
  assert.equal(state.messages[1]?.text, "正在处理");
  assert.equal(state.turns[0]?.userText, "你好");
  assert.equal(state.turns[0]?.assistantText, "正在处理");
  assert.equal(state.overlays.length, 0);
  assert.equal(state.composer.value, "下一步做什么");
  assert.equal(state.panels.history?.transcriptSize, 2);
  assert.equal(state.panels.debug?.lastEventType, "overlay.closed");
});

test("surface reducer turns task, panel, and error events into stable snapshots", () => {
  let state = createInitialSurfaceState();

  state = applySurfaceEvent(state, createSurfaceEvent({
    eventId: "event:task.upserted:task-browser",
    type: "task.upserted",
    emittedAt: "2026-04-11T08:10:00.000Z",
    at: "2026-04-11T08:10:00.000Z",
    source: "tap",
    task: createSurfaceTask({
      taskId: "task-browser",
      id: "task-browser",
      kind: "capability_run",
      status: "running",
      title: "browser.playwright",
      summary: "Need a headed browser trace.",
      capabilityKey: "browser.playwright",
      startedAt: "2026-04-11T08:10:00.000Z",
      updatedAt: "2026-04-11T08:10:00.000Z",
      foregroundable: true,
      cancellable: true,
    }),
  }));
  state = applySurfaceEvent(state, createSurfaceEvent({
    eventId: "event:task.completed:task-browser",
    type: "task.completed",
    emittedAt: "2026-04-11T08:10:05.000Z",
    at: "2026-04-11T08:10:05.000Z",
    source: "tap",
    task: createSurfaceTask({
      taskId: "task-browser",
      id: "task-browser",
      kind: "capability_run",
      status: "blocked",
      title: "browser.playwright",
      startedAt: "2026-04-11T08:10:00.000Z",
      updatedAt: "2026-04-11T08:10:05.000Z",
    }),
    taskId: "task-browser",
    status: "blocked",
    summary: "Human gate required before continuing.",
  }));
  state = applySurfaceEvent(state, createSurfaceEvent({
    eventId: "event:panel.updated:tap",
    type: "panel.updated",
    emittedAt: "2026-04-11T08:10:06.000Z",
    at: "2026-04-11T08:10:06.000Z",
    source: "tap",
    panel: "tap",
    snapshot: {
      summary: "waiting human approval",
      currentLayer: "reviewer",
      pendingHumanGateCount: 1,
      blockingCapabilityKeys: ["browser.playwright"],
    },
  }));
  state = applySurfaceEvent(state, createSurfaceEvent({
    eventId: "event:error.reported:err-1",
    type: "error.reported",
    emittedAt: "2026-04-11T08:10:07.000Z",
    at: "2026-04-11T08:10:07.000Z",
    source: "system",
    message: createSurfaceMessage({
      messageId: "err-1",
      id: "err-1",
      kind: "error",
      createdAt: "2026-04-11T08:10:07.000Z",
      text: "Permission was denied.",
      status: "warning",
    }),
    error: {
      errorId: "err-1",
      message: "Permission was denied.",
      severity: "warning",
      recoverable: true,
      createdAt: "2026-04-11T08:10:07.000Z",
    },
  }));

  assert.equal(state.tasks[0]?.status, "blocked");
  assert.equal(state.panels.tap?.summary, "waiting human approval");
  assert.equal(state.panels.status?.headline, "1 active task(s)");
  assert.equal(state.panels.debug?.eventCount, 4);
  assert.equal(state.messages.at(-1)?.kind, "error");
});

test("surface reducer keeps current turn focus when an older turn completes late", () => {
  let state = createInitialSurfaceState();

  state = applySurfaceEvent(state, createSurfaceEvent({
    eventId: "event:turn.started:turn-1",
    type: "turn.started",
    emittedAt: "2026-04-13T02:20:00.000Z",
    at: "2026-04-13T02:20:00.000Z",
    source: "core",
    turn: createSurfaceTurn({
      turnId: "turn-1",
      id: "turn-1",
      turnIndex: 0,
      status: "running",
      startedAt: "2026-04-13T02:20:00.000Z",
      updatedAt: "2026-04-13T02:20:00.000Z",
      outputMessageIds: [],
      taskIds: [],
    }),
  }));
  state = applySurfaceEvent(state, createSurfaceEvent({
    eventId: "event:turn.started:turn-2",
    type: "turn.started",
    emittedAt: "2026-04-13T02:20:10.000Z",
    at: "2026-04-13T02:20:10.000Z",
    source: "core",
    turn: createSurfaceTurn({
      turnId: "turn-2",
      id: "turn-2",
      turnIndex: 1,
      status: "running",
      startedAt: "2026-04-13T02:20:10.000Z",
      updatedAt: "2026-04-13T02:20:10.000Z",
      outputMessageIds: [],
      taskIds: [],
    }),
  }));
  state = applySurfaceEvent(state, createSurfaceEvent({
    eventId: "event:turn.completed:turn-1",
    type: "turn.completed",
    emittedAt: "2026-04-13T02:20:20.000Z",
    at: "2026-04-13T02:20:20.000Z",
    source: "core",
    turn: createSurfaceTurn({
      turnId: "turn-1",
      id: "turn-1",
      status: "completed",
      updatedAt: "2026-04-13T02:20:20.000Z",
      completedAt: "2026-04-13T02:20:20.000Z",
    }),
  }));

  assert.equal(state.currentTurnId, "turn-2");
  assert.equal(state.turns.find((turn) => turn.turnId === "turn-1")?.status, "completed");
});

test("surface reducer updates existing assistant messages without duplicating transcript ids", () => {
  const state = reduceSurfaceEvents(createInitialSurfaceState(), [
    createSurfaceEvent({
      eventId: "event:turn.started:turn-dup",
      type: "turn.started",
      emittedAt: "2026-04-13T08:00:00.000Z",
      at: "2026-04-13T08:00:00.000Z",
      source: "core",
      turn: createSurfaceTurn({
        turnId: "turn-dup",
        id: "turn-dup",
        turnIndex: 0,
        status: "running",
        startedAt: "2026-04-13T08:00:00.000Z",
        updatedAt: "2026-04-13T08:00:00.000Z",
        outputMessageIds: [],
        taskIds: [],
      }),
    }),
    createSurfaceEvent({
      eventId: "event:message.appended:assistant-dup",
      type: "message.appended",
      emittedAt: "2026-04-13T08:00:01.000Z",
      at: "2026-04-13T08:00:01.000Z",
      source: "ui",
      message: createSurfaceMessage({
        messageId: "assistant:turn-dup:1",
        id: "assistant:turn-dup:1",
        turnId: "turn-dup",
        kind: "assistant",
        text: "第一版",
        createdAt: "2026-04-13T08:00:01.000Z",
      }),
    }),
    createSurfaceEvent({
      eventId: "event:message.updated:assistant-dup",
      type: "message.updated",
      emittedAt: "2026-04-13T08:00:02.000Z",
      at: "2026-04-13T08:00:02.000Z",
      source: "ui",
      message: createSurfaceMessage({
        messageId: "assistant:turn-dup:1",
        id: "assistant:turn-dup:1",
        turnId: "turn-dup",
        kind: "assistant",
        text: "最终版",
        createdAt: "2026-04-13T08:00:01.000Z",
        updatedAt: "2026-04-13T08:00:02.000Z",
      }),
    }),
  ]);

  assert.equal(state.messages.length, 1);
  assert.equal(state.messages[0]?.text, "最终版");
  assert.deepEqual(state.turns[0]?.outputMessageIds, ["assistant:turn-dup:1"]);
});
