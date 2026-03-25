import type {
  PoolActivationSpec,
  ProvisionArtifactBundle,
  ProvisionArtifactRef,
  ProvisionRequest,
  ReplayPolicy,
} from "../ta-pool-types/index.js";
import type { ProvisionRegistryRecord } from "./provision-registry.js";

export const PROVISION_ASSET_STATUSES = [
  "ready_for_review",
  "activating",
  "active",
  "failed",
  "superseded",
] as const;
export type ProvisionAssetStatus = (typeof PROVISION_ASSET_STATUSES)[number];

export interface ProvisionAssetActivationBinding {
  bindingArtifact: ProvisionArtifactRef;
  bindingArtifactRef?: string;
  targetPool?: string;
  adapterFactoryRef?: string;
  spec?: PoolActivationSpec;
}

export interface ProvisionAssetRecord {
  assetId: string;
  provisionId: string;
  bundleId: string;
  capabilityKey: string;
  status: ProvisionAssetStatus;
  toolArtifact: ProvisionArtifactRef;
  bindingArtifact: ProvisionArtifactRef;
  verificationArtifact: ProvisionArtifactRef;
  usageArtifact: ProvisionArtifactRef;
  activation: ProvisionAssetActivationBinding;
  replayPolicy?: ReplayPolicy;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface ProvisionAssetIndexSnapshot {
  assets: ProvisionAssetRecord[];
  currentAssetIds: Array<{
    provisionId: string;
    assetId: string;
  }>;
}

export interface UpdateProvisionAssetStateInput {
  provisionId: string;
  status: Extract<ProvisionAssetStatus, "activating" | "active" | "failed" | "superseded">;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

function mergeMetadata(
  left?: Record<string, unknown>,
  right?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!left && !right) {
    return undefined;
  }

  return {
    ...(left ?? {}),
    ...(right ?? {}),
  };
}

function buildActivationBinding(bundle: ProvisionArtifactBundle): ProvisionAssetActivationBinding {
  if (!bundle.bindingArtifact) {
    throw new Error("Provision assets require a binding artifact.");
  }

  return {
    bindingArtifact: bundle.bindingArtifact,
    bindingArtifactRef: bundle.bindingArtifact.ref,
    targetPool: bundle.activationSpec?.targetPool,
    adapterFactoryRef: bundle.activationSpec?.adapterFactoryRef,
    spec: bundle.activationSpec,
  };
}

function cloneArtifactRef(artifact: ProvisionArtifactRef): ProvisionArtifactRef {
  return {
    ...artifact,
    metadata: artifact.metadata ? { ...artifact.metadata } : undefined,
  };
}

function cloneActivationBinding(binding: ProvisionAssetActivationBinding): ProvisionAssetActivationBinding {
  return {
    bindingArtifact: cloneArtifactRef(binding.bindingArtifact),
    bindingArtifactRef: binding.bindingArtifactRef,
    targetPool: binding.targetPool,
    adapterFactoryRef: binding.adapterFactoryRef,
    spec: binding.spec
      ? {
        ...binding.spec,
        manifestPayload: { ...binding.spec.manifestPayload },
        bindingPayload: { ...binding.spec.bindingPayload },
        rollbackHandle: binding.spec.rollbackHandle
          ? cloneArtifactRef(binding.spec.rollbackHandle)
          : undefined,
        metadata: binding.spec.metadata ? { ...binding.spec.metadata } : undefined,
      }
      : undefined,
  };
}

function cloneAssetRecord(asset: ProvisionAssetRecord): ProvisionAssetRecord {
  return {
    ...asset,
    toolArtifact: cloneArtifactRef(asset.toolArtifact),
    bindingArtifact: cloneArtifactRef(asset.bindingArtifact),
    verificationArtifact: cloneArtifactRef(asset.verificationArtifact),
    usageArtifact: cloneArtifactRef(asset.usageArtifact),
    activation: cloneActivationBinding(asset.activation),
    metadata: asset.metadata ? { ...asset.metadata } : undefined,
  };
}

function createProvisionAssetRecord(
  request: ProvisionRequest,
  bundle: ProvisionArtifactBundle,
): ProvisionAssetRecord {
  if (
    !bundle.toolArtifact
    || !bundle.bindingArtifact
    || !bundle.verificationArtifact
    || !bundle.usageArtifact
  ) {
    throw new Error("Provision asset records require a full ready bundle.");
  }

  const createdAt = bundle.completedAt ?? request.createdAt;
  return {
    assetId: bundle.bundleId,
    provisionId: request.provisionId,
    bundleId: bundle.bundleId,
    capabilityKey: request.requestedCapabilityKey,
    status: "ready_for_review",
    toolArtifact: bundle.toolArtifact,
    bindingArtifact: bundle.bindingArtifact,
    verificationArtifact: bundle.verificationArtifact,
    usageArtifact: bundle.usageArtifact,
    activation: buildActivationBinding(bundle),
    replayPolicy: bundle.replayPolicy ?? request.replayPolicy,
    createdAt,
    updatedAt: createdAt,
    metadata: mergeMetadata(bundle.metadata, {
      requestedCapabilityKey: request.requestedCapabilityKey,
      sourceRequestId: request.sourceRequestId,
      activationStatus: "ready_for_review",
    }),
  };
}

export class ProvisionAssetIndex {
  readonly #assets = new Map<string, ProvisionAssetRecord>();
  readonly #currentAssetIds = new Map<string, string>();

