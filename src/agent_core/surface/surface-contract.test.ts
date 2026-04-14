import assert from "node:assert/strict";
import test from "node:test";

import {
  SURFACE_COMPOSER_MODES,
  SURFACE_EVENT_TYPES,
  SURFACE_MESSAGE_KINDS,
  SURFACE_OVERLAY_KINDS,
  SURFACE_PANEL_KINDS,
  SURFACE_RUN_PHASES,
  SURFACE_RUN_STATUSES,
  SURFACE_TASK_KINDS,
  SURFACE_TASK_STATUSES,
  createSurfaceAppState,
  createSurfaceComposerState,
  createSurfaceEvent,
  createSurfaceMessage,
  createSurfaceOverlay,
  createSurfacePanelSnapshot,
  createSurfaceSession,
  createSurfaceTask,
  createSurfaceTurn,
  isSurfaceSnapshotEvent,
  isTerminalSurfaceTaskStatus,
} from "./index.js";

test("surface contract constants freeze the wave-0 shared front-end baseline", () => {
  assert.deepEqual(SURFACE_MESSAGE_KINDS, [
    "user",
    "assistant",
    "system",
    "status",
    "notice",
    "tool_use",
    "tool_result",
    "error",
  ]);
  assert.deepEqual(SURFACE_TASK_KINDS, [
    "core_turn",
    "capability_run",
    "tap_review",
    "tap_provision",
    "cmp_sync",
    "cmp_passive_reply",
    "mp_materialize",
    "human_gate",
  ]);
  assert.deepEqual(SURFACE_TASK_STATUSES, [
    "queued",
    "running",
    "waiting",
    "blocked",
    "completed",
    "failed",
    "cancelled",
  ]);
  assert.deepEqual(SURFACE_RUN_STATUSES, [
    "created",
    "deciding",
    "acting",
    "waiting",
    "paused",
    "completed",
    "failed",
    "cancelled",
  ]);
  assert.deepEqual(SURFACE_RUN_PHASES, [
    "decision",
    "execution",
    "commit",
    "recovery",
  ]);
  assert.deepEqual(SURFACE_PANEL_KINDS, [
    "run_status",
    "tap",
    "cmp",
    "mp",
    "task",
    "history",
    "debug",
  ]);
  assert.deepEqual(SURFACE_OVERLAY_KINDS, [
    "permission_request",
    "human_gate_approval",
    "slash_palette",
    "task_detail",
    "message_actions",
    "search_ui",
  ]);
  assert.deepEqual(SURFACE_COMPOSER_MODES, [
    "input",
    "multiline",
    "slash",
    "search",
    "blocked",
  ]);
  assert.deepEqual(SURFACE_EVENT_TYPES, [
    "session.started",
    "session.updated",
    "turn.started",
    "turn.completed",
    "message.appended",
    "message.updated",
    "message.delta",
    "stage.started",
    "stage.ended",
    "run.state.updated",
    "capability.requested",
    "capability.updated",
    "capability.completed",
    "task.started",
    "task.updated",
    "task.completed",
    "tap.snapshot.updated",
    "cmp.snapshot.updated",
    "mp.snapshot.updated",
    "overlay.opened",
    "overlay.closed",
    "error.reported",
  ]);
});

test("surface state builders normalize shared session turn message task and overlay records", () => {
  const session = createSurfaceSession({
    sessionId: "session-main",
    title: "Praxis REPL",
    status: "running",
    startedAt: "2026-04-11T00:00:00.000Z",
    updatedAt: "2026-04-11T00:00:02.000Z",
    activeTurnId: "turn-1",
    transcriptMessageIds: ["message-1", "message-1", "message-2"],
    taskIds: ["task-1", "task-1"],
  });
  const message = createSurfaceMessage({
    messageId: "message-1",
    sessionId: session.sessionId,
    turnId: "turn-1",
    kind: "user",
    text: "请汇报当前 TAP 与 CMP 状态。",
    createdAt: "2026-04-11T00:00:01.000Z",
  });
  const task = createSurfaceTask({
    taskId: "task-1",
    sessionId: session.sessionId,
    turnId: "turn-1",
    title: "Resolve current TAP capability run",
    kind: "capability_run",
    status: "running",
    startedAt: "2026-04-11T00:00:01.500Z",
    updatedAt: "2026-04-11T00:00:02.000Z",
    summary: "Capability bridge is executing search.ground.",
    foregroundable: true,
    cancellable: true,
    capabilityKey: "search.ground",
  });
  const turn = createSurfaceTurn({
    turnId: "turn-1",
    sessionId: session.sessionId,
    turnIndex: 1,
    status: "running",
    startedAt: "2026-04-11T00:00:01.000Z",
    updatedAt: "2026-04-11T00:00:02.000Z",
    inputMessageId: message.messageId,
    outputMessageIds: ["message-2", "message-2"],
    taskIds: [task.taskId, task.taskId],
    run: {
      runId: "run-1",
      status: "acting",
      phase: "execution",
      pendingIntentId: "intent-1",
      lastDispatchStatus: "capability_executing",
      lastTaskStatus: task.status,
      lastCapabilityKey: task.capabilityKey,
      lastCapabilityResultStatus: "running",
      modelRoute: "openai/gpt-5.4",
    },
  });
  const panel = createSurfacePanelSnapshot({
    kind: "tap",
    title: "TAP Panel",
    updatedAt: "2026-04-11T00:00:02.000Z",
    summaryLines: ["Review required", "Human gate idle", "Replay ready"],
    mode: "standard",
    routing: "review_required",
    humanGateStatus: "idle",
    reviewDecision: "approved",
    toolReviewStatus: "recorded",
    provisionStatus: "ready",
    activationStatus: "active",
    replayNextAction: "continue",
    tmaSessionStatus: "idle",
    hasResumeEnvelope: true,
    recoveryReady: true,
  });
  const overlay = createSurfaceOverlay({
    overlayId: "overlay-1",
    kind: "permission_request",
    title: "Permission request",
    createdAt: "2026-04-11T00:00:02.000Z",
    open: true,
    blocking: true,
    requestedCapabilityKey: "browser.playwright",
    requestedOperations: ["browse", "snapshot", "browse"],
    plainLanguageRisk: "This will drive a real browser window.",
  });
  const composer = createSurfaceComposerState({
    mode: "blocked",
    buffer: "/approve task-1",
    cursorOffset: 15,
    submitEnabled: false,
    focusOwner: "overlay",
    blockedByOverlayId: overlay.overlayId,
  });
  const state = createSurfaceAppState({
    session,
    turns: [turn],
    messages: [message],
    tasks: [task],
    panels: [panel],
    overlays: [overlay],
    composer,
    screenMode: "repl",
    selectedTurnId: turn.turnId,
    activeOverlayId: overlay.overlayId,
    lastEventId: "event-1",
  });

  assert.deepEqual(session.transcriptMessageIds, ["message-1", "message-2"]);
  assert.deepEqual(turn.outputMessageIds, ["message-2"]);
  assert.deepEqual(task.capabilityKey, "search.ground");
  assert.equal(panel.kind, "tap");
  assert.equal(overlay.kind, "permission_request");
  assert.deepEqual(overlay.requestedOperations, ["browse", "snapshot"]);
  assert.equal(state.composer.mode, "blocked");
  assert.equal(state.session?.activeTurnId, "turn-1");
  assert.equal(isTerminalSurfaceTaskStatus("completed"), true);
  assert.equal(isTerminalSurfaceTaskStatus("running"), false);
});

