import assert from "node:assert/strict";
import test from "node:test";

import { createAgentCoreRuntime } from "../runtime.js";

test("CMP worksite observeTurn exports a core worksite package and tap aperture", () => {
  const runtime = createAgentCoreRuntime();

  const observed = runtime.cmp.worksite.observeTurn({
    sessionId: "session-worksite-1",
    turnIndex: 3,
    currentObjective: "继续修复 worksite contract",
    observedAt: "2026-04-16T10:00:00.000Z",
    cmp: {
      syncStatus: "synced",
      agentId: "cmp-live-cli-main",
      packageId: "pkg-worksite-1",
      packageRef: "cmp-package:worksite-1",
      packageKind: "active_reseed",
      packageMode: "core_return",
      fidelityLabel: "checked_high_fidelity",
      projectionId: "projection-worksite-1",
      snapshotId: "snapshot-worksite-1",
      intent: "keep current project worksite aligned",
      operatorGuide: "focus on the checked project worksite only",
      childGuide: "child work should enter child icma only",
      checkerReason: "checked package is usable",
      routeRationale: "core return keeps the current worksite stable",
      scopePolicy: "current_worksite_only",
      packageStrategy: "primary_package_plus_timeline",
      timelineStrategy: "timeline package retained for continuity",
    },
  });

  assert.equal(observed.deliveryStatus, "available");
  assert.equal(observed.activeTurnIndex, 3);

  const worksite = runtime.cmp.worksite.exportCorePackage({
    sessionId: "session-worksite-1",
    currentObjective: "现在先看当前 project worksite",
  });

  assert.equal(worksite.schemaVersion, "core-cmp-worksite-package/v1");
  assert.equal(worksite.deliveryStatus, "available");
  assert.equal(worksite.identity?.sessionId, "session-worksite-1");
  assert.equal(worksite.identity?.agentId, "cmp-live-cli-main");
  assert.equal(worksite.identity?.packageRef, "cmp-package:worksite-1");
  assert.equal(worksite.objective?.currentObjective, "现在先看当前 project worksite");
  assert.equal(worksite.objective?.taskSummary, "keep current project worksite aligned");
  assert.equal(worksite.objective?.activeTurnIndex, 3);
  assert.match(worksite.payload?.primaryContext ?? "", /latest package|active package family/);
  assert.equal(worksite.governance?.recoveryStatus, "degraded");

  const aperture = runtime.cmp.worksite.exportTapPackage({
    sessionId: "session-worksite-1",
    currentObjective: "审核当前 capability request",
    requestedCapabilityKey: "code.grep",
  });

  assert.equal(aperture?.schemaVersion, "cmp-tap-review-aperture/v1");
  assert.equal(aperture?.requestedCapabilityKey, "code.grep");
  assert.equal(aperture?.currentObjective, "审核当前 capability request");
  assert.equal(aperture?.packageRef, "cmp-package:worksite-1");
});

test("CMP worksite clearSession removes the current worksite record", () => {
  const runtime = createAgentCoreRuntime();

  runtime.cmp.worksite.observeTurn({
    sessionId: "session-worksite-clear",
    turnIndex: 1,
    currentObjective: "做一轮 worksite 清理测试",
    cmp: {
      syncStatus: "failed",
      agentId: "cmp-live-cli-main",
      packageId: "pending",
      packageRef: "pending",
      projectionId: "pending",
      snapshotId: "pending",
      intent: "failed cmp sync",
      operatorGuide: "fall back to verified user objective",
      childGuide: "pending",
      checkerReason: "pending",
      routeRationale: "pending",
      scopePolicy: "pending",
      packageStrategy: "pending",
      timelineStrategy: "pending",
    },
  });

  assert.equal(runtime.cmp.worksite.getCurrent({
    sessionId: "session-worksite-clear",
  })?.deliveryStatus, "partial");

  runtime.cmp.worksite.clearSession({
    sessionId: "session-worksite-clear",
  });

  assert.equal(runtime.cmp.worksite.getCurrent({
    sessionId: "session-worksite-clear",
  }), undefined);
  assert.equal(runtime.cmp.worksite.exportCorePackage({
    sessionId: "session-worksite-clear",
    currentObjective: "重新开始",
  }).deliveryStatus, "absent");
});

test("CMP worksite snapshot survives runtime snapshot and recovery", () => {
  const runtime = createAgentCoreRuntime();

  runtime.cmp.worksite.observeTurn({
    sessionId: "session-worksite-recover",
    turnIndex: 2,
    currentObjective: "恢复后继续当前 worksite",
    observedAt: "2026-04-16T12:00:00.000Z",
    cmp: {
      syncStatus: "synced",
      agentId: "cmp-live-cli-session-recover",
      packageId: "pkg-worksite-recover",
      packageRef: "cmp-package:recover-1",
      packageKind: "active_reseed",
      packageMode: "core_return",
      fidelityLabel: "checked_high_fidelity",
      projectionId: "projection-worksite-recover",
      snapshotId: "snapshot-worksite-recover",
      intent: "continue from recovered worksite",
      operatorGuide: "resume from the recovered worksite package",
      childGuide: "keep child work routed separately",
      checkerReason: "recovered package still valid",
      routeRationale: "current worksite remains valid after recovery",
      scopePolicy: "current_worksite_only",
      packageStrategy: "primary_package_plus_timeline",
      timelineStrategy: "timeline stays attached to the recovered worksite",
    },
  });

  const snapshot = runtime.createCmpRuntimeSnapshot();
  const recoveredRuntime = createAgentCoreRuntime();
  recoveredRuntime.recoverCmpRuntimeSnapshot(snapshot);

  const recovered = recoveredRuntime.cmp.worksite.exportCorePackage({
    sessionId: "session-worksite-recover",
    currentObjective: "恢复后继续当前 worksite",
  });

  assert.equal(recovered.deliveryStatus, "available");
  assert.equal(recovered.identity?.packageRef, "cmp-package:recover-1");
  assert.equal(recovered.objective?.taskSummary, "continue from recovered worksite");
  assert.equal(recovered.governance?.checkerReason, "recovered package still valid");
});

