import assert from "node:assert/strict";
import test from "node:test";

import { createTmaBuildPlan } from "../ta-pool-types/index.js";
import { executeTmaPlan } from "./tma-executor.js";

test("tma executor consumes a plan and emits execution report, evidence, and rollback handle", () => {
  const plan = createTmaBuildPlan({
    planId: "plan-executor-1",
    provisionId: "provision-executor-1",
    requestedCapabilityKey: "mcp.playwright",
    requestedLane: "bootstrap",
    summary: "Build a repo-local playwright package.",
    implementationSteps: ["write package", "run smoke"],
    verificationPlan: ["run smoke", "run health"],
    rollbackPlan: ["remove package artifacts", "restore previous binding"],
    createdAt: "2026-03-19T16:00:00.000Z",
  });

  const result = executeTmaPlan({
    plan,
    startedAt: "2026-03-19T16:00:01.000Z",
    completedAt: "2026-03-19T16:00:05.000Z",
    producedArtifactRefs: ["tool:playwright", "binding:playwright"],
    verificationRefs: ["smoke:playwright", "health:playwright"],
  });

  assert.equal(result.report.status, "completed");
  assert.equal(result.report.producedArtifactRefs.length, 2);
  assert.equal(result.verificationEvidence.length, 2);
  assert.equal(result.rollbackHandle.handleId, "plan-executor-1:rollback");
  assert.equal(result.sessionState.phase, "executor");
  assert.equal(result.sessionState.status, "completed");
  assert.equal(result.sessionState.reportId, "plan-executor-1:report");
  assert.equal(result.sessionState.boundary.mayExecuteOriginalTask, false);
});

test("tma executor keeps a resumable executor state for failed runs", () => {
  const plan = createTmaBuildPlan({
    planId: "plan-executor-2",
    provisionId: "provision-executor-2",
    requestedCapabilityKey: "system.write",
    requestedLane: "extended",
    summary: "Build a higher-risk package without executing the original task.",
    implementationSteps: ["stage package", "verify boundaries"],
    verificationPlan: ["run smoke"],
    rollbackPlan: ["restore previous binding"],
    createdAt: "2026-03-25T12:00:00.000Z",
  });

  const result = executeTmaPlan({
    plan,
    startedAt: "2026-03-25T12:00:01.000Z",
    completedAt: "2026-03-25T12:00:05.000Z",
    status: "failed",
  });

  assert.equal(result.report.status, "failed");
  assert.equal(result.sessionState.phase, "executor");
  assert.equal(result.sessionState.status, "resumable");
  assert.match(result.sessionState.resumeSummary, /can resume/i);
  assert.equal(result.sessionState.boundary.scope, "capability_build_only");
});