  ingest(record: ProvisionRegistryRecord): ProvisionAssetRecord | undefined {
    if (!record.bundle) {
      return undefined;
    }

    if (record.bundle.status === "ready") {
      return this.#stageReadyAsset(record.request, record.bundle);
    }

    if (record.bundle.status === "superseded") {
      this.updateState({
        provisionId: record.request.provisionId,
        status: "superseded",
        updatedAt: record.bundle.completedAt ?? new Date().toISOString(),
        metadata: {
          source: "bundle-superseded",
        },
      });
    }

    return this.getCurrent(record.request.provisionId);
  }

  getCurrent(provisionId: string): ProvisionAssetRecord | undefined {
    const assetId = this.#currentAssetIds.get(provisionId);
    const asset = assetId ? this.#assets.get(assetId) : undefined;
    return asset ? cloneAssetRecord(asset) : undefined;
  }

  list(): readonly ProvisionAssetRecord[] {
    return [...this.#assets.values()].map(cloneAssetRecord);
  }

  listCurrent(): readonly ProvisionAssetRecord[] {
    return [...this.#currentAssetIds.values()]
      .map((assetId) => this.#assets.get(assetId))
      .filter((asset): asset is ProvisionAssetRecord => asset !== undefined);
  }

  listCurrentByStatus(statuses: readonly ProvisionAssetStatus[]): readonly ProvisionAssetRecord[] {
    const wanted = new Set(statuses);
    return this.listCurrent().filter((asset) => wanted.has(asset.status));
  }

  listCapabilityKeysByStatus(statuses: readonly ProvisionAssetStatus[]): string[] {
    return [...new Set(
      this.listCurrentByStatus(statuses).map((asset) => asset.capabilityKey),
    )];
  }

  updateState(input: UpdateProvisionAssetStateInput): ProvisionAssetRecord | undefined {
    const current = this.getCurrent(input.provisionId);
    if (!current) {
      return undefined;
    }

    const next: ProvisionAssetRecord = {
      ...current,
      status: input.status,
      updatedAt: input.updatedAt,
      metadata: mergeMetadata(current.metadata, input.metadata),
    };
    this.#assets.set(next.assetId, next);
    return next;
  }

  #stageReadyAsset(
    request: ProvisionRequest,
    bundle: ProvisionArtifactBundle,
  ): ProvisionAssetRecord {
    const existing = this.getCurrent(request.provisionId);
    if (existing && existing.assetId !== bundle.bundleId && existing.status !== "superseded") {
      this.updateState({
        provisionId: request.provisionId,
        status: "superseded",
        updatedAt: bundle.completedAt ?? request.createdAt,
        metadata: {
          supersededByBundleId: bundle.bundleId,
        },
      });
    }

    const asset = createProvisionAssetRecord(request, bundle);
    this.#assets.set(asset.assetId, asset);
    this.#currentAssetIds.set(asset.provisionId, asset.assetId);
    return asset;
  }

  serialize(): ProvisionAssetIndexSnapshot {
    return {
      assets: [...this.#assets.values()].map(cloneAssetRecord),
      currentAssetIds: [...this.#currentAssetIds.entries()].map(([provisionId, assetId]) => ({
        provisionId,
        assetId,
      })),
    };
  }

  restore(snapshot: ProvisionAssetIndexSnapshot): void {
    this.#assets.clear();
    this.#currentAssetIds.clear();
    for (const asset of snapshot.assets) {
      this.#assets.set(asset.assetId, cloneAssetRecord(asset));
    }
    for (const entry of snapshot.currentAssetIds) {
      this.#currentAssetIds.set(entry.provisionId, entry.assetId);
    }
  }

  static fromSnapshot(snapshot: ProvisionAssetIndexSnapshot): ProvisionAssetIndex {
    const index = new ProvisionAssetIndex();
    index.restore(snapshot);
    return index;
  }
}

export const TaPoolProvisionAssetIndex = ProvisionAssetIndex;
