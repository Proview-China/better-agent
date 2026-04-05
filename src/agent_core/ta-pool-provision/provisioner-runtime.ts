import { randomUUID } from "node:crypto";

import {
  createPoolActivationSpec,
  createProvisionArtifactBundle,
  type ProvisionArtifactBundle,
  type ProvisionArtifactRef,
  type ProvisionRequest,
} from "../ta-pool-types/index.js";
import { ProvisionAssetIndex } from "./provision-asset-index.js";
import type { ProvisionAssetIndexSnapshot } from "./provision-asset-index.js";
import {
  createDefaultProvisionerWorkerOutput,
  createProvisionerWorkerBridgeInput,
  defaultProvisionerWorkerBridge,
  validateProvisionerWorkerOutput,
  type ProvisionerWorkerBridge,
} from "./provisioner-worker-bridge.js";
import { ProvisionRegistry } from "./provision-registry.js";
import type { ProvisionRegistrySnapshot } from "./provision-registry.js";
import { createTmaPlannerOutput } from "./tma-planner.js";
import { executeTmaPlan } from "./tma-executor.js";
import {
  createProvisionerDurableSnapshot,
  restoreProvisionerBundleHistory,
  type ProvisionBundleHistorySnapshotEntry,
  type ProvisionerDurableSnapshot,
} from "./provision-durable-snapshot.js";
import {
  cloneTmaSessionState,
  markTmaSessionCompleted,
  type TmaSessionState,
} from "./tma-session-state.js";
import { createTmaReadyBundleReceipt } from "./tma-delivery-receipt.js";
import type {
  TmaReadyBundleExecutionSummary,
  TmaReadyBundleVerificationItem,
  TmaReadyBundleVerificationSummary,
} from "./tma-delivery-receipt.js";

export interface ProvisionBuildArtifacts {
  toolArtifact: ProvisionArtifactRef;
  bindingArtifact: ProvisionArtifactRef;
  verificationArtifact: ProvisionArtifactRef;
  usageArtifact: ProvisionArtifactRef;
  metadata?: Record<string, unknown>;
}

export interface ProvisionerRuntimeOptions {
  registry?: ProvisionRegistry;
  assetIndex?: ProvisionAssetIndex;
  workerBridge?: ProvisionerWorkerBridge;
  builder?: (request: ProvisionRequest) => Promise<ProvisionBuildArtifacts>;
  clock?: () => Date;
  idFactory?: () => string;
}

interface SubmitProvisionRequestOptions {
  resumedFromSessionId?: string;
}

export interface ProvisionerRuntimeLike {
  submit(request: ProvisionRequest): Promise<ProvisionArtifactBundle>;
  getBundleHistory(provisionId: string): readonly ProvisionArtifactBundle[];
  listResumableTmaSessions(): readonly TmaSessionState[];
  resumeTmaSession(sessionId: string): Promise<ProvisionArtifactBundle | undefined>;
}

export interface ProvisionerRuntimeDurableState {
  registry: ProvisionRegistrySnapshot;
  assetIndex: ProvisionAssetIndexSnapshot;
  bundleHistory: ProvisionBundleHistorySnapshotEntry[];
  tmaSessions?: TmaSessionState[];
}

export interface ProvisionDeliveryReport {
  provisionId: string;
  status: "missing" | ProvisionArtifactBundle["status"];
  latestBundleId?: string;
  capabilityKey?: string;
  replayPolicy?: ProvisionArtifactBundle["replayPolicy"];
  activationMode?: NonNullable<ProvisionArtifactBundle["activationSpec"]>["activationMode"];
  artifactRefs: {
    tool?: string;
    binding?: string;
    verification?: string;
    usage?: string;
  };
  verificationSummary?: TmaReadyBundleVerificationSummary;
  verificationItems?: TmaReadyBundleVerificationItem[];
  executionSummary?: TmaReadyBundleExecutionSummary;
  rollbackHandleId?: string;
  tmaSessionIds: string[];
  resumableSessionIds: string[];
  recommendedNextStep: string;
  summary: string;
  generatedAt: string;
}

function defaultMockBuilder(request: ProvisionRequest): Promise<ProvisionBuildArtifacts> {
  const capabilityKey = request.requestedCapabilityKey;
  return Promise.resolve({
    toolArtifact: {
      artifactId: `${capabilityKey}:tool`,
      kind: "tool",
      ref: `mock-tools/${capabilityKey}`,
    },
    bindingArtifact: {
      artifactId: `${capabilityKey}:binding`,
      kind: "binding",
      ref: `mock-bindings/${capabilityKey}`,
    },
    verificationArtifact: {
      artifactId: `${capabilityKey}:verification`,
      kind: "verification",
      ref: `mock-smoke/${capabilityKey}`,
    },
    usageArtifact: {
      artifactId: `${capabilityKey}:usage`,
      kind: "usage",
      ref: `mock-usage/${capabilityKey}.md`,
    },
    metadata: {
      builder: "mock",
    },
  });
}

