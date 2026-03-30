import type { RunId, SessionId } from "../types/index.js";

export const CMP_CONTEXT_EVENT_KINDS = [
  "user_input",
  "system_prompt",
  "assistant_output",
  "tool_result",
  "state_marker",
  "context_package_received",
  "context_package_dispatched",
] as const;
export type CmpContextEventKind = (typeof CMP_CONTEXT_EVENT_KINDS)[number];

export const CMP_CONTEXT_EVENT_SOURCES = [
  "core_agent",
  "icma",
  "dispatcher",
  "external_import",
] as const;
export type CmpContextEventSource = (typeof CMP_CONTEXT_EVENT_SOURCES)[number];

export const CMP_CONTEXT_SYNC_INTENTS = [
  "local_record",
  "submit_to_parent",
  "broadcast_to_peers",
  "dispatch_to_children",
] as const;
export type CmpContextSyncIntent = (typeof CMP_CONTEXT_SYNC_INTENTS)[number];

export const CMP_SNAPSHOT_CANDIDATE_STATUSES = [
  "pending_check",
  "under_review",
  "accepted",
  "rejected",
  "superseded",
] as const;
export type CmpSnapshotCandidateStatus = (typeof CMP_SNAPSHOT_CANDIDATE_STATUSES)[number];

export const CMP_CHECKED_SNAPSHOT_QUALITY_LABELS = [
  "usable",
  "preferred",
  "restricted",
] as const;
export type CmpCheckedSnapshotQualityLabel = (typeof CMP_CHECKED_SNAPSHOT_QUALITY_LABELS)[number];

export const CMP_SNAPSHOT_STAGES = [
  "raw_capture",
  "checked",
  "package_attached",
] as const;
export type CmpSnapshotStage = (typeof CMP_SNAPSHOT_STAGES)[number];

export interface ContextEvent {
  eventId: string;
  agentId: string;
  sessionId: SessionId;
  runId?: RunId;
  kind: CmpContextEventKind;
  payloadRef: string;
  createdAt: string;
  source: CmpContextEventSource;
  metadata?: Record<string, unknown>;
}

export interface CreateContextEventInput {
  eventId: string;
  agentId: string;
  sessionId: SessionId;
  runId?: RunId;
  kind: CmpContextEventKind;
  payloadRef: string;
  createdAt: string;
  source: CmpContextEventSource;
  metadata?: Record<string, unknown>;
}

export interface ContextDelta {
  deltaId: string;
  agentId: string;
  baseRef?: string;
  eventRefs: string[];
  changeSummary: string;
  createdAt: string;
  syncIntent: CmpContextSyncIntent;
  metadata?: Record<string, unknown>;
}

export interface CreateContextDeltaInput {
  deltaId: string;
  agentId: string;
  baseRef?: string;
  eventRefs: string[];
  changeSummary: string;
  createdAt: string;
  syncIntent: CmpContextSyncIntent;
  metadata?: Record<string, unknown>;
}

export interface SnapshotCandidate {
  candidateId: string;
  agentId: string;
  branchRef: string;
  commitRef: string;
  deltaRefs: string[];
  createdAt: string;
  status: CmpSnapshotCandidateStatus;
  metadata?: Record<string, unknown>;
}

export interface CreateSnapshotCandidateInput {
  candidateId: string;
  agentId: string;
  branchRef: string;
  commitRef: string;
  deltaRefs: string[];
  createdAt: string;
  status?: CmpSnapshotCandidateStatus;
  metadata?: Record<string, unknown>;
}

