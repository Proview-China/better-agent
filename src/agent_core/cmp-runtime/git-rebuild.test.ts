import assert from "node:assert/strict";
import test from "node:test";

import { createCmpGitProjectionSourceAnchor } from "../cmp-git/index.js";
import {
  createCmpDbBackfillRecordFromGitRebuild,
  rebuildCmpHistoricalContextFromGitTruth,
  rebuildCmpHistoricalContextWithBackfillFromGitTruth,
  rebuildCmpPassiveHistoricalPackageFromGitTruth,
  rebuildCmpProjectionFromGitTruth,
} from "./git-rebuild.js";

test("cmp git rebuild can reconstruct a local_only projection from checked truth only", () => {
  const projection = rebuildCmpProjectionFromGitTruth({
    projectionId: "projection:git-only",
    snapshot: {
      snapshotId: "snapshot-1",
      agentId: "main",
      checkedAt: "2026-03-25T10:00:00.000Z",
      metadata: {
        qualityLabel: "usable",
      },
    },
    anchor: createCmpGitProjectionSourceAnchor({
      candidate: {
        candidateId: "candidate-1",
        projectId: "proj-1",
        agentId: "main",
        branchRef: {
          kind: "cmp",
          agentId: "main",
          branchName: "cmp/main",
          fullRef: "refs/heads/cmp/main",
        },
        commitSha: "cmp-commit-1",
        deltaId: "delta-1",
        createdAt: "2026-03-25T09:59:00.000Z",
        status: "checked",
      },
      checkedRef: {
        refId: "checked-1",
        projectId: "proj-1",
        agentId: "main",
        snapshotId: "snapshot-1",
        branchRef: {
          kind: "cmp",
          agentId: "main",
          branchName: "cmp/main",
          fullRef: "refs/heads/cmp/main",
        },
        commitSha: "cmp-commit-1",
        refName: "refs/cmp/checked/main",
        updatedAt: "2026-03-25T10:00:00.000Z",
        status: "active",
      },
    }),
  });

  assert.equal(projection.visibility, "local_only");
  assert.equal(projection.metadata?.source, "git_rebuild");
  assert.equal(projection.metadata?.gitCheckedRefName, "refs/cmp/checked/main");
  assert.equal(projection.metadata?.gitPromotedRefName, undefined);
});

test("cmp git rebuild can reconstruct a promoted projection when promoted ref exists", () => {
  const result = rebuildCmpHistoricalContextFromGitTruth({
    projectionId: "projection:git-promoted",
    packageId: "package:git-promoted",
    snapshot: {
      snapshotId: "snapshot-2",
      agentId: "child",
      checkedAt: "2026-03-25T10:05:00.000Z",
    },
    anchor: {
      candidateId: "candidate-2",
      checkedRefName: "refs/cmp/checked/child",
      promotedRefName: "refs/cmp/promoted/parent/child",
      branchHeadRef: "refs/heads/cmp/child",
      commitSha: "cmp-commit-2",
    },
    requesterAgentId: "parent",
    packageKind: "historical_reply",
    fidelityLabel: "checked_high_fidelity",
    createdAt: "2026-03-25T10:06:00.000Z",
  });

  assert.equal(result.projection.visibility, "promoted_by_parent");
  assert.equal(result.contextPackage.sourceAgentId, "child");
  assert.equal(result.contextPackage.targetAgentId, "parent");
  assert.equal(result.contextPackage.metadata?.source, "git_rebuild");
});

test("cmp git rebuild can create a passive package from a rebuilt projection", () => {
  const projection = rebuildCmpProjectionFromGitTruth({
    projectionId: "projection:rebuild-package",
    snapshot: {
      snapshotId: "snapshot-3",
      agentId: "main",
      checkedAt: "2026-03-25T10:10:00.000Z",
    },
    anchor: {
      candidateId: "candidate-3",
      checkedRefName: "refs/cmp/checked/main",
      branchHeadRef: "refs/heads/cmp/main",
      commitSha: "cmp-commit-3",
    },
  });

  const contextPackage = rebuildCmpPassiveHistoricalPackageFromGitTruth({
    packageId: "package:rebuild-package",
    projection,
    requesterAgentId: "main",
    packageKind: "historical_reply",
    fidelityLabel: "checked_high_fidelity",
    createdAt: "2026-03-25T10:11:00.000Z",
  });

  assert.equal(contextPackage.packageKind, "historical_reply");
  assert.equal(contextPackage.packageRef, "cmp-git-rebuild:projection:rebuild-package:main");
  assert.equal(contextPackage.metadata?.source, "git_rebuild");
  assert.equal(contextPackage.metadata?.projectionVisibility, "local_only");
});

test("cmp git rebuild can derive a DB backfill record from rebuilt historical context", () => {
  const rebuild = rebuildCmpHistoricalContextFromGitTruth({
    projectionId: "projection:backfill",
    packageId: "package:backfill",
    snapshot: {
      snapshotId: "snapshot-backfill",
      agentId: "child",
      checkedAt: "2026-03-25T10:20:00.000Z",
    },
    anchor: {
      candidateId: "candidate-backfill",
      checkedRefName: "refs/cmp/checked/child",
      promotedRefName: "refs/cmp/promoted/parent/child",
      branchHeadRef: "refs/heads/cmp/child",
      commitSha: "cmp-commit-backfill",
    },
    requesterAgentId: "parent",
    packageKind: "historical_reply",
    fidelityLabel: "checked_high_fidelity",
    createdAt: "2026-03-25T10:21:00.000Z",
  });

  const backfillRecord = createCmpDbBackfillRecordFromGitRebuild({
    rebuild,
  });

  assert.equal(backfillRecord.sourceProjectionId, "projection:backfill");
  assert.equal(backfillRecord.sourceSnapshotId, "snapshot-backfill");
  assert.equal(backfillRecord.metadata?.truthSource, "git_fallback_backfill");
  assert.equal(backfillRecord.metadata?.rebuiltProjectionVisibility, "promoted_by_parent");
});

test("cmp git rebuild can build historical context and DB backfill in one step", () => {
  const result = rebuildCmpHistoricalContextWithBackfillFromGitTruth({
    projectionId: "projection:one-shot",
    packageId: "package:one-shot",
    snapshot: {
      snapshotId: "snapshot-one-shot",
      agentId: "main",
      checkedAt: "2026-03-25T10:30:00.000Z",
    },
    anchor: {
      candidateId: "candidate-one-shot",
      checkedRefName: "refs/cmp/checked/main",
      branchHeadRef: "refs/heads/cmp/main",
      commitSha: "cmp-commit-one-shot",
    },
    requesterAgentId: "main",
    packageKind: "historical_reply",
    fidelityLabel: "checked_high_fidelity",
    createdAt: "2026-03-25T10:31:00.000Z",
  });

  assert.equal(result.contextPackage.packageId, "package:one-shot");
  assert.equal(result.dbBackfillRecord.packageId, "package:one-shot");
  assert.equal(result.dbBackfillRecord.metadata?.backfillSource, "git_checked_or_promoted");
});
