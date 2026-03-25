import { randomUUID } from "node:crypto";

import {
  CheckpointStore,
  createPoolRuntimeCheckpointSnapshot,
  getTapPoolRuntimeSnapshotFromRecoveryResult,
  type StoredCheckpoint,
} from "./checkpoint/index.js";
import { compileGoal } from "./goal/goal-compiler.js";
import { normalizeGoal } from "./goal/goal-normalizer.js";
import { createGoalSource } from "./goal/goal-source.js";
import type { KernelCapabilityGatewayLike } from "./capability-gateway/index.js";
import { createKernelCapabilityGateway } from "./capability-gateway/index.js";
import { createInvocationPlanFromCapabilityIntent } from "./capability-invocation/index.js";
import { DefaultCapabilityPool } from "./capability-pool/index.js";
import {
  createCapabilityResultReceivedEvent,
  findCapabilityResultEventByResultId,
} from "./capability-result/index.js";
import { executeModelInference, type ModelInferenceExecutionResult } from "./integrations/model-inference.js";
import { AppendOnlyEventJournal } from "./journal/index.js";
import type { JournalReadResult } from "./journal/journal-types.js";
import { CapabilityPortBroker, type CapabilityDispatchReceipt, type CapabilityPortDefinition } from "./port/index.js";
import { AgentRunCoordinator } from "./run/index.js";
import { SessionManager } from "./session/index.js";
import { projectStateFromEvents } from "./state/index.js";
import {
  createCmpGitBranchFamily,
  type CmpGitProjectionSourceAnchor,
  createCmpGitProjectRepo,
  createCmpGitSyncRuntimeOrchestrator,
  syncCmpGitCommitDelta,
  type CmpGitCheckedSnapshotRef,
  type CmpGitProjectRepo,
  type CmpGitPromotionRecord,
  type CmpGitPullRequestRecord,
  type CmpGitSyncIntent,
} from "./cmp-git/index.js";
import {
  createCmpDbPostgresAdapter,
  createCmpDbAgentRuntimeSyncState,
  createCmpDbContextPackageBackfillRecord,
  createCmpProjectionRecordFromCheckedSnapshot,
  promoteCmpDbProjectionForParent,
  syncCmpDbDeliveryFromDispatchReceipt,
  syncCmpDbPackageFromContextPackage,
  syncCmpDbProjectionFromCheckedSnapshot,
  type CmpDbAgentRuntimeSyncState,
  type CmpDbContextPackageRecord,
  type CmpDbDeliveryRegistryRecord,
} from "./cmp-db/index.js";
import {
  assertNoSkippingNeighborhoodBroadcast,
  assertCmpCriticalEscalationAllowed,
  assertCmpSubscriptionAllowed,
  createCmpCriticalEscalationEnvelope,
  createCmpIcmaPublishEnvelope,
  type CmpAgentNeighborhood,
} from "./cmp-mq/index.js";
import {
  acknowledgeCmpDispatchReceipt,
  acknowledgeCmpCoreAgentReturn,
  advanceCmpActiveLineRecord,
  applyCmpMqDeliveryProjectionPatchToRecord,
  assertCmpProjectionVisibleToTarget,
  createCmpDeliveryRecordFromMqProjectionPatch,
  createCmpRuntimeSnapshot,
  createCmpActiveLineRecord,
  createCmpHistoricalReplyPackage,
  createCmpContextPackageRecord,
  createCmpContextPackageRecordFromStoredSection,
  createCmpCoreAgentReturnReceipt,
  createCmpDispatchInstruction,
  createCmpDispatchReceipt,
  createCmpIngressRecord,
  createCmpMqDeliveryProjectionPatch,
  createCmpMqDeliveryStateFromDeliveryTruth,
  createCmpMqDeliveryStateFromPublish,
  createCmpProjectionRecord,
  createCmpProjectionRecordFromStoredSection,
  createPassiveHistoricalPackage,
  createCmpSectionIngressRecordFromIngress,
  executeCmpMqAckStateLowering,
  executeCmpMqDispatchStateLowering,
  evaluateCmpMqDeliveryTimeout,
  getCmpRuntimeRecoveryReconciliation,
  hydrateCmpRuntimeSnapshotWithReconciliation,
  lowerCmpSectionIngressRecordWithRulePack,
  planCmpHistoricalFallback,
  rebuildCmpHistoricalContextWithBackfillFromGitTruth,
  markCmpDispatchDelivered,
  planCmpDispatcherDelivery,
  resolveCmpPassiveHistoricalDelivery,
  type CmpActiveLineRecord,
  type CmpHistoricalFallbackDecision,
  type CmpInfraBackends,
  type CmpInfraBootstrapAgentInput,
  type CmpProjectInfraBootstrapPlan,
  type CmpProjectInfraBootstrapReceipt,
  type CmpRuntimeInfraState,
  type CmpRuntimeHydratedRecovery,
  type CmpDispatchReceipt,
  type CmpIngressRecord,
  type CmpProjectionRecord as CmpRuntimeProjectionRecord,
  type CmpRuntimeSnapshot,
  createCmpRuntimeInfraState,
  createCmpInfraBackends,
  createCmpProjectInfraBootstrapPlan,
  createCmpMqDispatchEnvelope,
  executeCmpContextPackageLowering,
  executeCmpDeliveryLowering,
  executeCmpGitSnapshotLowering,
  executeCmpMqDispatchLowering,
  executeCmpProjectionLowering,
  getCmpRuntimeInfraProjectState,
  recordCmpProjectInfraBootstrapReceipt,
  resolveCmpAgentInfraAccess,
  executeCmpProjectInfraBootstrap,
} from "./cmp-runtime/index.js";
import {
  activateProvisionAsset,
  applyTaHumanGateEvent,
  createActivationFactoryResolver,
  createPoolRuntimeSnapshots,
  createTaHumanGateEvent,
  createTaHumanGateStateFromReviewDecision,
  createTaPendingReplay,
  createExecutionRequest,
  createInvocationPlanFromGrant,
  createTapPoolRuntimeSnapshot,
  TaControlPlaneGateway,
  type ActivationAdapterFactory,
  type ActivationDriverResult,
  type PoolRuntimeSnapshots,
  type TapPoolRuntimeSnapshot,
  type TaActivationFailure,
  type TaActivationReceipt,
  type TaActivationAttemptRecord,
  type TaHumanGateEvent,
  type TaHumanGateState,
  type TaPendingReplay,
  materializeProvisionAssetActivation,
} from "./ta-pool-runtime/index.js";
import { createReviewerRuntime, ReviewerRuntime } from "./ta-pool-review/index.js";
import { createProvisionerRuntime, ProvisionerRuntime } from "./ta-pool-provision/index.js";
import type { ProvisionAssetRecord } from "./ta-pool-provision/index.js";
import { evaluateSafetyInterception, type TaSafetyInterceptorConfig } from "./ta-pool-safety/index.js";
import { formatPlainLanguageRisk } from "./ta-pool-context/plain-language-risk.js";
import { toProvisionRequestFromReviewDecision, type ReviewDecisionEngineInventory } from "./ta-pool-review/index.js";
import type {
  CapabilityCallIntent,
  CmpActionIntent,
  ModelInferenceIntent,
  CapabilityPortResponse,
  GoalFrameCompiled,
  GoalFrameSource,
  KernelEvent,
  CheckpointReason,
  SessionHeader,
} from "./types/index.js";
import type {
  CapabilityAdapter,
  CapabilityExecutionHandle,
  CapabilityInvocationPlan,
  CapabilityManifest,
  CapabilityResultEnvelope,
} from "./capability-types/index.js";
import type {
  AccessRequestScope,
  AccessRequest,
  AgentCapabilityProfile,
  CapabilityGrant,
  DecisionToken,
  PlainLanguageRiskPayload,
  PoolActivationSpec,
  ProvisionArtifactBundle,
  ProvisionRequest,
  ReplayPolicy,
  ReviewDecision,
  TaCapabilityTier,
  TaPoolMode,
} from "./ta-pool-types/index.js";
import {
  createProvisionRequest,
  createReviewDecision,
} from "./ta-pool-types/index.js";
import {
  createAgentLineage,
  createCmpBranchFamily,
  createCheckedSnapshot,
  createCommitContextDeltaInput,
  createContextDelta,
  createContextEvent,
  createContextPackage,
  createDispatchContextPackageInput,
  createDispatchReceipt,
  createIngestRuntimeContextInput,
  createIngestRuntimeContextResult,
  createMaterializeContextPackageInput,
  createPromotedProjection,
  createRequestHistoricalContextInput,
  createResolveCheckedSnapshotInput,
  createSnapshotCandidate,
  createSyncEvent,
  type AgentLineage,
  type CheckedSnapshot,
  type CmpRulePack,
  type CmpStoredSection,
  type CommitContextDeltaInput,
  type CommitContextDeltaResult,
  type ContextDelta,
  type ContextEvent,
  type ContextPackage,
  type DispatchContextPackageInput,
  type DispatchContextPackageResult,
  type DispatchReceipt,
  type IngestRuntimeContextInput,
  type IngestRuntimeContextResult,
  type MaterializeContextPackageInput,
  type MaterializeContextPackageResult,
  type PromotedProjection,
  type RequestHistoricalContextInput,
  type RequestHistoricalContextResult,
  type ResolveCheckedSnapshotInput,
  type ResolveCheckedSnapshotResult,
  type SnapshotCandidate,
  type SyncEvent,
} from "./cmp-types/index.js";
import type { CreateSessionInput } from "./session/index.js";
import type { CreateRunInput, RunTransitionOutcome } from "./run/index.js";

export interface AgentCoreRuntimeOptions {
  journal?: AppendOnlyEventJournal;
  checkpointStore?: CheckpointStore;
  portBroker?: CapabilityPortBroker;
  capabilityPool?: DefaultCapabilityPool;
  capabilityGateway?: KernelCapabilityGatewayLike;
  taControlPlaneGateway?: TaControlPlaneGateway;
  taProfile?: AgentCapabilityProfile;
  reviewerRuntime?: ReviewerRuntime;
  provisionerRuntime?: ProvisionerRuntime;
  taSafetyConfig?: TaSafetyInterceptorConfig;
  runCoordinator?: AgentRunCoordinator;
  sessionManager?: SessionManager;
  modelInferenceExecutor?: (params: { intent: ModelInferenceIntent }) => Promise<ModelInferenceExecutionResult>;
  cmpInfraBackends?: CmpInfraBackends;
}

export interface CreateAgentCoreRunInput extends Omit<CreateRunInput, "goal"> {
  goal: GoalFrameCompiled;
}

export interface CreateAgentCoreRunFromSourceInput extends Omit<CreateRunInput, "goal"> {
  source: GoalFrameSource;
}

export interface DispatchCapabilityIntentResult {
  enqueueResponse: CapabilityPortResponse;
  dispatchReceipt?: CapabilityDispatchReceipt;
  latestEvent?: KernelEvent;
  runOutcome?: RunTransitionOutcome;
}

export interface DispatchModelInferenceIntentResult {
  result: KernelEvent;
  kernelResult: ModelInferenceExecutionResult["result"];
  runOutcome: RunTransitionOutcome;
}

export interface DispatchCmpActionIntentResult {
  result: KernelEvent;
  action: CmpActionIntent["request"]["action"];
  actionResult?: unknown;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  runOutcome: RunTransitionOutcome;
}

export interface DispatchCapabilityPlanInput {
  plan: CapabilityInvocationPlan;
  sessionId: string;
  runId: string;
  requestId?: string;
  correlationId?: string;
  resultSource?: "capability" | "model";
  final?: boolean;
}

export interface DispatchCapabilityPlanResult {
  lease: Awaited<ReturnType<KernelCapabilityGatewayLike["acquire"]>>;
  prepared: Awaited<ReturnType<KernelCapabilityGatewayLike["prepare"]>>;
  handle: CapabilityExecutionHandle;
}

export interface BootstrapCmpProjectInfraInput {
  projectId: string;
  repoName: string;
  repoRootPath: string;
  agents: readonly CmpInfraBootstrapAgentInput[];
  defaultAgentId?: string;
  defaultBranchName?: string;
  worktreeRootPath?: string;
  databaseName?: string;
  dbSchemaName?: string;
  redisNamespaceRoot?: string;
  metadata?: Record<string, unknown>;
}

export interface CmpRuntimeProjectRecoverySummary {
  projectId: string;
  status: "aligned" | "degraded" | "snapshot_only" | "infra_only";
  recommendedAction:
    | "none"
    | "hydrate_from_snapshot"
    | "hydrate_from_infra"
    | "reconcile_snapshot_and_infra";
  issues: string[];
}

export interface CmpRuntimeRecoverySummary {
  totalProjects: number;
  alignedProjectIds: string[];
  degradedProjectIds: string[];
  snapshotOnlyProjectIds: string[];
  infraOnlyProjectIds: string[];
  recommendedHydrateFromSnapshot: string[];
  recommendedHydrateFromInfra: string[];
  recommendedReconcile: string[];
}

export interface CmpRuntimeDeliveryTruthSummary {
  projectId: string;
  totalDispatches: number;
  publishedCount: number;
  acknowledgedCount: number;
  retryScheduledCount: number;
  expiredCount: number;
  driftCount: number;
  pendingAckCount: number;
  status: "ready" | "degraded" | "failed";
  issues: string[];
}

export interface AdvanceCmpMqDeliveryTimeoutsInput {
  projectId?: string;
  now?: string;
}

export interface AdvanceCmpMqDeliveryTimeoutsResult {
  projectId?: string;
  processedCount: number;
  retryScheduledCount: number;
  expiredCount: number;
}

export interface DispatchCapabilityIntentViaTaPoolOptions {
  agentId: string;
  reason?: string;
  requestedTier?: TaCapabilityTier;
  mode?: TaPoolMode;
  requestedScope?: AccessRequestScope;
  requestedDurationMs?: number;
  taskContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export type TaCapabilityAssemblyStatus =
  | "dispatched"
  | "review_required"
  | "denied"
  | "deferred"
  | "waiting_human"
  | "escalated_to_human"
  | "redirected_to_provisioning"
  | "provisioned"
  | "provisioning_failed"
  | "blocked"
  | "interrupted";

export interface DispatchCapabilityIntentViaTaPoolResult {
  status: TaCapabilityAssemblyStatus;
  grant?: CapabilityGrant;
  decisionToken?: DecisionToken;
  accessRequest?: AccessRequest;
  reviewDecision?: ReviewDecision;
  provisionRequest?: ProvisionRequest;
  provisionBundle?: ProvisionArtifactBundle;
  activation?: TaCapabilityActivationHandoff;
  replay?: TaCapabilityReplayHandoff;
  humanGate?: TaCapabilityHumanGateHandoff;
  dispatch?: DispatchCapabilityPlanResult;
  safety?: ReturnType<typeof evaluateSafetyInterception>;
  runOutcome?: RunTransitionOutcome;
}

export interface TaCapabilityActivationHandoff {
  source: "provision_bundle" | "provision_asset";
  status: "ready_for_review" | "activating" | "active";
  activationMode?: PoolActivationSpec["activationMode"];
  targetPool?: string;
  adapterFactoryRef?: string;
  bindingArtifactRef?: string;
  note: string;
  metadata?: Record<string, unknown>;
}

export interface TaCapabilityReplayHandoff {
  source: "provision_bundle" | "provision_asset";
  policy: ReplayPolicy;
  state: "none" | "pending_manual" | "pending_after_verify" | "pending_re_review";
  reason: string;
  requiresReviewerApproval: boolean;
  suggestedTrigger?: string;
  nextStep: string;
  metadata?: Record<string, unknown>;
}

export interface TaCapabilityHumanGateHandoff {
  status: "waiting_human_approval" | "approved" | "rejected";
  source: "safety_interceptor" | "review_decision" | "replay_policy";
  capabilityKey: string;
  requestedTier: TaCapabilityTier;
  mode: TaPoolMode;
  reason: string;
  plainLanguageRisk: PlainLanguageRiskPayload;
  availableUserActions: PlainLanguageRiskPayload["availableUserActions"];
  metadata?: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
  return (typeof value === "object" || typeof value === "function")
    && value !== null
    && "then" in value
    && typeof (value as { then?: unknown }).then === "function";
}

function mapCmpDispatchKindToMqChannel(targetKind: DispatchContextPackageInput["targetKind"]): "to_parent" | "peer" | "to_children" {
  switch (targetKind) {
    case "parent":
      return "to_parent";
    case "child":
      return "to_children";
    case "peer":
    default:
      return "peer";
  }
}

function mapCmpDeliveryRecordStateToTruthStatus(
  state: CmpDbDeliveryRegistryRecord["state"],
): "published" | "acknowledged" | "retry_scheduled" | "expired" {
  switch (state) {
    case "acknowledged":
      return "acknowledged";
    case "expired":
      return "expired";
    default:
      return "published";
  }
}

function mapCmpMqTruthStatusToDispatchStatus(
  status: "published" | "acknowledged" | "retry_scheduled" | "expired",
): DispatchReceipt["status"] {
  switch (status) {
    case "acknowledged":
      return "acknowledged";
    case "expired":
      return "expired";
    default:
      return "delivered";
  }
}

function isCmpStoredSectionLike(value: unknown): value is CmpStoredSection {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.id === "string"
    && typeof value.projectId === "string"
    && typeof value.agentId === "string"
    && typeof value.sourceSectionId === "string"
    && typeof value.plane === "string"
    && typeof value.storageRef === "string"
    && typeof value.state === "string"
    && typeof value.visibility === "string"
    && typeof value.persistedAt === "string"
    && typeof value.updatedAt === "string";
}

function readCmpStoredSectionsFromMetadata(value: unknown): CmpStoredSection[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(isCmpStoredSectionLike)
    .map((section) => ({
      ...section,
      metadata: section.metadata ? structuredClone(section.metadata) : undefined,
    }));
}

function createCmpRuntimeDefaultSectionRulePack(): CmpRulePack {
  return {
    id: "cmp-runtime-default-section-pack",
    name: "CMP Runtime Default Section Pack",
    rules: [
      {
        id: "cmp-runtime-store-runtime-context",
        name: "Store runtime context sections",
        action: "store",
        priority: 100,
        sectionKinds: ["runtime_context"],
        minFidelity: "exact",
      },
      {
        id: "cmp-runtime-store-historical-context",
        name: "Store historical context sections",
        action: "store",
        priority: 90,
        sectionKinds: ["historical_context"],
        minFidelity: "exact",
      },
      {
        id: "cmp-runtime-store-task-seed",
        name: "Store task seed sections",
        action: "store",
        priority: 80,
        sectionKinds: ["task_seed"],
        minFidelity: "exact",
      },
      {
        id: "cmp-runtime-store-peer-signal",
        name: "Store peer signal sections",
        action: "store",
        priority: 70,
        sectionKinds: ["peer_signal"],
        minFidelity: "exact",
      },
      {
        id: "cmp-runtime-store-promotion-signal",
        name: "Store promotion signal sections",
        action: "store",
        priority: 60,
        sectionKinds: ["promotion_signal"],
        minFidelity: "exact",
      },
    ],
  };
}

export interface SubmitTaHumanGateDecisionInput {
  gateId: string;
  action: "approve" | "reject";
  actorId?: string;
  note?: string;
}

export type SubmitTaHumanGateDecisionStatus =
  | DispatchCapabilityIntentViaTaPoolResult["status"]
  | "human_gate_not_found";

export interface SubmitTaHumanGateDecisionResult
  extends Omit<DispatchCapabilityIntentViaTaPoolResult, "status"> {
  status: SubmitTaHumanGateDecisionStatus;
}

export type ActivateTaProvisionAssetStatus =
  | ActivationDriverResult["status"]
  | "activation_asset_not_found";

export interface ActivateTaProvisionAssetResult {
  status: ActivateTaProvisionAssetStatus;
  asset?: ProvisionAssetRecord;
  attempt?: TaActivationAttemptRecord;
  receipt?: TaActivationReceipt;
  failure?: TaActivationFailure;
  activation?: TaCapabilityActivationHandoff;
}

interface TaHumanGateContext {
  intent: CapabilityCallIntent;
  options: DispatchCapabilityIntentViaTaPoolOptions;
  accessRequest: AccessRequest;
  reviewDecision: ReviewDecision;
}

export interface ResolveTaCapabilityAccessInput {
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
}

export interface DispatchTaCapabilityGrantInput {
  grant: CapabilityGrant;
  decisionToken?: DecisionToken;
  sessionId: string;
  runId: string;
  intentId: string;
  requestId?: string;
  capabilityKey?: string;
  operation?: string;
  input: Record<string, unknown>;
  priority: CapabilityInvocationPlan["priority"];
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
}

export class AgentCoreRuntime {
  readonly journal: AppendOnlyEventJournal;
  readonly checkpointStore: CheckpointStore;
  readonly portBroker: CapabilityPortBroker;
  readonly capabilityPool: DefaultCapabilityPool;
  readonly capabilityGateway: KernelCapabilityGatewayLike;
  readonly taControlPlaneGateway?: TaControlPlaneGateway;
  readonly reviewerRuntime?: ReviewerRuntime;
  readonly provisionerRuntime?: ProvisionerRuntime;
  readonly runCoordinator: AgentRunCoordinator;
  readonly sessionManager: SessionManager;
  readonly cmpInfraBackends: CmpInfraBackends;
  readonly #taSafetyConfig?: TaSafetyInterceptorConfig;
  readonly #modelInferenceExecutor: (params: { intent: ModelInferenceIntent }) => Promise<ModelInferenceExecutionResult>;
  readonly #capabilityExecutionContext = new Map<string, DispatchCapabilityPlanInput>();
  readonly #capabilityPreparedContext = new Map<string, DispatchCapabilityPlanInput>();
  readonly #capabilityRunOutcomes = new Map<string, RunTransitionOutcome>();
  readonly #capabilityRunOutcomeWaiters = new Map<string, {
    resolve: (outcome: RunTransitionOutcome | undefined) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();
  readonly #taHumanGates = new Map<string, TaHumanGateState>();
  readonly #taHumanGateContexts = new Map<string, TaHumanGateContext>();
  readonly #taHumanGateEvents = new Map<string, TaHumanGateEvent[]>();
  readonly #taPendingReplays = new Map<string, TaPendingReplay>();
  readonly #taActivationAttempts = new Map<string, TaActivationAttemptRecord>();
  readonly #taActivationFactoryResolver = createActivationFactoryResolver();
  readonly #cmpProjectRepos = new Map<string, CmpGitProjectRepo>();
  readonly #cmpGitOrchestrator = createCmpGitSyncRuntimeOrchestrator();
  readonly #cmpDbRuntimeSync: CmpDbAgentRuntimeSyncState = createCmpDbAgentRuntimeSyncState();
  readonly #cmpLineages = new Map<string, AgentLineage>();
  readonly #cmpIngressRecords = new Map<string, CmpIngressRecord>();
  readonly #cmpEvents = new Map<string, ContextEvent>();
  readonly #cmpEventsByAgent = new Map<string, string[]>();
  readonly #cmpDeltas = new Map<string, ContextDelta>();
  readonly #cmpActiveLines = new Map<string, CmpActiveLineRecord>();
  readonly #cmpSnapshotCandidates = new Map<string, SnapshotCandidate>();
  readonly #cmpCheckedSnapshots = new Map<string, CheckedSnapshot>();
  readonly #cmpGitCheckedRefs = new Map<string, CmpGitCheckedSnapshotRef>();
  readonly #cmpGitPullRequests = new Map<string, CmpGitPullRequestRecord>();
  readonly #cmpGitPromotions = new Map<string, CmpGitPromotionRecord>();
  readonly #cmpPromotedProjections = new Map<string, PromotedProjection>();
  readonly #cmpRuntimeProjections = new Map<string, CmpRuntimeProjectionRecord>();
  readonly #cmpPackages = new Map<string, ContextPackage>();
  readonly #cmpDispatchReceipts = new Map<string, DispatchReceipt>();
  readonly #cmpRuntimeDispatchReceipts = new Map<string, CmpDispatchReceipt>();
  readonly #cmpSyncEvents = new Map<string, SyncEvent>();
  readonly #cmpProjectInfraBootstrapReceipts = new Map<string, CmpProjectInfraBootstrapReceipt>();
  #cmpRuntimeInfraState: CmpRuntimeInfraState = createCmpRuntimeInfraState();