function adaptLegacyBuilder(
  builder: (request: ProvisionRequest) => Promise<ProvisionBuildArtifacts>,
): ProvisionerWorkerBridge {
  return async (input) => {
    const artifacts = await builder(input.request);
    const defaultOutput = createDefaultProvisionerWorkerOutput(input);
    return {
      ...defaultOutput,
      toolArtifact: artifacts.toolArtifact,
      bindingArtifact: artifacts.bindingArtifact,
      verificationArtifact: artifacts.verificationArtifact,
      usageArtifact: artifacts.usageArtifact,
      metadata: {
        ...(defaultOutput.metadata ?? {}),
        ...(artifacts.metadata ?? {}),
        bridgeImplementation: "legacy-builder-adapter",
      },
    };
  };
}

export class ProvisionerRuntime implements ProvisionerRuntimeLike {
  readonly registry: ProvisionRegistry;
  readonly assetIndex: ProvisionAssetIndex;
  readonly #workerBridge: ProvisionerWorkerBridge;
  readonly #clock: () => Date;
  readonly #idFactory: () => string;
  readonly #bundleHistory = new Map<string, ProvisionArtifactBundle[]>();
  readonly #tmaSessions = new Map<string, TmaSessionState>();

  constructor(options: ProvisionerRuntimeOptions = {}) {
    this.registry = options.registry ?? new ProvisionRegistry();
    this.assetIndex = options.assetIndex ?? new ProvisionAssetIndex();
    this.#workerBridge = options.workerBridge
      ?? (options.builder ? adaptLegacyBuilder(options.builder) : defaultProvisionerWorkerBridge);
    this.#clock = options.clock ?? (() => new Date());
    this.#idFactory = options.idFactory ?? randomUUID;
  }

  async submit(request: ProvisionRequest): Promise<ProvisionArtifactBundle> {
    return this.#submitProvisionRequest(request);
  }

