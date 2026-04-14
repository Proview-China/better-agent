import { createCmpStatusPanelRows } from "../../rax/cmp-status-panel.js";
import type {
  CmpTurnArtifacts,
  CoreTurnArtifacts,
  DialogueTurn,
  LiveCliState,
  LiveChatLogEvent,
  TurnArtifacts,
} from "../live-agent-chat/shared.js";
import {
  decodeEscapedDisplayTextMaybe,
  extractResponseTextMaybe,
} from "../live-agent-chat/shared.js";
import {
  createSurfaceAppState,
  createSurfaceMessage,
  createSurfacePanelSnapshot,
  createSurfaceSession,
  createSurfaceTask,
  type SurfaceAppState,
  type SurfaceCmpPanelSnapshot,
  type SurfaceCorePanelSnapshot,
  type SurfaceMessage,
  type SurfacePanelSnapshotMap,
  type SurfacePanelSnapshot,
  type SurfaceTask,
  type SurfaceTapPanelSnapshot,
} from "./types.js";

export interface LiveChatLogRecordLike {
  ts: string;
  event: LiveChatLogEvent;
  turnIndex?: number;
  stage?: string;
  status?: string;
  label?: string;
  elapsedMs?: number;
  userMessage?: string;
  capabilityKey?: string | null;
  reason?: string;
  inputSummary?: string;
  core?: {
    answer?: string | { text?: string; truncated?: boolean; originalChars?: number };
    dispatchStatus?: string;
    capabilityKey?: string;
    capabilityResultStatus?: string;
  };
  text?: string;
}

function createId(prefix: string, suffix: string): string {
  return `${prefix}:${suffix}`;
}

export function mapDialogueTurnToSurfaceMessage(
  sessionId: string,
  turn: DialogueTurn,
  index: number,
): SurfaceMessage {
  return createSurfaceMessage({
    messageId: createId("dialogue", `${index}`),
    sessionId,
    kind: turn.role,
    text: turn.text,
    createdAt: new Date(0).toISOString(),
    metadata: {
      source: "dialogue_transcript",
      index,
    },
  });
}

export function mapTranscriptToSurfaceMessages(
  sessionId: string,
  transcript: readonly DialogueTurn[],
): SurfaceMessage[] {
  return transcript.map((turn, index) => mapDialogueTurnToSurfaceMessage(sessionId, turn, index));
}

export function createCorePanelSnapshot(
  core?: CoreTurnArtifacts,
): SurfaceCorePanelSnapshot | undefined {
  if (!core) {
    return undefined;
  }
  return createSurfacePanelSnapshot({
    kind: "run_status",
    title: "Run Status",
    updatedAt: new Date().toISOString(),
    summaryLines: [
      `dispatch=${core.dispatchStatus}`,
      `task=${core.taskStatus ?? "unknown"}`,
      `capability=${core.capabilityKey ?? "none"}`,
    ],
    run: {
      runId: core.runId,
      status: core.taskStatus === "completed" ? "completed" : "acting",
      phase: core.taskStatus === "completed" ? "commit" : "execution",
      lastDispatchStatus: core.dispatchStatus,
      lastTaskStatus: core.taskStatus,
      lastCapabilityKey: core.capabilityKey,
      lastCapabilityResultStatus: core.capabilityResultStatus,
      summary: core.answer,
    },
    headline: core.answer,
    detail: core.capabilityKey,
  });
}

export function createCmpPanelSnapshot(
  cmp?: CmpTurnArtifacts,
): SurfaceCmpPanelSnapshot | undefined {
  if (!cmp) {
    return undefined;
  }
  const summaryStatus = cmp.summary.peerExchangePendingApprovalCount > 0
    ? "pending_approval"
    : cmp.summary.parentPromoteReviewCount > 0
      ? "reviewing"
      : "available";
  return createSurfacePanelSnapshot({
    kind: "cmp",
    title: "CMP",
    updatedAt: new Date().toISOString(),
    summaryLines: [
      `readback=${summaryStatus}`,
      `package=${cmp.packageRef}`,
      `projection=${cmp.projectionId}`,
    ],
    summary: summaryStatus,
    readbackStatus: summaryStatus,
    rows: createCmpStatusPanelRows({
      projectId: cmp.agentId,
      panel: undefined,
    }),
    checkedSnapshotId: cmp.snapshotId,
  });
}

