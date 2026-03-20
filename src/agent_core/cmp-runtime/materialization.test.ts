import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceCmpProjectionVisibility,
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

