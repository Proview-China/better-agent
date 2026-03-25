import assert from "node:assert/strict";
import test from "node:test";

import {
  cloneTmaSessionState,
  createTmaSessionState,
  markTmaSessionCompleted,
  markTmaSessionResumable,
} from "./tma-session-state.js";

test("tma session state roundtrip preserves resumable planner metadata", () => {
  const state = createTmaSessionState({
    sessionId: "tma-session-1",
    provisionId: "provision-1",
    planId: "plan-1",
    requestedCapabilityKey: "mcp.playwright",
    lane: "bootstrap",
    phase: "planner",
    status: "in_progress",
    createdAt: "2026-03-25T10:00:00.000Z",
    resumeSummary: "Planner prepared the build plan and can resume packaging guidance.",
    metadata: {
      stage: "initial",
    },
  });
  const resumable = markTmaSessionResumable(state, {
    updatedAt: "2026-03-25T10:00:05.000Z",
    resumeSummary: "Planner can resume from the generated build plan.",
    metadata: {
      stage: "resumable",
    },
  });
  const restored = cloneTmaSessionState(resumable);

  assert.equal(restored.status, "resumable");
  assert.equal(restored.phase, "planner");
  assert.equal(restored.boundary.mayExecuteOriginalTask, false);
  assert.equal(restored.boundary.scope, "capability_build_only");
  assert.equal(restored.resumeSummary, "Planner can resume from the generated build plan.");
  assert.equal(restored.metadata?.stage, "resumable");
});

test("tma session state can move executor lane into completed without widening scope", () => {
  const state = createTmaSessionState({
    sessionId: "tma-session-2",
    provisionId: "provision-2",
    planId: "plan-2",
    requestedCapabilityKey: "dependency.install",
    lane: "extended",
    phase: "executor",
    status: "in_progress",
    createdAt: "2026-03-25T11:00:00.000Z",
    resumeSummary: "Executor is producing verification evidence.",
  });
  const completed = markTmaSessionCompleted(state, {
    updatedAt: "2026-03-25T11:00:10.000Z",
    reportId: "plan-2:report",
    metadata: {
      result: "completed",
    },
  });

  assert.equal(completed.status, "completed");
  assert.equal(completed.phase, "executor");
  assert.equal(completed.reportId, "plan-2:report");
  assert.equal(completed.boundary.mayExecuteOriginalTask, false);
  assert.equal(completed.metadata?.result, "completed");
});
