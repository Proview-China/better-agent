import {
  executeMpLanceSearch,
  rerankMpLanceSearchResult,
  type MpLanceDbAdapter,
  type MpLanceSearchResult,
} from "../mp-lancedb/index.js";
import type { MpMemoryRecord, MpScopeLevel } from "../mp-types/index.js";
import { assertMpScopeVisibleToTarget } from "./scope-enforcement.js";
import {
  assertMpSessionBridgeAllowed,
  type MpSessionBridgeRecord,
} from "./session-bridge.js";
import type { MpLineageNode } from "./runtime-types.js";

export interface MpSearchPlan {
  projectId: string;
  queryText: string;
  requestedScopeLevels: MpScopeLevel[];
  tableNames: string[];
  preferredAgentId?: string;
  requesterSessionId?: string;
  limit: number;
  metadata?: Record<string, unknown>;
}

export interface CreateMpSearchPlanInput {
  projectId: string;
  queryText: string;
  requesterLineage: MpLineageNode;
  requesterSessionId?: string;
  projectTableName: string;
  globalTableName: string;
  agentTableName?: string;
  agentTableNames?: string[];
  scopeLevels?: MpScopeLevel[];
  limit?: number;
  metadata?: Record<string, unknown>;
}

export interface ExecuteMpSearchPlanInput {
  adapter: MpLanceDbAdapter;
  plan: MpSearchPlan;
  requesterLineage: MpLineageNode;
  sourceLineages: ReadonlyMap<string, MpLineageNode>;
  bridgeRecords?: readonly MpSessionBridgeRecord[];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function createMpSearchPlan(input: CreateMpSearchPlanInput): MpSearchPlan {
  const requestedScopeLevels: MpScopeLevel[] = input.scopeLevels?.length
    ? [...new Set(input.scopeLevels)]
    : ["agent_isolated", "project", "global"];
  const tableNames = uniqueStrings([
    ...(requestedScopeLevels.includes("agent_isolated")
      ? [input.agentTableName ?? "", ...(input.agentTableNames ?? [])]
      : []),
    requestedScopeLevels.includes("project") ? input.projectTableName : "",
    requestedScopeLevels.includes("global") ? input.globalTableName : "",
  ]);

  if (tableNames.length === 0) {
    throw new Error("MP search plan requires at least one table target.");
  }

  return {
    projectId: input.projectId.trim(),
    queryText: input.queryText.trim(),
    requestedScopeLevels,
    tableNames,
    preferredAgentId: input.requesterLineage.agentId,
    requesterSessionId: input.requesterSessionId?.trim() || undefined,
    limit: input.limit ?? 10,
    metadata: input.metadata,
  };
}

export async function executeMpSearchPlan(
  input: ExecuteMpSearchPlanInput,
): Promise<MpLanceSearchResult> {
  const raw = await executeMpLanceSearch({
    adapter: input.adapter,
    projectId: input.plan.projectId,
    queryText: input.plan.queryText,
    scopeLevels: input.plan.requestedScopeLevels,
    tableNames: input.plan.tableNames,
    limit: input.plan.limit * 4,
    sessionId: input.plan.requesterSessionId,
  });

  const filteredHits = raw.hits.filter((hit) => {
    const sourceLineage = input.sourceLineages.get(hit.record.agentId);
    if (!sourceLineage) {
      return false;
    }
    try {
      assertMpScopeVisibleToTarget({
        memory: hit.record,
        source: sourceLineage,
        target: input.requesterLineage,
      });
      assertMpSessionBridgeAllowed({
        memory: hit.record,
        requesterSessionId: input.plan.requesterSessionId,
        bridgeRecords: input.bridgeRecords,
      });
      return true;
    } catch {
      return false;
    }
  });

  return rerankMpLanceSearchResult({
    result: {
      ...raw,
      hits: filteredHits.slice(0, input.plan.limit),
    },
    preferredAgentId: input.plan.preferredAgentId,
  });
}

export function buildMpSourceLineages(
  lineages: readonly MpLineageNode[],
): ReadonlyMap<string, MpLineageNode> {
  return new Map(lineages.map((lineage) => [lineage.agentId, lineage]));
}

export function summarizeMpSearchHits(
  hits: readonly Pick<MpLanceSearchResult["hits"][number], "memoryId" | "score" | "record">[],
): Array<{
  memoryId: string;
  score: number;
  scopeLevel: MpMemoryRecord["scopeLevel"];
  sourceAgentId: string;
}> {
  return hits.map((hit) => ({
    memoryId: hit.memoryId,
    score: hit.score,
    scopeLevel: hit.record.scopeLevel,
    sourceAgentId: hit.record.agentId,
  }));
}
