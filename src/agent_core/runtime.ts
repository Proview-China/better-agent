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
import {
  createModelInferenceCapabilityAdapter,
  createModelInferenceCapabilityManifest,
  MODEL_INFERENCE_CAPABILITY_KEY,
} from "./integrations/model-inference-adapter.js";
import { AppendOnlyEventJournal } from "./journal/index.js";
import type { JournalReadResult } from "./journal/journal-types.js";
import { CapabilityPortBroker, type CapabilityDispatchReceipt, type CapabilityPortDefinition } from "./port/index.js";
import { AgentRunCoordinator } from "./run/index.js";
import { SessionManager } from "./session/index.js";
import { projectStateFromEvents } from "./state/index.js";
import {
  classifyCapabilityRisk,
  createTapCmpMpReadyChecklist,
  createTapGovernanceObject,
  createTapUserSurfaceSnapshot,
  instantiateTapGovernanceObject,
  type CreateTapGovernanceObjectInput,
  type TapCmpMpReadyChecklist,
  type TapGovernanceObject,
  type TapToolPolicyOverride,
  type TapUserOverrideContract,
  type TapUserSurfaceSnapshot,
} from "./ta-pool-model/index.js";
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
  type CmpCheckerEvaluateInput,
  type CmpCheckerLiveOptions,
  type CmpDbAgentMaterializeInput,
  type CmpDbAgentMaterializeLiveOptions,
  type CmpDbAgentPassiveInput,
  type CmpDbAgentPassiveLiveOptions,
  type CmpDispatcherDispatchInput,
  type CmpDispatcherLiveOptions,
  type CmpDispatcherPassiveLiveOptions,
  type CmpDispatcherPassiveReturnInput,
  type CmpFiveAgentActiveLiveRunInput,
  type CmpFiveAgentPassiveLiveRunInput,
  createCmpFiveAgentRuntime,
  createCmpRoleTapProfile,
  createCmpFiveAgentTapBridgeCompiled,
  createCheckerCheckedSnapshotMetadata,
  type CmpIcmaIngestInput,
  type CmpIcmaLiveOptions,
  type CmpIteratorAdvanceInput,
  type CmpIteratorLiveOptions,
  type CmpFiveAgentCapabilityAccessResolution,
  type CmpFiveAgentTapBridgeContext,
  type CmpFiveAgentRole,
  type CmpFiveAgentRuntime,
  type CmpFiveAgentRuntimeSnapshot,
  type CmpFiveAgentSummary,
} from "./cmp-five-agent/index.js";
import type { AgentCoreCmpApi } from "./cmp-api/index.js";
import { createAgentCoreCmpServices } from "./cmp-service/index.js";
import {
  activateProvisionAsset,
  applyTaHumanGateEvent,
  createTapGovernanceSnapshot,
  createTapAgentRecord,
  createTapThreeAgentUsageReport,
  createActivationFactoryResolver,
  createPoolRuntimeSnapshots,
  createTaHumanGateEvent,
  createTaHumanGateStateFromReviewDecision,
  createTaResumeEnvelope,
  createTaPendingReplay,
  hydrateTapRuntimeSnapshot as hydrateRecoveredTapRuntimeState,
  createExecutionRequest,
  createInvocationPlanFromGrant,
  createTapPoolRuntimeSnapshot,
  hasPendingTapGovernanceWork,
  TaControlPlaneGateway,
  type ActivationAdapterFactory,
  type ActivationDriverResult,
  type PoolRuntimeSnapshots,
  type TapGovernanceSnapshot,
  type TapAgentRecord,
  type TapAgentRecordActor,
  type TapThreeAgentUsageReport,
  type TapPoolRuntimeSnapshot,
  type TaActivationFailure,
  type TaActivationReceipt,
  type TaActivationAttemptRecord,
  type TaHumanGateEvent,
  type TaHumanGateState,
  type TaPendingReplay,
  type ResolveCapabilityAccessResult,
  materializeProvisionAssetActivation,
} from "./ta-pool-runtime/index.js";
import { createReviewerRuntime, ReviewerRuntime } from "./ta-pool-review/index.js";
import { createDefaultReviewerLlmHook } from "./ta-pool-review/index.js";
import { createProvisionerRuntime, ProvisionerRuntime } from "./ta-pool-provision/index.js";
import { createModelBackedProvisionerWorkerBridge } from "./ta-pool-provision/provisioner-model-worker.js";
import type {
  ProvisionAssetRecord,
  ProvisionDeliveryReport,
  TmaReadyBundleReceipt,
  TmaSessionState,
} from "./ta-pool-provision/index.js";
import {
  createDefaultToolReviewerLlmHook,
  createToolReviewGovernanceTrace,
  createToolReviewerRuntime,
  ToolReviewerRuntime,
} from "./ta-pool-tool-review/index.js";
import type {
  ToolReviewGovernancePlan,
  ToolReviewQualityReport,
  ToolReviewerRuntimeResult,
  ToolReviewSessionState,
  ToolReviewTmaWorkOrder,
} from "./ta-pool-tool-review/index.js";
import { evaluateSafetyInterception, type TaSafetyInterceptorConfig } from "./ta-pool-safety/index.js";
import {
  createProvisionContextApertureSnapshot,
  createReviewContextApertureSnapshot,
} from "./ta-pool-context/context-aperture.js";
import { formatPlainLanguageRisk } from "./ta-pool-context/plain-language-risk.js";
import { toProvisionRequestFromReviewDecision, type ReviewDecisionEngineInventory } from "./ta-pool-review/index.js";
import { registerRaxMpCapabilityFamily } from "./integrations/rax-mp-adapter.js";
import type {
  CapabilityCallIntent,
  CmpActionIntent,
  ModelInferenceIntent,
  CapabilityPortResponse,
  GoalFrameCompiled,
  GoalFrameSource,
  IntentPriority,
  KernelEvent,
  CheckpointReason,
  KernelResult,
  SessionHeader,
} from "./types/index.js";
import type {
  CapabilityAdapter,
  CapabilityBinding,
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
  TaPoolRiskLevel,
  PoolActivationSpec,
  ProvisionArtifactBundle,
  ProvisionRequest,
  ReplayPolicy,
  ReviewDecision,
  TaCapabilityTier,
  TaPoolMode,
} from "./ta-pool-types/index.js";
import {
  matchesCapabilityPattern,
  createProvisionRequest,
  createReviewDecision,
} from "./ta-pool-types/index.js";
import {
  createAgentLineage,
  advanceCmpPackageRecordStatus,
  advanceCmpRequestRecordStatus,
  createCmpBranchFamily,
  createCheckedSnapshot,
  createCmpPackageRecord,
  createCmpPackageRecordFromContextPackage,
  createCmpRequestRecord,
  createCmpRequestRecordFromHistoricalRequest,
  createCmpRequestRecordFromIngest,
  createCmpSectionRecord,
  createCmpSectionRecordFromSection,
  createCmpSectionRecordFromStoredSection,
  createCmpSnapshotRecord,
  createCmpSnapshotRecordFromCheckedSnapshot,
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
  type CmpPackageRecord,
  type CmpRequestRecord,
  type CmpRulePack,
  type CmpSectionRecord,
  type CmpSnapshotRecord,
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
  toolReviewerRuntime?: ToolReviewerRuntime;
  provisionerRuntime?: ProvisionerRuntime;
  taSafetyConfig?: TaSafetyInterceptorConfig;
  runCoordinator?: AgentRunCoordinator;
  sessionManager?: SessionManager;
  modelInferenceExecutor?: (params: { intent: ModelInferenceIntent }) => Promise<ModelInferenceExecutionResult>;
  cmpInfraBackends?: CmpInfraBackends;
  cmpFiveAgentRuntime?: CmpFiveAgentRuntime;
  tapAgentModelRoutes?: {
    reviewer?: Partial<import("./integrations/tap-agent-model.js").TapAgentModelRoute>;
    toolReviewer?: Partial<import("./integrations/tap-agent-model.js").TapAgentModelRoute>;
    provisioner?: Partial<import("./integrations/tap-agent-model.js").TapAgentModelRoute>;
  };
  registerDefaultMpCapabilityFamily?: boolean;
}

export interface CreateTapTaskGovernanceInput {
  taskId: string;
  requestedMode?: TaPoolMode;
  userOverride?: TapUserOverrideContract;
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
  controlPlaneGatewayOverride?: TaControlPlaneGateway;
  profileOverride?: AgentCapabilityProfile;
}

interface TapGovernanceDispatchDirective {
  governanceObjectId: string;
  effectiveMode: TaPoolMode;
  automationDepth: string;
  explanationStyle: string;
  derivedRiskLevel: TaPoolRiskLevel;
  matchedToolPolicy?: TapToolPolicyOverride["policy"];
  matchedToolPolicySelector?: string;
  forceHumanByRisk: boolean;
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
  continueResult?: ContinueTaProvisioningResult;
}

export interface DispatchCmpFiveAgentCapabilityResult {
  role: CmpFiveAgentRole;
  profile: AgentCapabilityProfile;
  intent: CapabilityCallIntent;
  bridgeMetadata: Record<string, unknown>;
  dispatch: DispatchCapabilityIntentViaTaPoolResult;
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
  resumeEnvelopeId?: string;
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

function readTapUserOverrideCandidate(value: unknown): TapUserOverrideContract | undefined {
  return isRecord(value) ? value as TapUserOverrideContract : undefined;
}

function readTapGovernanceDispatchDirective(
  metadata: unknown,
): TapGovernanceDispatchDirective | undefined {
  if (!isRecord(metadata)) {
    return undefined;
  }
  const directive = metadata.tapGovernanceDirective;
  return isRecord(directive) ? directive as unknown as TapGovernanceDispatchDirective : undefined;
}

function maxCapabilityTier(
  left: TaCapabilityTier,
  right: TaCapabilityTier,
): TaCapabilityTier {
  const tiers: readonly TaCapabilityTier[] = ["B0", "B1", "B2", "B3"];
  const leftIndex = tiers.indexOf(left);
  const rightIndex = tiers.indexOf(right);
  return leftIndex >= rightIndex ? left : right;
}

function toIntentPriority(value: unknown): CapabilityInvocationPlan["priority"] {
  return value === "low" || value === "normal" || value === "high" || value === "critical"
    ? value
    : "normal";
}

function inventoryTracksCapabilityLifecycle(
  inventory: ReviewDecisionEngineInventory | undefined,
  capabilityKey: string,
): boolean {
  return [
    ...(inventory?.availableCapabilityKeys ?? []),
    ...(inventory?.pendingProvisionKeys ?? []),
    ...(inventory?.readyProvisionAssetKeys ?? []),
    ...(inventory?.activatingProvisionAssetKeys ?? []),
    ...(inventory?.activeProvisionAssetKeys ?? []),
  ].includes(capabilityKey);
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

interface ApplyTaCapabilityLifecycleInput {
  capabilityKey: string;
  lifecycleAction: "register" | "replace" | "suspend" | "resume" | "unregister";
  targetPool: string;
  bindingId?: string;
  manifest?: CapabilityManifest;
  adapter?: CapabilityAdapter;
  accessRequest?: AccessRequest;
  reviewDecision?: ReviewDecision;
  reason?: string;
}

export interface ApplyTaCapabilityLifecycleResult {
  status: "applied" | "blocked";
  binding?: CapabilityBinding;
  continuedProvisioning?: ContinueTaProvisioningResult[];
  error?: {
    code: string;
    message: string;
  };
}

export type ResumeTaEnvelopeStatus =
  | DispatchCapabilityIntentViaTaPoolResult["status"]
  | ActivateTaProvisionAssetStatus
  | "resume_envelope_not_found"
  | "human_gate_pending"
  | "resume_not_supported";

export interface ResumeTaEnvelopeResult {
  status: ResumeTaEnvelopeStatus;
  envelope?: ReturnType<typeof createTaResumeEnvelope>;
  replay?: TaPendingReplay;
  humanGate?: TaCapabilityHumanGateHandoff;
  activation?: TaCapabilityActivationHandoff;
  dispatchResult?: DispatchCapabilityIntentViaTaPoolResult;
  activationResult?: ActivateTaProvisionAssetResult;
}

export type ContinueTaProvisioningStatus =
  | ResumeTaEnvelopeStatus
  | ActivateTaProvisionAssetStatus
  | "replay_envelope_not_found";

export interface ContinueTaProvisioningResult {
  status: ContinueTaProvisioningStatus;
  provisionId: string;
  replay?: TaPendingReplay;
  activation?: TaCapabilityActivationHandoff;
  activationResult?: ActivateTaProvisionAssetResult;
  dispatchResult?: DispatchCapabilityIntentViaTaPoolResult;
}

export interface ContinueRecoveredTapProvisionResult {
  provisionId: string;
  resumedTmaSessionIds: string[];
  resumedBundleStatuses: Array<ProvisionArtifactBundle["status"]>;
  continueResult?: ContinueTaProvisioningResult;
  skippedReason?: "replay_not_staged";
}

export interface ContinueRecoveredTapRuntimeResult {
  runId: string;
  provisionResults: ContinueRecoveredTapProvisionResult[];
}

export interface PickupToolReviewerReadyHandoffResult {
  sessionId: string;
  provisionId?: string;
  capabilityKey?: string;
  status: "continued" | "skipped";
  continueResult?: ContinueTaProvisioningResult;
  skippedReason?: "non_provision_session" | "no_follow_up_state" | "handoff_not_ready";
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

export interface DispatchCmpFiveAgentCapabilityInput
  extends ResolveTaCapabilityAccessInput {
  role: CmpFiveAgentRole;
  input: Record<string, unknown>;
  priority: CapabilityInvocationPlan["priority"];
  timeoutMs?: number;
  requestId?: string;
  intentId?: string;
  correlationId?: string;
  createdAt?: string;
  operation?: string;
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
  readonly toolReviewerRuntime?: ToolReviewerRuntime;
  readonly provisionerRuntime?: ProvisionerRuntime;
  readonly runCoordinator: AgentRunCoordinator;
  readonly sessionManager: SessionManager;
  readonly cmpInfraBackends: CmpInfraBackends;
  readonly cmp: AgentCoreCmpApi;
  readonly #taSafetyConfig?: TaSafetyInterceptorConfig;
  readonly #modelInferenceExecutor: (params: { intent: ModelInferenceIntent }) => Promise<ModelInferenceExecutionResult>;
  readonly #capabilityExecutionContext = new Map<string, DispatchCapabilityPlanInput>();
  readonly #capabilityPreparedContext = new Map<string, DispatchCapabilityPlanInput>();
  readonly #capabilityRunOutcomes = new Map<string, RunTransitionOutcome>();
  readonly #kernelResultsByRun = new Map<string, KernelResult>();
  readonly #capabilityRunOutcomeWaiters = new Map<string, {
    resolve: (outcome: RunTransitionOutcome | undefined) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();
  readonly #taHumanGates = new Map<string, TaHumanGateState>();
  readonly #taHumanGateContexts = new Map<string, TaHumanGateContext>();
  readonly #taHumanGateEvents = new Map<string, TaHumanGateEvent[]>();
  readonly #taPendingReplays = new Map<string, TaPendingReplay>();
  readonly #taActivationAttempts = new Map<string, TaActivationAttemptRecord>();
  readonly #taResumeEnvelopes = new Map<string, ReturnType<typeof createTaResumeEnvelope>>();
  readonly #taActivationFactoryResolver = createActivationFactoryResolver();
  readonly #tapAgentRecords = new Map<string, TapAgentRecord>();
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
  readonly #cmpRequests = new Map<string, CmpRequestRecord>();
  readonly #cmpSectionRecords = new Map<string, CmpSectionRecord>();
  readonly #cmpSnapshotRecords = new Map<string, CmpSnapshotRecord>();
  readonly #cmpPackageRecords = new Map<string, CmpPackageRecord>();
  readonly #cmpDispatchReceipts = new Map<string, DispatchReceipt>();
  readonly #cmpRuntimeDispatchReceipts = new Map<string, CmpDispatchReceipt>();
  readonly #cmpSyncEvents = new Map<string, SyncEvent>();
  readonly #cmpProjectInfraBootstrapReceipts = new Map<string, CmpProjectInfraBootstrapReceipt>();
  readonly #cmpFiveAgentRuntime: CmpFiveAgentRuntime;
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
    this.#modelInferenceExecutor = options.modelInferenceExecutor ?? executeModelInference;
    this.#cmpFiveAgentRuntime = options.cmpFiveAgentRuntime ?? createCmpFiveAgentRuntime();
    this.taControlPlaneGateway = options.taControlPlaneGateway
      ?? (options.taProfile ? new TaControlPlaneGateway({ profile: options.taProfile }) : undefined);
    const enableDefaultTapAgentModels = options.modelInferenceExecutor !== undefined;
    this.reviewerRuntime = options.reviewerRuntime
      ?? (this.taControlPlaneGateway ? createReviewerRuntime(
        enableDefaultTapAgentModels
          ? {
            llmReviewerHook: createDefaultReviewerLlmHook({
              executor: this.#modelInferenceExecutor,
              route: options.tapAgentModelRoutes?.reviewer,
            }),
          }
          : {},
      ) : undefined);
    this.toolReviewerRuntime = options.toolReviewerRuntime
      ?? (this.taControlPlaneGateway ? createToolReviewerRuntime(
        enableDefaultTapAgentModels
          ? {
            llmToolReviewerHook: createDefaultToolReviewerLlmHook({
              executor: this.#modelInferenceExecutor,
              route: options.tapAgentModelRoutes?.toolReviewer,
            }),
          }
          : {},
      ) : undefined);
    this.provisionerRuntime = options.provisionerRuntime
      ?? (this.taControlPlaneGateway ? createProvisionerRuntime(
        enableDefaultTapAgentModels
          ? {
            workerBridge: createModelBackedProvisionerWorkerBridge({
              executor: this.#modelInferenceExecutor,
              route: options.tapAgentModelRoutes?.provisioner,
            }),
          }
          : {},
      ) : undefined);
    this.#taSafetyConfig = options.taSafetyConfig;
    this.runCoordinator = options.runCoordinator ?? new AgentRunCoordinator({
      journal: this.journal,
      checkpointStore: this.checkpointStore,
    });
    this.sessionManager = options.sessionManager ?? new SessionManager();
    this.cmpInfraBackends = createCmpInfraBackends(options.cmpInfraBackends);
    this.cmp = createAgentCoreCmpServices(this).api;
    this.registerCapabilityAdapter(
      createModelInferenceCapabilityManifest(),
      createModelInferenceCapabilityAdapter({
        executor: this.#modelInferenceExecutor,
      }),
    );
    if (options.registerDefaultMpCapabilityFamily !== false) {
      registerRaxMpCapabilityFamily({
        runtime: this,
      });
    }
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

  getReviewerDurableState(requestId: string) {
    return this.reviewerRuntime?.getDurableState(requestId);
  }

  listReviewerDurableStates() {
    return this.reviewerRuntime?.listDurableStates() ?? [];
  }

  getToolReviewerSession(sessionId: string): ToolReviewSessionState | undefined {
    return this.toolReviewerRuntime?.getSession(sessionId);
  }

  listToolReviewerSessions(): readonly ToolReviewSessionState[] {
    return this.toolReviewerRuntime?.listSessions() ?? [];
  }

  listToolReviewerGovernancePlans(): readonly ToolReviewGovernancePlan[] {
    return this.toolReviewerRuntime?.listGovernancePlans() ?? [];
  }

  getToolReviewerGovernancePlan(sessionId: string): ToolReviewGovernancePlan | undefined {
    return this.toolReviewerRuntime?.createGovernancePlan(sessionId);
  }

  listToolReviewerQualityReports(): readonly ToolReviewQualityReport[] {
    return this.toolReviewerRuntime?.listQualityReports() ?? [];
  }

  getToolReviewerTmaWorkOrder(sessionId: string): ToolReviewTmaWorkOrder | undefined {
    return this.toolReviewerRuntime?.createTmaWorkOrder(sessionId);
  }

  listToolReviewerTmaWorkOrders(): readonly ToolReviewTmaWorkOrder[] {
    return this.toolReviewerRuntime?.listTmaWorkOrders() ?? [];
  }

  listTapAgentRecords(filter: {
    actor?: TapAgentRecordActor;
    sessionId?: string;
    runId?: string;
  } = {}): readonly TapAgentRecord[] {
    return [...this.#tapAgentRecords.values()]
      .filter((record) => !filter.actor || record.actor === filter.actor)
      .filter((record) => !filter.sessionId || record.sessionId === filter.sessionId)
      .filter((record) => !filter.runId || record.runId === filter.runId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  createTapThreeAgentUsageReport(input: {
    sessionId?: string;
    runId?: string;
  } = {}): TapThreeAgentUsageReport {
    return createTapThreeAgentUsageReport({
      records: this.listTapAgentRecords(),
      sessionId: input.sessionId,
      runId: input.runId,
    });
  }

  #recordTapAgentRecord(record: TapAgentRecord): void {
    this.#tapAgentRecords.set(record.recordId, record);
  }

  #recordReviewerAgentRecord(params: {
    accessRequest: AccessRequest;
    reviewDecision: ReviewDecision;
    metadata?: Record<string, unknown>;
  }): void {
    this.#recordTapAgentRecord(createTapAgentRecord({
      recordId: `reviewer:${params.reviewDecision.decisionId}`,
      actor: "reviewer",
      sessionId: params.accessRequest.sessionId,
      runId: params.accessRequest.runId,
      requestId: params.accessRequest.requestId,
      capabilityKey: params.accessRequest.requestedCapabilityKey,
      status: params.reviewDecision.decision,
      summary: params.reviewDecision.reason,
      createdAt: params.reviewDecision.createdAt,
      metadata: {
        decisionId: params.reviewDecision.decisionId,
        vote: params.reviewDecision.vote,
        reviewerId: params.reviewDecision.reviewerId,
        escalationTarget: params.reviewDecision.escalationTarget,
        ...params.metadata,
      },
    }));
  }

