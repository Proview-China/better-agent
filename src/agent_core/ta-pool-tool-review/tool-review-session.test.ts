import assert from "node:assert/strict";
import test from "node:test";

import { createAccessRequest } from "../ta-pool-types/index.js";
import { createTaHumanGateState } from "../ta-pool-runtime/human-gate.js";
import {
  appendToolReviewActionToSession,
  createToolReviewSessionSnapshot,
  createToolReviewSessionState,
  restoreToolReviewSessionSnapshot,
} from "./tool-review-session.js";
import { createToolReviewActionLedgerEntry, createToolReviewGovernanceTrace } from "./tool-review-contract.js";

test("tool review session tracks latest action and waiting_human state", () => {
  const session = createToolReviewSessionState({
    sessionId: "tool-review-session:1",
    createdAt: "2026-03-25T11:00:00.000Z",
  });
  const trace = createToolReviewGovernanceTrace({
    actionId: "action-session-1",
    actorId: "tool-reviewer",
    reason: "Track human gate wait.",
    createdAt: "2026-03-25T11:01:00.000Z",
  });
  const request = createAccessRequest({
    requestId: "req-1",
    sessionId: "session-1",
    runId: "run-1",
    agentId: "agent-1",
    requestedCapabilityKey: "computer.use",
    requestedTier: "B3",
    reason: "Need approval",
    mode: "strict",
    createdAt: "2026-03-25T11:00:00.000Z",
  });
  const action = createToolReviewActionLedgerEntry({
    reviewId: "review-session-1",
    sessionId: session.sessionId,
    input: {
      kind: "human_gate",
      trace,
      capabilityKey: "computer.use",
      gate: createTaHumanGateState({
        gateId: "gate-1",
        request,
        reason: "Need approval",
        plainLanguageRisk: {
          plainLanguageSummary: "Needs approval",
          requestedAction: "Use computer",
          riskLevel: "dangerous",
          whyItIsRisky: "Direct side effects",
          possibleConsequence: "Unexpected machine actions",
          whatHappensIfNotRun: "Task remains blocked",
          availableUserActions: [],
        },
        createdAt: "2026-03-25T11:00:30.000Z",
      }),
    },
    output: {
      kind: "human_gate",
      actionId: trace.actionId,
      status: "waiting_human",
      capabilityKey: "computer.use",
      gateId: "gate-1",
      gateStatus: "waiting_human",
      summary: "Waiting for approval.",
    },
    status: "waiting_human",
    recordedAt: trace.createdAt,
  });

  const next = appendToolReviewActionToSession(session, action);
  assert.equal(next.status, "waiting_human");
  assert.equal(next.latestActionId, "action-session-1");
  assert.deepEqual(next.actionIds, ["action-session-1"]);
});

test("tool review session snapshot roundtrip preserves action ledger", () => {
  const session = createToolReviewSessionState({
    sessionId: "tool-review-session:2",
    createdAt: "2026-03-25T11:10:00.000Z",
  });
  const trace = createToolReviewGovernanceTrace({
    actionId: "action-session-2",
    actorId: "tool-reviewer",
    reason: "Record lifecycle handoff.",
    createdAt: "2026-03-25T11:11:00.000Z",
  });
  const action = createToolReviewActionLedgerEntry({
    reviewId: "review-session-2",
    sessionId: session.sessionId,
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
      summary: "Lifecycle staged.",
    },
    status: "ready_for_handoff",
    recordedAt: trace.createdAt,
  });
  const snapshot = createToolReviewSessionSnapshot(
    appendToolReviewActionToSession(session, action),
    [action],
  );
  const restored = restoreToolReviewSessionSnapshot(snapshot);

  assert.equal(restored.session.sessionId, session.sessionId);
  assert.equal(restored.actions.length, 1);
  assert.equal(restored.actions[0]?.boundaryMode, "governance_only");
});
