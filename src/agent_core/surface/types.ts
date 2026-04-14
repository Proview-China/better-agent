export const SURFACE_MESSAGE_KINDS = [
  "user",
  "assistant",
  "system",
  "status",
  "notice",
  "tool_use",
  "tool_result",
  "error",
] as const;

export type SurfaceMessageKind = (typeof SURFACE_MESSAGE_KINDS)[number];

export const SURFACE_TASK_KINDS = [
  "core_turn",
  "capability_run",
  "tap_review",
  "tap_provision",
  "cmp_sync",
  "cmp_passive_reply",
  "mp_materialize",
  "human_gate",
] as const;

export type SurfaceTaskKind = (typeof SURFACE_TASK_KINDS)[number];

export const SURFACE_TASK_STATUSES = [
  "queued",
  "running",
  "waiting",
  "blocked",
  "completed",
  "failed",
  "cancelled",
] as const;

export type SurfaceTaskStatus = (typeof SURFACE_TASK_STATUSES)[number];

export const SURFACE_RUN_STATUSES = [
  "created",
  "deciding",
  "acting",
  "waiting",
  "paused",
  "completed",
  "failed",
  "cancelled",
] as const;

export type SurfaceRunLifecycleStatus = (typeof SURFACE_RUN_STATUSES)[number];

export const SURFACE_RUN_PHASES = [
  "decision",
  "execution",
  "commit",
  "recovery",
] as const;

export type SurfaceRunPhase = (typeof SURFACE_RUN_PHASES)[number];

export const SURFACE_PANEL_KINDS = [
  "run_status",
  "tap",
  "cmp",
  "mp",
  "task",
  "history",
  "debug",
] as const;

export type SurfacePanelKind = (typeof SURFACE_PANEL_KINDS)[number];

export const SURFACE_OVERLAY_KINDS = [
  "permission_request",
  "human_gate_approval",
  "slash_palette",
  "task_detail",
  "message_actions",
  "search_ui",
] as const;

export type SurfaceOverlayKind = (typeof SURFACE_OVERLAY_KINDS)[number] | "search";

export const SURFACE_COMPOSER_MODES = [
  "input",
  "multiline",
  "slash",
  "search",
  "blocked",
] as const;

export type SurfaceComposerMode = (typeof SURFACE_COMPOSER_MODES)[number] | "prompt" | "command" | "hidden";
export type SurfaceFocusOwner = "composer" | "overlay";

export interface SurfaceRunStatus {
  runId?: string;
  status: SurfaceRunLifecycleStatus;
  phase: SurfaceRunPhase;
  pendingIntentId?: string;
  lastDispatchStatus?: string;
  lastTaskStatus?: string;
  lastCapabilityKey?: string;
  lastCapabilityResultStatus?: string;
  modelRoute?: string;
  summary?: string;
}

export interface SurfaceSession {
  sessionId: string;
  title?: string;
  status?: "idle" | "running" | "completed" | "failed";
  startedAt: string;
  updatedAt: string;
  activeTurnId?: string;
  currentRunId?: string;
  transcriptMessageIds: string[];
  taskIds: string[];
  uiMode?: "full" | "direct";
  workspaceLabel?: string;
  route?: string;
  model?: string;
}

export interface SurfaceTurn {
  turnId: string;
  id: string;
  sessionId?: string;
  turnIndex: number;
  status: "idle" | "running" | "waiting" | "blocked" | "completed" | "failed";
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  userText?: string;
  assistantText?: string;
  inputMessageId?: string;
  outputMessageIds: string[];
  taskIds: string[];
  run?: SurfaceRunStatus;
}

export interface SurfaceMessage {
  messageId: string;
  id: string;
  sessionId?: string;
  turnId?: string;
  taskId?: string;
  kind: SurfaceMessageKind;
  text: string;
  title?: string;
  status?: string;
  capabilityKey?: string;
  createdAt: string;
  updatedAt?: string;
  streaming?: boolean;
  errorCode?: string;
  metadata?: Record<string, unknown>;
}

export interface SurfaceTask {
  taskId: string;
  id: string;
  sessionId?: string;
  turnId?: string;
  title: string;
  kind: SurfaceTaskKind;
  status: SurfaceTaskStatus;
  startedAt: string;
  updatedAt: string;
  endedAt?: string;
  summary?: string;
  foregroundable?: boolean;
  cancellable?: boolean;
  blocking?: boolean;
  capabilityKey?: string;
  detailRef?: string;
  metadata?: Record<string, unknown>;
}

export interface SurfaceRunStatusPanelSnapshot {
  kind: "run_status";
  title: string;
  updatedAt: string;
  summaryLines: string[];
  run?: SurfaceRunStatus;
  headline?: string;
  detail?: string;
  runId?: string;
  runStatus?: string;
  dispatchStatus?: string;
  taskStatus?: string;
  capabilityKey?: string;
  eventTypes?: string[];
}

