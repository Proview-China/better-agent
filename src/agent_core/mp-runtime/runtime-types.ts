import type { MpMemoryRecord, MpScopeLevel } from "../mp-types/index.js";

export interface MpLineageNode {
  projectId: string;
  agentId: string;
  parentAgentId?: string;
  depth: number;
  childAgentIds?: string[];
  peerAgentIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface MpAccessDecision {
  allowed: boolean;
  relation: MpLineageRelation;
  reason: string;
}

export interface MpPromotionDecision {
  allowed: boolean;
  relation: MpLineageRelation;
  nextScopeLevel: MpScopeLevel;
  reason: string;
}

export interface MpSessionAccessDecision {
  allowed: boolean;
  reason: string;
}

export interface MpRuntimeLoweringContext {
  projectId: string;
  agentId: string;
  branchRef: string;
  checkedSnapshotRef: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface MpRuntimeBootstrapContext {
  projectId: string;
  agentIds: string[];
  rootPath: string;
  metadata?: Record<string, unknown>;
}

export type MpLineageRelation =
  | "self"
  | "parent"
  | "child"
  | "peer"
  | "ancestor"
  | "descendant"
  | "distant";

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

export function validateMpLineageNode(node: MpLineageNode): void {
  assertNonEmpty(node.projectId, "MP lineage projectId");
  assertNonEmpty(node.agentId, "MP lineage agentId");
  if (!Number.isInteger(node.depth) || node.depth < 0) {
    throw new Error("MP lineage depth must be a non-negative integer.");
  }
  if (node.depth === 0 && node.parentAgentId) {
    throw new Error("MP root lineage cannot carry a parentAgentId.");
  }
  if (node.depth > 0 && !node.parentAgentId?.trim()) {
    throw new Error("MP non-root lineage requires a parentAgentId.");
  }
}

export function createMpLineageNode(input: MpLineageNode): MpLineageNode {
  const node: MpLineageNode = {
    projectId: assertNonEmpty(input.projectId, "MP lineage projectId"),
    agentId: assertNonEmpty(input.agentId, "MP lineage agentId"),
    parentAgentId: input.parentAgentId?.trim() || undefined,
    depth: input.depth,
    childAgentIds: normalizeStringArray(input.childAgentIds),
    peerAgentIds: normalizeStringArray(input.peerAgentIds),
    metadata: input.metadata,
  };
  validateMpLineageNode(node);
  return node;
}

export function createMpRuntimeLoweringContext(
  input: MpRuntimeLoweringContext,
): MpRuntimeLoweringContext {
  return {
    projectId: assertNonEmpty(input.projectId, "MP lowering context projectId"),
    agentId: assertNonEmpty(input.agentId, "MP lowering context agentId"),
    branchRef: assertNonEmpty(input.branchRef, "MP lowering context branchRef"),
    checkedSnapshotRef: assertNonEmpty(
      input.checkedSnapshotRef,
      "MP lowering context checkedSnapshotRef",
    ),
    sessionId: input.sessionId?.trim() || undefined,
    metadata: input.metadata,
  };
}

export function createMpRuntimeBootstrapContext(
  input: MpRuntimeBootstrapContext,
): MpRuntimeBootstrapContext {
  const agentIds = [...new Set(input.agentIds.map((agentId) => agentId.trim()).filter(Boolean))];
  if (agentIds.length === 0) {
    throw new Error("MP bootstrap context requires at least one agentId.");
  }
  return {
    projectId: assertNonEmpty(input.projectId, "MP bootstrap context projectId"),
    agentIds,
    rootPath: assertNonEmpty(input.rootPath, "MP bootstrap context rootPath"),
    metadata: input.metadata,
  };
}

export function createMpMemoryOwnerLineage(
  memory: Pick<MpMemoryRecord, "projectId" | "agentId">,
  input: Omit<MpLineageNode, "projectId" | "agentId"> = { depth: 0 },
): MpLineageNode {
  return createMpLineageNode({
    projectId: memory.projectId,
    agentId: memory.agentId,
    ...input,
  });
}
