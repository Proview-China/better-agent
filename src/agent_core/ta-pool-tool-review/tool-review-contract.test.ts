import assert from "node:assert/strict";
import test from "node:test";

import {
  TA_TOOL_REVIEW_ADVISORY_ACTORS,
  TA_TOOL_REVIEW_ADVISORY_CODES,
  TA_TOOL_REVIEW_ADVISORY_SEVERITIES,
  createToolReviewActionLedgerEntry,
  createToolReviewGovernanceTrace,
  createToolReviewTmaWorkOrder,
  resolveLifecycleTargetBindingState,
  TA_TOOL_REVIEW_ACTION_STATUSES,
  TA_TOOL_REVIEW_AGENT_BOUNDARY_MODES,
  TA_TOOL_REVIEW_GOVERNANCE_SIGNAL_KINDS,
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
    "provision_request",
    "activation",
    "delivery",
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

test("tool review contract exposes structured advisory and governance signal vocabularies", () => {
  assert.deepEqual(TA_TOOL_REVIEW_ADVISORY_CODES, [
    "manual_blocked_resolution",
    "manual_tma_follow_up",
    "manual_human_gate_follow_up",
    "manual_runtime_handoff",
    "manual_re_review",
    "record_evidence_only",
  ]);
  assert.deepEqual(TA_TOOL_REVIEW_ADVISORY_SEVERITIES, [
    "info",
    "warning",
    "critical",
  ]);
  assert.deepEqual(TA_TOOL_REVIEW_ADVISORY_ACTORS, [
    "tool_reviewer",
    "runtime_mainline",
    "human_reviewer",
    "tma",
  ]);
  assert.deepEqual(TA_TOOL_REVIEW_GOVERNANCE_SIGNAL_KINDS, [
    "hard_stop",
    "human_decision_required",
    "runtime_handoff_ready",
    "re_review_required",
    "tma_repair_candidate",
    "recorded_only",
    "governance_only_boundary",
  ]);
});

test("tool review contract can derive a TMA work order from a blocked governance action", () => {
  const trace = createToolReviewGovernanceTrace({
    actionId: "action-3",
    actorId: "tool-reviewer",
    reason: "Activation failed and needs a new package iteration.",
    createdAt: "2026-03-25T12:00:00.000Z",
  });
  const action = createToolReviewActionLedgerEntry({
    reviewId: "review-3",
    sessionId: "session-3",
    input: {
      kind: "activation",
      trace,
      provisionId: "prov-3",
      capabilityKey: "computer.use",
      activationSpec: {
        targetPool: "ta-capability-pool",
        activationMode: "activate_after_verify",
        registerOrReplace: "register_or_replace",
        generationStrategy: "create_next_generation",
        drainStrategy: "graceful",
        adapterFactoryRef: "factory:computer.use",
      },
    },
    output: {
      kind: "activation",
      actionId: trace.actionId,
      status: "activation_failed",
      capabilityKey: "computer.use",
      provisionId: "prov-3",
      targetPool: "ta-capability-pool",
      summary: "Activation failed and needs a rebuild.",
      failure: {
        attemptId: "attempt-3",
        provisionId: "prov-3",
        capabilityKey: "computer.use",
        failedAt: "2026-03-25T12:00:01.000Z",
        code: "driver_missing",
        message: "Driver missing.",
        retryable: true,
      },
    },
    status: "blocked",
    recordedAt: trace.createdAt,
  });

  const workOrder = createToolReviewTmaWorkOrder({
    sessionId: "session-3",
    capabilityKey: "computer.use",
    sourceAction: action,
    qualityReport: {
      sessionId: "session-3",
      verdict: "blocked",
      summary: "Tool governance is blocked by an activation failure.",
      recommendedNextStep: "Rebuild the capability package.",
      generatedAt: "2026-03-25T12:00:02.000Z",
      counts: {
        total: 1,
        recorded: 0,
        readyForHandoff: 0,
        waitingHuman: 0,
        blocked: 1,
        completed: 0,
      },
      blockingReviewIds: ["review-3"],
      waitingHumanReviewIds: [],
      readyForHandoffReviewIds: [],
      advisories: [
        {
          code: "manual_tma_follow_up",
          severity: "critical",
          actor: "tma",
          summary: "Blocked activation should be handed to TMA.",
          detail: "Prepare a repair lane without auto-executing the blocked task.",
          reviewIds: ["review-3"],
          hardStop: true,
          requiresManualAction: true,
          autoExecutionForbidden: true,
        },
      ],
      governanceSignals: [
        {
          kind: "hard_stop",
          active: true,
          summary: "Blocked activation is the active stop condition.",
          reviewIds: ["review-3"],
          hardStop: true,
          metadata: {
            reason: "blocked",
          },
        },
        {
          kind: "governance_only_boundary",
          active: true,
          summary: "Tool reviewer stays governance-only.",
          reviewIds: ["review-3"],
          hardStop: false,
          metadata: {
            boundaryMode: "governance_only",
            autoExecutionForbidden: true,
          },
        },
      ],
    },
  });

  assert.equal(workOrder.requestedLane, "extended");
  assert.equal(workOrder.priority, "high");
  assert.equal(workOrder.sourceReviewId, "review-3");
  assert.match(workOrder.objective, /Repair the capability package/i);
});
