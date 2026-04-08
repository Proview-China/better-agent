import {
  createMpMemoryRecord,
  createMpSemanticBundle,
  type MpMemoryRecord,
  type MpMergeChunksInput,
  type MpSemanticBundle,
  type MpSplitChunkInput,
} from "../mp-types/index.js";
import type { MpLanceDbAdapter } from "./lancedb-types.js";

export interface SplitMpMemoryRecordInput {
  adapter: MpLanceDbAdapter;
  tableName: string;
  sourceRecord: MpMemoryRecord;
  split: MpSplitChunkInput;
}

export interface MergeMpMemoryRecordsInput {
  adapter: MpLanceDbAdapter;
  tableName: string;
  sourceRecords: readonly MpMemoryRecord[];
  merge: MpMergeChunksInput;
}

export interface ReindexMpMemoryRecordInput {
  adapter: MpLanceDbAdapter;
  tableName: string;
  record: MpMemoryRecord;
  reindexedAt: string;
  metadata?: Record<string, unknown>;
}

export interface CompactMpSemanticGroupInput {
  adapter: MpLanceDbAdapter;
  tableName: string;
  records: readonly MpMemoryRecord[];
  keepMemoryId: string;
  archivedAt: string;
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} requires a non-empty string.`);
  }
  return normalized;
}

function splitPayloadRefs(payloadRefs: string[], parts: number): string[][] {
  const result: string[][] = Array.from({ length: parts }, () => []);
  payloadRefs.forEach((payloadRef, index) => {
    result[index % parts]?.push(payloadRef);
  });
  for (let index = 0; index < result.length; index += 1) {
    if (result[index]?.length === 0) {
      result[index]?.push(payloadRefs[index % payloadRefs.length] ?? payloadRefs[0] ?? "");
    }
  }
  return result;
}

export async function splitMpMemoryRecord(
  input: SplitMpMemoryRecordInput,
): Promise<MpMemoryRecord[]> {
  const payloadGroups = splitPayloadRefs(
    input.sourceRecord.payloadRefs,
    input.split.targetChunkCount,
  );
  const derived = payloadGroups.map((payloadRefs, index) => createMpMemoryRecord({
    ...input.sourceRecord,
    memoryId: `${input.sourceRecord.memoryId}:split:${index}`,
    payloadRefs,
    bodyRef: `${input.sourceRecord.bodyRef ?? input.sourceRecord.memoryId}#chunk-${index}`,
    ancestry: {
      parentMemoryId: input.sourceRecord.memoryId,
      derivedFromIds: [input.sourceRecord.memoryId],
      splitFromIds: [input.sourceRecord.memoryId],
      mergedFromIds: input.sourceRecord.ancestry?.mergedFromIds,
    },
    metadata: {
      ...(input.sourceRecord.metadata ?? {}),
      splitReason: input.split.splitReason,
      splitCreatedAt: input.split.createdAt,
    },
    createdAt: input.split.createdAt,
    updatedAt: input.split.createdAt,
  }));

  await input.adapter.upsertMemories({
    tableName: input.tableName,
    records: derived,
  });
  return derived;
}

export async function mergeMpMemoryRecords(
  input: MergeMpMemoryRecordsInput,
): Promise<{
  record: MpMemoryRecord;
  bundle: MpSemanticBundle;
}> {
  if (input.sourceRecords.length < 2) {
    throw new Error("MP merge requires at least two source records.");
  }

  const merged = createMpMemoryRecord({
    ...input.sourceRecords[0],
    memoryId: input.merge.mergedMemoryId,
    payloadRefs: [...new Set(input.sourceRecords.flatMap((record) => record.payloadRefs))],
    tags: [...new Set(input.sourceRecords.flatMap((record) => record.tags))],
    ancestry: {
      parentMemoryId: input.sourceRecords[0]?.memoryId,
      derivedFromIds: input.sourceRecords.map((record) => record.memoryId),
      mergedFromIds: input.sourceRecords.map((record) => record.memoryId),
      splitFromIds: input.sourceRecords.flatMap((record) => record.ancestry?.splitFromIds ?? []),
    },
    bodyRef: `bundle:${input.merge.mergedMemoryId}`,
    metadata: {
      ...(input.sourceRecords[0]?.metadata ?? {}),
      mergeReason: input.merge.mergeReason,
      mergeCreatedAt: input.merge.createdAt,
    },
    createdAt: input.merge.createdAt,
    updatedAt: input.merge.createdAt,
  });
  const bundle = createMpSemanticBundle({
    bundleId: `bundle:${assertNonEmpty(input.merge.mergedMemoryId, "MP merged memoryId")}`,
    projectId: merged.projectId,
    agentId: merged.agentId,
    scope: {
      projectId: merged.projectId,
      agentId: merged.agentId,
      sessionId: merged.sessionId,
      scopeLevel: merged.scopeLevel,
      sessionMode: merged.sessionMode,
      visibilityState: merged.visibilityState,
      promotionState: merged.promotionState,
      lineagePath: merged.lineagePath,
    },
    memberMemoryIds: input.sourceRecords.map((record) => record.memoryId),
    semanticGroupId: merged.semanticGroupId ?? merged.memoryId,
    createdAt: input.merge.createdAt,
    updatedAt: input.merge.createdAt,
  });

  await input.adapter.upsertMemories({
    tableName: input.tableName,
    records: [merged],
  });

  return {
    record: merged,
    bundle,
  };
}

export async function reindexMpMemoryRecord(
  input: ReindexMpMemoryRecordInput,
): Promise<MpMemoryRecord> {
  return await input.adapter.updateMemory({
    tableName: input.tableName,
    record: createMpMemoryRecord({
      ...input.record,
      updatedAt: input.reindexedAt,
      metadata: {
        ...(input.record.metadata ?? {}),
        reindexedAt: input.reindexedAt,
        ...(input.metadata ?? {}),
      },
    }),
  });
}

export async function compactMpSemanticGroup(
  input: CompactMpSemanticGroupInput,
): Promise<MpMemoryRecord[]> {
  const archived: MpMemoryRecord[] = [];
  for (const record of input.records) {
    if (record.memoryId === input.keepMemoryId) {
      continue;
    }
    const next = await input.adapter.archiveMemory({
      tableName: input.tableName,
      memoryId: record.memoryId,
      archivedAt: input.archivedAt,
      metadata: {
        compactedInto: input.keepMemoryId,
      },
    });
    if (next) {
      archived.push(next);
    }
  }
  return archived;
}
