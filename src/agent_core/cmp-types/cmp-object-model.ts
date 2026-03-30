import type { CheckedSnapshot } from "./cmp-context.js";
import type { ContextPackage } from "./cmp-delivery.js";
import type {
  IngestRuntimeContextInput,
  RequestHistoricalContextInput,
} from "./cmp-interface.js";
import type {
  CmpSection,
  CmpStoredSection,
} from "./cmp-section.js";

export const CMP_REQUEST_KINDS = [
  "active_ingest",
  "historical_context",
  "materialize_package",
  "dispatch_package",
  "reintervention",
] as const;
export type CmpRequestKind = (typeof CMP_REQUEST_KINDS)[number];

export const CMP_REQUEST_STATUSES = [
  "received",
  "reviewed",
  "accepted",
  "denied",
  "served",
] as const;
export type CmpRequestStatus = (typeof CMP_REQUEST_STATUSES)[number];

export const CMP_SECTION_LIFECYCLE_STATES = [
  "raw",
  "pre",
  "checked",
  "persisted",
] as const;
export type CmpSectionLifecycleState = (typeof CMP_SECTION_LIFECYCLE_STATES)[number];

export const CMP_SNAPSHOT_STAGES = [
  "pre",
  "checked",
  "persisted",
] as const;
export type CmpSnapshotStage = (typeof CMP_SNAPSHOT_STAGES)[number];

export const CMP_PACKAGE_STATUSES = [
  "materialized",
  "dispatched",
  "served",
] as const;
export type CmpPackageStatus = (typeof CMP_PACKAGE_STATUSES)[number];

