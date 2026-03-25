import assert from "node:assert/strict";
import test from "node:test";

import {
  createAccessRequest,
  createReviewDecision,
} from "../ta-pool-types/index.js";
import {
  createReviewerDurableSnapshot,
  createReviewerDurableState,
  hydrateReviewerDurableSnapshot,
} from "./reviewer-durable-state.js";

function createRequest() {
  return createAccessRequest({
    requestId: "req-reviewer-durable-1",
    sessionId: "session-1",
    runId: "run-1",
    agentId: "agent-main",
    requestedCapabilityKey: "mcp.playwright",
    requestedTier: "B1",
    reason: "Need reviewer durable state.",
    mode: "balanced",
    createdAt: "2026-03-25T10:00:00.000Z",
  });
}

test("createReviewerDurableState maps human escalation into waiting_human durable stage", () => {
  const request = createRequest();
  const decision = createReviewDecision({
    decisionId: "decision-1",
    requestId: request.requestId,
    decision: "escalated_to_human",
    vote: "escalate_to_human",
    mode: request.mode,
    reason: "Need human review.",
    escalationTarget: "human-review",
    createdAt: "2026-03-25T10:00:05.000Z",
  });

  const state = createReviewerDurableState({
    request,
    decision,
    source: "review_engine",
  });

  assert.equal(state.stage, "waiting_human");
  assert.equal(state.escalationTarget, "human-review");
  assert.equal(state.hasGrantCompilerDirective, false);
});

test("reviewer durable snapshot roundtrip preserves resumable and completed states", () => {
  const request = createRequest();
  const deferred = createReviewerDurableState({
    request,
    decision: createReviewDecision({
      decisionId: "decision-2",
      requestId: request.requestId,
      decision: "redirected_to_provisioning",
      vote: "redirect_to_provisioning",
      mode: request.mode,
      reason: "Need provisioning.",
      provisionCapabilityKey: request.requestedCapabilityKey,
      createdAt: "2026-03-25T10:00:05.000Z",
    }),
    source: "review_engine",
  });
  const completed = createReviewerDurableState({
    request: createAccessRequest({
      ...request,
      requestId: "req-reviewer-durable-2",
      requestedCapabilityKey: "docs.read",
      requestedTier: "B0",
      createdAt: "2026-03-25T10:01:00.000Z",
    }),
    decision: createReviewDecision({
      decisionId: "decision-3",
      requestId: "req-reviewer-durable-2",
      decision: "partially_approved",
      vote: "allow_with_constraints",
      mode: request.mode,
      reason: "Baseline capability.",
      createdAt: "2026-03-25T10:01:05.000Z",
      grantCompilerDirective: {
        grantedTier: "B0",
        constraints: {
          source: "reviewer-durable-state-test",
        },
      },
    }),
    source: "routing_fast_path",
  });

  const hydrated = hydrateReviewerDurableSnapshot(
    createReviewerDurableSnapshot([deferred, completed]),
  );

  assert.equal(hydrated.get(deferred.requestId)?.stage, "ready_to_resume");
  assert.equal(hydrated.get(completed.requestId)?.stage, "completed");
});

test("createReviewerDurableState rejects inline grant persistence to keep reviewer vote-only", () => {
  const request = createRequest();
  const decision = createReviewDecision({
    decisionId: "decision-4",
    requestId: request.requestId,
    decision: "approved",
    vote: "allow",
    mode: request.mode,
    reason: "Should not persist inline grants.",
    createdAt: "2026-03-25T10:00:05.000Z",
    grant: {
      grantId: "grant-1",
      requestId: request.requestId,
      capabilityKey: request.requestedCapabilityKey,
      grantedTier: request.requestedTier,
      mode: request.mode,
      canonicalMode: request.canonicalMode,
      issuedAt: "2026-03-25T10:00:05.000Z",
    },
  });

  assert.throws(
    () => createReviewerDurableState({ request, decision, source: "llm_hook" }),
    /vote-only and cannot persist inline grants/i,
  );
});
