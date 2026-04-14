import type {
  SurfaceMessage,
  SurfaceOverlay,
  SurfacePanelSnapshot,
  SurfaceRunStatus,
  SurfaceSession,
  SurfaceTask,
  SurfaceTaskKind,
  SurfaceTaskStatus,
  SurfaceTurn,
} from "./types.js";
import {
  createSurfaceSession,
} from "./types.js";

export const SURFACE_EVENT_TYPES = [
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
] as const;

export type SurfaceEventType = (typeof SURFACE_EVENT_TYPES)[number]
  | "turn.updated"
  | "task.upserted"
  | "panel.updated"
  | "composer.updated";
export type SurfaceEventSource = "core" | "tap" | "cmp" | "mp" | "ui" | "system";

interface SurfaceEventBase<TType extends SurfaceEventType> {
  eventId: string;
  type: TType;
  emittedAt: string;
  at?: string;
  source: SurfaceEventSource;
  sessionId?: string;
  turnId?: string;
  metadata?: Record<string, unknown>;
}

export interface SurfaceSessionEvent extends SurfaceEventBase<"session.started" | "session.updated"> {
  session: SurfaceSession;
}

export interface SurfaceTurnEvent extends SurfaceEventBase<"turn.started" | "turn.completed"> {
  turn: SurfaceTurn;
}

export interface SurfaceMessageAppendedEvent extends SurfaceEventBase<"message.appended"> {
  message: SurfaceMessage;
}

export interface SurfaceMessageDeltaEvent extends SurfaceEventBase<"message.delta"> {
  messageId: string;
  textDelta: string;
  done?: boolean;
}

export interface SurfaceMessageUpdatedEvent extends SurfaceEventBase<"message.updated"> {
  message: SurfaceMessage;
}

export interface SurfaceTurnUpdatedEvent extends SurfaceEventBase<"turn.updated"> {
  turn: Partial<SurfaceTurn> & { id?: string; turnId?: string };
}

export interface SurfaceStageStartedEvent extends SurfaceEventBase<"stage.started"> {
  stageId: string;
  stageKey: string;
  label: string;
  taskId?: string;
  capabilityKey?: string;
}

export interface SurfaceStageEndedEvent extends SurfaceEventBase<"stage.ended"> {
  stageId: string;
  status: string;
  taskId?: string;
}

export interface SurfaceRunStateUpdatedEvent extends SurfaceEventBase<"run.state.updated"> {
  run: SurfaceRunStatus;
}

export interface SurfaceCapabilityEvent extends SurfaceEventBase<"capability.requested" | "capability.updated" | "capability.completed"> {
  taskId: string;
  capabilityKey: string;
  status: SurfaceTaskStatus;
  requestedTier?: string;
  summary?: string;
  resultStatus?: string;
}

export interface SurfaceTaskEvent extends SurfaceEventBase<"task.started" | "task.updated" | "task.completed"> {
  task: SurfaceTask;
  taskId?: string;
  status?: SurfaceTaskStatus;
  summary?: string;
}

export interface SurfaceTaskUpsertedEvent extends SurfaceEventBase<"task.upserted"> {
  task: SurfaceTask;
}

export interface SurfaceSnapshotEvent extends SurfaceEventBase<"tap.snapshot.updated" | "cmp.snapshot.updated" | "mp.snapshot.updated"> {
  snapshot: SurfacePanelSnapshot;
}

export interface SurfacePanelUpdatedEvent extends SurfaceEventBase<"panel.updated"> {
  panel: string;
  snapshot: Partial<SurfacePanelSnapshot> & Record<string, unknown>;
}

export interface SurfaceOverlayOpenedEvent extends SurfaceEventBase<"overlay.opened"> {
  overlay: SurfaceOverlay;
}

export interface SurfaceOverlayClosedEvent extends SurfaceEventBase<"overlay.closed"> {
  overlayId: string;
}

export interface SurfaceErrorReportedEvent extends SurfaceEventBase<"error.reported"> {
  message?: SurfaceMessage;
  error: {
    errorId: string;
    message: string;
    severity?: "info" | "warning" | "error";
    recoverable?: boolean;
    taskId?: string;
    turnId?: string;
    createdAt: string;
  };
}

export interface SurfaceComposerUpdatedEvent extends SurfaceEventBase<"composer.updated"> {
  composer?: Partial<import("./types.js").SurfaceComposerState>;
  patch?: Partial<import("./types.js").SurfaceComposerState>;
}

export type SurfaceEvent =
  | SurfaceSessionEvent
  | SurfaceTurnEvent
  | SurfaceTurnUpdatedEvent
  | SurfaceMessageAppendedEvent
  | SurfaceMessageUpdatedEvent
  | SurfaceMessageDeltaEvent
  | SurfaceStageStartedEvent
  | SurfaceStageEndedEvent
  | SurfaceRunStateUpdatedEvent
  | SurfaceCapabilityEvent
  | SurfaceTaskEvent
  | SurfaceTaskUpsertedEvent
  | SurfaceSnapshotEvent
  | SurfacePanelUpdatedEvent
  | SurfaceOverlayOpenedEvent
  | SurfaceOverlayClosedEvent
  | SurfaceErrorReportedEvent
  | SurfaceComposerUpdatedEvent;

