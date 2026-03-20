export const CMP_NEIGHBOR_RELATIONS = [
  "parent",
  "peer",
  "child",
] as const;
export type CmpNeighborRelation = (typeof CMP_NEIGHBOR_RELATIONS)[number];

export const CMP_ACTIVE_LINE_STAGES = [
  "captured",
  "queued_for_git",
  "written_to_git",
  "candidate_ready",
  "checked_ready",
  "promoted_pending",
] as const;
export type CmpActiveLineStage = (typeof CMP_ACTIVE_LINE_STAGES)[number];

export const CMP_PROJECTION_VISIBILITIES = [
  "local_only",
  "submitted_to_parent",
  "accepted_by_parent",
  "promoted_by_parent",
  "dispatched_downward",
  "archived",
] as const;
export type CmpProjectionVisibility = (typeof CMP_PROJECTION_VISIBILITIES)[number];

export const CMP_DELIVERY_STATUSES = [
  "prepared",
  "delivered",
  "acknowledged",
  "rejected",
] as const;
export type CmpDeliveryStatus = (typeof CMP_DELIVERY_STATUSES)[number];

export interface CmpLineageNode {
  projectId: string;
  agentId: string;
  parentAgentId?: string;
  depth: number;
  childAgentIds?: string[];
  peerAgentIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface CmpPayloadRef {
  ref: string;
  kind: string;
  metadata?: Record<string, unknown>;
}

export interface CmpGitUpdateRef {
  branchRef: string;
  commitRef?: string;
  pullRequestRef?: string;
  mergeRef?: string;
  metadata?: Record<string, unknown>;
}

function normalizeStringArray(values?: string[]): string[] | undefined {
  if (!values) {
    return undefined;
  }

  const normalized = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  return normalized.length > 0 ? normalized : undefined;
}

export function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

export function validateCmpLineageNode(node: CmpLineageNode): void {
  assertNonEmpty(node.projectId, "CMP lineage projectId");
  assertNonEmpty(node.agentId, "CMP lineage agentId");
  if (!Number.isInteger(node.depth) || node.depth < 0) {
    throw new Error("CMP lineage depth must be a non-negative integer.");
  }
  if (node.depth === 0 && node.parentAgentId) {
    throw new Error("CMP root lineage cannot carry a parentAgentId.");
  }
  if (node.depth > 0 && !node.parentAgentId?.trim()) {
    throw new Error("CMP non-root lineage requires a parentAgentId.");
  }
}

export function createCmpLineageNode(input: CmpLineageNode): CmpLineageNode {
  const node: CmpLineageNode = {
    projectId: assertNonEmpty(input.projectId, "CMP lineage projectId"),
    agentId: assertNonEmpty(input.agentId, "CMP lineage agentId"),
    parentAgentId: input.parentAgentId?.trim() || undefined,
    depth: input.depth,
    childAgentIds: normalizeStringArray(input.childAgentIds),
    peerAgentIds: normalizeStringArray(input.peerAgentIds),
    metadata: input.metadata,
  };
  validateCmpLineageNode(node);
  return node;
}

export function validateCmpPayloadRef(payloadRef: CmpPayloadRef): void {
  assertNonEmpty(payloadRef.ref, "CMP payload ref");
  assertNonEmpty(payloadRef.kind, "CMP payload kind");
}

export function createCmpPayloadRef(input: CmpPayloadRef): CmpPayloadRef {
  const payloadRef: CmpPayloadRef = {
    ref: assertNonEmpty(input.ref, "CMP payload ref"),
    kind: assertNonEmpty(input.kind, "CMP payload kind"),
    metadata: input.metadata,
  };
  validateCmpPayloadRef(payloadRef);
  return payloadRef;
}

export function validateCmpGitUpdateRef(ref: CmpGitUpdateRef): void {
  assertNonEmpty(ref.branchRef, "CMP git update branchRef");
  if (!ref.commitRef && !ref.pullRequestRef && !ref.mergeRef) {
    throw new Error("CMP git update ref requires at least one commitRef, pullRequestRef, or mergeRef.");
  }
}

export function createCmpGitUpdateRef(input: CmpGitUpdateRef): CmpGitUpdateRef {
  const ref: CmpGitUpdateRef = {
    branchRef: assertNonEmpty(input.branchRef, "CMP git update branchRef"),
    commitRef: input.commitRef?.trim() || undefined,
    pullRequestRef: input.pullRequestRef?.trim() || undefined,
    mergeRef: input.mergeRef?.trim() || undefined,
    metadata: input.metadata,
  };
  validateCmpGitUpdateRef(ref);
  return ref;
}

export function isCmpNeighborRelation(value: string): value is CmpNeighborRelation {
  return CMP_NEIGHBOR_RELATIONS.includes(value as CmpNeighborRelation);
}