export interface CheckedSnapshot {
  snapshotId: string;
  agentId: string;
  lineageRef: string;
  branchRef: string;
  commitRef: string;
  checkedAt: string;
  updatedAt?: string;
  qualityLabel: CmpCheckedSnapshotQualityLabel;
  promotable: boolean;
  stage?: CmpSnapshotStage;
  sourceSectionIds?: string[];
  packageIds?: string[];
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateCheckedSnapshotInput {
  snapshotId: string;
  agentId: string;
  lineageRef: string;
  branchRef: string;
  commitRef: string;
  checkedAt: string;
  updatedAt?: string;
  qualityLabel?: CmpCheckedSnapshotQualityLabel;
  promotable?: boolean;
  stage?: CmpSnapshotStage;
  sourceSectionIds?: string[];
  packageIds?: string[];
  requestId?: string;
  metadata?: Record<string, unknown>;
}

function normalizeStringArray(values: string[], label: string): string[] {
  const normalized = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  if (normalized.length === 0) {
    throw new Error(`${label} requires at least one non-empty string.`);
  }
  return normalized;
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

export function isCmpContextEventKind(value: string): value is CmpContextEventKind {
  return CMP_CONTEXT_EVENT_KINDS.includes(value as CmpContextEventKind);
}

export function isCmpContextEventSource(value: string): value is CmpContextEventSource {
  return CMP_CONTEXT_EVENT_SOURCES.includes(value as CmpContextEventSource);
}

export function isCmpContextSyncIntent(value: string): value is CmpContextSyncIntent {
  return CMP_CONTEXT_SYNC_INTENTS.includes(value as CmpContextSyncIntent);
}

export function isCmpSnapshotCandidateStatus(value: string): value is CmpSnapshotCandidateStatus {
  return CMP_SNAPSHOT_CANDIDATE_STATUSES.includes(value as CmpSnapshotCandidateStatus);
}

export function isCmpCheckedSnapshotQualityLabel(value: string): value is CmpCheckedSnapshotQualityLabel {
  return CMP_CHECKED_SNAPSHOT_QUALITY_LABELS.includes(value as CmpCheckedSnapshotQualityLabel);
}

export function isCmpSnapshotStage(value: string): value is CmpSnapshotStage {
  return CMP_SNAPSHOT_STAGES.includes(value as CmpSnapshotStage);
}

export function validateContextEvent(event: ContextEvent): void {
  assertNonEmpty(event.eventId, "CMP ContextEvent eventId");
  assertNonEmpty(event.agentId, "CMP ContextEvent agentId");
  assertNonEmpty(event.payloadRef, "CMP ContextEvent payloadRef");
  if (!isCmpContextEventKind(event.kind)) {
    throw new Error(`Unsupported CMP ContextEvent kind: ${event.kind}.`);
  }
  if (!isCmpContextEventSource(event.source)) {
    throw new Error(`Unsupported CMP ContextEvent source: ${event.source}.`);
  }
}

export function createContextEvent(input: CreateContextEventInput): ContextEvent {
  const event: ContextEvent = {
    eventId: assertNonEmpty(input.eventId, "CMP ContextEvent eventId"),
    agentId: assertNonEmpty(input.agentId, "CMP ContextEvent agentId"),
    sessionId: input.sessionId,
    runId: input.runId,
    kind: input.kind,
    payloadRef: assertNonEmpty(input.payloadRef, "CMP ContextEvent payloadRef"),
    createdAt: input.createdAt,
    source: input.source,
    metadata: input.metadata,
  };

  validateContextEvent(event);
  return event;
}

export function validateContextDelta(delta: ContextDelta): void {
  assertNonEmpty(delta.deltaId, "CMP ContextDelta deltaId");
  assertNonEmpty(delta.agentId, "CMP ContextDelta agentId");
  normalizeStringArray(delta.eventRefs, "CMP ContextDelta eventRefs");
  assertNonEmpty(delta.changeSummary, "CMP ContextDelta changeSummary");
  if (!isCmpContextSyncIntent(delta.syncIntent)) {
    throw new Error(`Unsupported CMP ContextDelta syncIntent: ${delta.syncIntent}.`);
  }
}

export function createContextDelta(input: CreateContextDeltaInput): ContextDelta {
  const delta: ContextDelta = {
    deltaId: assertNonEmpty(input.deltaId, "CMP ContextDelta deltaId"),
    agentId: assertNonEmpty(input.agentId, "CMP ContextDelta agentId"),
    baseRef: input.baseRef?.trim() || undefined,
    eventRefs: normalizeStringArray(input.eventRefs, "CMP ContextDelta eventRefs"),
    changeSummary: assertNonEmpty(input.changeSummary, "CMP ContextDelta changeSummary"),
    createdAt: input.createdAt,
    syncIntent: input.syncIntent,
    metadata: input.metadata,
  };

  validateContextDelta(delta);
  return delta;
}

export function validateSnapshotCandidate(candidate: SnapshotCandidate): void {
  assertNonEmpty(candidate.candidateId, "CMP SnapshotCandidate candidateId");
  assertNonEmpty(candidate.agentId, "CMP SnapshotCandidate agentId");
  assertNonEmpty(candidate.branchRef, "CMP SnapshotCandidate branchRef");
  assertNonEmpty(candidate.commitRef, "CMP SnapshotCandidate commitRef");
  normalizeStringArray(candidate.deltaRefs, "CMP SnapshotCandidate deltaRefs");
  if (!isCmpSnapshotCandidateStatus(candidate.status)) {
    throw new Error(`Unsupported CMP SnapshotCandidate status: ${candidate.status}.`);
  }
}

export function createSnapshotCandidate(input: CreateSnapshotCandidateInput): SnapshotCandidate {
  const candidate: SnapshotCandidate = {
    candidateId: assertNonEmpty(input.candidateId, "CMP SnapshotCandidate candidateId"),
    agentId: assertNonEmpty(input.agentId, "CMP SnapshotCandidate agentId"),
    branchRef: assertNonEmpty(input.branchRef, "CMP SnapshotCandidate branchRef"),
    commitRef: assertNonEmpty(input.commitRef, "CMP SnapshotCandidate commitRef"),
    deltaRefs: normalizeStringArray(input.deltaRefs, "CMP SnapshotCandidate deltaRefs"),
    createdAt: input.createdAt,
    status: input.status ?? "pending_check",
    metadata: input.metadata,
  };

  validateSnapshotCandidate(candidate);
  return candidate;
}

export function validateCheckedSnapshot(snapshot: CheckedSnapshot): void {
  assertNonEmpty(snapshot.snapshotId, "CMP CheckedSnapshot snapshotId");
  assertNonEmpty(snapshot.agentId, "CMP CheckedSnapshot agentId");
  assertNonEmpty(snapshot.lineageRef, "CMP CheckedSnapshot lineageRef");
  assertNonEmpty(snapshot.branchRef, "CMP CheckedSnapshot branchRef");
  assertNonEmpty(snapshot.commitRef, "CMP CheckedSnapshot commitRef");
  if (snapshot.updatedAt) {
    assertNonEmpty(snapshot.updatedAt, "CMP CheckedSnapshot updatedAt");
  }
  if (!isCmpCheckedSnapshotQualityLabel(snapshot.qualityLabel)) {
    throw new Error(`Unsupported CMP CheckedSnapshot qualityLabel: ${snapshot.qualityLabel}.`);
  }
  if (snapshot.stage && !isCmpSnapshotStage(snapshot.stage)) {
    throw new Error(`Unsupported CMP CheckedSnapshot stage: ${snapshot.stage}.`);
  }
}

export function createCheckedSnapshot(input: CreateCheckedSnapshotInput): CheckedSnapshot {
  const snapshot: CheckedSnapshot = {
    snapshotId: assertNonEmpty(input.snapshotId, "CMP CheckedSnapshot snapshotId"),
    agentId: assertNonEmpty(input.agentId, "CMP CheckedSnapshot agentId"),
    lineageRef: assertNonEmpty(input.lineageRef, "CMP CheckedSnapshot lineageRef"),
    branchRef: assertNonEmpty(input.branchRef, "CMP CheckedSnapshot branchRef"),
    commitRef: assertNonEmpty(input.commitRef, "CMP CheckedSnapshot commitRef"),
    checkedAt: input.checkedAt,
    updatedAt: assertNonEmpty(input.updatedAt ?? input.checkedAt, "CMP CheckedSnapshot updatedAt"),
    qualityLabel: input.qualityLabel ?? "usable",
    promotable: input.promotable ?? true,
    stage: input.stage ?? "checked",
    sourceSectionIds: [...new Set((input.sourceSectionIds ?? []).map((value) => value.trim()).filter(Boolean))],
    packageIds: [...new Set((input.packageIds ?? []).map((value) => value.trim()).filter(Boolean))],
    requestId: input.requestId?.trim() || undefined,
    metadata: input.metadata,
  };

  validateCheckedSnapshot(snapshot);
  return snapshot;
}