export function createTapPanelSnapshot(state: LiveCliState): SurfaceTapPanelSnapshot | undefined {
  const runtime = state.runtime as {
    getTapUserSurfaceSnapshot?: () => unknown;
    createTapUserSurfaceSnapshot?: () => unknown;
  };
  const snapshot = (runtime.getTapUserSurfaceSnapshot?.() ?? runtime.createTapUserSurfaceSnapshot?.()) as {
    summary?: string;
    visibleMode?: string;
    automationDepth?: string;
    currentLayer?: "runtime" | "reviewer" | "tool_reviewer" | "tma";
    pendingHumanGateCount?: number;
    blockingCapabilityKeys?: string[];
    activeCapabilityKeys?: string[];
  } | undefined;
  if (!snapshot) {
    return undefined;
  }
  const summaryLines = [
    snapshot.summary,
    typeof snapshot.visibleMode === "string" ? `mode=${snapshot.visibleMode}` : undefined,
    typeof snapshot.currentLayer === "string" ? `layer=${snapshot.currentLayer}` : undefined,
  ].filter((line): line is string => typeof line === "string" && line.length > 0);
  return createSurfacePanelSnapshot({
    kind: "tap",
    title: "TAP",
    updatedAt: new Date().toISOString(),
    summaryLines,
    summary: snapshot.summary,
    visibleMode: snapshot.visibleMode,
    automationDepth: snapshot.automationDepth,
    currentLayer: snapshot.currentLayer,
    pendingHumanGateCount: snapshot.pendingHumanGateCount,
    blockingCapabilityKeys: snapshot.blockingCapabilityKeys,
    activeCapabilityKeys: snapshot.activeCapabilityKeys,
  });
}

export function createPanelsFromLiveCliState(state: LiveCliState): SurfacePanelSnapshotMap {
  const panels: SurfacePanelSnapshotMap = {};
  const core = createCorePanelSnapshot(state.lastTurn?.core);
  const cmp = createCmpPanelSnapshot(state.lastTurn?.cmp);
  const tap = createTapPanelSnapshot(state);

  if (core) {
    panels.run_status = core;
    panels.core = core;
  }
  if (tap) {
    panels.tap = tap;
  }
  if (cmp) {
    panels.cmp = cmp;
  }
  panels.history = createSurfacePanelSnapshot({
    kind: "history",
    title: "History",
    updatedAt: new Date().toISOString(),
    summaryLines: [
      `transcript=${state.transcript.length}`,
      `turns=${state.turnIndex}`,
    ],
    totalMessages: state.transcript.length,
    unseenCount: 0,
  });
  panels.task = createSurfacePanelSnapshot({
    kind: "task",
    title: "Tasks",
    updatedAt: new Date().toISOString(),
    summaryLines: ["No live task registry yet."],
    totalCount: 0,
    runningCount: 0,
    blockedCount: 0,
    backgroundCount: 0,
  });
  panels.debug = createSurfacePanelSnapshot({
    kind: "debug",
    title: "Debug",
    updatedAt: new Date().toISOString(),
    summaryLines: ["Live adapter seeded from CLI state."],
    rawEventCount: 0,
    warnings: [],
  });
  return panels;
}

function buildTaskTitle(record: LiveChatLogRecordLike): string {
  if (record.capabilityKey) {
    return record.capabilityKey;
  }
  if (record.label) {
    return record.label;
  }
  return record.stage ?? record.event;
}

