import assert from "node:assert/strict";
import test from "node:test";

import { createProvisionRequest } from "../ta-pool-types/index.js";
import {
  createDefaultProvisionerWorkerOutput,
  createProvisionerWorkerBridgeInput,
  resolveProvisionerWorkerLane,
  validateProvisionerWorkerOutput,
} from "./provisioner-worker-bridge.js";
import { createSectionIteratorRuleSet } from "./section-iterator-rules.js";

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
  const policy = output.toolArtifact.metadata?.policy as {
    iteratorRules?: {
      slot?: string;
      rules?: Array<{ action?: string }>;
      flow?: { sourceStore?: string; returnStore?: string };
    };
  } | undefined;
  assert.equal(policy?.iteratorRules?.slot, "iterator_rules");
  assert.equal(policy?.iteratorRules?.rules?.length, 5);
  assert.equal(policy?.iteratorRules?.flow?.sourceStore, "Stored-Agent");
  assert.equal(policy?.iteratorRules?.flow?.returnStore, "Stored-Agent");
  const verification = output.verificationArtifact.metadata?.verification as {
    successCriteria?: string[];
    failureSignals?: string[];
  } | undefined;
  assert.equal(
    verification?.successCriteria?.includes(
      "policy section exports iterator rules for granularity and hierarchy checks",
    ),
    true,
  );
  assert.equal(
    verification?.failureSignals?.includes(
      "missing iterator rules for Stored-Agent round-trip decisions",
    ),
    true,
  );
});

test("section iterator rules freeze the split merge iterate update storage decisions", () => {
  const ruleSet = createSectionIteratorRuleSet({
    capabilityKey: "mcp.playwright",
    lane: "bootstrap",
  });

  assert.equal(ruleSet.slot, "iterator_rules");
  assert.equal(ruleSet.version, "cmp-section-iterator.v0");
  assert.deepEqual(
    ruleSet.rules.map((rule) => rule.action),
    ["store", "split", "merge", "update", "iterate"],
  );
  assert.equal(ruleSet.flow.runtime, "iterator-agent-loop-runtime");
  assert.equal(ruleSet.metadata?.capabilityKey, "mcp.playwright");
});
