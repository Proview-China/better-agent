import {
  buildMpSourceLineages,
  createMpSearchPlan,
  executeMpSearchPlan,
} from "../mp-runtime/index.js";
import { materializeMpStoredSection } from "../mp-runtime/materialization.js";
import type { MpLanceDbAdapter } from "../mp-lancedb/index.js";
import { createMpLanceTableNames } from "../mp-lancedb/index.js";
import type { MpMemoryRecord, MpScopeDescriptor, MpScopeLevel } from "../mp-types/index.js";
import type {
  MpFiveAgentAlignInput,
  MpFiveAgentAlignResult,
  MpFiveAgentHistoryInput,
  MpFiveAgentHistoryResult,
  MpFiveAgentIngestInput,
  MpFiveAgentIngestResult,
  MpFiveAgentResolveInput,
  MpFiveAgentResolveResult,
  MpFiveAgentRuntimeLike,
} from "./types.js";
import { createEmptyMpFiveAgentRuntimeState, createMpFiveAgentSummary, markMpRoleProgress } from "./observability.js";
import type { MpFiveAgentRuntimeState } from "./types.js";

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function chooseTableName(record: MpMemoryRecord): string {
  const names = createMpLanceTableNames({
    projectId: record.projectId,
    agentId: record.agentId,
  });
  switch (record.scopeLevel) {
    case "agent_isolated":
      return names.agentMemories ?? names.projectMemories;
    case "project":
      return names.projectMemories;
    case "global":
      return names.globalMemories;
  }
}

function compareIsoDate(left?: string, right?: string): number {
  const leftTime = left ? Date.parse(left) : 0;
  const rightTime = right ? Date.parse(right) : 0;
  return leftTime - rightTime;
}

function overlaps(left: string[], right: string[]): boolean {
  const rightSet = new Set(right);
  return left.some((value) => rightSet.has(value));
}

function cloneRecord(record: MpMemoryRecord): MpMemoryRecord {
  return structuredClone(record);
}

function composeAlignmentQuery(record: MpMemoryRecord, queryText?: string): string {
  return uniqueStrings([
    queryText ?? "",
    record.semanticGroupId ?? "",
    ...record.sourceRefs,
    ...record.tags,
    record.bodyRef ?? "",
  ]).join(" ");
}

function createRerankComposition(records: readonly MpMemoryRecord[]) {
  return records.reduce((summary, record) => {
    summary[record.freshness.status] += 1;
    summary[record.alignment.alignmentStatus] += 1;
    return summary;
  }, {
    fresh: 0,
    aging: 0,
    stale: 0,
    superseded: 0,
    aligned: 0,
    unreviewed: 0,
    drifted: 0,
  });
}

function recordScope(record: MpMemoryRecord): MpScopeDescriptor {
  return {
    projectId: record.projectId,
    agentId: record.agentId,
    sessionId: record.sessionId,
    scopeLevel: record.scopeLevel,
    sessionMode: record.sessionMode,
    visibilityState: record.visibilityState,
    promotionState: record.promotionState,
    lineagePath: record.lineagePath,
  };
}

export interface CreateMpFiveAgentRuntimeInput {
  adapter: MpLanceDbAdapter;
}

export class MpFiveAgentRuntime implements MpFiveAgentRuntimeLike {
  readonly #adapter: MpLanceDbAdapter;
  readonly #state: MpFiveAgentRuntimeState = createEmptyMpFiveAgentRuntimeState();

  constructor(input: CreateMpFiveAgentRuntimeInput) {
    this.#adapter = input.adapter;
  }

  getState(): MpFiveAgentRuntimeState {
    return this.#state;
  }

  getSummary() {
    return createMpFiveAgentSummary(this.#state);
  }

  async ingest(input: MpFiveAgentIngestInput): Promise<MpFiveAgentIngestResult> {
    const icmaOutput = {
      candidateCount: 1,
      sourceRefs: uniqueStrings(input.sourceRefs ?? [input.storedSection.storageRef, input.checkedSnapshotRef]),
      observedAt: input.observedAt ?? input.storedSection.persistedAt,
      proposedMemoryKind: input.memoryKind ?? "episodic",
      proposedSemanticGroupId: input.storedSection.metadata?.semanticGroupId as string | undefined,
    };
    markMpRoleProgress(this.#state, "icma", "emit_candidate", {
      structuredOutput: icmaOutput,
    });

    const draftRecordId = `memory:${input.storedSection.id}`;
    markMpRoleProgress(this.#state, "iterator", "handoff_checker", {
      rewriteOutput: {
        memoryId: draftRecordId,
        memoryKind: input.memoryKind ?? "episodic",
        tags: uniqueStrings((input.storedSection.metadata?.tags as string[] | undefined) ?? []),
        sourceRefs: icmaOutput.sourceRefs,
      },
    });

