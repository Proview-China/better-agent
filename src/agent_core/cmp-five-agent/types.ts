import type {
  CheckedSnapshot,
  CommitContextDeltaInput,
  ContextDelta,
  ContextPackage,
  DispatchContextPackageInput,
  DispatchReceipt,
  IngestRuntimeContextInput,
  PromotedProjection,
  RequestHistoricalContextInput,
  SnapshotCandidate,
} from "../cmp-types/index.js";
import type {
  AgentCapabilityProfile,
} from "../ta-pool-types/index.js";
import type {
  ResolveCapabilityAccessResult,
} from "../ta-pool-runtime/index.js";
import type {
  CmpFiveAgentCheckpointRecord,
  CmpFiveAgentLoopRecord,
  CmpFiveAgentRole,
  CmpOverrideAuditRecord,
  CmpPackageFamilyRecord,
  CmpReinterventionRequestRecord,
  CmpPeerExchangeApprovalRecord,
  CmpPromoteReviewRecord,
  CmpSkillSnapshotRecord,
} from "./shared.js";
export type {
  CmpFiveAgentRole,
  CmpPeerExchangeApprovalRecord,
  CmpReinterventionRequestRecord,
} from "./shared.js";

export const CMP_SYSTEM_FRAGMENT_KINDS = ["constraint", "risk", "flow"] as const;
export type CmpSystemFragmentKind = (typeof CMP_SYSTEM_FRAGMENT_KINDS)[number];
export const CMP_ROLE_LIVE_LLM_MODES = ["rules_only", "llm_assisted", "llm_required"] as const;
export type CmpRoleLiveLlmMode = (typeof CMP_ROLE_LIVE_LLM_MODES)[number];
export const CMP_ICMA_STAGES = ["capture", "chunk_by_intent", "attach_fragment", "emit"] as const;
export const CMP_ITERATOR_STAGES = ["accept_material", "write_candidate_commit", "update_review_ref"] as const;
export const CMP_CHECKER_STAGES = ["accept_candidate", "restructure", "checked", "suggest_promote"] as const;
export const CMP_DBAGENT_STAGES = ["accept_checked", "project", "materialize_package", "attach_snapshots", "serve_passive"] as const;
export const CMP_DISPATCHER_STAGES = ["route", "deliver", "collect_receipt", "timeout_handle"] as const;

export type CmpIcmaStage = (typeof CMP_ICMA_STAGES)[number];
export type CmpIteratorStage = (typeof CMP_ITERATOR_STAGES)[number];
export type CmpCheckerStage = (typeof CMP_CHECKER_STAGES)[number];
export type CmpDbAgentStage = (typeof CMP_DBAGENT_STAGES)[number];
export type CmpDispatcherStage = (typeof CMP_DISPATCHER_STAGES)[number];

export interface CmpRolePromptPack {
  role: CmpFiveAgentRole;
  promptPackId: string;
  lane: "active_ingress" | "git_progression" | "checked_review" | "db_projection" | "delivery_routing";
  systemPrompt: string;
  systemPurpose: string;
  systemPolicy:
    | "append_only_fragment"
    | "decision_separated"
    | "package_authority"
    | "routing_only";
  mission: string;
  inputContract: string[];
  guardrails: string[];
  outputContract: string[];
  handoffContract: string;
}

export interface CmpRoleProfile {
  role: CmpFiveAgentRole;
  profileId: string;
  displayName: string;
  missionLabel: string;
  responsibilities: string[];
  hardBoundaries: string[];
  parentInteraction: string;
  childInteraction: string;
  peerInteraction: string;
  defaultStageOrder: string[];
  ownsStages: string[];
}

export interface CmpRoleCapabilitySurface {
  access:
    | "none"
    | "read"
    | "candidate_only"
    | "write"
    | "limited_write"
    | "primary_write"
    | "publish_only"
    | "route_only";
  allowedOperations: string[];
  forbiddenOperations: string[];
  rationale: string;
}

