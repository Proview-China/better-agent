import type {
  ProvisionArtifactBundle,
  ProvisionRequest,
} from "../ta-pool-types/index.js";

export interface ProvisionRegistryRecord {
  request: ProvisionRequest;
  bundle?: ProvisionArtifactBundle;
}

export type ProvisionRegistryEntry = ProvisionRegistryRecord;

export class ProvisionRegistry {
  readonly #records = new Map<string, ProvisionRegistryRecord>();

  registerRequest(request: ProvisionRequest): void {
    this.#records.set(request.provisionId, {
      request,
      bundle: this.#records.get(request.provisionId)?.bundle,
    });
  }

  attachBundle(bundle: ProvisionArtifactBundle): void {
    const existing = this.#records.get(bundle.provisionId);
    this.#records.set(bundle.provisionId, {
      request: existing?.request ?? {
        provisionId: bundle.provisionId,
        sourceRequestId: bundle.provisionId,
        requestedCapabilityKey: bundle.toolArtifact?.kind ?? "unknown",
        requestedTier: "B1",
        reason: "synthetic provision request",
        createdAt: bundle.completedAt ?? new Date().toISOString(),
      },
      bundle,
    });
  }

  get(provisionId: string): ProvisionRegistryRecord | undefined {
    return this.#records.get(provisionId);
  }

  list(): readonly ProvisionRegistryRecord[] {
    return [...this.#records.values()];
  }

  listReady(): readonly ProvisionRegistryRecord[] {
    return this.list().filter((entry) => entry.bundle?.status === "ready");
  }

  supersede(provisionId: string, replacement: ProvisionArtifactBundle): void {
    const existing = this.#records.get(provisionId);
    if (existing?.bundle) {
      existing.bundle = {
        ...existing.bundle,
        status: "superseded",
      };
    }
    this.attachBundle(replacement);
  }
}

export const TaPoolProvisionRegistry = ProvisionRegistry;
