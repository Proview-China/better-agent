import assert from "node:assert/strict";
import test from "node:test";

import { createSurfaceEvent } from "./events.js";
import { createInitialSurfaceState, reduceSurfaceEvents } from "./reducer.js";
import {
  selectActiveTasks,
  selectCurrentTurn,
  selectInterruptibleTasks,
  selectLatestAssistantMessage,
  selectOpenOverlays,
  selectPanel,
  selectStatusMessages,
  selectTranscriptMessages,
} from "./selectors.js";
import {
  createSurfaceMessage,
  createSurfaceOverlay,
  createSurfaceTask,
  createSurfaceTurn,
} from "./types.js";

test("surface selectors expose transcript windows and current turn", () => {
  const state = reduceSurfaceEvents(createInitialSurfaceState(), [
    createSurfaceEvent({
      eventId: "event:turn.started:turn-1",
      type: "turn.started",
      emittedAt: "2026-04-11T09:00:00.000Z",
      at: "2026-04-11T09:00:00.000Z",
      source: "core",
      turn: createSurfaceTurn({
        turnId: "turn-1",
        id: "turn-1",
        turnIndex: 0,
        status: "running",
        startedAt: "2026-04-11T09:00:00.000Z",
        updatedAt: "2026-04-11T09:00:00.000Z",
        outputMessageIds: [],
        taskIds: [],
      }),
    }),
    createSurfaceEvent({
      eventId: "event:message.appended:m1",
      type: "message.appended",
      emittedAt: "2026-04-11T09:00:01.000Z",
      at: "2026-04-11T09:00:01.000Z",
      source: "ui",
      message: createSurfaceMessage({
        messageId: "m1",
        id: "m1",
        kind: "user",
        createdAt: "2026-04-11T09:00:01.000Z",
        turnId: "turn-1",
        text: "a",
      }),
    }),
    createSurfaceEvent({
      eventId: "event:message.appended:m2",
      type: "message.appended",
      emittedAt: "2026-04-11T09:00:02.000Z",
      at: "2026-04-11T09:00:02.000Z",
      source: "ui",
      message: createSurfaceMessage({
        messageId: "m2",
        id: "m2",
        kind: "assistant",
        createdAt: "2026-04-11T09:00:02.000Z",
        turnId: "turn-1",
        text: "b",
      }),
    }),
  ]);

  assert.equal(selectCurrentTurn(state)?.id, "turn-1");
  assert.deepEqual(
    selectTranscriptMessages(state, { limit: 1 }).map((message) => message.id),
    ["m2"],
  );
  assert.equal(selectLatestAssistantMessage(state)?.id, "m2");
});

test("surface selectors preserve insertion order within the same turn", () => {
  const state = reduceSurfaceEvents(createInitialSurfaceState(), [
    createSurfaceEvent({
      eventId: "event:turn.started:turn-2",
      type: "turn.started",
      emittedAt: "2026-04-11T09:20:00.000Z",
      at: "2026-04-11T09:20:00.000Z",
      source: "core",
      turn: createSurfaceTurn({
        turnId: "turn-2",
        id: "turn-2",
        turnIndex: 1,
        status: "running",
        startedAt: "2026-04-11T09:20:00.000Z",
        updatedAt: "2026-04-11T09:20:00.000Z",
        outputMessageIds: [],
        taskIds: [],
      }),
    }),
    createSurfaceEvent({
      eventId: "event:message.appended:user-2",
      type: "message.appended",
      emittedAt: "2026-04-11T09:20:01.000Z",
      at: "2026-04-11T09:20:01.000Z",
      source: "ui",
      message: createSurfaceMessage({
        messageId: "user-2",
        id: "user-2",
        kind: "user",
        createdAt: "2026-04-11T09:20:01.000Z",
        turnId: "turn-2",
        text: "帮我搜索",
      }),
    }),
    createSurfaceEvent({
      eventId: "event:message.appended:assistant-2a",
      type: "message.appended",
      emittedAt: "2026-04-11T09:20:02.000Z",
      at: "2026-04-11T09:20:02.000Z",
      source: "ui",
      message: createSurfaceMessage({
        messageId: "assistant-2a",
        id: "assistant-2a",
        kind: "assistant",
        createdAt: "2026-04-11T09:20:02.000Z",
        turnId: "turn-2",
        text: "我先查一下。",
      }),
    }),
    createSurfaceEvent({
      eventId: "event:message.appended:tool-2",
      type: "message.appended",
      emittedAt: "2026-04-11T09:20:03.000Z",
      at: "2026-04-11T09:20:03.000Z",
      source: "ui",
      message: createSurfaceMessage({
        messageId: "tool-2",
        id: "tool-2",
        kind: "status",
        createdAt: "2026-04-11T09:20:03.000Z",
        turnId: "turn-2",
        text: "WebSearch\nSearching and grounding query",
        metadata: {
          source: "tool_summary",
        },
      }),
    }),
    createSurfaceEvent({
      eventId: "event:message.appended:assistant-2b",
      type: "message.appended",
      emittedAt: "2026-04-11T09:20:04.000Z",
      at: "2026-04-11T09:20:04.000Z",
      source: "ui",
      message: createSurfaceMessage({
        messageId: "assistant-2b",
        id: "assistant-2b",
        kind: "assistant",
        createdAt: "2026-04-11T09:20:04.000Z",
        turnId: "turn-2",
        text: "这是后半段回答。",
      }),
    }),
  ]);

  assert.deepEqual(
    selectTranscriptMessages(state, { turnId: "turn-2" }).map((message) => message.id),
    ["user-2", "assistant-2a", "tool-2", "assistant-2b"],
  );
});

