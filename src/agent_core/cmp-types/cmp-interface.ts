import type { RunId, SessionId } from "../types/index.js";
import type { AgentLineage } from "./cmp-lineage.js";
import type { CheckedSnapshot, ContextDelta } from "./cmp-context.js";
import type { ContextPackage, DispatchReceipt } from "./cmp-delivery.js";

export const CMP_RUNTIME_CONTEXT_MATERIAL_KINDS = [
  "user_input",
  "system_prompt",
  "assistant_output",
  "tool_result",
  "state_marker",
  "context_package",
] as const;
export type CmpRuntimeContextMaterialKind = (typeof CMP_RUNTIME_CONTEXT_MATERIAL_KINDS)[number];

export const CMP_INTERFACE_RESULT_STATUSES = [
  "accepted",
  "resolved",
  "materialized",
  "dispatched",
  "not_found",
  "rejected",
] as const;
export type CmpInterfaceResultStatus = (typeof CMP_INTERFACE_RESULT_STATUSES)[number];

export const CMP_DISPATCH_TARGET_KINDS = [
  "core_agent",
  "parent",
  "peer",
  "child",
] as const;
export type CmpDispatchTargetKind = (typeof CMP_DISPATCH_TARGET_KINDS)[number];

export interface CmpRuntimeContextMaterial {
  kind: CmpRuntimeContextMaterialKind;
  ref: string;
  metadata?: Record<string, unknown>;
}

export interface CmpHistoricalContextQuery {
  snapshotId?: string;
  lineageRef?: string;
  branchRef?: string;
  packageKindHint?: string;
  projectionVisibilityHint?: string;
  metadata?: Record<string, unknown>;
}

export interface IngestRuntimeContextInput {
  agentId: string;
  sessionId: SessionId;
  runId?: RunId;
  lineage: AgentLineage;
  taskSummary: string;
  materials: CmpRuntimeContextMaterial[];
  requiresActiveSync?: boolean;
  metadata?: Record<string, unknown>;
}

export interface IngestRuntimeContextResult {
  status: CmpInterfaceResultStatus;
  acceptedEventIds: string[];
  nextAction: "commit_context_delta" | "noop";
  metadata?: Record<string, unknown>;
}

export interface CommitContextDeltaInput {
  agentId: string;
  sessionId: SessionId;
  runId?: RunId;
  eventIds: string[];
  baseRef?: string;
  changeSummary: string;
  syncIntent: ContextDelta["syncIntent"];
  metadata?: Record<string, unknown>;
}

export interface CommitContextDeltaResult {
  status: CmpInterfaceResultStatus;
  delta: ContextDelta;
  snapshotCandidateId?: string;
  metadata?: Record<string, unknown>;
}

export interface ResolveCheckedSnapshotInput {
  agentId: string;
  projectId: string;
  lineageRef?: string;
  branchRef?: string;
  metadata?: Record<string, unknown>;
}

export interface ResolveCheckedSnapshotResult {
  status: CmpInterfaceResultStatus;
  found: boolean;
  snapshot?: CheckedSnapshot;
  metadata?: Record<string, unknown>;
}

export interface MaterializeContextPackageInput {
  agentId: string;
  snapshotId: string;
  projectionId?: string;
  targetAgentId: string;
  packageKind: ContextPackage["packageKind"];
  fidelityLabel?: ContextPackage["fidelityLabel"];
  metadata?: Record<string, unknown>;
}

export interface MaterializeContextPackageResult {
  status: CmpInterfaceResultStatus;
  contextPackage: ContextPackage;
  metadata?: Record<string, unknown>;
}

export interface DispatchContextPackageInput {
  agentId: string;
  packageId: string;
  sourceAgentId: string;
  targetAgentId: string;
  targetKind: CmpDispatchTargetKind;
  metadata?: Record<string, unknown>;
}

export interface DispatchContextPackageResult {
  status: CmpInterfaceResultStatus;
  receipt: DispatchReceipt;
  metadata?: Record<string, unknown>;
}

export interface RequestHistoricalContextInput {
  requesterAgentId: string;
  projectId: string;
  reason: string;
  query: CmpHistoricalContextQuery;
  metadata?: Record<string, unknown>;
}

export interface RequestHistoricalContextResult {
  status: CmpInterfaceResultStatus;
  found: boolean;
  snapshot?: CheckedSnapshot;
  contextPackage?: ContextPackage;
  metadata?: Record<string, unknown>;
}