export interface CmpRoleCapabilityContract {
  role: CmpFiveAgentRole;
  contractId: string;
  systemPromptMutation:
    | "fragments_only"
    | "forbidden"
    | "decision_separated"
    | "package_authority"
    | "routing_only";
  git: CmpRoleCapabilitySurface;
  db: CmpRoleCapabilitySurface;
  mq: CmpRoleCapabilitySurface;
  tapIntegrationMode: "contract_ready";
}

export interface CmpRoleConfiguration {
  role: CmpFiveAgentRole;
  promptPack: CmpRolePromptPack;
  profile: CmpRoleProfile;
  capability: CmpRoleCapabilityContract;
  capabilityContract: CmpRoleCapabilityContract;
}

export interface CmpRoleLiveLlmRequest<TInput = Record<string, unknown>> {
  requestId: string;
  role: CmpFiveAgentRole;
  agentId: string;
  mode: CmpRoleLiveLlmMode;
  stage: string;
  createdAt: string;
  promptPackId: string;
  profileId: string;
  prompt: {
    system: string;
    user: string;
    systemPrompt: string;
    systemPurpose: string;
    mission: string;
    guardrails: string[];
    inputContract: string[];
    outputContract: string[];
    handoffContract: string;
  };
  input: TInput;
  metadata?: Record<string, unknown>;
}

