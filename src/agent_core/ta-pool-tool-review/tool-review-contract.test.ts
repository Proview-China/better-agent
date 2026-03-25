import assert from "node:assert/strict";
import test from "node:test";

import {
  createToolReviewActionLedgerEntry,
  createToolReviewGovernanceTrace,
  resolveLifecycleTargetBindingState,
  TA_TOOL_REVIEW_ACTION_STATUSES,
  TA_TOOL_REVIEW_AGENT_BOUNDARY_MODES,
  TA_TOOL_REVIEW_GOVERNANCE_KINDS,
  TA_TOOL_REVIEW_LIFECYCLE_ACTIONS,
} from "./tool-review-contract.js";

test("tool review contract trace helper normalizes the minimal governance envelope", () => {
  const trace = createToolReviewGovernanceTrace({
    actionId: " action-1 ",
    actorId: " reviewer-1 ",
    reason: " stage activation handoff ",
    createdAt: "2026-03-25T08:00:00.000Z",
    request: {
      requestId: "req-1",
      sessionId: "session-1",
      runId: "run-1",
      requestedCapabilityKey: "mcp.playwright",
      requestedTier: "B2",
      mode: "strict",
      canonicalMode: "restricted",
      riskLevel: "risky",
    },
  });

  assert.equal(trace.actionId, "action-1");
  assert.equal(trace.actorId, "reviewer-1");
  assert.equal(trace.reason, "stage activation handoff");
  assert.equal(trace.request?.requestedCapabilityKey, "mcp.playwright");
});

test("tool review contract lifecycle helper maps lifecycle verbs to binding states", () => {
  assert.deepEqual(TA_TOOL_REVIEW_GOVERNANCE_KINDS, [
    "activation",
    "lifecycle",
    "human_gate",
    "replay",
  ]);
  assert.deepEqual(TA_TOOL_REVIEW_LIFECYCLE_ACTIONS, [
    "register",
    "replace",
    "suspend",
    "resume",
    "unregister",
  ]);
  assert.equal(resolveLifecycleTargetBindingState("register"), "active");
  assert.equal(resolveLifecycleTargetBindingState("replace"), "active");
  assert.equal(resolveLifecycleTargetBindingState("resume"), "active");
  assert.equal(resolveLifecycleTargetBindingState("suspend"), "disabled");
  assert.equal(resolveLifecycleTargetBindingState("unregister"), undefined);
});

test("tool review contract action ledger entry stays governance-only", () => {
  assert.deepEqual(TA_TOOL_REVIEW_AGENT_BOUNDARY_MODES, ["governance_only"]);
  assert.deepEqual(TA_TOOL_REVIEW_ACTION_STATUSES, [
    "recorded",
    "ready_for_handoff",
    "waiting_human",
    "blocked",
    "completed",
  ]);

  const trace = createToolReviewGovernanceTrace({
    actionId: "action-2",
    actorId: "tool-reviewer",
    reason: "Track lifecycle handoff.",
    createdAt: "2026-03-25T10:00:00.000Z",
  });
  const entry = createToolReviewActionLedgerEntry({
    reviewId: "review-2",
    sessionId: "session-2",
    input: {
      kind: "lifecycle",
      trace,
      capabilityKey: "mcp.playwright",
      lifecycleAction: "register",
      targetPool: "ta-capability-pool",
    },
    output: {
      kind: "lifecycle",
      actionId: trace.actionId,
      status: "ready_for_lifecycle_handoff",
      capabilityKey: "mcp.playwright",
      lifecycleAction: "register",
      targetPool: "ta-capability-pool",
      summary: "Lifecycle handoff staged.",
    },
    status: "ready_for_handoff",
    recordedAt: trace.createdAt,
  });

  assert.equal(entry.boundaryMode, "governance_only");
  assert.equal(entry.capabilityKey, "mcp.playwright");
  assert.equal(entry.status, "ready_for_handoff");
});
