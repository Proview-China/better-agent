import { randomUUID } from "node:crypto";

import { CheckpointStore } from "./checkpoint/index.js";
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
import {
  createExecutionRequest,
  createInvocationPlanFromGrant,
  TaControlPlaneGateway,
} from "./ta-pool-runtime/index.js";
import { createReviewerRuntime, ReviewerRuntime } from "./ta-pool-review/index.js";
import { createProvisionerRuntime, ProvisionerRuntime } from "./ta-pool-provision/index.js";
import { evaluateSafetyInterception, type TaSafetyInterceptorConfig } from "./ta-pool-safety/index.js";
import { toProvisionRequestFromReviewDecision, type ReviewDecisionEngineInventory } from "./ta-pool-review/index.js";
import type {
  CapabilityCallIntent,
  ModelInferenceIntent,
  CapabilityPortResponse,
  GoalFrameCompiled,
  GoalFrameSource,
  KernelEvent,
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
  ProvisionArtifactBundle,
  ProvisionRequest,
  ReviewDecision,
  TaCapabilityTier,
  TaPoolMode,
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
  | "escalated_to_human"
  | "redirected_to_provisioning"
  | "provisioned"
  | "provisioning_failed"
  | "blocked"
  | "interrupted";

export interface DispatchCapabilityIntentViaTaPoolResult {
  status: TaCapabilityAssemblyStatus;
  grant?: CapabilityGrant;
  accessRequest?: AccessRequest;
  reviewDecision?: ReviewDecision;
  provisionRequest?: ProvisionRequest;
  provisionBundle?: ProvisionArtifactBundle;
  dispatch?: DispatchCapabilityPlanResult;
  safety?: ReturnType<typeof evaluateSafetyInterception>;
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
  readonly #taSafetyConfig?: TaSafetyInterceptorConfig;
  readonly #modelInferenceExecutor: (params: { intent: ModelInferenceIntent }) => Promise<ModelInferenceExecutionResult>;
  readonly #capabilityExecutionContext = new Map<string, DispatchCapabilityPlanInput>();
  readonly #capabilityPreparedContext = new Map<string, DispatchCapabilityPlanInput>();

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
      }),
      sessionId: input.sessionId,
      runId: input.runId,
      requestId,
      correlationId: input.intentId,
      resultSource: "capability",
    });
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
      return {
        status: "escalated_to_human",
        safety,
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
      const dispatch = await this.dispatchTaCapabilityGrant({
        grant: resolved.grant,
        sessionId: intent.sessionId,
        runId: intent.runId,
        intentId: intent.intentId,
        requestId: intent.request.requestId,
        capabilityKey: intent.request.capabilityKey,
        input: intent.request.input,
        priority: intent.request.priority,
        timeoutMs: intent.request.timeoutMs,
        metadata: intent.request.metadata,
      });
      return {
        status: "dispatched",
        grant: resolved.grant,
        dispatch,
        safety: safety.outcome === "allow" ? undefined : safety,
      };
    }

    const accessRequest = resolved.request;
    const reviewDecision = await this.reviewerRuntime.submit({
      request: accessRequest,
      profile: this.taControlPlaneGateway.profile,
      inventory: this.#buildTaReviewInventory(),
    });
    const consumed = this.taControlPlaneGateway.consumeReviewDecision(reviewDecision);

    if (consumed.grant) {
      const dispatch = await this.dispatchTaCapabilityGrant({
        grant: consumed.grant,
        sessionId: intent.sessionId,
        runId: intent.runId,
        intentId: intent.intentId,
        requestId: intent.request.requestId,
        capabilityKey: intent.request.capabilityKey,
        input: intent.request.input,
        priority: intent.request.priority,
        timeoutMs: intent.request.timeoutMs,
        metadata: intent.request.metadata,
      });
      return {
        status: "dispatched",
        accessRequest,
        reviewDecision,
        grant: consumed.grant,
        dispatch,
        safety: safety.outcome === "allow" ? undefined : safety,
      };
    }

    if (reviewDecision.decision === "redirected_to_provisioning") {
      const provisionRequest = toProvisionRequestFromReviewDecision({
        request: accessRequest,
        decision: reviewDecision,
        provisionId: `${reviewDecision.decisionId}:provision`,
        createdAt: new Date().toISOString(),
      });
      const provisionBundle = await this.provisionerRuntime.submit(provisionRequest);
      return {
        status: provisionBundle.status === "ready" ? "provisioned" : "provisioning_failed",
        accessRequest,
        reviewDecision,
        provisionRequest,
        provisionBundle,
        safety: safety.outcome === "allow" ? undefined : safety,
      };
    }

    return {
      status: reviewDecision.decision as Exclude<
        DispatchCapabilityIntentViaTaPoolResult["status"],
        "dispatched" | "provisioned" | "provisioning_failed" | "blocked" | "interrupted"
      >,
      accessRequest,
      reviewDecision,
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

  async dispatchIntent(intent: CapabilityCallIntent | ModelInferenceIntent) {
    if (intent.kind === "capability_call") {
      return this.dispatchCapabilityIntent(intent);
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
        const dispatched = await this.dispatchCapabilityIntent(intent);
        if (!dispatched.runOutcome) {
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
    this.#capabilityExecutionContext.delete(result.executionId);
    if (preparedId) {
      this.#capabilityPreparedContext.delete(preparedId);
    }
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

    return {
      availableCapabilityKeys,
      pendingProvisionKeys,
    };
  }

  #syncSessionFromRun(run: RunTransitionOutcome["run"]): void {
    if (run.status === "completed" || run.status === "failed" || run.status === "cancelled") {
      this.sessionManager.setActiveRun(run.sessionId, undefined);
      return;
    }

    this.sessionManager.setActiveRun(run.sessionId, run.runId);
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
