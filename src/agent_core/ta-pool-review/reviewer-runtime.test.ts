import assert from "node:assert/strict";
import test from "node:test";

import {
  createAccessRequest,
  createAgentCapabilityProfile,
  createCapabilityGrant,
  createReviewDecision,
} from "../ta-pool-types/index.js";
import { createReviewerRuntime } from "./reviewer-runtime.js";

function createProfile() {
  return createAgentCapabilityProfile({
    profileId: "profile.main",
    agentClass: "main-agent",
    defaultMode: "balanced",
    baselineTier: "B0",
    baselineCapabilities: ["docs.read", "code.read"],
    deniedCapabilityPatterns: ["shell.*", "system.*"],
    allowedCapabilityPatterns: ["search.*", "mcp.*"],
  });
}

function createRequest(overrides: Partial<ReturnType<typeof createAccessRequest>> = {}) {
  return createAccessRequest({
    requestId: overrides.requestId ?? "req-reviewer-1",
    sessionId: overrides.sessionId ?? "session-1",
    runId: overrides.runId ?? "run-1",
    agentId: overrides.agentId ?? "agent-main",
    requestedCapabilityKey: overrides.requestedCapabilityKey ?? "mcp.playwright",
    requestedTier: overrides.requestedTier ?? "B1",
    reason: overrides.reason ?? "Need reviewer runtime decision.",
    mode: overrides.mode ?? "balanced",
    createdAt: overrides.createdAt ?? "2026-03-18T03:00:00.000Z",
  });
}

test("reviewer runtime returns baseline-approved decisions through the fast path", async () => {
  const runtime = createReviewerRuntime();
  const decision = await runtime.submit({
    request: createRequest({
      requestedCapabilityKey: "docs.read",
      requestedTier: "B0",
    }),
    profile: createProfile(),
  });

  assert.equal(decision.decision, "approved");
  assert.equal(decision.grant?.capabilityKey, "docs.read");
});

test("reviewer runtime redirects missing capabilities to provisioning", async () => {
  const runtime = createReviewerRuntime();
  const decision = await runtime.submit({
    request: createRequest({
      requestedCapabilityKey: "computer.use",
      requestedTier: "B2",
    }),
    profile: createProfile(),
    inventory: {
      availableCapabilityKeys: ["mcp.playwright"],
    },
  });

  assert.equal(decision.decision, "redirected_to_provisioning");
  assert.equal(decision.provisionCapabilityKey, "computer.use");
});

test("reviewer runtime falls back to review engine and can defer pending provisioning", async () => {
  const runtime = createReviewerRuntime();
  const decision = await runtime.submit({
    request: createRequest({
      requestedCapabilityKey: "mcp.playwright",
      requestedTier: "B1",
    }),
    profile: createProfile(),
    inventory: {
      availableCapabilityKeys: ["mcp.playwright"],
      pendingProvisionKeys: ["mcp.playwright"],
    },
  });

  assert.equal(decision.decision, "deferred");
});

test("reviewer runtime escalates strict critical requests to human", async () => {
  const runtime = createReviewerRuntime();
  const decision = await runtime.submit({
    request: createRequest({
      requestedCapabilityKey: "mcp.playwright",
      requestedTier: "B3",
      mode: "strict",
    }),
    profile: createProfile(),
    inventory: {
      availableCapabilityKeys: ["mcp.playwright"],
    },
  });

  assert.equal(decision.decision, "escalated_to_human");
  assert.equal(decision.escalationTarget, "human-review");
});

test("reviewer runtime preserves a future llm reviewer hook", async () => {
  const runtime = createReviewerRuntime({
    llmReviewerHook: async ({ request }) => {
      return createReviewDecision({
        decisionId: "hook-decision-1",
        requestId: request.requestId,
        decision: "approved",
        mode: request.mode,
        reason: "llm hook override",
        grant: createCapabilityGrant({
          grantId: "hook-grant-1",
          requestId: request.requestId,
          capabilityKey: request.requestedCapabilityKey,
          grantedTier: request.requestedTier,
          mode: request.mode,
          issuedAt: "2026-03-18T03:00:05.000Z",
        }),
        createdAt: "2026-03-18T03:00:05.000Z",
      });
    },
  });

  const decision = await runtime.submit({
    request: createRequest({
      requestedCapabilityKey: "mcp.playwright",
      requestedTier: "B1",
    }),
    profile: createProfile(),
    inventory: {
      availableCapabilityKeys: ["mcp.playwright"],
    },
  });

  assert.equal(runtime.hasLlmReviewerHook(), true);
  assert.equal(decision.decision, "approved");
  assert.equal(decision.reason, "llm hook override");
});
