import assert from "node:assert/strict";
import test from "node:test";

import type { GoalFrameCompiled } from "../types/kernel-goal.js";
import type { KernelEvent } from "../types/kernel-events.js";
import type { AgentState } from "../types/kernel-state.js";
import { evaluateTransition } from "./transition-evaluator.js";
import { resetTransitionRules } from "./transition-table.js";
import { InvalidTransitionError } from "./transition-types.js";

const goalFrame: GoalFrameCompiled = {
  goalId: "goal-1",
  instructionText: "Solve the task",
  successCriteria: [{ id: "done", description: "Task is solved", required: true }],
  failureCriteria: [{ id: "fail", description: "Task cannot be solved", required: true }],
  constraints: [],
  inputRefs: [],
  cacheKey: "goal-cache-key"
};

function createState(status: AgentState["control"]["status"], phase: AgentState["control"]["phase"]): AgentState {
  return {
    control: {
      status,
      phase,
      retryCount: 0
    },
    working: {},
    observed: {
      artifactRefs: []
    },
    recovery: {}
  };
}

function createEvent(event: KernelEvent): KernelEvent {
  return event;
}

test("run.created enters the hot path and emits a model inference action", () => {
  resetTransitionRules();
  const state = createState("created", "decision");
  const event = createEvent({
    eventId: "evt-run-created",
    type: "run.created",
    sessionId: "session-1",
    runId: "run-1",
    createdAt: "2026-03-17T12:00:00.000Z",
    payload: {
      goalId: goalFrame.goalId
    }
  });

  const decision = evaluateTransition(state, event, goalFrame);

  assert.equal(decision.fromStatus, "created");
  assert.equal(decision.toStatus, "acting");
  assert.equal(decision.nextPhase, "execution");
  assert.equal(decision.nextAction?.kind, "model_inference");
  assert.equal(decision.nextAction?.intent?.kind, "model_inference");
});

test("state.delta_applied can choose a capability_call action from working state hints", () => {
  resetTransitionRules();
  const state: AgentState = {
    ...createState("deciding", "decision"),
    working: {
      nextCapabilityKey: "search.web",
      nextCapabilityInput: {
        query: "Praxis runtime kernel"
      }
    }
  };
  const event = createEvent({
    eventId: "evt-state-delta",
    type: "state.delta_applied",
    sessionId: "session-1",
    runId: "run-1",
    createdAt: "2026-03-17T12:01:00.000Z",
    payload: {
      delta: {
        working: state.working
      }
    }
  });

  const decision = evaluateTransition(state, event, goalFrame);

  assert.equal(decision.toStatus, "acting");
  assert.equal(decision.nextAction?.kind, "capability_call");
  assert.equal(decision.nextAction?.intent?.kind, "capability_call");
  assert.equal(decision.nextAction?.intent?.request.capabilityKey, "search.web");
});

test("state.delta_applied can choose a cmp_action from working state hints", () => {
  resetTransitionRules();
  const state: AgentState = {
    ...createState("deciding", "decision"),
    working: {
      nextCmpAction: "request_historical_context",
      nextCmpInput: {
        requesterAgentId: "main",
        projectId: "cmp-project",
        reason: "Need the latest high-signal checked history.",
        query: {},
      }
    }
  };
  const event = createEvent({
    eventId: "evt-cmp-state-delta",
    type: "state.delta_applied",
    sessionId: "session-1",
    runId: "run-1",
    createdAt: "2026-03-17T12:01:30.000Z",
    payload: {
      delta: {
        working: state.working
      }
    }
  });

  const decision = evaluateTransition(state, event, goalFrame);

  assert.equal(decision.toStatus, "acting");
  assert.equal(decision.nextAction?.kind, "cmp_action");
  assert.equal(decision.nextAction?.intent?.kind, "cmp_action");
  assert.equal(decision.nextAction?.intent?.request.action, "request_historical_context");
  const cmpInput = decision.nextAction?.intent?.request.input;
  if (!cmpInput || !("projectId" in cmpInput)) {
    throw new Error("Expected CMP request_historical_context input to carry projectId.");
  }
  assert.equal(cmpInput.projectId, "cmp-project");
});

test("intent.queued moves the run into waiting and stores the pending intent id", () => {
  resetTransitionRules();
  const state = createState("acting", "execution");
  const event = createEvent({
    eventId: "evt-intent-queued",
    type: "intent.queued",
    sessionId: "session-1",
    runId: "run-1",
    createdAt: "2026-03-17T12:02:00.000Z",
    payload: {
      intentId: "intent-1",
      kind: "model_inference",
      priority: "normal"
    }
  });

  const decision = evaluateTransition(state, event, goalFrame);

  assert.equal(decision.toStatus, "waiting");
  assert.equal(decision.nextAction?.kind, "wait");
  assert.equal(decision.stateDelta?.control?.pendingIntentId, "intent-1");
});

test("capability.result_received returns the run to the decision phase", () => {
  resetTransitionRules();
  const state = createState("waiting", "execution");
  const event = createEvent({
    eventId: "evt-capability-result",
    type: "capability.result_received",
    sessionId: "session-1",
    runId: "run-1",
    createdAt: "2026-03-17T12:03:00.000Z",
    payload: {
      requestId: "request-1",
      resultId: "result-1",
      status: "success"
    }
  });

  const decision = evaluateTransition(state, event, goalFrame);

  assert.equal(decision.toStatus, "deciding");
  assert.equal(decision.nextPhase, "decision");
  assert.equal(decision.stateDelta?.observed?.lastResultId, "result-1");
  assert.equal(decision.stateDelta?.observed?.lastResultStatus, "success");
});

test("run.paused follows the rare path and emits a pause action", () => {
  resetTransitionRules();
  const state = createState("waiting", "execution");
  const event = createEvent({
    eventId: "evt-run-paused",
    type: "run.paused",
    sessionId: "session-1",
    runId: "run-1",
    createdAt: "2026-03-17T12:04:00.000Z",
    payload: {
      reason: "manual intervention"
    }
  });

  const decision = evaluateTransition(state, event, goalFrame);

  assert.equal(decision.toStatus, "paused");
  assert.equal(decision.nextAction?.kind, "pause");
});

test("illegal transitions are rejected with InvalidTransitionError", () => {
  resetTransitionRules();
  const state = createState("completed", "commit");
  const event = createEvent({
    eventId: "evt-illegal",
    type: "intent.queued",
    sessionId: "session-1",
    runId: "run-1",
    createdAt: "2026-03-17T12:05:00.000Z",
    payload: {
      intentId: "intent-2",
      kind: "capability_call",
      priority: "high"
    }
  });

  assert.throws(
    () => evaluateTransition(state, event, goalFrame),
    (error: unknown) => {
      assert.ok(error instanceof InvalidTransitionError);
      assert.equal(error.fromStatus, "completed");
      assert.equal(error.eventType, "intent.queued");
      return true;
    }
  );
});