  async #submitProvisionRequest(
    request: ProvisionRequest,
    options: SubmitProvisionRequestOptions = {},
  ): Promise<ProvisionArtifactBundle> {
    this.registry.registerRequest(request);

    const buildingBundle = createProvisionArtifactBundle({
      bundleId: this.#idFactory(),
      provisionId: request.provisionId,
      status: "building",
      metadata: {
        source: "provisioner-runtime",
        requestedCapabilityKey: request.requestedCapabilityKey,
      },
    });
    this.#recordBundle(buildingBundle);

    try {
      const planner = createTmaPlannerOutput(request);
      this.#tmaSessions.set(planner.sessionState.sessionId, cloneTmaSessionState(planner.sessionState));
      const bridgeInput = createProvisionerWorkerBridgeInput(request);
      const output = await this.#workerBridge(bridgeInput);
      validateProvisionerWorkerOutput(output);
      const completedAt = this.#clock().toISOString();
      const executor = executeTmaPlan({
        plan: planner.buildPlan,
        lane: planner.lane,
        startedAt: request.createdAt,
        completedAt,
        producedArtifactRefs: [
          output.toolArtifact.ref ?? output.toolArtifact.artifactId,
          output.bindingArtifact.ref ?? output.bindingArtifact.artifactId,
          output.verificationArtifact.ref ?? output.verificationArtifact.artifactId,
          output.usageArtifact.ref ?? output.usageArtifact.artifactId,
        ],
        verificationRefs: [
          output.verificationArtifact.ref ?? output.verificationArtifact.artifactId,
        ],
        sessionState: planner.sessionState,
      });
      const plannerSession = markTmaSessionCompleted(planner.sessionState, {
        updatedAt: completedAt,
        reportId: executor.report.reportId,
        metadata: {
          phaseResult: "ready_for_executor_delivery",
          executorSessionId: executor.sessionState.sessionId,
          resumedFromSessionId: options.resumedFromSessionId,
        },
      });
      this.#tmaSessions.set(plannerSession.sessionId, cloneTmaSessionState(plannerSession));
      this.#tmaSessions.set(executor.sessionState.sessionId, cloneTmaSessionState(executor.sessionState));
      const deliveryReceipt = createTmaReadyBundleReceipt({
        provisionId: request.provisionId,
        requestedCapabilityKey: request.requestedCapabilityKey,
        lane: planner.lane,
        readyAt: completedAt,
        plannerSessionId: plannerSession.sessionId,
        executorSessionId: executor.sessionState.sessionId,
        resumedFromSessionId: options.resumedFromSessionId,
        toolArtifact: output.toolArtifact,
        bindingArtifact: output.bindingArtifact,
        verificationArtifact: output.verificationArtifact,
        usageArtifact: output.usageArtifact,
        verificationEvidence: executor.verificationEvidence,
        rollbackHandle: executor.rollbackHandle,
        report: executor.report,
      });
      const readyBundle = createProvisionArtifactBundle({
        bundleId: this.#idFactory(),
        provisionId: request.provisionId,
        status: "ready",
        toolArtifact: output.toolArtifact,
        bindingArtifact: output.bindingArtifact,
        verificationArtifact: output.verificationArtifact,
        usageArtifact: output.usageArtifact,
        activationSpec: createPoolActivationSpec(output.activationPayload),
        replayPolicy: output.replayRecommendation.policy,
        completedAt,
        metadata: {
          source: "provisioner-runtime",
          buildSummary: output.buildSummary,
          workerBridge: true,
          workerLane: bridgeInput.lane,
          workerPromptPackId: bridgeInput.promptPack.promptPackId,
          replayRecommendation: output.replayRecommendation,
          tmaPlanner: {
            lane: planner.lane,
            planId: planner.buildPlan.planId,
            promptPackId: planner.promptPack.promptPackId,
            summary: planner.buildPlan.summary,
          },
          tmaExecutor: {
            report: executor.report,
            verificationEvidence: executor.verificationEvidence,
            rollbackHandle: executor.rollbackHandle,
            sessionId: executor.sessionState.sessionId,
          },
          tmaDeliveryReceipt: deliveryReceipt,
          ...(output.metadata ?? {}),
        },
      });
      this.#recordBundle(readyBundle);
      return readyBundle;
    } catch (error) {
      const failedBundle = createProvisionArtifactBundle({
        bundleId: this.#idFactory(),
        provisionId: request.provisionId,
        status: "failed",
        completedAt: this.#clock().toISOString(),
        error: {
          code: "ta_pool_provision_build_failed",
          message: error instanceof Error ? error.message : String(error),
        },
        metadata: {
          source: "provisioner-runtime",
          requestedCapabilityKey: request.requestedCapabilityKey,
        },
      });
      this.#recordBundle(failedBundle);
      return failedBundle;
    }
  }

  getBundleHistory(provisionId: string): readonly ProvisionArtifactBundle[] {
    return this.#bundleHistory.get(provisionId) ?? [];
  }

  createDeliveryReport(provisionId: string): ProvisionDeliveryReport {
    const history = this.getBundleHistory(provisionId);
    const latestBundle = history.at(-1);
    const record = this.registry.get(provisionId);
    const relatedSessions = this.listTmaSessions().filter((session) => session.provisionId === provisionId);
    const resumableSessionIds = relatedSessions
      .filter((session) => session.status === "resumable")
      .map((session) => session.sessionId);
    const deliveryReceipt = latestBundle?.metadata?.tmaDeliveryReceipt as
      | {
        verificationSummary?: TmaReadyBundleVerificationSummary;
        verificationItems?: TmaReadyBundleVerificationItem[];
        executionSummary?: TmaReadyBundleExecutionSummary;
        rollbackHandleId?: string;
      }
      | undefined;
    const summary = !latestBundle
      ? `No provision bundle exists yet for ${provisionId}.`
      : latestBundle.status === "ready"
        ? deliveryReceipt?.executionSummary?.summary
          ? `Provision bundle ${latestBundle.bundleId} is ready. ${deliveryReceipt.executionSummary.summary}`
          : `Provision bundle ${latestBundle.bundleId} is ready with tool, binding, verification, and usage artifacts attached.`
        : latestBundle.status === "failed"
          ? `Provision bundle ${latestBundle.bundleId} failed and should be inspected before retrying.`
          : `Provision bundle ${latestBundle.bundleId} is still building.`;
    const recommendedNextStep = !latestBundle
      ? "Submit a provision request first."
      : latestBundle.status === "ready"
        ? resumableSessionIds.length > 0
          ? "Bundle is ready, but resumable TMA sessions still exist; inspect whether they should be resumed or closed."
          : deliveryReceipt?.verificationSummary?.failed
            ? "Bundle is ready but verification contains failures; tool reviewer should inspect the evidence before activation or replay planning."
            : "Bundle is ready for tool reviewer quality checks, activation review, and replay planning."
        : latestBundle.status === "failed"
          ? resumableSessionIds.length > 0
            ? "Resume the TMA session or fix the worker bridge inputs before retrying."
            : "Inspect the failure bundle and rebuild the capability package."
          : "Wait for the current build to finish or inspect the active worker lane.";

    return {
      provisionId,
      status: latestBundle?.status ?? "missing",
      latestBundleId: latestBundle?.bundleId,
      capabilityKey: record?.request.requestedCapabilityKey,
      replayPolicy: latestBundle?.replayPolicy,
      activationMode: latestBundle?.activationSpec?.activationMode,
      artifactRefs: {
        tool: latestBundle?.toolArtifact?.ref,
        binding: latestBundle?.bindingArtifact?.ref,
        verification: latestBundle?.verificationArtifact?.ref,
        usage: latestBundle?.usageArtifact?.ref,
      },
      verificationSummary: deliveryReceipt?.verificationSummary,
      verificationItems: deliveryReceipt?.verificationItems,
      executionSummary: deliveryReceipt?.executionSummary,
      rollbackHandleId: deliveryReceipt?.rollbackHandleId,
      tmaSessionIds: relatedSessions.map((session) => session.sessionId),
      resumableSessionIds,
      recommendedNextStep,
      summary,
      generatedAt: this.#clock().toISOString(),
    };
  }

  listDeliveryReports(): readonly ProvisionDeliveryReport[] {
    return this.registry.list().map((entry) => this.createDeliveryReport(entry.request.provisionId));
  }

  getTmaSession(sessionId: string): TmaSessionState | undefined {
    const state = this.#tmaSessions.get(sessionId);
    return state ? cloneTmaSessionState(state) : undefined;
  }

  listTmaSessions(): readonly TmaSessionState[] {
    return [...this.#tmaSessions.values()].map(cloneTmaSessionState);
  }

  listResumableTmaSessions(): readonly TmaSessionState[] {
    return this.listTmaSessions().filter((session) => session.status === "resumable");
  }

  async resumeTmaSession(sessionId: string): Promise<ProvisionArtifactBundle | undefined> {
    const session = this.#tmaSessions.get(sessionId);
    if (!session || session.status !== "resumable") {
      return undefined;
    }
    const record = this.registry.get(session.provisionId);
    if (!record) {
      return undefined;
    }

    return this.#submitProvisionRequest(record.request, {
      resumedFromSessionId: sessionId,
    });
  }

  serializeDurableState(): ProvisionerDurableSnapshot {
    return createProvisionerDurableSnapshot({
      registry: this.registry.serialize(),
      assetIndex: this.assetIndex.serialize(),
      bundleHistory: [...this.#bundleHistory.entries()].map(([provisionId, bundles]) => ({
        provisionId,
        bundles,
      })),
      tmaSessions: [...this.listTmaSessions()],
    });
  }

  restoreDurableState(snapshot: ProvisionerRuntimeDurableState): void {
    this.registry.restore(snapshot.registry);
    this.assetIndex.restore(snapshot.assetIndex);
    this.#bundleHistory.clear();
    for (const [provisionId, bundles] of restoreProvisionerBundleHistory(snapshot.bundleHistory)) {
      this.#bundleHistory.set(provisionId, bundles);
    }
    this.#tmaSessions.clear();
    for (const session of snapshot.tmaSessions ?? []) {
      this.#tmaSessions.set(session.sessionId, cloneTmaSessionState(session));
    }
  }

  static fromDurableState(
    snapshot: ProvisionerRuntimeDurableState,
    options: ProvisionerRuntimeOptions = {},
  ): ProvisionerRuntime {
    const runtime = new ProvisionerRuntime(options);
    runtime.restoreDurableState(snapshot);
    return runtime;
  }

  #recordBundle(bundle: ProvisionArtifactBundle): void {
    const history = this.#bundleHistory.get(bundle.provisionId) ?? [];
    history.push(bundle);
    this.#bundleHistory.set(bundle.provisionId, history);
    this.registry.attachBundle(bundle);
    const record = this.registry.get(bundle.provisionId);
    if (record) {
      this.assetIndex.ingest(record);
    }
  }
}

export function createProvisionerRuntime(
  options: ProvisionerRuntimeOptions = {},
): ProvisionerRuntime {
  return new ProvisionerRuntime(options);
}
