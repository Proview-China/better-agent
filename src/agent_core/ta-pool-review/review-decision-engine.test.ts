import assert from "node:assert/strict";
import test from "node:test";

import {
  createAccessRequest,
  createAgentCapabilityProfile,
} from "../ta-pool-types/index.js";
import { evaluateReviewDecision } from "./review-decision-engine.js";

const profile = createAgentCapabilityProfile({
  profileId: "profile.main",
  agentClass: "main-agent",
  defaultMode: "balanced",
  baselineTier: "B0",
  baselineCapabilities: ["docs.read", "code.read"],
  allowedCapabilityPatterns: ["search.*", "mcp.*"],
  deniedCapabilityPatterns: ["shell.*", "system.*"],
});

function createRequest(overrides: Partial<ReturnType<typeof createAccessRequest>> = {}) {
  return createAccessRequest({
    requestId: overrides.requestId ?? "req-1",
    sessionId: overrides.sessionId ?? "session-1",
    runId: overrides.runId ?? "run-1",
    agentId: overrides.agentId ?? "agent-main",
    requestedCapabilityKey: overrides.requestedCapabilityKey ?? "mcp.playwright",
    requestedTier: overrides.requestedTier ?? "B1",
    reason: overrides.reason ?? "User explicitly requested the capability.",
    mode: overrides.mode ?? "balanced",
    createdAt: overrides.createdAt ?? "2026-03-18T02:00:00.000Z",
  });
}

test("review engine fast-path approves baseline capabilities", () => {
  const decision = evaluateReviewDecision({
    request: createRequest({
      requestedCapabilityKey: "docs.read",
      requestedTier: "B0",
    }),
    profile,
  });

  assert.equal(decision.decision, "approved");
  assert.equal(decision.grant?.constraints?.source, "baseline-fast-path");
});

test("review engine denies capabilities blocked by profile", () => {
  const decision = evaluateReviewDecision({
    request: createRequest({
      requestedCapabilityKey: "shell.exec",
      requestedTier: "B3",
      mode: "strict",
    }),
    profile,
  });

  assert.equal(decision.decision, "denied");
});

test("review engine redirects missing capabilities to provisioning", () => {
  const decision = evaluateReviewDecision({
    request: createRequest({
      requestedCapabilityKey: "computer.use",
      requestedTier: "B2",
    }),
    profile,
    inventory: {
      availableCapabilityKeys: ["mcp.playwright"],
    },
  });

  assert.equal(decision.decision, "redirected_to_provisioning");
  assert.equal(decision.provisionCapabilityKey, "computer.use");
});

test("review engine defers when provisioning is already pending", () => {
  const decision = evaluateReviewDecision({
    request: createRequest({
      requestedCapabilityKey: "mcp.playwright",
      requestedTier: "B1",
    }),
    profile,
    inventory: {
      pendingProvisionKeys: ["mcp.playwright"],
    },
  });

  assert.equal(decision.decision, "deferred");
});

test("review engine escalates critical strict requests to human", () => {
  const decision = evaluateReviewDecision({
    request: createRequest({
      requestedCapabilityKey: "mcp.playwright",
      requestedTier: "B3",
      mode: "strict",
    }),
    profile,
    inventory: {
      availableCapabilityKeys: ["mcp.playwright"],
    },
  });

  assert.equal(decision.decision, "escalated_to_human");
  assert.equal(decision.escalationTarget, "human-review");
});
