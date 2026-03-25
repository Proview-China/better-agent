import type { ProvisionArtifactBundle } from "../ta-pool-types/index.js";
import type { ProvisionAssetIndexSnapshot } from "./provision-asset-index.js";
import type { ProvisionRegistrySnapshot } from "./provision-registry.js";
import type { TmaSessionState } from "./tma-session-state.js";

export interface ProvisionBundleHistorySnapshotEntry {
  provisionId: string;
  bundles: ProvisionArtifactBundle[];
}

export interface ProvisionerDurableSnapshot {
  registry: ProvisionRegistrySnapshot;
  assetIndex: ProvisionAssetIndexSnapshot;
  bundleHistory: ProvisionBundleHistorySnapshotEntry[];
  tmaSessions?: TmaSessionState[];
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

export function createProvisionerDurableSnapshot(
  input: ProvisionerDurableSnapshot,
): ProvisionerDurableSnapshot {
  return {
    registry: {
      records: input.registry.records.map((record) => ({
        request: {
          ...record.request,
          requiredVerification: record.request.requiredVerification
            ? [...record.request.requiredVerification]
            : undefined,
          expectedArtifacts: record.request.expectedArtifacts
            ? [...record.request.expectedArtifacts]
            : undefined,
          metadata: record.request.metadata ? { ...record.request.metadata } : undefined,
        },
        bundle: record.bundle ? cloneBundle(record.bundle) : undefined,
        bundleHistory: record.bundleHistory.map(cloneBundle),
      })),
    },
    assetIndex: {
      assets: input.assetIndex.assets.map((asset) => ({
        ...asset,
        toolArtifact: { ...asset.toolArtifact },
        bindingArtifact: { ...asset.bindingArtifact },
        verificationArtifact: { ...asset.verificationArtifact },
        usageArtifact: { ...asset.usageArtifact },
        activation: {
          ...asset.activation,
          bindingArtifact: { ...asset.activation.bindingArtifact },
          spec: asset.activation.spec
            ? {
              ...asset.activation.spec,
              manifestPayload: { ...asset.activation.spec.manifestPayload },
              bindingPayload: { ...asset.activation.spec.bindingPayload },
              rollbackHandle: asset.activation.spec.rollbackHandle
                ? { ...asset.activation.spec.rollbackHandle }
                : undefined,
              metadata: asset.activation.spec.metadata
                ? { ...asset.activation.spec.metadata }
                : undefined,
            }
            : undefined,
        },
        metadata: asset.metadata ? { ...asset.metadata } : undefined,
      })),
      currentAssetIds: input.assetIndex.currentAssetIds.map((entry) => ({ ...entry })),
    },
    bundleHistory: input.bundleHistory.map((entry) => ({
      provisionId: entry.provisionId,
      bundles: entry.bundles.map(cloneBundle),
    })),
    tmaSessions: input.tmaSessions?.map((session) => ({
      ...session,
      boundary: { ...session.boundary },
      metadata: session.metadata ? { ...session.metadata } : undefined,
    })),
  };
}

export function restoreProvisionerBundleHistory(
  input: readonly ProvisionBundleHistorySnapshotEntry[],
): Map<string, ProvisionArtifactBundle[]> {
  return new Map(
    input.map((entry) => [
      entry.provisionId,
      entry.bundles.map(cloneBundle),
    ] as const),
  );
}
