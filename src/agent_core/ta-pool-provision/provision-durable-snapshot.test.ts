import assert from "node:assert/strict";
import test from "node:test";

import {
  createProvisionArtifactBundle,
  createProvisionRequest,
} from "../ta-pool-types/index.js";
import { ProvisionAssetIndex } from "./provision-asset-index.js";
import {
  createProvisionerDurableSnapshot,
  restoreProvisionerBundleHistory,
} from "./provision-durable-snapshot.js";
import { ProvisionRegistry } from "./provision-registry.js";

test("createProvisionerDurableSnapshot preserves registry, asset index, and bundle history", () => {
  const registry = new ProvisionRegistry();
  const assetIndex = new ProvisionAssetIndex();
  const request = createProvisionRequest({
    provisionId: "provision-snapshot-1",
    sourceRequestId: "request-snapshot-1",
    requestedCapabilityKey: "system.write",
    reason: "Need durable snapshot coverage.",
    createdAt: "2026-03-25T11:00:00.000Z",
  });
  const building = createProvisionArtifactBundle({
    bundleId: "bundle-snapshot-1a",
    provisionId: request.provisionId,
    status: "building",
  });
  const ready = createProvisionArtifactBundle({
    bundleId: "bundle-snapshot-1b",
    provisionId: request.provisionId,
    status: "ready",
    toolArtifact: { artifactId: "tool-snapshot", kind: "tool" },
    bindingArtifact: { artifactId: "binding-snapshot", kind: "binding" },
    verificationArtifact: { artifactId: "verification-snapshot", kind: "verification" },
    usageArtifact: { artifactId: "usage-snapshot", kind: "usage" },
    completedAt: "2026-03-25T11:00:05.000Z",
  });

  registry.registerRequest(request);
  registry.attachBundle(building);
  registry.attachBundle(ready);
  assetIndex.ingest(registry.get(request.provisionId)!);

  const snapshot = createProvisionerDurableSnapshot({
    registry: registry.serialize(),
    assetIndex: assetIndex.serialize(),
    bundleHistory: [{
      provisionId: request.provisionId,
      bundles: [building, ready],
    }],
  });

  const restoredHistory = restoreProvisionerBundleHistory(snapshot.bundleHistory);

  assert.equal(snapshot.registry.records.length, 1);
  assert.equal(snapshot.assetIndex.assets.length, 1);
  assert.deepEqual(
    restoredHistory.get(request.provisionId)?.map((bundle) => bundle.bundleId),
    ["bundle-snapshot-1a", "bundle-snapshot-1b"],
  );
});
