import assert from "node:assert/strict";
import test from "node:test";

import { createCmpFiveAgentConfiguration } from "./configuration.js";
import {
  createCmpFiveAgentFlowSummary,
  createCmpFiveAgentRecoverySummary,
  createCmpFiveAgentRoleStageSummary,
  createCmpFiveAgentSummary,
} from "./observability.js";
import type { CmpFiveAgentRuntimeSnapshot } from "./types.js";

function createSnapshotFixture(): CmpFiveAgentRuntimeSnapshot {
  return {
    icmaRecords: [
      {
        loopId: "icma-loop",
        role: "icma",
        agentId: "main",
        stage: "emit",
        createdAt: "2026-03-25T00:00:00.000Z",
        updatedAt: "2026-03-25T00:00:04.000Z",
        chunkIds: ["chunk-1"],
        fragmentIds: ["fragment-1"],
        structuredOutput: {
          intent: "整理当前主线",
          sourceAnchorRefs: ["msg:1"],
          candidateBodyRefs: ["msg:1"],
          boundary: "preserve_root_system_and_emit_controlled_fragments_only",
          explicitFragmentIds: ["fragment-1"],
          preSectionIds: ["section-pre-1"],
          guide: {
            operatorGuide: "keep high-signal context only",
            childGuide: "child seed enters child icma only",
          },
        },
      },
    ],
    iteratorRecords: [
      {
        loopId: "iterator-loop",
        role: "iterator",
        agentId: "main",
        stage: "update_review_ref",
        createdAt: "2026-03-25T00:00:01.000Z",
        updatedAt: "2026-03-25T00:00:05.000Z",
        deltaId: "delta-1",
        candidateId: "candidate-1",
        branchRef: "refs/heads/cmp/main",
        commitRef: "commit-1",
        reviewRef: "refs/review/candidate-1",
        reviewOutput: {
          sourceSectionIds: ["section-pre-1"],
          minimumReviewUnit: "commit",
          reviewRefMode: "stable_review_ref",
          handoffTarget: "checker",
        },
      },
    ],
    checkerRecords: [
      {
        loopId: "checker-loop",
        role: "checker",
        agentId: "main",
        stage: "suggest_promote",
        createdAt: "2026-03-25T00:00:02.000Z",
        updatedAt: "2026-03-25T00:00:06.000Z",
        candidateId: "candidate-1",
        checkedSnapshotId: "checked-1",
        suggestPromote: true,
        reviewOutput: {
          sourceSectionIds: ["section-pre-1"],
          checkedSectionIds: ["section-checked-1"],
          splitDecisionRefs: ["checked-1:split"],
          mergeDecisionRefs: ["checked-1:merge"],
          trimSummary: "trimmed to high-signal sections",
          shortReason: "checked",
          detailedReason: "checker restructured evidence for promote-ready handoff",
        },
      },
    ],
    dbAgentRecords: [
      {
        loopId: "dbagent-loop",
        role: "dbagent",
        agentId: "main",
        stage: "attach_snapshots",
        createdAt: "2026-03-25T00:00:03.000Z",
        updatedAt: "2026-03-25T00:00:07.000Z",
        projectionId: "projection-1",
        familyId: "family-1",
        primaryPackageId: "pkg-main",
        timelinePackageId: "pkg-main:timeline",
        taskSnapshotIds: ["task-1"],
        materializationOutput: {
          sourceSectionIds: ["section-checked-1"],
          sourceSnapshotId: "checked-1",
          packageTopology: "active_plus_timeline_plus_task_snapshots",
          bundleSchemaVersion: "cmp-dispatch-bundle/v1",
        },
      },
    ],
    dispatcherRecords: [
      {
        loopId: "dispatcher-child",
        role: "dispatcher",
        agentId: "main",
        stage: "collect_receipt",
        createdAt: "2026-03-25T00:00:04.000Z",
        updatedAt: "2026-03-25T00:00:08.000Z",
        dispatchId: "dispatch-child",
        packageId: "pkg-main",
        targetAgentId: "child-a",
        targetKind: "child",
        packageMode: "child_seed_via_icma",
        bundle: {
          target: {
            targetAgentId: "child-a",
            targetKind: "child",
            packageMode: "child_seed_via_icma",
            targetIngress: "child_icma_only",
          },
          body: {
            packageId: "pkg-main",
            packageKind: "child_seed",
            primaryRef: "cmp-package:pkg-main",
            taskSnapshotRefs: ["task-1"],
          },
          governance: {
            sourceAgentId: "main",
            approvalRequired: false,
            confidenceLabel: "high",
            signalLabel: "checked_high_fidelity",
          },
          sourceAnchorRefs: ["cmp-package:pkg-main"],
        },
        metadata: {
          childSeedsEnterIcmaOnly: true,
        },
      },
      {
        loopId: "dispatcher-peer",
        role: "dispatcher",
        agentId: "main",
        stage: "collect_receipt",
        createdAt: "2026-03-25T00:00:05.000Z",
        updatedAt: "2026-03-25T00:00:09.000Z",
        dispatchId: "dispatch-peer",
        packageId: "pkg-peer",
        targetAgentId: "peer-a",
        targetKind: "peer",
        packageMode: "peer_exchange_slim",
        bundle: {
          target: {
            targetAgentId: "peer-a",
            targetKind: "peer",
            packageMode: "peer_exchange_slim",
            targetIngress: "peer_exchange",
          },
          body: {
            packageId: "pkg-peer",
            packageKind: "peer_exchange",
            primaryRef: "cmp-package:pkg-peer",
            taskSnapshotRefs: [],
          },
          governance: {
            sourceAgentId: "main",
            approvalRequired: true,
            approvalStatus: "pending_parent_core_approval",
            confidenceLabel: "medium",
            signalLabel: "checked_high_fidelity",
          },
          sourceAnchorRefs: ["cmp-package:pkg-peer"],
        },
      },
      {
        loopId: "dispatcher-passive",
        role: "dispatcher",
        agentId: "main",
        stage: "collect_receipt",
        createdAt: "2026-03-25T00:00:06.000Z",
        updatedAt: "2026-03-25T00:00:10.000Z",
        dispatchId: "dispatch-passive",
        packageId: "pkg-passive",
        targetAgentId: "main",
        targetKind: "core_agent",
        packageMode: "historical_reply_return",
        bundle: {
          target: {
            targetAgentId: "main",
            targetKind: "core_agent_return",
            packageMode: "historical_reply_return",
            targetIngress: "core_agent_return",
          },
          body: {
            packageId: "pkg-passive",
            packageKind: "historical_reply",
            primaryRef: "cmp-package:pkg-passive",
            taskSnapshotRefs: [],
          },
          governance: {
            sourceAgentId: "main",
            approvalRequired: false,
            confidenceLabel: "high",
            signalLabel: "checked_high_fidelity",
          },
          sourceAnchorRefs: ["cmp-package:pkg-passive"],
        },
      },
    ],
    checkpoints: [
      {
        checkpointId: "cp-icma",
        role: "icma",
        agentId: "main",
        stage: "emit",
        createdAt: "2026-03-25T00:00:04.000Z",
        eventRef: "icma-loop",
      },
      {
        checkpointId: "cp-iterator",
        role: "iterator",
        agentId: "main",
        stage: "update_review_ref",
        createdAt: "2026-03-25T00:00:05.000Z",
        eventRef: "iterator-loop",
      },
      {
        checkpointId: "cp-checker",
        role: "checker",
        agentId: "main",
        stage: "suggest_promote",
        createdAt: "2026-03-25T00:00:06.000Z",
        eventRef: "checker-loop",
      },
      {
        checkpointId: "cp-dbagent",
        role: "dbagent",
        agentId: "main",
        stage: "attach_snapshots",
        createdAt: "2026-03-25T00:00:07.000Z",
        eventRef: "dbagent-loop",
      },
      {
        checkpointId: "cp-dispatcher",
        role: "dispatcher",
        agentId: "main",
        stage: "collect_receipt",
        createdAt: "2026-03-25T00:00:08.000Z",
        eventRef: "dispatcher-child",
      },
    ],
    overrides: [],
    intentChunks: [],
    fragments: [],
    packageFamilies: [
      {
        familyId: "family-1",
        primaryPackageId: "pkg-main",
        primaryPackageRef: "cmp-package:pkg-main",
        timelinePackageId: "pkg-main:timeline",
        timelinePackageRef: "cmp-package:pkg-main:timeline",
        taskSnapshotIds: ["task-1", "task-2"],
        createdAt: "2026-03-25T00:00:07.000Z",
      },
    ],
    taskSnapshots: [
      {
        snapshotId: "task-1",
        taskRef: "main:checked-1",
        summaryRef: "checked-1",
        createdAt: "2026-03-25T00:00:07.000Z",
      },
    ],
    promoteRequests: [
      {
        reviewId: "promote-request-1",
        reviewerRole: "dbagent",
        sourceAgentId: "main",
        targetParentAgentId: "parent-a",
        candidateId: "candidate-1",
        checkedSnapshotId: "checked-1",
        status: "pending_parent_dbagent_review",
        createdAt: "2026-03-25T00:00:06.000Z",
        requestedAt: "2026-03-25T00:00:06.000Z",
        reviewRole: "dbagent",
      },
    ],
    parentPromoteReviews: [
      {
        reviewId: "parent-review-1",
        reviewerRole: "dbagent",
        sourceAgentId: "main",
        targetParentAgentId: "parent-a",
        candidateId: "candidate-1",
        checkedSnapshotId: "checked-1",
        status: "pending_parent_dbagent_review",
        createdAt: "2026-03-25T00:00:06.000Z",
        reviewedAt: "2026-03-25T00:00:07.000Z",
        stage: "ready",
        reviewRole: "dbagent",
      },
    ],
    peerApprovals: [
      {
        approvalId: "peer-approval-1",
        parentAgentId: "parent-a",
        sourceAgentId: "main",
        targetAgentId: "peer-a",
        packageId: "pkg-peer",
        createdAt: "2026-03-25T00:00:09.000Z",
        mode: "explicit_once",
        status: "pending_parent_core_approval",
        targetIngress: "peer_exchange",
      },
      {
        approvalId: "peer-approval-2",
        parentAgentId: "parent-a",
        sourceAgentId: "main",
        targetAgentId: "peer-b",
        packageId: "pkg-peer-2",
        createdAt: "2026-03-25T00:00:10.000Z",
        mode: "explicit_once",
        status: "approved",
        targetIngress: "peer_exchange",
      },
    ],
    reinterventionRequests: [
      {
        requestId: "reintervention-1",
        parentAgentId: "parent-a",
        childAgentId: "main",
        requestedByRole: "dbagent",
        status: "pending_parent_dbagent_review",
        gapSummary: "need more lineage context",
        currentStateSummary: "child has local checked snapshot only",
        createdAt: "2026-03-25T00:00:11.000Z",
      },
      {
        requestId: "reintervention-2",
        parentAgentId: "parent-a",
        childAgentId: "main",
        requestedByRole: "dbagent",
        status: "served",
        gapSummary: "need dependency background",
        currentStateSummary: "parent coarse package requested",
        createdAt: "2026-03-25T00:00:12.000Z",
        resolvedAt: "2026-03-25T00:00:13.000Z",
        servedPackageId: "pkg-served",
      },
    ],
  };
}

