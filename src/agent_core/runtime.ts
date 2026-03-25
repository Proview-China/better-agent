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
  assembleCapabilityProfileFromPackages,
  type AssembleCapabilityProfileFromPackagesInput,
} from "./ta-pool-model/index.js";
import {
  activateProvisionAsset,
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
import { createToolReviewerRuntime, ToolReviewerRuntime } from "./ta-pool-tool-review/index.js";
import { evaluateSafetyInterception, type TaSafetyInterceptorConfig } from "./ta-pool-safety/index.js";
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
    this.toolReviewerRuntime = options.toolReviewerRuntime
      ?? (this.taControlPlaneGateway ? createToolReviewerRuntime() : undefined);
    this.provisionerRuntime = options.provisionerRuntime
      ?? (this.taControlPlaneGateway ? createProvisionerRuntime() : undefined);
    this.#taSafetyConfig = options.taSafetyConfig;
    this.runCoordinator = options.runCoordinator ?? new AgentRunCoordinator({
      journal: this.journal,
      checkpointStore: this.checkpointStore,
    });
    this.sessionManager = options.sessionManager ?? new SessionManager();
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

  listTaResumeEnvelopes() {
    return [...this.#taResumeEnvelopes.values()];
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

  hydrateRecoveredTapRuntimeSnapshot(snapshot: TapPoolRuntimeSnapshot): void {
    const hydrated = hydrateRecoveredTapRuntimeState(snapshot);
    this.#taHumanGates.clear();
    for (const [gateId, gate] of hydrated.humanGates) {
      this.#taHumanGates.set(gateId, gate);
    }
    this.#taHumanGateContexts.clear();
    for (const [gateId, context] of hydrated.humanGateContexts) {
      this.#taHumanGateContexts.set(gateId, {
        intent: context.intent,
        accessRequest: context.accessRequest,
        reviewDecision: context.reviewDecision,
        options: context.options,
      });
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
      this.#taResumeEnvelopes.set(envelopeId, envelope);
    }
    this.reviewerRuntime?.hydrateDurableSnapshot(hydrated.reviewerDurableSnapshot);
    this.toolReviewerRuntime?.hydrateSnapshots(hydrated.toolReviewerSessions);
    if (hydrated.provisionerDurableSnapshot) {
      this.provisionerRuntime?.restoreDurableState(hydrated.provisionerDurableSnapshot);
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

  async dispatchIntent(intent: CapabilityCallIntent): Promise<DispatchCapabilityIntentViaTaPoolResult>;
  async dispatchIntent(intent: ModelInferenceIntent): Promise<DispatchModelInferenceIntentResult>;
  async dispatchIntent(intent: CapabilityCallIntent | ModelInferenceIntent) {
    if (intent.kind === "capability_call") {
      return this.dispatchCapabilityIntentViaTaPool(
        intent,
        this.#createDefaultTaDispatchOptions(intent),
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

    return {
      session: this.sessionManager.loadSessionHeader(params.sessionId),
      outcome: current,
      answer:
        lastModelResult?.output && typeof lastModelResult.output === "object" && lastModelResult.output !== null && "text" in lastModelResult.output
          ? (lastModelResult.output as { text?: string }).text
          : undefined,
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
      },
    }));
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