export interface CmpRoleLiveLlmExecutorResult<TOutput = Record<string, unknown>> {
  output: TOutput;
  raw?: unknown;
  provider?: string;
  model?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export type CmpRoleLiveLlmExecutor<TInput = Record<string, unknown>, TOutput = Record<string, unknown>> = (
  request: CmpRoleLiveLlmRequest<TInput>,
) => Promise<CmpRoleLiveLlmExecutorResult<TOutput>>;

export interface CmpRoleLiveLlmTrace {
  attemptId: string;
  role: CmpFiveAgentRole;
  mode: CmpRoleLiveLlmMode;
  stage: string;
  status: "rules_only" | "live_applied" | "fallback_rules";
  provider?: string;
  model?: string;
  requestId?: string;
  createdAt: string;
  completedAt: string;
  fallbackApplied: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface CmpRoleLiveLlmOutcome<TOutput = Record<string, unknown>> {
  mode: CmpRoleLiveLlmMode;
  status: "rules_only" | "live_applied" | "fallback_rules";
  output: TOutput;
  trace: CmpRoleLiveLlmTrace;
  raw?: unknown;
}

export interface CmpFiveAgentConfiguration {
  version: string;
  roles: Record<CmpFiveAgentRole, CmpRoleConfiguration>;
}

export interface CmpRoleCheckpointRecord extends CmpFiveAgentCheckpointRecord {}
export interface CmpRoleOverrideRecord extends CmpOverrideAuditRecord {}
export type CmpTaskSkillSnapshot = CmpSkillSnapshotRecord;
export interface CmpParentPromoteReviewRecord extends CmpPromoteReviewRecord {
  reviewedAt: string;
  stage: "ready";
  reviewRole: "dbagent";
}

export interface CmpSystemFragmentRecord {
  fragmentId: string;
  agentId: string;
  kind: CmpSystemFragmentKind;
  content: string;
  createdAt: string;
  lifecycle: "task_phase";
  metadata?: Record<string, unknown>;
}

export interface CmpIntentChunkRecord {
  chunkId: string;
  agentId: string;
  taskSummary: string;
  materialRefs: string[];
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface CmpIcmaStructuredOutput {
  requestId?: string;
  intent: string;
  sourceAnchorRefs: string[];
  candidateBodyRefs: string[];
  boundary: string;
  explicitFragmentIds: string[];
  preSectionIds: string[];
  llmIntentRationale?: string;
  chunkingMode?: "single_explicit" | "multi_explicit" | "multi_auto";
  autoFragmentPolicy?: {
    strategy: "llm_infer_from_materials";
    detectedKinds: CmpSystemFragmentKind[];
  };
  intentChunks?: Array<{
    chunkId: string;
    taskSummary: string;
    materialRefs: string[];
    detectedFragmentKinds: CmpSystemFragmentKind[];
    operatorGuide?: string;
    childGuide?: string;
  }>;
  guide: {
    operatorGuide: string;
    childGuide: string;
  };
}

export interface CmpIcmaRecord extends CmpFiveAgentLoopRecord<CmpIcmaStage> {
  chunkIds: string[];
  fragmentIds: string[];
  eventIds?: string[];
  structuredOutput: CmpIcmaStructuredOutput;
  liveTrace?: CmpRoleLiveLlmTrace;
}

export interface CmpIcmaIngestInput {
  ingest: IngestRuntimeContextInput;
  createdAt: string;
  loopId: string;
}

export interface CmpIcmaEmitInput {
  recordId: string;
  eventIds: string[];
  emittedAt: string;
}

export interface CmpIcmaRuntimeSnapshot {
  records: CmpIcmaRecord[];
  intentChunks: CmpIntentChunkRecord[];
  fragments: CmpSystemFragmentRecord[];
  checkpoints: CmpRoleCheckpointRecord[];
}

export interface CmpIteratorRecord extends CmpFiveAgentLoopRecord<CmpIteratorStage> {
  deltaId: string;
  candidateId: string;
  branchRef: string;
  commitRef: string;
  reviewRef: string;
  reviewOutput: {
    sourceRequestId?: string;
    sourceSectionIds: string[];
    minimumReviewUnit: "commit" | "section";
    reviewRefMode: "stable_review_ref";
    handoffTarget: "checker";
    progressionVerdict?: "hold" | "advance_review" | "advance_commit";
    commitRationale?: string;
    reviewRefAnnotation?: string;
  };
  liveTrace?: CmpRoleLiveLlmTrace;
}

export interface CmpIteratorAdvanceInput {
  agentId: string;
  deltaId: string;
  candidateId: string;
  branchRef: string;
  commitRef: string;
  reviewRef: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface CmpCheckerRecord extends CmpFiveAgentLoopRecord<CmpCheckerStage> {
  candidateId: string;
  checkedSnapshotId: string;
  suggestPromote: boolean;
  reviewOutput: {
    sourceSectionIds: string[];
    checkedSectionIds: string[];
    splitDecisionRefs: string[];
    mergeDecisionRefs: string[];
    splitExecutions?: Array<{
      decisionRef: string;
      sourceSectionId: string;
      proposedSectionIds: string[];
      rationale: string;
    }>;
    mergeExecutions?: Array<{
      decisionRef: string;
      sourceSectionIds: string[];
      targetSectionId: string;
      rationale: string;
    }>;
    trimSummary: string;
    shortReason: string;
    detailedReason: string;
    promoteRationale?: string;
  };
  liveTrace?: CmpRoleLiveLlmTrace;
}

export interface CmpPromoteRequestRecord extends CmpPromoteReviewRecord {
  requestedAt: string;
  reviewRole: "dbagent";
}

export interface CmpCheckerEvaluateInput {
  agentId: string;
  candidateId: string;
  checkedSnapshotId: string;
  checkedAt: string;
  suggestPromote: boolean;
  parentAgentId?: string;
  metadata?: Record<string, unknown>;
}

export interface CmpIteratorCheckerRuntimeSnapshot {
  iteratorRecords: CmpIteratorRecord[];
  checkerRecords: CmpCheckerRecord[];
  checkpoints: CmpRoleCheckpointRecord[];
  promoteRequests: CmpPromoteRequestRecord[];
}

export interface CmpDbAgentRecord extends CmpFiveAgentLoopRecord<CmpDbAgentStage> {
  projectionId: string;
  familyId: string;
  primaryPackageId: string;
  timelinePackageId?: string;
  taskSnapshotIds: string[];
  passiveReplyPackageId?: string;
  materializationOutput: {
    requestId?: string;
    sourceSnapshotId?: string;
    sourceSectionIds: string[];
    packageTopology: string;
    bundleSchemaVersion: "cmp-dispatch-bundle/v1";
    materializationRationale?: string;
    primaryPackageStrategy?: string;
    timelinePackageStrategy?: string;
    taskSnapshotStrategy?: string;
    passivePackagingStrategy?: string;
  };
  liveTrace?: CmpRoleLiveLlmTrace;
}

export interface CmpDbAgentMaterializeInput {
  checkedSnapshot: CheckedSnapshot;
  projectionId: string;
  contextPackage: ContextPackage;
  createdAt: string;
  loopId: string;
  metadata?: Record<string, unknown>;
}

export interface CmpDbAgentMaterializeResult {
  loop: CmpDbAgentRecord;
  family: CmpPackageFamilyRecord;
  taskSnapshots: CmpTaskSkillSnapshot[];
}

export interface CmpDbAgentPassiveInput {
  request: RequestHistoricalContextInput;
  snapshot: CheckedSnapshot;
  contextPackage: ContextPackage;
  createdAt: string;
  loopId: string;
  metadata?: Record<string, unknown>;
}

export interface CmpDbAgentRuntimeSnapshot {
  records: CmpDbAgentRecord[];
  checkpoints: CmpRoleCheckpointRecord[];
  packageFamilies: CmpPackageFamilyRecord[];
  taskSnapshots: CmpTaskSkillSnapshot[];
  parentPromoteReviews: CmpParentPromoteReviewRecord[];
  reinterventionRequests: CmpReinterventionRequestRecord[];
}

export interface CmpDispatcherBundleEnvelope {
  target: {
    targetAgentId: string;
    targetKind: DispatchContextPackageInput["targetKind"] | "core_agent_return";
    packageMode: "core_return" | "child_seed_via_icma" | "peer_exchange_slim" | "historical_reply_return" | "lineage_delivery";
    targetIngress: "core_agent_return" | "child_icma_only" | "peer_exchange" | "lineage_delivery";
  };
  body: {
    packageId: string;
    packageKind: ContextPackage["packageKind"];
    primaryRef: string;
    timelineRef?: string;
    guideRef?: string;
    backgroundRef?: string;
    taskSnapshotRefs: string[];
    slimExchangeFields?: string[];
    bodyStrategy?: "child_seed_full" | "peer_exchange_slim" | "historical_return";
  };
  governance: {
    sourceAgentId: string;
    sourceRequestId?: string;
    sourceSnapshotId?: string;
    approvalRequired: boolean;
    approvalId?: string;
    approvalStatus?: string;
    routeRationale?: string;
    confidenceLabel: "high" | "medium";
    signalLabel: ContextPackage["fidelityLabel"];
    scopePolicy?: string;
  };
  sourceAnchorRefs: string[];
}

export interface CmpDispatcherRecord extends CmpFiveAgentLoopRecord<CmpDispatcherStage> {
  dispatchId: string;
  packageId: string;
  targetAgentId: string;
  targetKind: DispatchContextPackageInput["targetKind"];
  packageMode: "core_return" | "child_seed_via_icma" | "peer_exchange_slim" | "historical_reply_return" | "lineage_delivery";
  bundle: CmpDispatcherBundleEnvelope;
  liveTrace?: CmpRoleLiveLlmTrace;
}

export type CmpDispatcherPackageMode = CmpDispatcherRecord["packageMode"];

export interface CmpDispatcherDispatchInput {
  contextPackage: ContextPackage;
  dispatch: DispatchContextPackageInput;
  receipt: DispatchReceipt;
  createdAt: string;
  loopId: string;
}

export interface CmpDispatcherPassiveReturnInput {
  request: RequestHistoricalContextInput;
  contextPackage: ContextPackage;
  createdAt: string;
  loopId: string;
}

export interface CmpDispatcherRuntimeSnapshot {
  records: CmpDispatcherRecord[];
  checkpoints: CmpRoleCheckpointRecord[];
  peerApprovals: CmpPeerExchangeApprovalRecord[];
}

export interface CmpFiveAgentRuntimeSnapshot {
  icmaRecords: CmpIcmaRecord[];
  iteratorRecords: CmpIteratorRecord[];
  checkerRecords: CmpCheckerRecord[];
  dbAgentRecords: CmpDbAgentRecord[];
  dispatcherRecords: CmpDispatcherRecord[];
  checkpoints: CmpRoleCheckpointRecord[];
  overrides: CmpRoleOverrideRecord[];
  intentChunks: CmpIntentChunkRecord[];
  fragments: CmpSystemFragmentRecord[];
  packageFamilies: CmpPackageFamilyRecord[];
  taskSnapshots: CmpTaskSkillSnapshot[];
  promoteRequests: CmpPromoteRequestRecord[];
  parentPromoteReviews: CmpParentPromoteReviewRecord[];
  peerApprovals: CmpPeerExchangeApprovalRecord[];
  reinterventionRequests: CmpReinterventionRequestRecord[];
}

export interface CmpFiveAgentCapabilityMatrixSummary {
  gitWriters: CmpFiveAgentRole[];
  dbWriters: CmpFiveAgentRole[];
  mqPublishers: CmpFiveAgentRole[];
}

export interface CmpFiveAgentFlowSummary {
  packageModeCounts: Partial<Record<CmpDispatcherRecord["packageMode"], number>>;
  childSeedToIcmaCount: number;
  passiveReturnCount: number;
  pendingPeerApprovalCount: number;
  approvedPeerApprovalCount: number;
  rejectedPeerApprovalCount: number;
  reinterventionPendingCount: number;
  reinterventionServedCount: number;
}

export interface CmpFiveAgentRecoverySummary {
  checkpointCoverage: Record<CmpFiveAgentRole, number>;
  resumableRoles: CmpFiveAgentRole[];
  missingCheckpointRoles: CmpFiveAgentRole[];
}

export interface CmpFiveAgentRoleLiveSummary {
  mode: "rules_only" | "llm_assisted" | "llm_required" | "unknown";
  status: "rules_only" | "succeeded" | "fallback" | "failed" | "unknown";
  fallbackApplied: boolean;
  provider?: string;
  model?: string;
  promptId?: string;
  errorMessage?: string;
}

export interface CmpFiveAgentTapProfileSummary {
  role: CmpFiveAgentRole;
  profileId: string;
  agentClass: string;
  defaultMode: string;
  baselineTier: string;
  baselineCapabilities: string[];
  allowedCapabilityPatterns: string[];
  deniedCapabilityPatterns: string[];
}

export interface CmpFiveAgentCapabilityAccessResolution {
  role: CmpFiveAgentRole;
  profile: AgentCapabilityProfile;
  resolution: ResolveCapabilityAccessResult;
}

export interface CmpFiveAgentSummary {
  agentId?: string;
  configurationVersion: string;
  roleCounts: Record<CmpFiveAgentRole, number>;
  latestStages: Record<CmpFiveAgentRole, string | undefined>;
  latestRoleMetadata: Record<CmpFiveAgentRole, Record<string, unknown> | undefined>;
  checkpointCount: number;
  overrideCount: number;
  peerExchangePendingApprovalCount: number;
  peerExchangeApprovedCount: number;
  parentPromoteReviewCount: number;
  configuredRoles: Record<CmpFiveAgentRole, {
    promptPackId: string;
    profileId: string;
    capabilityContractId: string;
    tapProfileId: string;
  }>;
  capabilityMatrix: CmpFiveAgentCapabilityMatrixSummary;
  tapProfiles: Record<CmpFiveAgentRole, CmpFiveAgentTapProfileSummary>;
  flow: CmpFiveAgentFlowSummary;
  recovery: CmpFiveAgentRecoverySummary;
  live: Record<CmpFiveAgentRole, CmpFiveAgentRoleLiveSummary>;
}

export function createCheckerCheckedSnapshotMetadata(input: { snapshot: CheckedSnapshot; result: { checkerRecord: CmpCheckerRecord; promoteRequest?: CmpPromoteRequestRecord } }): Record<string, unknown> {
  return {
    cmpCheckerLoopId: input.result.checkerRecord.loopId,
    cmpCheckerStage: input.result.checkerRecord.stage,
    cmpCheckerPromoteSuggested: input.result.checkerRecord.suggestPromote,
    cmpPromoteReviewId: input.result.promoteRequest?.reviewId,
    cmpReviewRole: input.result.promoteRequest?.reviewRole,
    cmpCheckedSnapshotId: input.snapshot.snapshotId,
  };
}
