import assert from "node:assert/strict";
import test from "node:test";

import { createProvisionRequest } from "../ta-pool-types/index.js";
import { createTmaPlannerOutput } from "./tma-planner.js";

function createRequest(
  overrides: Partial<ReturnType<typeof createProvisionRequest>> = {},
) {
  return createProvisionRequest({
    provisionId: overrides.provisionId ?? "provision-plan-1",
    sourceRequestId: overrides.sourceRequestId ?? "request-plan-1",
    requestedCapabilityKey: overrides.requestedCapabilityKey ?? "mcp.playwright",
    requestedTier: overrides.requestedTier ?? "B1",
    reason: overrides.reason ?? "Need a planner output for a missing capability.",
    desiredProviderOrRuntime: overrides.desiredProviderOrRuntime ?? "mcp",
    createdAt: overrides.createdAt ?? "2026-03-19T13:00:00.000Z",
    replayPolicy: overrides.replayPolicy ?? "re_review_then_dispatch",
    requiredVerification: overrides.requiredVerification,
    expectedArtifacts: overrides.expectedArtifacts,
    metadata: overrides.metadata,
  });
}

test("tma planner defaults to bootstrap lane and emits a repo-local build plan", () => {
  const output = createTmaPlannerOutput(createRequest({
    requiredVerification: ["smoke", "health"],
  }));

  assert.equal(output.lane, "bootstrap");
  assert.equal(output.buildPlan.requestedLane, "bootstrap");
  assert.equal(output.buildPlan.requiresApproval, false);
  assert.deepEqual(output.buildPlan.expectedArtifacts, [
    "tool",
    "binding",
    "verification",
    "usage",
  ]);
  assert.match(output.buildPlan.implementationSteps.join(" "), /repo-local/i);
  assert.equal(output.promptPack.lane, "bootstrap");
  assert.equal(output.sessionState.phase, "planner");
  assert.equal(output.sessionState.status, "resumable");
  assert.equal(output.sessionState.boundary.mayExecuteOriginalTask, false);
  assert.match(output.sessionState.resumeSummary, /generated build plan/i);
});

test("tma planner upgrades to extended lane only after approval metadata is present", () => {
  const output = createTmaPlannerOutput(createRequest({
    provisionId: "provision-plan-2",
    sourceRequestId: "request-plan-2",
    metadata: {
      approvedProvisionerLane: "extended",
      inventorySnapshot: {
        availableCapabilityKeys: ["docs.read"],
        activeCapabilityKeys: ["docs.read"],
      },
    },
  }));

  assert.equal(output.lane, "extended");
  assert.equal(output.buildPlan.requestedLane, "extended");
  assert.equal(output.buildPlan.requiresApproval, true);
  assert.match(output.buildPlan.implementationSteps.join(" "), /dependency installation/i);
  assert.match(output.buildPlan.rollbackPlan.join(" "), /Undo dependency installation/i);
  assert.equal(output.envelope.allowedBuildScope.mayConfigureMcp, true);
  assert.equal(output.sessionState.lane, "extended");
  assert.equal(output.sessionState.phase, "planner");
  assert.equal(output.sessionState.status, "resumable");
});
