export const CMP_FIVE_AGENT_ROLES = [
  "icma",
  "iterator",
  "checker",
  "dbagent",
  "dispatcher",
] as const;

export type CmpFiveAgentRole = (typeof CMP_FIVE_AGENT_ROLES)[number];

export const CMP_FIVE_AGENT_MANAGEMENT_ACTIONS = [
  "pause",
  "resume",
  "retry",
  "rebuild",
] as const;

export type CmpRoleAdminAction = (typeof CMP_FIVE_AGENT_MANAGEMENT_ACTIONS)[number];

export interface CmpFiveAgentLoopRecord<TStage extends string = string> {
  loopId: string;
  role: CmpFiveAgentRole;
  agentId: string;
  projectId?: string;
  stage: TStage;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface CmpFiveAgentCheckpointRecord {
  checkpointId: string;
  role: CmpFiveAgentRole;
  agentId: string;
  stage: string;
  createdAt: string;
  eventRef: string;
  loopId?: string;
  metadata?: Record<string, unknown>;
}

export interface CmpOverrideAuditRecord {
  overrideId: string;
  role: CmpFiveAgentRole;
  agentId: string;
  action: CmpRoleAdminAction;
  actor: string;
  reason: string;
  scope: "loop_control" | "decision_state" | "routing_state";
  createdAt: string;
  beforeState: Record<string, unknown>;
  afterState: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface CmpPackageFamilyRecord {
  familyId: string;
  primaryPackageId: string;
  primaryPackageRef: string;
  timelinePackageId?: string;
  timelinePackageRef?: string;
  taskSnapshotIds: string[];
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface CmpSkillSnapshotRecord {
  snapshotId: string;
  taskRef: string;
  summaryRef: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface CmpPromoteReviewRecord {
  reviewId: string;
  reviewerRole: "dbagent";
  sourceAgentId: string;
  targetParentAgentId: string;
  candidateId: string;
  checkedSnapshotId: string;
  status: "pending_parent_dbagent_review" | "ready";
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface CmpPeerExchangeApprovalRecord {
  approvalId: string;
  parentAgentId: string;
  sourceAgentId: string;
  targetAgentId: string;
  packageId: string;
  createdAt: string;
  mode: "explicit_once";
  status?: "pending_parent_core_approval" | "approved" | "rejected";
  approvalChain?: "parent_dbagent_then_parent_core_agent";
  targetIngress?: "child_icma_only" | "peer_exchange";
  approvedAt?: string;
  approvedByAgentId?: string;
  decisionNote?: string;
  packageMode?: "peer_exchange_slim";
  currentStateSummary?: string;
  metadata?: Record<string, unknown>;
}

export interface CmpReinterventionRequestRecord {
  requestId: string;
  parentAgentId: string;
  childAgentId: string;
  requestedByRole: "dbagent";
  status: "pending_parent_dbagent_review" | "served";
  gapSummary: string;
  currentStateSummary: string;
  currentPackageId?: string;
  createdAt: string;
  resolvedAt?: string;
  servedPackageId?: string;
  metadata?: Record<string, unknown>;
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

export function createCmpFiveAgentLoopRecord<TStage extends string>(input: CmpFiveAgentLoopRecord<TStage>): CmpFiveAgentLoopRecord<TStage> {
  return {
    ...input,
    loopId: assertNonEmpty(input.loopId, "CMP five-agent loopId"),
    agentId: assertNonEmpty(input.agentId, "CMP five-agent agentId"),
    createdAt: assertNonEmpty(input.createdAt, "CMP five-agent createdAt"),
    updatedAt: assertNonEmpty(input.updatedAt, "CMP five-agent updatedAt"),
  };
}

export function createCmpRoleCheckpointRecord(input: CmpFiveAgentCheckpointRecord): CmpFiveAgentCheckpointRecord {
  return {
    ...input,
    checkpointId: assertNonEmpty(input.checkpointId, "CMP checkpoint checkpointId"),
    agentId: assertNonEmpty(input.agentId, "CMP checkpoint agentId"),
    stage: assertNonEmpty(input.stage, "CMP checkpoint stage"),
    createdAt: assertNonEmpty(input.createdAt, "CMP checkpoint createdAt"),
    eventRef: assertNonEmpty(input.eventRef, "CMP checkpoint eventRef"),
    loopId: input.loopId?.trim() || undefined,
  };
}

export function createCmpPackageFamilyRecord(input: CmpPackageFamilyRecord): CmpPackageFamilyRecord {
  return {
    ...input,
    familyId: assertNonEmpty(input.familyId, "CMP package familyId"),
    primaryPackageId: assertNonEmpty(input.primaryPackageId, "CMP primaryPackageId"),
    primaryPackageRef: assertNonEmpty(input.primaryPackageRef, "CMP primaryPackageRef"),
    timelinePackageId: input.timelinePackageId?.trim() || undefined,
    timelinePackageRef: input.timelinePackageRef?.trim() || undefined,
    taskSnapshotIds: [...new Set(input.taskSnapshotIds.map((value) => value.trim()).filter(Boolean))],
    createdAt: assertNonEmpty(input.createdAt, "CMP package family createdAt"),
  };
}

export function createCmpSkillSnapshotRecord(input: CmpSkillSnapshotRecord): CmpSkillSnapshotRecord {
  return {
    ...input,
    snapshotId: assertNonEmpty(input.snapshotId, "CMP skill snapshotId"),
    taskRef: assertNonEmpty(input.taskRef, "CMP skill taskRef"),
    summaryRef: assertNonEmpty(input.summaryRef, "CMP skill summaryRef"),
    createdAt: assertNonEmpty(input.createdAt, "CMP skill createdAt"),
  };
}

export function createCmpPromoteReviewRecord(input: CmpPromoteReviewRecord): CmpPromoteReviewRecord {
  return {
    ...input,
    reviewId: assertNonEmpty(input.reviewId, "CMP promote reviewId"),
    sourceAgentId: assertNonEmpty(input.sourceAgentId, "CMP promote sourceAgentId"),
    targetParentAgentId: assertNonEmpty(input.targetParentAgentId, "CMP promote targetParentAgentId"),
    candidateId: assertNonEmpty(input.candidateId, "CMP promote candidateId"),
    checkedSnapshotId: assertNonEmpty(input.checkedSnapshotId, "CMP promote checkedSnapshotId"),
    createdAt: assertNonEmpty(input.createdAt, "CMP promote createdAt"),
  };
}

export function createCmpPeerExchangeApprovalRecord(input: CmpPeerExchangeApprovalRecord): CmpPeerExchangeApprovalRecord {
  return {
    ...input,
    approvalId: assertNonEmpty(input.approvalId, "CMP peer approvalId"),
    parentAgentId: assertNonEmpty(input.parentAgentId, "CMP peer parentAgentId"),
    sourceAgentId: assertNonEmpty(input.sourceAgentId, "CMP peer sourceAgentId"),
    targetAgentId: assertNonEmpty(input.targetAgentId, "CMP peer targetAgentId"),
    packageId: assertNonEmpty(input.packageId, "CMP peer packageId"),
    createdAt: assertNonEmpty(input.createdAt, "CMP peer createdAt"),
    approvedAt: input.approvedAt?.trim() || undefined,
    approvedByAgentId: input.approvedByAgentId?.trim() || undefined,
    decisionNote: input.decisionNote?.trim() || undefined,
    currentStateSummary: input.currentStateSummary?.trim() || undefined,
  };
}

export function createCmpReinterventionRequestRecord(input: CmpReinterventionRequestRecord): CmpReinterventionRequestRecord {
  return {
    ...input,
    requestId: assertNonEmpty(input.requestId, "CMP reintervention requestId"),
    parentAgentId: assertNonEmpty(input.parentAgentId, "CMP reintervention parentAgentId"),
    childAgentId: assertNonEmpty(input.childAgentId, "CMP reintervention childAgentId"),
    gapSummary: assertNonEmpty(input.gapSummary, "CMP reintervention gapSummary"),
    currentStateSummary: assertNonEmpty(input.currentStateSummary, "CMP reintervention currentStateSummary"),
    currentPackageId: input.currentPackageId?.trim() || undefined,
    createdAt: assertNonEmpty(input.createdAt, "CMP reintervention createdAt"),
    resolvedAt: input.resolvedAt?.trim() || undefined,
    servedPackageId: input.servedPackageId?.trim() || undefined,
  };
}