test("observability derives role stages and configured role ids from snapshot plus role catalog", () => {
  const configuration = createCmpFiveAgentConfiguration();
  const snapshot = createSnapshotFixture();
  const stageSummary = createCmpFiveAgentRoleStageSummary({
    snapshot,
    configuration,
  });

  assert.equal(stageSummary.roleCounts.dispatcher, 3);
  assert.equal(stageSummary.latestStages.checker, "suggest_promote");
  assert.equal(stageSummary.configuredRoles.icma.promptPackId, "cmp-five-agent/icma-prompt-pack/v1");
  assert.equal(stageSummary.configuredRoles.dbagent.capabilityContractId, "cmp-five-agent/dbagent-capability-contract/v1");
  assert.equal(stageSummary.configuredRoles.dispatcher.tapProfileId, "cmp-five-agent/dispatcher-tap-profile/v1");
});

test("observability summarizes package flow and recovery blockers for five-agent summary consumption", () => {
  const snapshot = createSnapshotFixture();

  const flow = createCmpFiveAgentFlowSummary(snapshot);
  assert.equal(flow.packageModeCounts.child_seed_via_icma, 1);
  assert.equal(flow.packageModeCounts.peer_exchange_slim, 1);
  assert.equal(flow.packageModeCounts.historical_reply_return, 1);
  assert.equal(flow.childSeedToIcmaCount, 1);
  assert.equal(flow.pendingPeerApprovalCount, 1);
  assert.equal(flow.approvedPeerApprovalCount, 1);
  assert.equal(flow.reinterventionPendingCount, 1);
  assert.equal(flow.reinterventionServedCount, 1);

  const recovery = createCmpFiveAgentRecoverySummary(snapshot);
  assert.deepEqual(recovery.resumableRoles.sort(), ["checker", "dbagent", "dispatcher", "icma", "iterator"]);
  assert.deepEqual(recovery.missingCheckpointRoles, []);
});