export function createSurfaceEvent<TEvent extends SurfaceEvent>(event: TEvent): TEvent {
  return event;
}

export function createSurfaceSessionStartedEvent(
  session: Partial<SurfaceSession> & Pick<SurfaceSession, "sessionId" | "startedAt">,
): SurfaceSessionEvent {
  const normalizedSession = createSurfaceSession({
    ...session,
    updatedAt: session.updatedAt ?? session.startedAt,
    transcriptMessageIds: session.transcriptMessageIds ?? [],
    taskIds: session.taskIds ?? [],
  });
  return createSurfaceEvent({
    eventId: `event:session.started:${normalizedSession.sessionId}`,
    type: "session.started",
    sessionId: normalizedSession.sessionId,
    emittedAt: normalizedSession.startedAt,
    source: "core",
    session: normalizedSession,
  });
}

export function createSurfaceTurnStartedEvent(turn: Partial<SurfaceTurn> & { id?: string; turnId?: string; startedAt: string }): SurfaceTurnEvent {
  return createSurfaceEvent({
    eventId: `event:turn.started:${turn.turnId ?? turn.id ?? "turn"}`,
    type: "turn.started",
    sessionId: turn.sessionId,
    turnId: turn.turnId ?? turn.id,
    emittedAt: turn.startedAt,
    source: "core",
    turn: {
      id: turn.id ?? turn.turnId ?? "turn",
      turnId: turn.turnId ?? turn.id ?? "turn",
      turnIndex: turn.turnIndex ?? 0,
      status: turn.status ?? "running",
      startedAt: turn.startedAt,
      updatedAt: turn.updatedAt ?? turn.startedAt,
      outputMessageIds: turn.outputMessageIds ?? [],
      taskIds: turn.taskIds ?? [],
      sessionId: turn.sessionId,
      userText: turn.userText,
      assistantText: turn.assistantText,
      run: turn.run,
    },
  });
}

export function createSurfaceMessageAppendedEvent(message: Partial<SurfaceMessage> & { id?: string; messageId?: string; kind: SurfaceMessage["kind"]; text: string; createdAt: string }): SurfaceMessageAppendedEvent {
  return createSurfaceEvent({
    eventId: `event:message.appended:${message.messageId ?? message.id ?? "message"}`,
    type: "message.appended",
    sessionId: message.sessionId,
    turnId: message.turnId,
    emittedAt: message.createdAt,
    source: "ui",
    message: {
      id: message.id ?? message.messageId ?? "message",
      messageId: message.messageId ?? message.id ?? "message",
      kind: message.kind,
      text: message.text,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt ?? message.createdAt,
      sessionId: message.sessionId,
      turnId: message.turnId,
      status: message.status,
      capabilityKey: message.capabilityKey,
      metadata: message.metadata,
    },
  });
}

export function createSurfaceTaskUpsertedEvent(task: Partial<SurfaceTask> & { id?: string; taskId?: string; title: string; kind: SurfaceTaskKind; status: SurfaceTaskStatus; startedAt: string; updatedAt: string }): SurfaceTaskEvent {
  return createSurfaceEvent({
    eventId: `event:task.started:${task.taskId ?? task.id ?? "task"}`,
    type: "task.started",
    sessionId: task.sessionId,
    turnId: task.turnId,
    emittedAt: task.updatedAt,
    source: "tap",
    task: {
      id: task.id ?? task.taskId ?? "task",
      taskId: task.taskId ?? task.id ?? "task",
      title: task.title,
      kind: task.kind,
      status: task.status,
      startedAt: task.startedAt,
      updatedAt: task.updatedAt,
      sessionId: task.sessionId,
      turnId: task.turnId,
      summary: task.summary,
      foregroundable: task.foregroundable,
      cancellable: task.cancellable,
      capabilityKey: task.capabilityKey,
    },
  });
}

export function createSurfacePanelUpdatedEvent(
  _panel: string,
  snapshot: SurfacePanelSnapshot,
  emittedAt = snapshot.updatedAt,
): SurfaceSnapshotEvent {
  const type = `${snapshot.kind}.snapshot.updated` as SurfaceSnapshotEvent["type"];
  return createSurfaceEvent({
    eventId: `event:${type}:${snapshot.kind}`,
    type,
    emittedAt,
    source: snapshot.kind === "cmp" ? "cmp" : snapshot.kind === "mp" ? "mp" : "tap",
    snapshot,
  });
}

export function isSurfaceSnapshotEvent(event: SurfaceEvent): event is SurfaceSnapshotEvent {
  return event.type === "tap.snapshot.updated"
    || event.type === "cmp.snapshot.updated"
    || event.type === "mp.snapshot.updated";
}