export interface CmpRequestRecord {
  requestId: string;
  projectId: string;
  requesterAgentId: string;
  requestKind: CmpRequestKind;
  status: CmpRequestStatus;
  sourceAnchors: string[];
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface CmpSectionRecord {
  sectionId: string;
  projectId: string;
  agentId: string;
  lifecycle: CmpSectionLifecycleState;
  version: number;
  source: CmpSection["source"];
  kind: CmpSection["kind"];
  fidelity: CmpSection["fidelity"];
  lineagePath: string[];
  payloadRefs: string[];
  sourceAnchors: string[];
  parentSectionId?: string;
  ancestorSectionIds: string[];
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface CmpSnapshotRecord {
  snapshotId: string;
  projectId: string;
  agentId: string;
  stage: CmpSnapshotStage;
  sourceSectionIds: string[];
  sourceAnchors: string[];
  lineageRef?: string;
  branchRef?: string;
  commitRef?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface CmpPackageRecord {
  packageId: string;
  projectId: string;
  sourceProjectionId: string;
  targetAgentId: string;
  packageKind: ContextPackage["packageKind"];
  packageRef: string;
  fidelityLabel: ContextPackage["fidelityLabel"];
  status: CmpPackageStatus;
  sourceSnapshotId?: string;
  sourceSectionIds: string[];
  sourceAnchors: string[];
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function uniqueStrings(values: readonly string[] | undefined, label: string, minimum = 1): string[] {
  const normalized = [...new Set((values ?? []).map((value) => assertNonEmpty(value, label)))];
  if (normalized.length < minimum) {
    throw new Error(`${label} requires at least ${minimum} non-empty string(s).`);
  }
  return normalized;
}

function inferProjectId(params: {
  projectId?: string;
  metadata?: Record<string, unknown>;
  label: string;
}): string {
  const explicit = params.projectId?.trim();
  if (explicit) {
    return explicit;
  }
  const metadataProjectId = typeof params.metadata?.projectId === "string"
    ? params.metadata.projectId.trim()
    : "";
  if (metadataProjectId) {
    return metadataProjectId;
  }
  throw new Error(`${params.label} requires a projectId either explicitly or in metadata.projectId.`);
}

export function isCmpRequestKind(value: string): value is CmpRequestKind {
  return CMP_REQUEST_KINDS.includes(value as CmpRequestKind);
}

export function isCmpRequestStatus(value: string): value is CmpRequestStatus {
  return CMP_REQUEST_STATUSES.includes(value as CmpRequestStatus);
}

export function isCmpSectionLifecycleState(value: string): value is CmpSectionLifecycleState {
  return CMP_SECTION_LIFECYCLE_STATES.includes(value as CmpSectionLifecycleState);
}

export function isCmpSnapshotStage(value: string): value is CmpSnapshotStage {
  return CMP_SNAPSHOT_STAGES.includes(value as CmpSnapshotStage);
}

export function isCmpPackageStatus(value: string): value is CmpPackageStatus {
  return CMP_PACKAGE_STATUSES.includes(value as CmpPackageStatus);
}

export function validateCmpRequestRecord(record: CmpRequestRecord): void {
  assertNonEmpty(record.requestId, "CMP request record requestId");
  assertNonEmpty(record.projectId, "CMP request record projectId");
  assertNonEmpty(record.requesterAgentId, "CMP request record requesterAgentId");
  if (!isCmpRequestKind(record.requestKind)) {
    throw new Error(`Unsupported CMP request record kind: ${record.requestKind}.`);
  }
  if (!isCmpRequestStatus(record.status)) {
    throw new Error(`Unsupported CMP request record status: ${record.status}.`);
  }
  uniqueStrings(record.sourceAnchors, "CMP request record sourceAnchors");
  assertNonEmpty(record.createdAt, "CMP request record createdAt");
  assertNonEmpty(record.updatedAt, "CMP request record updatedAt");
}

export function createCmpRequestRecord(input: CmpRequestRecord): CmpRequestRecord {
  const record: CmpRequestRecord = {
    requestId: assertNonEmpty(input.requestId, "CMP request record requestId"),
    projectId: assertNonEmpty(input.projectId, "CMP request record projectId"),
    requesterAgentId: assertNonEmpty(input.requesterAgentId, "CMP request record requesterAgentId"),
    requestKind: input.requestKind,
    status: input.status,
    sourceAnchors: uniqueStrings(input.sourceAnchors, "CMP request record sourceAnchors"),
    createdAt: assertNonEmpty(input.createdAt, "CMP request record createdAt"),
    updatedAt: assertNonEmpty(input.updatedAt, "CMP request record updatedAt"),
    metadata: input.metadata,
  };
  validateCmpRequestRecord(record);
  return record;
}

export function advanceCmpRequestRecordStatus(input: {
  record: CmpRequestRecord;
  nextStatus: CmpRequestStatus;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}): CmpRequestRecord {
  const order: CmpRequestStatus[] = ["received", "reviewed", "accepted", "denied", "served"];
  const currentIndex = order.indexOf(input.record.status);
  const nextIndex = order.indexOf(input.nextStatus);
  if (nextIndex < currentIndex) {
    throw new Error(`CMP request record cannot move backwards from ${input.record.status} to ${input.nextStatus}.`);
  }
  return createCmpRequestRecord({
    ...input.record,
    status: input.nextStatus,
    updatedAt: input.updatedAt,
    metadata: input.metadata ?? input.record.metadata,
  });
}

export function validateCmpSectionRecord(record: CmpSectionRecord): void {
  assertNonEmpty(record.sectionId, "CMP section record sectionId");
  assertNonEmpty(record.projectId, "CMP section record projectId");
  assertNonEmpty(record.agentId, "CMP section record agentId");
  if (!isCmpSectionLifecycleState(record.lifecycle)) {
    throw new Error(`Unsupported CMP section lifecycle: ${record.lifecycle}.`);
  }
  if (!Number.isInteger(record.version) || record.version < 1) {
    throw new Error("CMP section record version must be an integer >= 1.");
  }
  uniqueStrings(record.lineagePath, "CMP section record lineagePath");
  uniqueStrings(record.payloadRefs, "CMP section record payloadRefs");
  uniqueStrings(record.sourceAnchors, "CMP section record sourceAnchors");
  uniqueStrings(record.ancestorSectionIds, "CMP section record ancestorSectionIds", 0);
  assertNonEmpty(record.createdAt, "CMP section record createdAt");
  assertNonEmpty(record.updatedAt, "CMP section record updatedAt");
}

export function createCmpSectionRecord(input: CmpSectionRecord): CmpSectionRecord {
  const record: CmpSectionRecord = {
    sectionId: assertNonEmpty(input.sectionId, "CMP section record sectionId"),
    projectId: assertNonEmpty(input.projectId, "CMP section record projectId"),
    agentId: assertNonEmpty(input.agentId, "CMP section record agentId"),
    lifecycle: input.lifecycle,
    version: input.version,
    source: input.source,
    kind: input.kind,
    fidelity: input.fidelity,
    lineagePath: uniqueStrings(input.lineagePath, "CMP section record lineagePath"),
    payloadRefs: uniqueStrings(input.payloadRefs, "CMP section record payloadRefs"),
    sourceAnchors: uniqueStrings(input.sourceAnchors, "CMP section record sourceAnchors"),
    parentSectionId: normalizeOptionalString(input.parentSectionId),
    ancestorSectionIds: uniqueStrings(input.ancestorSectionIds, "CMP section record ancestorSectionIds", 0),
    createdAt: assertNonEmpty(input.createdAt, "CMP section record createdAt"),
    updatedAt: assertNonEmpty(input.updatedAt, "CMP section record updatedAt"),
    metadata: input.metadata,
  };
  validateCmpSectionRecord(record);
  return record;
}

export function createCmpSectionRecordFromSection(input: {
  section: CmpSection;
  lifecycle?: CmpSectionLifecycleState;
  version?: number;
  sourceAnchors?: string[];
  parentSectionId?: string;
  ancestorSectionIds?: string[];
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}): CmpSectionRecord {
  return createCmpSectionRecord({
    sectionId: input.section.id,
    projectId: input.section.projectId,
    agentId: input.section.agentId,
    lifecycle: input.lifecycle ?? "raw",
    version: input.version ?? 1,
    source: input.section.source,
    kind: input.section.kind,
    fidelity: input.section.fidelity,
    lineagePath: input.section.lineagePath,
    payloadRefs: input.section.payloadRefs,
    sourceAnchors: input.sourceAnchors ?? input.section.payloadRefs,
    parentSectionId: input.parentSectionId,
    ancestorSectionIds: input.ancestorSectionIds ?? [],
    createdAt: input.section.createdAt,
    updatedAt: input.updatedAt ?? input.section.createdAt,
    metadata: {
      tags: [...input.section.tags],
      ...(input.section.metadata ?? {}),
      ...(input.metadata ?? {}),
    },
  });
}

export function createCmpSectionRecordFromStoredSection(input: {
  storedSection: CmpStoredSection;
  sectionId?: string;
  sourceSection?: CmpSection;
  lifecycle?: CmpSectionLifecycleState;
  version?: number;
  payloadRefs?: string[];
  sourceAnchors?: string[];
  parentSectionId?: string;
  ancestorSectionIds?: string[];
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}): CmpSectionRecord {
  const sourceSection = input.sourceSection;
  return createCmpSectionRecord({
    sectionId: input.sectionId ?? input.storedSection.id,
    projectId: input.storedSection.projectId,
    agentId: input.storedSection.agentId,
    lifecycle: input.lifecycle ?? "persisted",
    version: input.version ?? 1,
    source: sourceSection?.source ?? "system",
    kind: sourceSection?.kind ?? ((input.storedSection.metadata?.sectionKind as CmpSection["kind"] | undefined) ?? "runtime_context"),
    fidelity: sourceSection?.fidelity ?? ((input.storedSection.metadata?.sectionFidelity as CmpSection["fidelity"] | undefined) ?? "projected"),
    lineagePath: sourceSection?.lineagePath ?? [input.storedSection.agentId],
    payloadRefs: input.payloadRefs ?? sourceSection?.payloadRefs ?? [input.storedSection.storageRef],
    sourceAnchors: input.sourceAnchors ?? [
      input.storedSection.storageRef,
      `${input.storedSection.plane}:${input.storedSection.id}`,
      `source-section:${input.storedSection.sourceSectionId}`,
    ],
    parentSectionId: input.parentSectionId,
    ancestorSectionIds: input.ancestorSectionIds ?? [],
    createdAt: sourceSection?.createdAt ?? input.storedSection.persistedAt,
    updatedAt: input.updatedAt ?? input.storedSection.updatedAt,
    metadata: {
      storedSectionId: input.storedSection.id,
      storageRef: input.storedSection.storageRef,
      plane: input.storedSection.plane,
      state: input.storedSection.state,
      visibility: input.storedSection.visibility,
      ...(sourceSection?.metadata ?? {}),
      ...(input.storedSection.metadata ?? {}),
      ...(input.metadata ?? {}),
    },
  });
}

export function validateCmpSnapshotRecord(record: CmpSnapshotRecord): void {
  assertNonEmpty(record.snapshotId, "CMP snapshot record snapshotId");
  assertNonEmpty(record.projectId, "CMP snapshot record projectId");
  assertNonEmpty(record.agentId, "CMP snapshot record agentId");
  if (!isCmpSnapshotStage(record.stage)) {
    throw new Error(`Unsupported CMP snapshot stage: ${record.stage}.`);
  }
  uniqueStrings(record.sourceSectionIds, "CMP snapshot record sourceSectionIds", 0);
  uniqueStrings(record.sourceAnchors, "CMP snapshot record sourceAnchors");
  assertNonEmpty(record.createdAt, "CMP snapshot record createdAt");
  assertNonEmpty(record.updatedAt, "CMP snapshot record updatedAt");
}

export function createCmpSnapshotRecord(input: CmpSnapshotRecord): CmpSnapshotRecord {
  const record: CmpSnapshotRecord = {
    snapshotId: assertNonEmpty(input.snapshotId, "CMP snapshot record snapshotId"),
    projectId: assertNonEmpty(input.projectId, "CMP snapshot record projectId"),
    agentId: assertNonEmpty(input.agentId, "CMP snapshot record agentId"),
    stage: input.stage,
    sourceSectionIds: uniqueStrings(input.sourceSectionIds, "CMP snapshot record sourceSectionIds", 0),
    sourceAnchors: uniqueStrings(input.sourceAnchors, "CMP snapshot record sourceAnchors"),
    lineageRef: normalizeOptionalString(input.lineageRef),
    branchRef: normalizeOptionalString(input.branchRef),
    commitRef: normalizeOptionalString(input.commitRef),
    createdAt: assertNonEmpty(input.createdAt, "CMP snapshot record createdAt"),
    updatedAt: assertNonEmpty(input.updatedAt, "CMP snapshot record updatedAt"),
    metadata: input.metadata,
  };
  validateCmpSnapshotRecord(record);
  return record;
}

export function createCmpSnapshotRecordFromCheckedSnapshot(input: {
  snapshot: CheckedSnapshot;
  projectId?: string;
  sourceSectionIds?: string[];
  stage?: CmpSnapshotStage;
  sourceAnchors?: string[];
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}): CmpSnapshotRecord {
  const projectId = inferProjectId({
    projectId: input.projectId,
    metadata: input.snapshot.metadata,
    label: "CMP snapshot record bridge",
  });
  return createCmpSnapshotRecord({
    snapshotId: input.snapshot.snapshotId,
    projectId,
    agentId: input.snapshot.agentId,
    stage: input.stage ?? "checked",
    sourceSectionIds: input.sourceSectionIds ?? [],
    sourceAnchors: input.sourceAnchors ?? [
      input.snapshot.snapshotId,
      input.snapshot.branchRef,
      input.snapshot.commitRef,
    ],
    lineageRef: input.snapshot.lineageRef,
    branchRef: input.snapshot.branchRef,
    commitRef: input.snapshot.commitRef,
    createdAt: input.createdAt ?? input.snapshot.checkedAt,
    updatedAt: input.updatedAt ?? input.snapshot.checkedAt,
    metadata: {
      qualityLabel: input.snapshot.qualityLabel,
      promotable: input.snapshot.promotable,
      ...(input.snapshot.metadata ?? {}),
      ...(input.metadata ?? {}),
    },
  });
}

export function validateCmpPackageRecord(record: CmpPackageRecord): void {
  assertNonEmpty(record.packageId, "CMP package record packageId");
  assertNonEmpty(record.projectId, "CMP package record projectId");
  assertNonEmpty(record.sourceProjectionId, "CMP package record sourceProjectionId");
  assertNonEmpty(record.targetAgentId, "CMP package record targetAgentId");
  assertNonEmpty(record.packageRef, "CMP package record packageRef");
  if (!isCmpPackageStatus(record.status)) {
    throw new Error(`Unsupported CMP package record status: ${record.status}.`);
  }
  uniqueStrings(record.sourceSectionIds, "CMP package record sourceSectionIds", 0);
  uniqueStrings(record.sourceAnchors, "CMP package record sourceAnchors");
  assertNonEmpty(record.createdAt, "CMP package record createdAt");
  assertNonEmpty(record.updatedAt, "CMP package record updatedAt");
}

export function createCmpPackageRecord(input: CmpPackageRecord): CmpPackageRecord {
  const record: CmpPackageRecord = {
    packageId: assertNonEmpty(input.packageId, "CMP package record packageId"),
    projectId: assertNonEmpty(input.projectId, "CMP package record projectId"),
    sourceProjectionId: assertNonEmpty(input.sourceProjectionId, "CMP package record sourceProjectionId"),
    targetAgentId: assertNonEmpty(input.targetAgentId, "CMP package record targetAgentId"),
    packageKind: input.packageKind,
    packageRef: assertNonEmpty(input.packageRef, "CMP package record packageRef"),
    fidelityLabel: input.fidelityLabel,
    status: input.status,
    sourceSnapshotId: normalizeOptionalString(input.sourceSnapshotId),
    sourceSectionIds: uniqueStrings(input.sourceSectionIds, "CMP package record sourceSectionIds", 0),
    sourceAnchors: uniqueStrings(input.sourceAnchors, "CMP package record sourceAnchors"),
    createdAt: assertNonEmpty(input.createdAt, "CMP package record createdAt"),
    updatedAt: assertNonEmpty(input.updatedAt, "CMP package record updatedAt"),
    metadata: input.metadata,
  };
  validateCmpPackageRecord(record);
  return record;
}

export function advanceCmpPackageRecordStatus(input: {
  record: CmpPackageRecord;
  nextStatus: CmpPackageStatus;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}): CmpPackageRecord {
  const order: CmpPackageStatus[] = ["materialized", "dispatched", "served"];
  const currentIndex = order.indexOf(input.record.status);
  const nextIndex = order.indexOf(input.nextStatus);
  if (nextIndex < currentIndex) {
    throw new Error(`CMP package record cannot move backwards from ${input.record.status} to ${input.nextStatus}.`);
  }
  return createCmpPackageRecord({
    ...input.record,
    status: input.nextStatus,
    updatedAt: input.updatedAt,
    metadata: input.metadata ?? input.record.metadata,
  });
}

export function createCmpRequestRecordFromIngest(input: {
  requestId: string;
  ingest: IngestRuntimeContextInput;
  status?: CmpRequestStatus;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}): CmpRequestRecord {
  const createdAt = input.createdAt ?? new Date().toISOString();
  return createCmpRequestRecord({
    requestId: input.requestId,
    projectId: input.ingest.lineage.projectId,
    requesterAgentId: input.ingest.agentId,
    requestKind: "active_ingest",
    status: input.status ?? "accepted",
    sourceAnchors: input.ingest.materials.map((material) => material.ref),
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
    metadata: {
      sessionId: input.ingest.sessionId,
      runId: input.ingest.runId,
      taskSummary: input.ingest.taskSummary,
      materialKinds: input.ingest.materials.map((material) => material.kind),
      requiresActiveSync: input.ingest.requiresActiveSync ?? true,
      ...(input.ingest.metadata ?? {}),
      ...(input.metadata ?? {}),
    },
  });
}

export function createCmpRequestRecordFromHistoricalRequest(input: {
  requestId: string;
  request: RequestHistoricalContextInput;
  status?: CmpRequestStatus;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}): CmpRequestRecord {
  const createdAt = input.createdAt ?? new Date().toISOString();
  return createCmpRequestRecord({
    requestId: input.requestId,
    projectId: input.request.projectId,
    requesterAgentId: input.request.requesterAgentId,
    requestKind: "historical_context",
    status: input.status ?? "reviewed",
    sourceAnchors: uniqueStrings([
      input.request.reason,
      input.request.query.snapshotId ?? "",
      input.request.query.lineageRef ?? "",
      input.request.query.branchRef ?? "",
    ], "CMP historical request sourceAnchors"),
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
    metadata: {
      reason: input.request.reason,
      query: input.request.query,
      ...(input.request.metadata ?? {}),
      ...(input.metadata ?? {}),
    },
  });
}

export function createCmpPackageRecordFromContextPackage(input: {
  contextPackage: ContextPackage;
  projectId?: string;
  sourceSnapshotId?: string;
  sourceSectionIds?: string[];
  status?: CmpPackageStatus;
  sourceAnchors?: string[];
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}): CmpPackageRecord {
  const projectId = inferProjectId({
    projectId: input.projectId,
    metadata: input.contextPackage.metadata,
    label: "CMP package record bridge",
  });
  return createCmpPackageRecord({
    packageId: input.contextPackage.packageId,
    projectId,
    sourceProjectionId: input.contextPackage.sourceProjectionId,
    targetAgentId: input.contextPackage.targetAgentId,
    packageKind: input.contextPackage.packageKind,
    packageRef: input.contextPackage.packageRef,
    fidelityLabel: input.contextPackage.fidelityLabel,
    status: input.status ?? "materialized",
    sourceSnapshotId: input.sourceSnapshotId,
    sourceSectionIds: input.sourceSectionIds ?? [],
    sourceAnchors: input.sourceAnchors ?? [
      input.contextPackage.packageRef,
      input.contextPackage.packageId,
    ],
    createdAt: input.contextPackage.createdAt,
    updatedAt: input.updatedAt ?? input.contextPackage.createdAt,
    metadata: {
      ...(input.contextPackage.metadata ?? {}),
      ...(input.metadata ?? {}),
    },
  });
}