test("surface event builders preserve typed session message task and snapshot events", () => {
  const sessionEvent = createSurfaceEvent({
    eventId: "event-1",
    type: "session.started",
    sessionId: "session-main",
    emittedAt: "2026-04-11T00:00:00.000Z",
    source: "core",
    session: {
      sessionId: "session-main",
      status: "running",
      startedAt: "2026-04-11T00:00:00.000Z",
      updatedAt: "2026-04-11T00:00:00.000Z",
      transcriptMessageIds: [],
      taskIds: [],
    },
  });
  const taskEvent = createSurfaceEvent({
    eventId: "event-2",
    type: "task.started",
    sessionId: "session-main",
    turnId: "turn-1",
    emittedAt: "2026-04-11T00:00:01.000Z",
    source: "tap",
    task: {
      id: "task-1",
      taskId: "task-1",
      sessionId: "session-main",
      turnId: "turn-1",
      title: "Review browser request",
      kind: "tap_review",
      status: "waiting",
      startedAt: "2026-04-11T00:00:01.000Z",
      updatedAt: "2026-04-11T00:00:01.000Z",
      summary: "Waiting for TAP review.",
      foregroundable: true,
      cancellable: false,
    },
  });
  const snapshotEvent = createSurfaceEvent({
    eventId: "event-3",
    type: "cmp.snapshot.updated",
    sessionId: "session-main",
    turnId: "turn-1",
    emittedAt: "2026-04-11T00:00:02.000Z",
    source: "cmp",
    snapshot: {
      kind: "cmp",
      title: "CMP Panel",
      updatedAt: "2026-04-11T00:00:02.000Z",
      summaryLines: ["Active ingest synced", "Dispatcher idle"],
      activePathStage: "checked_ready",
      passiveReplyStatus: "idle",
      deliveryStatus: "acknowledged",
      projectionVisibility: "accepted_by_parent",
      packageStatus: "served",
      checkedSnapshotId: "snapshot-1",
      routeTargetKind: "child",
    },
  });
  const deltaEvent = createSurfaceEvent({
    eventId: "event-4",
    type: "message.delta",
    sessionId: "session-main",
    turnId: "turn-1",
    emittedAt: "2026-04-11T00:00:03.000Z",
    source: "ui",
    messageId: "message-2",
    textDelta: "正在整理最终回答……",
    done: false,
  });
  const errorEvent = createSurfaceEvent({
    eventId: "event-5",
    type: "error.reported",
    sessionId: "session-main",
    turnId: "turn-1",
    emittedAt: "2026-04-11T00:00:04.000Z",
    source: "system",
    error: {
      errorId: "error-1",
      message: "CMP passive reply fetch failed.",
      severity: "warning",
      recoverable: true,
      taskId: "task-2",
      turnId: "turn-1",
      createdAt: "2026-04-11T00:00:04.000Z",
    },
  });

  assert.equal(sessionEvent.session.status, "running");
  assert.equal(taskEvent.task.kind, "tap_review");
  assert.equal(snapshotEvent.snapshot.kind, "cmp");
  assert.equal(isSurfaceSnapshotEvent(snapshotEvent), true);
  assert.equal(isSurfaceSnapshotEvent(deltaEvent), false);
  assert.equal(deltaEvent.textDelta, "正在整理最终回答……");
  assert.equal(errorEvent.error.recoverable, true);
});
