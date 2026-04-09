import type { AgentCapabilityProfile } from "../ta-pool-types/index.js";
import type {
  MpMemoryConfidenceLevel,
  MpMemoryKind,
  MpMemoryRecord,
  MpScopeDescriptor,
  MpScopeLevel,
} from "../mp-types/index.js";
import type {
  MpCheckerStage,
  MpDbAgentStage,
  MpDispatcherStage,
  MpFiveAgentRole,
  MpIcmaStage,
  MpIteratorStage,
} from "./shared.js";

export type {
  MpFiveAgentRole,
  MpIcmaStage,
  MpIteratorStage,
  MpCheckerStage,
  MpDbAgentStage,
  MpDispatcherStage,
} from "./shared.js";

export const MP_ROLE_LIVE_LLM_MODES = ["rules_only", "llm_assisted", "llm_required"] as const;
export type MpRoleLiveLlmMode = (typeof MP_ROLE_LIVE_LLM_MODES)[number];

export interface MpRolePromptPack {
  role: MpFiveAgentRole;
  promptPackId: string;
  lane: "ingress" | "rewrite" | "judgement" | "truth_write" | "retrieval";
  systemPrompt: string;
  systemPurpose: string;
  mission: string;
  guardrails: string[];
  inputContract: string[];
  outputContract: string[];
  handoffContract: string;
}

export interface MpRoleProfile {
  role: MpFiveAgentRole;
  profileId: string;
  displayName: string;
  missionLabel: string;
  responsibilities: string[];
  hardBoundaries: string[];
  defaultStageOrder: string[];
}

export interface MpRoleCapabilitySurface {
  access:
    | "none"
    | "read"
    | "draft_only"
    | "judge_only"
    | "route_only"
    | "write"
    | "primary_write";
  allowedOperations: string[];
  forbiddenOperations: string[];
  rationale: string;
}

export interface MpRoleCapabilityContract {
  role: MpFiveAgentRole;
  contractId: string;
  memory: MpRoleCapabilitySurface;
  retrieval: MpRoleCapabilitySurface;
  alignment: MpRoleCapabilitySurface;
  tapIntegrationMode: "contract_ready";
}

export interface MpRoleConfiguration {
  role: MpFiveAgentRole;
  promptPack: MpRolePromptPack;
  profile: MpRoleProfile;
  capabilityContract: MpRoleCapabilityContract;
}

export interface MpFiveAgentConfiguration {
  version: string;
  roles: Record<MpFiveAgentRole, MpRoleConfiguration>;
}

export interface MpFiveAgentRoleSummaryCatalogEntry {
  promptPackId: string;
  profileId: string;
  capabilityContractId: string;
  tapProfileId: string;
}

export type MpFiveAgentTapProfileSummaryCatalog = Record<MpFiveAgentRole, {
  role: MpFiveAgentRole;
  profileId: string;
  agentClass: string;
  defaultMode: string;
  baselineTier: string;
  baselineCapabilities: string[];
  allowedCapabilityPatterns: string[];
  deniedCapabilityPatterns: string[];
}>;

export interface MpFiveAgentCapabilityMatrixSummary {
  ingressOwners: MpFiveAgentRole[];
  rewriteOwners: MpFiveAgentRole[];
  alignmentJudges: MpFiveAgentRole[];
  memoryWriters: MpFiveAgentRole[];
  retrievalOwners: MpFiveAgentRole[];
}

export interface MpIcmaStructuredOutput {
  candidateCount: number;
  sourceRefs: string[];
  observedAt?: string;
  proposedMemoryKind: MpMemoryKind;
  proposedSemanticGroupId?: string;
}

export interface MpIteratorRewriteOutput {
  memoryId: string;
  memoryKind: MpMemoryKind;
  tags: string[];
  sourceRefs: string[];
}

export interface MpCheckerDecisionOutput {
  decision: "keep" | "supersede_existing" | "stale_candidate" | "merge_required";
  confidence: MpMemoryConfidenceLevel;
  freshnessStatus: MpMemoryRecord["freshness"]["status"];
  supersededMemoryIds: string[];
  staleMemoryIds: string[];
  reason: string;
}

export interface MpDbAgentMaterializationOutput {
  materializedMemoryIds: string[];
  updatedMemoryIds: string[];
  archivedMemoryIds: string[];
  primaryTableName: string;
}

export interface MpDispatcherBundleOutput {
  primaryMemoryIds: string[];
  supportingMemoryIds: string[];
  omittedSupersededMemoryIds: string[];
  rerankComposition: {
    fresh: number;
    aging: number;
    stale: number;
    superseded: number;
    aligned: number;
    unreviewed: number;
    drifted: number;
  };
}

export interface MpWorkflowBundle {
  scope: MpScopeDescriptor;
  primary: MpMemoryRecord[];
  supporting: MpMemoryRecord[];
  diagnostics: {
    omittedSupersededMemoryIds: string[];
    rerankComposition: MpDispatcherBundleOutput["rerankComposition"];
  };
}

