import type {
  ArchiveMpMemoryRecordInput,
  CompactMpSemanticGroupInput,
  ExecuteMpSearchPlanInput,
  MaterializeMpStoredSectionBatchInput,
  MaterializeMpStoredSectionInput,
  MergeMpMemoryRecordsInput,
  MpFiveAgentSummary,
  MpMemoryAlignmentStatus,
  MpMemoryConfidenceLevel,
  MpMemoryFreshnessStatus,
  MpMemoryKind,
  MpLanceBootstrapReceipt,
  MpLanceSearchResult,
  MpLineageNode,
  MpMemoryRecord,
  MpScopeLevel,
  MpSemanticBundle,
  MpWorkflowBundle,
  PromoteMpMemoryRecordInput,
  ReindexMpMemoryRecordInput,
  SplitMpMemoryRecordInput,
} from "../agent_core/index.js";
import type { CreateRaxMpConfigInput, RaxMpConfig, RaxMpWorkflowConfig } from "./mp-config.js";

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

export interface RaxMpIngestInput {
  session: RaxMpSession;
  payload: MaterializeMpStoredSectionInput["input"] & {
    observedAt?: string;
    capturedAt?: string;
    sourceRefs?: string[];
    memoryKind?: MpMemoryKind;
    confidence?: MpMemoryConfidenceLevel;
    metadata?: Record<string, unknown>;
  };
}

export interface RaxMpIngestResult {
  status: "ingested";
  records: MpMemoryRecord[];
  supersededMemoryIds: string[];
  staleMemoryIds: string[];
  summary: MpFiveAgentSummary;
}

export interface RaxMpAlignInput {
  session: RaxMpSession;
  payload: {
    record: MpMemoryRecord;
    alignedAt: string;
    tableName?: string;
    queryText?: string;
    metadata?: Record<string, unknown>;
  };
}

export interface RaxMpAlignResult {
  status: "aligned";
  primary: MpMemoryRecord;
  updatedRecords: MpMemoryRecord[];
  supersededMemoryIds: string[];
  staleMemoryIds: string[];
  summary: MpFiveAgentSummary;
}

export interface RaxMpResolveInput {
  session: RaxMpSession;
  payload: RaxMpSearchInput["payload"];
}

export interface RaxMpResolveResult {
  status: "resolved";
  bundle: MpWorkflowBundle;
  summary: MpFiveAgentSummary;
}

export interface RaxMpRequestHistoryInput {
  session: RaxMpSession;
  payload: RaxMpSearchInput["payload"];
}

export interface RaxMpRequestHistoryResult {
  status: "history_returned";
  bundle: MpWorkflowBundle;
  summary: MpFiveAgentSummary;
}

export type RaxMpReadinessStatus = "ready" | "degraded" | "failed";

export interface RaxMpReadinessCheck {
  status: RaxMpReadinessStatus;
  summary: string;
  details?: Record<string, unknown>;
}

export interface RaxMpAcceptanceReadiness {
  roleConfiguration: RaxMpReadinessCheck;
  tapBridge: RaxMpReadinessCheck;
  lanceTruth: RaxMpReadinessCheck;
  freshnessAlignment: RaxMpReadinessCheck;
  memoryQuality: RaxMpReadinessCheck;
  retrievalBundle: RaxMpReadinessCheck;
  finalAcceptance: RaxMpReadinessCheck;
}

export interface RaxMpStatusPanel {
  roles: Record<"icma" | "iterator" | "checker" | "dbagent" | "dispatcher", {
    count: number;
    latestStage?: string;
  }>;
  flow: {
    pendingAlignmentCount: number;
    pendingSupersedeCount: number;
    staleMemoryCandidateCount: number;
    passiveReturnCount: number;
  };
  quality: {
    dedupeRate: number;
    staleMemoryCount: number;
    supersededMemoryCount: number;
  };
  readiness: {
    roleConfiguration: RaxMpReadinessStatus;
    tapBridge: RaxMpReadinessStatus;
    lanceTruth: RaxMpReadinessStatus;
    freshnessAlignment: RaxMpReadinessStatus;
    memoryQuality: RaxMpReadinessStatus;
    retrievalBundle: RaxMpReadinessStatus;
    finalAcceptance: RaxMpReadinessStatus;
  };
}

export interface RaxMpReadbackInput {
  session: RaxMpSession;
  projectId?: string;
  metadata?: Record<string, unknown>;
}

export interface RaxMpReadbackSummary {
  projectId: string;
  status: RaxMpReadinessStatus;
  receiptAvailable: boolean;
  tableCount: number;
  searchDefaults: RaxMpSearchDefaults;
  workflowConfig: RaxMpWorkflowConfig;
  recordCounts: {
    total: number;
    byFreshness: Partial<Record<MpMemoryFreshnessStatus, number>>;
    byAlignment: Partial<Record<MpMemoryAlignmentStatus, number>>;
  };
  fiveAgentSummary: MpFiveAgentSummary;
  acceptance: RaxMpAcceptanceReadiness;
  statusPanel: RaxMpStatusPanel;
  issues: string[];
}

export interface RaxMpReadbackResult {
  status: "found" | "not_found";
  receipt?: MpLanceBootstrapReceipt;
  summary?: RaxMpReadbackSummary;
  metadata?: Record<string, unknown>;
}

export interface RaxMpSmokeCheck {
  id: string;
  gate: "configuration" | "tap_bridge" | "truth" | "alignment" | "quality" | "retrieval" | "final_acceptance";
  status: RaxMpReadinessStatus;
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface RaxMpSmokeInput {
  session: RaxMpSession;
  projectId?: string;
  metadata?: Record<string, unknown>;
}

export interface RaxMpSmokeResult {
  status: RaxMpReadinessStatus;
  checks: RaxMpSmokeCheck[];
  metadata?: Record<string, unknown>;
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
  ingestMemoryWorkflow(
    input: RaxMpIngestInput["payload"],
  ): Promise<RaxMpIngestResult> | RaxMpIngestResult;
  alignMemoryWorkflow(
    input: RaxMpAlignInput["payload"],
  ): Promise<RaxMpAlignResult> | RaxMpAlignResult;
  resolveMemoryWorkflow(
    input: RaxMpResolveInput["payload"],
  ): Promise<RaxMpResolveResult> | RaxMpResolveResult;
  requestMemoryHistory(
    input: RaxMpRequestHistoryInput["payload"],
  ): Promise<RaxMpRequestHistoryResult> | RaxMpRequestHistoryResult;
  getMpFiveAgentRuntimeSummary?(): MpFiveAgentSummary;
  getMpBootstrapReceipt?(): MpLanceBootstrapReceipt | undefined;
  getMpManagedRecords?(): MpMemoryRecord[];
}

export interface RaxMpFacade {
  create(input: RaxMpCreateInput): RaxMpSession;
  bootstrap(input: RaxMpBootstrapInput): Promise<RaxMpBootstrapResult>;
  readback(input: RaxMpReadbackInput): Promise<RaxMpReadbackResult>;
  smoke(input: RaxMpSmokeInput): Promise<RaxMpSmokeResult>;
  ingest(input: RaxMpIngestInput): Promise<RaxMpIngestResult>;
  align(input: RaxMpAlignInput): Promise<RaxMpAlignResult>;
  resolve(input: RaxMpResolveInput): Promise<RaxMpResolveResult>;
  requestHistory(input: RaxMpRequestHistoryInput): Promise<RaxMpRequestHistoryResult>;
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