    const materialized = await materializeMpStoredSection({
      input: {
        storedSection: input.storedSection as never,
        checkedSnapshotRef: input.checkedSnapshotRef,
        branchRef: input.branchRef,
        scope: input.scope,
        metadata: {
          ...(input.metadata ?? {}),
          sourceRefs: icmaOutput.sourceRefs,
        },
      },
      adapter: this.#adapter,
    });
    const normalized = materialized.map((record) => ({
      ...cloneRecord(record),
      sourceRefs: icmaOutput.sourceRefs,
      observedAt: input.observedAt ?? record.observedAt ?? input.storedSection.persistedAt,
      capturedAt: input.capturedAt ?? record.capturedAt ?? record.createdAt,
      memoryKind: input.memoryKind ?? record.memoryKind,
      confidence: input.confidence ?? record.confidence,
      freshness: {
        status: "fresh" as const,
        reason: "accepted as the current candidate during ingest",
      },
      alignment: {
        alignmentStatus: "unreviewed" as const,
      },
    }));

    const updatedRecords: MpMemoryRecord[] = [];
    for (const record of normalized) {
      const persisted = await this.#adapter.updateMemory({
        tableName: chooseTableName(record),
        record,
      });
      this.#state.records.set(persisted.memoryId, cloneRecord(persisted));
      updatedRecords.push(persisted);
    }

    const alignment = await this.align({
      record: updatedRecords[0]!,
      alignedAt: updatedRecords[0]!.updatedAt,
      metadata: input.metadata,
    });
    return {
      status: "ingested",
      records: updatedRecords,
      alignment,
    };
  }

  async align(input: MpFiveAgentAlignInput): Promise<MpFiveAgentAlignResult> {
    const target = cloneRecord(input.record);
    const queryText = composeAlignmentQuery(target, input.queryText);
    const peerSearch = await this.#adapter.searchMemories({
      projectId: target.projectId,
      queryText,
      tableNames: await this.#adapter.listProjectTables(target.projectId),
      limit: 50,
    });
    const peers = peerSearch.hits
      .map((hit) => hit.record)
      .filter((record) =>
        record.memoryId !== target.memoryId
        && (
          (target.semanticGroupId && record.semanticGroupId === target.semanticGroupId)
          || overlaps(target.sourceRefs, record.sourceRefs)
        ));

    let primary = cloneRecord(target);
    const updatedRecords: MpMemoryRecord[] = [];
    const supersededMemoryIds: string[] = [];
    const staleMemoryIds: string[] = [];

    for (const peer of peers) {
      const peerIsNewer = compareIsoDate(peer.observedAt ?? peer.updatedAt, primary.observedAt ?? primary.updatedAt) > 0;
      if (peerIsNewer) {
        staleMemoryIds.push(primary.memoryId);
        primary = {
          ...primary,
          freshness: {
            status: "stale",
            reason: `older than ${peer.memoryId}`,
          },
          supersededBy: peer.memoryId,
          alignment: {
            alignmentStatus: "drifted",
            lastAlignedAt: input.alignedAt,
            reason: "newer peer memory exists",
          },
          updatedAt: input.alignedAt,
        };
        continue;
      }

      supersededMemoryIds.push(peer.memoryId);
      const updatedPeer: MpMemoryRecord = {
        ...cloneRecord(peer),
        freshness: {
          status: "superseded",
          reason: `superseded by ${primary.memoryId}`,
        },
        supersededBy: primary.memoryId,
        alignment: {
          alignmentStatus: "aligned",
          lastAlignedAt: input.alignedAt,
          reason: "supersede chain updated",
        },
        updatedAt: input.alignedAt,
      };
      updatedRecords.push(await this.#adapter.updateMemory({
        tableName: chooseTableName(updatedPeer),
        record: updatedPeer,
      }));
      this.#state.records.set(updatedPeer.memoryId, cloneRecord(updatedPeer));
      this.#state.dedupeDecisionCount += 1;
    }

    primary = {
      ...primary,
      supersedes: uniqueStrings([...(primary.supersedes ?? []), ...supersededMemoryIds]),
      freshness: primary.freshness.status === "stale"
        ? primary.freshness
        : {
          status: "fresh",
          reason: supersededMemoryIds.length > 0 ? "newer aligned memory supersedes prior entries" : "no fresher peer found",
        },
      alignment: {
        alignmentStatus: primary.freshness.status === "stale" ? "drifted" : "aligned",
        lastAlignedAt: input.alignedAt,
        reason: primary.freshness.status === "stale"
          ? "older than existing peer"
          : "checker aligned this memory against similar peers",
      },
      updatedAt: input.alignedAt,
    };

    markMpRoleProgress(this.#state, "checker", "emit_decision", {
      decisionOutput: {
        decision: supersededMemoryIds.length > 0
          ? "supersede_existing"
          : staleMemoryIds.length > 0
            ? "stale_candidate"
            : "keep",
        confidence: primary.confidence,
        freshnessStatus: primary.freshness.status,
        supersededMemoryIds,
        staleMemoryIds,
        reason: primary.freshness.reason ?? "alignment completed",
      },
    });
    this.#state.pendingAlignmentCount = 0;
    this.#state.pendingSupersedeCount = supersededMemoryIds.length;

    const tableName = input.tableName ?? chooseTableName(primary);
    const persistedPrimary = await this.#adapter.updateMemory({
      tableName,
      record: primary,
    });
    this.#state.records.set(persistedPrimary.memoryId, cloneRecord(persistedPrimary));
    updatedRecords.push(persistedPrimary);

    markMpRoleProgress(this.#state, "dbagent", "persist_truth", {
      materializationOutput: {
        materializedMemoryIds: [persistedPrimary.memoryId],
        updatedMemoryIds: updatedRecords.map((record) => record.memoryId),
        archivedMemoryIds: [],
        primaryTableName: tableName,
      },
    });

    return {
      status: "aligned",
      primary: persistedPrimary,
      updatedRecords,
      supersededMemoryIds,
      staleMemoryIds,
      tableName,
    };
  }

  async resolve(input: MpFiveAgentResolveInput): Promise<MpFiveAgentResolveResult> {
    const names = createMpLanceTableNames({
      projectId: input.projectId,
      agentId: input.requesterLineage.agentId,
    });
    markMpRoleProgress(this.#state, "dispatcher", "search");
    const result = await executeMpSearchPlan({
      adapter: this.#adapter,
      plan: createMpSearchPlan({
        projectId: input.projectId,
        queryText: input.queryText,
        requesterLineage: input.requesterLineage,
        requesterSessionId: input.requesterSessionId,
        projectTableName: names.projectMemories,
        globalTableName: names.globalMemories,
        agentTableName: names.agentMemories,
        agentTableNames: input.agentTableNames,
        scopeLevels: input.scopeLevels,
        limit: input.limit,
        metadata: input.metadata,
      }),
      requesterLineage: input.requesterLineage,
      sourceLineages: input.sourceLineages,
    });
    const primary = result.hits.slice(0, 3).map((hit) => hit.record);
    const supporting = result.hits.slice(3).map((hit) => hit.record);
    const rerankComposition = createRerankComposition([...primary, ...supporting]);
    this.#state.rerankComposition = rerankComposition;
    markMpRoleProgress(this.#state, "dispatcher", "assemble_bundle", {
      bundleOutput: {
        primaryMemoryIds: primary.map((record) => record.memoryId),
        supportingMemoryIds: supporting.map((record) => record.memoryId),
        omittedSupersededMemoryIds: [],
        rerankComposition,
      },
    });

    return {
      status: "resolved",
      bundle: {
        scope: primary[0] ? recordScope(primary[0]) : {
          projectId: input.projectId,
          agentId: input.requesterLineage.agentId,
          sessionId: input.requesterSessionId,
          scopeLevel: (input.scopeLevels?.[0] ?? "project") as MpScopeLevel,
          sessionMode: "shared",
          visibilityState: "project_shared",
          promotionState: "promoted_to_project",
          lineagePath: [input.requesterLineage.agentId],
        },
        primary,
        supporting,
        diagnostics: {
          omittedSupersededMemoryIds: [],
          rerankComposition,
        },
      },
    };
  }

  async requestHistory(input: MpFiveAgentHistoryInput): Promise<MpFiveAgentHistoryResult> {
    this.#state.passiveReturnCount += 1;
    const resolved = await this.resolve(input);
    return {
      status: "history_returned",
      bundle: resolved.bundle,
    };
  }
}

export function createMpFiveAgentRuntime(input: CreateMpFiveAgentRuntimeInput): MpFiveAgentRuntime {
  return new MpFiveAgentRuntime(input);
}