  constructor(options: AgentCoreRuntimeOptions = {}) {
    this.journal = options.journal ?? new AppendOnlyEventJournal();
    this.checkpointStore = options.checkpointStore ?? new CheckpointStore();
    this.portBroker = options.portBroker ?? new CapabilityPortBroker({
      journal: this.journal,
    });
    this.capabilityPool = options.capabilityPool ?? new DefaultCapabilityPool();
    this.capabilityGateway = options.capabilityGateway ?? createKernelCapabilityGateway({
      pool: this.capabilityPool,
    });
    this.taControlPlaneGateway = options.taControlPlaneGateway
      ?? (options.taProfile ? new TaControlPlaneGateway({ profile: options.taProfile }) : undefined);
    this.reviewerRuntime = options.reviewerRuntime
      ?? (this.taControlPlaneGateway ? createReviewerRuntime() : undefined);
    this.provisionerRuntime = options.provisionerRuntime
      ?? (this.taControlPlaneGateway ? createProvisionerRuntime() : undefined);
    this.#taSafetyConfig = options.taSafetyConfig;
    this.runCoordinator = options.runCoordinator ?? new AgentRunCoordinator({
      journal: this.journal,
      checkpointStore: this.checkpointStore,
    });
    this.sessionManager = options.sessionManager ?? new SessionManager();
    this.cmpInfraBackends = createCmpInfraBackends(options.cmpInfraBackends);
    this.#modelInferenceExecutor = options.modelInferenceExecutor ?? executeModelInference;
    this.capabilityGateway.onResult((result) => {
      void this.#handleCapabilityResultEnvelope(result);
    });
  }

  createSession(input: CreateSessionInput = {}): SessionHeader {
    return this.sessionManager.createSession(input);
  }

  createCompiledGoal(source: GoalFrameSource): GoalFrameCompiled {
    return compileGoal(normalizeGoal(source), {});
  }

  async createRun(input: CreateAgentCoreRunInput): Promise<RunTransitionOutcome> {
    const outcome = await this.runCoordinator.createRun(input);
    this.sessionManager.attachRun({
      sessionId: input.sessionId,
      runId: outcome.run.runId,
      makeActive: true,
    });
    return outcome;
  }

  async createRunFromSource(input: CreateAgentCoreRunFromSourceInput): Promise<RunTransitionOutcome> {
    const compiledGoal = this.createCompiledGoal(input.source);
    return this.createRun({
      ...input,
      goal: compiledGoal,
    });
  }

  registerCapabilityPort(definition: CapabilityPortDefinition): void {
    this.portBroker.registerCapabilityPort(definition);
  }

  registerCapabilityAdapter(manifest: CapabilityManifest, adapter: CapabilityAdapter) {
    return this.capabilityPool.register(manifest, adapter);
  }

  registerTaActivationFactory(ref: string, factory: ActivationAdapterFactory): void {
    this.#taActivationFactoryResolver.register(ref, factory);
  }

  async dispatchCapabilityPlan(input: DispatchCapabilityPlanInput): Promise<DispatchCapabilityPlanResult> {
    const lease = await this.capabilityGateway.acquire(input.plan);
    const prepared = await this.capabilityGateway.prepare(lease, input.plan);
    this.#capabilityPreparedContext.set(prepared.preparedId, input);
    const handle = await this.capabilityGateway.dispatch(prepared);
    this.#capabilityExecutionContext.set(handle.executionId, input);
    return {
      lease,
      prepared,
      handle,
    };
  }

  async dispatchCapabilityIntentViaGateway(intent: CapabilityCallIntent): Promise<DispatchCapabilityPlanResult> {
    return this.dispatchCapabilityPlan({
      plan: createInvocationPlanFromCapabilityIntent(intent),
      sessionId: intent.sessionId,
      runId: intent.runId,
      requestId: intent.request.requestId,
      correlationId: intent.correlationId,
      resultSource: "capability",
    });
  }

  resolveTaCapabilityAccess(input: ResolveTaCapabilityAccessInput) {
    if (!this.taControlPlaneGateway) {
      throw new Error("T/A control-plane gateway is not configured on this runtime.");
    }

    return this.taControlPlaneGateway.resolveCapabilityAccess(input);
  }

  async dispatchTaCapabilityGrant(input: DispatchTaCapabilityGrantInput): Promise<DispatchCapabilityPlanResult> {
    const requestId = input.requestId ?? `${input.intentId}:ta-exec`;
    const request = createExecutionRequest({
      requestId,
      sessionId: input.sessionId,
      runId: input.runId,
      intentId: input.intentId,
      capabilityKey: input.capabilityKey ?? input.grant.capabilityKey,
      operation: input.operation ?? input.capabilityKey ?? input.grant.capabilityKey,
      input: input.input,
      timeoutMs: input.timeoutMs,
      priority: input.priority,
      metadata: input.metadata,
    });

    return this.dispatchCapabilityPlan({
      plan: createInvocationPlanFromGrant({
        grant: input.grant,
        request,
        decisionToken: input.decisionToken,
      }),
      sessionId: input.sessionId,
      runId: input.runId,
      requestId,
      correlationId: input.intentId,
      resultSource: "capability",
    });
  }

  getTaHumanGate(gateId: string): TaHumanGateState | undefined {
    return this.#taHumanGates.get(gateId);
  }

  listTaHumanGates(): readonly TaHumanGateState[] {
    return [...this.#taHumanGates.values()];
  }

  listTaHumanGateEvents(gateId: string): readonly TaHumanGateEvent[] {
    return this.#taHumanGateEvents.get(gateId) ?? [];
  }

  getTaPendingReplay(replayId: string): TaPendingReplay | undefined {
    return this.#taPendingReplays.get(replayId);
  }

  listTaPendingReplays(): readonly TaPendingReplay[] {
    return [...this.#taPendingReplays.values()];
  }

  getTaActivationAttempt(attemptId: string): TaActivationAttemptRecord | undefined {
    return this.#taActivationAttempts.get(attemptId);
  }

  listTaActivationAttempts(): readonly TaActivationAttemptRecord[] {
    return [...this.#taActivationAttempts.values()];
  }

  createTapCheckpointSnapshot(runId: string) {
    const run = this.runCoordinator.getRun(runId);
    if (!run) {
      return undefined;
    }

    return createPoolRuntimeCheckpointSnapshot({
      run,
      state: projectStateFromEvents(this.journal.readRunEvents(runId).map((entry) => entry.event)),
      sessionHeader: this.sessionManager.loadSessionHeader(run.sessionId),
      poolRuntimeSnapshots: this.createPoolRuntimeSnapshots(),
      cmpRuntimeSnapshot: this.createCmpRuntimeSnapshot(),
    });
  }

  async writeTapDurableCheckpoint(
    runId: string,
    reason: CheckpointReason = "manual",
  ): Promise<StoredCheckpoint | undefined> {
    const snapshot = this.createTapCheckpointSnapshot(runId);
    const run = this.runCoordinator.getRun(runId);
    if (!snapshot || !run) {
      return undefined;
    }

    const latest = this.journal.getLatestEvent(runId);
    return this.checkpointStore.writeDurableCheckpoint({
      checkpointId: randomUUID(),
      sessionId: run.sessionId,
      runId,
      reason,
      createdAt: new Date().toISOString(),
      basedOnEventId: latest?.event.eventId,
      journalCursor: latest?.cursor,
      pendingIntentId: run.pendingIntentId,
      snapshot,
      metadata: {
        source: "tap-runtime-checkpoint",
      },
    });
  }

  async recoverTapRuntimeSnapshot(runId: string) {
    const recovery = await this.checkpointStore.recoverRun({
      runId,
      journal: this.journal,
    });
    return getTapPoolRuntimeSnapshotFromRecoveryResult(recovery);
  }

  createTapRuntimeSnapshot(): TapPoolRuntimeSnapshot {
    return createTapPoolRuntimeSnapshot({
      humanGates: [...this.listTaHumanGates()],
      humanGateEvents: [...this.#taHumanGateEvents.values()].flat(),
      pendingReplays: [...this.listTaPendingReplays()],
      activationAttempts: [...this.listTaActivationAttempts()],
      resumeEnvelopes: [],
    });
  }

  async writeCmpDurableCheckpoint(
    runId: string,
    reason: CheckpointReason = "manual",
  ): Promise<StoredCheckpoint | undefined> {
    const snapshot = this.createTapCheckpointSnapshot(runId);
    const run = this.runCoordinator.getRun(runId);
    if (!snapshot || !run) {
      return undefined;
    }

    const latest = this.journal.getLatestEvent(runId);
    return this.checkpointStore.writeDurableCheckpoint({
      checkpointId: randomUUID(),
      sessionId: run.sessionId,
      runId,
      reason,
      createdAt: new Date().toISOString(),
      basedOnEventId: latest?.event.eventId,
      journalCursor: latest?.cursor,
      pendingIntentId: run.pendingIntentId,
      snapshot: {
        ...snapshot,
        cmpRuntimeSnapshot: this.createCmpRuntimeSnapshot(),
      },
      metadata: {
        source: "cmp-runtime-checkpoint",
      },
    });
  }

  async loadCmpRuntimeSnapshotFromCheckpoint(runId: string): Promise<CmpRuntimeSnapshot | undefined> {
    const recovery = await this.checkpointStore.recoverRun({
      runId,
      journal: this.journal,
    });
    return recovery.cmpRuntimeSnapshot ? structuredClone(recovery.cmpRuntimeSnapshot) : undefined;
  }

  createPoolRuntimeSnapshots(): PoolRuntimeSnapshots {
    return createPoolRuntimeSnapshots({
      tap: this.createTapRuntimeSnapshot(),
    });
  }

  #writeTapControlPlaneCheckpoint(params: {
    sessionId: string;
    runId: string;
    reason: "manual" | "pause";
    metadata?: Record<string, unknown>;
  }): void {
    const run = this.runCoordinator.getRun(params.runId);
    if (!run) {
      return;
    }

    const sessionHeader = this.sessionManager.loadSessionHeader(params.sessionId);
    if (!sessionHeader) {
      return;
    }

    const createdAt = new Date().toISOString();
    const latest = this.journal.getLatestEvent(params.runId);
    const snapshot = createPoolRuntimeCheckpointSnapshot({
      run,
      state: projectStateFromEvents(
        this.journal.readRunEvents(params.runId).map((entry) => entry.event),
      ),
      sessionHeader,
      poolRuntimeSnapshots: this.createPoolRuntimeSnapshots(),
      cmpRuntimeSnapshot: this.createCmpRuntimeSnapshot(),
    });
    const checkpointId = randomUUID();

    this.checkpointStore.writeFastCheckpoint({
      checkpointId,
      sessionId: params.sessionId,
      runId: params.runId,
      reason: params.reason,
      createdAt,
      basedOnEventId: latest?.event.eventId,
      journalCursor: latest?.cursor,
      pendingIntentId: run.pendingIntentId,
      snapshot,
      metadata: {
        source: "tap-control-plane",
        ...(params.metadata ?? {}),
      },
    });
    this.sessionManager.markCheckpoint({
      sessionId: params.sessionId,
      checkpointId,
      journalCursor: latest?.cursor,
    });
    void this.checkpointStore.writeDurableCheckpoint({
      checkpointId,
      sessionId: params.sessionId,
      runId: params.runId,
      reason: params.reason,
      createdAt,
      basedOnEventId: latest?.event.eventId,
      journalCursor: latest?.cursor,
      pendingIntentId: run.pendingIntentId,
      snapshot,
      metadata: {
        source: "tap-control-plane",
        durable: true,
        ...(params.metadata ?? {}),
      },
    });
  }

  async activateTaProvisionAsset(provisionId: string): Promise<ActivateTaProvisionAssetResult> {
    const asset = this.provisionerRuntime?.assetIndex.getCurrent(provisionId);
    if (!asset) {
      return {
        status: "activation_asset_not_found",
      };
    }

    this.provisionerRuntime?.assetIndex.updateState({
      provisionId,
      status: "activating",
      updatedAt: new Date().toISOString(),
      metadata: {
        activationRequested: true,
      },
    });

    const activationResult = await activateProvisionAsset({
      asset,
      materialized: materializeProvisionAssetActivation({ asset }),
      poolRegistry: {
        getActiveRegistrationsForCapability: (capabilityKey: string) => {
          const manifests = this.capabilityPool.listCapabilities();
          const bindings = this.capabilityPool.listBindings();
          return manifests
            .filter((manifest) => manifest.capabilityKey === capabilityKey)
            .flatMap((manifest) => {
              return bindings
                .filter((binding) => binding.capabilityId === manifest.capabilityId && binding.state === "active")
                .map((binding) => ({
                  manifest,
                  binding,
                  adapter: undefined as unknown as CapabilityAdapter,
                }));
            });
        },
        register: (manifest: CapabilityManifest, adapter: CapabilityAdapter) => ({
          manifest,
          binding: this.capabilityPool.register(manifest, adapter),
          adapter,
        }),
        replace: (bindingId: string, manifest: CapabilityManifest, adapter: CapabilityAdapter) => ({
          manifest,
          binding: this.capabilityPool.replace(bindingId, manifest, adapter),
          adapter,
        }),
      },
      factoryResolver: this.#taActivationFactoryResolver,
    });

    this.#taActivationAttempts.set(activationResult.attempt.attemptId, activationResult.attempt);

    const updatedAt = activationResult.attempt.completedAt ?? activationResult.attempt.updatedAt;
    this.provisionerRuntime?.assetIndex.updateState({
      provisionId,
      status: activationResult.status === "activated" ? "active" : "failed",
      updatedAt,
      metadata: activationResult.status === "activated"
        ? {
          activatedIntoPool: true,
          activationAttemptId: activationResult.attempt.attemptId,
          activationReceipt: activationResult.receipt,
        }
        : {
          activationAttemptId: activationResult.attempt.attemptId,
          activationFailure: activationResult.failure,
        },
    });

    const currentAsset = this.provisionerRuntime?.assetIndex.getCurrent(provisionId) ?? activationResult.asset;
    const relatedReplay = [...this.#taPendingReplays.values()].find((replay) => replay.provisionId === provisionId);
    const sessionId = typeof relatedReplay?.metadata?.sessionId === "string"
      ? relatedReplay.metadata.sessionId
      : undefined;
    const runId = typeof relatedReplay?.metadata?.runId === "string"
      ? relatedReplay.metadata.runId
      : undefined;
    if (sessionId && runId) {
      this.#writeTapControlPlaneCheckpoint({
        sessionId,
        runId,
        reason: "manual",
        metadata: {
          sourceOperation: "activation",
          provisionId,
          activationStatus: activationResult.status,
        },
      });
    }

    return {
      status: activationResult.status,
      asset: currentAsset,
      attempt: activationResult.attempt,
      receipt: activationResult.status === "activated" ? activationResult.receipt : undefined,
      failure: activationResult.status === "failed" ? activationResult.failure : undefined,
      activation: currentAsset
        ? this.#createActivationHandoff({
          source: "provision_asset",
          asset: currentAsset,
        })
        : undefined,
    };
  }

  getCmpLineage(agentId: string): AgentLineage | undefined {
    return this.#cmpLineages.get(agentId);
  }