test("observability composes richer fiveAgentSummary without adding new facade api", () => {
  const configuration = createCmpFiveAgentConfiguration();
  const snapshot = createSnapshotFixture();
  const summary = createCmpFiveAgentSummary({
    agentId: "main",
    snapshot,
    configuration,
  });

  assert.equal(summary.configurationVersion, "cmp-five-agent-role-catalog/v1");
  assert.equal(summary.peerExchangePendingApprovalCount, 1);
  assert.equal(summary.peerExchangeApprovedCount, 1);
  assert.equal(summary.parentPromoteReviewCount, 1);
  assert.equal(summary.flow.reinterventionServedCount, 1);
  assert.deepEqual(summary.capabilityMatrix.gitWriters, ["iterator", "checker"]);
  assert.deepEqual(summary.capabilityMatrix.dbWriters, ["dbagent"]);
  assert.deepEqual(summary.capabilityMatrix.mqPublishers, ["icma", "dispatcher"]);
  assert.equal(summary.tapProfiles.iterator.profileId, "cmp-five-agent/iterator-tap-profile/v1");
  assert.equal(summary.tapProfiles.dbagent.allowedCapabilityPatterns.includes("cmp.db.write"), true);
  assert.deepEqual(summary.recovery.missingCheckpointRoles, []);
  assert.equal((summary.latestRoleMetadata.icma?.structuredOutput as { intent?: string } | undefined)?.intent, "整理当前主线");
  assert.equal((summary.latestRoleMetadata.iterator?.reviewOutput as { minimumReviewUnit?: string } | undefined)?.minimumReviewUnit, "commit");
  assert.equal((summary.latestRoleMetadata.dbagent?.materializationOutput as { bundleSchemaVersion?: string } | undefined)?.bundleSchemaVersion, "cmp-dispatch-bundle/v1");
  assert.equal((summary.latestRoleMetadata.dispatcher?.bundle as { target?: { targetIngress?: string } } | undefined)?.target?.targetIngress, "core_agent_return");
});
