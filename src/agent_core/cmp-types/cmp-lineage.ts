import type { SessionId } from "../types/index.js";

export const CMP_BRANCH_LAYERS = [
  "work",
  "cmp",
  "mp",
  "tap",
] as const;
export type CmpBranchLayer = (typeof CMP_BRANCH_LAYERS)[number];

export const CMP_AGENT_LINEAGE_STATUSES = [
  "active",
  "paused",
  "completed",
  "archived",
] as const;
export type CmpAgentLineageStatus = (typeof CMP_AGENT_LINEAGE_STATUSES)[number];

export interface CmpBranchFamily {
  workBranch: string;
  cmpBranch: string;
  mpBranch: string;
  tapBranch: string;
  metadata?: Record<string, unknown>;
}

export interface CreateCmpBranchFamilyInput {
  workBranch: string;
  cmpBranch: string;
  mpBranch: string;
  tapBranch: string;
  metadata?: Record<string, unknown>;
}

export interface AgentLineage {
  agentId: string;
  parentAgentId?: string;
  depth: number;
  projectId: string;
  rootSessionId?: SessionId;
  branchFamily: CmpBranchFamily;
  childAgentIds?: string[];
  status: CmpAgentLineageStatus;
  metadata?: Record<string, unknown>;
}

export interface CreateAgentLineageInput {
  agentId: string;
  parentAgentId?: string;
  depth: number;
  projectId: string;
  rootSessionId?: SessionId;
  branchFamily: CmpBranchFamily | CreateCmpBranchFamilyInput;
  childAgentIds?: string[];
  status?: CmpAgentLineageStatus;
  metadata?: Record<string, unknown>;
}

function normalizeStringArray(values?: string[]): string[] | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }

  const normalized = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  return normalized.length > 0 ? normalized : undefined;
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

export function isCmpBranchLayer(value: string): value is CmpBranchLayer {
  return CMP_BRANCH_LAYERS.includes(value as CmpBranchLayer);
}

export function isCmpAgentLineageStatus(value: string): value is CmpAgentLineageStatus {
  return CMP_AGENT_LINEAGE_STATUSES.includes(value as CmpAgentLineageStatus);
}

export function validateCmpBranchFamily(branchFamily: CmpBranchFamily): void {
  assertNonEmpty(branchFamily.workBranch, "CMP branch family workBranch");
  assertNonEmpty(branchFamily.cmpBranch, "CMP branch family cmpBranch");
  assertNonEmpty(branchFamily.mpBranch, "CMP branch family mpBranch");
  assertNonEmpty(branchFamily.tapBranch, "CMP branch family tapBranch");
}

export function createCmpBranchFamily(input: CreateCmpBranchFamilyInput): CmpBranchFamily {
  const branchFamily: CmpBranchFamily = {
    workBranch: assertNonEmpty(input.workBranch, "CMP branch family workBranch"),
    cmpBranch: assertNonEmpty(input.cmpBranch, "CMP branch family cmpBranch"),
    mpBranch: assertNonEmpty(input.mpBranch, "CMP branch family mpBranch"),
    tapBranch: assertNonEmpty(input.tapBranch, "CMP branch family tapBranch"),
    metadata: input.metadata,
  };

  validateCmpBranchFamily(branchFamily);
  return branchFamily;
}

export function validateAgentLineage(lineage: AgentLineage): void {
  assertNonEmpty(lineage.agentId, "CMP AgentLineage agentId");
  assertNonEmpty(lineage.projectId, "CMP AgentLineage projectId");
  if (!Number.isInteger(lineage.depth) || lineage.depth < 0) {
    throw new Error("CMP AgentLineage depth must be an integer greater than or equal to 0.");
  }
  if (lineage.parentAgentId !== undefined) {
    assertNonEmpty(lineage.parentAgentId, "CMP AgentLineage parentAgentId");
    if (lineage.parentAgentId === lineage.agentId) {
      throw new Error("CMP AgentLineage parentAgentId cannot equal agentId.");
    }
  }
  if (!isCmpAgentLineageStatus(lineage.status)) {
    throw new Error(`Unsupported CMP AgentLineage status: ${lineage.status}.`);
  }
  validateCmpBranchFamily(lineage.branchFamily);
}

export function createAgentLineage(input: CreateAgentLineageInput): AgentLineage {
  const lineage: AgentLineage = {
    agentId: assertNonEmpty(input.agentId, "CMP AgentLineage agentId"),
    parentAgentId: input.parentAgentId?.trim() || undefined,
    depth: input.depth,
    projectId: assertNonEmpty(input.projectId, "CMP AgentLineage projectId"),
    rootSessionId: input.rootSessionId,
    branchFamily: "workBranch" in input.branchFamily
      ? createCmpBranchFamily(input.branchFamily)
      : createCmpBranchFamily(input.branchFamily),
    childAgentIds: normalizeStringArray(input.childAgentIds),
    status: input.status ?? "active",
    metadata: input.metadata,
  };

  validateAgentLineage(lineage);
  return lineage;
}