  listCmpLineages(): readonly AgentLineage[] {
    return [...this.#cmpLineages.values()];
  }

  readCmpEvents(agentId?: string): readonly ContextEvent[] {
    if (!agentId) {
      return [...this.#cmpEvents.values()];
    }
    return (this.#cmpEventsByAgent.get(agentId) ?? [])
      .map((eventId) => this.#cmpEvents.get(eventId))
      .filter((event): event is ContextEvent => event !== undefined);
  }

  getCmpDelta(deltaId: string): ContextDelta | undefined {
    return this.#cmpDeltas.get(deltaId);
  }

  listCmpDeltas(): readonly ContextDelta[] {
    return [...this.#cmpDeltas.values()];
  }

  getCmpSnapshotCandidate(candidateId: string): SnapshotCandidate | undefined {
    return this.#cmpSnapshotCandidates.get(candidateId);
  }

  listCmpSnapshotCandidates(): readonly SnapshotCandidate[] {
    return [...this.#cmpSnapshotCandidates.values()];
  }

  getCmpCheckedSnapshot(snapshotId: string): CheckedSnapshot | undefined {
    return this.#cmpCheckedSnapshots.get(snapshotId);
  }

  listCmpCheckedSnapshots(): readonly CheckedSnapshot[] {
    return [...this.#cmpCheckedSnapshots.values()];
  }

  listCmpGitPullRequests(): readonly CmpGitPullRequestRecord[] {
    return this.#cmpGitOrchestrator.listPullRequests();
  }

  listCmpGitPromotions(): readonly CmpGitPromotionRecord[] {
    return this.#cmpGitOrchestrator.listPromotions();
  }

  listCmpGitCheckedRefs(): readonly CmpGitCheckedSnapshotRef[] {
    return this.#cmpGitOrchestrator.listCheckedRefs();
  }

  getCmpProjectInfraBootstrapReceipt(projectId: string): CmpProjectInfraBootstrapReceipt | undefined {
    return this.#cmpProjectInfraBootstrapReceipts.get(projectId);
  }

  listCmpProjectInfraBootstrapReceipts(): readonly CmpProjectInfraBootstrapReceipt[] {
    return [...this.#cmpProjectInfraBootstrapReceipts.values()];
  }

  getCmpRuntimeInfraProjectState(projectId: string) {
    return getCmpRuntimeInfraProjectState(this.#cmpRuntimeInfraState, projectId);
  }

  createCmpProjectInfraBootstrapPlan(
    input: BootstrapCmpProjectInfraInput,
  ): CmpProjectInfraBootstrapPlan {
    return createCmpProjectInfraBootstrapPlan(input);
  }

  async bootstrapCmpProjectInfra(
    input: BootstrapCmpProjectInfraInput,
  ): Promise<CmpProjectInfraBootstrapReceipt> {
    if (!this.cmpInfraBackends.git) {
      throw new Error("CMP git backend is not configured on this runtime.");
    }
    if (!this.cmpInfraBackends.mq) {
      throw new Error("CMP mq backend is not configured on this runtime.");
    }

    const receipt = await executeCmpProjectInfraBootstrap({
      plan: this.createCmpProjectInfraBootstrapPlan(input),
      gitBackend: this.cmpInfraBackends.git,
      dbExecutor: this.cmpInfraBackends.dbExecutor,
      mqAdapter: this.cmpInfraBackends.mq,
    });

    this.#cmpProjectRepos.set(receipt.git.projectRepo.projectId, receipt.git.projectRepo);
    for (const lineage of receipt.lineages) {
      this.#cmpGitOrchestrator.registry.register(lineage);
      this.#cmpLineages.set(lineage.agentId, createAgentLineage({
        agentId: lineage.agentId,
        parentAgentId: lineage.parentAgentId,
        depth: lineage.depth,
        projectId: lineage.projectId,
        branchFamily: {
          workBranch: lineage.branchFamily.work.branchName,
          cmpBranch: lineage.branchFamily.cmp.branchName,
          mpBranch: lineage.branchFamily.mp.branchName,
          tapBranch: lineage.branchFamily.tap.branchName,
        },
        childAgentIds: lineage.childAgentIds,
        status: "active",
        metadata: lineage.metadata,
      }));
    }
    this.#cmpProjectInfraBootstrapReceipts.set(receipt.git.projectRepo.projectId, receipt);
    this.#cmpRuntimeInfraState = recordCmpProjectInfraBootstrapReceipt({
      state: this.#cmpRuntimeInfraState,
      receipt,
      updatedAt: new Date().toISOString(),
    });

    return receipt;
  }

  getCmpGitBranchHead(branchRef: string) {
    return this.#cmpGitOrchestrator.getBranchHead(branchRef);
  }

  getCmpPromotedProjection(projectionId: string): PromotedProjection | undefined {
    return this.#cmpPromotedProjections.get(projectionId);
  }

  listCmpPromotedProjections(): readonly PromotedProjection[] {
    return [...this.#cmpPromotedProjections.values()];
  }

  getCmpDbProjectionRecord(projectionId: string) {
    return this.#cmpDbRuntimeSync.projections.get(projectionId);
  }

  getCmpContextPackage(packageId: string): ContextPackage | undefined {
    return this.#cmpPackages.get(packageId);
  }

  listCmpContextPackages(): readonly ContextPackage[] {
    return [...this.#cmpPackages.values()];
  }

  getCmpDbContextPackageRecord(packageId: string): CmpDbContextPackageRecord | undefined {
    return this.#cmpDbRuntimeSync.packages.get(packageId);
  }

  getCmpDispatchReceipt(dispatchId: string): DispatchReceipt | undefined {
    return this.#cmpDispatchReceipts.get(dispatchId);
  }

  listCmpDispatchReceipts(): readonly DispatchReceipt[] {
    return [...this.#cmpDispatchReceipts.values()];
  }

  getCmpDbDeliveryRecord(deliveryId: string): CmpDbDeliveryRegistryRecord | undefined {
    return this.#cmpDbRuntimeSync.deliveries.get(deliveryId);
  }

  listCmpDbDeliveryRecords(): readonly CmpDbDeliveryRegistryRecord[] {
    return [...this.#cmpDbRuntimeSync.deliveries.values()];
  }

  getCmpRuntimeRecoverySummary(): CmpRuntimeRecoverySummary {
    const recovery = hydrateCmpRuntimeSnapshotWithReconciliation({
      snapshot: this.createCmpRuntimeSnapshot(),
      projects: this.#cmpRuntimeInfraState.projects,
    });
    return recovery.summary;
  }

  getCmpRuntimeProjectRecoverySummary(projectId: string): CmpRuntimeProjectRecoverySummary | undefined {
    const recovery = hydrateCmpRuntimeSnapshotWithReconciliation({
      snapshot: this.createCmpRuntimeSnapshot(),
      projects: this.#cmpRuntimeInfraState.projects,
    });
    const projectRecovery = getCmpRuntimeRecoveryReconciliation({
      recovery,
      projectId,
    });
    if (!projectRecovery) {
      return undefined;
    }
    return {
      projectId,
      status: projectRecovery.status,
      recommendedAction: projectRecovery.recommendedAction,
      issues: [...projectRecovery.issues],
    };
  }

  getCmpRuntimeDeliveryTruthSummary(projectId: string): CmpRuntimeDeliveryTruthSummary {
    const receipts = this.listCmpDispatchReceipts().filter((receipt) => {
      const sourceLineage = this.#cmpLineages.get(receipt.sourceAgentId);
      return sourceLineage?.projectId === projectId;
    });
    let publishedCount = 0;
    let acknowledgedCount = 0;
    let retryScheduledCount = 0;
    let expiredCount = 0;
    let driftCount = 0;
    let pendingAckCount = 0;
    const issues: string[] = [];

    for (const receipt of receipts) {
      const deliveryRecord = this.#cmpDbRuntimeSync.deliveries.get(receipt.dispatchId);
      const truthStatus: "published" | "acknowledged" | "retry_scheduled" | "expired" =
        typeof deliveryRecord?.metadata?.truthStatus === "string"
          && ["published", "acknowledged", "retry_scheduled", "expired"].includes(deliveryRecord.metadata.truthStatus)
          ? deliveryRecord.metadata.truthStatus as "published" | "acknowledged" | "retry_scheduled" | "expired"
          : mapCmpDeliveryRecordStateToTruthStatus(deliveryRecord?.state ?? "pending_delivery");

      if (truthStatus === "acknowledged") {
        acknowledgedCount += 1;
      } else if (truthStatus === "retry_scheduled") {
        retryScheduledCount += 1;
      } else if (truthStatus === "expired") {
        expiredCount += 1;
      } else {
        publishedCount += 1;
      }

      if (truthStatus === "published") {
        pendingAckCount += 1;
      }

      const expectedStatus = mapCmpMqTruthStatusToDispatchStatus(
        truthStatus === "retry_scheduled" ? "published" : truthStatus,
      );
      if (receipt.status !== expectedStatus) {
        driftCount += 1;
      }
      if (truthStatus === "retry_scheduled") {
        issues.push(`CMP delivery ${receipt.dispatchId} is waiting for retry.`);
      }
      if (truthStatus === "expired") {
        issues.push(`CMP delivery ${receipt.dispatchId} has expired.`);
      }
    }

    return {
      projectId,
      totalDispatches: receipts.length,
      publishedCount,
      acknowledgedCount,
      retryScheduledCount,
      expiredCount,
      driftCount,
      pendingAckCount,
      status: expiredCount > 0 || driftCount > 0
        ? "degraded"
        : receipts.length === 0
          ? "failed"
          : "ready",
      issues,
    };
  }

  advanceCmpMqDeliveryTimeouts(
    params: AdvanceCmpMqDeliveryTimeoutsInput = {},
  ): AdvanceCmpMqDeliveryTimeoutsResult {
    const now = params.now ?? new Date().toISOString();
    let processedCount = 0;
    let retryScheduledCount = 0;
    let expiredCount = 0;

    for (const receipt of this.listCmpDispatchReceipts()) {
      const sourceLineage = this.#cmpLineages.get(receipt.sourceAgentId);
      if (!sourceLineage) {
        continue;
      }
      if (params.projectId && sourceLineage.projectId !== params.projectId) {
        continue;
      }
      const mqReceiptId = typeof receipt.metadata?.mqReceiptId === "string"
        ? receipt.metadata.mqReceiptId
        : undefined;
      if (!mqReceiptId) {
        continue;
      }
      const deliveryRecord = this.#cmpDbRuntimeSync.deliveries.get(receipt.dispatchId);
      if (!deliveryRecord) {
        continue;
      }

      const truthState = typeof deliveryRecord.metadata?.truthStatus === "string"
        ? deliveryRecord.metadata.truthStatus
        : mapCmpDeliveryRecordStateToTruthStatus(deliveryRecord.state);
      if (truthState === "acknowledged" || truthState === "expired") {
        continue;
      }

      const deliveryState = createCmpMqDeliveryStateFromDeliveryTruth({
        truth: {
          receiptId: mqReceiptId,
          projectId: sourceLineage.projectId,
          sourceAgentId: receipt.sourceAgentId,
          channel: mapCmpDispatchKindToMqChannel(this.#mapDispatchTargetKindFromReceipt(receipt)),
          lane: (typeof receipt.metadata?.mqLane === "string" ? receipt.metadata.mqLane : "stream") as "pubsub" | "stream" | "queue",
          redisKey: typeof receipt.metadata?.mqRedisKey === "string" ? receipt.metadata.mqRedisKey : `cmp:${sourceLineage.projectId}:unknown`,
          targetCount: typeof receipt.metadata?.mqTargetCount === "number" ? receipt.metadata.mqTargetCount : 1,
          state: (truthState === "retry_scheduled" ? "published" : truthState) as "published" | "acknowledged" | "expired",
          publishedAt: receipt.deliveredAt ?? now,
          acknowledgedAt: receipt.acknowledgedAt,
          metadata: deliveryRecord.metadata,
        },
        dispatchId: receipt.dispatchId,
        packageId: receipt.packageId,
        targetAgentId: receipt.targetAgentId,
      });
      const evaluated = evaluateCmpMqDeliveryTimeout({
        state: deliveryState,
        now,
      });
      processedCount += 1;
      if (evaluated.outcome === "retry_scheduled") {
        retryScheduledCount += 1;
      } else if (evaluated.outcome === "expired") {
        expiredCount += 1;
      }

      this.#cmpDbRuntimeSync.deliveries.set(
        deliveryRecord.deliveryId,
        applyCmpMqDeliveryProjectionPatchToRecord({
          record: deliveryRecord,
          patch: evaluated.projectionPatch,
          metadata: {
            source: "cmp-runtime-delivery-timeout-sweep",
          },
        }),
      );
      const nextReceipt = createDispatchReceipt({
        ...receipt,
        status: evaluated.outcome === "expired" ? "expired" : receipt.status,
        metadata: {
          ...(receipt.metadata ?? {}),
          mqTruthState: evaluated.state.status,
          cmpMqProjectionPatch: evaluated.projectionPatch,
        },
      });
      this.#cmpDispatchReceipts.set(nextReceipt.dispatchId, nextReceipt);
      this.#recordCmpSyncEvent(createSyncEvent({
        syncEventId: randomUUID(),
        agentId: receipt.sourceAgentId,
        channel: "mq",
        direction: this.#mapDispatchTargetKindToDirection(this.#mapDispatchTargetKindFromReceipt(receipt)),
        objectRef: receipt.dispatchId,
        createdAt: now,
        metadata: {
          source: "cmp-runtime-delivery-timeout-sweep",
          outcome: evaluated.outcome,
          nextRetryAt: evaluated.state.nextRetryAt,
          acknowledgedAt: evaluated.state.acknowledgedAt,
        },
      }));
    }

    return {
      projectId: params.projectId,
      processedCount,
      retryScheduledCount,
      expiredCount,
    };
  }

  acknowledgeCmpDispatch(params: {
    dispatchId: string;
    acknowledgedAt?: string;
    metadata?: Record<string, unknown>;
  }): DispatchReceipt {
    const receipt = this.#cmpDispatchReceipts.get(params.dispatchId);
    if (!receipt) {
      throw new Error(`CMP dispatch receipt ${params.dispatchId} was not found.`);
    }

    const acknowledgedAt = params.acknowledgedAt ?? new Date().toISOString();
    const targetKind = this.#mapDispatchTargetKindFromReceipt(receipt);
    const nextReceipt = targetKind === "core_agent"
      ? createDispatchReceipt({
        ...acknowledgeCmpCoreAgentReturn({
          receipt: createCmpCoreAgentReturnReceipt({
            dispatchId: receipt.dispatchId,
            packageId: receipt.packageId,
            sourceAgentId: receipt.sourceAgentId,
            coreAgentHandle: receipt.targetAgentId,
            createdAt: receipt.deliveredAt ?? receipt.acknowledgedAt ?? acknowledgedAt,
            metadata: receipt.metadata,
          }),
          acknowledgedAt,
          metadata: params.metadata,
        }),
        status: "acknowledged",
        acknowledgedAt,
      })
      : createDispatchReceipt({
        ...acknowledgeCmpDispatchReceipt({
          receipt: createCmpDispatchReceipt({
            dispatchId: receipt.dispatchId,
            packageId: receipt.packageId,
            sourceAgentId: receipt.sourceAgentId,
            targetAgentId: receipt.targetAgentId,
            direction: targetKind,
            status: receipt.acknowledgedAt ? "acknowledged" : "delivered",
            createdAt: receipt.deliveredAt ?? acknowledgedAt,
            deliveredAt: receipt.deliveredAt,
            acknowledgedAt: receipt.acknowledgedAt,
            metadata: receipt.metadata,
          }),
          acknowledgedAt,
          metadata: params.metadata,
        }),
        status: "acknowledged",
        acknowledgedAt,
      });

    let runtimeReceipt = nextReceipt;
    const mqReceiptId = typeof receipt.metadata?.mqReceiptId === "string"
      ? receipt.metadata.mqReceiptId
      : undefined;
    const sourceLineage = this.#cmpLineages.get(nextReceipt.sourceAgentId);
    const deliveryRecord = this.#cmpDbRuntimeSync.deliveries.get(nextReceipt.dispatchId);
    if (
      mqReceiptId
      && sourceLineage
      && deliveryRecord
      && this.cmpInfraBackends.mq?.acknowledgeDelivery
      && targetKind !== "core_agent"
    ) {
      const applyAckTruth = (deliveryTruth: {
        state: string;
        acknowledgedAt?: string;
        publishedAt: string;
        lane: string;
        redisKey: string;
      }) => {
        const deliveryState = createCmpMqDeliveryStateFromDeliveryTruth({
          truth: deliveryTruth as Parameters<typeof createCmpMqDeliveryStateFromDeliveryTruth>[0]["truth"],
          dispatchId: nextReceipt.dispatchId,
          packageId: nextReceipt.packageId,
          targetAgentId: nextReceipt.targetAgentId,
          metadata: params.metadata,
        });
        const projectionPatch = createCmpMqDeliveryProjectionPatch(deliveryState);
        this.#cmpDbRuntimeSync.deliveries.set(
          deliveryRecord.deliveryId,
          applyCmpMqDeliveryProjectionPatchToRecord({
            record: deliveryRecord,
            patch: projectionPatch,
            metadata: {
              source: "cmp-runtime-mq-ack-state",
            },
          }),
        );
        runtimeReceipt = createDispatchReceipt({
          ...nextReceipt,
          metadata: {
            ...(nextReceipt.metadata ?? {}),
            mqTruthState: deliveryTruth.state,
            mqAcknowledgedAt: deliveryTruth.acknowledgedAt,
            cmpMqProjectionPatch: projectionPatch,
          },
        });
        this.#cmpDispatchReceipts.set(runtimeReceipt.dispatchId, runtimeReceipt);
      };

      const ackTruth = this.cmpInfraBackends.mq.acknowledgeDelivery({
        projectId: sourceLineage.projectId,
        sourceAgentId: nextReceipt.sourceAgentId,
        receiptId: mqReceiptId,
        acknowledgedAt,
        metadata: params.metadata,
      });
      if (isPromiseLike(ackTruth)) {
        void ackTruth.then(applyAckTruth).catch(() => undefined);
      } else {
        applyAckTruth(ackTruth);
      }
    }
    this.#cmpDispatchReceipts.set(runtimeReceipt.dispatchId, runtimeReceipt);
    syncCmpDbDeliveryFromDispatchReceipt({
      state: this.#cmpDbRuntimeSync,
      receipt: runtimeReceipt,
      metadata: {
        source: "cmp-runtime-ack",
      },
    });
    return runtimeReceipt;
  }

  createCmpRuntimeSnapshot(): CmpRuntimeSnapshot {
    return {
      projectRepos: [...this.#cmpProjectRepos.values()],
      lineages: [...this.#cmpLineages.values()],
      events: [...this.#cmpEvents.values()],
      deltas: [...this.#cmpDeltas.values()],
      activeLines: [...this.#cmpActiveLines.values()],
      snapshotCandidates: [...this.#cmpSnapshotCandidates.values()],
      checkedSnapshots: [...this.#cmpCheckedSnapshots.values()],
      promotedProjections: [...this.#cmpPromotedProjections.values()],
      contextPackages: [...this.#cmpPackages.values()],
      dispatchReceipts: [...this.#cmpDispatchReceipts.values()],
      syncEvents: [...this.#cmpSyncEvents.values()],
      infraState: this.#cmpRuntimeInfraState,
    };
  }

  recoverCmpRuntimeSnapshot(snapshot: CmpRuntimeSnapshot): void {
    this.#cmpProjectRepos.clear();
    this.#cmpLineages.clear();
    this.#cmpEvents.clear();
    this.#cmpEventsByAgent.clear();
    this.#cmpDeltas.clear();
    this.#cmpActiveLines.clear();
    this.#cmpSnapshotCandidates.clear();
    this.#cmpCheckedSnapshots.clear();
    this.#cmpPromotedProjections.clear();
    this.#cmpRuntimeProjections.clear();
    this.#cmpPackages.clear();
    this.#cmpDispatchReceipts.clear();
    this.#cmpSyncEvents.clear();
    this.#cmpProjectInfraBootstrapReceipts.clear();
    this.#cmpRuntimeInfraState = createCmpRuntimeInfraState();
    this.#cmpDbRuntimeSync.projections.clear();
    this.#cmpDbRuntimeSync.packages.clear();
    this.#cmpDbRuntimeSync.deliveries.clear();

    const recovery = hydrateCmpRuntimeSnapshotWithReconciliation({
      snapshot,
      projects: snapshot.infraState?.projects,
    });
    const hydrated = recovery.hydrated;

    for (const [projectId, repo] of hydrated.projectRepos) {
      this.#cmpProjectRepos.set(projectId, repo);
    }
    for (const lineage of hydrated.lineages.values()) {
      this.#cmpLineages.set(lineage.agentId, lineage);
      this.#ensureCmpProjectRepo(lineage);
    }
    for (const event of hydrated.events.values()) {
      this.#storeCmpEvent(event);
    }
    for (const delta of hydrated.deltas.values()) {
      this.#cmpDeltas.set(delta.deltaId, delta);
    }
    for (const line of hydrated.activeLines.values()) {
      this.#cmpActiveLines.set(line.lineId, line);
    }
    for (const candidate of hydrated.snapshotCandidates.values()) {
      this.#cmpSnapshotCandidates.set(candidate.candidateId, candidate);
    }
    for (const checked of hydrated.checkedSnapshots.values()) {
      this.#cmpCheckedSnapshots.set(checked.snapshotId, checked);
      syncCmpDbProjectionFromCheckedSnapshot({
        state: this.#cmpDbRuntimeSync,
        snapshot: checked,
        projectionId: `projection:${checked.snapshotId}`,
        metadata: checked.metadata,
      });
    }
    for (const projection of hydrated.promotedProjections.values()) {
      this.#cmpPromotedProjections.set(projection.projectionId, projection);
      const checked = this.#cmpCheckedSnapshots.get(projection.snapshotId);
      if (checked) {
        this.#cmpRuntimeProjections.set(projection.projectionId, createCmpProjectionRecord({
          projectionId: projection.projectionId,
          checkedSnapshotRef: checked.snapshotId,
          agentId: checked.agentId,
          visibility: this.#mapProjectionStatusToRuntimeVisibility(projection.promotionStatus),
          updatedAt: projection.updatedAt,
          metadata: projection.metadata,
        }));
      }
    }
    for (const pkg of hydrated.contextPackages.values()) {
      this.#cmpPackages.set(pkg.packageId, pkg);
      const projection = this.#cmpPromotedProjections.get(pkg.sourceProjectionId);
      if (projection) {
        syncCmpDbPackageFromContextPackage({
          state: this.#cmpDbRuntimeSync,
          contextPackage: pkg,
          projection: {
            projectionId: projection.projectionId,
            snapshotId: projection.snapshotId,
            agentId: projection.agentId,
          },
        });
      }
    }
    for (const receipt of hydrated.dispatchReceipts.values()) {
      this.#cmpDispatchReceipts.set(receipt.dispatchId, receipt);
      syncCmpDbDeliveryFromDispatchReceipt({
        state: this.#cmpDbRuntimeSync,
        receipt,
      });
    }
    for (const syncEvent of hydrated.syncEvents.values()) {
      this.#cmpSyncEvents.set(syncEvent.syncEventId, syncEvent);
    }
    this.#cmpRuntimeInfraState = {
      projects: [...hydrated.infraState.projects.values()],
    };
    for (const project of hydrated.infraState.projects.values()) {
      if (project.git && project.db && project.dbReceipt) {
        this.#cmpProjectInfraBootstrapReceipts.set(project.projectId, {
          git: project.git,
          gitBranchBootstraps: project.gitBranchBootstraps.map((record) => ({
            agentId: record.agentId,
            createdBranchNames: [...record.createdBranchNames],
          })),
          db: project.db,
          dbReceipt: project.dbReceipt,
          mqBootstraps: [...project.mqBootstraps],
          lineages: [...project.lineages],
          branchRuntimes: [],
          metadata: project.metadata,
        });
      }
      const reconciliation = getCmpRuntimeRecoveryReconciliation({
        recovery,
        projectId: project.projectId,
      });
      if (reconciliation && reconciliation.status !== "aligned") {
        this.#recordCmpSyncEvent(createSyncEvent({
          syncEventId: randomUUID(),
          agentId: project.lineages[0]?.agentId ?? project.projectId,
          channel: "db",
          direction: "local",
          objectRef: `cmp-recovery:${project.projectId}`,
          createdAt: new Date().toISOString(),
          metadata: {
            source: "cmp-runtime-recovery-reconciliation",
            status: reconciliation.status,
            recommendedAction: reconciliation.recommendedAction,
            issues: reconciliation.issues,
          },
        }));
      }
    }
  }

  listCmpSyncEvents(agentId?: string): readonly SyncEvent[] {
    const events = [...this.#cmpSyncEvents.values()];
    return agentId ? events.filter((event) => event.agentId === agentId) : events;
  }

  ingestRuntimeContext(input: IngestRuntimeContextInput): IngestRuntimeContextResult {
    const normalized = createIngestRuntimeContextInput(input);
    const lineage = createAgentLineage(normalized.lineage);
    this.#cmpLineages.set(lineage.agentId, lineage);
    this.#ensureCmpProjectRepo(lineage);

    const createdAt = new Date().toISOString();
    const sectionIngress = createCmpSectionIngressRecordFromIngress({
      ingest: normalized,
      ingressId: randomUUID(),
      createdAt,
      metadata: {
        source: "cmp-runtime-section-first-ingress",
      },
    });
    const sectionLowering = lowerCmpSectionIngressRecordWithRulePack({
      record: sectionIngress,
      pack: createCmpRuntimeDefaultSectionRulePack(),
      plane: "git",
      persistedAt: createdAt,
      metadata: {
        source: "cmp-runtime-section-first-lowering",
      },
    });
    const ingress = createCmpIngressRecord(sectionIngress.ingress);
    this.#cmpIngressRecords.set(ingress.ingressId, ingress);

    const acceptedEvents: ContextEvent[] = normalized.materials.map((material) => {
      const loweredSection = sectionLowering.lowered.find((record) => record.section.payloadRefs.includes(material.ref));
      const event = createContextEvent({
        eventId: randomUUID(),
        agentId: lineage.agentId,
        sessionId: normalized.sessionId,
        runId: normalized.runId,
        kind: this.#toCmpEventKind(material.kind),
        payloadRef: material.ref,
        createdAt,
        source: "core_agent",
        metadata: {
          ingressId: ingress.ingressId,
          materialKind: material.kind,
          cmpSectionId: loweredSection?.section.id,
          cmpStoredSectionId: loweredSection?.storedSection?.id,
          cmpStoredSections: loweredSection?.storedSection ? [loweredSection.storedSection] : [],
          cmpSectionRuleEvaluation: loweredSection?.evaluation,
          ...(material.metadata ?? {}),
        },
      });
      this.#storeCmpEvent(event);
      return event;
    });

    this.#recordCmpNeighborhoodSyncs({
      ingress,
      lineage,
      payloadRef: normalized.materials[0]?.ref ?? `cmp-ingress:${ingress.ingressId}`,
      granularityLabel: normalized.taskSummary,
    });

    return createIngestRuntimeContextResult({
      status: "accepted",
      acceptedEventIds: acceptedEvents.map((event) => event.eventId),
      nextAction: normalized.requiresActiveSync === false ? "noop" : "commit_context_delta",
      metadata: {
        ingressId: ingress.ingressId,
        sectionIds: sectionIngress.sections.map((section) => section.id),
        storedSectionIds: sectionLowering.storedSections.map((section) => section.id),
        droppedSectionIds: sectionLowering.droppedSectionIds,
      },
    });
  }

  commitContextDelta(input: CommitContextDeltaInput): CommitContextDeltaResult {
    const normalized = createCommitContextDeltaInput(input);
    const lineage = this.#requireCmpLineage(normalized.agentId);
    const createdAt = new Date().toISOString();
    const storedSections = this.#collectCmpStoredSectionsFromEventIds(normalized.eventIds);
    const delta = createContextDelta({
      deltaId: randomUUID(),
      agentId: normalized.agentId,
      baseRef: normalized.baseRef,
      eventRefs: normalized.eventIds,
      changeSummary: normalized.changeSummary,
      createdAt,
      syncIntent: normalized.syncIntent,
      metadata: {
        ...(normalized.metadata ?? {}),
        ...(storedSections.length > 0 ? { cmpStoredSections: storedSections } : {}),
      },
    });
    this.#cmpDeltas.set(delta.deltaId, delta);

    const gitSync = this.#cmpGitOrchestrator.syncCommitDelta({
      projectId: lineage.projectId,
      commitSha: this.#createCmpPseudoCommitRef(delta.deltaId),
      branchRef: createCmpGitBranchFamily(lineage.agentId).cmp,
      delta: {
        deltaId: delta.deltaId,
        agentId: delta.agentId,
        sessionId: normalized.sessionId,
        runId: normalized.runId,
        createdAt: delta.createdAt,
        metadata: delta.metadata,
      },
      syncIntent: this.#mapCmpDeltaSyncIntentToGit(delta.syncIntent),
    });

    const candidate = createSnapshotCandidate({
      candidateId: gitSync.candidate.candidateId,
      agentId: delta.agentId,
      branchRef: gitSync.candidate.branchRef.fullRef,
      commitRef: gitSync.candidate.commitSha,
      deltaRefs: [delta.deltaId],
      createdAt: gitSync.candidate.createdAt,
      status: "pending_check",
      metadata: {
        ...(delta.metadata ?? {}),
        projectId: lineage.projectId,
        bindingId: gitSync.binding.bindingId,
        source: "cmp-runtime-default-checker",
      },
    });
    this.#cmpSnapshotCandidates.set(candidate.candidateId, candidate);

    const checkedRef = this.#cmpGitOrchestrator.markCandidateChecked({
      candidateId: candidate.candidateId,
      snapshotId: `${candidate.candidateId}:checked`,
      checkedAt: candidate.createdAt,
    });
    this.#cmpGitCheckedRefs.set(checkedRef.refId, checkedRef);

    let promotionRecord: CmpGitPromotionRecord | undefined;
    if (delta.syncIntent === "submit_to_parent" && lineage.parentAgentId) {
      const pullRequest = this.#cmpGitOrchestrator.openPullRequest({
        candidateId: candidate.candidateId,
        targetAgentId: lineage.parentAgentId,
        createdAt: candidate.createdAt,
      });
      this.#cmpGitPullRequests.set(pullRequest.pullRequestId, pullRequest);
      const merge = this.#cmpGitOrchestrator.mergePullRequest({
        pullRequestId: pullRequest.pullRequestId,
        actorAgentId: lineage.parentAgentId,
        mergedAt: candidate.createdAt,
      });
      const promoted = this.#cmpGitOrchestrator.promoteMerge({
        mergeId: merge.mergeId,
        promoterAgentId: lineage.parentAgentId,
        promotedAt: candidate.createdAt,
      });
      promotionRecord = promoted.promotion;
      this.#cmpGitPromotions.set(promoted.promotion.promotionId, promoted.promotion);
    }

    const activeLine = createCmpActiveLineRecord({
      lineId: randomUUID(),
      agentId: delta.agentId,
      deltaRef: delta.deltaId,
      stage: "captured",
      updatedAt: delta.createdAt,
    });
    const written = advanceCmpActiveLineRecord({
      record: activeLine,
      nextStage: "written_to_git",
      updatedAt: candidate.createdAt,
      gitUpdateRef: {
        branchRef: candidate.branchRef,
        commitRef: candidate.commitRef,
      },
    });
    const candidateReady = advanceCmpActiveLineRecord({
      record: written,
      nextStage: "candidate_ready",
      updatedAt: candidate.createdAt,
      gitUpdateRef: written.gitUpdateRef,
      snapshotCandidateRef: candidate.candidateId,
    });

    const checked = createCheckedSnapshot({
      snapshotId: `${candidate.candidateId}:checked`,
      agentId: delta.agentId,
      lineageRef: this.#createCmpLineageRef(lineage),
      branchRef: candidate.branchRef,
      commitRef: candidate.commitRef,
      checkedAt: candidate.createdAt,
      qualityLabel: "usable",
      promotable: delta.syncIntent !== "local_record",
      metadata: {
        ...(candidate.metadata ?? {}),
        projectId: lineage.projectId,
        candidateId: candidate.candidateId,
        checkedRefId: checkedRef.refId,
        promotionId: promotionRecord?.promotionId,
        source: "cmp-runtime-default-checker",
      },
    });
    this.#cmpCheckedSnapshots.set(checked.snapshotId, checked);
    const dbProjection = syncCmpDbProjectionFromCheckedSnapshot({
      state: this.#cmpDbRuntimeSync,
      snapshot: checked,
      projectionId: `projection:${checked.snapshotId}`,
      metadata: {
        source: "cmp-runtime-default-checker",
      },
    });
    if (promotionRecord) {
      promoteCmpDbProjectionForParent({
        state: this.#cmpDbRuntimeSync,
        projectionId: dbProjection.projectionId,
        acceptedAt: promotionRecord.promotedAt ?? candidate.createdAt,
      });
    }

    const checkedReady = advanceCmpActiveLineRecord({
      record: candidateReady,
      nextStage: "checked_ready",
      updatedAt: checked.checkedAt,
      gitUpdateRef: candidateReady.gitUpdateRef,
      snapshotCandidateRef: candidate.candidateId,
      checkedSnapshotRef: checked.snapshotId,
    });
    const finalActiveLine = promotionRecord
      ? advanceCmpActiveLineRecord({
        record: checkedReady,
        nextStage: "promoted_pending",
        updatedAt: promotionRecord.promotedAt ?? checked.checkedAt,
        gitUpdateRef: checkedReady.gitUpdateRef,
        snapshotCandidateRef: candidate.candidateId,
        checkedSnapshotRef: checked.snapshotId,
        metadata: {
          promotionId: promotionRecord.promotionId,
        },
      })
      : checkedReady;
    this.#cmpActiveLines.set(finalActiveLine.lineId, finalActiveLine);

    this.#recordCmpSyncEvent(createSyncEvent({
      syncEventId: randomUUID(),
      agentId: delta.agentId,
      channel: "git",
      direction: this.#mapCmpSyncIntentToDirection(gitSync.binding.syncIntent),
      objectRef: candidate.candidateId,
      createdAt: candidate.createdAt,
      metadata: {
        branchRef: candidate.branchRef,
        commitRef: candidate.commitRef,
      },
    }));

    const projectInfraState = getCmpRuntimeInfraProjectState(
      this.#cmpRuntimeInfraState,
      lineage.projectId,
    );
    if (projectInfraState && this.cmpInfraBackends.git) {
      const agentInfra = resolveCmpAgentInfraAccess({
        project: projectInfraState,
        agentId: delta.agentId,
      });
      void executeCmpGitSnapshotLowering({
        backend: this.cmpInfraBackends.git,
        runtime: agentInfra.branchRuntime,
        commitSha: candidate.commitRef,
        promotedCommitSha: promotionRecord ? candidate.commitRef : undefined,
      }).then((lowering) => {
        this.#recordCmpSyncEvent(createSyncEvent({
          syncEventId: randomUUID(),
          agentId: delta.agentId,
          channel: "git",
          direction: this.#mapCmpSyncIntentToDirection(gitSync.binding.syncIntent),
          objectRef: checked.snapshotId,
          createdAt: checked.checkedAt,
          metadata: {
            source: "cmp-runtime-git-lowering",
            initialHead: lowering.initialReadback.headCommitSha,
            checkedCommitSha: lowering.checkedReadback.checkedCommitSha,
            promotedCommitSha: lowering.promotedReadback?.promotedCommitSha,
          },
        }));
      }).catch((error: unknown) => {
        this.#recordCmpSyncEvent(createSyncEvent({
          syncEventId: randomUUID(),
          agentId: delta.agentId,
          channel: "git",
          direction: "local",
          objectRef: checked.snapshotId,
          createdAt: new Date().toISOString(),
          metadata: {
            source: "cmp-runtime-git-lowering",
            error: error instanceof Error ? error.message : String(error),
          },
        }));
      });
    }

    return {
      status: "accepted",
      delta,
      snapshotCandidateId: candidate.candidateId,
      metadata: {
        checkedSnapshotId: checked.snapshotId,
      },
    };
  }

  resolveCheckedSnapshot(input: ResolveCheckedSnapshotInput): ResolveCheckedSnapshotResult {
    const normalized = createResolveCheckedSnapshotInput(input);
    const snapshot = [...this.#cmpCheckedSnapshots.values()]
      .filter((candidate) => {
        const projectId = candidate.metadata?.projectId;
        if (projectId !== normalized.projectId) {
          return false;
        }
        if (candidate.agentId !== normalized.agentId) {
          return false;
        }
        if (normalized.lineageRef && candidate.lineageRef !== normalized.lineageRef) {
          return false;
        }
        if (normalized.branchRef && candidate.branchRef !== normalized.branchRef) {
          return false;
        }
        return true;
      })
      .sort((left, right) => right.checkedAt.localeCompare(left.checkedAt))[0];

    if (!snapshot) {
      return {
        status: "not_found",
        found: false,
      };
    }

    return {
      status: "resolved",
      found: true,
      snapshot,
    };
  }

  materializeContextPackage(input: MaterializeContextPackageInput): MaterializeContextPackageResult {
    const normalized = createMaterializeContextPackageInput(input);
    const snapshot = this.#cmpCheckedSnapshots.get(normalized.snapshotId);
    if (!snapshot) {
      throw new Error(`CMP checked snapshot ${normalized.snapshotId} was not found.`);
    }

    const projection = normalized.projectionId
      ? this.#requireCmpProjection(normalized.projectionId)
      : this.#findOrCreateCmpProjection({
        snapshot,
        targetAgentId: normalized.targetAgentId,
      });
    const storedSection = this.#selectCmpStoredSectionForSnapshot(snapshot);

    const runtimeProjection = storedSection
      ? createCmpProjectionRecordFromStoredSection({
        projectionId: projection.projectionId,
        checkedSnapshotRef: snapshot.snapshotId,
        storedSection,
        visibility: this.#mapProjectionStatusToRuntimeVisibility(projection.promotionStatus),
        updatedAt: projection.updatedAt,
        metadata: projection.metadata,
      })
      : createCmpProjectionRecord({
        projectionId: projection.projectionId,
        checkedSnapshotRef: snapshot.snapshotId,
        agentId: snapshot.agentId,
        visibility: this.#mapProjectionStatusToRuntimeVisibility(projection.promotionStatus),
        updatedAt: projection.updatedAt,
        metadata: projection.metadata,
      });
    this.#cmpRuntimeProjections.set(runtimeProjection.projectionId, runtimeProjection);

    const runtimePackageCreatedAt = new Date().toISOString();
    const runtimePackage = storedSection
      ? createCmpContextPackageRecordFromStoredSection({
        packageId: randomUUID(),
        projectionId: runtimeProjection.projectionId,
        storedSection,
        targetAgentId: normalized.targetAgentId,
        packageKind: normalized.packageKind,
        packageRef: `cmp-package:${snapshot.snapshotId}:${normalized.targetAgentId}:${normalized.packageKind}`,
        fidelityLabel: normalized.fidelityLabel ?? "checked_high_fidelity",
        createdAt: runtimePackageCreatedAt,
        metadata: normalized.metadata,
      })
      : createCmpContextPackageRecord({
        packageId: randomUUID(),
        projectionId: runtimeProjection.projectionId,
        sourceAgentId: snapshot.agentId,
        targetAgentId: normalized.targetAgentId,
        packageKind: normalized.packageKind,
        packageRef: `cmp-package:${snapshot.snapshotId}:${normalized.targetAgentId}:${normalized.packageKind}`,
        fidelityLabel: normalized.fidelityLabel ?? "checked_high_fidelity",
        createdAt: runtimePackageCreatedAt,
        metadata: normalized.metadata,
      });

    const contextPackage = createContextPackage({
      packageId: runtimePackage.packageId,
      sourceProjectionId: runtimePackage.projectionId,
      targetAgentId: runtimePackage.targetAgentId,
      packageKind: normalized.packageKind,
      packageRef: runtimePackage.packageRef,
      fidelityLabel: normalized.fidelityLabel ?? "checked_high_fidelity",
      createdAt: runtimePackage.createdAt,
      metadata: {
        snapshotId: snapshot.snapshotId,
        ...(runtimePackage.metadata ?? {}),
      },
    });
    this.#cmpPackages.set(contextPackage.packageId, contextPackage);
    syncCmpDbPackageFromContextPackage({
      state: this.#cmpDbRuntimeSync,
      contextPackage,
      projection: {
        projectionId: projection.projectionId,
        snapshotId: projection.snapshotId,
        agentId: projection.agentId,
      },
      metadata: {
        source: "cmp-runtime-materialize",
      },
    });

    this.#recordCmpSyncEvent(createSyncEvent({
      syncEventId: randomUUID(),
      agentId: normalized.agentId,
      channel: "db",
      direction: "local",
      objectRef: contextPackage.packageId,
      createdAt: contextPackage.createdAt,
      metadata: {
        projectionId: projection.projectionId,
      },
    }));

    const projectReceipt = this.getCmpProjectInfraBootstrapReceipt(snapshot.metadata?.projectId as string);
    if (projectReceipt?.db && this.cmpInfraBackends.dbExecutor) {
      const adapter = createCmpDbPostgresAdapter({
        topology: projectReceipt.db.topology,
        localTableSets: projectReceipt.db.localTableSets,
      });
      const projectionRecord = this.#cmpDbRuntimeSync.projections.get(projection.projectionId);
      const packageRecord = this.#cmpDbRuntimeSync.packages.get(contextPackage.packageId);
      if (projectionRecord && packageRecord) {
        void Promise.all([
          executeCmpProjectionLowering({
            adapter,
            executor: this.cmpInfraBackends.dbExecutor,
            record: projectionRecord,
          }),
          executeCmpContextPackageLowering({
            adapter,
            executor: this.cmpInfraBackends.dbExecutor,
            record: packageRecord,
          }),
        ]).then(([projectionLowering, packageLowering]) => {
          this.#recordCmpSyncEvent(createSyncEvent({
            syncEventId: randomUUID(),
            agentId: normalized.agentId,
            channel: "db",
            direction: "local",
            objectRef: contextPackage.packageId,
            createdAt: contextPackage.createdAt,
            metadata: {
              source: "cmp-runtime-db-lowering",
              projectionWriteTarget: projectionLowering.writeStatement.target,
              projectionReadTarget: projectionLowering.readStatement.target,
              packageWriteTarget: packageLowering.writeStatement.target,
              packageReadTarget: packageLowering.readStatement.target,
            },
          }));
        }).catch((error: unknown) => {
          this.#recordCmpSyncEvent(createSyncEvent({
            syncEventId: randomUUID(),
            agentId: normalized.agentId,
            channel: "db",
            direction: "local",
            objectRef: contextPackage.packageId,
            createdAt: new Date().toISOString(),
            metadata: {
              source: "cmp-runtime-db-lowering",
              error: error instanceof Error ? error.message : String(error),
            },
          }));
        });
      }
    }

    return {
      status: "materialized",
      contextPackage,
    };
  }

  dispatchContextPackage(input: DispatchContextPackageInput): DispatchContextPackageResult {
    const normalized = createDispatchContextPackageInput(input);
    const contextPackage = this.#cmpPackages.get(normalized.packageId);
    if (!contextPackage) {
      throw new Error(`CMP context package ${normalized.packageId} was not found.`);
    }

    const createdAt = new Date().toISOString();
    const coreReceipt = normalized.targetKind === "core_agent"
      ? createCmpCoreAgentReturnReceipt({
        dispatchId: randomUUID(),
        packageId: contextPackage.packageId,
        sourceAgentId: normalized.sourceAgentId,
        coreAgentHandle: normalized.targetAgentId,
        createdAt,
        metadata: normalized.metadata,
      })
      : undefined;
    const receipt = coreReceipt
      ? createDispatchReceipt({
        dispatchId: coreReceipt.dispatchId,
        packageId: coreReceipt.packageId,
        sourceAgentId: coreReceipt.sourceAgentId,
        targetAgentId: coreReceipt.targetAgentId,
        status: "delivered",
        deliveredAt: coreReceipt.deliveredAt,
        metadata: coreReceipt.metadata,
      })
      : this.#createNeighborDispatchReceipt({
        contextPackage,
        input: normalized,
        createdAt,
      });
    this.#cmpDispatchReceipts.set(receipt.dispatchId, receipt);
    syncCmpDbDeliveryFromDispatchReceipt({
      state: this.#cmpDbRuntimeSync,
      receipt,
      metadata: {
        source: "cmp-runtime-dispatch",
      },
    });

    this.#recordCmpSyncEvent(createSyncEvent({
      syncEventId: randomUUID(),
      agentId: normalized.sourceAgentId,
      channel: normalized.targetKind === "core_agent" ? "db" : "mq",
      direction: this.#mapDispatchTargetKindToDirection(normalized.targetKind),
      objectRef: receipt.dispatchId,
      createdAt,
      metadata: {
        packageId: contextPackage.packageId,
        targetAgentId: normalized.targetAgentId,
      },
    }));

    const sourceLineage = this.#requireCmpLineage(normalized.sourceAgentId);
    const projectReceipt = this.getCmpProjectInfraBootstrapReceipt(sourceLineage.projectId);
    if (projectReceipt?.db && this.cmpInfraBackends.dbExecutor) {
      const adapter = createCmpDbPostgresAdapter({
        topology: projectReceipt.db.topology,
        localTableSets: projectReceipt.db.localTableSets,
      });
      const deliveryRecord = this.#cmpDbRuntimeSync.deliveries.get(receipt.dispatchId);
      if (deliveryRecord) {
        void executeCmpDeliveryLowering({
          adapter,
          executor: this.cmpInfraBackends.dbExecutor,
          record: deliveryRecord,
        }).then((deliveryLowering) => {
          this.#recordCmpSyncEvent(createSyncEvent({
            syncEventId: randomUUID(),
            agentId: normalized.sourceAgentId,
            channel: "db",
            direction: "local",
            objectRef: receipt.dispatchId,
            createdAt,
            metadata: {
              source: "cmp-runtime-delivery-lowering",
              writeTarget: deliveryLowering.writeStatement.target,
              readTarget: deliveryLowering.readStatement.target,
            },
          }));
        }).catch((error: unknown) => {
          this.#recordCmpSyncEvent(createSyncEvent({
            syncEventId: randomUUID(),
            agentId: normalized.sourceAgentId,
            channel: "db",
            direction: "local",
            objectRef: receipt.dispatchId,
            createdAt: new Date().toISOString(),
            metadata: {
              source: "cmp-runtime-delivery-lowering",
              error: error instanceof Error ? error.message : String(error),
            },
          }));
        });
      }
    }

    const projectInfraState = getCmpRuntimeInfraProjectState(
      this.#cmpRuntimeInfraState,
      sourceLineage.projectId,
    );
    if (
      normalized.targetKind !== "core_agent" &&
      projectInfraState &&
      this.cmpInfraBackends.mq
    ) {
      const agentInfra = resolveCmpAgentInfraAccess({
        project: projectInfraState,
        agentId: normalized.sourceAgentId,
      });
      const direction = normalized.targetKind === "parent"
        ? "parent"
        : normalized.targetKind === "peer"
          ? "peer"
          : "child";
      const envelope = createCmpMqDispatchEnvelope({
        projectId: sourceLineage.projectId,
        sourceAgentId: normalized.sourceAgentId,
        targetAgentId: normalized.targetAgentId,
        direction,
        contextPackage: {
          packageId: contextPackage.packageId,
          packageRef: contextPackage.packageRef,
          packageKind: contextPackage.packageKind,
        },
        createdAt,
      });
      void executeCmpMqDispatchStateLowering({
        adapter: this.cmpInfraBackends.mq,
        neighborhood: this.#createCmpNeighborhood(sourceLineage),
        envelope,
        dispatchId: receipt.dispatchId,
        packageId: contextPackage.packageId,
        targetAgentId: normalized.targetAgentId,
        metadata: {
          targetKind: normalized.targetKind,
        },
        knownAncestorIds: this.#collectCmpAncestorIds(sourceLineage.agentId)
          .filter((ancestorId) => ancestorId !== sourceLineage.parentAgentId),
        parentPeerIds: this.#findCmpParentPeerIds(sourceLineage),
      }).then((mqLowering) => {
        const nextReceipt = createDispatchReceipt({
          ...receipt,
          metadata: {
            ...(receipt.metadata ?? {}),
            mqReceiptId: mqLowering.publishReceipt.receiptId,
            mqRedisKey: mqLowering.publishReceipt.redisKey,
            mqLane: mqLowering.publishReceipt.lane,
            mqTruthState: mqLowering.deliveryTruth?.state ?? mqLowering.deliveryState.status,
            mqTargetCount: mqLowering.publishReceipt.targetCount,
            cmpMqProjectionPatch: mqLowering.projectionPatch,
          },
        });
        this.#cmpDispatchReceipts.set(nextReceipt.dispatchId, nextReceipt);
        const currentDeliveryRecord = this.#cmpDbRuntimeSync.deliveries.get(nextReceipt.dispatchId);
        this.#cmpDbRuntimeSync.deliveries.set(
          nextReceipt.dispatchId,
          currentDeliveryRecord
            ? applyCmpMqDeliveryProjectionPatchToRecord({
              record: currentDeliveryRecord,
              patch: mqLowering.projectionPatch,
              metadata: {
                source: "cmp-runtime-mq-dispatch-state",
              },
            })
            : createCmpDeliveryRecordFromMqProjectionPatch({
              patch: mqLowering.projectionPatch,
              metadata: {
                source: "cmp-runtime-mq-dispatch-state",
              },
            }),
        );
        this.#recordCmpSyncEvent(createSyncEvent({
          syncEventId: randomUUID(),
          agentId: normalized.sourceAgentId,
          channel: "mq",
          direction: this.#mapDispatchTargetKindToDirection(normalized.targetKind),
          objectRef: receipt.dispatchId,
          createdAt,
          metadata: {
            source: "cmp-runtime-mq-lowering",
            redisKey: mqLowering.publishReceipt.redisKey,
            mqBootstrapAgentId: agentInfra.mqBootstrap?.agentId,
            validatedTargets: mqLowering.validatedSubscriptions.length,
            truthState: mqLowering.deliveryTruth?.state ?? mqLowering.deliveryState.status,
          },
        }));
      }).catch((error: unknown) => {
        this.#recordCmpSyncEvent(createSyncEvent({
          syncEventId: randomUUID(),
          agentId: normalized.sourceAgentId,
          channel: "mq",
          direction: this.#mapDispatchTargetKindToDirection(normalized.targetKind),
          objectRef: receipt.dispatchId,
          createdAt: new Date().toISOString(),
          metadata: {
            source: "cmp-runtime-mq-lowering",
            error: error instanceof Error ? error.message : String(error),
          },
        }));
      });
    }

    return {
      status: "dispatched",
      receipt,
    };
  }

  requestHistoricalContext(input: RequestHistoricalContextInput): RequestHistoricalContextResult {
    const normalized = createRequestHistoricalContextInput(input);
    const snapshot = this.#selectCmpHistoricalSnapshot(normalized);
    if (!snapshot) {
      return {
        status: "not_found",
        found: false,
      };
    }

    const projectReceipt = this.getCmpProjectInfraBootstrapReceipt(normalized.projectId);
    const projection = this.#findOrCreateCmpProjection({
      snapshot,
      targetAgentId: normalized.requesterAgentId,
    });
    const dbProjection = this.#cmpDbRuntimeSync.projections.get(projection.projectionId);
    const fallbackDecision = planCmpHistoricalFallback({
      projectId: normalized.projectId,
      requesterAgentId: normalized.requesterAgentId,
      snapshotId: snapshot.snapshotId,
      hasDbProjection: Boolean(dbProjection),
      dbReadbackComplete: projectReceipt?.dbReceipt?.status === "bootstrapped",
      dbAvailable: Boolean(projectReceipt?.db && this.cmpInfraBackends.dbExecutor),
      hasGitCheckedSnapshot: true,
    });
    const requesterLineage = this.#requireCmpLineage(normalized.requesterAgentId);
    const runtimeProjection = this.#requireCmpRuntimeProjectionForSnapshot({
      projection,
      snapshot,
    });
    const createdAt = new Date().toISOString();
    let contextPackage: ContextPackage;

    if (fallbackDecision.resolvedSource === "git_checked") {
      const anchor = this.#createCmpGitProjectionSourceAnchor(snapshot);
      if (!anchor) {
        throw new Error(
          `CMP historical fallback could not derive git source anchor for snapshot ${snapshot.snapshotId}.`,
        );
      }
      const rebuilt = rebuildCmpHistoricalContextWithBackfillFromGitTruth({
        projectionId: projection.projectionId,
        packageId: randomUUID(),
        snapshot,
        anchor,
        requesterAgentId: normalized.requesterAgentId,
        packageKind: normalized.query.packageKindHint ?? "historical_reply",
        fidelityLabel: "checked_high_fidelity",
        createdAt,
        metadata: {
          reason: normalized.reason,
          query: normalized.query,
          degraded: true,
          truthSource: fallbackDecision.resolvedSource,
          fallbackReason: fallbackDecision.reason,
        },
      });
      this.#cmpRuntimeProjections.set(rebuilt.projection.projectionId, rebuilt.projection);
      this.#cmpDbRuntimeSync.projections.set(
        projection.projectionId,
        createCmpProjectionRecordFromCheckedSnapshot({
          projectionId: projection.projectionId,
          snapshot,
          updatedAt: createdAt,
          metadata: {
            source: "cmp-runtime-passive-git-rebuild",
            truthSource: fallbackDecision.resolvedSource,
            fallbackReason: fallbackDecision.reason,
          },
        }),
      );
      this.#cmpDbRuntimeSync.packages.set(rebuilt.dbBackfillRecord.packageId, rebuilt.dbBackfillRecord);
      contextPackage = createContextPackage({
        packageId: rebuilt.contextPackage.packageId,
        sourceProjectionId: rebuilt.contextPackage.projectionId,
        targetAgentId: rebuilt.contextPackage.targetAgentId,
        packageKind: "historical_reply",
        packageRef: rebuilt.contextPackage.packageRef,
        fidelityLabel: "checked_high_fidelity",
        createdAt: rebuilt.contextPackage.createdAt,
        metadata: rebuilt.contextPackage.metadata,
      });
    } else {
      const passive = resolveCmpPassiveHistoricalDelivery({
        request: {
          requestId: randomUUID(),
          requesterLineage: this.#toCmpRuntimeLineage(requesterLineage),
          packageKind: normalized.query.packageKindHint ?? "historical_reply",
          fidelityLabel: "checked_high_fidelity",
          createdAt,
          preferredProjectionId: normalized.query.snapshotId ? runtimeProjection.projectionId : undefined,
          metadata: {
            reason: normalized.reason,
            query: normalized.query,
            degraded: false,
            truthSource: fallbackDecision.resolvedSource,
          },
        },
        sourceLineages: new Map(
          [...this.#cmpLineages.values()].map((lineage) => [lineage.agentId, this.#toCmpRuntimeLineage(lineage)]),
        ),
        projections: [...this.#cmpRuntimeProjections.values()],
      });
      const passivePackage = createCmpHistoricalReplyPackage({
        request: {
          requestId: `${passive.contextPackage.packageId}:reply`,
          requesterLineage: this.#toCmpRuntimeLineage(requesterLineage),
          packageKind: passive.contextPackage.packageKind,
          fidelityLabel: passive.contextPackage.fidelityLabel,
          createdAt: passive.contextPackage.createdAt,
          metadata: passive.contextPackage.metadata,
        },
        projection: passive.projection,
      });
      contextPackage = createContextPackage({
        packageId: passivePackage.packageId,
        sourceProjectionId: passivePackage.projectionId,
        targetAgentId: passivePackage.targetAgentId,
        packageKind: "historical_reply",
        packageRef: passivePackage.packageRef,
        fidelityLabel: "checked_high_fidelity",
        createdAt: passivePackage.createdAt,
        metadata: passivePackage.metadata,
      });
      syncCmpDbPackageFromContextPackage({
        state: this.#cmpDbRuntimeSync,
        contextPackage,
        projection: {
          projectionId: projection.projectionId,
          snapshotId: projection.snapshotId,
          agentId: projection.agentId,
        },
        metadata: {
          source: "cmp-runtime-passive",
        },
      });
    }

    this.#cmpPackages.set(contextPackage.packageId, contextPackage);
    if (projectReceipt?.db && this.cmpInfraBackends.dbExecutor) {
      const adapter = createCmpDbPostgresAdapter({
        topology: projectReceipt.db.topology,
        localTableSets: projectReceipt.db.localTableSets,
      });
      const projectionRecord = this.#cmpDbRuntimeSync.projections.get(projection.projectionId);
      if (projectionRecord) {
        void executeCmpProjectionLowering({
          adapter,
          executor: this.cmpInfraBackends.dbExecutor,
          record: projectionRecord,
        }).catch(() => undefined);
      }
      const packageRecord = this.#cmpDbRuntimeSync.packages.get(contextPackage.packageId);
      if (packageRecord) {
        void executeCmpContextPackageLowering({
          adapter,
          executor: this.cmpInfraBackends.dbExecutor,
          record: packageRecord,
        }).then((packageLowering) => {
          this.#recordCmpSyncEvent(createSyncEvent({
            syncEventId: randomUUID(),
            agentId: normalized.requesterAgentId,
            channel: "db",
            direction: "local",
            objectRef: contextPackage.packageId,
            createdAt: contextPackage.createdAt,
            metadata: {
              source: "cmp-runtime-passive-db-lowering",
              writeTarget: packageLowering.writeStatement.target,
              readTarget: packageLowering.readStatement.target,
            },
          }));
        }).catch((error: unknown) => {
          this.#recordCmpSyncEvent(createSyncEvent({
            syncEventId: randomUUID(),
            agentId: normalized.requesterAgentId,
            channel: "db",
            direction: "local",
            objectRef: contextPackage.packageId,
            createdAt: new Date().toISOString(),
            metadata: {
              source: "cmp-runtime-passive-db-lowering",
              error: error instanceof Error ? error.message : String(error),
            },
          }));
        });
      }
    }

    return {
      status: "materialized",
      found: true,
      snapshot,
      contextPackage,
      metadata: {
        degraded: fallbackDecision.degraded,
        truthSource: fallbackDecision.resolvedSource,
        fallbackReason: fallbackDecision.reason,
      },
    };
  }

  async submitTaHumanGateDecision(
    input: SubmitTaHumanGateDecisionInput,
  ): Promise<SubmitTaHumanGateDecisionResult> {
    if (!this.taControlPlaneGateway) {
      throw new Error("T/A control-plane gateway is not configured on this runtime.");
    }
    if (!this.provisionerRuntime) {
      throw new Error("Provisioner runtime is not configured on this runtime.");
    }

    const gate = this.#taHumanGates.get(input.gateId);
    const context = this.#taHumanGateContexts.get(input.gateId);
    if (!gate || !context) {
      return {
        status: "human_gate_not_found",
      };
    }

    if (gate.status !== "waiting_human") {
      return {
        status: gate.status === "approved" ? "dispatched" : "denied",
        accessRequest: context.accessRequest,
        humanGate: this.#toHumanGateHandoff(gate, "review_decision"),
      };
    }

    const createdAt = new Date().toISOString();
    const humanGateEvent = this.#recordHumanGateEvent(
      createTaHumanGateEvent({
        eventId: randomUUID(),
        gateId: gate.gateId,
        requestId: gate.requestId,
        type: input.action === "approve" ? "human_gate.approved" : "human_gate.rejected",
        createdAt,
        actorId: input.actorId,
        note: input.note,
        metadata: {
          capabilityKey: gate.capabilityKey,
          mode: context.accessRequest.mode,
        },
      }),
    );
    const updatedGate = this.#applyHumanGateEvent(gate.gateId, humanGateEvent);
    const humanGate = this.#toHumanGateHandoff(updatedGate, "review_decision");

    if (input.action === "reject") {
      return {
        status: "denied",
        accessRequest: context.accessRequest,
        reviewDecision: createReviewDecision({
          decisionId: randomUUID(),
          requestId: context.accessRequest.requestId,
          decision: "denied",
          mode: context.accessRequest.mode,
          reviewerId: input.actorId,
          reason: input.note?.trim() || `Human gate rejected capability ${context.accessRequest.requestedCapabilityKey}.`,
          riskLevel: updatedGate.plainLanguageRisk.riskLevel,
          plainLanguageRisk: updatedGate.plainLanguageRisk,
          createdAt,
          metadata: {
            source: "human-gate",
            gateId: updatedGate.gateId,
            eventId: humanGateEvent.eventId,
          },
        }),
        humanGate,
      };
    }

    const approvalDecision = createReviewDecision({
      decisionId: randomUUID(),
      requestId: context.accessRequest.requestId,
      vote: "allow",
      mode: context.accessRequest.mode,
      reviewerId: input.actorId,
      reason: input.note?.trim() || `Human gate approved capability ${context.accessRequest.requestedCapabilityKey}.`,
      riskLevel: updatedGate.plainLanguageRisk.riskLevel,
      plainLanguageRisk: updatedGate.plainLanguageRisk,
      grantCompilerDirective: {
        grantedTier: context.accessRequest.requestedTier,
        grantedScope: context.accessRequest.requestedScope,
        constraints: {
          source: "human-gate-approval",
          humanGateId: updatedGate.gateId,
          humanGateEventId: humanGateEvent.eventId,
        },
      },
      createdAt,
      metadata: {
        source: "human-gate",
        gateId: updatedGate.gateId,
        eventId: humanGateEvent.eventId,
      },
    });

    const inventory = this.#buildTaReviewInventory();
    const capabilityAvailable = (inventory.availableCapabilityKeys ?? []).includes(
      context.accessRequest.requestedCapabilityKey,
    );
    if (!capabilityAvailable) {
      const provisionRequest = this.#assembleProvisionRequestForRuntime({
        request: createProvisionRequest({
          provisionId: `${context.accessRequest.requestId}:human-gate-provision`,
          sourceRequestId: context.accessRequest.requestId,
          requestedCapabilityKey: context.accessRequest.requestedCapabilityKey,
          requestedTier: context.accessRequest.requestedTier,
          reason: context.accessRequest.reason,
          replayPolicy: "re_review_then_dispatch",
          createdAt,
          metadata: {
            ...(context.accessRequest.metadata ?? {}),
            source: "human-gate-approval",
            gateId: updatedGate.gateId,
            eventId: humanGateEvent.eventId,
          },
        }),
        accessRequest: context.accessRequest,
        reviewDecision: approvalDecision,
        inventory,
      });
      const provisionBundle = await this.provisionerRuntime.submit(provisionRequest);
      const provisionAsset = provisionBundle.status === "ready"
        ? this.provisionerRuntime.assetIndex.getCurrent(provisionRequest.provisionId)
        : undefined;
      return {
        status: provisionBundle.status === "ready" ? "provisioned" : "provisioning_failed",
        accessRequest: context.accessRequest,
        reviewDecision: approvalDecision,
        provisionRequest,
        provisionBundle,
        activation: provisionBundle.status === "ready"
          ? this.#createActivationHandoff({
            source: "provision_bundle",
            bundle: provisionBundle,
            asset: provisionAsset,
          })
          : undefined,
        replay: provisionBundle.status === "ready"
          ? this.#stageProvisionReplay({
              accessRequest: context.accessRequest,
              provisionBundle,
              intent: context.intent,
              source: "human-gate-approval",
              metadata: {
                gateId: updatedGate.gateId,
                eventId: humanGateEvent.eventId,
              },
            })
          : undefined,
        humanGate,
      };
    }

    const consumed = this.taControlPlaneGateway.consumeReviewDecision(approvalDecision);
    if (!consumed.grant) {
      return {
        status: "deferred",
        accessRequest: context.accessRequest,
        reviewDecision: approvalDecision,
        humanGate,
      };
    }

    const executionRequestId = consumed.decisionToken?.requestId ?? context.intent.request.requestId;
    const dispatch = await this.dispatchTaCapabilityGrant({
      grant: consumed.grant,
      decisionToken: consumed.decisionToken,
      sessionId: context.intent.sessionId,
      runId: context.intent.runId,
      intentId: context.intent.intentId,
      requestId: executionRequestId,
      capabilityKey: context.intent.request.capabilityKey,
      input: context.intent.request.input,
      priority: context.intent.request.priority,
      timeoutMs: context.intent.request.timeoutMs,
      metadata: context.intent.request.metadata,
    });
    const runOutcome = await this.#awaitCapabilityRunOutcome({
      requestId: executionRequestId,
      timeoutMs: context.intent.request.timeoutMs,
    });
    return {
      status: "dispatched",
      accessRequest: context.accessRequest,
      reviewDecision: approvalDecision,
      grant: consumed.grant,
      decisionToken: consumed.decisionToken,
      dispatch,
      runOutcome,
      humanGate,
    };
  }

  async dispatchCapabilityIntentViaTaPool(
    intent: CapabilityCallIntent,
    options: DispatchCapabilityIntentViaTaPoolOptions,
  ): Promise<DispatchCapabilityIntentViaTaPoolResult> {
    if (!this.taControlPlaneGateway) {
      throw new Error("T/A control-plane gateway is not configured on this runtime.");
    }
    if (!this.reviewerRuntime) {
      throw new Error("Reviewer runtime is not configured on this runtime.");
    }
    if (!this.provisionerRuntime) {
      throw new Error("Provisioner runtime is not configured on this runtime.");
    }

    const requestedTier = options.requestedTier ?? "B1";
    const mode = options.mode ?? this.taControlPlaneGateway.profile.defaultMode;
    const reason = options.reason ?? `Capability ${intent.request.capabilityKey} requested by runtime.`;
    const safety = evaluateSafetyInterception({
      mode,
      requestedTier,
      capabilityKey: intent.request.capabilityKey,
      reason,
      config: this.#taSafetyConfig,
    });

    if (safety.outcome === "block") {
      return {
        status: "blocked",
        safety,
      };
    }
    if (safety.outcome === "interrupt") {
      return {
        status: "interrupted",
        safety,
      };
    }
    if (safety.outcome === "escalate_to_human") {
      const accessRequest = this.taControlPlaneGateway.submitAccessRequest({
        sessionId: intent.sessionId,
        runId: intent.runId,
        agentId: options.agentId,
        capabilityKey: intent.request.capabilityKey,
        reason,
        requestedTier,
        mode,
        taskContext: options.taskContext,
        requestedScope: options.requestedScope,
        requestedDurationMs: options.requestedDurationMs,
        metadata: {
          correlationId: intent.correlationId,
          ...(intent.metadata ?? {}),
          ...(intent.request.metadata ?? {}),
          ...(options.metadata ?? {}),
          safetyEscalation: true,
        },
      });
      const reviewDecision = createReviewDecision({
        decisionId: randomUUID(),
        requestId: accessRequest.requestId,
        decision: "escalated_to_human",
        mode: accessRequest.mode,
        reason: safety.reason,
        riskLevel: safety.riskLevel,
        plainLanguageRisk: formatPlainLanguageRisk({
          requestedAction: accessRequest.requestedAction ?? this.#describeCapabilityIntentAction(intent),
          capabilityKey: accessRequest.requestedCapabilityKey,
          riskLevel: safety.riskLevel,
          metadata: safety.metadata,
        }),
        escalationTarget: "human-review",
        createdAt: new Date().toISOString(),
        metadata: {
          source: "safety-interceptor",
          ...(safety.metadata ?? {}),
        },
      });
      this.taControlPlaneGateway.consumeReviewDecision(reviewDecision);
      return {
        status: "waiting_human",
        safety,
        accessRequest,
        reviewDecision,
        humanGate: this.#openHumanGate({
          accessRequest,
          reviewDecision,
          intent,
          options,
        }),
      };
    }

    const effectiveTier = safety.outcome === "downgrade" && safety.downgradedTier
      ? safety.downgradedTier
      : requestedTier;

    const resolved = this.resolveTaCapabilityAccess({
      sessionId: intent.sessionId,
      runId: intent.runId,
      agentId: options.agentId,
      capabilityKey: intent.request.capabilityKey,
      reason,
      requestedTier: effectiveTier,
      mode,
      taskContext: options.taskContext,
      requestedScope: options.requestedScope,
      requestedDurationMs: options.requestedDurationMs,
      metadata: {
        correlationId: intent.correlationId,
        ...(intent.metadata ?? {}),
        ...(intent.request.metadata ?? {}),
        ...(options.metadata ?? {}),
      },
    });

    if (resolved.status === "baseline_granted") {
      const executionRequestId = intent.request.requestId;
      const dispatch = await this.dispatchTaCapabilityGrant({
        grant: resolved.grant,
        sessionId: intent.sessionId,
        runId: intent.runId,
        intentId: intent.intentId,
        requestId: executionRequestId,
        capabilityKey: intent.request.capabilityKey,
        input: intent.request.input,
        priority: intent.request.priority,
        timeoutMs: intent.request.timeoutMs,
        metadata: intent.request.metadata,
      });
      const runOutcome = await this.#awaitCapabilityRunOutcome({
        requestId: executionRequestId,
        timeoutMs: intent.request.timeoutMs,
      });
      return {
        status: "dispatched",
        grant: resolved.grant,
        dispatch,
        runOutcome,
        safety: safety.outcome === "allow" ? undefined : safety,
      };
    }

    const accessRequest = resolved.request;
    const inventory = this.#buildTaReviewInventory();
    const reviewDecision = await this.reviewerRuntime.submit({
      request: accessRequest,
      profile: this.taControlPlaneGateway.profile,
      inventory,
    });
    const consumed = this.taControlPlaneGateway.consumeReviewDecision(reviewDecision);

    if (consumed.grant) {
      const executionRequestId = consumed.decisionToken?.requestId ?? intent.request.requestId;
      const dispatch = await this.dispatchTaCapabilityGrant({
        grant: consumed.grant,
        decisionToken: consumed.decisionToken,
        sessionId: intent.sessionId,
        runId: intent.runId,
        intentId: intent.intentId,
        requestId: executionRequestId,
        capabilityKey: intent.request.capabilityKey,
        input: intent.request.input,
        priority: intent.request.priority,
        timeoutMs: intent.request.timeoutMs,
        metadata: intent.request.metadata,
      });
      const runOutcome = await this.#awaitCapabilityRunOutcome({
        requestId: executionRequestId,
        timeoutMs: intent.request.timeoutMs,
      });
      return {
        status: "dispatched",
        accessRequest,
        reviewDecision,
        grant: consumed.grant,
        decisionToken: consumed.decisionToken,
        dispatch,
        runOutcome,
        safety: safety.outcome === "allow" ? undefined : safety,
      };
    }

    if (reviewDecision.decision === "redirected_to_provisioning") {
      const provisionRequest = this.#assembleProvisionRequestForRuntime({
        request: toProvisionRequestFromReviewDecision({
          request: accessRequest,
          decision: reviewDecision,
          provisionId: `${reviewDecision.decisionId}:provision`,
          createdAt: new Date().toISOString(),
        }),
        accessRequest,
        reviewDecision,
        inventory,
      });
      const provisionBundle = await this.provisionerRuntime.submit(provisionRequest);
      const provisionAsset = provisionBundle.status === "ready"
        ? this.provisionerRuntime.assetIndex.getCurrent(provisionRequest.provisionId)
        : undefined;
      if (provisionBundle.status === "ready") {
        this.#stageProvisionReplay({
          accessRequest,
          provisionBundle,
          intent,
          source: "review-provisioning",
          metadata: {
            decisionId: reviewDecision.decisionId,
          },
        });
      }
      return {
        status: provisionBundle.status === "ready" ? "provisioned" : "provisioning_failed",
        accessRequest,
        reviewDecision,
        provisionRequest,
        provisionBundle,
        activation: provisionBundle.status === "ready"
          ? this.#createActivationHandoff({
            source: "provision_bundle",
            bundle: provisionBundle,
            asset: provisionAsset,
          })
          : undefined,
        replay: provisionBundle.status === "ready"
          ? this.#createReplayHandoff({
            source: "provision_bundle",
            bundle: provisionBundle,
            asset: provisionAsset,
          })
          : undefined,
        safety: safety.outcome === "allow" ? undefined : safety,
      };
    }

    const provisionAsset = this.#findCurrentProvisionAsset(intent.request.capabilityKey);
    const replay = provisionAsset
      ? this.#createReplayHandoff({
        source: "provision_asset",
        asset: provisionAsset,
      })
      : undefined;

    return {
      status: reviewDecision.decision === "escalated_to_human"
        ? "waiting_human"
        : reviewDecision.decision as Exclude<
          DispatchCapabilityIntentViaTaPoolResult["status"],
          "dispatched" | "waiting_human" | "provisioned" | "provisioning_failed" | "blocked" | "interrupted"
        >,
      accessRequest,
      reviewDecision,
      activation: provisionAsset
        ? this.#createActivationHandoff({
          source: "provision_asset",
          asset: provisionAsset,
        })
        : undefined,
      replay,
      humanGate: reviewDecision.decision === "escalated_to_human"
        ? this.#openHumanGate({
          accessRequest,
          reviewDecision,
          intent,
          options,
        })
        : replay?.policy === "manual"
          ? this.#createHumanGateHandoff({
            source: "replay_policy",
            capabilityKey: accessRequest.requestedCapabilityKey,
            requestedTier: accessRequest.requestedTier,
            mode: accessRequest.mode,
            requestedAction: accessRequest.requestedAction ?? this.#describeCapabilityIntentAction(intent),
            reason: replay.reason,
            riskLevel: reviewDecision.riskLevel ?? accessRequest.riskLevel,
            plainLanguageRisk: reviewDecision.plainLanguageRisk ?? accessRequest.plainLanguageRisk,
            metadata: {
              accessRequestId: accessRequest.requestId,
              reviewDecisionId: reviewDecision.decisionId,
              replayPolicy: replay.policy,
            },
          })
          : undefined,
      safety: safety.outcome === "allow" ? undefined : safety,
    };
  }

  async dispatchCapabilityIntent(intent: CapabilityCallIntent): Promise<DispatchCapabilityIntentResult> {
    const enqueueResponse = this.portBroker.enqueueIntent({ intent });
    const dispatchReceipt = await this.portBroker.dispatchNext();
    if (!dispatchReceipt) {
      return { enqueueResponse };
    }

    const latestEvent = this.journal.getLatestEvent(intent.runId)?.event;
    const runOutcome =
      latestEvent && latestEvent.type === "capability.result_received"
        ? await this.runCoordinator.tickRun({
            runId: intent.runId,
            incomingEvent: latestEvent,
          })
        : undefined;

    if (runOutcome) {
      this.#syncSessionFromRun(runOutcome.run);
    }

    return {
      enqueueResponse,
      dispatchReceipt,
      latestEvent,
      runOutcome,
    };
  }

  async dispatchModelInferenceIntent(intent: ModelInferenceIntent): Promise<DispatchModelInferenceIntentResult> {
    const execution = await this.#modelInferenceExecutor({ intent });
    const resultEvent: KernelEvent = {
      eventId: randomUUID(),
      type: "capability.result_received",
      sessionId: intent.sessionId,
      runId: intent.runId,
      createdAt: new Date().toISOString(),
      correlationId: intent.correlationId ?? intent.intentId,
      payload: {
        requestId: intent.intentId,
        resultId: execution.result.resultId,
        status: execution.result.status,
      },
      metadata: {
        resultSource: "model",
        final: true,
      },
    };

    this.journal.appendEvent(resultEvent);
    let runOutcome = await this.runCoordinator.tickRun({
      runId: intent.runId,
      incomingEvent: resultEvent,
    });
    if (runOutcome.run.status === "completed") {
      runOutcome = await this.runCoordinator.completeRun({
        runId: intent.runId,
        resultId: execution.result.resultId,
      });
    }
    this.#syncSessionFromRun(runOutcome.run);

    return {
      result: resultEvent,
      kernelResult: execution.result,
      runOutcome,
    };
  }

  async dispatchCmpActionIntent(intent: CmpActionIntent): Promise<DispatchCmpActionIntentResult> {
    const completedAt = new Date().toISOString();
    let actionResult: unknown;
    let error: DispatchCmpActionIntentResult["error"] | undefined;

    try {
      switch (intent.request.action) {
        case "ingest_runtime_context":
          actionResult = this.ingestRuntimeContext(
            intent.request.input as CmpActionIntent<"ingest_runtime_context">["request"]["input"],
          );
          break;
        case "commit_context_delta":
          actionResult = this.commitContextDelta(
            intent.request.input as CmpActionIntent<"commit_context_delta">["request"]["input"],
          );
          break;
        case "resolve_checked_snapshot":
          actionResult = this.resolveCheckedSnapshot(
            intent.request.input as CmpActionIntent<"resolve_checked_snapshot">["request"]["input"],
          );
          break;
        case "materialize_context_package":
          actionResult = this.materializeContextPackage(
            intent.request.input as CmpActionIntent<"materialize_context_package">["request"]["input"],
          );
          break;
        case "dispatch_context_package":
          actionResult = this.dispatchContextPackage(
            intent.request.input as CmpActionIntent<"dispatch_context_package">["request"]["input"],
          );
          break;
        case "request_historical_context":
          actionResult = this.requestHistoricalContext(
            intent.request.input as CmpActionIntent<"request_historical_context">["request"]["input"],
          );
          break;
        default: {
          const unreachableAction: never = intent.request.action;
          throw new Error(`Unsupported CMP action: ${String(unreachableAction)}`);
        }
      }
    } catch (cause) {
      error = {
        code: "cmp_action_failed",
        message: cause instanceof Error ? cause.message : String(cause),
        details: cause instanceof Error
          ? {
              name: cause.name,
            }
          : undefined,
      };
    }

    const resultEvent: KernelEvent = {
      eventId: randomUUID(),
      type: "capability.result_received",
      sessionId: intent.sessionId,
      runId: intent.runId,
      createdAt: completedAt,
      correlationId: intent.correlationId ?? intent.intentId,
      payload: {
        requestId: intent.request.requestId,
        resultId: `${intent.intentId}:cmp-result`,
        status: error ? "failed" : "success",
      },
      metadata: {
        resultSource: "cmp",
        cmpAction: intent.request.action,
        output: actionResult,
        error,
      },
    };

    this.journal.appendEvent(resultEvent);
    const runOutcome = await this.runCoordinator.tickRun({
      runId: intent.runId,
      incomingEvent: resultEvent,
    });
    this.#syncSessionFromRun(runOutcome.run);

    return {
      result: resultEvent,
      action: intent.request.action,
      actionResult,
      error,
      runOutcome,
    };
  }

  async dispatchIntent(intent: CapabilityCallIntent): Promise<DispatchCapabilityIntentViaTaPoolResult>;
  async dispatchIntent(intent: ModelInferenceIntent): Promise<DispatchModelInferenceIntentResult>;
  async dispatchIntent(intent: CmpActionIntent): Promise<DispatchCmpActionIntentResult>;
  async dispatchIntent(intent: CapabilityCallIntent | ModelInferenceIntent | CmpActionIntent) {
    if (intent.kind === "capability_call") {
      return this.dispatchCapabilityIntentViaTaPool(
        intent,
        this.#createDefaultTaDispatchOptions(intent),
      );
    }

    if (intent.kind === "cmp_action") {
      return this.dispatchCmpActionIntent(intent);
    }

    return this.dispatchModelInferenceIntent(intent);
  }

  async runUntilTerminal(params: {
    sessionId: string;
    source: GoalFrameSource;
    maxSteps?: number;
  }) {
    const created = await this.createRunFromSource({
      sessionId: params.sessionId,
      source: params.source,
    });

    let current = created;
    let lastModelResult: DispatchModelInferenceIntentResult["kernelResult"] | undefined;
    let lastCapabilityDispatch: DispatchCapabilityIntentViaTaPoolResult | undefined;
    let lastCmpDispatch: DispatchCmpActionIntentResult | undefined;
    const maxSteps = params.maxSteps ?? 8;
    let steps = 0;

    while (steps < maxSteps) {
      steps += 1;
      const intent = current.queuedIntent;
      if (!intent) {
        break;
      }

      if (intent.kind === "model_inference") {
        const dispatched = await this.dispatchModelInferenceIntent(intent);
        lastModelResult = dispatched.kernelResult;
        current = dispatched.runOutcome;
        if (current.run.status === "completed" || current.run.status === "failed" || current.run.status === "cancelled") {
          break;
        }
        continue;
      }

      if (intent.kind === "capability_call") {
        const dispatched = await this.dispatchCapabilityIntentViaTaPool(
          intent,
          this.#createDefaultTaDispatchOptions(intent),
        );
        lastCapabilityDispatch = dispatched;
        if (dispatched.status !== "dispatched" || !dispatched.runOutcome) {
          break;
        }
        current = dispatched.runOutcome;
        if (current.run.status === "completed" || current.run.status === "failed" || current.run.status === "cancelled") {
          break;
        }
        continue;
      }

      if (intent.kind === "cmp_action") {
        const dispatched = await this.dispatchCmpActionIntent(intent);
        lastCmpDispatch = dispatched;
        current = dispatched.runOutcome;
        if (current.run.status === "completed" || current.run.status === "failed" || current.run.status === "cancelled") {
          break;
        }
        continue;
      }

      throw new Error(`Unsupported queued intent kind for terminal runner: ${intent.kind}`);
    }

    return {
      session: this.sessionManager.loadSessionHeader(params.sessionId),
      outcome: current,
      answer:
        lastModelResult?.output && typeof lastModelResult.output === "object" && lastModelResult.output !== null && "text" in lastModelResult.output
          ? (lastModelResult.output as { text?: string }).text
          : undefined,
      capabilityDispatch: lastCapabilityDispatch,
      cmpDispatch: lastCmpDispatch,
      steps,
      finalEvents: this.readRunEvents(current.run.runId),
    };
  }

  readRunEvents(runId: string): JournalReadResult[] {
    return this.journal.readRunEvents(runId);
  }

  async #handleCapabilityResultEnvelope(result: CapabilityResultEnvelope): Promise<void> {
    const preparedId = typeof result.metadata?.preparedId === "string"
      ? result.metadata.preparedId
      : undefined;
    const context = this.#capabilityExecutionContext.get(result.executionId)
      ?? (preparedId ? this.#capabilityPreparedContext.get(preparedId) : undefined);
    if (!context) {
      return;
    }

    const existing = findCapabilityResultEventByResultId({
      events: this.readRunEvents(context.runId).map((entry) => entry.event),
      resultId: result.resultId,
    });
    if (existing) {
      return;
    }

    const event = createCapabilityResultReceivedEvent({
      result,
      sessionId: context.sessionId,
      runId: context.runId,
      requestId: context.requestId ?? context.plan.planId,
      correlationId: context.correlationId,
      metadata: {
        resultSource: context.resultSource ?? "capability",
        final: context.final === true,
        ...(result.metadata ?? {}),
      },
    });

    this.journal.appendEvent(event);
    let runOutcome = await this.runCoordinator.tickRun({
      runId: context.runId,
      incomingEvent: event,
    });
    if ((context.resultSource ?? "capability") === "model" && context.final === true && runOutcome.run.status === "completed") {
      runOutcome = await this.runCoordinator.completeRun({
        runId: context.runId,
        resultId: result.resultId,
      });
    }
    this.#syncSessionFromRun(runOutcome.run);
    this.#resolveCapabilityRunOutcome(context.requestId ?? context.plan.planId, runOutcome);
    this.#capabilityExecutionContext.delete(result.executionId);
    if (preparedId) {
      this.#capabilityPreparedContext.delete(preparedId);
    }
  }

  async #awaitCapabilityRunOutcome(params: {
    requestId: string;
    timeoutMs?: number;
  }): Promise<RunTransitionOutcome | undefined> {
    const existing = this.#capabilityRunOutcomes.get(params.requestId);
    if (existing) {
      this.#capabilityRunOutcomes.delete(params.requestId);
      return existing;
    }

    return new Promise<RunTransitionOutcome | undefined>((resolve) => {
      const timeout = setTimeout(() => {
        this.#capabilityRunOutcomeWaiters.delete(params.requestId);
        const timedOutOutcome = this.#capabilityRunOutcomes.get(params.requestId);
        if (timedOutOutcome) {
          this.#capabilityRunOutcomes.delete(params.requestId);
        }
        resolve(timedOutOutcome);
      }, params.timeoutMs ?? 5_000);

      this.#capabilityRunOutcomeWaiters.set(params.requestId, {
        resolve: (outcome) => {
          clearTimeout(timeout);
          this.#capabilityRunOutcomeWaiters.delete(params.requestId);
          resolve(outcome);
        },
        timeout,
      });
    });
  }

  #resolveCapabilityRunOutcome(requestId: string, outcome: RunTransitionOutcome): void {
    const waiter = this.#capabilityRunOutcomeWaiters.get(requestId);
    if (waiter) {
      clearTimeout(waiter.timeout);
      this.#capabilityRunOutcomeWaiters.delete(requestId);
      waiter.resolve(outcome);
      return;
    }

    this.#capabilityRunOutcomes.set(requestId, outcome);
  }

  #buildTaReviewInventory(): ReviewDecisionEngineInventory {
    const availableCapabilityKeys = [...new Set(
      this.capabilityPool.listCapabilities().map((manifest) => manifest.capabilityKey),
    )];
    const pendingProvisionKeys = this.provisionerRuntime
      ? this.provisionerRuntime.registry
        .list()
        .filter((entry) => {
          const status = entry.bundle?.status;
          return status === undefined || status === "pending" || status === "building" || status === "verifying";
        })
        .map((entry) => entry.request.requestedCapabilityKey)
      : [];
    const readyProvisionAssetKeys = this.provisionerRuntime
      ? this.provisionerRuntime.assetIndex.listCapabilityKeysByStatus(["ready_for_review"])
      : [];
    const activatingProvisionAssetKeys = this.provisionerRuntime
      ? this.provisionerRuntime.assetIndex.listCapabilityKeysByStatus(["activating"])
      : [];
    const activeProvisionAssetKeys = this.provisionerRuntime
      ? this.provisionerRuntime.assetIndex
        .listCurrentByStatus(["active"])
        .filter((asset) => asset.metadata?.activatedIntoPool !== true)
        .map((asset) => asset.capabilityKey)
      : [];

    return {
      availableCapabilityKeys,
      pendingProvisionKeys,
      readyProvisionAssetKeys,
      activatingProvisionAssetKeys,
      activeProvisionAssetKeys,
    };
  }

  #describeCapabilityIntentAction(intent: CapabilityCallIntent): string {
    const preferredKeys = ["task", "action", "query", "command", "prompt", "url"] as const;
    for (const key of preferredKeys) {
      const value = intent.request.input[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }

    return `use capability ${intent.request.capabilityKey}`;
  }

  #assembleProvisionRequestForRuntime(params: {
    request: ProvisionRequest;
    accessRequest: AccessRequest;
    reviewDecision: ReviewDecision;
    inventory: ReviewDecisionEngineInventory;
  }): ProvisionRequest {
    const existingSiblingCapabilities = [...new Set([
      ...(params.inventory.availableCapabilityKeys ?? []),
      ...(params.inventory.readyProvisionAssetKeys ?? []),
      ...(params.inventory.activatingProvisionAssetKeys ?? []),
      ...(params.inventory.activeProvisionAssetKeys ?? []),
    ])].filter((capabilityKey) => capabilityKey !== params.request.requestedCapabilityKey);

    return {
      ...params.request,
      replayPolicy: params.request.replayPolicy ?? "re_review_then_dispatch",
      metadata: {
        ...(params.request.metadata ?? {}),
        requestedAction: params.accessRequest.requestedAction
          ?? `request capability ${params.accessRequest.requestedCapabilityKey}`,
        reviewDecisionId: params.reviewDecision.decisionId,
        inventorySnapshot: {
          availableCapabilityKeys: params.inventory.availableCapabilityKeys ?? [],
          pendingCapabilityKeys: params.inventory.pendingProvisionKeys ?? [],
          readyCapabilityKeys: params.inventory.readyProvisionAssetKeys ?? [],
          activeCapabilityKeys: [
            ...new Set([
              ...(params.inventory.activatingProvisionAssetKeys ?? []),
              ...(params.inventory.activeProvisionAssetKeys ?? []),
            ]),
          ],
          summary: `Runtime snapshot captured for ${params.request.requestedCapabilityKey} during TAP provisioning handoff.`,
          activatingCapabilityKeys: params.inventory.activatingProvisionAssetKeys ?? [],
        },
        existingSiblingCapabilities,
        projectConstraints: [
          "Build a capability package only; do not complete the blocked user task.",
          "Return activation and replay guidance back to TAP runtime.",
          "Actual pool registration and post-build replay stay outside this Wave 4 assembly.",
        ],
        reviewerInstructions: [
          `Source review decision: ${params.reviewDecision.decisionId}.`,
          `Reason: ${params.reviewDecision.reason}`,
          "Do not self-approve activation or replay from inside the provisioner lane.",
        ],
        runtimeAssembly: {
          sourceRequestId: params.accessRequest.requestId,
          sourceDecisionId: params.reviewDecision.decisionId,
          sourceMode: params.accessRequest.mode,
        },
      },
    };
  }

  #findCurrentProvisionAsset(capabilityKey: string): ProvisionAssetRecord | undefined {
    if (!this.provisionerRuntime) {
      return undefined;
    }

    return [...this.provisionerRuntime.assetIndex.listCurrent()]
      .filter((asset) => asset.capabilityKey === capabilityKey)
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0];
  }

  #createActivationHandoff(params: {
    source: TaCapabilityActivationHandoff["source"];
    bundle?: ProvisionArtifactBundle;
    asset?: ProvisionAssetRecord;
  }): TaCapabilityActivationHandoff | undefined {
    const activationSpec = params.bundle?.activationSpec ?? params.asset?.activation.spec;
    const assetStatus = params.asset?.status;
    const status: TaCapabilityActivationHandoff["status"] = assetStatus === "activating"
      ? "activating"
      : assetStatus === "active"
        ? "active"
        : "ready_for_review";
    if (!activationSpec && !params.asset) {
      return undefined;
    }

    return {
      source: params.source,
      status,
      activationMode: activationSpec?.activationMode,
      targetPool: activationSpec?.targetPool ?? params.asset?.activation.targetPool,
      adapterFactoryRef: activationSpec?.adapterFactoryRef ?? params.asset?.activation.adapterFactoryRef,
      bindingArtifactRef: params.bundle?.bindingArtifact?.ref ?? params.asset?.activation.bindingArtifactRef,
      note: status === "ready_for_review"
        ? "Provisioned capability is staged and waiting for activation review."
        : status === "activating"
          ? "Provisioned capability is currently in activation handoff."
          : "Provisioned capability is already active in the asset index.",
      metadata: {
        provisionId: params.bundle?.provisionId ?? params.asset?.provisionId,
        bundleId: params.bundle?.bundleId ?? params.asset?.bundleId,
      },
    };
  }

  #createReplayHandoff(params: {
    source: TaCapabilityReplayHandoff["source"];
    bundle?: ProvisionArtifactBundle;
    asset?: ProvisionAssetRecord;
  }): TaCapabilityReplayHandoff {
    const provisionId = params.bundle?.provisionId ?? params.asset?.provisionId;
    const pendingReplay = provisionId
      ? [...this.#taPendingReplays.values()].find((replay) => replay.provisionId === provisionId)
      : undefined;
    const policy = pendingReplay?.policy ?? params.bundle?.replayPolicy ?? params.asset?.replayPolicy ?? "re_review_then_dispatch";
    const replayRecommendation = isRecord((params.bundle?.metadata ?? params.asset?.metadata)?.replayRecommendation)
      ? (params.bundle?.metadata ?? params.asset?.metadata)?.replayRecommendation as Record<string, unknown>
      : undefined;
    const state: TaCapabilityReplayHandoff["state"] = pendingReplay
      ? pendingReplay.nextAction === "none"
        ? "none"
        : pendingReplay.nextAction === "manual"
          ? "pending_manual"
          : pendingReplay.nextAction === "verify_then_auto"
            ? "pending_after_verify"
            : "pending_re_review"
      : policy === "none"
        ? "none"
        : policy === "manual"
          ? "pending_manual"
          : policy === "auto_after_verify"
            ? "pending_after_verify"
            : "pending_re_review";

    return {
      source: params.source,
      policy,
      state,
      reason: pendingReplay?.reason
        ?? (typeof replayRecommendation?.reason === "string" ? replayRecommendation.reason : undefined)
        ?? (policy === "none"
          ? "Replay is disabled for this provision result."
          : policy === "manual"
            ? "Replay is staged and now waits for a human-triggered resume."
            : policy === "auto_after_verify"
              ? "Replay is staged for post-verify auto resume, but this wave only records the skeleton."
              : "Replay is staged for re-review before dispatch, but the full replay loop is still pending."),
      requiresReviewerApproval: typeof replayRecommendation?.requiresReviewerApproval === "boolean"
        ? replayRecommendation.requiresReviewerApproval
        : policy === "manual" || policy === "re_review_then_dispatch",
      suggestedTrigger: typeof replayRecommendation?.suggestedTrigger === "string"
        ? replayRecommendation.suggestedTrigger
        : policy === "none"
          ? undefined
          : policy === "manual"
            ? "human_gate.approved"
            : policy === "auto_after_verify"
              ? "verification.passed"
              : "re_review.completed",
      nextStep: policy === "none"
        ? "Do nothing."
        : policy === "manual"
          ? "Wait for a later explicit human approval event."
          : policy === "auto_after_verify"
            ? "Keep the replay record and wire the verifier-trigger in a later wave."
            : "Keep the replay record and wire the re-review loop in a later wave.",
      metadata: {
        provisionId: params.bundle?.provisionId ?? params.asset?.provisionId,
        bundleId: params.bundle?.bundleId ?? params.asset?.bundleId,
        replayId: pendingReplay?.replayId,
      },
    };
  }

  #createHumanGateHandoff(params: {
    source: TaCapabilityHumanGateHandoff["source"];
    capabilityKey: string;
    requestedTier: TaCapabilityTier;
    mode: TaPoolMode;
    requestedAction: string;
    reason: string;
    riskLevel?: PlainLanguageRiskPayload["riskLevel"];
    plainLanguageRisk?: PlainLanguageRiskPayload;
    metadata?: Record<string, unknown>;
  }): TaCapabilityHumanGateHandoff {
    const availableUserActions: PlainLanguageRiskPayload["availableUserActions"] = [
      {
        actionId: "approve-once",
        label: "批准这次执行",
        kind: "approve",
        description: "允许这次请求继续进入后续 activation/replay/dispatch 链路。",
      },
      {
        actionId: "deny",
        label: "拒绝这次执行",
        kind: "deny",
        description: "保持当前状态，不继续推进这个能力请求。",
      },
      {
        actionId: "view-details",
        label: "查看风险细节",
        kind: "view_details",
        description: "先看清楚这次能力请求会动到哪里、为什么被拦下。",
      },
    ];
    if ((params.riskLevel ?? params.plainLanguageRisk?.riskLevel) === "dangerous") {
      availableUserActions.unshift({
        actionId: "ask-safer-alternative",
        label: "换更安全的方案",
        kind: "ask_for_safer_alternative",
        description: "优先改走副作用更小的路径，而不是直接放行。",
      });
    }

    const plainLanguageRisk = params.plainLanguageRisk ?? formatPlainLanguageRisk({
      requestedAction: params.requestedAction,
      capabilityKey: params.capabilityKey,
      riskLevel: params.riskLevel ?? "risky",
      whatHappensIfNotRun: "当前任务会停在等待人工批准的位置，直到有人明确批准、拒绝或改走更安全方案。",
      availableUserActions,
      metadata: params.metadata,
    });
    return {
      status: "waiting_human_approval",
      source: params.source,
      capabilityKey: params.capabilityKey,
      requestedTier: params.requestedTier,
      mode: params.mode,
      reason: params.reason,
      plainLanguageRisk,
      availableUserActions: plainLanguageRisk.availableUserActions,
      metadata: params.metadata,
    };
  }

  #buildHumanGateRiskPayload(params: {
    gateId: string;
    accessRequest: AccessRequest;
    reviewDecision: ReviewDecision;
  }): PlainLanguageRiskPayload {
    return params.reviewDecision.plainLanguageRisk
      ?? params.accessRequest.plainLanguageRisk
      ?? formatPlainLanguageRisk({
        requestedAction: params.accessRequest.requestedAction
          ?? `request capability ${params.accessRequest.requestedCapabilityKey}`,
        capabilityKey: params.accessRequest.requestedCapabilityKey,
        riskLevel: params.reviewDecision.riskLevel ?? params.accessRequest.riskLevel ?? "risky",
        availableUserActions: [
          {
            actionId: `${params.gateId}:approve`,
            label: "批准并继续",
            kind: "approve",
            description: "允许这次请求继续进入 TAP 下一步。",
            metadata: {
              gateId: params.gateId,
              action: "approve",
            },
          },
          {
            actionId: `${params.gateId}:reject`,
            label: "拒绝这次请求",
            kind: "deny",
            description: "保留当前状态，不继续执行这次能力请求。",
            metadata: {
              gateId: params.gateId,
              action: "reject",
            },
          },
          {
            actionId: `${params.gateId}:view-details`,
            label: "查看细节",
            kind: "view_details",
            description: "查看这次能力请求的风险说明和上下文。",
            metadata: {
              gateId: params.gateId,
            },
          },
        ],
        metadata: {
          gateId: params.gateId,
          escalationTarget: params.reviewDecision.escalationTarget,
        },
      });
  }

  #toHumanGateHandoff(
    gate: TaHumanGateState,
    source: TaCapabilityHumanGateHandoff["source"],
  ): TaCapabilityHumanGateHandoff {
    const context = this.#taHumanGateContexts.get(gate.gateId);
    return {
      status: gate.status === "waiting_human" ? "waiting_human_approval" : gate.status,
      source,
      capabilityKey: gate.capabilityKey,
      requestedTier: context?.accessRequest.requestedTier ?? "B1",
      mode: context?.accessRequest.mode ?? "balanced",
      reason: gate.reason,
      plainLanguageRisk: gate.plainLanguageRisk,
      availableUserActions: gate.plainLanguageRisk.availableUserActions,
      metadata: {
        gateId: gate.gateId,
        requestId: gate.requestId,
        escalationTarget: gate.escalationTarget,
        sourceDecisionId: gate.sourceDecisionId,
      },
    };
  }

  #openHumanGate(params: {
    accessRequest: AccessRequest;
    reviewDecision: ReviewDecision;
    intent: CapabilityCallIntent;
    options: DispatchCapabilityIntentViaTaPoolOptions;
  }): TaCapabilityHumanGateHandoff {
    const gateId = randomUUID();
    const createdAt = new Date().toISOString();
    const plainLanguageRisk = this.#buildHumanGateRiskPayload({
      gateId,
      accessRequest: params.accessRequest,
      reviewDecision: params.reviewDecision,
    });
    const gate = createTaHumanGateStateFromReviewDecision({
      gateId,
      request: params.accessRequest,
      reviewDecision: params.reviewDecision,
      plainLanguageRisk,
      createdAt,
      metadata: {
        intentId: params.intent.intentId,
        correlationId: params.intent.correlationId ?? params.intent.intentId,
        requestedTier: params.accessRequest.requestedTier,
        sourceMode: params.accessRequest.mode,
      },
    });
    this.#taHumanGates.set(gateId, gate);
    this.#taHumanGateContexts.set(gateId, {
      intent: params.intent,
      options: params.options,
      accessRequest: params.accessRequest,
      reviewDecision: params.reviewDecision,
    });
    this.#recordHumanGateEvent(createTaHumanGateEvent({
      eventId: randomUUID(),
      gateId,
      requestId: params.accessRequest.requestId,
      type: "human_gate.requested",
      createdAt,
      metadata: {
        capabilityKey: params.accessRequest.requestedCapabilityKey,
        reviewDecisionId: params.reviewDecision.decisionId,
      },
    }));
    this.#writeTapControlPlaneCheckpoint({
      sessionId: params.accessRequest.sessionId,
      runId: params.accessRequest.runId,
      reason: "pause",
      metadata: {
        sourceOperation: "human-gate-open",
        gateId,
        requestId: params.accessRequest.requestId,
      },
    });
    return this.#toHumanGateHandoff(gate, "review_decision");
  }

  #applyHumanGateEvent(gateId: string, event: TaHumanGateEvent): TaHumanGateState {
    const gate = this.#taHumanGates.get(gateId);
    if (!gate) {
      throw new Error(`Human gate ${gateId} was not found.`);
    }
    const updatedGate = applyTaHumanGateEvent({
      gate,
      event,
    });
    this.#taHumanGates.set(gateId, updatedGate);
    return updatedGate;
  }

  #recordHumanGateEvent(event: TaHumanGateEvent): TaHumanGateEvent {
    const history = this.#taHumanGateEvents.get(event.gateId) ?? [];
    history.push(event);
    this.#taHumanGateEvents.set(event.gateId, history);
    return event;
  }

  #stageProvisionReplay(params: {
    accessRequest: AccessRequest;
    provisionBundle: ProvisionArtifactBundle;
    intent: CapabilityCallIntent;
    source: string;
    metadata?: Record<string, unknown>;
  }): TaCapabilityReplayHandoff {
    const replay = createTaPendingReplay({
      replayId: `replay:${params.accessRequest.requestId}:${params.provisionBundle.provisionId}`,
      request: params.accessRequest,
      provisionBundle: params.provisionBundle,
      createdAt: params.provisionBundle.completedAt ?? new Date().toISOString(),
      metadata: {
        source: params.source,
        intentId: params.intent.intentId,
        runId: params.intent.runId,
        sessionId: params.intent.sessionId,
        ...(params.metadata ?? {}),
      },
    });
    this.#taPendingReplays.set(replay.replayId, replay);
    this.#writeTapControlPlaneCheckpoint({
      sessionId: params.intent.sessionId,
      runId: params.intent.runId,
      reason: "manual",
      metadata: {
        sourceOperation: "replay-stage",
        replayId: replay.replayId,
        provisionId: params.provisionBundle.provisionId,
      },
    });
    return this.#createReplayHandoff({
      source: "provision_bundle",
      bundle: params.provisionBundle,
      asset: this.provisionerRuntime?.assetIndex.getCurrent(params.provisionBundle.provisionId),
    });
  }

  #ensureCmpProjectRepo(lineage: AgentLineage): CmpGitProjectRepo {
    const existing = this.#cmpProjectRepos.get(lineage.projectId);
    if (!this.#cmpGitOrchestrator.registry.get(lineage.agentId)) {
      this.#cmpGitOrchestrator.registry.register({
        projectId: lineage.projectId,
        agentId: lineage.agentId,
        parentAgentId: lineage.parentAgentId,
        depth: lineage.depth,
      });
    }
    if (existing) {
      return existing;
    }

    const repo = createCmpGitProjectRepo({
      projectId: lineage.projectId,
      repoName: lineage.projectId,
      defaultAgentId: lineage.agentId,
    });
    this.#cmpProjectRepos.set(lineage.projectId, repo);
    return repo;
  }

  #storeCmpEvent(event: ContextEvent): void {
    this.#cmpEvents.set(event.eventId, event);
    const bucket = this.#cmpEventsByAgent.get(event.agentId) ?? [];
    bucket.push(event.eventId);
    this.#cmpEventsByAgent.set(event.agentId, bucket);
  }

  #recordCmpSyncEvent(event: SyncEvent): void {
    this.#cmpSyncEvents.set(event.syncEventId, event);
  }

  #requireCmpLineage(agentId: string): AgentLineage {
    const lineage = this.#cmpLineages.get(agentId);
    if (!lineage) {
      throw new Error(`CMP lineage for agent ${agentId} was not found.`);
    }
    return lineage;
  }

  #requireCmpProjection(projectionId: string): PromotedProjection {
    const projection = this.#cmpPromotedProjections.get(projectionId);
    if (!projection) {
      throw new Error(`CMP promoted projection ${projectionId} was not found.`);
    }
    return projection;
  }

  #createCmpPseudoCommitRef(deltaId: string): string {
    return `cmp-${deltaId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20) || "commit"}`;
  }

  #createCmpLineageRef(lineage: AgentLineage): string {
    return `${lineage.projectId}:${lineage.agentId}`;
  }

  #toCmpEventKind(kind: IngestRuntimeContextInput["materials"][number]["kind"]): ContextEvent["kind"] {
    switch (kind) {
      case "context_package":
        return "context_package_received";
      case "user_input":
      case "system_prompt":
      case "assistant_output":
      case "tool_result":
      case "state_marker":
        return kind;
    }
  }

  #toCmpRuntimeLineage(lineage: AgentLineage) {
    const peers = [...this.#cmpLineages.values()]
      .filter((candidate) => {
        return candidate.agentId !== lineage.agentId && candidate.parentAgentId === lineage.parentAgentId;
      })
      .map((candidate) => candidate.agentId);

    return {
      projectId: lineage.projectId,
      agentId: lineage.agentId,
      parentAgentId: lineage.parentAgentId,
      depth: lineage.depth,
      childAgentIds: lineage.childAgentIds ?? [],
      peerAgentIds: peers,
      metadata: lineage.metadata,
    };
  }

  #createCmpNeighborhood(lineage: AgentLineage): CmpAgentNeighborhood {
    return {
      agentId: lineage.agentId,
      parentAgentId: lineage.parentAgentId,
      peerAgentIds: [...this.#cmpLineages.values()]
        .filter((candidate) => {
          return candidate.agentId !== lineage.agentId && candidate.parentAgentId === lineage.parentAgentId;
        })
        .map((candidate) => candidate.agentId),
      childAgentIds: lineage.childAgentIds ?? [],
    };
  }

  #collectCmpAncestorIds(agentId: string): string[] {
    const ancestors: string[] = [];
    let current = this.#cmpLineages.get(agentId);
    while (current?.parentAgentId) {
      ancestors.push(current.parentAgentId);
      current = this.#cmpLineages.get(current.parentAgentId);
    }
    return ancestors;
  }

  #findCmpParentPeerIds(lineage: AgentLineage): string[] {
    if (!lineage.parentAgentId) {
      return [];
    }
    const parent = this.#cmpLineages.get(lineage.parentAgentId);
    if (!parent?.parentAgentId) {
      return [];
    }
    return [...this.#cmpLineages.values()]
      .filter((candidate) => {
        return candidate.agentId !== parent.agentId && candidate.parentAgentId === parent.parentAgentId;
      })
      .map((candidate) => candidate.agentId);
  }

  #recordCmpNeighborhoodSyncs(params: {
    ingress: CmpIngressRecord;
    lineage: AgentLineage;
    payloadRef: string;
    granularityLabel: string;
  }): void {
    const neighborhood = this.#createCmpNeighborhood(params.lineage);
    const createdAt = params.ingress.createdAt;
    for (const direction of ["parent", "peer", "child"] as const) {
      const hasTargets = direction === "parent"
        ? !!neighborhood.parentAgentId
        : direction === "peer"
          ? neighborhood.peerAgentIds.length > 0
          : neighborhood.childAgentIds.length > 0;
      if (!hasTargets) {
        continue;
      }
      const mqEnvelope = createCmpIcmaPublishEnvelope({
        envelopeId: `${params.ingress.ingressId}:${direction}`,
        projectId: params.lineage.projectId,
        sourceAgentId: params.lineage.agentId,
        neighborhood,
        direction,
        granularityLabel: params.granularityLabel,
        payloadRef: params.payloadRef,
        createdAt,
      });
      assertNoSkippingNeighborhoodBroadcast({
        envelope: mqEnvelope,
        knownAncestorIds: this.#collectCmpAncestorIds(params.lineage.agentId)
          .filter((ancestorId) => ancestorId !== params.lineage.parentAgentId),
        parentPeerIds: this.#findCmpParentPeerIds(params.lineage),
      });
      for (const targetAgentId of mqEnvelope.targetAgentIds) {
        assertCmpSubscriptionAllowed({
          neighborhood,
          request: {
            requestId: `${mqEnvelope.envelopeId}:${targetAgentId}:subscription`,
            projectId: params.lineage.projectId,
            publisherAgentId: params.lineage.agentId,
            subscriberAgentId: targetAgentId,
            relation: direction,
            channel: direction === "parent"
              ? "to_parent"
              : direction === "peer"
                ? "peer"
                : "to_children",
            createdAt,
          },
          knownAncestorIds: this.#collectCmpAncestorIds(params.lineage.agentId)
            .filter((ancestorId) => ancestorId !== params.lineage.parentAgentId),
          parentPeerIds: this.#findCmpParentPeerIds(params.lineage),
        });
        this.#recordCmpSyncEvent(createSyncEvent({
          syncEventId: randomUUID(),
          agentId: params.lineage.agentId,
          channel: "mq",
          direction: direction === "parent"
            ? "to_parent"
            : direction === "peer"
              ? "to_peer"
              : "to_children",
          objectRef: `${mqEnvelope.envelopeId}:${targetAgentId}`,
          createdAt,
          metadata: {
            targetAgentId,
            granularityLabel: params.granularityLabel,
          },
        }));
      }
    }
  }

  #mapCmpSyncIntentToDirection(intent: CmpGitSyncIntent): SyncEvent["direction"] {
    switch (intent) {
      case "local_record":
        return "local";
      case "submit_to_parent":
        return "to_parent";
      case "peer_exchange":
        return "to_peer";
      case "seed_children":
        return "to_children";
    }
  }

  #mapCmpDeltaSyncIntentToGit(syncIntent: ContextDelta["syncIntent"]): CmpGitSyncIntent {
    switch (syncIntent) {
      case "local_record":
        return "local_record";
      case "submit_to_parent":
        return "submit_to_parent";
      case "broadcast_to_peers":
        return "peer_exchange";
      case "dispatch_to_children":
        return "seed_children";
    }
  }

  #resolveCmpRuntimeTargetLineage(params: {
    sourceAgentId: string;
    targetAgentId: string;
    targetKind: DispatchContextPackageInput["targetKind"];
  }): AgentLineage {
    const existing = this.#cmpLineages.get(params.targetAgentId);
    if (existing) {
      return existing;
    }
    if (params.targetKind === "child") {
      const source = this.#requireCmpLineage(params.sourceAgentId);
      if ((source.childAgentIds ?? []).includes(params.targetAgentId)) {
        const inheritedAncestors = Array.isArray(source.metadata?.ancestorAgentIds)
          ? source.metadata.ancestorAgentIds as string[]
          : [];
        const synthetic = createAgentLineage({
          agentId: params.targetAgentId,
          parentAgentId: source.agentId,
          depth: source.depth + 1,
          projectId: source.projectId,
          branchFamily: createCmpBranchFamily({
            workBranch: `work/${params.targetAgentId}`,
            cmpBranch: `cmp/${params.targetAgentId}`,
            mpBranch: `mp/${params.targetAgentId}`,
            tapBranch: `tap/${params.targetAgentId}`,
          }),
          metadata: {
            synthetic: true,
            source: "cmp-runtime-dispatch-fallback",
            ancestorAgentIds: [source.agentId, ...inheritedAncestors],
          },
        });
        this.#cmpLineages.set(synthetic.agentId, synthetic);
        this.#ensureCmpProjectRepo(synthetic);
        return synthetic;
      }
    }
    throw new Error(`CMP lineage for agent ${params.targetAgentId} was not found.`);
  }

  #resolveCmpProjectionVisibility(params: {
    sourceAgentId: string;
    targetAgentId: string;
  }): PromotedProjection["visibilityLevel"] {
    if (params.sourceAgentId === params.targetAgentId) {
      return "local";
    }
    const source = this.#cmpLineages.get(params.sourceAgentId);
    const target = this.#cmpLineages.get(params.targetAgentId);
    if (source?.parentAgentId === params.targetAgentId) {
      return "parent";
    }
    if ((source?.childAgentIds ?? []).includes(params.targetAgentId)) {
      return "children";
    }
    if (!source || !target) {
      return "lineage";
    }
    if (target.parentAgentId === source.agentId) {
      return "children";
    }
    if (source.parentAgentId && source.parentAgentId === target.parentAgentId) {
      return "peer";
    }
    return "lineage";
  }

  #mapVisibilityToPromotionStatus(
    visibilityLevel: PromotedProjection["visibilityLevel"],
  ): PromotedProjection["promotionStatus"] {
    switch (visibilityLevel) {
      case "local":
        return "local_only";
      case "parent":
        return "submitted_to_parent";
      case "children":
        return "dispatched_downward";
      case "peer":
      case "lineage":
        return "promoted_by_parent";
    }
  }

  #mapProjectionStatusToRuntimeVisibility(
    status: PromotedProjection["promotionStatus"],
  ): CmpRuntimeProjectionRecord["visibility"] {
    switch (status) {
      case "local_only":
        return "local_only";
      case "submitted_to_parent":
        return "submitted_to_parent";
      case "accepted_by_parent":
        return "accepted_by_parent";
      case "promoted_by_parent":
        return "promoted_by_parent";
      case "dispatched_downward":
        return "dispatched_downward";
      case "archived":
        return "archived";
    }
  }

  #createCmpProjectionFromSnapshot(params: {
    snapshot: CheckedSnapshot;
    targetAgentId: string;
  }): PromotedProjection {
    const dbProjection = createCmpProjectionRecordFromCheckedSnapshot({
      projectionId: randomUUID(),
      snapshot: {
        snapshotId: params.snapshot.snapshotId,
        agentId: params.snapshot.agentId,
        branchRef: params.snapshot.branchRef,
        commitRef: params.snapshot.commitRef,
        checkedAt: params.snapshot.checkedAt,
        qualityLabel: params.snapshot.qualityLabel,
        metadata: params.snapshot.metadata,
      },
      updatedAt: params.snapshot.checkedAt,
    });
    const visibilityLevel = this.#resolveCmpProjectionVisibility({
      sourceAgentId: params.snapshot.agentId,
      targetAgentId: params.targetAgentId,
    });
    const projection = createPromotedProjection({
      projectionId: dbProjection.projectionId,
      snapshotId: dbProjection.snapshotId,
      agentId: dbProjection.agentId,
      visibilityLevel,
      promotionStatus: this.#mapVisibilityToPromotionStatus(visibilityLevel),
      projectionRefs: [dbProjection.branchRef, dbProjection.commitRef],
      updatedAt: dbProjection.updatedAt,
      metadata: {
        targetAgentId: params.targetAgentId,
        ...(dbProjection.metadata ?? {}),
      },
    });
    this.#cmpPromotedProjections.set(projection.projectionId, projection);
    return projection;
  }

  #findOrCreateCmpProjection(params: {
    snapshot: CheckedSnapshot;
    targetAgentId: string;
  }): PromotedProjection {
    const existing = [...this.#cmpPromotedProjections.values()].find((projection) => {
      return projection.snapshotId === params.snapshot.snapshotId
        && projection.metadata?.targetAgentId === params.targetAgentId;
    });
    if (existing) {
      return existing;
    }
    return this.#createCmpProjectionFromSnapshot(params);
  }

  #collectCmpStoredSectionsFromEventIds(eventIds: readonly string[]): CmpStoredSection[] {
    const sections = new Map<string, CmpStoredSection>();
    for (const eventId of eventIds) {
      const event = this.#cmpEvents.get(eventId);
      if (!event) {
        continue;
      }
      const storedSections = readCmpStoredSectionsFromMetadata(event.metadata?.cmpStoredSections);
      for (const storedSection of storedSections) {
        sections.set(storedSection.id, storedSection);
      }
    }
    return [...sections.values()];
  }

  #collectCmpStoredSectionsFromSnapshot(snapshot: CheckedSnapshot): CmpStoredSection[] {
    return readCmpStoredSectionsFromMetadata(snapshot.metadata?.cmpStoredSections);
  }

  #selectCmpStoredSectionForSnapshot(snapshot: CheckedSnapshot): CmpStoredSection | undefined {
    return this.#collectCmpStoredSectionsFromSnapshot(snapshot)[0];
  }

  #createCmpGitProjectionSourceAnchor(snapshot: CheckedSnapshot): CmpGitProjectionSourceAnchor | undefined {
    const candidateId = typeof snapshot.metadata?.candidateId === "string"
      ? snapshot.metadata.candidateId
      : undefined;
    const branchHead = this.#cmpGitOrchestrator.getBranchHead(snapshot.branchRef);
    if (!candidateId) {
      return {
        candidateId: snapshot.snapshotId,
        checkedRefName: branchHead?.checkedRefName,
        promotedRefName: branchHead?.promotedRefName,
        branchHeadRef: branchHead?.branchRef.fullRef ?? snapshot.branchRef,
        commitSha: branchHead?.headCommitSha ?? snapshot.commitRef,
      };
    }
    const candidate = this.#cmpGitOrchestrator.listCandidates()
      .find((record) => record.candidateId === candidateId);
    return {
      candidateId,
      checkedRefName: branchHead?.checkedRefName,
      promotedRefName: branchHead?.promotedRefName,
      branchHeadRef: branchHead?.branchRef.fullRef ?? candidate?.branchRef.fullRef ?? snapshot.branchRef,
      commitSha: branchHead?.headCommitSha ?? candidate?.commitSha ?? snapshot.commitRef,
    };
  }

  #requireCmpRuntimeProjectionForSnapshot(params: {
    projection: PromotedProjection;
    snapshot: CheckedSnapshot;
  }): CmpRuntimeProjectionRecord {
    const existing = this.#cmpRuntimeProjections.get(params.projection.projectionId);
    if (existing) {
      return existing;
    }
    const runtimeProjection = createCmpProjectionRecord({
      projectionId: params.projection.projectionId,
      checkedSnapshotRef: params.snapshot.snapshotId,
      agentId: params.snapshot.agentId,
      visibility: this.#mapProjectionStatusToRuntimeVisibility(params.projection.promotionStatus),
      updatedAt: params.projection.updatedAt,
      metadata: params.projection.metadata,
    });
    this.#cmpRuntimeProjections.set(runtimeProjection.projectionId, runtimeProjection);
    return runtimeProjection;
  }

  #createNeighborDispatchReceipt(params: {
    contextPackage: ContextPackage;
    input: DispatchContextPackageInput;
    createdAt: string;
  }): DispatchReceipt {
    const source = this.#toCmpRuntimeLineage(this.#requireCmpLineage(params.input.sourceAgentId));
    const target = this.#toCmpRuntimeLineage(this.#resolveCmpRuntimeTargetLineage({
      sourceAgentId: params.input.sourceAgentId,
      targetAgentId: params.input.targetAgentId,
      targetKind: params.input.targetKind,
    }));
    const runtimeProjection = [...this.#cmpRuntimeProjections.values()]
      .find((projection) => projection.projectionId === params.contextPackage.sourceProjectionId);
    if (!runtimeProjection) {
      throw new Error(
        `CMP runtime projection ${params.contextPackage.sourceProjectionId} was not found for delivery.`,
      );
    }
    assertCmpProjectionVisibleToTarget({
      projection: {
        projectionId: runtimeProjection.projectionId,
        agentId: runtimeProjection.agentId,
        visibility: runtimeProjection.visibility,
      },
      source,
      target,
    });
    const plan = planCmpDispatcherDelivery({
      source,
      target,
      contextPackage: createCmpContextPackageRecord({
        packageId: params.contextPackage.packageId,
        projectionId: params.contextPackage.sourceProjectionId,
        sourceAgentId: params.input.sourceAgentId,
        targetAgentId: params.input.targetAgentId,
        packageKind: params.contextPackage.packageKind,
        packageRef: params.contextPackage.packageRef,
        fidelityLabel: params.contextPackage.fidelityLabel,
        createdAt: params.contextPackage.createdAt,
        metadata: params.contextPackage.metadata,
      }),
      createdAt: params.createdAt,
      metadata: params.input.metadata,
    });
    this.#cmpRuntimeDispatchReceipts.set(plan.receipt.dispatchId, plan.receipt);
    return createDispatchReceipt({
      dispatchId: plan.receipt.dispatchId,
      packageId: plan.receipt.packageId,
      sourceAgentId: plan.receipt.sourceAgentId,
      targetAgentId: plan.receipt.targetAgentId,
      status: "delivered",
      deliveredAt: plan.receipt.deliveredAt,
      metadata: {
        relation: plan.relation,
        ...(plan.receipt.metadata ?? {}),
      },
    });
  }

  #mapDispatchTargetKindToDirection(
    targetKind: DispatchContextPackageInput["targetKind"],
  ): SyncEvent["direction"] {
    switch (targetKind) {
      case "core_agent":
        return "local";
      case "parent":
        return "to_parent";
      case "peer":
        return "to_peer";
      case "child":
        return "to_children";
    }
  }

  #mapDispatchTargetKindFromReceipt(
    receipt: DispatchReceipt,
  ): "core_agent" | "parent" | "peer" | "child" {
    const relation = receipt.metadata?.relation;
    if (relation === "parent" || relation === "peer" || relation === "child") {
      return relation;
    }
    return "core_agent";
  }

  #selectCmpHistoricalSnapshot(
    input: RequestHistoricalContextInput,
  ): CheckedSnapshot | undefined {
    if (input.query.snapshotId) {
      const snapshot = this.#cmpCheckedSnapshots.get(input.query.snapshotId);
      if (snapshot && snapshot.metadata?.projectId === input.projectId) {
        return snapshot;
      }
      return undefined;
    }

    return [...this.#cmpCheckedSnapshots.values()]
      .filter((snapshot) => {
        if (snapshot.metadata?.projectId !== input.projectId) {
          return false;
        }
        if (input.query.lineageRef && snapshot.lineageRef !== input.query.lineageRef) {
          return false;
        }
        if (input.query.branchRef && snapshot.branchRef !== input.query.branchRef) {
          return false;
        }
        return true;
      })
      .sort((left, right) => right.checkedAt.localeCompare(left.checkedAt))[0];
  }

  #syncSessionFromRun(run: RunTransitionOutcome["run"]): void {
    if (run.status === "completed" || run.status === "failed" || run.status === "cancelled") {
      this.sessionManager.setActiveRun(run.sessionId, undefined);
      return;
    }

    this.sessionManager.setActiveRun(run.sessionId, run.runId);
  }

  #createDefaultTaDispatchOptions(
    intent: CapabilityCallIntent,
  ): DispatchCapabilityIntentViaTaPoolOptions {
    return {
      agentId: `agent-core-runtime:${intent.sessionId}`,
    };
  }
}

export function createAgentCoreRuntime(options: AgentCoreRuntimeOptions = {}): AgentCoreRuntime {
  return new AgentCoreRuntime(options);
}

export function createGoalSourceForSession(params: {
  sessionId: string;
  runId?: string;
  userInput: string;
  goalId?: string;
  inputRefs?: string[];
  constraints?: GoalFrameSource["constraints"];
  metadata?: Record<string, unknown>;
}): GoalFrameSource {
  return createGoalSource({
    goalId: params.goalId ?? randomUUID(),
    sessionId: params.sessionId,
    runId: params.runId,
    userInput: params.userInput,
    inputRefs: params.inputRefs,
    constraints: params.constraints,
    metadata: params.metadata,
  });
}
