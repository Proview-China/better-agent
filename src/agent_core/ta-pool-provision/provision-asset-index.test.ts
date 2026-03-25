import assert from "node:assert/strict";
import test from "node:test";

import {
  createPoolActivationSpec,
  createProvisionArtifactBundle,
  createProvisionRequest,
} from "../ta-pool-types/index.js";
import { ProvisionAssetIndex } from "./provision-asset-index.js";

function createLedgerRecord() {
  const request = createProvisionRequest({
    provisionId: "provision-asset-1",
    sourceRequestId: "req-asset-1",
    requestedCapabilityKey: "mcp.playwright",
    reason: "Need a browser automation asset.",
    createdAt: "2026-03-19T04:00:00.000Z",
  });
  const bundle = createProvisionArtifactBundle({
    bundleId: "bundle-asset-1",
    provisionId: request.provisionId,
    status: "ready",
    toolArtifact: { artifactId: "tool-1", kind: "tool", ref: "tool:playwright" },
    bindingArtifact: { artifactId: "binding-1", kind: "binding", ref: "binding:playwright" },
    verificationArtifact: { artifactId: "verification-1", kind: "verification", ref: "verify:playwright" },
    usageArtifact: { artifactId: "usage-1", kind: "usage", ref: "usage:playwright" },
    activationSpec: createPoolActivationSpec({
      targetPool: "ta-capability-pool",
      activationMode: "activate_after_verify",
      registerOrReplace: "register_or_replace",
      generationStrategy: "create_next_generation",
      drainStrategy: "graceful",
      manifestPayload: {
        capabilityKey: "mcp.playwright",
      },
      bindingPayload: {
        adapterId: "adapter.playwright",
      },
      adapterFactoryRef: "factory:playwright",
    }),
    replayPolicy: "re_review_then_dispatch",
    completedAt: "2026-03-19T04:00:05.000Z",
  });

  return {
    request,
    bundle,
    bundleHistory: [bundle],
  };
}

test("provision asset index stages ready bundles and maps binding artifacts into activation metadata", () => {
  const index = new ProvisionAssetIndex();
  const record = createLedgerRecord();

  const asset = index.ingest(record);

  assert.equal(asset?.status, "ready_for_review");
  assert.equal(asset?.capabilityKey, "mcp.playwright");
  assert.equal(asset?.activation.bindingArtifact.artifactId, "binding-1");
  assert.equal(asset?.activation.bindingArtifactRef, "binding:playwright");
  assert.equal(asset?.activation.targetPool, "ta-capability-pool");
  assert.equal(asset?.activation.adapterFactoryRef, "factory:playwright");
  assert.deepEqual(index.listCapabilityKeysByStatus(["ready_for_review"]), ["mcp.playwright"]);
});

test("provision asset index tracks activating and active lifecycle states", () => {
  const index = new ProvisionAssetIndex();
  const record = createLedgerRecord();
  index.ingest(record);

  const activating = index.updateState({
    provisionId: record.request.provisionId,
    status: "activating",
    updatedAt: "2026-03-19T04:00:06.000Z",
  });
  const active = index.updateState({
    provisionId: record.request.provisionId,
    status: "active",
    updatedAt: "2026-03-19T04:00:07.000Z",
  });

  assert.equal(activating?.status, "activating");
  assert.equal(active?.status, "active");
  assert.deepEqual(index.listCapabilityKeysByStatus(["active"]), ["mcp.playwright"]);
});

test("provision asset index can serialize and restore current assets", () => {
  const index = new ProvisionAssetIndex();
  const record = createLedgerRecord();
  index.ingest(record);
  index.updateState({
    provisionId: record.request.provisionId,
    status: "activating",
    updatedAt: "2026-03-19T04:00:06.000Z",
  });

  const snapshot = index.serialize();
  const restored = ProvisionAssetIndex.fromSnapshot(snapshot);
  const current = restored.getCurrent(record.request.provisionId);

  assert.ok(current);
  assert.equal(current?.status, "activating");
  assert.equal(current?.activation.adapterFactoryRef, "factory:playwright");
  assert.deepEqual(restored.listCapabilityKeysByStatus(["activating"]), ["mcp.playwright"]);
});
