import type {
  ProvisionArtifactBundle,
  ProvisionRequest,
} from "../ta-pool-types/index.js";

export interface ProvisionRegistryRecord {
  request: ProvisionRequest;
  bundle?: ProvisionArtifactBundle;
  bundleHistory: ProvisionArtifactBundle[];
}

export type ProvisionRegistryEntry = ProvisionRegistryRecord;

export interface ProvisionRegistrySnapshotRecord {
  request: ProvisionRequest;
  bundle?: ProvisionArtifactBundle;
  bundleHistory: ProvisionArtifactBundle[];
}

export interface ProvisionRegistrySnapshot {
  records: ProvisionRegistrySnapshotRecord[];
}

function cloneBundle(bundle: ProvisionArtifactBundle): ProvisionArtifactBundle {
  return {
    ...bundle,
    toolArtifact: bundle.toolArtifact ? { ...bundle.toolArtifact } : undefined,
    bindingArtifact: bundle.bindingArtifact ? { ...bundle.bindingArtifact } : undefined,
    verificationArtifact: bundle.verificationArtifact ? { ...bundle.verificationArtifact } : undefined,
    usageArtifact: bundle.usageArtifact ? { ...bundle.usageArtifact } : undefined,
    activationSpec: bundle.activationSpec
      ? {
        ...bundle.activationSpec,
        manifestPayload: { ...bundle.activationSpec.manifestPayload },
        bindingPayload: { ...bundle.activationSpec.bindingPayload },
        rollbackHandle: bundle.activationSpec.rollbackHandle
          ? { ...bundle.activationSpec.rollbackHandle }
          : undefined,
        metadata: bundle.activationSpec.metadata
          ? { ...bundle.activationSpec.metadata }
          : undefined,
      }
      : undefined,
    error: bundle.error ? { ...bundle.error } : undefined,
    metadata: bundle.metadata ? { ...bundle.metadata } : undefined,
  };
}

function cloneRequest(request: ProvisionRequest): ProvisionRequest {
  return {
    ...request,
    requiredVerification: request.requiredVerification
      ? [...request.requiredVerification]
      : undefined,
    expectedArtifacts: request.expectedArtifacts
      ? [...request.expectedArtifacts]
      : undefined,
    metadata: request.metadata ? { ...request.metadata } : undefined,
  };
}

function cloneRecord(record: ProvisionRegistryRecord): ProvisionRegistryRecord {
  return {
    request: cloneRequest(record.request),
    bundle: record.bundle ? cloneBundle(record.bundle) : undefined,
    bundleHistory: record.bundleHistory.map(cloneBundle),
  };
}

export class ProvisionRegistry {
  readonly #records = new Map<string, ProvisionRegistryRecord>();

  registerRequest(request: ProvisionRequest): void {
    const existing = this.#records.get(request.provisionId);
    this.#records.set(request.provisionId, {
      request: cloneRequest(request),
      bundle: existing?.bundle ? cloneBundle(existing.bundle) : undefined,
      bundleHistory: existing?.bundleHistory.map(cloneBundle) ?? [],
    });
  }

  attachBundle(bundle: ProvisionArtifactBundle): void {
    const existing = this.#records.get(bundle.provisionId);
    const nextBundle = cloneBundle(bundle);
    this.#records.set(bundle.provisionId, {
      request: existing?.request ? cloneRequest(existing.request) : {
        provisionId: bundle.provisionId,
        sourceRequestId: bundle.provisionId,
        requestedCapabilityKey: bundle.toolArtifact?.kind ?? "unknown",
        requestedTier: "B1",
        reason: "synthetic provision request",
        createdAt: bundle.completedAt ?? new Date().toISOString(),
      },
      bundle: nextBundle,
      bundleHistory: [
        ...(existing?.bundleHistory.map(cloneBundle) ?? []),
        nextBundle,
      ],
    });
  }

  get(provisionId: string): ProvisionRegistryRecord | undefined {
    const record = this.#records.get(provisionId);
    return record ? cloneRecord(record) : undefined;
  }

  list(): readonly ProvisionRegistryRecord[] {
    return [...this.#records.values()].map(cloneRecord);
  }

  listReady(): readonly ProvisionRegistryRecord[] {
    return this.list().filter((entry) => entry.bundle?.status === "ready");
  }

  supersede(provisionId: string, replacement: ProvisionArtifactBundle): void {
    const existing = this.#records.get(provisionId);
    if (existing?.bundle) {
      const superseded: ProvisionArtifactBundle = {
        ...existing.bundle,
        status: "superseded" as const,
      };
      existing.bundle = superseded;
      if (existing.bundleHistory.length > 0) {
        existing.bundleHistory[existing.bundleHistory.length - 1] = cloneBundle(superseded);
      } else {
        existing.bundleHistory.push(cloneBundle(superseded));
      }
    }
    this.attachBundle(replacement);
  }

  serialize(): ProvisionRegistrySnapshot {
    return {
      records: [...this.#records.values()].map((record) => ({
        request: cloneRequest(record.request),
        bundle: record.bundle ? cloneBundle(record.bundle) : undefined,
        bundleHistory: record.bundleHistory.map(cloneBundle),
      })),
    };
  }

  restore(snapshot: ProvisionRegistrySnapshot): void {
    this.#records.clear();
    for (const record of snapshot.records) {
      this.#records.set(record.request.provisionId, {
        request: cloneRequest(record.request),
        bundle: record.bundle ? cloneBundle(record.bundle) : undefined,
        bundleHistory: record.bundleHistory.map(cloneBundle),
      });
    }
  }

  static fromSnapshot(snapshot: ProvisionRegistrySnapshot): ProvisionRegistry {
    const registry = new ProvisionRegistry();
    registry.restore(snapshot);
    return registry;
  }
}

export const TaPoolProvisionRegistry = ProvisionRegistry;
