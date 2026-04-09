import type {
  CmpPackageRecord,
  CmpRequestRecord,
  CmpSectionRecord,
  CmpSnapshotRecord,
  CommitContextDeltaInput,
  CommitContextDeltaResult,
  DispatchContextPackageInput,
  DispatchContextPackageResult,
  IngestRuntimeContextInput,
  IngestRuntimeContextResult,
  MaterializeContextPackageInput,
  MaterializeContextPackageResult,
  RequestHistoricalContextInput,
  RequestHistoricalContextResult,
  ResolveCheckedSnapshotInput,
  ResolveCheckedSnapshotResult,
} from "../agent_core/cmp-types/index.js";
import type {
  CmpFiveAgentCapabilityAccessResolution,
  CmpFiveAgentRole,
  CmpPeerExchangeApprovalRecord,
  CmpFiveAgentSummary,
} from "../agent_core/cmp-five-agent/index.js";
import type {
  BootstrapCmpProjectInfraInput,
  CmpRuntimeDeliveryTruthSummary,
  CmpRuntimeProjectRecoverySummary,
  CmpRuntimeRecoverySummary,
  DispatchCmpFiveAgentCapabilityResult,
} from "../agent_core/runtime.js";
import type { CmpProjectInfraBootstrapReceipt } from "../agent_core/cmp-runtime/infra-bootstrap.js";
import type { CmpRuntimeInfraProjectState } from "../agent_core/cmp-runtime/infra-state.js";
import type { CmpRuntimeSnapshot } from "../agent_core/cmp-runtime/runtime-snapshot.js";
import type {
  AccessRequestScope,
  TaCapabilityTier,
  TaPoolMode,
} from "../agent_core/ta-pool-types/index.js";
import type { IntentPriority } from "../agent_core/types/index.js";
import type { CreateRaxCmpConfigInput, RaxCmpConfig } from "./cmp-config.js";

export type RaxCmpMode = "active_preferred" | "passive_only" | "mixed";
export type RaxCmpExecutionStyle = "automatic" | "guided" | "manual";
export type RaxCmpReadbackPriority = "git_first" | "db_first" | "redis_first" | "reconcile";
export type RaxCmpFallbackPolicy = "git_rebuild" | "degraded" | "strict_not_found";
export type RaxCmpRecoveryPreference = "snapshot_first" | "infra_first" | "reconcile" | "dry_run";
export type RaxCmpDispatchScope = "lineage_only" | "core_agent_only" | "manual_targets" | "disabled";
export type RaxCmpBranchFamilyScope = "work" | "cmp" | "mp" | "tap";

export const RAX_CMP_EXECUTION_STYLES = ["automatic", "guided", "manual"] as const;
export const RAX_CMP_READBACK_PRIORITIES = ["git_first", "db_first", "redis_first", "reconcile"] as const;
export const RAX_CMP_FALLBACK_POLICIES = ["git_rebuild", "degraded", "strict_not_found"] as const;
export const RAX_CMP_RECOVERY_PREFERENCES = ["snapshot_first", "infra_first", "reconcile", "dry_run"] as const;
export const RAX_CMP_DISPATCH_SCOPES = ["lineage_only", "core_agent_only", "manual_targets", "disabled"] as const;
export const RAX_CMP_BRANCH_FAMILY_SCOPES = ["work", "cmp", "mp", "tap"] as const;

export const DEFAULT_RAX_CMP_EXECUTION_STYLE: RaxCmpExecutionStyle = "automatic";
export const DEFAULT_RAX_CMP_READBACK_PRIORITY: RaxCmpReadbackPriority = "db_first";
export const DEFAULT_RAX_CMP_FALLBACK_POLICY: RaxCmpFallbackPolicy = "git_rebuild";
export const DEFAULT_RAX_CMP_RECOVERY_PREFERENCE: RaxCmpRecoveryPreference = "reconcile";
export const DEFAULT_RAX_CMP_DISPATCH_SCOPE: RaxCmpDispatchScope = "lineage_only";

export interface RaxCmpLineageScope {
  projectIds: string[];
  agentIds: string[];
  lineageRoots: string[];
  branchFamilies: RaxCmpBranchFamilyScope[];
  targetAgentIds: string[];
}

export interface RaxCmpAutomationPolicy {
  autoIngest: boolean;
  autoCommit: boolean;
  autoResolve: boolean;
  autoMaterialize: boolean;
  autoDispatch: boolean;
  autoReturnToCoreAgent: boolean;
  autoSeedChildren: boolean;
}

