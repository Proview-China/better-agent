import type { MpMemoryRecord, MpScopeLevel } from "../mp-types/index.js";
import {
  assertNonEmpty,
  createMpLineageNode,
  type MpAccessDecision,
  type MpLineageNode,
  type MpLineageRelation,
  type MpPromotionDecision,
} from "./runtime-types.js";

function collectAncestors(node: MpLineageNode): string[] {
  const ancestors = new Set<string>();
  const lineageAncestors = node.metadata?.ancestorAgentIds;
  if (Array.isArray(lineageAncestors)) {
    for (const ancestor of lineageAncestors) {
      if (typeof ancestor === "string" && ancestor.trim()) {
        ancestors.add(ancestor.trim());
      }
    }
  }
  if (node.parentAgentId) {
    ancestors.add(node.parentAgentId);
  }
  return [...ancestors];
}

function scopeRank(scopeLevel: MpScopeLevel): number {
  switch (scopeLevel) {
    case "agent_isolated":
      return 0;
    case "project":
      return 1;
    case "global":
      return 2;
  }
}

export function resolveMpLineageRelation(params: {
  source: MpLineageNode;
  target: MpLineageNode;
}): MpLineageRelation {
  const source = createMpLineageNode(params.source);
  const target = createMpLineageNode(params.target);

  if (source.agentId === target.agentId) {
    return "self";
  }
  if (source.parentAgentId === target.agentId) {
    return "parent";
  }
  if (target.parentAgentId === source.agentId) {
    return "child";
  }
  if (source.parentAgentId && source.parentAgentId === target.parentAgentId) {
    return "peer";
  }

  const sourceAncestors = collectAncestors(source);
  const targetAncestors = collectAncestors(target);
  if (sourceAncestors.includes(target.agentId)) {
    return "ancestor";
  }
  if (targetAncestors.includes(source.agentId)) {
    return "descendant";
  }
  return "distant";
}

export function evaluateMpScopeAccess(params: {
  memory: Pick<MpMemoryRecord, "memoryId" | "projectId" | "agentId" | "scopeLevel" | "sessionMode" | "visibilityState">;
  source: MpLineageNode;
  target: MpLineageNode;
}): MpAccessDecision {
  const relation = resolveMpLineageRelation({
    source: params.source,
    target: params.target,
  });

  if (params.memory.visibilityState === "archived") {
    return {
      allowed: false,
      relation,
      reason: `MP memory ${params.memory.memoryId} is archived.`,
    };
  }

  if (params.memory.scopeLevel === "global") {
    return {
      allowed: true,
      relation,
      reason: `MP global scope allows relation ${relation}.`,
    };
  }

  if (params.source.projectId !== params.target.projectId) {
    return {
      allowed: false,
      relation,
      reason: `MP memory ${params.memory.memoryId} is not cross-project visible.`,
    };
  }

  if (params.memory.scopeLevel === "project") {
    return {
      allowed: true,
      relation,
      reason: `MP project scope allows same-project relation ${relation}.`,
    };
  }

  const allowed = params.memory.sessionMode === "bridged"
    && params.memory.visibilityState === "session_bridged"
    ? ["self", "parent", "child", "peer"].includes(relation)
    : relation === "self";
  return {
    allowed,
    relation,
    reason: allowed
      ? (
        params.memory.sessionMode === "bridged"
          ? `MP bridged agent scope allows same-neighborhood relation ${relation}.`
          : "MP agent_isolated scope is visible to the owning agent only."
      )
      : `MP agent_isolated scope blocks relation ${relation}.`,
  };
}

export function assertMpScopeVisibleToTarget(params: {
  memory: Pick<MpMemoryRecord, "memoryId" | "projectId" | "agentId" | "scopeLevel" | "sessionMode" | "visibilityState">;
  source: MpLineageNode;
  target: MpLineageNode;
}): MpLineageRelation {
  assertNonEmpty(params.memory.memoryId, "MP memory memoryId");
  const decision = evaluateMpScopeAccess(params);
  if (!decision.allowed) {
    throw new Error(
      `MP memory ${params.memory.memoryId} is not visible to ${params.target.agentId}: ${decision.reason}`,
    );
  }
  return decision.relation;
}

export function evaluateMpPromotionAllowed(params: {
  memory: Pick<MpMemoryRecord, "memoryId" | "scopeLevel">;
  owner: MpLineageNode;
  promoter: MpLineageNode;
  nextScopeLevel: MpScopeLevel;
}): MpPromotionDecision {
  const relation = resolveMpLineageRelation({
    source: params.owner,
    target: params.promoter,
  });

  if (scopeRank(params.nextScopeLevel) <= scopeRank(params.memory.scopeLevel)) {
    return {
      allowed: false,
      relation,
      nextScopeLevel: params.nextScopeLevel,
      reason: `MP promotion must move upward from ${params.memory.scopeLevel} to a broader scope.`,
    };
  }

  if (params.memory.scopeLevel === "agent_isolated" && params.nextScopeLevel === "project") {
    const allowed = relation === "self" || relation === "parent";
    return {
      allowed,
      relation,
      nextScopeLevel: params.nextScopeLevel,
      reason: allowed
        ? "MP agent_isolated memory can be promoted to project by self or direct parent."
        : `MP agent_isolated memory cannot be promoted to project by relation ${relation}.`,
    };
  }

  if (params.memory.scopeLevel === "project" && params.nextScopeLevel === "global") {
    const allowed = relation === "self" || relation === "parent" || relation === "ancestor";
    return {
      allowed,
      relation,
      nextScopeLevel: params.nextScopeLevel,
      reason: allowed
        ? "MP project memory can be promoted to global by self, parent, or ancestor."
        : `MP project memory cannot be promoted to global by relation ${relation}.`,
    };
  }

  return {
    allowed: false,
    relation,
    nextScopeLevel: params.nextScopeLevel,
    reason: `MP promotion from ${params.memory.scopeLevel} to ${params.nextScopeLevel} is not supported.`,
  };
}

export function assertMpPromotionAllowed(params: {
  memory: Pick<MpMemoryRecord, "memoryId" | "scopeLevel">;
  owner: MpLineageNode;
  promoter: MpLineageNode;
  nextScopeLevel: MpScopeLevel;
}): MpLineageRelation {
  assertNonEmpty(params.memory.memoryId, "MP memory memoryId");
  const decision = evaluateMpPromotionAllowed(params);
  if (!decision.allowed) {
    throw new Error(
      `MP memory ${params.memory.memoryId} cannot be promoted to ${params.nextScopeLevel}: ${decision.reason}`,
    );
  }
  return decision.relation;
}
