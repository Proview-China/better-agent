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
  type TmaSessionState,
} from "./tma-session-state.js";

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

export interface ProvisionerRuntimeLike {
  submit(request: ProvisionRequest): Promise<ProvisionArtifactBundle>;
  getBundleHistory(provisionId: string): readonly ProvisionArtifactBundle[];
}

export interface ProvisionerRuntimeDurableState {
  registry: ProvisionRegistrySnapshot;
  assetIndex: ProvisionAssetIndexSnapshot;
  bundleHistory: ProvisionBundleHistorySnapshotEntry[];
  tmaSessions?: TmaSessionState[];
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
      this.#tmaSessions.set(executor.sessionState.sessionId, cloneTmaSessionState(executor.sessionState));
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
          },
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

  getTmaSession(sessionId: string): TmaSessionState | undefined {
    const state = this.#tmaSessions.get(sessionId);
    return state ? cloneTmaSessionState(state) : undefined;
  }

  listTmaSessions(): readonly TmaSessionState[] {
    return [...this.#tmaSessions.values()].map(cloneTmaSessionState);
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
