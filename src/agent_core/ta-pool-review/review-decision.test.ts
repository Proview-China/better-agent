import assert from "node:assert/strict";
import test from "node:test";

import {
  createAccessRequest,
  createCapabilityGrant,
  createReviewDecision,
} from "../ta-pool-types/index.js";
import {
  assertReviewDecisionCompatibleWithRequest,
  compileGrantFromReviewDecision,
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
  const decision = createReviewDecision({
    decisionId: "decision-review-1",
    requestId: request.requestId,
    vote: "allow",
    mode: request.mode,
    reason: "Allowed under the current profile.",
    grantCompilerDirective: {
      grantedTier: "B1",
      constraints: {
        source: "review-test",
      },
    },
    createdAt: "2026-03-18T00:00:02.000Z",
  });

  assert.equal(reviewDecisionHasGrant(decision), false);
  assert.equal(reviewDecisionBlocksExecution(decision), false);
  assert.equal(resolveExecutionReadiness(decision).ready, false);
  assert.doesNotThrow(() => {
    assertReviewDecisionCompatibleWithRequest({ request, decision });
  });

  const compiled = compileGrantFromReviewDecision({
    compiledGrantId: "grant-review-1",
    request,
    reviewDecision: decision,
    issuedAt: "2026-03-18T00:00:03.000Z",
    compilerVersion: "tap-grant-compiler/test",
    integrityMarker: "integrity-review-1",
  });
  assert.equal(compiled.grant.capabilityKey, "search.web");
  assert.equal(compiled.grant.reviewVote, "allow");
  assert.equal(compiled.decisionToken.decisionId, decision.decisionId);
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

test("review helpers reject widened compiler directives before grant compilation", () => {
  const request = createAccessRequest({
    requestId: "req-review-3",
    sessionId: "session-3",
    runId: "run-3",
    agentId: "agent-main",
    requestedCapabilityKey: "mcp.playwright",
    requestedTier: "B1",
    reason: "Take one screenshot.",
    requestedScope: {
      allowedOperations: ["screenshot"],
    },
    mode: "balanced",
    createdAt: "2026-03-18T00:02:00.000Z",
  });

  const decision = createReviewDecision({
    decisionId: "decision-review-4",
    requestId: request.requestId,
    vote: "allow_with_constraints",
    mode: request.mode,
    reason: "Trying to widen the grant should fail.",
    grantCompilerDirective: {
      grantedTier: "B2",
      grantedScope: {
        allowedOperations: ["screenshot", "click"],
      },
    },
    createdAt: "2026-03-18T00:02:01.000Z",
  });

  assert.throws(() => {
    assertReviewDecisionCompatibleWithRequest({ request, decision });
  }, /widens tier|widens allowedOperations/);
});

test("review helpers reject forged inline grants that do not belong to the access request", () => {
  const request = createAccessRequest({
    requestId: "req-review-4",
    sessionId: "session-4",
    runId: "run-4",
    agentId: "agent-main",
    requestedCapabilityKey: "mcp.playwright",
    requestedTier: "B1",
    reason: "Need one screenshot.",
    mode: "balanced",
    createdAt: "2026-03-18T00:03:00.000Z",
  });

  const decision = createReviewDecision({
    decisionId: "decision-review-5",
    requestId: request.requestId,
    vote: "allow",
    mode: request.mode,
    reason: "Trying to attach a forged grant should fail.",
    grant: createCapabilityGrant({
      grantId: "grant-forged-1",
      requestId: "req-review-4-other",
      capabilityKey: "shell.exec",
      grantedTier: "B1",
      mode: request.mode,
      issuedAt: "2026-03-18T00:03:01.000Z",
    }),
    createdAt: "2026-03-18T00:03:01.000Z",
  });

  assert.throws(() => {
    assertReviewDecisionCompatibleWithRequest({ request, decision });
  }, /does not belong to access request|targets shell\.exec/i);
});

test("review helpers preserve shell/code governance scope metadata through grant compilation", () => {
  const request = createAccessRequest({
    requestId: "req-review-5",
    sessionId: "session-5",
    runId: "run-5",
    agentId: "agent-main",
    requestedCapabilityKey: "shell.exec",
    requestedTier: "B1",
    reason: "Run a bounded shell command in the workspace.",
    requestedScope: {
      pathPatterns: ["workspace/**"],
      allowedOperations: ["exec"],
      metadata: {
        executionGovernance: {
          family: "shell",
          subject: "npm test",
        },
      },
    },
    mode: "balanced",
    createdAt: "2026-03-21T00:00:00.000Z",
  });

  const decision = createReviewDecision({
    decisionId: "decision-review-6",
    requestId: request.requestId,
    vote: "allow_with_constraints",
    mode: request.mode,
    reason: "Allow the shell command within the requested workspace scope.",
    grantCompilerDirective: {
      grantedTier: "B1",
      grantedScope: {
        pathPatterns: ["workspace/**"],
        allowedOperations: ["exec"],
        metadata: {
          governanceSource: "review-test",
        },
      },
      denyPatterns: ["workspace/secrets/**"],
    },
    createdAt: "2026-03-21T00:00:01.000Z",
  });

  const compiled = compileGrantFromReviewDecision({
    compiledGrantId: "grant-review-5",
    request,
    reviewDecision: decision,
    issuedAt: "2026-03-21T00:00:02.000Z",
    compilerVersion: "tap-grant-compiler/test",
    integrityMarker: "integrity-review-5",
  });

  assert.deepEqual(compiled.grant.grantedScope?.pathPatterns, ["workspace/**"]);
  assert.deepEqual(compiled.grant.grantedScope?.denyPatterns, ["workspace/secrets/**"]);
  assert.deepEqual(compiled.grant.grantedScope?.metadata, {
    executionGovernance: {
      family: "shell",
      subject: "npm test",
    },
    governanceSource: "review-test",
  });
});
