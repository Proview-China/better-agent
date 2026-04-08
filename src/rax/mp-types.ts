import type {
  ArchiveMpMemoryRecordInput,
  CompactMpSemanticGroupInput,
  ExecuteMpSearchPlanInput,
  MaterializeMpStoredSectionBatchInput,
  MaterializeMpStoredSectionInput,
  MergeMpMemoryRecordsInput,
  MpLanceBootstrapReceipt,
  MpLanceSearchResult,
  MpLineageNode,
  MpMemoryRecord,
  MpScopeLevel,
  MpSemanticBundle,
  PromoteMpMemoryRecordInput,
  ReindexMpMemoryRecordInput,
  SplitMpMemoryRecordInput,
} from "../agent_core/index.js";
import type { CreateRaxMpConfigInput, RaxMpConfig } from "./mp-config.js";

export type RaxMpMode = "local_first" | "balanced" | "shared_first";

export interface RaxMpLanceConfig {
  kind: "lancedb";
  rootPath: string;
  schemaVersion: number;
  liveExecutionPreferred: boolean;
  metadata?: Record<string, unknown>;
}

export interface RaxMpSearchDefaults {
  limit: number;
  scopeLevels: MpScopeLevel[];
  preferSameAgent: boolean;
  metadata?: Record<string, unknown>;
}

export interface RaxMpSession {
  sessionId: string;
  projectId: string;
  createdAt: string;
  config: RaxMpConfig;
  runtime: RaxMpRuntimeLike;
  metadata?: Record<string, unknown>;
}

export interface RaxMpCreateInput {
  config: CreateRaxMpConfigInput | RaxMpConfig;
  runtime?: RaxMpRuntimeLike;
  metadata?: Record<string, unknown>;
}

export interface RaxMpBootstrapInput {
  session: RaxMpSession;
  payload: {
    agentIds: string[];
    projectId?: string;
    rootPath?: string;
    metadata?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
}

export interface RaxMpBootstrapResult {
  status: "bootstrapped";
  receipt: MpLanceBootstrapReceipt;
  session: RaxMpSession;
  metadata?: Record<string, unknown>;
}

export interface RaxMpMaterializeInput {
  session: RaxMpSession;
  payload: MaterializeMpStoredSectionInput["input"];
}

export interface RaxMpMaterializeBatchInput {
  session: RaxMpSession;
  payload: MaterializeMpStoredSectionBatchInput["inputs"];
}

export interface RaxMpSearchInput {
  session: RaxMpSession;
  payload: {
    queryText: string;
    requesterLineage: MpLineageNode;
    requesterSessionId?: string;
    sourceLineages: MpLineageNode[];
    agentTableNames?: string[];
    scopeLevels?: MpScopeLevel[];
    limit?: number;
    metadata?: Record<string, unknown>;
  };
}

export interface RaxMpArchiveInput {
  session: RaxMpSession;
  payload: Omit<ArchiveMpMemoryRecordInput, "adapter">;
}

export interface RaxMpPromoteInput {
  session: RaxMpSession;
  payload: Omit<PromoteMpMemoryRecordInput, "adapter">;
}

export interface RaxMpSplitInput {
  session: RaxMpSession;
  payload: Omit<SplitMpMemoryRecordInput, "adapter">;
}

export interface RaxMpMergeInput {
  session: RaxMpSession;
  payload: Omit<MergeMpMemoryRecordsInput, "adapter">;
}

export interface RaxMpReindexInput {
  session: RaxMpSession;
  payload: Omit<ReindexMpMemoryRecordInput, "adapter">;
}

export interface RaxMpCompactInput {
  session: RaxMpSession;
  payload: Omit<CompactMpSemanticGroupInput, "adapter">;
}

export interface RaxMpSplitResult {
  status: "split";
  records: MpMemoryRecord[];
}

export interface RaxMpMergeResult {
  status: "merged";
  record: MpMemoryRecord;
  bundle: MpSemanticBundle;
}

export interface RaxMpRuntimeLike {
  bootstrapProject(input: {
    projectId?: string;
    agentIds: string[];
    rootPath?: string;
    metadata?: Record<string, unknown>;
  }): Promise<MpLanceBootstrapReceipt> | MpLanceBootstrapReceipt;
  materializeStoredSection(
    input: MaterializeMpStoredSectionInput["input"],
  ): Promise<MpMemoryRecord[]> | MpMemoryRecord[];
  materializeStoredSectionBatch(
    inputs: MaterializeMpStoredSectionBatchInput["inputs"],
  ): Promise<MpMemoryRecord[]> | MpMemoryRecord[];
  search(input: Omit<ExecuteMpSearchPlanInput, "adapter" | "plan"> & {
    queryText: string;
    requesterSessionId?: string;
    agentTableNames?: string[];
    scopeLevels?: MpScopeLevel[];
    limit?: number;
    metadata?: Record<string, unknown>;
  }): Promise<MpLanceSearchResult> | MpLanceSearchResult;
  archiveMemory(
    input: Omit<ArchiveMpMemoryRecordInput, "adapter">,
  ): Promise<MpMemoryRecord | undefined> | MpMemoryRecord | undefined;
  promoteMemory(
    input: Omit<PromoteMpMemoryRecordInput, "adapter">,
  ): Promise<MpMemoryRecord> | MpMemoryRecord;
  splitMemory(
    input: Omit<SplitMpMemoryRecordInput, "adapter">,
  ): Promise<MpMemoryRecord[]> | MpMemoryRecord[];
  mergeMemories(
    input: Omit<MergeMpMemoryRecordsInput, "adapter">,
  ): Promise<{ record: MpMemoryRecord; bundle: MpSemanticBundle }> | { record: MpMemoryRecord; bundle: MpSemanticBundle };
  reindexMemory(
    input: Omit<ReindexMpMemoryRecordInput, "adapter">,
  ): Promise<MpMemoryRecord> | MpMemoryRecord;
  compactSemanticGroup(
    input: Omit<CompactMpSemanticGroupInput, "adapter">,
  ): Promise<MpMemoryRecord[]> | MpMemoryRecord[];
}

export interface RaxMpFacade {
  create(input: RaxMpCreateInput): RaxMpSession;
  bootstrap(input: RaxMpBootstrapInput): Promise<RaxMpBootstrapResult>;
  materialize(input: RaxMpMaterializeInput): Promise<MpMemoryRecord[]>;
  materializeBatch(input: RaxMpMaterializeBatchInput): Promise<MpMemoryRecord[]>;
  search(input: RaxMpSearchInput): Promise<MpLanceSearchResult>;
  archive(input: RaxMpArchiveInput): Promise<MpMemoryRecord | undefined>;
  promote(input: RaxMpPromoteInput): Promise<MpMemoryRecord>;
  split(input: RaxMpSplitInput): Promise<RaxMpSplitResult>;
  merge(input: RaxMpMergeInput): Promise<RaxMpMergeResult>;
  reindex(input: RaxMpReindexInput): Promise<MpMemoryRecord>;
  compact(input: RaxMpCompactInput): Promise<MpMemoryRecord[]>;
}
