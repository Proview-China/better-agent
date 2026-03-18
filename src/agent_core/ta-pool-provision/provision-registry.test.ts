import assert from "node:assert/strict";
import test from "node:test";

import {
  createProvisionArtifactBundle,
  createProvisionRequest,
} from "../ta-pool-types/index.js";
import { ProvisionRegistry } from "./provision-registry.js";

test("provision registry stores requests and attaches ready bundles", () => {
  const registry = new ProvisionRegistry();
  const request = createProvisionRequest({
    provisionId: "provision-1",
    sourceRequestId: "req-1",
    requestedCapabilityKey: "mcp.playwright",
    reason: "Need browser MCP support.",
    createdAt: "2026-03-18T00:00:00.000Z",
  });

  registry.registerRequest(request);
  registry.attachBundle(createProvisionArtifactBundle({
    bundleId: "bundle-1",
    provisionId: request.provisionId,
    status: "ready",
    toolArtifact: { artifactId: "tool-1", kind: "tool" },
    bindingArtifact: { artifactId: "binding-1", kind: "binding" },
    verificationArtifact: { artifactId: "verification-1", kind: "verification" },
    usageArtifact: { artifactId: "usage-1", kind: "usage" },
    completedAt: "2026-03-18T00:00:05.000Z",
  }));

  assert.equal(registry.get("provision-1")?.bundle?.status, "ready");
  assert.equal(registry.listReady().length, 1);
});

test("provision registry can supersede an existing bundle", () => {
  const registry = new ProvisionRegistry();
  const request = createProvisionRequest({
    provisionId: "provision-2",
    sourceRequestId: "req-2",
    requestedCapabilityKey: "skill.diff-analyzer",
    reason: "Need updated analyzer bundle.",
    createdAt: "2026-03-18T00:00:00.000Z",
  });
  registry.registerRequest(request);
  registry.attachBundle(createProvisionArtifactBundle({
    bundleId: "bundle-2",
    provisionId: request.provisionId,
    status: "failed",
    error: {
      code: "builder_failed",
      message: "First attempt failed.",
    },
  }));

  registry.supersede("provision-2", createProvisionArtifactBundle({
    bundleId: "bundle-3",
    provisionId: request.provisionId,
    status: "ready",
    toolArtifact: { artifactId: "tool-2", kind: "tool" },
    bindingArtifact: { artifactId: "binding-2", kind: "binding" },
    verificationArtifact: { artifactId: "verification-2", kind: "verification" },
    usageArtifact: { artifactId: "usage-2", kind: "usage" },
  }));

  assert.equal(registry.get("provision-2")?.bundle?.status, "ready");
});