export type SurfaceCorePanelSnapshot = SurfaceRunStatusPanelSnapshot;

export interface SurfaceTapPanelSnapshot {
  kind: "tap";
  title: string;
  updatedAt: string;
  summaryLines: string[];
  summary?: string;
  visibleMode?: string;
  automationDepth?: string;
  currentLayer?: "runtime" | "reviewer" | "tool_reviewer" | "tma";
  pendingHumanGateCount?: number;
  blockingCapabilityKeys?: string[];
  activeCapabilityKeys?: string[];
  mode?: string;
  routing?: string;
  humanGateStatus?: string;
  reviewDecision?: string;
  toolReviewStatus?: string;
  provisionStatus?: string;
  activationStatus?: string;
  replayNextAction?: string;
  tmaSessionStatus?: string;
  hasResumeEnvelope?: boolean;
  recoveryReady?: boolean;
}

export interface SurfaceCmpPanelRow {
  section: "roles" | "package_flow" | "requests" | "health" | "readiness";
  label: string;
  value: string;
}

export interface SurfaceCmpPanelSnapshot {
  kind: "cmp";
  title: string;
  updatedAt: string;
  summaryLines: string[];
  summary?: string;
  readbackStatus?: string;
  rows?: SurfaceCmpPanelRow[];
  activePathStage?: string;
  passiveReplyStatus?: string;
  deliveryStatus?: string;
  projectionVisibility?: string;
  packageStatus?: string;
  checkedSnapshotId?: string;
  routeTargetKind?: string;
}

export interface SurfaceMpPanelSnapshot {
  kind: "mp";
  title: string;
  updatedAt: string;
  summaryLines: string[];
  summary?: string;
  status?: string;
  issues?: string[];
}

export interface SurfaceTaskPanelSnapshot {
  kind: "task";
  title: string;
  updatedAt: string;
  summaryLines: string[];
  totalCount: number;
  runningCount: number;
  blockedCount: number;
  backgroundCount: number;
}

export interface SurfaceHistoryPanelSnapshot {
  kind: "history";
  title: string;
  updatedAt: string;
  summaryLines: string[];
  totalMessages: number;
  unseenCount: number;
  transcriptSize?: number;
  turnCount?: number;
  taskCount?: number;
}

export interface SurfaceDebugPanelSnapshot {
  kind: "debug";
  title: string;
  updatedAt: string;
  summaryLines: string[];
  rawEventCount: number;
  warnings: string[];
  eventCount?: number;
  lastEventType?: string;
  lastUpdatedAt?: string;
}

export type SurfacePanelSnapshot =
  | SurfaceRunStatusPanelSnapshot
  | SurfaceTapPanelSnapshot
  | SurfaceCmpPanelSnapshot
  | SurfaceMpPanelSnapshot
  | SurfaceTaskPanelSnapshot
  | SurfaceHistoryPanelSnapshot
  | SurfaceDebugPanelSnapshot;

export interface SurfacePanelSnapshotMap {
  run_status?: SurfaceRunStatusPanelSnapshot;
  tap?: SurfaceTapPanelSnapshot;
  cmp?: SurfaceCmpPanelSnapshot;
  mp?: SurfaceMpPanelSnapshot;
  task?: SurfaceTaskPanelSnapshot;
  history?: SurfaceHistoryPanelSnapshot;
  debug?: SurfaceDebugPanelSnapshot;
  core?: SurfaceRunStatusPanelSnapshot;
  status?: SurfaceRunStatusPanelSnapshot;
}

export interface SurfaceOverlay {
  overlayId: string;
  id: string;
  kind: SurfaceOverlayKind;
  title?: string;
  detail?: string;
  createdAt: string;
  openedAt: string;
  open: boolean;
  blocking?: boolean;
  requestedCapabilityKey?: string;
  requestedOperations?: string[];
  plainLanguageRisk?: string;
  payload?: Record<string, unknown>;
}

export interface SurfaceComposerState {
  mode: SurfaceComposerMode;
  buffer: string;
  value: string;
  cursorOffset: number;
  submitEnabled: boolean;
  disabled: boolean;
  focusOwner: SurfaceFocusOwner;
  blockedByOverlayId?: string;
  pendingCommandHint?: string;
  placeholder?: string;
  queuedCommand?: string;
  draftUpdatedAt?: string;
}

export interface SurfaceAppState {
  session?: SurfaceSession | null;
  turns: SurfaceTurn[];
  messages: SurfaceMessage[];
  tasks: SurfaceTask[];
  currentTurnId?: string;
  panels: SurfacePanelSnapshotMap;
  overlays: SurfaceOverlay[];
  composer: SurfaceComposerState;
  screenMode?: "repl" | "transcript";
  selectedTurnId?: string;
  activeOverlayId?: string;
  lastEventId?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
  eventLog?: Array<{
    type: string;
    at?: string;
    emittedAt?: string;
  }>;
}

