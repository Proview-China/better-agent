import { randomUUID } from "node:crypto";

import {
  createProvisionArtifactBundle,
  type ProvisionArtifactBundle,
  type ProvisionArtifactRef,
  type ProvisionRequest,
} from "../ta-pool-types/index.js";
import { ProvisionRegistry } from "./provision-registry.js";

export interface ProvisionBuildArtifacts {
  toolArtifact: ProvisionArtifactRef;
  bindingArtifact: ProvisionArtifactRef;
  verificationArtifact: ProvisionArtifactRef;
  usageArtifact: ProvisionArtifactRef;
  metadata?: Record<string, unknown>;
}

export interface ProvisionerRuntimeOptions {
  registry?: ProvisionRegistry;
  builder?: (request: ProvisionRequest) => Promise<ProvisionBuildArtifacts>;
  clock?: () => Date;
  idFactory?: () => string;
}

export interface ProvisionerRuntimeLike {
  submit(request: ProvisionRequest): Promise<ProvisionArtifactBundle>;
  getBundleHistory(provisionId: string): readonly ProvisionArtifactBundle[];
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

export class ProvisionerRuntime implements ProvisionerRuntimeLike {
  readonly registry: ProvisionRegistry;
  readonly #builder: (request: ProvisionRequest) => Promise<ProvisionBuildArtifacts>;
  readonly #clock: () => Date;
  readonly #idFactory: () => string;
  readonly #bundleHistory = new Map<string, ProvisionArtifactBundle[]>();

  constructor(options: ProvisionerRuntimeOptions = {}) {
    this.registry = options.registry ?? new ProvisionRegistry();
    this.#builder = options.builder ?? defaultMockBuilder;
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
      const artifacts = await this.#builder(request);
      const readyBundle = createProvisionArtifactBundle({
        bundleId: this.#idFactory(),
        provisionId: request.provisionId,
        status: "ready",
        toolArtifact: artifacts.toolArtifact,
        bindingArtifact: artifacts.bindingArtifact,
        verificationArtifact: artifacts.verificationArtifact,
        usageArtifact: artifacts.usageArtifact,
        completedAt: this.#clock().toISOString(),
        metadata: {
          source: "provisioner-runtime",
          ...(artifacts.metadata ?? {}),
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

  #recordBundle(bundle: ProvisionArtifactBundle): void {
    const history = this.#bundleHistory.get(bundle.provisionId) ?? [];
    history.push(bundle);
    this.#bundleHistory.set(bundle.provisionId, history);
    this.registry.attachBundle(bundle);
  }
}

export function createProvisionerRuntime(
  options: ProvisionerRuntimeOptions = {},
): ProvisionerRuntime {
  return new ProvisionerRuntime(options);
}
