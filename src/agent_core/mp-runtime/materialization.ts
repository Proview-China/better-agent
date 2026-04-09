import type {
  MpLanceArchiveMemoryInput,
  MpLanceDbAdapter,
} from "../mp-lancedb/index.js";
import { createMpLanceTableNames } from "../mp-lancedb/index.js";
import type {
  MpLowerStoredSectionInput,
  MpMemoryRecord,
  MpPromoteMemoryInput,
  MpScopeLevel,
} from "../mp-types/index.js";
import {
  createMpMemoryRecord,
  createMpPromoteMemoryInput,
  createMpScopeDescriptor,
} from "../mp-types/index.js";
import { createMpMemoryRecordsFromStoredSection } from "../mp-lancedb/lancedb-lowering.js";
import { assertMpPromotionAllowed } from "./scope-enforcement.js";
import type { MpLineageNode } from "./runtime-types.js";

export interface MaterializeMpStoredSectionInput {
  input: MpLowerStoredSectionInput;
  adapter: MpLanceDbAdapter;
  tableName?: string;
}

export interface MaterializeMpStoredSectionBatchInput {
  inputs: readonly MpLowerStoredSectionInput[];
  adapter: MpLanceDbAdapter;
}

export interface ArchiveMpMemoryRecordInput {
  adapter: MpLanceDbAdapter;
  projectId: string;
  agentId: string;
  scopeLevel: MpScopeLevel;
  memoryId: string;
  archivedAt: string;
  tableName?: string;
  metadata?: Record<string, unknown>;
}

export interface PromoteMpMemoryRecordInput {
  adapter: MpLanceDbAdapter;
  memory: MpMemoryRecord;
  owner: MpLineageNode;
  promoter: MpLineageNode;
  nextScopeLevel: MpPromoteMemoryInput["toScopeLevel"];
  promotedAt: string;
  metadata?: Record<string, unknown>;
}

function resolveMpTableName(params: {
  projectId: string;
  agentId: string;
  scopeLevel: MpScopeLevel;
}): string {
  const names = createMpLanceTableNames({
    projectId: params.projectId,
    agentId: params.agentId,
  });
  switch (params.scopeLevel) {
    case "global":
      return names.globalMemories;
    case "project":
      return names.projectMemories;
    case "agent_isolated":
      return names.agentMemories ?? "";
  }
}

async function awaitMaybe<T>(value: Promise<T> | T): Promise<T> {
  return value;
}

export async function materializeMpStoredSection(
  params: MaterializeMpStoredSectionInput,
): Promise<MpMemoryRecord[]> {
  const records = createMpMemoryRecordsFromStoredSection(params.input);
  const tableName = params.tableName ?? resolveMpTableName({
    projectId: params.input.scope.projectId,
    agentId: params.input.scope.agentId,
    scopeLevel: params.input.scope.scopeLevel,
  });
  await awaitMaybe(params.adapter.upsertMemories({
    tableName,
    records,
  }));
  return records;
}

export async function materializeMpStoredSectionBatch(
  params: MaterializeMpStoredSectionBatchInput,
): Promise<MpMemoryRecord[]> {
  const allRecords: MpMemoryRecord[] = [];
  for (const input of params.inputs) {
    allRecords.push(...await materializeMpStoredSection({
      input,
      adapter: params.adapter,
    }));
  }
  return allRecords;
}

export async function archiveMpMemoryRecord(
  params: ArchiveMpMemoryRecordInput,
): Promise<MpMemoryRecord | undefined> {
  const tableName = params.tableName ?? resolveMpTableName({
    projectId: params.projectId,
    agentId: params.agentId,
    scopeLevel: params.scopeLevel,
  });
  return await awaitMaybe(params.adapter.archiveMemory({
    tableName,
    memoryId: params.memoryId,
    archivedAt: params.archivedAt,
    metadata: params.metadata,
  } satisfies MpLanceArchiveMemoryInput));
}

export async function promoteMpMemoryRecord(
  params: PromoteMpMemoryRecordInput,
): Promise<MpMemoryRecord> {
  createMpPromoteMemoryInput({
    memoryId: params.memory.memoryId,
    promoterAgentId: params.promoter.agentId,
    fromScopeLevel: params.memory.scopeLevel,
    toScopeLevel: params.nextScopeLevel,
    createdAt: params.promotedAt,
    metadata: params.metadata,
  });
  assertMpPromotionAllowed({
    memory: {
      memoryId: params.memory.memoryId,
      scopeLevel: params.memory.scopeLevel,
    },
    owner: params.owner,
    promoter: params.promoter,
    nextScopeLevel: params.nextScopeLevel,
  });

  const promotedScope = createMpScopeDescriptor({
    projectId: params.memory.projectId,
    agentId: params.memory.agentId,
    sessionId: params.memory.sessionId,
    scopeLevel: params.nextScopeLevel,
    lineagePath: params.memory.lineagePath,
  });
  const promoted = createMpMemoryRecord({
    ...params.memory,
    scopeLevel: promotedScope.scopeLevel,
    sessionMode: promotedScope.sessionMode,
    visibilityState: promotedScope.visibilityState,
    promotionState: promotedScope.promotionState,
    updatedAt: params.promotedAt,
    metadata: {
      ...(params.memory.metadata ?? {}),
      promotedAt: params.promotedAt,
      promotedBy: params.promoter.agentId,
      ...(params.metadata ?? {}),
    },
  });
  await awaitMaybe(params.adapter.upsertMemories({
    tableName: resolveMpTableName({
      projectId: promoted.projectId,
      agentId: promoted.agentId,
      scopeLevel: promoted.scopeLevel,
    }),
    records: [promoted],
  }));
  return promoted;
}
