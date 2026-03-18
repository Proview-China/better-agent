import assert from "node:assert/strict";
import test from "node:test";

import {
  PROVISION_ARTIFACT_STATUSES,
  REVIEW_DECISION_KINDS,
  TA_CAPABILITY_TIERS,
  TA_POOL_MODES,
  createAccessRequest,
  createAgentCapabilityProfile,
  createCapabilityGrant,
  createProvisionArtifactBundle,
  createProvisionRequest,
  createReviewDecision,
  isCapabilityAllowedByProfile,
  isCapabilityDeniedByProfile,
  isTerminalReviewDecision,
} from "./index.js";

test("ta-pool protocol constants expose the frozen first-wave enums", () => {
  assert.deepEqual(TA_CAPABILITY_TIERS, ["B0", "B1", "B2", "B3"]);
  assert.deepEqual(TA_POOL_MODES, ["strict", "balanced", "yolo"]);
  assert.deepEqual(REVIEW_DECISION_KINDS, [
    "approved",
    "partially_approved",
    "denied",
    "deferred",
    "escalated_to_human",
    "redirected_to_provisioning",
  ]);
  assert.deepEqual(PROVISION_ARTIFACT_STATUSES, [
    "pending",
    "building",
    "verifying",
    "ready",
    "failed",
    "superseded",
  ]);
});

test("agent capability profile preserves baseline and pattern semantics", () => {
  const profile = createAgentCapabilityProfile({
    profileId: "profile.main",
    agentClass: "main-agent",
    baselineCapabilities: ["docs.read", "code.read"],
    allowedCapabilityPatterns: ["search.*", "code.write.*"],
    deniedCapabilityPatterns: ["shell.*", "system.*"],
  });

  assert.equal(isCapabilityAllowedByProfile({ profile, capabilityKey: "docs.read" }), true);
  assert.equal(isCapabilityAllowedByProfile({ profile, capabilityKey: "search.web" }), true);
  assert.equal(isCapabilityAllowedByProfile({ profile, capabilityKey: "shell.exec" }), false);
  assert.equal(isCapabilityDeniedByProfile({ profile, capabilityKey: "system.sudo" }), true);
});

test("review decisions enforce first-wave state semantics", () => {
  const request = createAccessRequest({
    requestId: "req-1",
    sessionId: "session-1",
    runId: "run-1",
    agentId: "agent-main",
    requestedCapabilityKey: "mcp.playwright",
    reason: "User explicitly requested a screenshot via MCP.",
    mode: "strict",
    createdAt: "2026-03-18T00:00:00.000Z",
  });

  const grant = createCapabilityGrant({
    grantId: "grant-1",
    requestId: request.requestId,
    capabilityKey: request.requestedCapabilityKey,
    grantedTier: "B1",
    mode: request.mode,
    issuedAt: "2026-03-18T00:00:01.000Z",
  });

  const approved = createReviewDecision({
    decisionId: "decision-1",
    requestId: request.requestId,
    decision: "approved",
    mode: request.mode,
    reason: "User explicitly requested the capability.",
    grant,
    createdAt: "2026-03-18T00:00:02.000Z",
  });
  assert.equal(isTerminalReviewDecision(approved.decision), true);

  const deferred = createReviewDecision({
    decisionId: "decision-2",
    requestId: request.requestId,
    decision: "deferred",
    mode: request.mode,
    reason: "Need provisioning first.",
    deferredReason: "Awaiting provision artifact bundle.",
    createdAt: "2026-03-18T00:00:03.000Z",
  });
  assert.equal(isTerminalReviewDecision(deferred.decision), false);
});

test("provision contracts require a full artifact set once ready", () => {
  const request = createProvisionRequest({
    provisionId: "provision-1",
    sourceRequestId: "req-1",
    requestedCapabilityKey: "mcp.playwright",
    reason: "No matching capability is currently installed.",
    expectedArtifacts: ["tool", "binding", "verification", "usage"],
    createdAt: "2026-03-18T00:00:00.000Z",
  });

  const bundle = createProvisionArtifactBundle({
    bundleId: "bundle-1",
    provisionId: request.provisionId,
    status: "ready",
    toolArtifact: { artifactId: "tool-1", kind: "tool", ref: "tools/playwright" },
    bindingArtifact: { artifactId: "binding-1", kind: "binding", ref: "binding:playwright" },
    verificationArtifact: { artifactId: "verification-1", kind: "verification", ref: "smoke:playwright" },
    usageArtifact: { artifactId: "usage-1", kind: "usage", ref: "skills/playwright.md" },
    completedAt: "2026-03-18T00:00:05.000Z",
  });

  assert.equal(bundle.status, "ready");
  assert.equal(bundle.usageArtifact?.kind, "usage");
});