  #recordToolReviewerAgentRecord(result: ToolReviewerRuntimeResult): void {
    const sessionId = result.input.trace.request?.sessionId ?? result.sessionId;
    const runId = result.input.trace.request?.runId ?? `${result.sessionId}:tool-review`;
    const requestId = result.input.trace.request?.requestId;
    const provisionId = typeof result.input.metadata?.provisionId === "string"
      ? result.input.metadata.provisionId
      : "provisionId" in result.output
        ? result.output.provisionId
        : undefined;

    this.#recordTapAgentRecord(createTapAgentRecord({
      recordId: `tool-reviewer:${result.reviewId}`,
      actor: "tool_reviewer",
      sessionId,
      runId,
      requestId,
      provisionId,
      capabilityKey: result.action.capabilityKey,
      status: result.runtimeStatus,
      summary: result.output.summary,
      createdAt: result.recordedAt,
      metadata: {
        governanceKind: result.governanceKind,
        outputKind: result.output.kind,
        outputStatus: result.output.status,
        ...(result.output.metadata ?? {}),
        ...(result.metadata ?? {}),
      },
    }));
  }

  #recordTmaAgentRecord(params: {
    request: ProvisionRequest;
    bundle: ProvisionArtifactBundle;
    summary?: string;
    metadata?: Record<string, unknown>;
  }): void {
    const runtimeAssembly = isRecord(params.request.metadata?.runtimeAssembly)
      ? params.request.metadata.runtimeAssembly as Record<string, unknown>
      : undefined;
    const sessionId = typeof runtimeAssembly?.sourceSessionId === "string"
      ? runtimeAssembly.sourceSessionId
      : `provision:${params.request.provisionId}`;
    const runId = typeof runtimeAssembly?.sourceRunId === "string"
      ? runtimeAssembly.sourceRunId
      : `provision:${params.request.provisionId}`;
    this.#recordTapAgentRecord(createTapAgentRecord({
      recordId: `tma:${params.bundle.bundleId}`,
      actor: "tma",
      sessionId,
      runId,
      requestId: params.request.sourceRequestId,
      provisionId: params.request.provisionId,
      capabilityKey: params.request.requestedCapabilityKey,
      status: params.bundle.status,
      summary: params.summary ?? `TMA produced a ${params.bundle.status} bundle for ${params.request.requestedCapabilityKey}.`,
      createdAt: params.bundle.completedAt ?? params.request.createdAt,
      metadata: {
        bundleId: params.bundle.bundleId,
        replayPolicy: params.bundle.replayPolicy,
        activationMode: params.bundle.activationSpec?.activationMode,
        ...params.metadata,
      },
    }));
  }

  #resolveRequestedTmaLane(request: ProvisionRequest): "bootstrap" | "extended" {
    return request.requestedTier === "B3" ? "extended" : "bootstrap";
  }

  async #recordToolReviewProvisionRequest(params: {
    provisionRequest: ProvisionRequest;
    accessRequest: AccessRequest;
    reviewDecision: ReviewDecision;
    reason: string;
  }): Promise<void> {
    if (!this.toolReviewerRuntime) {
      return;
    }

    const result = await this.toolReviewerRuntime.submit({
      sessionId: `tool-review:provision:${params.provisionRequest.provisionId}`,
      governanceAction: {
        kind: "provision_request",
        trace: createToolReviewGovernanceTrace({
          actionId: `tool-review:provision-request:${params.provisionRequest.provisionId}:${params.reviewDecision.decisionId}`,
          actorId: "tool-reviewer",
          reason: params.reason,
          createdAt: params.provisionRequest.createdAt,
          request: this.#createToolReviewRequestRef(params.accessRequest),
          sourceDecision: this.#createToolReviewSourceDecisionRef(params.reviewDecision),
          metadata: {
            provisionId: params.provisionRequest.provisionId,
          },
        }),
        provisionId: params.provisionRequest.provisionId,
        capabilityKey: params.provisionRequest.requestedCapabilityKey,
        requestedLane: this.#resolveRequestedTmaLane(params.provisionRequest),
        requestedTier: params.provisionRequest.requestedTier,
        metadata: {
          sourceRequestId: params.provisionRequest.sourceRequestId,
          desiredProviderOrRuntime: params.provisionRequest.desiredProviderOrRuntime,
        },
      },
    });
    this.#recordToolReviewerAgentRecord(result);
  }

  getTmaSession(sessionId: string): TmaSessionState | undefined {
    return this.provisionerRuntime?.getTmaSession(sessionId);
  }

  listTmaSessions(): readonly TmaSessionState[] {
    return this.provisionerRuntime?.listTmaSessions() ?? [];
  }

  getTaResumeEnvelope(envelopeId: string) {
    return this.#taResumeEnvelopes.get(envelopeId);
  }

  listTaResumeEnvelopes() {
    return [...this.#taResumeEnvelopes.values()];
  }

  getTaReplayResumeEnvelope(replayId: string) {
    return this.listTaResumeEnvelopes().find((envelope) => {
      return envelope.source === "replay" && envelope.metadata?.replayId === replayId;
    });
  }

  getTaActivationResumeEnvelope(provisionId: string) {
    return this.listTaResumeEnvelopes().find((envelope) => {
      return envelope.source === "activation" && envelope.metadata?.provisionId === provisionId;
    });
  }

  listResumableTmaSessions() {
    return this.provisionerRuntime?.listResumableTmaSessions() ?? [];
  }

  async resumeTmaSession(sessionId: string) {
    const bundle = await this.provisionerRuntime?.resumeTmaSession(sessionId);
    if (bundle?.status === "ready") {
      await this.#recordToolReviewDeliveryFromBundle(bundle, "tma-resume");
      const request = this.provisionerRuntime?.registry.get(bundle.provisionId)?.request;
      if (request) {
        this.#recordTmaAgentRecord({
          request,
          bundle,
          summary: "TMA resumed a stored session and returned a ready bundle.",
        });
      }
      await this.pickupToolReviewerReadyHandoffs({
        sessionId: `tool-review:provision:${bundle.provisionId}`,
      });
    }
    return bundle;
  }

  getProvisionDeliveryReport(provisionId: string): ProvisionDeliveryReport | undefined {
    return this.provisionerRuntime?.createDeliveryReport(provisionId);
  }

  listProvisionDeliveryReports(): readonly ProvisionDeliveryReport[] {
    return this.provisionerRuntime?.listDeliveryReports() ?? [];
  }

  async #pickupToolReviewerSessionHandoff(
    sessionId: string,
  ): Promise<PickupToolReviewerReadyHandoffResult> {
    const report = this.toolReviewerRuntime?.createQualityReport(sessionId);
    if (!report || report.verdict !== "handoff_ready") {
      return {
        sessionId,
        status: "skipped",
        skippedReason: "handoff_not_ready",
      };
    }
    if (!sessionId.startsWith("tool-review:provision:")) {
      return {
        sessionId,
        status: "skipped",
        skippedReason: "non_provision_session",
      };
    }

    const provisionId = sessionId.slice("tool-review:provision:".length);
    const asset = this.provisionerRuntime?.assetIndex.getCurrent(provisionId);
    const pendingReplay = this.#findPendingReplayByProvisionId(provisionId);
    const replayEnvelope = this.#findReplayEnvelopeByProvisionId(provisionId);
    const capabilityKey = asset?.capabilityKey ?? pendingReplay?.capabilityKey;
    if (!asset && !pendingReplay && !replayEnvelope) {
      return {
        sessionId,
        provisionId,
        capabilityKey,
        status: "skipped",
        skippedReason: "no_follow_up_state",
      };
    }

    return {
      sessionId,
      provisionId,
      capabilityKey,
      status: "continued",
      continueResult: await this.continueTaProvisioning(provisionId),
    };
  }

  async pickupToolReviewerReadyHandoffs(options: {
    sessionId?: string;
  } = {}): Promise<PickupToolReviewerReadyHandoffResult[]> {
    const results: PickupToolReviewerReadyHandoffResult[] = [];
    for (const report of this.listToolReviewerQualityReports()
      .filter((entry) => !options.sessionId || entry.sessionId === options.sessionId)) {
      if (report.verdict !== "handoff_ready") {
        continue;
      }
      results.push(await this.#pickupToolReviewerSessionHandoff(report.sessionId));
    }

    return results;
  }

  #readProvisionContinuationGate(provisionId: string): "waiting_human" | "blocked" | undefined {
    const plan = this.getToolReviewerGovernancePlan(`tool-review:provision:${provisionId}`);
    const latestStatus = plan?.items.at(-1)?.status;
    if (latestStatus === "waiting_human" || latestStatus === "blocked") {
      return latestStatus;
    }
    return undefined;
  }

  async continueTaProvisioning(provisionId: string): Promise<ContinueTaProvisioningResult> {
    const replay = this.#findPendingReplayByProvisionId(provisionId);
    const asset = this.provisionerRuntime?.assetIndex.getCurrent(provisionId);
    const continuationGate = this.#readProvisionContinuationGate(provisionId);
    if (continuationGate) {
      return {
        status: continuationGate,
        provisionId,
        replay,
        activation: asset
          ? this.#createActivationHandoff({
            source: "provision_asset",
            asset,
          })
          : undefined,
      };
    }

    const activationResult = await this.#ensureProvisionAssetActivated(provisionId);
    const activation = activationResult.activation;

    if (activationResult.status !== "activated") {
      return {
        status: activationResult.status,
        provisionId,
        replay,
        activation,
        activationResult,
      };
    }

    const replayEnvelope = this.#findReplayEnvelopeByProvisionId(provisionId);
    if (!replayEnvelope) {
      return {
        status: "replay_envelope_not_found",
        provisionId,
        replay,
        activation,
        activationResult,
      };
    }

    if (!replay || replay.policy === "manual" || replay.policy === "none") {
      return {
        status: activationResult.status,
        provisionId,
        replay,
        activation,
        activationResult,
      };
    }

    const resumed = await this.#resumeReplayEnvelope(replayEnvelope, replay, {
      skipActivation: true,
    });
    const resumedStatus: ContinueTaProvisioningStatus = resumed.status === "human_gate_pending"
      ? "waiting_human"
      : resumed.status;
    return {
      status: resumedStatus,
      provisionId,
      replay: resumed.replay,
      activation: resumed.activation,
      activationResult: resumed.activationResult ?? activationResult,
      dispatchResult: resumed.dispatchResult,
    };
  }

  #canAutoContinueProvisioning(provisionId: string): boolean {
    const asset = this.provisionerRuntime?.assetIndex.getCurrent(provisionId);
    if (!asset) {
      return false;
    }

    if (asset.status === "active") {
      return true;
    }

    const adapterFactoryRef = asset.activation?.spec?.adapterFactoryRef
      ?? asset.activation?.adapterFactoryRef;
    return typeof adapterFactoryRef === "string" && this.#taActivationFactoryResolver.has(adapterFactoryRef);
  }

  async #recordReadyBundleAndStageReplay(params: {
    accessRequest: AccessRequest;
    provisionRequest: ProvisionRequest;
    provisionBundle: ProvisionArtifactBundle;
    intent: CapabilityCallIntent;
    source: string;
    reason: string;
    options?: DispatchCapabilityIntentViaTaPoolOptions;
    reviewDecision?: ReviewDecision;
    metadata?: Record<string, unknown>;
  }): Promise<{
    provisionAsset?: ProvisionAssetRecord;
    activation?: TaCapabilityActivationHandoff;
    replay: TaCapabilityReplayHandoff;
    autoContinue?: ContinueTaProvisioningResult;
  }> {
    const provisionAsset = this.provisionerRuntime?.assetIndex.getCurrent(params.provisionRequest.provisionId);
    await this.#recordToolReviewDeliveryFromBundle(
      params.provisionBundle,
      params.reason,
      {
        requestId: params.accessRequest.requestId,
        sessionId: params.accessRequest.sessionId,
        runId: params.accessRequest.runId,
      },
    );
    const replay = await this.#stageProvisionReplay({
      accessRequest: params.accessRequest,
      provisionBundle: params.provisionBundle,
      intent: params.intent,
      source: params.source,
      options: params.options,
      reviewDecision: params.reviewDecision,
      metadata: params.metadata,
    });
    const autoPickup = this.#canAutoContinueProvisioning(params.provisionRequest.provisionId)
      ? await this.#pickupToolReviewerSessionHandoff(
        `tool-review:provision:${params.provisionRequest.provisionId}`,
      )
      : undefined;

    return {
      provisionAsset,
      activation: provisionAsset
        ? this.#createActivationHandoff({
          source: "provision_bundle",
          bundle: params.provisionBundle,
          asset: provisionAsset,
        })
        : undefined,
      replay,
      autoContinue: autoPickup?.status === "continued"
        ? autoPickup.continueResult
        : undefined,
    };
  }

  async resumeTaEnvelope(envelopeId: string): Promise<ResumeTaEnvelopeResult> {
    const envelope = this.#taResumeEnvelopes.get(envelopeId);
    if (!envelope) {
      return {
        status: "resume_envelope_not_found",
      };
    }

    if (envelope.source === "human_gate") {
      const gateId = typeof envelope.metadata?.gateId === "string" ? envelope.metadata.gateId : undefined;
      const gate = gateId ? this.#taHumanGates.get(gateId) : undefined;
      if (gate?.status === "approved" || gate?.status === "rejected") {
        this.#taResumeEnvelopes.delete(envelopeId);
        return {
          status: gate.status === "approved" ? "dispatched" : "denied",
          envelope,
          humanGate: this.#toHumanGateHandoff(gate, "review_decision"),
        };
      }
      return {
        status: "human_gate_pending",
        envelope,
        humanGate: gate ? this.#toHumanGateHandoff(gate, "review_decision") : undefined,
      };
    }

    if (envelope.source === "activation") {
      const provisionId = typeof envelope.metadata?.provisionId === "string"
        ? envelope.metadata.provisionId
        : undefined;
      if (!provisionId) {
        return {
          status: "resume_not_supported",
          envelope,
        };
      }
      const activationResult = await this.activateTaProvisionAsset(provisionId);
      if (activationResult.status !== "activation_asset_not_found") {
        this.#taResumeEnvelopes.delete(envelopeId);
      }
      return {
        status: activationResult.status,
        envelope,
        activation: activationResult.activation,
        activationResult,
      };
    }

    const replayId = typeof envelope.metadata?.replayId === "string"
      ? envelope.metadata.replayId
      : undefined;
    const replay = replayId ? this.#taPendingReplays.get(replayId) : undefined;
    if (!envelope.intentRequest || !replay) {
      return {
        status: "resume_not_supported",
        envelope,
        replay,
      };
    }

    return this.#resumeReplayEnvelope(envelope, replay);
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
    const checkpointId = randomUUID();
    this.checkpointStore.writeFastCheckpoint({
      checkpointId,
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
        mirroredFast: true,
      },
    });
    return this.checkpointStore.writeDurableCheckpoint({
      checkpointId,
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

  async recoverAndHydrateTapRuntime(runId: string) {
    const snapshot = await this.recoverTapRuntimeSnapshot(runId);
    if (snapshot) {
      this.hydrateRecoveredTapRuntimeSnapshot(snapshot);
    }
    return snapshot;
  }

  async continueRecoveredTapRuntime(runId: string): Promise<ContinueRecoveredTapRuntimeResult> {
    const provisionIds = [...new Set(this.listTaResumeEnvelopes()
      .filter((envelope) => envelope.source === "replay" && envelope.runId === runId)
      .map((envelope) =>
        typeof envelope.metadata?.provisionId === "string" ? envelope.metadata.provisionId : undefined)
      .filter((provisionId): provisionId is string => Boolean(provisionId)))];

    const provisionResults: ContinueRecoveredTapProvisionResult[] = [];
    for (const provisionId of provisionIds) {
      const resumableSessions = this.listResumableTmaSessions()
        .filter((session) => session.provisionId === provisionId);
      const resumedTmaSessionIds: string[] = [];
      const resumedBundleStatuses: Array<ProvisionArtifactBundle["status"]> = [];

      for (const session of resumableSessions) {
        const resumedBundle = await this.resumeTmaSession(session.sessionId);
        resumedTmaSessionIds.push(session.sessionId);
        if (resumedBundle) {
          resumedBundleStatuses.push(resumedBundle.status);
        }
      }

      const hasReplayBacklog = this.#findReplayEnvelopeByProvisionId(provisionId) !== undefined
        || this.#findPendingReplayByProvisionId(provisionId) !== undefined;
      if (!hasReplayBacklog) {
        provisionResults.push({
          provisionId,
          resumedTmaSessionIds,
          resumedBundleStatuses,
          skippedReason: "replay_not_staged",
        });
        continue;
      }

      provisionResults.push({
        provisionId,
        resumedTmaSessionIds,
        resumedBundleStatuses,
        continueResult: await this.continueTaProvisioning(provisionId),
      });
    }

    return {
      runId,
      provisionResults,
    };
  }

  createTapRuntimeSnapshot(): TapPoolRuntimeSnapshot {
    return createTapPoolRuntimeSnapshot({
      humanGates: [...this.listTaHumanGates()],
      humanGateContexts: [...this.#taHumanGateContexts.entries()].map(([gateId, context]) => ({
        gateId,
        intent: context.intent,
        accessRequest: context.accessRequest,
        reviewDecision: context.reviewDecision,
        options: context.options,
      })),
      humanGateEvents: [...this.#taHumanGateEvents.values()].flat(),
      pendingReplays: [...this.listTaPendingReplays()],
      activationAttempts: [...this.listTaActivationAttempts()],
      resumeEnvelopes: this.listTaResumeEnvelopes(),
      reviewerDurableSnapshot: this.reviewerRuntime?.exportDurableSnapshot(),
      toolReviewerSessions: this.toolReviewerRuntime?.createSnapshots(),
      provisionerDurableSnapshot: this.provisionerRuntime?.serializeDurableState(),
      tmaSessions: this.provisionerRuntime?.listTmaSessions(),
      agentRecords: this.listTapAgentRecords(),
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

  hydrateRecoveredTapRuntimeSnapshot(snapshot: TapPoolRuntimeSnapshot): void {
    const hydrated = hydrateRecoveredTapRuntimeState(snapshot);
    this.#taHumanGates.clear();
    for (const [gateId, gate] of hydrated.humanGates) {
      this.#taHumanGates.set(gateId, gate);
    }
    this.#taHumanGateContexts.clear();
    for (const [gateId, context] of hydrated.humanGateContexts) {
      if (!this.sessionManager.loadSessionHeader(context.accessRequest.sessionId)) {
        this.sessionManager.createSession({
          sessionId: context.accessRequest.sessionId,
          activeRunId: context.accessRequest.runId,
          runIds: [context.accessRequest.runId],
          status: "active",
        });
      }
      this.#taHumanGateContexts.set(gateId, {
        intent: context.intent,
        accessRequest: context.accessRequest,
        reviewDecision: context.reviewDecision,
        options: context.options,
      });
      this.taControlPlaneGateway?.restoreRequest(context.accessRequest);
      this.taControlPlaneGateway?.restoreDecision(context.reviewDecision);
    }
    this.#taHumanGateEvents.clear();
    for (const [gateId, events] of hydrated.humanGateEvents) {
      this.#taHumanGateEvents.set(gateId, events);
    }
    this.#taPendingReplays.clear();
    for (const [replayId, replay] of hydrated.pendingReplays) {
      this.#taPendingReplays.set(replayId, replay);
    }
    this.#taActivationAttempts.clear();
    for (const [attemptId, attempt] of hydrated.activationAttempts) {
      this.#taActivationAttempts.set(attemptId, attempt);
    }
    this.#taResumeEnvelopes.clear();
    for (const [envelopeId, envelope] of hydrated.resumeEnvelopes) {
      if (!this.sessionManager.loadSessionHeader(envelope.sessionId)) {
        this.sessionManager.createSession({
          sessionId: envelope.sessionId,
          activeRunId: envelope.runId,
          runIds: [envelope.runId],
          status: "active",
        });
      }
      this.#taResumeEnvelopes.set(envelopeId, envelope);
    }
    this.reviewerRuntime?.hydrateDurableSnapshot(hydrated.reviewerDurableSnapshot);
    this.toolReviewerRuntime?.hydrateSnapshots(hydrated.toolReviewerSessions);
    if (hydrated.provisionerDurableSnapshot) {
      this.provisionerRuntime?.restoreDurableState(hydrated.provisionerDurableSnapshot);
    }
    this.#tapAgentRecords.clear();
    for (const [recordId, record] of hydrated.agentRecords) {
      this.#tapAgentRecords.set(recordId, record);
    }
  }

  createTapGovernanceSnapshot(): TapGovernanceSnapshot {
    return createTapGovernanceSnapshot({
      ...this.createTapRuntimeSnapshot(),
      metadata: {
        source: "agent-core-runtime",
      },
    });
  }

  hasPendingTapGovernanceWork(): boolean {
    return hasPendingTapGovernanceWork(this.createTapGovernanceSnapshot());
  }

  createTapGovernanceObject(
    input: Omit<CreateTapGovernanceObjectInput, "profile"> = {},
  ): TapGovernanceObject {
    return createTapGovernanceObject({
      ...input,
      profile: this.taControlPlaneGateway?.profile,
    });
  }

  createTapTaskGovernance(input: CreateTapTaskGovernanceInput): TapGovernanceObject {
    return instantiateTapGovernanceObject({
      governance: this.createTapGovernanceObject(),
      taskId: input.taskId,
      requestedMode: input.requestedMode,
      userOverride: input.userOverride,
    });
  }

  createTapUserSurfaceSnapshot(
    input: Omit<CreateTapGovernanceObjectInput, "profile"> = {},
  ): TapUserSurfaceSnapshot {
    return createTapUserSurfaceSnapshot({
      governance: this.createTapGovernanceObject(input),
      governanceSnapshot: this.createTapGovernanceSnapshot(),
    });
  }

  createTapCmpMpReadyChecklist(): TapCmpMpReadyChecklist {
    return createTapCmpMpReadyChecklist({
      reviewerContext: createReviewContextApertureSnapshot({
        userIntentSummary: "TAP reviewer section intake readiness snapshot.",
        riskSummary: {
          requestedAction: "review cmp/mp section readiness",
          riskLevel: "normal",
        },
        sections: [
          {
            sectionId: "reviewer.default",
            title: "Reviewer Default Section",
            summary: "Reviewer default aperture is available for future CMP/MP registry hydration.",
            status: "ready",
            source: "agent-core-runtime",
            freshness: "fresh",
            trustLevel: "derived",
          },
        ],
      }),
      provisionContext: createProvisionContextApertureSnapshot({
        requestedCapabilityKey: "tap.checklist",
        reviewerInstructions: "Inspect provision section readiness only.",
        sections: [
          {
            sectionId: "provision.default",
            title: "Provision Default Section",
            summary: "Provision/TMA default aperture is available for future CMP/MP registry hydration.",
            status: "ready",
            source: "agent-core-runtime",
            freshness: "fresh",
            trustLevel: "derived",
          },
        ],
      }),
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
    await this.#recordToolReviewActivation({
      provisionId,
      capabilityKey: currentAsset?.capabilityKey ?? asset.capabilityKey,
      activationSpec: currentAsset?.activation.spec ?? asset.activation.spec,
      attempt: activationResult.attempt,
      receipt: activationResult.status === "activated" ? activationResult.receipt : undefined,
      failure: activationResult.status === "failed" ? activationResult.failure : undefined,
      requestId: relatedReplay?.requestId,
      sessionId,
      runId,
      reason: activationResult.status === "activated"
        ? `Activation completed for ${currentAsset?.capabilityKey ?? asset.capabilityKey}.`
        : `Activation failed for ${currentAsset?.capabilityKey ?? asset.capabilityKey}.`,
    });
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

  async applyTaCapabilityLifecycle(
    input: ApplyTaCapabilityLifecycleInput,
  ): Promise<ApplyTaCapabilityLifecycleResult> {
    const createdAt = new Date().toISOString();
    try {
      switch (input.lifecycleAction) {
        case "register":
          if (!input.manifest || !input.adapter) {
            throw new Error("Lifecycle register requires manifest and adapter.");
          }
          this.capabilityPool.register(input.manifest, input.adapter);
          break;
        case "replace":
          if (!input.bindingId || !input.manifest || !input.adapter) {
            throw new Error("Lifecycle replace requires bindingId, manifest, and adapter.");
          }
          this.capabilityPool.replace(input.bindingId, input.manifest, input.adapter);
          break;
        case "suspend":
          if (!input.bindingId) {
            throw new Error("Lifecycle suspend requires bindingId.");
          }
          this.capabilityPool.suspend(input.bindingId);
          break;
        case "resume":
          if (!input.bindingId) {
            throw new Error("Lifecycle resume requires bindingId.");
          }
          this.capabilityPool.resume(input.bindingId);
          break;
        case "unregister":
          if (!input.bindingId) {
            throw new Error("Lifecycle unregister requires bindingId.");
          }
          this.capabilityPool.unregister(input.bindingId);
          break;
      }
      const binding = input.bindingId
        ? this.capabilityPool.listBindings().find((entry) => entry.bindingId === input.bindingId)
        : undefined;
      await this.#recordToolReviewLifecycle({
        capabilityKey: input.capabilityKey,
        lifecycleAction: input.lifecycleAction,
        targetPool: input.targetPool,
        binding,
        accessRequest: input.accessRequest,
        reviewDecision: input.reviewDecision,
        reason: input.reason ?? `Lifecycle ${input.lifecycleAction} applied for ${input.capabilityKey}.`,
        createdAt,
      });
      const continuedProvisioning = input.lifecycleAction === "register"
        || input.lifecycleAction === "replace"
        || input.lifecycleAction === "resume"
        ? await this.#continuePendingProvisioningForCapability(input.capabilityKey)
        : [];
      return {
        status: "applied",
        binding,
        continuedProvisioning,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code = error instanceof Error && "code" in error && typeof error.code === "string"
        ? error.code
        : "ta_lifecycle_blocked";
      await this.#recordToolReviewLifecycle({
        capabilityKey: input.capabilityKey,
        lifecycleAction: input.lifecycleAction,
        targetPool: input.targetPool,
        binding: input.bindingId
          ? this.capabilityPool.listBindings().find((entry) => entry.bindingId === input.bindingId)
          : undefined,
        accessRequest: input.accessRequest,
        reviewDecision: input.reviewDecision,
        reason: input.reason ?? `Lifecycle ${input.lifecycleAction} failed for ${input.capabilityKey}.`,
        createdAt,
        failure: {
          code,
          message,
        },
      });
      return {
        status: "blocked",
        error: {
          code,
          message,
        },
      };
    }
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

  listCmpRequestRecords(): readonly CmpRequestRecord[] {
    return [...this.#cmpRequests.values()];
  }

  listCmpSectionRecords(): readonly CmpSectionRecord[] {
    return [...this.#cmpSectionRecords.values()];
  }

  listCmpSnapshotRecords(): readonly CmpSnapshotRecord[] {
    return [...this.#cmpSnapshotRecords.values()];
  }

  listCmpPackageRecords(): readonly CmpPackageRecord[] {
    return [...this.#cmpPackageRecords.values()];
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

  getCmpFiveAgentRuntimeSnapshot(agentId?: string): CmpFiveAgentRuntimeSnapshot {
    return this.#cmpFiveAgentRuntime.createSnapshot(agentId);
  }

  getCmpFiveAgentRuntimeSummary(agentId?: string): CmpFiveAgentSummary {
    return this.#cmpFiveAgentRuntime.createSummary(agentId);
  }

  async captureCmpIcmaWithLlm(input: CmpIcmaIngestInput, options: CmpIcmaLiveOptions = {}) {
    return this.#cmpFiveAgentRuntime.captureIcmaWithLlm(input, options);
  }

  async advanceCmpIteratorWithLlm(input: CmpIteratorAdvanceInput, options: CmpIteratorLiveOptions = {}) {
    return this.#cmpFiveAgentRuntime.advanceIteratorWithLlm(input, options);
  }

  async evaluateCmpCheckerWithLlm(input: CmpCheckerEvaluateInput, options: CmpCheckerLiveOptions = {}) {
    return this.#cmpFiveAgentRuntime.evaluateCheckerWithLlm(input, options);
  }

  async materializeCmpDbAgentWithLlm(
    input: CmpDbAgentMaterializeInput,
    options: CmpDbAgentMaterializeLiveOptions = {},
  ) {
    return this.#cmpFiveAgentRuntime.materializeDbAgentWithLlm(input, options);
  }

  async servePassiveCmpDbAgentWithLlm(
    input: CmpDbAgentPassiveInput,
    options: CmpDbAgentPassiveLiveOptions = {},
  ) {
    return this.#cmpFiveAgentRuntime.servePassiveDbAgentWithLlm(input, options);
  }

  async dispatchCmpDispatcherWithLlm(
    input: CmpDispatcherDispatchInput,
    options: CmpDispatcherLiveOptions = {},
  ) {
    return this.#cmpFiveAgentRuntime.dispatchDispatcherWithLlm(input, options);
  }

  async deliverPassiveCmpDispatcherWithLlm(
    input: CmpDispatcherPassiveReturnInput,
    options: CmpDispatcherPassiveLiveOptions = {},
  ) {
    return this.#cmpFiveAgentRuntime.deliverDispatcherPassiveReturnWithLlm(input, options);
  }

  async runCmpFiveAgentActiveLiveLoop(input: CmpFiveAgentActiveLiveRunInput) {
    return this.#cmpFiveAgentRuntime.runActiveLoopWithLlm(input);
  }

  async runCmpFiveAgentPassiveLiveLoop(input: CmpFiveAgentPassiveLiveRunInput) {
    return this.#cmpFiveAgentRuntime.runPassiveLoopWithLlm(input);
  }

  resolveCmpFiveAgentCapabilityAccess(input: {
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
  }): CmpFiveAgentCapabilityAccessResolution {
    const profile = createCmpRoleTapProfile(input.role);
    const gateway = new TaControlPlaneGateway({ profile });
    const resolution: ResolveCapabilityAccessResult = gateway.resolveCapabilityAccess({
      sessionId: input.sessionId,
      runId: input.runId,
      agentId: input.agentId,
      capabilityKey: input.capabilityKey,
      reason: input.reason,
      requestedTier: input.requestedTier,
      mode: input.mode,
      taskContext: input.taskContext,
      requestedScope: input.requestedScope,
      requestedDurationMs: input.requestedDurationMs,
      metadata: {
        cmpRole: input.role,
        ...(input.metadata ?? {}),
      },
    });
    return {
      role: input.role,
      profile,
      resolution,
    };
  }

  async dispatchCmpFiveAgentCapability(input: {
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
    cmpContext?: CmpFiveAgentTapBridgeContext;
    metadata?: Record<string, unknown>;
  }): Promise<DispatchCmpFiveAgentCapabilityResult> {
    const compiled = createCmpFiveAgentTapBridgeCompiled({
      role: input.role,
      sessionId: input.sessionId,
      runId: input.runId,
      agentId: input.agentId,
      capabilityKey: input.capabilityKey,
      reason: input.reason,
      capabilityInput: input.capabilityInput,
      priority: input.priority,
      timeoutMs: input.timeoutMs,
      requestedTier: input.requestedTier,
      mode: input.mode,
      taskContext: input.taskContext,
      requestedScope: input.requestedScope,
      requestedDurationMs: input.requestedDurationMs,
      cmpContext: input.cmpContext,
      metadata: input.metadata,
    });
    const dispatch = await this.dispatchCapabilityIntentViaTaPool(
      compiled.intent,
      compiled.dispatchOptions,
    );
    const lineage = this.#cmpLineages.get(input.agentId);
    if (lineage) {
      this.#recordCmpSyncEvent(createSyncEvent({
        syncEventId: randomUUID(),
        agentId: input.agentId,
        channel: "db",
        direction: "local",
        objectRef: dispatch.accessRequest?.requestId
          ?? dispatch.reviewDecision?.requestId
          ?? compiled.intent.request.requestId,
        createdAt: new Date().toISOString(),
        metadata: {
          source: "cmp-five-agent-tap-bridge",
          cmpRole: input.role,
          capabilityKey: input.capabilityKey,
          tapProfileId: compiled.profile.profileId,
          dispatchStatus: dispatch.status,
          grantId: dispatch.grant?.grantId,
          reviewDecisionId: dispatch.reviewDecision?.decisionId,
          provisionId: dispatch.provisionRequest?.provisionId,
          bridgeMetadata: compiled.bridgeMetadata,
        },
      }));
    }
    return {
      role: input.role,
      profile: compiled.profile,
      intent: compiled.intent,
      bridgeMetadata: compiled.bridgeMetadata,
      dispatch,
    };
  }

  reviewCmpPeerExchangeApproval(input: {
    approvalId: string;
    actorAgentId: string;
    decision: "approved" | "rejected";
    note?: string;
    decidedAt?: string;
  }) {
    const approval = this.#cmpFiveAgentRuntime.dispatcher.approvePeerExchange({
      approvalId: input.approvalId,
      actorAgentId: input.actorAgentId,
      decision: input.decision,
      note: input.note,
      decidedAt: input.decidedAt ?? new Date().toISOString(),
    });

    for (const [dispatchId, receipt] of this.#cmpDispatchReceipts.entries()) {
      if (receipt.metadata?.cmpPeerExchangeApprovalId !== approval.approvalId) {
        continue;
      }
      this.#cmpDispatchReceipts.set(dispatchId, createDispatchReceipt({
        ...receipt,
        metadata: {
          ...(receipt.metadata ?? {}),
          cmpPeerExchangeApprovalStatus: approval.status,
          cmpPeerExchangeApprovedAt: approval.approvedAt,
          cmpPeerExchangeApprovedBy: approval.approvedByAgentId,
        },
      }));
    }

    return approval;
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
      requests: [...this.#cmpRequests.values()],
      sectionRecords: [...this.#cmpSectionRecords.values()],
      snapshotRecords: [...this.#cmpSnapshotRecords.values()],
      promotedProjections: [...this.#cmpPromotedProjections.values()],
      packageRecords: [...this.#cmpPackageRecords.values()],
      contextPackages: [...this.#cmpPackages.values()],
      dispatchReceipts: [...this.#cmpDispatchReceipts.values()],
      syncEvents: [...this.#cmpSyncEvents.values()],
      infraState: this.#cmpRuntimeInfraState,
      metadata: {
        cmpFiveAgentSnapshot: this.#cmpFiveAgentRuntime.createSnapshot(),
      },
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
    this.#cmpRequests.clear();
    this.#cmpSectionRecords.clear();
    this.#cmpSnapshotRecords.clear();
    this.#cmpPackageRecords.clear();
    this.#cmpDispatchReceipts.clear();
    this.#cmpSyncEvents.clear();
    this.#cmpProjectInfraBootstrapReceipts.clear();
    this.#cmpFiveAgentRuntime.recover();
    this.#cmpRuntimeInfraState = createCmpRuntimeInfraState();
    this.#cmpDbRuntimeSync.projections.clear();
    this.#cmpDbRuntimeSync.packages.clear();
    this.#cmpDbRuntimeSync.deliveries.clear();

    const recovery = hydrateCmpRuntimeSnapshotWithReconciliation({
      snapshot,
      projects: snapshot.infraState?.projects,
    });
    const hydrated = recovery.hydrated;
    this.#cmpFiveAgentRuntime.recover(
      snapshot.metadata?.cmpFiveAgentSnapshot as CmpFiveAgentRuntimeSnapshot | undefined,
    );

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
    for (const request of hydrated.requests.values()) {
      this.#cmpRequests.set(request.requestId, request);
    }
    for (const sectionRecord of hydrated.sectionRecords.values()) {
      this.#cmpSectionRecords.set(sectionRecord.sectionId, sectionRecord);
    }
    for (const snapshotRecord of hydrated.snapshotRecords.values()) {
      this.#cmpSnapshotRecords.set(snapshotRecord.snapshotId, snapshotRecord);
    }
    for (const packageRecord of hydrated.packageRecords.values()) {
      this.#cmpPackageRecords.set(packageRecord.packageId, packageRecord);
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
    const ingestRequestId = `${lineage.agentId}:ingest:${createdAt}`;
    const enrichedIngest: IngestRuntimeContextInput = {
      ...normalized,
      metadata: {
        ...(normalized.metadata ?? {}),
        cmpRequestId: ingestRequestId,
      },
    };
    const icmaCapture = this.#cmpFiveAgentRuntime.icma.capture({
      ingest: enrichedIngest,
      createdAt,
      loopId: randomUUID(),
    });
    const sectionIngress = createCmpSectionIngressRecordFromIngress({
      ingest: enrichedIngest,
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
    this.#cmpRequests.set(ingestRequestId, createCmpRequestRecordFromIngest({
      requestId: ingestRequestId,
      ingest: enrichedIngest,
      createdAt,
      metadata: {
        ingressId: ingress.ingressId,
        source: "cmp-runtime-object-model-ingest",
      },
    }));
    const rawSectionRecordIdsBySectionId = new Map<string, string>();
    const preSectionRecordIdsBySectionId = new Map<string, string>();
    for (const section of sectionIngress.sections) {
      const rawRecordId = `${section.id}:raw`;
      const preRecordId = `${section.id}:pre`;
      rawSectionRecordIdsBySectionId.set(section.id, rawRecordId);
      preSectionRecordIdsBySectionId.set(section.id, preRecordId);
      this.#cmpSectionRecords.set(rawRecordId, createCmpSectionRecordFromSection({
        section,
        lifecycle: "raw",
        version: 1,
        sourceAnchors: section.payloadRefs,
        metadata: {
          source: "cmp-runtime-object-model-ingest",
          ingressId: ingress.ingressId,
        },
      }));
      this.#cmpSectionRecords.set(preRecordId, createCmpSectionRecord({
        ...createCmpSectionRecordFromSection({
          section,
          lifecycle: "pre",
          version: 2,
          parentSectionId: rawRecordId,
          ancestorSectionIds: [rawRecordId],
          sourceAnchors: section.payloadRefs,
        }),
        sectionId: preRecordId,
        metadata: {
          source: "cmp-runtime-object-model-ingest",
          ingressId: ingress.ingressId,
          cmpIcmaRecordId: icmaCapture.loop.loopId,
          cmpIntentChunkIds: icmaCapture.loop.chunkIds,
          cmpFragmentIds: icmaCapture.loop.fragmentIds,
        },
      }));
    }

    for (const loweredRecord of sectionLowering.lowered) {
      if (!loweredRecord.storedSection) {
        continue;
      }
      const preRecordId = preSectionRecordIdsBySectionId.get(loweredRecord.section.id);
      const persistedRecord = createCmpSectionRecordFromStoredSection({
        storedSection: loweredRecord.storedSection,
        sourceSection: loweredRecord.section,
        lifecycle: "persisted",
        version: 3,
        parentSectionId: preRecordId,
        ancestorSectionIds: preRecordId ? [preRecordId] : [],
        metadata: {
          source: "cmp-runtime-object-model-ingest",
          ingressId: ingress.ingressId,
          ruleEvaluation: loweredRecord.evaluation,
        },
      });
      this.#cmpSectionRecords.set(persistedRecord.sectionId, persistedRecord);
    }

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
          cmpIcmaRecordId: icmaCapture.loop.loopId,
          cmpIcmaChunkIds: icmaCapture.loop.chunkIds,
          cmpIcmaFragmentIds: icmaCapture.loop.fragmentIds,
          cmpSectionId: loweredSection?.section.id,
          cmpRawSectionRecordId: loweredSection?.section.id
            ? rawSectionRecordIdsBySectionId.get(loweredSection.section.id)
            : undefined,
          cmpPreSectionRecordId: loweredSection?.section.id
            ? preSectionRecordIdsBySectionId.get(loweredSection.section.id)
            : undefined,
          cmpStoredSectionId: loweredSection?.storedSection?.id,
          cmpStoredSections: loweredSection?.storedSection ? [loweredSection.storedSection] : [],
          cmpSectionRuleEvaluation: loweredSection?.evaluation,
          ...(material.metadata ?? {}),
        },
      });
      this.#storeCmpEvent(event);
      return event;
    });
    const emittedIcma = this.#cmpFiveAgentRuntime.icma.emit({
      recordId: icmaCapture.loop.loopId,
      eventIds: acceptedEvents.map((event) => event.eventId),
      emittedAt: createdAt,
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
        cmpFiveAgent: {
          icmaRecordId: emittedIcma.loopId,
          chunkIds: emittedIcma.chunkIds,
          fragmentIds: emittedIcma.fragmentIds,
        },
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
    const preSectionRecordIds = [...new Set(
      normalized.eventIds
        .map((eventId) => this.#cmpEvents.get(eventId)?.metadata?.cmpPreSectionRecordId)
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
    )];
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
        ...(preSectionRecordIds.length > 0 ? { cmpPreSectionRecordIds: preSectionRecordIds } : {}),
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
    const iteratorRecord = this.#cmpFiveAgentRuntime.iteratorChecker.advanceIterator({
      agentId: delta.agentId,
      deltaId: delta.deltaId,
      candidateId: gitSync.candidate.candidateId,
      branchRef: gitSync.candidate.branchRef.fullRef,
      commitRef: gitSync.candidate.commitSha,
      reviewRef: `refs/cmp/review/${gitSync.candidate.candidateId}`,
      createdAt: gitSync.candidate.createdAt,
      metadata: {
        gitSyncIntent: gitSync.binding.syncIntent,
        sourceSectionIds: preSectionRecordIds,
      },
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
        cmpIteratorRecordId: iteratorRecord.loopId,
        cmpIteratorReviewRef: iteratorRecord.reviewRef,
        cmpIteratorMinimumReviewUnit: iteratorRecord.metadata?.minimumReviewUnit,
      },
    });
    this.#cmpSnapshotCandidates.set(candidate.candidateId, candidate);

    const checkedRef = this.#cmpGitOrchestrator.markCandidateChecked({
      candidateId: candidate.candidateId,
      snapshotId: `${candidate.candidateId}:checked`,
      checkedAt: candidate.createdAt,
    });
    this.#cmpGitCheckedRefs.set(checkedRef.refId, checkedRef);
    const checkerRecord = this.#cmpFiveAgentRuntime.iteratorChecker.evaluateChecker({
      agentId: candidate.agentId,
      candidateId: candidate.candidateId,
      checkedSnapshotId: `${candidate.candidateId}:checked`,
      parentAgentId: lineage.parentAgentId,
      checkedAt: candidate.createdAt,
      suggestPromote: Boolean(lineage.parentAgentId && delta.syncIntent === "submit_to_parent"),
      metadata: {
        sourceSectionIds: preSectionRecordIds,
      },
    });
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

    let checked = createCheckedSnapshot({
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
    const checkedSectionRecordIds: string[] = [];
    for (const preSectionRecordId of preSectionRecordIds) {
      const preSection = this.#cmpSectionRecords.get(preSectionRecordId);
      if (!preSection) {
        continue;
      }
      const checkedSectionRecord = createCmpSectionRecord({
        ...preSection,
        sectionId: `${preSection.sectionId}:checked:${checked.snapshotId}`,
        version: Math.max(preSection.version + 1, 3),
        lifecycle: "checked",
        fidelity: "checked",
        updatedAt: checked.checkedAt,
        parentSectionId: preSection.sectionId,
        ancestorSectionIds: [...new Set([preSection.sectionId, ...preSection.ancestorSectionIds])],
        metadata: {
          ...(preSection.metadata ?? {}),
          source: "cmp-runtime-object-model-checked",
          candidateId: candidate.candidateId,
          checkedSnapshotId: checked.snapshotId,
          cmpCheckerLoopId: checkerRecord.checkerRecord.loopId,
          reviewRef: iteratorRecord.reviewRef,
        },
      });
      this.#cmpSectionRecords.set(checkedSectionRecord.sectionId, checkedSectionRecord);
      checkedSectionRecordIds.push(checkedSectionRecord.sectionId);
    }
    checked = createCheckedSnapshot({
      ...checked,
      metadata: {
        ...(checked.metadata ?? {}),
        cmpCheckedSectionRecordIds: checkedSectionRecordIds,
        ...createCheckerCheckedSnapshotMetadata({
          snapshot: {
            snapshotId: `${candidate.candidateId}:checked`,
            agentId: delta.agentId,
            lineageRef: this.#createCmpLineageRef(lineage),
            branchRef: candidate.branchRef,
            commitRef: candidate.commitRef,
            checkedAt: candidate.createdAt,
            qualityLabel: "usable",
            promotable: delta.syncIntent !== "local_record",
          },
          result: checkerRecord,
        }),
      },
    });
    this.#cmpCheckedSnapshots.set(checked.snapshotId, checked);
    this.#cmpSnapshotRecords.set(checked.snapshotId, createCmpSnapshotRecordFromCheckedSnapshot({
      snapshot: checked,
      projectId: lineage.projectId,
      sourceSectionIds: checkedSectionRecordIds,
      stage: "checked",
      metadata: {
        source: "cmp-runtime-object-model-checked",
        candidateId: candidate.candidateId,
      },
    }));
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
    const parentPromoteReview = checkerRecord.promoteRequest
      ? this.#cmpFiveAgentRuntime.dbagent.reviewPromote({
        sourceAgentId: checkerRecord.promoteRequest.sourceAgentId,
        parentAgentId: checkerRecord.promoteRequest.targetParentAgentId,
        candidateId: checkerRecord.promoteRequest.candidateId,
        checkedSnapshotId: checkerRecord.promoteRequest.checkedSnapshotId,
        reviewId: checkerRecord.promoteRequest.reviewId,
        createdAt: checkerRecord.promoteRequest.createdAt,
      })
      : undefined;

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
        cmpFiveAgent: {
          iteratorRecordId: iteratorRecord.loopId,
          checkerRecordId: checkerRecord.checkerRecord.loopId,
          promoteReviewId: parentPromoteReview?.reviewId,
        },
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
    const projectId = String(snapshot.metadata?.projectId ?? "unknown-project");
    const materializeRequestId = randomUUID();
    const checkedSnapshotRecord = this.#cmpSnapshotRecords.get(snapshot.snapshotId);
    const sourceSectionRecordIds = checkedSnapshotRecord?.sourceSectionIds ?? [];
    this.#cmpRequests.set(materializeRequestId, createCmpRequestRecord({
      requestId: materializeRequestId,
      projectId,
      requesterAgentId: normalized.agentId,
      requestKind: "materialize_package",
      status: "received",
      sourceAnchors: [snapshot.snapshotId, normalized.targetAgentId, normalized.packageKind],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        targetAgentId: normalized.targetAgentId,
        requestedPackageKind: normalized.packageKind,
        sourceSnapshotId: snapshot.snapshotId,
        sourceSectionRecordIds,
      },
    }));

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
    const dbagentMaterialized = this.#cmpFiveAgentRuntime.dbagent.materialize({
      checkedSnapshot: snapshot,
      projectionId: projection.projectionId,
      contextPackage,
      createdAt: contextPackage.createdAt,
      loopId: randomUUID(),
      metadata: {
        sourceRequestId: materializeRequestId,
        sourceSectionIds: sourceSectionRecordIds,
      },
    });
    const enrichedContextPackage = createContextPackage({
      ...contextPackage,
      metadata: {
        ...(contextPackage.metadata ?? {}),
        cmpDbAgentRecordId: dbagentMaterialized.loop.loopId,
        cmpPackageFamilyId: dbagentMaterialized.family.familyId,
        cmpTimelinePackageId: dbagentMaterialized.family.timelinePackageId,
        cmpTaskSnapshotIds: dbagentMaterialized.taskSnapshots.map((taskSnapshot) => taskSnapshot.snapshotId),
        sourceRequestId: materializeRequestId,
      },
    });
    this.#cmpPackages.set(enrichedContextPackage.packageId, enrichedContextPackage);
    const persistedSectionRecordIds: string[] = [];
    for (const sourceSectionRecordId of sourceSectionRecordIds) {
      const sourceSectionRecord = this.#cmpSectionRecords.get(sourceSectionRecordId);
      if (!sourceSectionRecord) {
        continue;
      }
      const persistedSectionRecordId = `${sourceSectionRecord.sectionId}:persisted:${enrichedContextPackage.packageId}`;
      const persistedSectionRecord = createCmpSectionRecord({
        ...sourceSectionRecord,
        sectionId: persistedSectionRecordId,
        version: sourceSectionRecord.version + 1,
        lifecycle: "persisted",
        updatedAt: enrichedContextPackage.createdAt,
        parentSectionId: sourceSectionRecord.sectionId,
        ancestorSectionIds: [...new Set([sourceSectionRecord.sectionId, ...sourceSectionRecord.ancestorSectionIds])],
        metadata: {
          ...(sourceSectionRecord.metadata ?? {}),
          source: "cmp-runtime-object-model-persisted",
          packageId: enrichedContextPackage.packageId,
          cmpDbAgentRecordId: dbagentMaterialized.loop.loopId,
          packageRef: enrichedContextPackage.packageRef,
          persistedStorageRef: storedSection?.storageRef,
        },
      });
      this.#cmpSectionRecords.set(persistedSectionRecordId, persistedSectionRecord);
      persistedSectionRecordIds.push(persistedSectionRecordId);
    }
    this.#cmpSnapshotRecords.set(
      `${snapshot.snapshotId}:persisted:${enrichedContextPackage.packageId}`,
      createCmpSnapshotRecord({
        snapshotId: `${snapshot.snapshotId}:persisted:${enrichedContextPackage.packageId}`,
        projectId,
        agentId: normalized.agentId,
        stage: "persisted",
        sourceSectionIds: persistedSectionRecordIds.length > 0 ? persistedSectionRecordIds : sourceSectionRecordIds,
        sourceAnchors: [snapshot.snapshotId, enrichedContextPackage.packageId, enrichedContextPackage.packageRef],
        branchRef: snapshot.branchRef,
        commitRef: snapshot.commitRef,
        createdAt: enrichedContextPackage.createdAt,
        updatedAt: enrichedContextPackage.createdAt,
        metadata: {
          source: "cmp-runtime-object-model-materialize",
          sourceRequestId: materializeRequestId,
        },
      }),
    );
    this.#cmpPackageRecords.set(
      enrichedContextPackage.packageId,
      createCmpPackageRecordFromContextPackage({
        contextPackage: enrichedContextPackage,
        projectId,
        sourceSnapshotId: snapshot.snapshotId,
        sourceSectionIds: persistedSectionRecordIds.length > 0 ? persistedSectionRecordIds : sourceSectionRecordIds,
        sourceAnchors: [enrichedContextPackage.packageRef, snapshot.snapshotId],
        status: "materialized",
        metadata: {
          cmpPackageFamilyId: dbagentMaterialized.family.familyId,
          sourceRequestId: materializeRequestId,
        },
      }),
    );
    const materializeRequest = this.#cmpRequests.get(materializeRequestId);
    if (materializeRequest) {
      this.#cmpRequests.set(
        materializeRequestId,
        advanceCmpRequestRecordStatus({
          record: materializeRequest,
          nextStatus: "served",
          updatedAt: enrichedContextPackage.createdAt,
          metadata: {
            ...(materializeRequest.metadata ?? {}),
            source: "cmp-runtime-object-model-materialize",
            targetAgentId: normalized.targetAgentId,
            requestedPackageKind: normalized.packageKind,
            sourceSnapshotId: snapshot.snapshotId,
            sourceSectionRecordIds: persistedSectionRecordIds.length > 0 ? persistedSectionRecordIds : sourceSectionRecordIds,
            servedPackageId: enrichedContextPackage.packageId,
          },
        }),
      );
    }
    syncCmpDbPackageFromContextPackage({
      state: this.#cmpDbRuntimeSync,
      contextPackage: enrichedContextPackage,
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
      objectRef: enrichedContextPackage.packageId,
      createdAt: enrichedContextPackage.createdAt,
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
      const packageRecord = this.#cmpDbRuntimeSync.packages.get(enrichedContextPackage.packageId);
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
            objectRef: enrichedContextPackage.packageId,
            createdAt: enrichedContextPackage.createdAt,
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
            objectRef: enrichedContextPackage.packageId,
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
      contextPackage: enrichedContextPackage,
    };
  }

  dispatchContextPackage(input: DispatchContextPackageInput): DispatchContextPackageResult {
    const normalized = createDispatchContextPackageInput(input);
    const contextPackage = this.#cmpPackages.get(normalized.packageId);
    if (!contextPackage) {
      throw new Error(`CMP context package ${normalized.packageId} was not found.`);
    }
    const projectId = String(this.#requireCmpLineage(normalized.sourceAgentId).projectId);
    const dispatchRequestId = randomUUID();
    const sourcePackageRecord = this.#cmpPackageRecords.get(contextPackage.packageId);
    this.#cmpRequests.set(dispatchRequestId, createCmpRequestRecord({
      requestId: dispatchRequestId,
      projectId,
      requesterAgentId: normalized.sourceAgentId,
      requestKind: "dispatch_package",
      status: "received",
      sourceAnchors: [contextPackage.packageId, normalized.targetAgentId, normalized.targetKind],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        targetAgentId: normalized.targetAgentId,
        targetKind: normalized.targetKind,
        requestedPackageKind: contextPackage.packageKind,
        sourceSnapshotId: sourcePackageRecord?.sourceSnapshotId,
        sourceSectionRecordIds: sourcePackageRecord?.sourceSectionIds,
      },
    }));

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
    const dispatcherRecorded = this.#cmpFiveAgentRuntime.dispatcher.dispatch({
      contextPackage,
      dispatch: {
        ...normalized,
        metadata: {
          ...(normalized.metadata ?? {}),
          sourceRequestId: dispatchRequestId,
          sourceSnapshotId: sourcePackageRecord?.sourceSnapshotId,
        },
      },
      receipt,
      createdAt,
      loopId: randomUUID(),
    });
    const enrichedReceipt = createDispatchReceipt({
      ...receipt,
      metadata: {
        ...(receipt.metadata ?? {}),
        cmpDispatcherRecordId: dispatcherRecorded.loop.loopId,
        cmpDispatcherPackageMode: dispatcherRecorded.loop.packageMode,
        cmpDispatcherBundle: dispatcherRecorded.loop.bundle,
        cmpPeerExchangeApprovalId: dispatcherRecorded.peerApproval?.approvalId,
        cmpPeerExchangeApprovalStatus: dispatcherRecorded.peerApproval?.status,
      },
    });
    this.#cmpDispatchReceipts.set(enrichedReceipt.dispatchId, enrichedReceipt);
    syncCmpDbDeliveryFromDispatchReceipt({
      state: this.#cmpDbRuntimeSync,
      receipt: enrichedReceipt,
      metadata: {
        source: "cmp-runtime-dispatch",
      },
    });

    this.#recordCmpSyncEvent(createSyncEvent({
      syncEventId: randomUUID(),
      agentId: normalized.sourceAgentId,
      channel: normalized.targetKind === "core_agent" ? "db" : "mq",
      direction: this.#mapDispatchTargetKindToDirection(normalized.targetKind),
      objectRef: enrichedReceipt.dispatchId,
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
      const deliveryRecord = this.#cmpDbRuntimeSync.deliveries.get(enrichedReceipt.dispatchId);
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
            objectRef: enrichedReceipt.dispatchId,
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
            objectRef: enrichedReceipt.dispatchId,
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
        dispatchId: enrichedReceipt.dispatchId,
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
          ...enrichedReceipt,
          metadata: {
            ...(enrichedReceipt.metadata ?? {}),
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
          objectRef: enrichedReceipt.dispatchId,
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
          objectRef: enrichedReceipt.dispatchId,
          createdAt: new Date().toISOString(),
          metadata: {
            source: "cmp-runtime-mq-lowering",
            error: error instanceof Error ? error.message : String(error),
          },
        }));
      });
    }

    const approvalDecision = normalized.targetKind === "peer"
      ? normalized.metadata?.cmpPeerExchangeDecision
      : undefined;
    const approvalActorId = normalized.targetKind === "peer"
      ? normalized.metadata?.cmpPeerExchangeActorAgentId
      : undefined;
    if (
      dispatcherRecorded.peerApproval
      && (approvalDecision === "approved" || approvalDecision === "rejected")
      && typeof approvalActorId === "string"
      && approvalActorId.trim()
    ) {
      this.reviewCmpPeerExchangeApproval({
        approvalId: dispatcherRecorded.peerApproval.approvalId,
        actorAgentId: approvalActorId,
        decision: approvalDecision,
        note: typeof normalized.metadata?.cmpPeerExchangeDecisionNote === "string"
          ? normalized.metadata.cmpPeerExchangeDecisionNote
          : undefined,
        decidedAt: createdAt,
      });
    }

    if (sourcePackageRecord) {
      this.#cmpPackageRecords.set(
        contextPackage.packageId,
        advanceCmpPackageRecordStatus({
          record: sourcePackageRecord,
          nextStatus: "dispatched",
          updatedAt: createdAt,
          metadata: {
            ...(sourcePackageRecord.metadata ?? {}),
            dispatchId: enrichedReceipt.dispatchId,
            dispatchTargetKind: normalized.targetKind,
          },
        }),
      );
    }
    const dispatchRequest = this.#cmpRequests.get(dispatchRequestId);
    if (dispatchRequest) {
      this.#cmpRequests.set(
        dispatchRequestId,
        advanceCmpRequestRecordStatus({
          record: dispatchRequest,
          nextStatus: "served",
          updatedAt: createdAt,
          metadata: {
            ...(dispatchRequest.metadata ?? {}),
            dispatchId: enrichedReceipt.dispatchId,
            servedPackageId: contextPackage.packageId,
          },
        }),
      );
    }

    return {
      status: "dispatched",
      receipt: enrichedReceipt,
    };
  }

  requestHistoricalContext(input: RequestHistoricalContextInput): RequestHistoricalContextResult {
    const normalized = createRequestHistoricalContextInput(input);
    const historyRequestId = randomUUID();
    this.#cmpRequests.set(historyRequestId, createCmpRequestRecord({
      requestId: historyRequestId,
      projectId: normalized.projectId,
      requesterAgentId: normalized.requesterAgentId,
      requestKind: "historical_context",
      status: "received",
      sourceAnchors: [
        normalized.reason,
        normalized.query.snapshotId ?? normalized.query.lineageRef ?? normalized.query.branchRef ?? normalized.projectId,
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        reason: normalized.reason,
        query: normalized.query,
      },
    }));
    const snapshot = this.#selectCmpHistoricalSnapshot(normalized);
    if (!snapshot) {
      const request = this.#cmpRequests.get(historyRequestId);
      if (request) {
        this.#cmpRequests.set(historyRequestId, advanceCmpRequestRecordStatus({
          record: request,
          nextStatus: "denied",
          updatedAt: new Date().toISOString(),
          metadata: {
            ...(request.metadata ?? {}),
            denialReason: "snapshot_not_found",
          },
        }));
      }
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
    const reinterventionGapSummary = typeof normalized.metadata?.cmpReinterventionGapSummary === "string"
      ? normalized.metadata.cmpReinterventionGapSummary.trim()
      : "";
    const reinterventionCurrentStateSummary = typeof normalized.metadata?.cmpCurrentStateSummary === "string"
      ? normalized.metadata.cmpCurrentStateSummary.trim()
      : "";
    const reinterventionRequest = requesterLineage.parentAgentId && reinterventionGapSummary && reinterventionCurrentStateSummary
      ? this.#cmpFiveAgentRuntime.dbagent.requestReintervention({
        requestId: randomUUID(),
        childAgentId: normalized.requesterAgentId,
        parentAgentId: requesterLineage.parentAgentId,
        gapSummary: reinterventionGapSummary,
        currentStateSummary: reinterventionCurrentStateSummary,
        currentPackageId: typeof normalized.metadata?.cmpCurrentPackageId === "string"
          ? normalized.metadata.cmpCurrentPackageId
          : undefined,
        createdAt: new Date().toISOString(),
        metadata: {
          source: "cmp-runtime-passive-reintervention",
          reason: normalized.reason,
        },
      })
      : undefined;
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

    const dbagentPassive = this.#cmpFiveAgentRuntime.dbagent.servePassive({
      loopId: randomUUID(),
      request: normalized,
      snapshot,
      contextPackage,
      createdAt: contextPackage.createdAt,
      metadata: {
        sourceRequestId: historyRequestId,
        sourceSectionIds: this.#cmpSnapshotRecords.get(snapshot.snapshotId)?.sourceSectionIds ?? [],
      },
    });
    const servedReintervention = reinterventionRequest
      ? this.#cmpFiveAgentRuntime.dbagent.serveReintervention({
        requestId: reinterventionRequest.requestId,
        servedPackageId: contextPackage.packageId,
        resolvedAt: contextPackage.createdAt,
        metadata: {
          packageFamilyId: dbagentPassive.family.familyId,
        },
      })
      : undefined;
    const dispatcherPassive = this.#cmpFiveAgentRuntime.dispatcher.deliverPassiveReturn({
      loopId: randomUUID(),
      request: normalized,
      contextPackage,
      createdAt: contextPackage.createdAt,
    });
    const enrichedContextPackage = createContextPackage({
      ...contextPackage,
      metadata: {
        ...(contextPackage.metadata ?? {}),
        cmpDbAgentRecordId: dbagentPassive.loop.loopId,
        cmpDispatcherRecordId: dispatcherPassive.loopId,
        cmpDispatcherBundle: dispatcherPassive.bundle,
        cmpPackageFamilyId: dbagentPassive.family.familyId,
        cmpTimelinePackageId: dbagentPassive.family.timelinePackageId,
        cmpTaskSnapshotIds: dbagentPassive.taskSnapshots.map((taskSnapshot) => taskSnapshot.snapshotId),
        cmpPassiveDefaultPayload: "ContextPackage",
        sourceRequestId: historyRequestId,
      },
    });
    this.#cmpPackages.set(enrichedContextPackage.packageId, enrichedContextPackage);
    const checkedSnapshotRecord = this.#cmpSnapshotRecords.get(snapshot.snapshotId);
    const sourceSectionRecordIds = checkedSnapshotRecord?.sourceSectionIds ?? [];
    this.#cmpSnapshotRecords.set(
      `${snapshot.snapshotId}:served:${enrichedContextPackage.packageId}`,
      createCmpSnapshotRecord({
        snapshotId: `${snapshot.snapshotId}:served:${enrichedContextPackage.packageId}`,
        projectId: normalized.projectId,
        agentId: normalized.requesterAgentId,
        stage: "persisted",
        sourceSectionIds: sourceSectionRecordIds,
        sourceAnchors: [snapshot.snapshotId, enrichedContextPackage.packageId, enrichedContextPackage.packageRef],
        branchRef: snapshot.branchRef,
        commitRef: snapshot.commitRef,
        createdAt: enrichedContextPackage.createdAt,
        updatedAt: enrichedContextPackage.createdAt,
        metadata: {
          source: "cmp-runtime-object-model-passive",
          truthSource: fallbackDecision.resolvedSource,
          sourceRequestId: historyRequestId,
        },
      }),
    );
    this.#cmpPackageRecords.set(
      enrichedContextPackage.packageId,
      createCmpPackageRecordFromContextPackage({
        contextPackage: enrichedContextPackage,
        projectId: normalized.projectId,
        sourceSnapshotId: snapshot.snapshotId,
        sourceSectionIds: sourceSectionRecordIds,
        sourceAnchors: [enrichedContextPackage.packageRef, snapshot.snapshotId],
        status: "served",
        metadata: {
          source: "cmp-runtime-object-model-passive",
          truthSource: fallbackDecision.resolvedSource,
          sourceRequestId: historyRequestId,
        },
      }),
    );
    const historyRequest = this.#cmpRequests.get(historyRequestId);
    if (historyRequest) {
      this.#cmpRequests.set(historyRequestId, advanceCmpRequestRecordStatus({
        record: historyRequest,
        nextStatus: "served",
        updatedAt: enrichedContextPackage.createdAt,
        metadata: {
          ...(historyRequest.metadata ?? {}),
          truthSource: fallbackDecision.resolvedSource,
          sourceSnapshotId: snapshot.snapshotId,
          sourceSectionRecordIds,
          servedPackageId: enrichedContextPackage.packageId,
        },
      }));
    }
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
      const packageRecord = this.#cmpDbRuntimeSync.packages.get(enrichedContextPackage.packageId);
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
            objectRef: enrichedContextPackage.packageId,
            createdAt: enrichedContextPackage.createdAt,
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
            objectRef: enrichedContextPackage.packageId,
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
      contextPackage: enrichedContextPackage,
      metadata: {
        degraded: fallbackDecision.degraded,
        truthSource: fallbackDecision.resolvedSource,
        fallbackReason: fallbackDecision.reason,
        cmpFiveAgent: {
          dbAgentRecordId: dbagentPassive.loop.loopId,
          dispatcherRecordId: dispatcherPassive.loopId,
          reinterventionRequestId: servedReintervention?.requestId,
        },
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
    this.#taResumeEnvelopes.delete(`resume:human-gate:${updatedGate.gateId}`);
    await this.#recordToolReviewHumanGate({
      gate: updatedGate,
      latestEvent: humanGateEvent,
      accessRequest: context.accessRequest,
      reviewDecision: context.reviewDecision,
      reason: input.action === "approve"
        ? `Human gate ${updatedGate.gateId} approved for ${updatedGate.capabilityKey}.`
        : `Human gate ${updatedGate.gateId} rejected for ${updatedGate.capabilityKey}.`,
    });

    if (input.action === "reject") {
      this.#writeTapControlPlaneCheckpoint({
        sessionId: context.accessRequest.sessionId,
        runId: context.accessRequest.runId,
        reason: "manual",
        metadata: {
          sourceOperation: "human-gate-decision",
          gateId: updatedGate.gateId,
          decision: "reject",
          eventId: humanGateEvent.eventId,
        },
      });
      const deniedDecision = createReviewDecision({
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
      });
      await this.reviewerRuntime?.recordDurableState({
        request: context.accessRequest,
        decision: deniedDecision,
        source: "human_gate_resolution",
      });
      this.#recordReviewerAgentRecord({
        accessRequest: context.accessRequest,
        reviewDecision: deniedDecision,
      });
      return {
        status: "denied",
        accessRequest: context.accessRequest,
        reviewDecision: deniedDecision,
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
    const capabilityTracked = inventoryTracksCapabilityLifecycle(
      inventory,
      context.accessRequest.requestedCapabilityKey,
    );
    const existingProvisionAsset = this.#findCurrentProvisionAsset(context.accessRequest.requestedCapabilityKey);
    await this.reviewerRuntime?.recordDurableState({
      request: context.accessRequest,
      decision: approvalDecision,
      source: "human_gate_resolution",
    });
    this.#recordReviewerAgentRecord({
      accessRequest: context.accessRequest,
      reviewDecision: approvalDecision,
    });
    if (!capabilityAvailable && (capabilityTracked || existingProvisionAsset)) {
      const replay = existingProvisionAsset
        ? await this.#ensureProvisionAssetReplay({
          accessRequest: context.accessRequest,
          intent: context.intent,
          source: "human-gate-approval-existing-asset",
          asset: existingProvisionAsset,
          options: context.options,
          reviewDecision: approvalDecision,
        })
        : undefined;
      const continueResult = existingProvisionAsset
        ? await this.#pickupToolReviewerSessionHandoff(`tool-review:provision:${existingProvisionAsset.provisionId}`)
        : undefined;
      this.#writeTapControlPlaneCheckpoint({
        sessionId: context.accessRequest.sessionId,
        runId: context.accessRequest.runId,
        reason: "manual",
        metadata: {
          sourceOperation: "human-gate-decision",
          gateId: updatedGate.gateId,
          decision: "approve",
          eventId: humanGateEvent.eventId,
          capabilityTracked,
          reusedProvisionAsset: existingProvisionAsset?.provisionId,
        },
      });
      if (continueResult?.status === "continued" && continueResult.continueResult?.dispatchResult) {
        return {
          ...continueResult.continueResult.dispatchResult,
          accessRequest: context.accessRequest,
          reviewDecision: approvalDecision,
          activation: continueResult.continueResult.activation ?? continueResult.continueResult.dispatchResult.activation,
          replay: continueResult.continueResult.dispatchResult.replay ?? replay,
          humanGate,
          continueResult: continueResult.continueResult,
        };
      }
      return {
        status: "deferred",
        accessRequest: context.accessRequest,
        reviewDecision: approvalDecision,
        activation: existingProvisionAsset
          ? this.#createActivationHandoff({
            source: "provision_asset",
            asset: existingProvisionAsset,
          })
          : undefined,
        replay,
        humanGate,
        continueResult: continueResult?.status === "continued"
          ? continueResult.continueResult
          : undefined,
      };
    }
    if (!capabilityAvailable) {
      const baseProvisionRequest = createProvisionRequest({
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
        });
      await this.#recordToolReviewProvisionRequest({
        provisionRequest: baseProvisionRequest,
        accessRequest: context.accessRequest,
        reviewDecision: approvalDecision,
        reason: "Human approval reopened the request and asked tool reviewer to issue a concrete TMA work order.",
      });
      const provisionRequest = this.#assembleProvisionRequestForRuntime({
        request: baseProvisionRequest,
        accessRequest: context.accessRequest,
        reviewDecision: approvalDecision,
        inventory,
      });
      const provisionBundle = await this.provisionerRuntime.submit(provisionRequest);
      const provisionAsset = provisionBundle.status === "ready"
        ? this.provisionerRuntime.assetIndex.getCurrent(provisionRequest.provisionId)
        : undefined;
      this.#recordTmaAgentRecord({
        request: provisionRequest,
        bundle: provisionBundle,
      });
      let activation: TaCapabilityActivationHandoff | undefined;
      let replay: TaCapabilityReplayHandoff | undefined;
      let continueResult: ContinueTaProvisioningResult | undefined;
      if (provisionBundle.status === "ready") {
        const staged = await this.#recordReadyBundleAndStageReplay({
          accessRequest: context.accessRequest,
          provisionRequest,
          provisionBundle,
          intent: context.intent,
          source: "human-gate-approval",
          reason: "TMA delivered a ready bundle after human approval.",
          options: context.options,
          reviewDecision: approvalDecision,
          metadata: {
            gateId: updatedGate.gateId,
            eventId: humanGateEvent.eventId,
          },
        });
        activation = staged.activation;
        replay = staged.replay;
        continueResult = staged.autoContinue;
        if (continueResult?.dispatchResult) {
          this.#writeTapControlPlaneCheckpoint({
            sessionId: context.accessRequest.sessionId,
            runId: context.accessRequest.runId,
            reason: "manual",
            metadata: {
              sourceOperation: "human-gate-decision",
              gateId: updatedGate.gateId,
              decision: "approve",
              eventId: humanGateEvent.eventId,
              provisionStatus: provisionBundle.status,
              provisionId: provisionRequest.provisionId,
              dispatchStatus: continueResult.dispatchResult.status,
            },
          });
          return {
            ...continueResult.dispatchResult,
            accessRequest: context.accessRequest,
            reviewDecision: approvalDecision,
            provisionRequest,
            provisionBundle,
            activation: continueResult.activation ?? continueResult.dispatchResult.activation ?? activation,
            replay: continueResult.dispatchResult.replay ?? replay,
            humanGate: continueResult.dispatchResult.humanGate ?? humanGate,
            continueResult,
          };
        }
      }
      this.#writeTapControlPlaneCheckpoint({
        sessionId: context.accessRequest.sessionId,
        runId: context.accessRequest.runId,
        reason: "manual",
        metadata: {
          sourceOperation: "human-gate-decision",
          gateId: updatedGate.gateId,
          decision: "approve",
          eventId: humanGateEvent.eventId,
          provisionStatus: provisionBundle.status,
          provisionId: provisionRequest.provisionId,
        },
      });
      return {
        status: provisionBundle.status === "ready" ? "provisioned" : "provisioning_failed",
        accessRequest: context.accessRequest,
        reviewDecision: approvalDecision,
        provisionRequest,
        provisionBundle,
        activation: provisionBundle.status === "ready"
          ? activation ?? this.#createActivationHandoff({
            source: "provision_bundle",
            bundle: provisionBundle,
            asset: provisionAsset,
          })
          : undefined,
        replay: provisionBundle.status === "ready"
          ? replay
          : undefined,
        humanGate,
        continueResult,
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
    await this.#ensureRunAvailable(context.intent.runId);
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
    const gateway = options.controlPlaneGatewayOverride ?? this.taControlPlaneGateway;
    const profile = options.profileOverride ?? gateway?.profile;
    if (!gateway || !profile) {
      throw new Error("T/A control-plane gateway is not configured on this runtime.");
    }
    if (!this.reviewerRuntime) {
      throw new Error("Reviewer runtime is not configured on this runtime.");
    }
    if (!this.provisionerRuntime) {
      throw new Error("Provisioner runtime is not configured on this runtime.");
    }

    const governanceDirective = readTapGovernanceDispatchDirective(options.metadata)
      ?? this.#createTapGovernanceDispatchDirective(intent);
    const requestedTier = maxCapabilityTier(
      options.requestedTier ?? "B1",
      governanceDirective.matchedToolPolicy === "human_gate" ? "B3" : "B1",
    );
    const mode = options.mode ?? governanceDirective.effectiveMode ?? profile.defaultMode;
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
      const accessRequest = gateway.submitAccessRequest({
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
          tapGovernanceDirective: governanceDirective,
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
      await this.reviewerRuntime.recordDurableState({
        request: accessRequest,
        decision: reviewDecision,
        source: "review_engine",
      });
      this.#recordReviewerAgentRecord({
        accessRequest,
        reviewDecision,
      });
      gateway.consumeReviewDecision(reviewDecision);
      return {
        status: "waiting_human",
        safety,
        accessRequest,
        reviewDecision,
        humanGate: await this.#openHumanGate({
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

    const resolved = gateway.resolveCapabilityAccess({
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
        tapGovernanceDirective: governanceDirective,
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
    return this.#completeTapReviewFlow({
      accessRequest,
      intent,
      options: {
        ...options,
        mode,
        requestedTier: effectiveTier,
        metadata: {
          ...(options.metadata ?? {}),
          tapGovernanceDirective: governanceDirective,
        },
      },
      safety,
      inventory: this.#buildTaReviewInventory(),
    });
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
    this.#kernelResultsByRun.set(intent.runId, execution.result);
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
  async dispatchIntent(
    intent: ModelInferenceIntent,
  ): Promise<DispatchModelInferenceIntentResult | DispatchCapabilityIntentViaTaPoolResult>;
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

    if (this.#shouldRouteModelInferenceViaTaPool()) {
      return this.dispatchCapabilityIntentViaTaPool(
        this.#createCapabilityIntentFromModelInferenceIntent(intent),
        this.#createModelInferenceTaDispatchOptions(intent),
      );
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
        if (this.#shouldRouteModelInferenceViaTaPool()) {
          const dispatched = await this.dispatchCapabilityIntentViaTaPool(
            this.#createCapabilityIntentFromModelInferenceIntent(intent),
            this.#createModelInferenceTaDispatchOptions(intent),
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
      answer: this.#readAnswerTextForRun(current.run.runId)
        ?? (
          lastModelResult?.output
          && typeof lastModelResult.output === "object"
          && lastModelResult.output !== null
          && "text" in lastModelResult.output
            ? (lastModelResult.output as { text?: string }).text
            : undefined
        ),
      capabilityDispatch: lastCapabilityDispatch,
      cmpDispatch: lastCmpDispatch,
      steps,
      finalEvents: this.readRunEvents(current.run.runId),
    };
  }

  readRunEvents(runId: string): JournalReadResult[] {
    return this.journal.readRunEvents(runId);
  }

  readKernelResult(runId: string): KernelResult | undefined {
    const result = this.#kernelResultsByRun.get(runId);
    return result ? structuredClone(result) : undefined;
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
    this.#kernelResultsByRun.set(
      context.runId,
      {
        resultId: result.resultId,
        sessionId: context.sessionId,
        runId: context.runId,
        source: (context.resultSource ?? "capability") === "model" ? "model" : "capability",
        status: result.status,
        output: result.output,
        artifacts: result.artifacts,
        evidence: result.evidence,
        error: result.error,
        emittedAt: event.createdAt,
        correlationId: context.correlationId,
        metadata: {
          ...(result.metadata ?? {}),
        },
      } satisfies KernelResult,
    );

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
          sourceSessionId: params.accessRequest.sessionId,
          sourceRunId: params.accessRequest.runId,
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

  async #ensureProvisionAssetActivated(provisionId: string): Promise<ActivateTaProvisionAssetResult> {
    const asset = this.provisionerRuntime?.assetIndex.getCurrent(provisionId);
    if (!asset) {
      return {
        status: "activation_asset_not_found",
      };
    }

    if (
      asset.status === "active"
      && asset.metadata?.activatedIntoPool === true
      && this.#hasActiveCapabilityBinding(asset.capabilityKey)
    ) {
      const attemptId = typeof asset.metadata?.activationAttemptId === "string"
        ? asset.metadata.activationAttemptId
        : undefined;
      const receipt = isRecord(asset.metadata?.activationReceipt)
        ? asset.metadata.activationReceipt as unknown as TaActivationReceipt
        : undefined;
      return {
        status: "activated",
        asset,
        attempt: attemptId ? this.#taActivationAttempts.get(attemptId) : undefined,
        receipt,
        activation: this.#createActivationHandoff({
          source: "provision_asset",
          asset,
        }),
      };
    }

    return this.activateTaProvisionAsset(provisionId);
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
      resumeEnvelopeId: pendingReplay ? this.getTaReplayResumeEnvelope(pendingReplay.replayId)?.envelopeId : undefined,
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

  async #ensureProvisionAssetReplay(params: {
    accessRequest: AccessRequest;
    intent: CapabilityCallIntent;
    source: string;
    asset: ProvisionAssetRecord;
    options?: DispatchCapabilityIntentViaTaPoolOptions;
    reviewDecision?: ReviewDecision;
  }): Promise<TaCapabilityReplayHandoff> {
    const existing = this.#findPendingReplayByProvisionId(params.asset.provisionId);
    if (existing) {
      return this.#createReplayHandoff({
        source: "provision_asset",
        asset: params.asset,
      });
    }

    const replay = createTaPendingReplay({
      replayId: `replay:${params.accessRequest.requestId}:${params.asset.provisionId}`,
      request: params.accessRequest,
      provisionBundle: {
        provisionId: params.asset.provisionId,
        replayPolicy: params.asset.replayPolicy,
      },
      createdAt: params.asset.updatedAt,
      metadata: {
        source: params.source,
        agentId: params.options?.agentId,
        intentId: params.intent.intentId,
        runId: params.intent.runId,
        sessionId: params.intent.sessionId,
        requestedTier: params.accessRequest.requestedTier,
        mode: params.accessRequest.mode,
        taskContext: params.options?.taskContext,
      },
    });
    this.#taPendingReplays.set(replay.replayId, replay);
    this.#recordResumeEnvelope(createTaResumeEnvelope({
      envelopeId: `resume:replay:${replay.replayId}`,
      source: "replay",
      requestId: params.accessRequest.requestId,
      sessionId: params.intent.sessionId,
      runId: params.intent.runId,
      capabilityKey: params.accessRequest.requestedCapabilityKey,
      requestedTier: params.accessRequest.requestedTier,
      mode: params.accessRequest.mode,
      reason: params.accessRequest.reason,
      intentRequest: {
        requestId: params.intent.request.requestId,
        intentId: params.intent.intentId,
        capabilityKey: params.intent.request.capabilityKey,
        input: params.intent.request.input,
        priority: params.intent.priority,
        metadata: params.intent.request.metadata,
      },
      metadata: {
        replayId: replay.replayId,
        provisionId: params.asset.provisionId,
        agentId: params.options?.agentId,
        taskContext: params.options?.taskContext,
      },
    }));
    await this.#recordToolReviewReplay({
      replay,
      accessRequest: params.accessRequest,
      reviewDecision: params.reviewDecision,
      reason: replay.reason,
    });
    this.#writeTapControlPlaneCheckpoint({
      sessionId: params.intent.sessionId,
      runId: params.intent.runId,
      reason: "manual",
      metadata: {
        sourceOperation: "replay-stage-existing-asset",
        replayId: replay.replayId,
        provisionId: params.asset.provisionId,
      },
    });

    return this.#createReplayHandoff({
      source: "provision_asset",
      asset: params.asset,
    });
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

  async #openHumanGate(params: {
    accessRequest: AccessRequest;
    reviewDecision: ReviewDecision;
    intent: CapabilityCallIntent;
    options: DispatchCapabilityIntentViaTaPoolOptions;
  }): Promise<TaCapabilityHumanGateHandoff> {
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
    this.#recordResumeEnvelope(createTaResumeEnvelope({
      envelopeId: `resume:human-gate:${gateId}`,
      source: "human_gate",
      requestId: params.accessRequest.requestId,
      sessionId: params.accessRequest.sessionId,
      runId: params.accessRequest.runId,
      capabilityKey: params.accessRequest.requestedCapabilityKey,
      requestedTier: params.accessRequest.requestedTier,
      mode: params.accessRequest.mode,
      reason: params.accessRequest.reason,
      reviewDecisionId: params.reviewDecision.decisionId,
      intentRequest: {
        requestId: params.intent.request.requestId,
        intentId: params.intent.intentId,
        capabilityKey: params.intent.request.capabilityKey,
        input: params.intent.request.input,
        priority: params.intent.priority,
        metadata: params.intent.request.metadata,
      },
      metadata: {
        gateId,
        agentId: params.options.agentId,
        taskContext: params.options.taskContext,
      },
    }));
    await this.#recordToolReviewHumanGate({
      gate,
      accessRequest: params.accessRequest,
      reviewDecision: params.reviewDecision,
      reason: params.reviewDecision.reason,
    });
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

  async #stageProvisionReplay(params: {
    accessRequest: AccessRequest;
    provisionBundle: ProvisionArtifactBundle;
    intent: CapabilityCallIntent;
    source: string;
    options?: DispatchCapabilityIntentViaTaPoolOptions;
    reviewDecision?: ReviewDecision;
    metadata?: Record<string, unknown>;
  }): Promise<TaCapabilityReplayHandoff> {
    const replay = createTaPendingReplay({
      replayId: `replay:${params.accessRequest.requestId}:${params.provisionBundle.provisionId}`,
      request: params.accessRequest,
      provisionBundle: params.provisionBundle,
      createdAt: params.provisionBundle.completedAt ?? new Date().toISOString(),
      metadata: {
        source: params.source,
        agentId: params.options?.agentId,
        intentId: params.intent.intentId,
        runId: params.intent.runId,
        sessionId: params.intent.sessionId,
        requestedTier: params.accessRequest.requestedTier,
        mode: params.accessRequest.mode,
        taskContext: params.options?.taskContext,
        ...(params.metadata ?? {}),
      },
    });
    this.#taPendingReplays.set(replay.replayId, replay);
    this.#recordResumeEnvelope(createTaResumeEnvelope({
      envelopeId: `resume:replay:${replay.replayId}`,
      source: "replay",
      requestId: params.accessRequest.requestId,
      sessionId: params.intent.sessionId,
      runId: params.intent.runId,
      capabilityKey: params.accessRequest.requestedCapabilityKey,
      requestedTier: params.accessRequest.requestedTier,
      mode: params.accessRequest.mode,
      reason: params.accessRequest.reason,
      intentRequest: {
        requestId: params.intent.request.requestId,
        intentId: params.intent.intentId,
        capabilityKey: params.intent.request.capabilityKey,
        input: params.intent.request.input,
        priority: params.intent.priority,
        metadata: params.intent.request.metadata,
      },
      metadata: {
        replayId: replay.replayId,
        provisionId: params.provisionBundle.provisionId,
        agentId: params.options?.agentId,
        taskContext: params.options?.taskContext,
        tapGovernanceDirective: isRecord(params.options?.metadata?.tapGovernanceDirective)
          ? params.options?.metadata?.tapGovernanceDirective
          : undefined,
      },
    }));
    await this.#recordToolReviewReplay({
      replay,
      accessRequest: params.accessRequest,
      reviewDecision: params.reviewDecision,
      reason: replay.reason,
    });
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

  #findLatestToolReviewerTmaWorkOrder(params: {
    capabilityKey: string;
    provisionId?: string;
  }): ToolReviewTmaWorkOrder | undefined {
    const workOrders = this.listToolReviewerTmaWorkOrders()
      .filter((workOrder) => workOrder.capabilityKey === params.capabilityKey);
    if (params.provisionId) {
      const exactSessionMatch = workOrders.find((workOrder) =>
        workOrder.sessionId === `tool-review:provision:${params.provisionId}`
      );
      if (exactSessionMatch) {
        return exactSessionMatch;
      }
    }

    return workOrders.sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))[0];
  }

  async #completeTapReviewFlow(params: {
    accessRequest: AccessRequest;
    intent: CapabilityCallIntent;
    options: DispatchCapabilityIntentViaTaPoolOptions;
    safety?: ReturnType<typeof evaluateSafetyInterception>;
    inventory?: ReviewDecisionEngineInventory;
  }): Promise<DispatchCapabilityIntentViaTaPoolResult> {
    const gateway = params.options.controlPlaneGatewayOverride ?? this.taControlPlaneGateway;
    const profile = params.options.profileOverride ?? gateway?.profile;
    if (!gateway || !profile) {
      throw new Error("T/A control-plane gateway is not configured on this runtime.");
    }
    const inventory = params.inventory ?? this.#buildTaReviewInventory();
    const reviewDecision = await this.reviewerRuntime!.submit({
      request: params.accessRequest,
      profile,
      inventory,
    });
    this.#recordReviewerAgentRecord({
      accessRequest: params.accessRequest,
      reviewDecision,
    });
    const consumed = gateway.consumeReviewDecision(reviewDecision);

    if (consumed.grant) {
      const executionRequestId = consumed.decisionToken?.requestId ?? params.intent.request.requestId;
      const dispatch = await this.dispatchTaCapabilityGrant({
        grant: consumed.grant,
        decisionToken: consumed.decisionToken,
        sessionId: params.intent.sessionId,
        runId: params.intent.runId,
        intentId: params.intent.intentId,
        requestId: executionRequestId,
        capabilityKey: params.intent.request.capabilityKey,
        input: params.intent.request.input,
        priority: params.intent.request.priority,
        timeoutMs: params.intent.request.timeoutMs,
        metadata: params.intent.request.metadata,
      });
      const runOutcome = await this.#awaitCapabilityRunOutcome({
        requestId: executionRequestId,
        timeoutMs: params.intent.request.timeoutMs,
      });
      return {
        status: "dispatched",
        accessRequest: params.accessRequest,
        reviewDecision,
        grant: consumed.grant,
        decisionToken: consumed.decisionToken,
        dispatch,
        runOutcome,
        safety: params.safety?.outcome === "allow" ? undefined : params.safety,
      };
    }

    if (reviewDecision.decision === "redirected_to_provisioning") {
      const baseProvisionRequest = toProvisionRequestFromReviewDecision({
        request: params.accessRequest,
        decision: reviewDecision,
        provisionId: `${reviewDecision.decisionId}:provision`,
        createdAt: new Date().toISOString(),
      });
      await this.#recordToolReviewProvisionRequest({
        provisionRequest: baseProvisionRequest,
        accessRequest: params.accessRequest,
        reviewDecision,
        reason: "Reviewer redirected the request into provisioning and asked tool reviewer to issue a concrete TMA work order.",
      });
      const provisionRequest = this.#assembleProvisionRequestForRuntime({
        request: baseProvisionRequest,
        accessRequest: params.accessRequest,
        reviewDecision,
        inventory,
      });
      const provisionBundle = await this.provisionerRuntime!.submit(provisionRequest);
      const provisionAsset = provisionBundle.status === "ready"
        ? this.provisionerRuntime!.assetIndex.getCurrent(provisionRequest.provisionId)
        : undefined;
      this.#recordTmaAgentRecord({
        request: provisionRequest,
        bundle: provisionBundle,
      });
      let activation: TaCapabilityActivationHandoff | undefined;
      let replay: TaCapabilityReplayHandoff | undefined;
      let continueResult: ContinueTaProvisioningResult | undefined;
      if (provisionBundle.status === "ready") {
        const staged = await this.#recordReadyBundleAndStageReplay({
          accessRequest: params.accessRequest,
          provisionRequest,
          provisionBundle,
          intent: params.intent,
          source: "review-provisioning",
          reason: "TMA delivered a ready bundle back into the TAP provision lane.",
          options: params.options,
          reviewDecision,
          metadata: {
            decisionId: reviewDecision.decisionId,
          },
        });
        activation = staged.activation;
        replay = staged.replay;
        continueResult = staged.autoContinue;
      }
      return {
        status: provisionBundle.status === "ready" ? "provisioned" : "provisioning_failed",
        accessRequest: params.accessRequest,
        reviewDecision,
        provisionRequest,
        provisionBundle,
        activation: provisionBundle.status === "ready"
          ? activation ?? this.#createActivationHandoff({
            source: "provision_bundle",
            bundle: provisionBundle,
            asset: provisionAsset,
          })
          : undefined,
        replay: provisionBundle.status === "ready" ? replay : undefined,
        continueResult,
        safety: params.safety?.outcome === "allow" ? undefined : params.safety,
      };
    }

    const provisionAsset = this.#findCurrentProvisionAsset(params.intent.request.capabilityKey);
    const replay = provisionAsset
      ? await this.#ensureProvisionAssetReplay({
        accessRequest: params.accessRequest,
        intent: params.intent,
        source: "review-existing-provision-asset",
        asset: provisionAsset,
        options: params.options,
        reviewDecision,
      })
      : undefined;
    const continueResult = provisionAsset
      ? await this.#pickupToolReviewerSessionHandoff(`tool-review:provision:${provisionAsset.provisionId}`)
      : undefined;
    if (continueResult?.status === "continued" && continueResult.continueResult?.dispatchResult) {
      return {
        ...continueResult.continueResult.dispatchResult,
        accessRequest: params.accessRequest,
        reviewDecision,
        activation: continueResult.continueResult.activation ?? continueResult.continueResult.dispatchResult.activation,
        replay: continueResult.continueResult.dispatchResult.replay ?? replay,
        continueResult: continueResult.continueResult,
        safety: params.safety?.outcome === "allow" ? undefined : params.safety,
      };
    }

    return {
      status: reviewDecision.decision === "escalated_to_human"
        ? "waiting_human"
        : reviewDecision.decision as Exclude<
          DispatchCapabilityIntentViaTaPoolResult["status"],
          "dispatched" | "waiting_human" | "provisioned" | "provisioning_failed" | "blocked" | "interrupted"
        >,
      accessRequest: params.accessRequest,
      reviewDecision,
      activation: provisionAsset
        ? this.#createActivationHandoff({
          source: "provision_asset",
          asset: provisionAsset,
        })
        : undefined,
      replay,
      continueResult: continueResult?.status === "continued"
        ? continueResult.continueResult
        : undefined,
      humanGate: reviewDecision.decision === "escalated_to_human"
        ? await this.#openHumanGate({
          accessRequest: params.accessRequest,
          reviewDecision,
          intent: params.intent,
          options: params.options,
        })
        : replay?.policy === "manual"
          ? this.#createHumanGateHandoff({
            source: "replay_policy",
            capabilityKey: params.accessRequest.requestedCapabilityKey,
            requestedTier: params.accessRequest.requestedTier,
            mode: params.accessRequest.mode,
            requestedAction: params.accessRequest.requestedAction ?? this.#describeCapabilityIntentAction(params.intent),
            reason: replay.reason,
            riskLevel: reviewDecision.riskLevel ?? params.accessRequest.riskLevel,
            plainLanguageRisk: reviewDecision.plainLanguageRisk ?? params.accessRequest.plainLanguageRisk,
            metadata: {
              accessRequestId: params.accessRequest.requestId,
              reviewDecisionId: reviewDecision.decisionId,
              replayPolicy: replay.policy,
            },
          })
        : undefined,
      safety: params.safety?.outcome === "allow" ? undefined : params.safety,
    };
  }

  #createToolReviewRequestRef(accessRequest: AccessRequest) {
    return {
      requestId: accessRequest.requestId,
      sessionId: accessRequest.sessionId,
      runId: accessRequest.runId,
      requestedCapabilityKey: accessRequest.requestedCapabilityKey,
      requestedTier: accessRequest.requestedTier,
      mode: accessRequest.mode,
      canonicalMode: accessRequest.canonicalMode,
      riskLevel: accessRequest.riskLevel ?? "normal",
    };
  }

  #createToolReviewSourceDecisionRef(reviewDecision?: ReviewDecision) {
    if (!reviewDecision) {
      return undefined;
    }

    return {
      decisionId: reviewDecision.decisionId,
      decision: reviewDecision.decision,
      vote: reviewDecision.vote,
      reason: reviewDecision.reason,
      escalationTarget: reviewDecision.escalationTarget,
      createdAt: reviewDecision.createdAt,
    };
  }

  async #recordToolReviewHumanGate(params: {
    gate: TaHumanGateState;
    latestEvent?: TaHumanGateEvent;
    accessRequest?: AccessRequest;
    reviewDecision?: ReviewDecision;
    reason: string;
  }): Promise<void> {
    if (!this.toolReviewerRuntime) {
      return;
    }

    const result = await this.toolReviewerRuntime.submit({
      sessionId: `tool-review:request:${params.gate.requestId}`,
      governanceAction: {
        kind: "human_gate",
        trace: createToolReviewGovernanceTrace({
          actionId: `tool-review:human-gate:${params.gate.gateId}:${params.latestEvent?.eventId ?? params.gate.updatedAt}`,
          actorId: "tool-reviewer",
          reason: params.reason,
          createdAt: params.latestEvent?.createdAt ?? params.gate.updatedAt,
          request: params.accessRequest ? this.#createToolReviewRequestRef(params.accessRequest) : undefined,
          sourceDecision: this.#createToolReviewSourceDecisionRef(params.reviewDecision),
          metadata: {
            gateId: params.gate.gateId,
          },
        }),
        capabilityKey: params.gate.capabilityKey,
        gate: params.gate,
        latestEvent: params.latestEvent,
        metadata: {
          gateId: params.gate.gateId,
          latestEventType: params.latestEvent?.type,
        },
      },
    });
    this.#recordToolReviewerAgentRecord(result);
  }

  async #recordToolReviewReplay(params: {
    replay: TaPendingReplay;
    accessRequest?: AccessRequest;
    reviewDecision?: ReviewDecision;
    reason: string;
  }): Promise<void> {
    if (!this.toolReviewerRuntime) {
      return;
    }

    const result = await this.toolReviewerRuntime.submit({
      sessionId: `tool-review:provision:${params.replay.provisionId}`,
      governanceAction: {
        kind: "replay",
        trace: createToolReviewGovernanceTrace({
          actionId: `tool-review:replay:${params.replay.replayId}:${params.replay.updatedAt}`,
          actorId: "tool-reviewer",
          reason: params.reason,
          createdAt: params.replay.updatedAt,
          request: params.accessRequest ? this.#createToolReviewRequestRef(params.accessRequest) : undefined,
          sourceDecision: this.#createToolReviewSourceDecisionRef(params.reviewDecision),
          metadata: {
            replayId: params.replay.replayId,
          },
        }),
        capabilityKey: params.replay.capabilityKey,
        replay: params.replay,
        metadata: {
          replayId: params.replay.replayId,
          provisionId: params.replay.provisionId,
        },
      },
    });
    this.#recordToolReviewerAgentRecord(result);
  }

  #readTmaDeliveryReceiptFromBundle(
    bundle: ProvisionArtifactBundle,
  ): TmaReadyBundleReceipt | undefined {
    const receipt = bundle.metadata?.tmaDeliveryReceipt;
    return isRecord(receipt) ? receipt as unknown as TmaReadyBundleReceipt : undefined;
  }

  async #recordToolReviewDelivery(params: {
    provisionId: string;
    capabilityKey: string;
    receipt: TmaReadyBundleReceipt;
    requestId?: string;
    sessionId?: string;
    runId?: string;
    reason: string;
  }): Promise<void> {
    if (!this.toolReviewerRuntime) {
      return;
    }

    const result = await this.toolReviewerRuntime.submit({
      sessionId: `tool-review:provision:${params.provisionId}`,
      governanceAction: {
        kind: "delivery",
        trace: createToolReviewGovernanceTrace({
          actionId: `tool-review:delivery:${params.provisionId}:${params.receipt.reportId}`,
          actorId: "tool-reviewer",
          reason: params.reason,
          createdAt: params.receipt.readyAt,
          metadata: {
            provisionId: params.provisionId,
            requestId: params.requestId,
            sessionId: params.sessionId,
            runId: params.runId,
            plannerSessionId: params.receipt.plannerSessionId,
            executorSessionId: params.receipt.executorSessionId,
          },
        }),
        provisionId: params.provisionId,
        capabilityKey: params.capabilityKey,
        receipt: params.receipt,
        metadata: {
          provisionId: params.provisionId,
          reportId: params.receipt.reportId,
          plannerSessionId: params.receipt.plannerSessionId,
          executorSessionId: params.receipt.executorSessionId,
        },
      },
    });
    this.#recordToolReviewerAgentRecord(result);
  }

  async #recordToolReviewDeliveryFromBundle(
    bundle: ProvisionArtifactBundle,
    reason: string,
    context?: {
      requestId?: string;
      sessionId?: string;
      runId?: string;
    },
  ): Promise<void> {
    const receipt = this.#readTmaDeliveryReceiptFromBundle(bundle);
    if (!receipt) {
      return;
    }

    await this.#recordToolReviewDelivery({
      provisionId: bundle.provisionId,
      capabilityKey: receipt.requestedCapabilityKey,
      receipt,
      requestId: context?.requestId,
      sessionId: context?.sessionId,
      runId: context?.runId,
      reason,
    });
  }

  async #recordToolReviewActivation(params: {
    provisionId: string;
    capabilityKey: string;
    activationSpec?: PoolActivationSpec;
    attempt: TaActivationAttemptRecord;
    receipt?: TaActivationReceipt;
    failure?: TaActivationFailure;
    requestId?: string;
    sessionId?: string;
    runId?: string;
    reason: string;
  }): Promise<void> {
    if (!this.toolReviewerRuntime || !params.activationSpec) {
      return;
    }

    const result = await this.toolReviewerRuntime.submit({
      sessionId: `tool-review:provision:${params.provisionId}`,
      governanceAction: {
        kind: "activation",
        trace: createToolReviewGovernanceTrace({
          actionId: `tool-review:activation:${params.provisionId}:${params.attempt.attemptId}`,
          actorId: "tool-reviewer",
          reason: params.reason,
          createdAt: params.attempt.updatedAt,
          metadata: {
            provisionId: params.provisionId,
            attemptId: params.attempt.attemptId,
            requestId: params.requestId,
            sessionId: params.sessionId,
            runId: params.runId,
          },
        }),
        provisionId: params.provisionId,
        capabilityKey: params.capabilityKey,
        activationSpec: {
          targetPool: params.activationSpec.targetPool,
          activationMode: params.activationSpec.activationMode,
          registerOrReplace: params.activationSpec.registerOrReplace,
          generationStrategy: params.activationSpec.generationStrategy,
          drainStrategy: params.activationSpec.drainStrategy,
          adapterFactoryRef: params.activationSpec.adapterFactoryRef,
        },
        currentAttempt: params.attempt,
        latestReceipt: params.receipt,
        latestFailure: params.failure,
        metadata: {
          provisionId: params.provisionId,
          attemptId: params.attempt.attemptId,
        },
      },
    });
    this.#recordToolReviewerAgentRecord(result);
  }

  async #recordToolReviewLifecycle(params: {
    capabilityKey: string;
    lifecycleAction: "register" | "replace" | "suspend" | "resume" | "unregister";
    targetPool: string;
    binding?: CapabilityBinding;
    accessRequest?: AccessRequest;
    reviewDecision?: ReviewDecision;
    reason: string;
    createdAt: string;
    failure?: {
      code: string;
      message: string;
    };
  }): Promise<void> {
    if (!this.toolReviewerRuntime) {
      return;
    }

    const result = await this.toolReviewerRuntime.submit({
      sessionId: `tool-review:lifecycle:${params.capabilityKey}`,
      governanceAction: {
        kind: "lifecycle",
        trace: createToolReviewGovernanceTrace({
          actionId: `tool-review:lifecycle:${params.capabilityKey}:${params.lifecycleAction}:${params.createdAt}`,
          actorId: "tool-reviewer",
          reason: params.reason,
          createdAt: params.createdAt,
          request: params.accessRequest ? this.#createToolReviewRequestRef(params.accessRequest) : undefined,
          sourceDecision: this.#createToolReviewSourceDecisionRef(params.reviewDecision),
        }),
        capabilityKey: params.capabilityKey,
        lifecycleAction: params.lifecycleAction,
        targetPool: params.targetPool,
        binding: params.binding
          ? {
            bindingId: params.binding.bindingId,
            capabilityId: params.binding.capabilityId,
            generation: params.binding.generation,
            state: params.binding.state,
            adapterId: params.binding.adapterId,
          }
          : undefined,
        failure: params.failure,
        metadata: params.failure
          ? {
            failureCode: params.failure.code,
          }
          : undefined,
      },
    });
    this.#recordToolReviewerAgentRecord(result);
  }

  #findPendingReplayByProvisionId(provisionId: string): TaPendingReplay | undefined {
    return [...this.#taPendingReplays.values()]
      .find((replay) => replay.provisionId === provisionId);
  }

  #findReplayEnvelopeByProvisionId(provisionId: string) {
    return [...this.#taResumeEnvelopes.values()]
      .find((envelope) => envelope.source === "replay" && envelope.metadata?.provisionId === provisionId);
  }

  #hasActiveCapabilityBinding(capabilityKey: string): boolean {
    const capabilityIds = new Set(
      this.capabilityPool.listCapabilities()
        .filter((manifest) => manifest.capabilityKey === capabilityKey)
        .map((manifest) => manifest.capabilityId),
    );
    if (capabilityIds.size === 0) {
      return false;
    }

    return this.capabilityPool.listBindings()
      .some((binding) => binding.state === "active" && capabilityIds.has(binding.capabilityId));
  }

  async #continuePendingProvisioningForCapability(
    capabilityKey: string,
  ): Promise<ContinueTaProvisioningResult[]> {
    const provisionIds = [...new Set(
      [...this.#taPendingReplays.values()]
        .filter((replay) =>
          replay.capabilityKey === capabilityKey
          && (replay.nextAction === "verify_then_auto" || replay.nextAction === "re_review_then_dispatch"))
        .map((replay) => replay.provisionId),
    )];

    const results: ContinueTaProvisioningResult[] = [];
    for (const provisionId of provisionIds) {
      results.push(await this.continueTaProvisioning(provisionId));
    }
    return results;
  }

  async #resumeReplayEnvelope(
    envelope: ReturnType<typeof createTaResumeEnvelope>,
    replay: TaPendingReplay,
    options: {
      skipActivation?: boolean;
    } = {},
  ): Promise<ResumeTaEnvelopeResult> {
    const provisionId = typeof envelope.metadata?.provisionId === "string"
      ? envelope.metadata.provisionId
      : undefined;
    if (provisionId && !options.skipActivation) {
      const activationResult = await this.#ensureProvisionAssetActivated(provisionId);
      if (activationResult.status !== "activated") {
        return {
          status: activationResult.status,
          envelope,
          replay,
          activation: activationResult.activation,
          activationResult,
        };
      }
    }
    await this.#ensureRunAvailable(envelope.runId);

    const dispatchResult = await this.dispatchCapabilityIntentViaTaPool({
      intentId: envelope.intentRequest!.intentId,
      sessionId: envelope.sessionId,
      runId: envelope.runId,
      kind: "capability_call",
      createdAt: new Date().toISOString(),
      priority: (envelope.intentRequest!.priority ?? "normal") as CapabilityCallIntent["priority"],
      correlationId: envelope.intentRequest!.intentId,
      request: {
        requestId: envelope.intentRequest!.requestId,
        intentId: envelope.intentRequest!.intentId,
        sessionId: envelope.sessionId,
        runId: envelope.runId,
        capabilityKey: envelope.intentRequest!.capabilityKey,
        input: envelope.intentRequest!.input,
        priority: (envelope.intentRequest!.priority ?? "normal") as CapabilityCallIntent["request"]["priority"],
        timeoutMs: envelope.intentRequest!.timeoutMs,
        metadata: envelope.intentRequest!.metadata,
      },
      metadata: isRecord(envelope.metadata) ? envelope.metadata : undefined,
    }, {
      agentId: typeof envelope.metadata?.agentId === "string"
        ? envelope.metadata.agentId
        : `agent-core-runtime:${envelope.sessionId}`,
      reason: envelope.reason,
      requestedTier: envelope.requestedTier,
      mode: envelope.mode,
      requestedScope: envelope.requestedScope,
      taskContext: isRecord(envelope.metadata?.taskContext)
        ? envelope.metadata.taskContext as Record<string, unknown>
        : undefined,
      metadata: {
        ...(isRecord(envelope.metadata) ? envelope.metadata : {}),
        resumedFromEnvelopeId: envelope.envelopeId,
        resumedFromReplayId: replay.replayId,
      },
    });

    const shouldFinalizeReplay = dispatchResult.status === "dispatched"
      || dispatchResult.status === "denied";
    if (shouldFinalizeReplay) {
      this.#taPendingReplays.delete(replay.replayId);
      this.#taResumeEnvelopes.delete(envelope.envelopeId);
    }

    return {
      status: dispatchResult.status,
      envelope,
      replay,
      dispatchResult,
    };
  }

  #recordResumeEnvelope(
    envelope: ReturnType<typeof createTaResumeEnvelope>,
  ): void {
    this.#taResumeEnvelopes.set(envelope.envelopeId, envelope);
  }

  async #ensureRunAvailable(runId: string): Promise<void> {
    if (this.runCoordinator.getRun(runId)) {
      return;
    }

    try {
      await this.runCoordinator.resumeRun({ runId });
    } catch {
      // Ignore and let later dispatch surface the truthful failure.
    }
  }

  #readAnswerTextForRun(runId: string): string | undefined {
    const kernelResult = this.#kernelResultsByRun.get(runId);
    const output = kernelResult?.output;
    if (!output || typeof output !== "object") {
      return undefined;
    }
    return typeof (output as { text?: unknown }).text === "string"
      ? (output as { text: string }).text
      : undefined;
  }

  #syncSessionFromRun(run: RunTransitionOutcome["run"]): void {
    if (run.status === "completed" || run.status === "failed" || run.status === "cancelled") {
      this.sessionManager.setActiveRun(run.sessionId, undefined);
      return;
    }

    this.sessionManager.setActiveRun(run.sessionId, run.runId);
  }

  #readTapUserOverrideFromIntent(intent: CapabilityCallIntent): TapUserOverrideContract | undefined {
    const intentOverride = readTapUserOverrideCandidate(intent.metadata?.tapUserOverride);
    if (intentOverride) {
      return intentOverride;
    }

    return readTapUserOverrideCandidate(intent.request.metadata?.tapUserOverride);
  }

  #matchTapToolPolicyOverride(
    governance: TapGovernanceObject,
    capabilityKey: string,
  ): TapToolPolicyOverride | undefined {
    return governance.taskPolicy.toolPolicyOverrides.find((override) =>
      matchesCapabilityPattern({
        capabilityKey,
        patterns: [override.capabilitySelector],
      })
    );
  }

  #createTapGovernanceDispatchDirective(
    intent: CapabilityCallIntent,
  ): TapGovernanceDispatchDirective {
    const governance = this.createTapTaskGovernance({
      taskId: intent.intentId,
      userOverride: this.#readTapUserOverrideFromIntent(intent),
    });
    const matchedToolPolicy = this.#matchTapToolPolicyOverride(
      governance,
      intent.request.capabilityKey,
    );
    const derivedRisk = classifyCapabilityRisk({
      capabilityKey: intent.request.capabilityKey,
      requestedTier: "B1",
    });
    const forceHumanByRisk = governance.taskPolicy.requireHumanOnRiskLevels.includes(
      derivedRisk.riskLevel,
    );

    return {
      governanceObjectId: governance.objectId,
      effectiveMode: (
        matchedToolPolicy?.policy === "human_gate" || forceHumanByRisk
      ) && governance.taskPolicy.effectiveMode !== "bapr"
        ? "restricted"
        : governance.taskPolicy.effectiveMode,
      automationDepth: governance.taskPolicy.automationDepth,
      explanationStyle: governance.taskPolicy.explanationStyle,
      derivedRiskLevel: derivedRisk.riskLevel,
      matchedToolPolicy: matchedToolPolicy?.policy,
      matchedToolPolicySelector: matchedToolPolicy?.capabilitySelector,
      forceHumanByRisk,
    };
  }

  #shouldRouteModelInferenceViaTaPool(): boolean {
    if (!this.taControlPlaneGateway || !this.reviewerRuntime || !this.provisionerRuntime) {
      return false;
    }

    return this.capabilityPool.listCapabilities().some((manifest) => {
      return manifest.capabilityKey === MODEL_INFERENCE_CAPABILITY_KEY;
    });
  }

  #createCapabilityIntentFromModelInferenceIntent(
    intent: ModelInferenceIntent,
  ): CapabilityCallIntent {
    const provider = typeof intent.frame.metadata?.provider === "string" ? intent.frame.metadata.provider : "openai";
    const model = typeof intent.frame.metadata?.model === "string" ? intent.frame.metadata.model : "unknown";
    return {
      intentId: `${intent.intentId}:tap`,
      sessionId: intent.sessionId,
      runId: intent.runId,
      kind: "capability_call",
      createdAt: intent.createdAt,
      priority: intent.priority,
      correlationId: intent.correlationId,
      idempotencyKey: intent.idempotencyKey,
      metadata: {
        ...(intent.metadata ?? {}),
        resultSource: "model",
        final: true,
      },
      request: {
        requestId: `${intent.intentId}:request`,
        intentId: `${intent.intentId}:tap`,
        sessionId: intent.sessionId,
        runId: intent.runId,
        capabilityKey: MODEL_INFERENCE_CAPABILITY_KEY,
        input: {
          provider,
          model,
          frame: intent.frame,
          stateSummary: intent.stateSummary,
          metadata: intent.metadata,
        },
        priority: intent.priority,
        timeoutMs: 120_000,
        idempotencyKey: intent.idempotencyKey,
        metadata: {
          resultSource: "model",
          final: true,
          sourceIntentKind: "model_inference",
        },
      },
    };
  }

  #createModelInferenceTaDispatchOptions(
    intent: ModelInferenceIntent,
  ): DispatchCapabilityIntentViaTaPoolOptions {
    const capabilityIntent = this.#createCapabilityIntentFromModelInferenceIntent(intent);
    const governanceDirective = this.#createTapGovernanceDispatchDirective(capabilityIntent);
    return {
      agentId: `agent-core-runtime:${intent.sessionId}`,
      mode: governanceDirective.effectiveMode,
      requestedTier: "B0",
      reason: `Model inference via ${typeof intent.frame.metadata?.provider === "string" ? intent.frame.metadata.provider : "openai"}:${typeof intent.frame.metadata?.model === "string" ? intent.frame.metadata.model : "unknown"} requested by runtime.`,
      metadata: {
        tapGovernanceDirective: governanceDirective,
        resultSource: "model",
        final: true,
        sourceIntentKind: "model_inference",
      },
    };
  }

  #createDefaultTaDispatchOptions(
    intent: CapabilityCallIntent,
  ): DispatchCapabilityIntentViaTaPoolOptions {
    const governanceDirective = this.#createTapGovernanceDispatchDirective(intent);
    return {
      agentId: `agent-core-runtime:${intent.sessionId}`,
      mode: governanceDirective.effectiveMode,
      requestedTier: governanceDirective.matchedToolPolicy === "human_gate" ? "B3" : "B1",
      metadata: {
        tapGovernanceDirective: governanceDirective,
      },
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
