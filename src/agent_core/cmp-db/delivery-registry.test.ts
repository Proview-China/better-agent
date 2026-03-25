import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceCmpDbContextPackageRecord,
  createCmpDbContextPackageBackfillRecord,
  createCmpDbContextPackageRecordFromContextPackage,
  createCmpDbDeliveryRegistryRecordFromDispatchReceipt,
} from "./index.js";

test("cmp delivery registry keeps package records and dispatch receipts separated", () => {
  const packageRecord = createCmpDbContextPackageRecordFromContextPackage({
    contextPackage: {
      packageId: "package-1",
      sourceProjectionId: "projection-1",
      targetAgentId: "child-1",
      packageKind: "child_seed",
      packageRef: "cmp-package:1",
      fidelityLabel: "checked_high_fidelity",
      createdAt: "2026-03-24T10:00:00.000Z",
    },
    sourceProjection: {
      projectionId: "projection-1",
      snapshotId: "snapshot-1",
      agentId: "main",
    },
  });

  const deliveryRecord = createCmpDbDeliveryRegistryRecordFromDispatchReceipt({
    receipt: {
      dispatchId: "dispatch-1",
      packageId: "package-1",
      sourceAgentId: "main",
      targetAgentId: "child-1",
      status: "delivered",
      deliveredAt: "2026-03-24T10:01:00.000Z",
    },
  });

  assert.equal(packageRecord.packageId, "package-1");
  assert.equal(packageRecord.state, "materialized");
  assert.equal(packageRecord.metadata?.truthSource, "db_primary");
  assert.equal(deliveryRecord.dispatchId, "dispatch-1");
  assert.equal(deliveryRecord.state, "delivered");
});

test("cmp package backfill record can rebuild a package truth entry from git-backed projection state", () => {
  const backfilled = createCmpDbContextPackageBackfillRecord({
    packageId: "package-backfill-1",
    sourceProjection: {
      projectionId: "projection-backfill-1",
      snapshotId: "snapshot-backfill-1",
      agentId: "main",
    },
    targetAgentId: "child-restore",
    packageKind: "historical_reply",
    packageRef: "cmp-package:git-rebuild:1",
    fidelityLabel: "checked_high_fidelity",
    createdAt: "2026-03-25T10:00:00.000Z",
    metadata: {
      rebuiltFromSnapshotId: "snapshot-backfill-1",
    },
  });

  assert.equal(backfilled.sourceSnapshotId, "snapshot-backfill-1");
  assert.equal(backfilled.state, "materialized");
  assert.equal(backfilled.metadata?.truthSource, "git_fallback_backfill");
  assert.equal(backfilled.metadata?.backfillSource, "git_checked_or_promoted");
  assert.equal(backfilled.metadata?.rebuiltFromSnapshotId, "snapshot-backfill-1");
});

test("cmp package record only advances along the frozen delivery lifecycle", () => {
  const materialized = createCmpDbContextPackageRecordFromContextPackage({
    contextPackage: {
      packageId: "package-2",
      sourceProjectionId: "projection-2",
      targetAgentId: "peer-1",
      packageKind: "peer_exchange",
      packageRef: "cmp-package:2",
      fidelityLabel: "high_signal",
      createdAt: "2026-03-24T10:00:00.000Z",
    },
    sourceProjection: {
      projectionId: "projection-2",
      snapshotId: "snapshot-2",
      agentId: "main",
    },
  });

  const delivered = advanceCmpDbContextPackageRecord({
    record: materialized,
    nextState: "delivered",
    updatedAt: "2026-03-24T10:02:00.000Z",
  });
  const acknowledged = advanceCmpDbContextPackageRecord({
    record: delivered,
    nextState: "acknowledged",
    updatedAt: "2026-03-24T10:03:00.000Z",
  });

  assert.equal(acknowledged.state, "acknowledged");
  assert.throws(() => advanceCmpDbContextPackageRecord({
    record: materialized,
    nextState: "acknowledged",
    updatedAt: "2026-03-24T10:03:00.000Z",
  }), /cannot transition/i);
});
