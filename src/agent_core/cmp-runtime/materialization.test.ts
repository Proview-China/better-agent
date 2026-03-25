import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceCmpProjectionVisibility,
  createCmpProjectionAndPackageRecordsFromStoredSection,
  createCmpProjectionRecord,
  createPassiveHistoricalPackage,
} from "./materialization.js";

test("CMP projection materialization keeps checked snapshot lineage and emits a passive package", () => {
  const localProjection = createCmpProjectionRecord({
    projectionId: "projection-1",
    checkedSnapshotRef: "checked:1",
    agentId: "agent-main",
    visibility: "local_only",
    updatedAt: "2026-03-20T08:20:00.000Z",
  });
  const promotedProjection = advanceCmpProjectionVisibility({
    record: localProjection,
    nextVisibility: "promoted_by_parent",
    updatedAt: "2026-03-20T08:20:01.000Z",
  });
  const pkg = createPassiveHistoricalPackage({
    packageId: "package-1",
    projection: promotedProjection,
    requesterAgentId: "agent-child-1",
    packageKind: "historical_context",
    packageRef: "package-ref:1",
    fidelityLabel: "high-signal",
    createdAt: "2026-03-20T08:20:02.000Z",
  });

  assert.equal(pkg.projectionId, promotedProjection.projectionId);
  assert.equal(pkg.targetAgentId, "agent-child-1");
  assert.equal(pkg.metadata?.source, "passive_request");
});

test("CMP projection cannot move backwards in visibility", () => {
  const promoted = createCmpProjectionRecord({
    projectionId: "projection-2",
    checkedSnapshotRef: "checked:2",
    agentId: "agent-main",
    visibility: "promoted_by_parent",
    updatedAt: "2026-03-20T08:21:00.000Z",
  });

  assert.throws(() => advanceCmpProjectionVisibility({
    record: promoted,
    nextVisibility: "accepted_by_parent",
    updatedAt: "2026-03-20T08:21:01.000Z",
  }), /cannot move backwards/i);
});

test("CMP materialization can derive projection and package records from one stored section", () => {
  const records = createCmpProjectionAndPackageRecordsFromStoredSection({
    projectionId: "projection-3",
    checkedSnapshotRef: "checked:3",
    storedSection: {
      id: "stored-3",
      projectId: "project-main",
      agentId: "agent-main",
      sourceSectionId: "section-3",
      plane: "git",
      storageRef: "git:section:3",
      state: "checked",
      visibility: "lineage",
      persistedAt: "2026-03-20T08:22:00.000Z",
      updatedAt: "2026-03-20T08:22:00.000Z",
    },
    visibility: "accepted_by_parent",
    updatedAt: "2026-03-20T08:22:01.000Z",
    packageId: "package-3",
    targetAgentId: "agent-child-3",
    packageKind: "child_seed",
    packageRef: "package-ref:3",
    fidelityLabel: "checked_high_fidelity",
    createdAt: "2026-03-20T08:22:02.000Z",
    projectionMetadata: {
      source: "section-first",
    },
    packageMetadata: {
      source: "section-first",
    },
  });

  assert.equal(records.projection.agentId, "agent-main");
  assert.equal(records.projection.metadata?.storedSectionId, "stored-3");
  assert.equal(records.contextPackage.projectionId, "projection-3");
  assert.equal(records.contextPackage.metadata?.source, "section-first");
});
