import type { MpMemoryRecord } from "../mp-types/index.js";
import type {
  MpLanceDbAdapter,
  MpLanceSearchRequest,
  MpLanceSearchResult,
} from "./lancedb-types.js";

export interface ExecuteMpLanceSearchInput extends MpLanceSearchRequest {
  adapter: MpLanceDbAdapter;
}

export interface MpLanceDedupedSearchResult extends MpLanceSearchResult {
  dedupedCount: number;
}

function dedupeHitsByMemoryId(result: MpLanceSearchResult): MpLanceDedupedSearchResult {
  const deduped = new Map<string, (typeof result.hits)[number]>();
  for (const hit of result.hits) {
    const existing = deduped.get(hit.memoryId);
    if (!existing || hit.score > existing.score) {
      deduped.set(hit.memoryId, hit);
    }
  }
  const hits = [...deduped.values()].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.memoryId.localeCompare(right.memoryId);
  });

  return {
    ...result,
    hits,
    dedupedCount: result.hits.length - hits.length,
  };
}

export async function executeMpLanceSearch(
  input: ExecuteMpLanceSearchInput,
): Promise<MpLanceDedupedSearchResult> {
  const result = await input.adapter.searchMemories(input);
  return dedupeHitsByMemoryId(result);
}

export function rerankMpLanceSearchResult(input: {
  result: MpLanceSearchResult;
  preferredAgentId?: string;
  preferredScopeOrder?: MpMemoryRecord["scopeLevel"][];
}): MpLanceSearchResult {
  const preferredScopeOrder = input.preferredScopeOrder ?? [
    "agent_isolated",
    "project",
    "global",
  ];
  const scopeRank = new Map(preferredScopeOrder.map((scope, index) => [scope, index]));
  const freshnessRank = new Map<MpMemoryRecord["freshness"]["status"], number>([
    ["fresh", 0],
    ["aging", 1],
    ["stale", 2],
    ["superseded", 3],
  ]);
  const alignmentRank = new Map<MpMemoryRecord["alignment"]["alignmentStatus"], number>([
    ["aligned", 0],
    ["unreviewed", 1],
    ["drifted", 2],
  ]);
  const visibleHits = input.result.hits.filter((hit) => hit.record.freshness.status !== "superseded");

  return {
    ...input.result,
    hits: [...visibleHits].sort((left, right) => {
      const leftFreshnessRank = freshnessRank.get(left.record.freshness.status) ?? Number.MAX_SAFE_INTEGER;
      const rightFreshnessRank = freshnessRank.get(right.record.freshness.status) ?? Number.MAX_SAFE_INTEGER;
      if (leftFreshnessRank !== rightFreshnessRank) {
        return leftFreshnessRank - rightFreshnessRank;
      }

      const leftAlignmentRank = alignmentRank.get(left.record.alignment.alignmentStatus) ?? Number.MAX_SAFE_INTEGER;
      const rightAlignmentRank = alignmentRank.get(right.record.alignment.alignmentStatus) ?? Number.MAX_SAFE_INTEGER;
      if (leftAlignmentRank !== rightAlignmentRank) {
        return leftAlignmentRank - rightAlignmentRank;
      }

      const leftPreferred = input.preferredAgentId && left.record.agentId === input.preferredAgentId ? 1 : 0;
      const rightPreferred = input.preferredAgentId && right.record.agentId === input.preferredAgentId ? 1 : 0;
      if (rightPreferred !== leftPreferred) {
        return rightPreferred - leftPreferred;
      }

      const leftScopeRank = scopeRank.get(left.record.scopeLevel) ?? Number.MAX_SAFE_INTEGER;
      const rightScopeRank = scopeRank.get(right.record.scopeLevel) ?? Number.MAX_SAFE_INTEGER;
      if (leftScopeRank !== rightScopeRank) {
        return leftScopeRank - rightScopeRank;
      }

      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.memoryId.localeCompare(right.memoryId);
    }),
  };
}