export interface MpFiveAgentFlowSummary {
  pendingAlignmentCount: number;
  pendingSupersedeCount: number;
  staleMemoryCandidateCount: number;
  passiveReturnCount: number;
}

export interface MpFiveAgentQualitySummary {
  dedupeRate: number;
  staleMemoryCount: number;
  supersededMemoryCount: number;
  rerankComposition: MpDispatcherBundleOutput["rerankComposition"];
}

export interface MpFiveAgentSummary {
  configurationVersion: string;
  roleCounts: Record<MpFiveAgentRole, number>;
  latestStages: Record<MpFiveAgentRole, string | undefined>;
  latestRoleMetadata: {
    icma?: { structuredOutput: MpIcmaStructuredOutput };
    iterator?: { rewriteOutput: MpIteratorRewriteOutput };
    checker?: { decisionOutput: MpCheckerDecisionOutput };
    dbagent?: { materializationOutput: MpDbAgentMaterializationOutput };
    dispatcher?: { bundleOutput: MpDispatcherBundleOutput };
  };
  configuredRoles: Record<MpFiveAgentRole, MpFiveAgentRoleSummaryCatalogEntry>;
  capabilityMatrix: MpFiveAgentCapabilityMatrixSummary;
  tapProfiles: MpFiveAgentTapProfileSummaryCatalog;
  flow: MpFiveAgentFlowSummary;
  quality: MpFiveAgentQualitySummary;
}

export interface MpFiveAgentRuntimeState {
  roleCounts: Record<MpFiveAgentRole, number>;
  latestStages: Record<MpFiveAgentRole, string | undefined>;
  latestRoleMetadata: MpFiveAgentSummary["latestRoleMetadata"];
  pendingAlignmentCount: number;
  pendingSupersedeCount: number;
  passiveReturnCount: number;
  records: Map<string, MpMemoryRecord>;
  dedupeDecisionCount: number;
  ingestCount: number;
  rerankComposition: MpDispatcherBundleOutput["rerankComposition"];
}

export interface MpFiveAgentIngestInput {
  projectId: string;
  storedSection: {
    id: string;
    projectId: string;
    agentId: string;
    storageRef: string;
    persistedAt: string;
    metadata?: Record<string, unknown>;
  };
  checkedSnapshotRef: string;
  branchRef: string;
  scope: MpScopeDescriptor;
  memoryKind?: MpMemoryKind;
  observedAt?: string;
  capturedAt?: string;
  sourceRefs?: string[];
  confidence?: MpMemoryConfidenceLevel;
  metadata?: Record<string, unknown>;
}

export interface MpFiveAgentAlignInput {
  record: MpMemoryRecord;
  alignedAt: string;
  tableName?: string;
  queryText?: string;
  metadata?: Record<string, unknown>;
}

export interface MpFiveAgentResolveInput {
  projectId: string;
  queryText: string;
  requesterLineage: {
    projectId: string;
    agentId: string;
    depth: number;
  };
  requesterSessionId?: string;
  sourceLineages: ReadonlyMap<string, {
    projectId: string;
    agentId: string;
    depth: number;
  }>;
  scopeLevels?: MpScopeLevel[];
  agentTableNames?: string[];
  limit?: number;
  metadata?: Record<string, unknown>;
}

export interface MpFiveAgentHistoryInput extends MpFiveAgentResolveInput {}

export interface MpFiveAgentIngestResult {
  status: "ingested";
  records: MpMemoryRecord[];
  alignment: MpFiveAgentAlignResult;
}

export interface MpFiveAgentAlignResult {
  status: "aligned";
  primary: MpMemoryRecord;
  updatedRecords: MpMemoryRecord[];
  supersededMemoryIds: string[];
  staleMemoryIds: string[];
  tableName: string;
}

export interface MpFiveAgentResolveResult {
  status: "resolved";
  bundle: MpWorkflowBundle;
}

export interface MpFiveAgentHistoryResult {
  status: "history_returned";
  bundle: MpWorkflowBundle;
}

export interface MpFiveAgentRuntimeLike {
  ingest(input: MpFiveAgentIngestInput): Promise<MpFiveAgentIngestResult>;
  align(input: MpFiveAgentAlignInput): Promise<MpFiveAgentAlignResult>;
  resolve(input: MpFiveAgentResolveInput): Promise<MpFiveAgentResolveResult>;
  requestHistory(input: MpFiveAgentHistoryInput): Promise<MpFiveAgentHistoryResult>;
  getSummary(): MpFiveAgentSummary;
  getState(): MpFiveAgentRuntimeState;
}

export type MpFiveAgentTapProfileCatalog = Record<MpFiveAgentRole, AgentCapabilityProfile>;