function dedupe(values: readonly string[] | undefined): string[] {
  return [...new Set(values ?? [])];
}

export function createSurfaceSession(input: Partial<SurfaceSession> & Pick<SurfaceSession, "sessionId" | "startedAt" | "updatedAt">): SurfaceSession {
  return {
    title: input.title,
    status: input.status ?? "running",
    activeTurnId: input.activeTurnId,
    currentRunId: input.currentRunId,
    uiMode: input.uiMode,
    workspaceLabel: input.workspaceLabel,
    route: input.route,
    model: input.model,
    ...input,
    transcriptMessageIds: dedupe(input.transcriptMessageIds),
    taskIds: dedupe(input.taskIds),
  };
}

export function createSurfaceTurn(input: Partial<SurfaceTurn> & Pick<SurfaceTurn, "turnId">): SurfaceTurn {
  return {
    ...input,
    id: input.id ?? input.turnId,
    turnIndex: input.turnIndex ?? 0,
    status: input.status ?? "running",
    startedAt: input.startedAt ?? input.updatedAt ?? new Date(0).toISOString(),
    updatedAt: input.updatedAt ?? input.startedAt ?? new Date(0).toISOString(),
    outputMessageIds: dedupe(input.outputMessageIds),
    taskIds: dedupe(input.taskIds),
  };
}

export function createSurfaceMessage(input: Partial<SurfaceMessage> & Pick<SurfaceMessage, "messageId" | "kind" | "text" | "createdAt">): SurfaceMessage {
  return {
    id: input.id ?? input.messageId,
    updatedAt: input.updatedAt ?? input.createdAt,
    ...input,
  };
}

export function createSurfaceTask(input: Partial<SurfaceTask> & Pick<SurfaceTask, "taskId" | "title" | "kind" | "status" | "startedAt" | "updatedAt">): SurfaceTask {
  return {
    id: input.id ?? input.taskId,
    ...input,
  };
}

export function createSurfacePanelSnapshot<T extends SurfacePanelSnapshot>(input: T): T {
  return input;
}

export function createSurfaceOverlay(input: Partial<SurfaceOverlay> & Pick<SurfaceOverlay, "overlayId" | "kind" | "createdAt">): SurfaceOverlay {
  const requestedOperations = dedupe(input.requestedOperations);
  return {
    ...input,
    id: input.id ?? input.overlayId,
    openedAt: input.openedAt ?? input.createdAt,
    open: input.open ?? true,
    requestedOperations,
  };
}

export function createSurfaceComposerState(input: Partial<SurfaceComposerState> = {}): SurfaceComposerState {
  const buffer = input.buffer ?? input.value ?? "";
  const disabled = input.disabled ?? input.submitEnabled === false;
  return {
    mode: input.mode ?? "input",
    buffer,
    value: buffer,
    cursorOffset: input.cursorOffset ?? buffer.length,
    submitEnabled: input.submitEnabled ?? !disabled,
    disabled,
    focusOwner: input.focusOwner ?? "composer",
    blockedByOverlayId: input.blockedByOverlayId,
    pendingCommandHint: input.pendingCommandHint,
    placeholder: input.placeholder ?? "Ask Praxis",
    queuedCommand: input.queuedCommand,
    draftUpdatedAt: input.draftUpdatedAt,
  };
}

export function createSurfaceAppState(input: Partial<SurfaceAppState> & {
  panels?: SurfacePanelSnapshotMap | SurfacePanelSnapshot[];
} = {}): SurfaceAppState {
  const panelMap: SurfacePanelSnapshotMap = Array.isArray(input.panels)
    ? Object.fromEntries(input.panels.map((panel) => [panel.kind, panel])) as SurfacePanelSnapshotMap
    : (input.panels ?? {});
  return {
    session: input.session ?? null,
    turns: input.turns ?? [],
    messages: input.messages ?? [],
    tasks: input.tasks ?? [],
    currentTurnId: input.currentTurnId ?? input.selectedTurnId ?? input.session?.activeTurnId,
    panels: panelMap,
    overlays: input.overlays ?? [],
    composer: input.composer ?? createSurfaceComposerState(),
    screenMode: input.screenMode ?? "repl",
    selectedTurnId: input.selectedTurnId,
    activeOverlayId: input.activeOverlayId,
    lastEventId: input.lastEventId,
    updatedAt: input.updatedAt,
    metadata: input.metadata,
    eventLog: input.eventLog ?? [],
  };
}

export function isTerminalSurfaceTaskStatus(status: string): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}
