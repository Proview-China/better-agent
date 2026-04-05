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
  toKernelResult,
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
  assembleCapabilityProfileFromPackages,
  classifyCapabilityRisk,
  createTapCmpMpReadyChecklist,
  createTapGovernanceObject,
  createTapUserSurfaceSnapshot,
  instantiateTapGovernanceObject,
  type AssembleCapabilityProfileFromPackagesInput,
  type CreateTapGovernanceObjectInput,
  type TapCmpMpReadyChecklist,
  type TapGovernanceObject,
  type TapToolPolicyOverride,
  type TapUserSurfaceSnapshot,
  type TapUserOverrideContract,
} from "./ta-pool-model/index.js";
import {
  activateProvisionAsset,
  createTapGovernanceSnapshot,
  createTapAgentRecord,
  createTapThreeAgentUsageReport,
  applyTaHumanGateEvent,
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
  materializeProvisionAssetActivation,
} from "./ta-pool-runtime/index.js";
import { createReviewerRuntime, ReviewerRuntime } from "./ta-pool-review/index.js";
import { createDefaultReviewerLlmHook } from "./ta-pool-review/index.js";
import type { ReviewerDurableState } from "./ta-pool-review/index.js";
import { createProvisionerRuntime, ProvisionerRuntime } from "./ta-pool-provision/index.js";
import { createModelBackedProvisionerWorkerBridge } from "./ta-pool-provision/provisioner-model-worker.js";
import type {
  ProvisionAssetRecord,
  ProvisionDeliveryReport,
  TmaReadyBundleReceipt,
  TmaSessionState,
} from "./ta-pool-provision/index.js";
import {
  createToolReviewGovernanceTrace,
  createDefaultToolReviewerLlmHook,
  createToolReviewerRuntime,
  ToolReviewerRuntime,
} from "./ta-pool-tool-review/index.js";
import type {
  ToolReviewActionLedgerEntry,
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
import type {
  CapabilityCallIntent,
  ModelInferenceIntent,
  CapabilityPortResponse,
  GoalFrameCompiled,
  GoalFrameSource,
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
  TmaExecutionLane,
  TaPoolMode,
} from "./ta-pool-types/index.js";
import {
  createProvisionRequest,
  createReviewDecision,
  matchesCapabilityPattern,
} from "./ta-pool-types/index.js";
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

export interface TaCapabilityActivationHandoff {
  source: "provision_bundle" | "provision_asset";
  status: "ready_for_review" | "activating" | "active";
  activationMode?: PoolActivationSpec["activationMode"];
  targetPool?: string;
  adapterFactoryRef?: string;
  bindingArtifactRef?: string;
  resumeEnvelopeId?: string;
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

function readStringMetadata(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

function readBooleanMetadata(
  metadata: Record<string, unknown> | undefined,
  key: string,
): boolean | undefined {
  const value = metadata?.[key];
  return typeof value === "boolean" ? value : undefined;
}

function shouldEnableDefaultTapAgentModels(
  options: AgentCoreRuntimeOptions,
): boolean {
  if (options.modelInferenceExecutor) {
    return true;
  }

  return typeof process.env.OPENAI_API_KEY === "string"
    && process.env.OPENAI_API_KEY.length > 0
    && typeof process.env.OPENAI_BASE_URL === "string"
    && process.env.OPENAI_BASE_URL.length > 0;
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
  continueResult?: ContinueTaProvisioningResult;
}

export interface ApplyTaCapabilityLifecycleInput {
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

const DEFAULT_MODEL_INFERENCE_TAP_TIMEOUT_MS = 120_000;

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

export function createRuntimeTaProfileFromPackages(
  input: AssembleCapabilityProfileFromPackagesInput,
): AgentCapabilityProfile {
  return assembleCapabilityProfileFromPackages(input);
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
    const enableDefaultTapAgentModels = shouldEnableDefaultTapAgentModels(options);
    this.taControlPlaneGateway = options.taControlPlaneGateway
      ?? (options.taProfile ? new TaControlPlaneGateway({ profile: options.taProfile }) : undefined);
    this.reviewerRuntime = options.reviewerRuntime
      ?? (this.taControlPlaneGateway ? createReviewerRuntime(
        enableDefaultTapAgentModels
          ? {
            llmReviewerHook: createDefaultReviewerLlmHook({
              executor: this.#modelInferenceExecutor,
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
    this.registerCapabilityAdapter(
      createModelInferenceCapabilityManifest(),
      createModelInferenceCapabilityAdapter({
        executor: this.#modelInferenceExecutor,
      }),
    );
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
      resultSource: readStringMetadata(input.metadata, "resultSource") === "model" ? "model" : "capability",
      final: readBooleanMetadata(input.metadata, "final"),
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

  getReviewerDurableState(requestId: string): ReviewerDurableState | undefined {
    return this.reviewerRuntime?.getDurableState(requestId);
  }

  listReviewerDurableStates(): readonly ReviewerDurableState[] {
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
    const explanation = isRecord(params.reviewDecision.metadata?.reviewerExplanation)
      ? params.reviewDecision.metadata.reviewerExplanation as Record<string, unknown>
      : undefined;
    const humanSummary = typeof explanation?.humanSummary === "string"
      ? explanation.humanSummary
      : undefined;
    const userFacingExplanation = typeof explanation?.userFacingExplanation === "string"
      ? explanation.userFacingExplanation
      : undefined;
    this.#recordTapAgentRecord(createTapAgentRecord({
      recordId: `reviewer:${params.reviewDecision.decisionId}`,
      actor: "reviewer",
      sessionId: params.accessRequest.sessionId,
      runId: params.accessRequest.runId,
      requestId: params.accessRequest.requestId,
      capabilityKey: params.accessRequest.requestedCapabilityKey,
      status: params.reviewDecision.decision,
      summary: humanSummary ?? userFacingExplanation ?? params.reviewDecision.reason,
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
    const deliveryReceipt = isRecord(params.bundle.metadata?.tmaDeliveryReceipt)
      ? params.bundle.metadata.tmaDeliveryReceipt as Record<string, unknown>
      : undefined;
    const executionSummary = isRecord(deliveryReceipt?.executionSummary)
      ? deliveryReceipt.executionSummary as Record<string, unknown>
      : undefined;
    const buildSummary = typeof params.bundle.metadata?.buildSummary === "string"
      ? params.bundle.metadata.buildSummary
      : undefined;

    this.#recordTapAgentRecord(createTapAgentRecord({
      recordId: `tma:${params.bundle.bundleId}`,
      actor: "tma",
      sessionId,
      runId,
      requestId: params.request.sourceRequestId,
      provisionId: params.request.provisionId,
      capabilityKey: params.request.requestedCapabilityKey,
      status: params.bundle.status,
      summary: params.summary
        ?? (typeof executionSummary?.summary === "string" ? executionSummary.summary : undefined)
        ?? buildSummary
        ?? `TMA produced a ${params.bundle.status} bundle for ${params.request.requestedCapabilityKey}.`,
      createdAt: params.bundle.completedAt ?? params.request.createdAt,
      metadata: {
        bundleId: params.bundle.bundleId,
        replayPolicy: params.bundle.replayPolicy,
        activationMode: params.bundle.activationSpec?.activationMode,
        ...(typeof executionSummary?.status === "string"
          ? { executionStatus: executionSummary.status }
          : {}),
        ...params.metadata,
      },
    }));
  }

  #resolveRequestedTmaLane(request: ProvisionRequest): TmaExecutionLane {
    const approvedLane = request.metadata?.approvedProvisionerLane;
    if (approvedLane === "bootstrap" || approvedLane === "extended") {
      return approvedLane;
    }

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

  async #maybeAutoContinueProvisioning(
    params: string | { provisionId: string; accessRequest?: AccessRequest },
  ): Promise<ContinueTaProvisioningResult | undefined> {
    const provisionId = typeof params === "string" ? params : params.provisionId;
    if (!this.#canAutoContinueProvisioning(provisionId)) {
      return undefined;
    }

    return this.continueTaProvisioning(provisionId);
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
    if (activationResult.status === "failed" && sessionId && runId) {
      this.#recordResumeEnvelope(createTaResumeEnvelope({
        envelopeId: `resume:activation:${provisionId}:${activationResult.attempt.attemptId}`,
        source: "activation",
        requestId: relatedReplay?.requestId ?? `${provisionId}:activation`,
        sessionId,
        runId,
        capabilityKey: currentAsset?.capabilityKey ?? asset.capabilityKey,
        requestedTier: typeof relatedReplay?.metadata?.requestedTier === "string"
          ? relatedReplay.metadata.requestedTier as TaCapabilityTier
          : "B1",
        mode: typeof relatedReplay?.metadata?.mode === "string"
          ? relatedReplay.metadata.mode as TaPoolMode
          : "balanced",
        reason: activationResult.failure?.message
          ?? `Retry activation for ${currentAsset?.capabilityKey ?? asset.capabilityKey}.`,
        metadata: {
          provisionId,
          attemptId: activationResult.attempt.attemptId,
        },
      }));
    }
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
        continueResult,
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

    await this.#ensureRunAvailable(context.intent.runId);
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
    this.#writeTapControlPlaneCheckpoint({
      sessionId: context.accessRequest.sessionId,
      runId: context.accessRequest.runId,
      reason: "manual",
      metadata: {
        sourceOperation: "human-gate-decision",
        gateId: updatedGate.gateId,
        decision: "approve",
        eventId: humanGateEvent.eventId,
        dispatchStatus: "dispatched",
      },
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
    const governanceDirective = readTapGovernanceDispatchDirective(options.metadata);

    if (governanceDirective?.matchedToolPolicy === "deny") {
      const accessRequest = this.#submitAccessRequestForIntent({
        intent,
        options,
        requestedTier,
        mode,
        reason,
        metadata: {
          governancePolicyDecision: "deny",
          governanceObjectId: governanceDirective.governanceObjectId,
          governanceRiskLevel: governanceDirective.derivedRiskLevel,
        },
      });
      const reviewDecision = createReviewDecision({
        decisionId: randomUUID(),
        requestId: accessRequest.requestId,
        decision: "denied",
        mode: accessRequest.mode,
        reason: `TAP governance policy denied ${accessRequest.requestedCapabilityKey} before execution.`,
        riskLevel: governanceDirective.derivedRiskLevel,
        plainLanguageRisk: formatPlainLanguageRisk({
          requestedAction: accessRequest.requestedAction ?? this.#describeCapabilityIntentAction(intent),
          capabilityKey: accessRequest.requestedCapabilityKey,
          riskLevel: governanceDirective.derivedRiskLevel,
          metadata: {
            governanceObjectId: governanceDirective.governanceObjectId,
            matchedToolPolicySelector: governanceDirective.matchedToolPolicySelector,
          },
        }),
        createdAt: new Date().toISOString(),
        metadata: {
          source: "tap-governance-policy",
          governanceObjectId: governanceDirective.governanceObjectId,
          matchedToolPolicySelector: governanceDirective.matchedToolPolicySelector,
        },
      });
      this.taControlPlaneGateway.consumeReviewDecision(reviewDecision);
      await this.reviewerRuntime.recordDurableState({
        request: accessRequest,
        decision: reviewDecision,
        source: "review_engine",
      });
      this.#recordReviewerAgentRecord({
        accessRequest,
        reviewDecision,
      });
      return {
        status: "denied",
        accessRequest,
        reviewDecision,
      };
    }

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
      await this.reviewerRuntime.recordDurableState({
        request: accessRequest,
        decision: reviewDecision,
        source: "routing_fast_path",
      });
      this.#recordReviewerAgentRecord({
        accessRequest,
        reviewDecision,
      });
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

    if (
      governanceDirective?.matchedToolPolicy === "review_only"
      || governanceDirective?.matchedToolPolicy === "human_gate"
      || governanceDirective?.forceHumanByRisk
    ) {
      const reviewOnlyTier = governanceDirective.matchedToolPolicy === "human_gate"
        ? "B3"
        : maxCapabilityTier(effectiveTier, "B1");
      const accessRequest = this.#submitAccessRequestForIntent({
        intent,
        options,
        requestedTier: reviewOnlyTier,
        mode,
        reason,
        metadata: {
          governanceObjectId: governanceDirective.governanceObjectId,
          governanceForceReview: true,
          governanceMatchedToolPolicy: governanceDirective.matchedToolPolicy,
          governanceRiskLevel: governanceDirective.derivedRiskLevel,
        },
      });
      return this.#completeTapReviewFlow({
        accessRequest,
        intent,
        options,
        safety,
      });
    }

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

    return this.#completeTapReviewFlow({
      accessRequest: resolved.request,
      intent,
      options,
      safety,
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

  async dispatchIntent(intent: CapabilityCallIntent): Promise<DispatchCapabilityIntentViaTaPoolResult>;
  async dispatchIntent(
    intent: ModelInferenceIntent,
  ): Promise<DispatchModelInferenceIntentResult | DispatchCapabilityIntentViaTaPoolResult>;
  async dispatchIntent(intent: CapabilityCallIntent | ModelInferenceIntent) {
    if (intent.kind === "capability_call") {
      return this.dispatchCapabilityIntentViaTaPool(
        intent,
        this.#createDefaultTaDispatchOptions(intent),
      );
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

      throw new Error(`Unsupported queued intent kind for terminal runner: ${intent.kind}`);
    }

    const fallbackAnswer =
      lastModelResult?.output
      && typeof lastModelResult.output === "object"
      && lastModelResult.output !== null
      && "text" in lastModelResult.output
        ? (lastModelResult.output as { text?: string }).text
        : undefined;

    return {
      session: this.sessionManager.loadSessionHeader(params.sessionId),
      outcome: current,
      answer: this.#readAnswerTextForRun(current.run.runId) ?? fallbackAnswer,
      capabilityDispatch: lastCapabilityDispatch,
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
    this.#kernelResultsByRun.set(
      context.runId,
      toKernelResult({
        result,
        sessionId: context.sessionId,
        runId: context.runId,
        source: context.resultSource ?? "capability",
        correlationId: context.correlationId,
      }),
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

  #submitAccessRequestForIntent(params: {
    intent: CapabilityCallIntent;
    options: DispatchCapabilityIntentViaTaPoolOptions;
    requestedTier: TaCapabilityTier;
    mode: TaPoolMode;
    reason: string;
    metadata?: Record<string, unknown>;
  }): AccessRequest {
    return this.taControlPlaneGateway!.submitAccessRequest({
      sessionId: params.intent.sessionId,
      runId: params.intent.runId,
      agentId: params.options.agentId,
      capabilityKey: params.intent.request.capabilityKey,
      reason: params.reason,
      requestedTier: params.requestedTier,
      mode: params.mode,
      taskContext: params.options.taskContext,
      requestedScope: params.options.requestedScope,
      requestedDurationMs: params.options.requestedDurationMs,
      metadata: {
        correlationId: params.intent.correlationId,
        ...(params.intent.metadata ?? {}),
        ...(params.intent.request.metadata ?? {}),
        ...(params.options.metadata ?? {}),
        ...(params.metadata ?? {}),
      },
    });
  }

  async #completeTapReviewFlow(params: {
    accessRequest: AccessRequest;
    intent: CapabilityCallIntent;
    options: DispatchCapabilityIntentViaTaPoolOptions;
    safety?: ReturnType<typeof evaluateSafetyInterception>;
    inventory?: ReviewDecisionEngineInventory;
  }): Promise<DispatchCapabilityIntentViaTaPoolResult> {
    const inventory = params.inventory ?? this.#buildTaReviewInventory();
    const reviewDecision = await this.reviewerRuntime!.submit({
      request: params.accessRequest,
      profile: this.taControlPlaneGateway!.profile,
      inventory,
    });
    this.#recordReviewerAgentRecord({
      accessRequest: params.accessRequest,
      reviewDecision,
    });
    const consumed = this.taControlPlaneGateway!.consumeReviewDecision(reviewDecision);

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
        if (continueResult?.dispatchResult) {
          return {
            ...continueResult.dispatchResult,
            accessRequest: params.accessRequest,
            reviewDecision,
            provisionRequest,
            provisionBundle,
            activation: continueResult.activation ?? continueResult.dispatchResult.activation ?? activation,
            replay: continueResult.dispatchResult.replay ?? replay,
            continueResult,
            safety: params.safety?.outcome === "allow" ? undefined : params.safety,
          };
        }
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
        replay: provisionBundle.status === "ready"
          ? replay
          : undefined,
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
    const toolReviewWorkOrder = this.#findLatestToolReviewerTmaWorkOrder({
      capabilityKey: params.request.requestedCapabilityKey,
      provisionId: params.request.provisionId,
    });

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
        toolReviewWorkOrder,
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

  #createToolReviewRequestRef(accessRequest: AccessRequest) {
    return {
      requestId: accessRequest.requestId,
      sessionId: accessRequest.sessionId,
      runId: accessRequest.runId,
      requestedCapabilityKey: accessRequest.requestedCapabilityKey,
      requestedTier: accessRequest.requestedTier,
      mode: accessRequest.mode,
      canonicalMode: accessRequest.canonicalMode,
      riskLevel: accessRequest.riskLevel,
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

  #findCurrentProvisionAsset(capabilityKey: string): ProvisionAssetRecord | undefined {
    if (!this.provisionerRuntime) {
      return undefined;
    }

    return [...this.provisionerRuntime.assetIndex.listCurrent()]
      .filter((asset) => asset.capabilityKey === capabilityKey)
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0];
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
      resumeEnvelopeId: params.asset ? this.getTaActivationResumeEnvelope(params.asset.provisionId)?.envelopeId : undefined,
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
              ? "Replay is staged for automatic continue after verification succeeds."
              : "Replay is staged for re-review before dispatch once activation is ready."),
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
            ? "Wait for a verification-passed trigger or an explicit runtime continue call."
            : "Resume the replay envelope to re-enter reviewer and dispatch.",
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
      priority: toIntentPriority(envelope.intentRequest!.priority),
      correlationId: envelope.intentRequest!.intentId,
      request: {
        requestId: envelope.intentRequest!.requestId,
        intentId: envelope.intentRequest!.intentId,
        sessionId: envelope.sessionId,
        runId: envelope.runId,
        capabilityKey: envelope.intentRequest!.capabilityKey,
        input: envelope.intentRequest!.input,
        priority: toIntentPriority(envelope.intentRequest!.priority),
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

  #syncSessionFromRun(run: RunTransitionOutcome["run"]): void {
    if (run.status === "completed" || run.status === "failed" || run.status === "cancelled") {
      this.sessionManager.setActiveRun(run.sessionId, undefined);
      return;
    }

    this.sessionManager.setActiveRun(run.sessionId, run.runId);
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
      // Let the later dispatch path surface the truthful failure if recovery is impossible.
    }
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
    const provider = readStringMetadata(intent.frame.metadata, "provider") ?? "openai";
    const model = readStringMetadata(intent.frame.metadata, "model") ?? "unknown";
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
        timeoutMs: DEFAULT_MODEL_INFERENCE_TAP_TIMEOUT_MS,
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
      reason: `Model inference via ${readStringMetadata(intent.frame.metadata, "provider") ?? "openai"}:${readStringMetadata(intent.frame.metadata, "model") ?? "unknown"} requested by runtime.`,
      metadata: {
        tapGovernanceDirective: governanceDirective,
        resultSource: "model",
        final: true,
        sourceIntentKind: "model_inference",
      },
    };
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