test("CMP worksite export does not drift when two sessions previously shared one live cmp agent id", () => {
  const runtime = createAgentCoreRuntime();
  const originalGetSummary = runtime.getCmpFiveAgentRuntimeSummary.bind(runtime);
  const originalGetSnapshot = runtime.getCmpFiveAgentRuntimeSnapshot.bind(runtime);
  let phase: "session-a" | "session-b" | "drifted" = "session-a";

  (runtime as unknown as {
    getCmpFiveAgentRuntimeSummary: typeof runtime.getCmpFiveAgentRuntimeSummary;
    getCmpFiveAgentRuntimeSnapshot: typeof runtime.getCmpFiveAgentRuntimeSnapshot;
  }).getCmpFiveAgentRuntimeSummary = ((agentId?: string) => {
    if (agentId !== "cmp-live-cli-main") {
      return originalGetSummary(agentId);
    }
    const summary = originalGetSummary(agentId);
    return {
      ...summary,
      latestRoleMetadata: {
        ...summary.latestRoleMetadata,
        dispatcher: {
          ...summary.latestRoleMetadata.dispatcher,
          bundle: {
            sourceAnchorRefs: phase === "session-a"
              ? ["turn:a:user"]
              : phase === "session-b"
                ? ["turn:b:user"]
                : ["turn:drifted:user"],
          },
        },
      },
      parentPromoteReviewCount: phase === "session-a" ? 1 : phase === "session-b" ? 2 : 9,
      flow: {
        ...summary.flow,
        pendingPeerApprovalCount: phase === "session-a" ? 1 : phase === "session-b" ? 2 : 9,
      },
    };
  }) as typeof runtime.getCmpFiveAgentRuntimeSummary;
  (runtime as unknown as {
    getCmpFiveAgentRuntimeSummary: typeof runtime.getCmpFiveAgentRuntimeSummary;
    getCmpFiveAgentRuntimeSnapshot: typeof runtime.getCmpFiveAgentRuntimeSnapshot;
  }).getCmpFiveAgentRuntimeSnapshot = ((agentId?: string) => {
    if (agentId !== "cmp-live-cli-main") {
      return originalGetSnapshot(agentId);
    }
    const snapshot = originalGetSnapshot(agentId);
    return {
      ...snapshot,
      packageFamilies: [{
        familyId: phase === "session-a" ? "family-a" : phase === "session-b" ? "family-b" : "family-drifted",
        primaryPackageId: phase === "session-a" ? "pkg-a" : phase === "session-b" ? "pkg-b" : "pkg-drifted",
        primaryPackageRef: phase === "session-a" ? "cmp-package:a" : phase === "session-b" ? "cmp-package:b" : "cmp-package:drifted",
        candidatePackageIds: [],
        createdAt: "2026-04-16T12:00:00.000Z",
        updatedAt: "2026-04-16T12:00:00.000Z",
        metadata: {},
      }],
    };
  }) as typeof runtime.getCmpFiveAgentRuntimeSnapshot;

  runtime.cmp.worksite.observeTurn({
    sessionId: "session-a",
    turnIndex: 1,
    currentObjective: "session a objective",
    cmp: {
      syncStatus: "synced",
      agentId: "cmp-live-cli-main",
      packageId: "pkg-a",
      packageRef: "cmp-package:a",
      projectionId: "projection-a",
      snapshotId: "snapshot-a",
      intent: "session a intent",
      operatorGuide: "session a guide",
      childGuide: "session a child guide",
      checkerReason: "session a checker",
      routeRationale: "session a route",
      scopePolicy: "session_a_only",
      packageStrategy: "primary",
      timelineStrategy: "timeline-a",
    },
  });

  phase = "session-b";
  runtime.cmp.worksite.observeTurn({
    sessionId: "session-b",
    turnIndex: 1,
    currentObjective: "session b objective",
    cmp: {
      syncStatus: "synced",
      agentId: "cmp-live-cli-main",
      packageId: "pkg-b",
      packageRef: "cmp-package:b",
      projectionId: "projection-b",
      snapshotId: "snapshot-b",
      intent: "session b intent",
      operatorGuide: "session b guide",
      childGuide: "session b child guide",
      checkerReason: "session b checker",
      routeRationale: "session b route",
      scopePolicy: "session_b_only",
      packageStrategy: "primary",
      timelineStrategy: "timeline-b",
    },
  });

  phase = "drifted";
  const sessionA = runtime.cmp.worksite.exportCorePackage({
    sessionId: "session-a",
  });
  const sessionB = runtime.cmp.worksite.exportCorePackage({
    sessionId: "session-b",
  });

  assert.equal(sessionA.identity?.packageFamilyId, "family-a");
  assert.deepEqual(sessionA.payload?.sourceAnchorRefs, ["turn:a:user"]);
  assert.equal(sessionA.flow?.pendingPeerApprovalCount, 1);
  assert.equal(sessionB.identity?.packageFamilyId, "family-b");
  assert.deepEqual(sessionB.payload?.sourceAnchorRefs, ["turn:b:user"]);
  assert.equal(sessionB.flow?.pendingPeerApprovalCount, 2);
});