test("surface selectors expose active tasks overlays panels and status messages", () => {
  const state = reduceSurfaceEvents(createInitialSurfaceState(), [
    createSurfaceEvent({
      eventId: "event:task.upserted:task-running",
      type: "task.upserted",
      emittedAt: "2026-04-11T09:10:00.000Z",
      at: "2026-04-11T09:10:00.000Z",
      source: "tap",
      task: createSurfaceTask({
        taskId: "task-running",
        id: "task-running",
        kind: "cmp_sync",
        status: "running",
        title: "Run cmp sync",
        summary: "cmp sync in progress",
        startedAt: "2026-04-11T09:10:00.000Z",
        updatedAt: "2026-04-11T09:10:00.000Z",
        foregroundable: true,
      }),
    }),
    createSurfaceEvent({
      eventId: "event:task.upserted:task-background",
      type: "task.upserted",
      emittedAt: "2026-04-11T09:10:01.000Z",
      at: "2026-04-11T09:10:01.000Z",
      source: "tap",
      task: createSurfaceTask({
        taskId: "task-background",
        id: "task-background",
        kind: "mp_materialize",
        status: "running",
        title: "Store log",
        summary: "background write",
        startedAt: "2026-04-11T09:10:01.000Z",
        updatedAt: "2026-04-11T09:10:01.000Z",
        foregroundable: false,
      }),
    }),
    createSurfaceEvent({
      eventId: "event:task.upserted:task-blocked",
      type: "task.upserted",
      emittedAt: "2026-04-11T09:10:01.500Z",
      at: "2026-04-11T09:10:01.500Z",
      source: "tap",
      task: createSurfaceTask({
        taskId: "task-blocked",
        id: "task-blocked",
        kind: "question",
        status: "blocked",
        title: "Need user input",
        summary: "waiting on questionnaire",
        startedAt: "2026-04-11T09:10:01.500Z",
        updatedAt: "2026-04-11T09:10:01.500Z",
        foregroundable: true,
      }),
    }),
    createSurfaceEvent({
      eventId: "event:overlay.opened:overlay-search",
      type: "overlay.opened",
      emittedAt: "2026-04-11T09:10:02.000Z",
      at: "2026-04-11T09:10:02.000Z",
      source: "ui",
      overlay: createSurfaceOverlay({
        overlayId: "overlay-search",
        id: "overlay-search",
        kind: "search",
        title: "Search",
        createdAt: "2026-04-11T09:10:02.000Z",
        openedAt: "2026-04-11T09:10:02.000Z",
      }),
    }),
    createSurfaceEvent({
      eventId: "event:message.appended:status-1",
      type: "message.appended",
      emittedAt: "2026-04-11T09:10:03.000Z",
      at: "2026-04-11T09:10:03.000Z",
      source: "ui",
      message: createSurfaceMessage({
        messageId: "status-1",
        id: "status-1",
        kind: "status",
        createdAt: "2026-04-11T09:10:03.000Z",
        text: "cmp sync running",
      }),
    }),
  ]);

  assert.deepEqual(
    selectActiveTasks(state).map((task) => task.id),
    ["task-blocked", "task-running", "task-background"],
  );
  assert.deepEqual(
    selectInterruptibleTasks(state).map((task) => task.id),
    ["task-running", "task-background"],
  );
  assert.equal(selectOpenOverlays(state)[0]?.id, "overlay-search");
  assert.equal(selectPanel(state, "history")?.transcriptSize, 1);
  assert.equal(selectStatusMessages(state)[0]?.id, "status-1");
});
