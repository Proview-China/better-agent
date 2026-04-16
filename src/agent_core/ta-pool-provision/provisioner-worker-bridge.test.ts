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
  assert.equal(bootstrapInput.envelope.contextAperture.allowedBuildScope.status, "ready");
  assert.equal(bootstrapInput.envelope.contextAperture.reviewerInstructions.status, "ready");
  assert.match(bootstrapInput.promptPack.systemPrompt, /Do not approve activation/i);
  assert.equal(extendedInput.promptPack.lane, "extended");
  assert.equal(extendedInput.envelope.allowedBuildScope.mayInstallDependencies, true);
  assert.equal(extendedInput.envelope.allowedBuildScope.mayUseNetwork, true);
  assert.equal(extendedInput.envelope.contextAperture.allowedSideEffects.every((effect) => effect.status === "ready"), true);
  assert.equal(
    extendedInput.promptPack.laneSemantics.allowedCapabilities.includes("dependency.install"),
    true,
  );
});

test("provisioner worker bridge honors tool reviewer requested lane when no approved lane is attached", () => {
  const toolReviewDirected = createRequest({
    requestedCapabilityKey: "computer.use",
    metadata: {
      toolReviewWorkOrder: {
        workOrderId: "tma-work-order:review-extended",
        requestedLane: "extended",
        objective: "Repair the blocked computer.use capability package.",
      },
    },
  });

  const directedInput = createProvisionerWorkerBridgeInput(toolReviewDirected);

  assert.equal(resolveProvisionerWorkerLane(toolReviewDirected), "extended");
  assert.equal(directedInput.promptPack.lane, "extended");
  assert.equal(directedInput.envelope.allowedBuildScope.mayInstallDependencies, true);
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
  assert.equal(output.metadata?.deliveryTarget, "ready_bundle_candidate");
  assert.equal(
    (output.metadata?.evidenceContract as { requiresVerificationArtifact?: boolean } | undefined)?.requiresVerificationArtifact,
    true,
  );
  assert.equal(
    (output.metadata?.phasedBoundary as { buildContract?: string } | undefined)?.buildContract,
    "staged_ready_bundle_shell",
  );
  assert.match(output.buildSummary, /generic staged package contract/i);
  assert.deepEqual((output.usageArtifact.metadata?.usage as { knownLimits?: string[] } | undefined)?.knownLimits, [
    "activation remains owned by the outer TAP runtime",
    "this bridge delivers a package contract, not a fully installed external runtime integration",
  ]);
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
  assert.equal(
    (output.metadata?.packageSectionsComplete as { usage?: boolean } | undefined)?.usage,
    true,
  );
  assert.equal(
    (output.metadata?.phasedBoundary as { buildContract?: string } | undefined)?.buildContract,
    "formal_ready_bundle",
  );
  assert.match(output.buildSummary, /ready for tool-review quality checks/i);
});

test("provisioner worker envelope carries an attached tool reviewer work order into context and instructions", () => {
  const input = createProvisionerWorkerBridgeInput(createRequest({
    requestedCapabilityKey: "computer.use",
    metadata: {
      toolReviewWorkOrder: {
        workOrderId: "tma-work-order:review-1",
        objective: "Repair the blocked computer.use capability package.",
        rationale: "Activation failed during the last governance pass.",
      },
    },
  }));

  assert.equal(input.envelope.reviewerInstructions[0], "Tool reviewer rationale: Activation failed during the last governance pass.");
  assert.equal(input.envelope.projectConstraints[0], "Tool reviewer objective: Repair the blocked computer.use capability package.");
  assert.equal(
    input.envelope.contextAperture.sections.some((section) => section.sectionId === "provision.tool-review-work-order"),
    true,
  );
});

test("provisioner worker envelope folds cmp tap aperture into the provision context aperture", () => {
  const input = createProvisionerWorkerBridgeInput(createRequest({
    requestedCapabilityKey: "computer.use",
    metadata: {
      cmpTapReviewAperture: {
        schemaVersion: "cmp-tap-review-aperture/v1",
        sessionId: "session-cmp-aperture-1",
        agentId: "cmp-agent-1",
        currentObjective: "repair the current computer.use worksite",
        requestedCapabilityKey: "computer.use",
        packageRef: "cmp-package:computer.use",
        routeRationale: "core return keeps the worksite aligned",
        reviewStateSummary: "peer approval pending 1",
      },
    },
  }));

  assert.equal(
    input.envelope.projectConstraints[0],
    "CMP worksite objective: repair the current computer.use worksite",
  );
  assert.equal(
    input.envelope.reviewerInstructions[0],
    "CMP review state: peer approval pending 1",
  );
  const cmpSection = input.envelope.contextAperture.sections.find((section) => section.sectionId === "provision.cmp-worksite");
  assert.ok(cmpSection);
  assert.match(cmpSection.summary, /cmp-package:computer\.use/u);
  assert.equal(
    (cmpSection.metadata?.cmpTapReviewAperture as { currentObjective?: string } | undefined)?.currentObjective,
    "repair the current computer.use worksite",
  );
});
