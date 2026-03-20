import { randomUUID } from "node:crypto";

import type { RunId, SessionId } from "../types/index.js";

export const CMP_GIT_REPO_STRATEGIES = [
  "single_project_repo",
] as const;
export type CmpGitRepoStrategy = (typeof CMP_GIT_REPO_STRATEGIES)[number];

export const CMP_GIT_BRANCH_KINDS = [
  "work",
  "cmp",
  "mp",
  "tap",
] as const;
export type CmpGitBranchKind = (typeof CMP_GIT_BRANCH_KINDS)[number];

export const CMP_GIT_LINEAGE_STATUSES = [
  "active",
  "suspended",
  "archived",
] as const;
export type CmpGitLineageStatus = (typeof CMP_GIT_LINEAGE_STATUSES)[number];

export const CMP_GIT_SYNC_INTENTS = [
  "local_record",
  "submit_to_parent",
  "peer_exchange",
  "seed_children",
] as const;
export type CmpGitSyncIntent = (typeof CMP_GIT_SYNC_INTENTS)[number];

export const CMP_GIT_CANDIDATE_STATUSES = [
  "pending_check",
  "checked",
  "rejected",
] as const;
export type CmpGitSnapshotCandidateStatus = (typeof CMP_GIT_CANDIDATE_STATUSES)[number];

export interface CmpGitProjectRepo {
  projectId: string;
  repoId: string;
  repoName: string;
  repoStrategy: CmpGitRepoStrategy;
  defaultAgentId: string;
  metadata?: Record<string, unknown>;
}

export interface CreateCmpGitProjectRepoInput {
  projectId: string;
  repoId?: string;
  repoName: string;
  repoStrategy?: CmpGitRepoStrategy;
  defaultAgentId?: string;
  metadata?: Record<string, unknown>;
}

export interface CmpGitBranchRef {
  kind: CmpGitBranchKind;
  agentId: string;
  branchName: string;
  fullRef: string;
}

export interface CmpGitBranchFamily {
  agentId: string;
  work: CmpGitBranchRef;
  cmp: CmpGitBranchRef;
  mp: CmpGitBranchRef;
  tap: CmpGitBranchRef;
}

export interface CmpGitLineageNode {
  lineageId: string;
  projectId: string;
  agentId: string;
  parentAgentId?: string;
  depth: number;
  branchFamily: CmpGitBranchFamily;
  childAgentIds: string[];
  status: CmpGitLineageStatus;
  metadata?: Record<string, unknown>;
}

export interface CreateCmpGitLineageNodeInput {
  projectId: string;
  agentId: string;
  parentAgentId?: string;
  depth?: number;
  branchFamily?: CmpGitBranchFamily;
  status?: CmpGitLineageStatus;
  metadata?: Record<string, unknown>;
}

