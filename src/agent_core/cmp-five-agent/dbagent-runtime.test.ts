import assert from "node:assert/strict";
import test from "node:test";

import { createCheckedSnapshot, createContextPackage } from "../cmp-types/index.js";
import { createCmpDbAgentRuntime, createCmpTimelinePackageRef } from "./dbagent-runtime.js";

test("CmpDbAgentRuntime materializes primary package plus timeline attachment and task snapshots", () => {
  const runtime = createCmpDbAgentRuntime();
  const materialized = runtime.materialize({
    checkedSnapshot: createCheckedSnapshot({
      snapshotId: "snapshot-1",
      agentId: "main",
      lineageRef: "proj:main",
      branchRef: "refs/heads/cmp/main",
      commitRef: "commit-1",
      checkedAt: "2026-03-25T00:00:00.000Z",
    }),
    projectionId: "projection-1",
    contextPackage: createContextPackage({
      packageId: "pkg-1",
      sourceProjectionId: "projection-1",
      targetAgentId: "main",
      packageRef: "cmp-package:snapshot-1:main:active",
      createdAt: "2026-03-25T00:00:00.000Z",
    }),
    createdAt: "2026-03-25T00:00:00.000Z",
    loopId: "dbagent-loop-1",
  });

  assert.equal(materialized.loop.stage, "attach_snapshots");
  assert.equal(materialized.family.timelinePackageRef, createCmpTimelinePackageRef("cmp-package:snapshot-1:main:active"));
  assert.equal(materialized.taskSnapshots.length, 1);
  assert.deepEqual(materialized.loop.metadata?.packageBundle, {
    topology: "active_plus_timeline_plus_task_snapshots",
    primaryPackageId: "pkg-1",
    timelinePackageId: "pkg-1:timeline",
    taskSnapshotIds: ["pkg-1:task-state"],
  });
});

test("CmpDbAgentRuntime keeps reintervention payloads as stable structured fields", () => {
  const runtime = createCmpDbAgentRuntime();

  const requested = runtime.requestReintervention({
    requestId: "reintervention-1",
    childAgentId: "child-a",
    parentAgentId: "parent-a",
    gapSummary: "child context is missing promoted dependency state",
    currentStateSummary: "child has latest checked snapshot but no parent coarse package",
    currentPackageId: "pkg-child-1",
    createdAt: "2026-03-25T00:10:00.000Z",
    metadata: {
      currentStateRefs: ["checked:child-a:latest", "projection:child-a:latest"],
    },
  });

  assert.equal(requested.status, "pending_parent_dbagent_review");
  assert.deepEqual(requested.metadata?.reinterventionPayload, {
    gapSummary: "child context is missing promoted dependency state",
    currentStateSummary: "child has latest checked snapshot but no parent coarse package",
    currentPackageId: "pkg-child-1",
    currentStateRefs: ["pkg-child-1", "checked:child-a:latest", "projection:child-a:latest"],
    requestStatus: "pending_parent_dbagent_review",
  });

  const served = runtime.serveReintervention({
    requestId: "reintervention-1",
    servedPackageId: "pkg-parent-coarse-1",
    resolvedAt: "2026-03-25T00:11:00.000Z",
  });

  assert.equal(served.status, "served");
  assert.deepEqual(served.metadata?.reinterventionPayload, {
    gapSummary: "child context is missing promoted dependency state",
    currentStateSummary: "child has latest checked snapshot but no parent coarse package",
    currentPackageId: "pkg-child-1",
    currentStateRefs: ["pkg-child-1", "checked:child-a:latest", "projection:child-a:latest"],
    requestStatus: "served",
    servedPackageId: "pkg-parent-coarse-1",
    resolvedAt: "2026-03-25T00:11:00.000Z",
  });
});