export interface CmpCoreInterface {
  ingestRuntimeContext(input: IngestRuntimeContextInput): Promise<IngestRuntimeContextResult> | IngestRuntimeContextResult;
  commitContextDelta(input: CommitContextDeltaInput): Promise<CommitContextDeltaResult> | CommitContextDeltaResult;
  resolveCheckedSnapshot(input: ResolveCheckedSnapshotInput): Promise<ResolveCheckedSnapshotResult> | ResolveCheckedSnapshotResult;
  materializeContextPackage(input: MaterializeContextPackageInput): Promise<MaterializeContextPackageResult> | MaterializeContextPackageResult;
  dispatchContextPackage(input: DispatchContextPackageInput): Promise<DispatchContextPackageResult> | DispatchContextPackageResult;
  requestHistoricalContext(input: RequestHistoricalContextInput): Promise<RequestHistoricalContextResult> | RequestHistoricalContextResult;
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

function normalizeMaterials(materials: CmpRuntimeContextMaterial[]): CmpRuntimeContextMaterial[] {
  if (materials.length === 0) {
    throw new Error("CMP interface ingestRuntimeContext requires at least one material.");
  }

  return materials.map((material) => {
    if (!CMP_RUNTIME_CONTEXT_MATERIAL_KINDS.includes(material.kind)) {
      throw new Error(`Unsupported CMP runtime context material kind: ${material.kind}.`);
    }
    return {
      kind: material.kind,
      ref: assertNonEmpty(material.ref, "CMP runtime context material ref"),
      metadata: material.metadata,
    };
  });
}

export function isCmpInterfaceResultStatus(value: string): value is CmpInterfaceResultStatus {
  return CMP_INTERFACE_RESULT_STATUSES.includes(value as CmpInterfaceResultStatus);
}

export function isCmpDispatchTargetKind(value: string): value is CmpDispatchTargetKind {
  return CMP_DISPATCH_TARGET_KINDS.includes(value as CmpDispatchTargetKind);
}

export function validateIngestRuntimeContextInput(input: IngestRuntimeContextInput): void {
  assertNonEmpty(input.agentId, "CMP ingestRuntimeContext agentId");
  assertNonEmpty(input.taskSummary, "CMP ingestRuntimeContext taskSummary");
  normalizeMaterials(input.materials);
}

export function createIngestRuntimeContextInput(input: IngestRuntimeContextInput): IngestRuntimeContextInput {
  const normalized: IngestRuntimeContextInput = {
    ...input,
    agentId: assertNonEmpty(input.agentId, "CMP ingestRuntimeContext agentId"),
    taskSummary: assertNonEmpty(input.taskSummary, "CMP ingestRuntimeContext taskSummary"),
    materials: normalizeMaterials(input.materials),
  };

  validateIngestRuntimeContextInput(normalized);
  return normalized;
}

export function validateIngestRuntimeContextResult(result: IngestRuntimeContextResult): void {
  if (!isCmpInterfaceResultStatus(result.status)) {
    throw new Error(`Unsupported CMP ingestRuntimeContext result status: ${result.status}.`);
  }
}

export function createIngestRuntimeContextResult(input: IngestRuntimeContextResult): IngestRuntimeContextResult {
  validateIngestRuntimeContextResult(input);
  return {
    ...input,
    acceptedEventIds: [...new Set(input.acceptedEventIds.map((eventId) => assertNonEmpty(eventId, "CMP ingestRuntimeContext acceptedEventId")))],
  };
}

export function validateCommitContextDeltaInput(input: CommitContextDeltaInput): void {
  assertNonEmpty(input.agentId, "CMP commitContextDelta agentId");
  assertNonEmpty(input.changeSummary, "CMP commitContextDelta changeSummary");
  if (input.eventIds.length === 0) {
    throw new Error("CMP commitContextDelta requires at least one eventId.");
  }
}

export function createCommitContextDeltaInput(input: CommitContextDeltaInput): CommitContextDeltaInput {
  const normalized: CommitContextDeltaInput = {
    ...input,
    agentId: assertNonEmpty(input.agentId, "CMP commitContextDelta agentId"),
    changeSummary: assertNonEmpty(input.changeSummary, "CMP commitContextDelta changeSummary"),
    eventIds: [...new Set(input.eventIds.map((eventId) => assertNonEmpty(eventId, "CMP commitContextDelta eventId")))],
    baseRef: input.baseRef?.trim() || undefined,
  };

  validateCommitContextDeltaInput(normalized);
  return normalized;
}

export function validateResolveCheckedSnapshotInput(input: ResolveCheckedSnapshotInput): void {
  assertNonEmpty(input.agentId, "CMP resolveCheckedSnapshot agentId");
  assertNonEmpty(input.projectId, "CMP resolveCheckedSnapshot projectId");
}

export function createResolveCheckedSnapshotInput(
  input: ResolveCheckedSnapshotInput,
): ResolveCheckedSnapshotInput {
  const normalized: ResolveCheckedSnapshotInput = {
    ...input,
    agentId: assertNonEmpty(input.agentId, "CMP resolveCheckedSnapshot agentId"),
    projectId: assertNonEmpty(input.projectId, "CMP resolveCheckedSnapshot projectId"),
    lineageRef: input.lineageRef?.trim() || undefined,
    branchRef: input.branchRef?.trim() || undefined,
  };

  validateResolveCheckedSnapshotInput(normalized);
  return normalized;
}

export function validateMaterializeContextPackageInput(input: MaterializeContextPackageInput): void {
  assertNonEmpty(input.agentId, "CMP materializeContextPackage agentId");
  assertNonEmpty(input.snapshotId, "CMP materializeContextPackage snapshotId");
  assertNonEmpty(input.targetAgentId, "CMP materializeContextPackage targetAgentId");
}

export function createMaterializeContextPackageInput(
  input: MaterializeContextPackageInput,
): MaterializeContextPackageInput {
  const normalized: MaterializeContextPackageInput = {
    ...input,
    agentId: assertNonEmpty(input.agentId, "CMP materializeContextPackage agentId"),
    snapshotId: assertNonEmpty(input.snapshotId, "CMP materializeContextPackage snapshotId"),
    projectionId: input.projectionId?.trim() || undefined,
    targetAgentId: assertNonEmpty(input.targetAgentId, "CMP materializeContextPackage targetAgentId"),
  };

  validateMaterializeContextPackageInput(normalized);
  return normalized;
}

export function validateDispatchContextPackageInput(input: DispatchContextPackageInput): void {
  assertNonEmpty(input.agentId, "CMP dispatchContextPackage agentId");
  assertNonEmpty(input.packageId, "CMP dispatchContextPackage packageId");
  assertNonEmpty(input.sourceAgentId, "CMP dispatchContextPackage sourceAgentId");
  assertNonEmpty(input.targetAgentId, "CMP dispatchContextPackage targetAgentId");
  if (!isCmpDispatchTargetKind(input.targetKind)) {
    throw new Error(`Unsupported CMP dispatchContextPackage targetKind: ${input.targetKind}.`);
  }
}

export function createDispatchContextPackageInput(
  input: DispatchContextPackageInput,
): DispatchContextPackageInput {
  const normalized: DispatchContextPackageInput = {
    ...input,
    agentId: assertNonEmpty(input.agentId, "CMP dispatchContextPackage agentId"),
    packageId: assertNonEmpty(input.packageId, "CMP dispatchContextPackage packageId"),
    sourceAgentId: assertNonEmpty(input.sourceAgentId, "CMP dispatchContextPackage sourceAgentId"),
    targetAgentId: assertNonEmpty(input.targetAgentId, "CMP dispatchContextPackage targetAgentId"),
  };

  validateDispatchContextPackageInput(normalized);
  return normalized;
}

export function validateRequestHistoricalContextInput(input: RequestHistoricalContextInput): void {
  assertNonEmpty(input.requesterAgentId, "CMP requestHistoricalContext requesterAgentId");
  assertNonEmpty(input.projectId, "CMP requestHistoricalContext projectId");
  assertNonEmpty(input.reason, "CMP requestHistoricalContext reason");
}

export function createRequestHistoricalContextInput(
  input: RequestHistoricalContextInput,
): RequestHistoricalContextInput {
  const normalized: RequestHistoricalContextInput = {
    ...input,
    requesterAgentId: assertNonEmpty(input.requesterAgentId, "CMP requestHistoricalContext requesterAgentId"),
    projectId: assertNonEmpty(input.projectId, "CMP requestHistoricalContext projectId"),
    reason: assertNonEmpty(input.reason, "CMP requestHistoricalContext reason"),
  };

  validateRequestHistoricalContextInput(normalized);
  return normalized;
}
