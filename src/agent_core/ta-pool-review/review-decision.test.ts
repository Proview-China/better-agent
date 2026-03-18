import assert from "node:assert/strict";
import test from "node:test";

import {
  createAccessRequest,
  createCapabilityGrant,
  createReviewDecision,
} from "../ta-pool-types/index.js";
import {
  assertReviewDecisionCompatibleWithRequest,
  resolveExecutionReadiness,
  reviewDecisionBlocksExecution,
  reviewDecisionHasGrant,
  reviewDecisionRequiresHuman,
  reviewDecisionRequiresProvisioning,
  toProvisionRequestFromReviewDecision,
} from "./review-decision.js";

test("review helpers detect grant-bearing decisions and execution readiness", () => {
  const request = createAccessRequest({
    requestId: "req-review-1",
    sessionId: "session-1",
    runId: "run-1",
    agentId: "agent-main",
    requestedCapabilityKey: "search.web",
    reason: "Need current information from the web.",
    mode: "balanced",
    createdAt: "2026-03-18T00:00:00.000Z",
  });
  const grant = createCapabilityGrant({
    grantId: "grant-review-1",
    requestId: request.requestId,
    capabilityKey: request.requestedCapabilityKey,
    grantedTier: "B1",
    mode: request.mode,
    issuedAt: "2026-03-18T00:00:01.000Z",
  });
  const decision = createReviewDecision({
    decisionId: "decision-review-1",
    requestId: request.requestId,
    decision: "approved",
    mode: request.mode,
    reason: "Allowed under the current profile.",
    grant,
    createdAt: "2026-03-18T00:00:02.000Z",
  });

  assert.equal(reviewDecisionHasGrant(decision), true);
  assert.equal(reviewDecisionBlocksExecution(decision), false);
  assert.equal(resolveExecutionReadiness(decision).ready, true);
  assert.doesNotThrow(() => {
    assertReviewDecisionCompatibleWithRequest({ request, decision });
  });
});

test("review helpers detect provisioning and human escalation branches", () => {
  const request = createAccessRequest({
    requestId: "req-review-2",
    sessionId: "session-2",
    runId: "run-2",
    agentId: "agent-main",
    requestedCapabilityKey: "mcp.playwright",
    reason: "User explicitly asked for a browser screenshot via MCP.",
    mode: "strict",
    createdAt: "2026-03-18T00:01:00.000Z",
  });

  const provisioningDecision = createReviewDecision({
    decisionId: "decision-review-2",
    requestId: request.requestId,
    decision: "redirected_to_provisioning",
    mode: request.mode,
    reason: "Capability is not currently installed.",
    provisionCapabilityKey: request.requestedCapabilityKey,
    createdAt: "2026-03-18T00:01:01.000Z",
  });

  assert.equal(reviewDecisionRequiresProvisioning(provisioningDecision), true);
  assert.equal(reviewDecisionBlocksExecution(provisioningDecision), true);

  const provisionRequest = toProvisionRequestFromReviewDecision({
    request,
    decision: provisioningDecision,
    provisionId: "provision-review-1",
    createdAt: "2026-03-18T00:01:02.000Z",
  });
  assert.equal(provisionRequest.requestedCapabilityKey, "mcp.playwright");
  assert.deepEqual(provisionRequest.expectedArtifacts, ["tool", "binding", "verification", "usage"]);

  const escalationDecision = createReviewDecision({
    decisionId: "decision-review-3",
    requestId: request.requestId,
    decision: "escalated_to_human",
    mode: request.mode,
    reason: "Dangerous request needs manual review.",
    escalationTarget: "human-operator",
    createdAt: "2026-03-18T00:01:03.000Z",
  });

  assert.equal(reviewDecisionRequiresHuman(escalationDecision), true);
  assert.equal(reviewDecisionBlocksExecution(escalationDecision), true);
});
