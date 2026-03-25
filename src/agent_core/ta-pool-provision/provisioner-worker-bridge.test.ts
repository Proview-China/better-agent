import assert from "node:assert/strict";
import test from "node:test";

import { createProvisionRequest } from "../ta-pool-types/index.js";
import {
  createDefaultProvisionerWorkerOutput,
  createProvisionerWorkerBridgeInput,
  resolveProvisionerWorkerLane,
  validateProvisionerWorkerOutput,
} from "./provisioner-worker-bridge.js";

function createRequest(
  overrides: Partial<ReturnType<typeof createProvisionRequest>> = {},
) {
  return createProvisionRequest({
    provisionId: overrides.provisionId ?? "provision-bridge-1",
    sourceRequestId: overrides.sourceRequestId ?? "request-bridge-1",
    requestedCapabilityKey: overrides.requestedCapabilityKey ?? "mcp.playwright",
    requestedTier: overrides.requestedTier ?? "B1",
    reason: overrides.reason ?? "Need a provisioner worker bridge package.",
    desiredProviderOrRuntime: overrides.desiredProviderOrRuntime ?? "mcp",
    createdAt: overrides.createdAt ?? "2026-03-19T08:00:00.000Z",
    replayPolicy: overrides.replayPolicy ?? "re_review_then_dispatch",
    metadata: overrides.metadata,
  });
}

test("provisioner worker bridge defaults to bootstrap lane unless an approved extended lane is present", () => {
  const requestedExtended = createRequest({
    metadata: {
      requestedProvisionerLane: "extended",
    },
  });
  const approvedExtended = createRequest({
    provisionId: "provision-bridge-2",
    sourceRequestId: "request-bridge-2",
    metadata: {
      approvedProvisionerLane: "extended",
      inventorySnapshot: {
        availableCapabilityKeys: ["mcp.playwright"],
        readyCapabilityKeys: ["mcp.playwright"],
      },
    },
  });

  const bootstrapInput = createProvisionerWorkerBridgeInput(requestedExtended);
  const extendedInput = createProvisionerWorkerBridgeInput(approvedExtended);

  assert.equal(resolveProvisionerWorkerLane(requestedExtended), "bootstrap");
  assert.equal(resolveProvisionerWorkerLane(approvedExtended), "extended");
  assert.equal(bootstrapInput.promptPack.lane, "bootstrap");
  assert.equal(bootstrapInput.envelope.allowedBuildScope.mayInstallDependencies, false);
  assert.match(bootstrapInput.promptPack.systemPrompt, /Do not approve activation/i);
  assert.equal(extendedInput.promptPack.lane, "extended");
  assert.equal(extendedInput.envelope.allowedBuildScope.mayInstallDependencies, true);
  assert.equal(extendedInput.envelope.allowedBuildScope.mayUseNetwork, true);
  assert.equal(
    extendedInput.promptPack.laneSemantics.allowedCapabilities.includes("dependency.install"),
    true,
  );
});

test("default provisioner worker output carries package artifacts plus activation and replay guidance", () => {
  const input = createProvisionerWorkerBridgeInput(createRequest({
    replayPolicy: "auto_after_verify",
  }));

  const output = createDefaultProvisionerWorkerOutput(input);

  validateProvisionerWorkerOutput(output);

  assert.equal(output.workerAction, "build_capability_package");
  assert.equal(output.originalTaskDisposition, "left_for_main_agent");
  assert.equal(output.toolArtifact.ref, "provisioned/mcp.playwright/tool.json");
  assert.equal(output.bindingArtifact.metadata?.activationDriverImplemented, false);
  assert.equal(output.activationPayload.activationMode, "stage_only");
  assert.equal(output.activationPayload.bindingPayload.bridgeLane, "bootstrap");
  assert.equal(output.replayRecommendation.policy, "auto_after_verify");
  assert.equal(output.replayRecommendation.suggestedTrigger, "after_verify");
  assert.match(output.buildSummary, /Real builder execution and activation driver remain unimplemented/i);
});

test("bootstrap tooling capabilities emit formal package payloads through the worker bridge", () => {
  const input = createProvisionerWorkerBridgeInput(createRequest({
    requestedCapabilityKey: "skill.doc.generate",
    requestedTier: "B0",
    desiredProviderOrRuntime: "local-tooling",
  }));

  const output = createDefaultProvisionerWorkerOutput(input);

  validateProvisionerWorkerOutput(output);

  assert.equal(output.activationPayload.activationMode, "activate_after_verify");
  assert.equal(output.activationPayload.adapterFactoryRef, "factory:tap-tooling:skill.doc.generate");
  assert.equal(output.toolArtifact.metadata?.formalCapabilityPackage, true);
  assert.equal(output.metadata?.packageTemplateStatus, "formal");
  assert.match(output.buildSummary, /formal bootstrap tooling capability package/i);
});