export interface RaxCmpManualControlSurface {
  executionStyle: RaxCmpExecutionStyle;
  mode: RaxCmpMode;
  scope: {
    lineage: RaxCmpLineageScope;
    dispatch: RaxCmpDispatchScope;
  };
  truth: {
    readbackPriority: RaxCmpReadbackPriority;
    fallbackPolicy: RaxCmpFallbackPolicy;
    recoveryPreference: RaxCmpRecoveryPreference;
  };
  automation: RaxCmpAutomationPolicy;
  metadata?: Record<string, unknown>;
}

export interface RaxCmpManualControlInput {
  executionStyle?: RaxCmpExecutionStyle;
  mode?: RaxCmpMode;
  scope?: {
    lineage?: Partial<RaxCmpLineageScope>;
    dispatch?: RaxCmpDispatchScope;
  };
  truth?: Partial<RaxCmpManualControlSurface["truth"]>;
  automation?: Partial<RaxCmpAutomationPolicy>;
  metadata?: Record<string, unknown>;
}

function uniqueTrimmed(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

export function createRaxCmpLineageScope(
  input: Partial<RaxCmpLineageScope> = {},
): RaxCmpLineageScope {
  return {
    projectIds: uniqueTrimmed(input.projectIds),
    agentIds: uniqueTrimmed(input.agentIds),
    lineageRoots: uniqueTrimmed(input.lineageRoots),
    branchFamilies: [...new Set((input.branchFamilies ?? ["cmp"]).filter((value): value is RaxCmpBranchFamilyScope =>
      RAX_CMP_BRANCH_FAMILY_SCOPES.includes(value),
    ))],
    targetAgentIds: uniqueTrimmed(input.targetAgentIds),
  };
}

export function createRaxCmpAutomationPolicy(
  input: Partial<RaxCmpAutomationPolicy> = {},
): RaxCmpAutomationPolicy {
  return {
    autoIngest: input.autoIngest ?? true,
    autoCommit: input.autoCommit ?? true,
    autoResolve: input.autoResolve ?? true,
    autoMaterialize: input.autoMaterialize ?? true,
    autoDispatch: input.autoDispatch ?? true,
    autoReturnToCoreAgent: input.autoReturnToCoreAgent ?? true,
    autoSeedChildren: input.autoSeedChildren ?? true,
  };
}

export function createRaxCmpManualControlSurface(
  input: RaxCmpManualControlInput = {},
): RaxCmpManualControlSurface {
  return {
    executionStyle: input.executionStyle ?? DEFAULT_RAX_CMP_EXECUTION_STYLE,
    mode: input.mode ?? "active_preferred",
    scope: {
      lineage: createRaxCmpLineageScope(input.scope?.lineage),
      dispatch: input.scope?.dispatch ?? DEFAULT_RAX_CMP_DISPATCH_SCOPE,
    },
    truth: {
      readbackPriority: input.truth?.readbackPriority ?? DEFAULT_RAX_CMP_READBACK_PRIORITY,
      fallbackPolicy: input.truth?.fallbackPolicy ?? DEFAULT_RAX_CMP_FALLBACK_POLICY,
      recoveryPreference: input.truth?.recoveryPreference ?? DEFAULT_RAX_CMP_RECOVERY_PREFERENCE,
    },
    automation: createRaxCmpAutomationPolicy(input.automation),
    metadata: input.metadata,
  };
}

export function mergeRaxCmpManualControlSurface(input: {
  base: RaxCmpManualControlSurface;
  override?: RaxCmpManualControlInput;
}): RaxCmpManualControlSurface {
  if (!input.override) {
    return {
      ...input.base,
      scope: {
        lineage: createRaxCmpLineageScope(input.base.scope.lineage),
        dispatch: input.base.scope.dispatch,
      },
      truth: { ...input.base.truth },
      automation: { ...input.base.automation },
      metadata: input.base.metadata ? structuredClone(input.base.metadata) : undefined,
    };
  }

  return {
    executionStyle: input.override.executionStyle ?? input.base.executionStyle,
    mode: input.override.mode ?? input.base.mode,
    scope: {
      lineage: createRaxCmpLineageScope({
        ...input.base.scope.lineage,
        ...(input.override.scope?.lineage ?? {}),
      }),
      dispatch: input.override.scope?.dispatch ?? input.base.scope.dispatch,
    },
    truth: {
      readbackPriority: input.override.truth?.readbackPriority ?? input.base.truth.readbackPriority,
      fallbackPolicy: input.override.truth?.fallbackPolicy ?? input.base.truth.fallbackPolicy,
      recoveryPreference: input.override.truth?.recoveryPreference ?? input.base.truth.recoveryPreference,
    },
    automation: createRaxCmpAutomationPolicy({
      ...input.base.automation,
      ...(input.override.automation ?? {}),
    }),
    metadata: input.override.metadata ?? input.base.metadata,
  };
}

export interface RaxCmpBootstrapAgentInput {
  agentId: string;
  parentAgentId?: string;
  depth?: number;
  metadata?: Record<string, unknown>;
}

export interface RaxCmpGitInfraConfig {
  provider: "shared_git_infra";
  repoName: string;
  repoRootPath: string;
  defaultBranchName: string;
  worktreeRootPath?: string;
  metadata?: Record<string, unknown>;
}

export interface RaxCmpDatabaseConfig {
  kind: "postgresql";
  databaseName: string;
  schemaName?: string;
  liveExecutionPreferred: boolean;
  metadata?: Record<string, unknown>;
}

export interface RaxCmpMqConfig {
  kind: "redis";
  namespaceRoot?: string;
  liveExecutionPreferred: boolean;
  metadata?: Record<string, unknown>;
}

export interface RaxCmpSession {
  sessionId: string;
  projectId: string;
  createdAt: string;
  config: RaxCmpConfig;
  control: RaxCmpManualControlSurface;
  runtime: RaxCmpPort;
  metadata?: Record<string, unknown>;
}

export interface RaxCmpCreateInput {
  config: CreateRaxCmpConfigInput | RaxCmpConfig;
  runtime?: RaxCmpPort;
  control?: RaxCmpManualControlInput;
  metadata?: Record<string, unknown>;
}

export interface RaxCmpBootstrapInput {
  session: RaxCmpSession;
  payload: Omit<BootstrapCmpProjectInfraInput, "projectId" | "repoName" | "repoRootPath"> & {
    projectId?: string;
    repoName?: string;
    repoRootPath?: string;
  };
  control?: RaxCmpManualControlInput;
  metadata?: Record<string, unknown>;
}

export interface RaxCmpBootstrapResult {
  status: "bootstrapped";
  receipt: CmpProjectInfraBootstrapReceipt;
  session: RaxCmpSession;
  control: RaxCmpManualControlSurface;
  metadata?: Record<string, unknown>;
}

export interface RaxCmpReadbackInput {
  session: RaxCmpSession;
  projectId?: string;
  control?: RaxCmpManualControlInput;
  metadata?: Record<string, unknown>;
}

export interface RaxCmpReadbackResult {
  status: "found" | "not_found";
  receipt?: CmpProjectInfraBootstrapReceipt;
  infraState?: CmpRuntimeInfraProjectState;
  summary?: RaxCmpReadbackSummary;
  control?: RaxCmpManualControlSurface;
  metadata?: Record<string, unknown>;
}

export interface RaxCmpTruthLayerSummary {
  layer: "git" | "db" | "redis";
  status: "ready" | "degraded" | "failed";
  truthFor: string[];
  readbackMode: "receipt" | "infra_state" | "reconciled";
  details: Record<string, unknown>;
}

export interface RaxCmpFallbackReadiness {
  gitHistoryRebuild: "available" | "not_needed" | "unavailable";
  dbProjectionFallback: "available" | "not_needed" | "unavailable";
  recoveryReconciliation: "available" | "not_needed" | "unavailable";
  redisDeliveryRecovery: "available" | "partial" | "unavailable";
}

export type RaxCmpReadinessStatus = "ready" | "degraded" | "failed";

export interface RaxCmpReadinessCheck {
  status: RaxCmpReadinessStatus;
  summary: string;
  details?: Record<string, unknown>;
}

export interface RaxCmpObjectModelReadinessSummary {
  requestCount: number;
  sectionCount: number;
  snapshotCount: number;
  packageCount: number;
  requestStatuses: Partial<Record<CmpRequestRecord["status"], number>>;
  sectionLifecycleCounts: Partial<Record<CmpSectionRecord["lifecycle"], number>>;
  snapshotStageCounts: Partial<Record<CmpSnapshotRecord["stage"], number>>;
  packageStatusCounts: Partial<Record<CmpPackageRecord["status"], number>>;
}

export interface RaxCmpAcceptanceReadiness {
  objectModel: RaxCmpReadinessCheck;
  fiveAgentLoop: RaxCmpReadinessCheck;
  liveLlm: RaxCmpReadinessCheck;
  bundleSchema: RaxCmpReadinessCheck;
  tapExecutionBridge: RaxCmpReadinessCheck;
  liveInfra: RaxCmpReadinessCheck;
  recovery: RaxCmpReadinessCheck;
  finalAcceptance: RaxCmpReadinessCheck;
}

export interface RaxCmpStatusPanel {
  roles: Record<CmpFiveAgentRole, {
    count: number;
    latestStage?: string;
    liveMode?: CmpFiveAgentSummary["live"][CmpFiveAgentRole]["mode"];
    liveStatus?: CmpFiveAgentSummary["live"][CmpFiveAgentRole]["status"];
    fallbackApplied?: boolean;
    semanticSummary?: string;
  }>;
  packageFlow: {
    modeCounts: Partial<Record<string, number>>;
    latestTargetIngress?: string;
    latestPrimaryRef?: string;
  };
  requests: {
    parentPromoteReviewCount: number;
    pendingPeerApprovalCount: number;
    approvedPeerApprovalCount: number;
    reinterventionPendingCount: number;
    reinterventionServedCount: number;
  };
  health: {
    readbackStatus: "ready" | "degraded" | "failed";
    deliveryDriftCount: number;
    expiredDeliveryCount: number;
    liveInfraReady: boolean;
    liveLlmReadyCount: number;
    liveLlmFallbackCount: number;
    liveLlmFailedCount: number;
    recoveryStatus: RaxCmpReadinessStatus;
    finalAcceptanceStatus: RaxCmpReadinessStatus;
  };
  readiness: {
    objectModel: RaxCmpReadinessStatus;
    fiveAgentLoop: RaxCmpReadinessStatus;
    liveLlm: RaxCmpReadinessStatus;
    bundleSchema: RaxCmpReadinessStatus;
    tapExecutionBridge: RaxCmpReadinessStatus;
    liveInfra: RaxCmpReadinessStatus;
    recovery: RaxCmpReadinessStatus;
    finalAcceptance: RaxCmpReadinessStatus;
  };
}

export interface RaxCmpReadbackSummary {
  projectId: string;
  status: "ready" | "degraded" | "failed";
  receiptAvailable: boolean;
  infraStateAvailable: boolean;
  gitBootstrapStatus?: CmpProjectInfraBootstrapReceipt["git"]["status"];
  dbReceiptStatus?: CmpProjectInfraBootstrapReceipt["dbReceipt"]["status"];
  gitBranchBootstrapCount: number;
  mqBootstrapCount: number;
  expectedLineageCount: number;
  hydratedLineageCount: number;
  expectedDbTargetCount?: number;
  presentDbTargetCount?: number;
  appliedReadbackPriority: RaxCmpReadbackPriority;
  appliedFallbackPolicy: RaxCmpFallbackPolicy;
  appliedRecoveryPreference: RaxCmpRecoveryPreference;
  truthLayers: RaxCmpTruthLayerSummary[];
  fallbacks: RaxCmpFallbackReadiness;
  objectModel?: RaxCmpObjectModelReadinessSummary;
  recoverySummary?: CmpRuntimeRecoverySummary;
  projectRecovery?: CmpRuntimeProjectRecoverySummary;
  deliverySummary?: CmpRuntimeDeliveryTruthSummary;
  fiveAgentSummary?: CmpFiveAgentSummary;
  acceptance: RaxCmpAcceptanceReadiness;
  statusPanel?: RaxCmpStatusPanel;
  issues: string[];
}

export interface RaxCmpRecoverInput {
  session: RaxCmpSession;
  snapshot: CmpRuntimeSnapshot;
  control?: RaxCmpManualControlInput;
  metadata?: Record<string, unknown>;
}

export interface RaxCmpRecoverResult {
  status: "recovered";
  session: RaxCmpSession;
  snapshot: CmpRuntimeSnapshot;
  control: RaxCmpManualControlSurface;
  readback?: RaxCmpReadbackSummary;
  recovery?: {
    status: "aligned" | "degraded";
    projectRecovery?: CmpRuntimeProjectRecoverySummary;
    appliedPreference: RaxCmpRecoveryPreference;
    dryRun: boolean;
  };
  metadata?: Record<string, unknown>;
}

export interface RaxCmpRoleCapabilityAccessInput {
  session: RaxCmpSession;
  role: CmpFiveAgentRole;
  payload: {
    agentId: string;
    capabilityKey: string;
    reason: string;
    requestedTier?: TaCapabilityTier;
    mode?: TaPoolMode;
    taskContext?: Record<string, unknown>;
    requestedScope?: AccessRequestScope;
    requestedDurationMs?: number;
    metadata?: Record<string, unknown>;
  };
}

export interface RaxCmpRoleCapabilityDispatchInput {
  session: RaxCmpSession;
  role: CmpFiveAgentRole;
  payload: {
    agentId: string;
    capabilityKey: string;
    reason: string;
    capabilityInput: Record<string, unknown>;
    priority?: IntentPriority;
    timeoutMs?: number;
    requestedTier?: TaCapabilityTier;
    mode?: TaPoolMode;
    taskContext?: Record<string, unknown>;
    requestedScope?: AccessRequestScope;
    requestedDurationMs?: number;
    cmpContext?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  };
}

export interface RaxCmpSmokeCheck {
  id: string;
  gate?:
    | "truth"
    | "recovery"
    | "manual_control"
    | "delivery"
    | "lineage"
    | "object_model"
    | "five_agent"
    | "role_live"
    | "bundle_schema"
    | "tap_bridge"
    | "live_infra"
    | "final_acceptance";
  status: "ready" | "degraded" | "failed";
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface RaxCmpSmokeInput {
  session: RaxCmpSession;
  projectId?: string;
  control?: RaxCmpManualControlInput;
  metadata?: Record<string, unknown>;
}

export interface RaxCmpSmokeResult {
  status: "ready" | "degraded" | "failed";
  checks: RaxCmpSmokeCheck[];
  control?: RaxCmpManualControlSurface;
  metadata?: Record<string, unknown>;
}

export interface RaxCmpIngestInput {
  session: RaxCmpSession;
  payload: IngestRuntimeContextInput;
  control?: RaxCmpManualControlInput;
}

export interface RaxCmpCommitInput {
  session: RaxCmpSession;
  payload: CommitContextDeltaInput;
  control?: RaxCmpManualControlInput;
}

export interface RaxCmpRequestHistoryInput {
  session: RaxCmpSession;
  payload: RequestHistoricalContextInput;
  control?: RaxCmpManualControlInput;
}

export interface RaxCmpResolveInput {
  session: RaxCmpSession;
  payload: ResolveCheckedSnapshotInput;
  control?: RaxCmpManualControlInput;
}

export interface RaxCmpMaterializeInput {
  session: RaxCmpSession;
  payload: MaterializeContextPackageInput;
  control?: RaxCmpManualControlInput;
}

export interface RaxCmpDispatchInput {
  session: RaxCmpSession;
  payload: DispatchContextPackageInput;
  control?: RaxCmpManualControlInput;
}

export interface RaxCmpPeerApprovalInput {
  session: RaxCmpSession;
  approvalId: string;
  actorAgentId: string;
  decision: "approved" | "rejected";
  note?: string;
}

export interface RaxCmpProjectPort {
  bootstrapProjectInfra(
    input: BootstrapCmpProjectInfraInput,
  ): Promise<CmpProjectInfraBootstrapReceipt> | CmpProjectInfraBootstrapReceipt;
  getBootstrapReceipt(projectId: string): CmpProjectInfraBootstrapReceipt | undefined;
  getInfraProjectState?(projectId: string): CmpRuntimeInfraProjectState | undefined;
  getRecoverySummary?(): CmpRuntimeRecoverySummary;
  getProjectRecoverySummary?(projectId: string): CmpRuntimeProjectRecoverySummary | undefined;
  getDeliveryTruthSummary?(projectId: string): CmpRuntimeDeliveryTruthSummary;
  createSnapshot?(): CmpRuntimeSnapshot;
  recoverSnapshot(snapshot: CmpRuntimeSnapshot): Promise<void> | void;
  advanceDeliveryTimeouts?(input?: { projectId?: string; now?: string }): {
    projectId?: string;
    processedCount: number;
    retryScheduledCount: number;
    expiredCount: number;
  };
}

export interface RaxCmpFlowPort {
  ingest(
    input: IngestRuntimeContextInput,
  ): Promise<IngestRuntimeContextResult> | IngestRuntimeContextResult;
  commit(
    input: CommitContextDeltaInput,
  ): Promise<CommitContextDeltaResult> | CommitContextDeltaResult;
  resolve(
    input: ResolveCheckedSnapshotInput,
  ): Promise<ResolveCheckedSnapshotResult> | ResolveCheckedSnapshotResult;
  materialize(
    input: MaterializeContextPackageInput,
  ): Promise<MaterializeContextPackageResult> | MaterializeContextPackageResult;
  dispatch(
    input: DispatchContextPackageInput,
  ): Promise<DispatchContextPackageResult> | DispatchContextPackageResult;
  requestHistory(
    input: RequestHistoricalContextInput,
  ): Promise<RequestHistoricalContextResult> | RequestHistoricalContextResult;
}

export interface RaxCmpFiveAgentPort {
  getSummary?(agentId?: string): CmpFiveAgentSummary;
}

export interface RaxCmpRolesPort {
  resolveCapabilityAccess?(input: {
    role: CmpFiveAgentRole;
    sessionId: string;
    runId: string;
    agentId: string;
    capabilityKey: string;
    reason: string;
    requestedTier?: TaCapabilityTier;
    mode?: TaPoolMode;
    taskContext?: Record<string, unknown>;
    requestedScope?: AccessRequestScope;
    requestedDurationMs?: number;
    metadata?: Record<string, unknown>;
  }): Promise<CmpFiveAgentCapabilityAccessResolution> | CmpFiveAgentCapabilityAccessResolution;
  dispatchCapability?(input: {
    role: CmpFiveAgentRole;
    sessionId: string;
    runId: string;
    agentId: string;
    capabilityKey: string;
    reason: string;
    capabilityInput: Record<string, unknown>;
    priority?: IntentPriority;
    timeoutMs?: number;
    requestedTier?: TaCapabilityTier;
    mode?: TaPoolMode;
    taskContext?: Record<string, unknown>;
    requestedScope?: AccessRequestScope;
    requestedDurationMs?: number;
    cmpContext?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): Promise<DispatchCmpFiveAgentCapabilityResult> | DispatchCmpFiveAgentCapabilityResult;
  approvePeerExchange?(input: {
    approvalId: string;
    actorAgentId: string;
    decision: "approved" | "rejected";
    note?: string;
  }): Promise<CmpPeerExchangeApprovalRecord> | CmpPeerExchangeApprovalRecord;
}

export interface RaxCmpPort {
  readonly project: RaxCmpProjectPort;
  readonly flow: RaxCmpFlowPort;
  readonly fiveAgent: RaxCmpFiveAgentPort;
  readonly roles: RaxCmpRolesPort;
}

export interface RaxCmpSessionApi {
  open(input: RaxCmpCreateInput): RaxCmpSession;
}

export interface RaxCmpProjectApi {
  bootstrap(input: RaxCmpBootstrapInput): Promise<RaxCmpBootstrapResult>;
  readback(input: RaxCmpReadbackInput): Promise<RaxCmpReadbackResult>;
  recover(input: RaxCmpRecoverInput): Promise<RaxCmpRecoverResult>;
  smoke(input: RaxCmpSmokeInput): Promise<RaxCmpSmokeResult>;
}

export interface RaxCmpFlowApi {
  ingest(input: RaxCmpIngestInput): Promise<IngestRuntimeContextResult>;
  commit(input: RaxCmpCommitInput): Promise<CommitContextDeltaResult>;
  resolve(input: RaxCmpResolveInput): Promise<ResolveCheckedSnapshotResult>;
  materialize(input: RaxCmpMaterializeInput): Promise<MaterializeContextPackageResult>;
  dispatch(input: RaxCmpDispatchInput): Promise<DispatchContextPackageResult>;
  requestHistory(input: RaxCmpRequestHistoryInput): Promise<RequestHistoricalContextResult>;
}

export interface RaxCmpRolesApi {
  resolveCapabilityAccess(input: RaxCmpRoleCapabilityAccessInput): Promise<CmpFiveAgentCapabilityAccessResolution>;
  dispatchCapability(input: RaxCmpRoleCapabilityDispatchInput): Promise<DispatchCmpFiveAgentCapabilityResult>;
  approvePeerExchange(input: RaxCmpPeerApprovalInput): Promise<CmpPeerExchangeApprovalRecord>;
}

export interface RaxCmpApi {
  readonly session: RaxCmpSessionApi;
  readonly project: RaxCmpProjectApi;
  readonly flow: RaxCmpFlowApi;
  readonly roles: RaxCmpRolesApi;
}

export type RaxCmpRuntimeLike = RaxCmpPort;
export type RaxCmpFacade = RaxCmpApi;