export function mapLiveLogRecordToSurfaceTasks(record: LiveChatLogRecordLike): SurfaceTask[] {
  if (record.event !== "stage_start" && record.event !== "stage_end") {
    return [];
  }
  const taskId = createId("task", `${record.stage ?? "stage"}:${record.turnIndex ?? 0}:${record.capabilityKey ?? "none"}`);
  const status = record.event === "stage_start"
    ? "running"
    : (record.status === "failed" ? "failed" : "completed");
  return [createSurfaceTask({
    taskId,
    kind: record.stage?.startsWith("cmp/") ? "cmp_sync" : (record.capabilityKey ? "capability_run" : "core_turn"),
    status,
    title: buildTaskTitle(record),
    summary: record.inputSummary ?? record.reason ?? record.text,
    capabilityKey: record.capabilityKey ?? undefined,
    startedAt: record.ts,
    updatedAt: record.ts,
    foregroundable: true,
    cancellable: false,
    metadata: {
      stage: record.stage,
      label: record.label,
    },
  })];
}

function extractAnswerText(record: LiveChatLogRecordLike): string | undefined {
  const answer = record.core?.answer;
  if (typeof answer === "string") {
    return decodeEscapedDisplayTextMaybe(extractResponseTextMaybe(answer));
  }
  if (answer && typeof answer === "object" && typeof answer.text === "string") {
    return decodeEscapedDisplayTextMaybe(extractResponseTextMaybe(answer.text));
  }
  if (typeof record.text === "string" && record.text.trim().length > 0) {
    return record.text;
  }
  return undefined;
}

export function mapLiveLogRecordToSurfaceMessages(record: LiveChatLogRecordLike): SurfaceMessage[] {
  switch (record.event) {
    case "turn_start":
      return record.userMessage ? [createSurfaceMessage({
        messageId: createId("log-user", `${record.turnIndex ?? 0}`),
        kind: "user",
        createdAt: record.ts,
        text: record.userMessage,
      })] : [];
    case "turn_result": {
      const answer = extractAnswerText(record);
      return answer ? [createSurfaceMessage({
        messageId: createId("log-assistant", `${record.turnIndex ?? 0}`),
        kind: "assistant",
        createdAt: record.ts,
        text: answer,
        status: record.core?.capabilityResultStatus,
        capabilityKey: record.core?.capabilityKey,
      })] : [];
    }
    case "stage_start":
      return [createSurfaceMessage({
        messageId: createId("log-status", `${record.stage ?? "stage"}:${record.turnIndex ?? 0}:${record.ts}`),
        kind: "status",
        createdAt: record.ts,
        text: record.reason ?? record.inputSummary ?? record.label ?? record.stage ?? record.event,
        status: "running",
        capabilityKey: record.capabilityKey ?? undefined,
      })];
    case "stage_end":
      return [createSurfaceMessage({
        messageId: createId("log-stage-end", `${record.stage ?? "stage"}:${record.turnIndex ?? 0}:${record.ts}`),
        kind: record.status === "failed" ? "error" : "status",
        createdAt: record.ts,
        text: record.text ?? `${record.stage ?? "stage"} ${record.status ?? "completed"}`,
        status: record.status,
        capabilityKey: record.capabilityKey ?? undefined,
      })];
    case "stream_text":
      return typeof record.text === "string" && record.text.trim().length > 0 ? [createSurfaceMessage({
        messageId: createId("log-stream", `${record.turnIndex ?? 0}:${record.ts}`),
        kind: "status",
        createdAt: record.ts,
        text: record.text,
        status: "streaming",
      })] : [];
    default:
      return [];
  }
}

export function createSurfaceStateSeedFromLiveCliState(
  state: LiveCliState,
): SurfaceAppState {
  return createSurfaceAppState({
    session: createSurfaceSession({
      sessionId: state.sessionId,
      startedAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      uiMode: state.uiMode,
      transcriptMessageIds: [],
      taskIds: [],
    }),
    messages: mapTranscriptToSurfaceMessages(state.sessionId, state.transcript),
    panels: createPanelsFromLiveCliState(state),
  });
}

export function createPanelsFromTurnArtifacts(
  artifacts?: TurnArtifacts,
): SurfacePanelSnapshotMap {
  const panels: SurfacePanelSnapshotMap = {};
  const core = createCorePanelSnapshot(artifacts?.core);
  const cmp = createCmpPanelSnapshot(artifacts?.cmp);
  if (core) {
    panels.run_status = core;
    panels.core = core;
  }
  if (cmp) {
    panels.cmp = cmp;
  }
  return panels;
}
