import assert from "node:assert/strict";
import test from "node:test";

import {
  createCheckedSnapshot,
  createContextPackage,
  createRequestHistoricalContextInput,
} from "../cmp-types/index.js";
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
    metadata: {
      sourceRequestId: "request-1",
      sourceSectionIds: ["section-checked-1"],
    },
  });

  assert.equal(materialized.loop.stage, "attach_snapshots");
  assert.equal(materialized.loop.materializationOutput.requestId, "request-1");
  assert.deepEqual(materialized.loop.materializationOutput.sourceSectionIds, ["section-checked-1"]);
  assert.equal(materialized.loop.materializationOutput.bundleSchemaVersion, "cmp-dispatch-bundle/v1");
  assert.equal(materialized.loop.materializationOutput.primaryPackageStrategy, "materialize_active_context_as_primary_package");
  assert.equal(materialized.loop.materializationOutput.timelinePackageStrategy, "attach_timeline_as_secondary_package");
  assert.equal(materialized.loop.materializationOutput.taskSnapshotStrategy, "emit_task_snapshot_per_checked_context");
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

test("CmpDbAgentRuntime materializeWithLlm applies live rationale and supports fallback", async () => {
  const runtime = createCmpDbAgentRuntime();
  const input = {
    checkedSnapshot: createCheckedSnapshot({
      snapshotId: "snapshot-live",
      agentId: "main",
      lineageRef: "proj:main",
      branchRef: "refs/heads/cmp/main",
      commitRef: "commit-live",
      checkedAt: "2026-03-30T00:00:00.000Z",
    }),
    projectionId: "projection-live",
    contextPackage: createContextPackage({
      packageId: "pkg-live",
      sourceProjectionId: "projection-live",
      targetAgentId: "main",
      packageRef: "cmp-package:snapshot-live:main:active",
      createdAt: "2026-03-30T00:00:00.000Z",
    }),
    createdAt: "2026-03-30T00:00:00.000Z",
    loopId: "dbagent-loop-live",
    metadata: {
      sourceRequestId: "request-live",
      sourceSectionIds: ["section-checked-live"],
    },
  } as const;

  const live = await runtime.materializeWithLlm(input, {
    mode: "llm_assisted",
    executor: async () => ({
      output: {
        materializationRationale: "当前 checked snapshot 已足够构成主包与时间线附包。",
        primaryPackageStrategy: "prioritize_active_package_for_current_task",
        timelinePackageStrategy: "retain_timeline_as_secondary_reference",
        taskSnapshotStrategy: "emit_task_snapshot_for_each_checked_projection",
      },
      provider: "openai",
      model: "gpt-5.4",
      requestId: "resp-dbagent-live",
    }),
  });
  assert.equal(live.loop.materializationOutput.materializationRationale, "当前 checked snapshot 已足够构成主包与时间线附包。");
  assert.equal(live.loop.materializationOutput.primaryPackageStrategy, "prioritize_active_package_for_current_task");
  assert.equal(live.loop.materializationOutput.timelinePackageStrategy, "retain_timeline_as_secondary_reference");
  assert.equal(live.loop.materializationOutput.taskSnapshotStrategy, "emit_task_snapshot_for_each_checked_projection");
  assert.equal(live.loop.liveTrace?.status, "live_applied");
  assert.equal(live.loop.liveTrace?.provider, "openai");
  assert.equal((live.loop.metadata?.liveLlm as { status?: string } | undefined)?.status, "succeeded");
  assert.equal(live.loop.metadata?.materializationRationale, "当前 checked snapshot 已足够构成主包与时间线附包。");

  const fallback = await runtime.materializeWithLlm({
    ...input,
    loopId: "dbagent-loop-fallback",
  }, {
    mode: "llm_assisted",
    executor: async () => {
      throw new Error("gateway failed");
    },
  });
  assert.equal(fallback.loop.materializationOutput.materializationRationale, undefined);
  assert.equal(fallback.loop.liveTrace?.status, "fallback_rules");
  assert.equal((fallback.loop.metadata?.liveLlm as { status?: string; fallbackApplied?: boolean } | undefined)?.status, "fallback");
  assert.equal((fallback.loop.metadata?.liveLlm as { fallbackApplied?: boolean } | undefined)?.fallbackApplied, true);

  await assert.rejects(
    () => runtime.materializeWithLlm({
      ...input,
      loopId: "dbagent-loop-required",
    }, {
      mode: "llm_required",
      executor: async () => {
        throw new Error("hard fail");
      },
    }),
    /hard fail/u,
  );
});