export interface CmpGitContextDeltaLike {
  deltaId: string;
  agentId: string;
  sessionId?: SessionId;
  runId?: RunId;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export interface CmpGitCommitDeltaBinding {
  bindingId: string;
  projectId: string;
  agentId: string;
  branchRef: CmpGitBranchRef;
  commitSha: string;
  deltaId: string;
  sessionId?: SessionId;
  runId?: RunId;
  createdAt: string;
  syncIntent: CmpGitSyncIntent;
  metadata?: Record<string, unknown>;
}

export interface CreateCmpGitCommitDeltaBindingInput {
  projectId: string;
  agentId: string;
  branchRef: CmpGitBranchRef;
  commitSha: string;
  delta: CmpGitContextDeltaLike;
  createdAt?: string;
  syncIntent?: CmpGitSyncIntent;
  metadata?: Record<string, unknown>;
}

export interface CmpGitSnapshotCandidateRecord {
  candidateId: string;
  projectId: string;
  agentId: string;
  branchRef: CmpGitBranchRef;
  commitSha: string;
  deltaId: string;
  createdAt: string;
  status: CmpGitSnapshotCandidateStatus;
  metadata?: Record<string, unknown>;
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

function normalizeAgentId(agentId: string): string {
  return assertNonEmpty(agentId, "CMP git agentId").replace(/[^a-zA-Z0-9._-]+/g, "-");
}

export function createCmpGitProjectRepo(
  input: CreateCmpGitProjectRepoInput,
): CmpGitProjectRepo {
  const repo: CmpGitProjectRepo = {
    projectId: assertNonEmpty(input.projectId, "CMP git projectId"),
    repoId: input.repoId?.trim() || randomUUID(),
    repoName: assertNonEmpty(input.repoName, "CMP git repoName"),
    repoStrategy: input.repoStrategy ?? "single_project_repo",
    defaultAgentId: normalizeAgentId(input.defaultAgentId ?? "main"),
    metadata: input.metadata,
  };

  return repo;
}

export function createCmpGitBranchRef(params: {
  kind: CmpGitBranchKind;
  agentId: string;
}): CmpGitBranchRef {
  const agentId = normalizeAgentId(params.agentId);
  const branchName = `${params.kind}/${agentId}`;
  return {
    kind: params.kind,
    agentId,
    branchName,
    fullRef: `refs/heads/${branchName}`,
  };
}

export function createCmpGitBranchFamily(agentId: string): CmpGitBranchFamily {
  const normalizedAgentId = normalizeAgentId(agentId);
  return {
    agentId: normalizedAgentId,
    work: createCmpGitBranchRef({ kind: "work", agentId: normalizedAgentId }),
    cmp: createCmpGitBranchRef({ kind: "cmp", agentId: normalizedAgentId }),
    mp: createCmpGitBranchRef({ kind: "mp", agentId: normalizedAgentId }),
    tap: createCmpGitBranchRef({ kind: "tap", agentId: normalizedAgentId }),
  };
}

export function createCmpGitLineageNode(
  input: CreateCmpGitLineageNodeInput,
): CmpGitLineageNode {
  const agentId = normalizeAgentId(input.agentId);
  const parentAgentId = input.parentAgentId ? normalizeAgentId(input.parentAgentId) : undefined;
  const depth = input.depth ?? (parentAgentId ? 1 : 0);

  if (depth < 0) {
    throw new Error("CMP git lineage depth cannot be negative.");
  }
  if (!parentAgentId && depth !== 0) {
    throw new Error("CMP git root lineage must use depth 0.");
  }

  return {
    lineageId: randomUUID(),
    projectId: assertNonEmpty(input.projectId, "CMP git projectId"),
    agentId,
    parentAgentId,
    depth,
    branchFamily: input.branchFamily ?? createCmpGitBranchFamily(agentId),
    childAgentIds: [],
    status: input.status ?? "active",
    metadata: input.metadata,
  };
}

export function createCmpGitCommitDeltaBinding(
  input: CreateCmpGitCommitDeltaBindingInput,
): CmpGitCommitDeltaBinding {
  if (input.branchRef.kind !== "cmp") {
    throw new Error(
      `CMP git commit/delta sync must use cmp branches, received ${input.branchRef.kind}.`,
    );
  }
  if (normalizeAgentId(input.agentId) !== input.branchRef.agentId) {
    throw new Error(
      `CMP git branch ownership mismatch: branch belongs to ${input.branchRef.agentId}, received ${input.agentId}.`,
    );
  }
  if (normalizeAgentId(input.delta.agentId) !== input.branchRef.agentId) {
    throw new Error(
      `CMP git delta ownership mismatch: delta belongs to ${input.delta.agentId}, branch belongs to ${input.branchRef.agentId}.`,
    );
  }

  return {
    bindingId: randomUUID(),
    projectId: assertNonEmpty(input.projectId, "CMP git projectId"),
    agentId: input.branchRef.agentId,
    branchRef: input.branchRef,
    commitSha: assertNonEmpty(input.commitSha, "CMP git commitSha"),
    deltaId: assertNonEmpty(input.delta.deltaId, "CMP git deltaId"),
    sessionId: input.delta.sessionId,
    runId: input.delta.runId,
    createdAt: input.createdAt ?? input.delta.createdAt ?? new Date().toISOString(),
    syncIntent: input.syncIntent ?? "local_record",
    metadata: {
      ...(input.delta.metadata ?? {}),
      ...(input.metadata ?? {}),
    },
  };
}

export function createCmpGitSnapshotCandidateFromBinding(
  binding: CmpGitCommitDeltaBinding,
): CmpGitSnapshotCandidateRecord {
  return {
    candidateId: randomUUID(),
    projectId: binding.projectId,
    agentId: binding.agentId,
    branchRef: binding.branchRef,
    commitSha: binding.commitSha,
    deltaId: binding.deltaId,
    createdAt: binding.createdAt,
    status: "pending_check",
    metadata: {
      syncIntent: binding.syncIntent,
      sessionId: binding.sessionId,
      runId: binding.runId,
      ...(binding.metadata ?? {}),
    },
  };
}
