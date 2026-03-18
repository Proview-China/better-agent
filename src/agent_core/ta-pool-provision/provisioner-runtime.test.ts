import assert from "node:assert/strict";
import test from "node:test";

import { createProvisionRequest } from "../ta-pool-types/index.js";
import { ProvisionRegistry } from "./provision-registry.js";
import { createProvisionerRuntime } from "./provisioner-runtime.js";

test("provisioner runtime records building then ready with the default mock builder", async () => {
  const registry = new ProvisionRegistry();
  let counter = 0;
  const runtime = createProvisionerRuntime({
    registry,
    clock: () => new Date("2026-03-18T08:00:00.000Z"),
    idFactory: () => `bundle-${++counter}`,
  });

  const request = createProvisionRequest({
    provisionId: "provision-1",
    sourceRequestId: "request-1",
    requestedCapabilityKey: "mcp.playwright",
    reason: "Need playwright MCP.",
    createdAt: "2026-03-18T08:00:00.000Z",
  });

  const bundle = await runtime.submit(request);
  const history = runtime.getBundleHistory(request.provisionId);

  assert.equal(history.length, 2);
  assert.equal(history[0]?.status, "building");
  assert.equal(history[1]?.status, "ready");
  assert.equal(bundle.status, "ready");
  assert.equal(bundle.toolArtifact?.ref, "mock-tools/mcp.playwright");
  assert.equal(registry.get(request.provisionId)?.bundle?.status, "ready");
});

test("provisioner runtime records building then failed when builder throws", async () => {
  const registry = new ProvisionRegistry();
  let counter = 0;
  const runtime = createProvisionerRuntime({
    registry,
    builder: async () => {
      throw new Error("mock builder crashed");
    },
    clock: () => new Date("2026-03-18T08:30:00.000Z"),
    idFactory: () => `bundle-${++counter}`,
  });

  const request = createProvisionRequest({
    provisionId: "provision-2",
    sourceRequestId: "request-2",
    requestedCapabilityKey: "computer.use",
    reason: "Need computer use runtime.",
    createdAt: "2026-03-18T08:30:00.000Z",
  });

  const bundle = await runtime.submit(request);
  const history = runtime.getBundleHistory(request.provisionId);

  assert.equal(history.length, 2);
  assert.equal(history[0]?.status, "building");
  assert.equal(history[1]?.status, "failed");
  assert.equal(bundle.status, "failed");
  assert.equal(bundle.error?.code, "ta_pool_provision_build_failed");
  assert.equal(registry.get(request.provisionId)?.bundle?.status, "failed");
});
