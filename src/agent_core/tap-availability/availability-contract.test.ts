import assert from "node:assert/strict";
import test from "node:test";

import {
  createMcpCapabilityPackage,
  createRaxWebsearchCapabilityPackage,
} from "../capability-package/index.js";
import {
  createTapCapabilityAvailabilityContract,
  createTapCapabilityVerificationEvidence,
} from "./availability-contract.js";

test("createTapCapabilityAvailabilityContract normalizes package verification into health smoke and report contracts", () => {
  const capabilityPackage = createRaxWebsearchCapabilityPackage();
  const contract = createTapCapabilityAvailabilityContract({
    capabilityPackage,
    registration: {
      capabilityKey: "search.ground",
      familyKey: "websearch",
      manifest: {
        capabilityKey: "search.ground",
        capabilityId: "capability:search.ground:1",
        version: "1.0.0",
        generation: 1,
        kind: "tool",
        description: "Grounded web search bridged through the RAX websearch runtime.",
        supportsPrepare: true,
        supportsCancellation: false,
      },
      adapterId: "adapter:search.ground",
      runtimeKind: "rax-websearch",
      bindingId: "binding:search.ground:1",
      supportsPrepare: true,
      supportsCancellation: false,
      hasHealthCheck: true,
    },
  });

  assert.equal(contract.capabilityKey, "search.ground");
  assert.equal(contract.health.source, "adapter_health_check");
  assert.equal(contract.health.healthEntry, "health:rax:websearch");
  assert.equal(contract.smoke.source, "test_entry");
  assert.equal(contract.smoke.smokeEntry, "test:agent_core:rax-websearch-adapter");
  assert.deepEqual(
    contract.report.evidenceOutput,
    capabilityPackage.verification.evidenceOutput,
  );
  assert.equal(contract.activationFactoryRef, "factory:search.ground.rax-websearch");
  assert.equal(contract.replayPolicy, "re_review_then_dispatch");
});

test("createTapCapabilityVerificationEvidence emits declared verification support and activation evidence", () => {
  const capabilityPackage = createMcpCapabilityPackage({
    capabilityKey: "mcp.call",
  });

  const evidence = createTapCapabilityVerificationEvidence(capabilityPackage);

  assert.equal(
    evidence.some((entry) =>
      entry.source === "package_verification"
      && entry.ref === "smoke:mcp.call"
      && entry.status === "declared"),
    true,
  );
  assert.equal(
    evidence.some((entry) =>
      entry.source === "package_verification"
      && entry.ref === "health:mcp.call"
      && entry.status === "declared"),
    true,
  );
  assert.equal(
    evidence.some((entry) =>
      entry.source === "activation_spec"
      && entry.status === "declared"),
    true,
  );
  assert.equal(
    evidence.some((entry) =>
      entry.source === "support_matrix"
      && entry.ref.includes("openai")),
    true,
  );
});