test("CmpDbAgentRuntime servePassiveWithLlm keeps passive topology while exposing live metadata", async () => {
  const runtime = createCmpDbAgentRuntime();
  const input = {
    request: createRequestHistoricalContextInput({
      requesterAgentId: "main-passive",
      projectId: "proj-passive",
      reason: "需要回看最近一次 checked snapshot",
      query: {
        snapshotId: "snapshot-passive",
        branchRef: "refs/heads/cmp/main-passive",
      },
    }),
    snapshot: createCheckedSnapshot({
      snapshotId: "snapshot-passive",
      agentId: "main-passive",
      lineageRef: "proj:main-passive",
      branchRef: "refs/heads/cmp/main-passive",
      commitRef: "commit-passive",
      checkedAt: "2026-03-30T00:10:00.000Z",
    }),
    contextPackage: createContextPackage({
      packageId: "pkg-passive",
      sourceProjectionId: "projection-passive",
      targetAgentId: "main-passive",
      packageKind: "historical_reply",
      packageRef: "cmp-package:snapshot-passive:main-passive:historical_reply",
      createdAt: "2026-03-30T00:10:00.000Z",
    }),
    createdAt: "2026-03-30T00:10:00.000Z",
    loopId: "dbagent-passive-live",
    metadata: {
      sourceRequestId: "request-passive",
      sourceSectionIds: ["section-passive-1"],
    },
  } as const;

  const live = await runtime.servePassiveWithLlm(input, {
    mode: "llm_assisted",
    executor: async () => ({
      output: {
        materializationRationale: "被动回送包需要保留时间线和任务快照，方便主 agent 回看历史。",
        primaryPackageStrategy: "promote_historical_reply_as_primary_passive_package",
        timelinePackageStrategy: "attach_timeline_for_readback",
        taskSnapshotStrategy: "keep_task_snapshot_for_passive_traceability",
        passivePackagingStrategy: "clean_core_return_with_high_fidelity_history",
      },
      provider: "openai",
      model: "gpt-5.4",
      requestId: "resp-dbagent-passive-live",
    }),
  });

  assert.equal(live.loop.materializationOutput.packageTopology, "passive_reply_plus_timeline_plus_task_snapshots");
  assert.equal(live.loop.materializationOutput.materializationRationale, "被动回送包需要保留时间线和任务快照，方便主 agent 回看历史。");
  assert.equal(live.loop.materializationOutput.primaryPackageStrategy, "promote_historical_reply_as_primary_passive_package");
  assert.equal(live.loop.materializationOutput.passivePackagingStrategy, "clean_core_return_with_high_fidelity_history");
  assert.equal(live.loop.liveTrace?.status, "live_applied");
  assert.equal((live.loop.metadata?.liveLlm as { status?: string } | undefined)?.status, "succeeded");

  const fallback = await runtime.servePassiveWithLlm({
    ...input,
    loopId: "dbagent-passive-fallback",
  }, {
    mode: "llm_assisted",
    executor: async () => {
      throw new Error("passive gateway failed");
    },
  });

  assert.equal(fallback.loop.materializationOutput.packageTopology, "passive_reply_plus_timeline_plus_task_snapshots");
  assert.equal(fallback.loop.materializationOutput.passivePackagingStrategy, "historical_reply_clean_return");
  assert.equal(fallback.loop.materializationOutput.materializationRationale, undefined);
  assert.equal(fallback.loop.liveTrace?.status, "fallback_rules");
  assert.equal((fallback.loop.metadata?.liveLlm as { status?: string; fallbackApplied?: boolean } | undefined)?.status, "fallback");
  assert.equal((fallback.loop.metadata?.liveLlm as { fallbackApplied?: boolean } | undefined)?.fallbackApplied, true);
});
