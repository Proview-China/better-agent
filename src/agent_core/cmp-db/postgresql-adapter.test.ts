import assert from "node:assert/strict";
import test from "node:test";

import {
  createCmpAgentLocalTableSet,
  createCmpDbPostgresAdapter,
  createCmpProjectDbTopology,
  type CmpDbContextPackageRecord,
  type CmpDbDeliveryRegistryRecord,
  type CmpProjectionRecord,
} from "./index.js";

test("cmp postgres adapter builds projection/package/delivery primitives against the expected tables", () => {
  const topology = createCmpProjectDbTopology({
    projectId: "praxis-main",
  });
  const localTableSet = createCmpAgentLocalTableSet({
    projectId: "praxis-main",
    agentId: "main",
  });
  const adapter = createCmpDbPostgresAdapter({
    topology,
    localTableSets: [localTableSet],
  });

  const projectionRecord: CmpProjectionRecord = {
    projectionId: "projection:s1",
    snapshotId: "snapshot:s1",
    agentId: "main",
    branchRef: "cmp/main",
    commitRef: "abc123",
    state: "local_only",
    updatedAt: "2026-03-24T00:00:00.000Z",
  };
  const packageRecord: CmpDbContextPackageRecord = {
    packageId: "pkg-1",
    sourceProjectionId: "projection:s1",
    sourceSnapshotId: "snapshot:s1",
    sourceAgentId: "main",
    targetAgentId: "child",
    packageKind: "child_seed",
    packageRef: "cmp-package:pkg-1",
    fidelityLabel: "checked_high_fidelity",
    state: "materialized",
    createdAt: "2026-03-24T00:00:00.000Z",
    updatedAt: "2026-03-24T00:00:00.000Z",
  };
  const deliveryRecord: CmpDbDeliveryRegistryRecord = {
    deliveryId: "delivery-1",
    dispatchId: "dispatch-1",
    packageId: "pkg-1",
    sourceAgentId: "main",
    targetAgentId: "child",
    state: "delivered",
    createdAt: "2026-03-24T00:00:00.000Z",
    deliveredAt: "2026-03-24T00:00:01.000Z",
  };

  const projectionWrite = adapter.buildProjectionUpsert(projectionRecord);
  const packageWrite = adapter.buildContextPackageUpsert(packageRecord);
  const deliveryWrite = adapter.buildDeliveryUpsert(deliveryRecord);

  assert.equal(adapter.driver, "postgresql");
  assert.match(projectionWrite.text, /cmp_praxis_main_main_snapshots/);
  assert.match(packageWrite.text, /cmp_praxis_main_main_packages/);
  assert.match(deliveryWrite.text, /cmp_praxis_main_delivery_registry/);
  assert.equal(projectionWrite.phase, "write");
  assert.equal(packageWrite.phase, "write");
  assert.equal(deliveryWrite.phase, "write");
});

test("cmp postgres adapter can build read primitives for local and shared tables", () => {
  const topology = createCmpProjectDbTopology({
    projectId: "praxis-main",
  });
  const adapter = createCmpDbPostgresAdapter({
    topology,
    localTableSets: [createCmpAgentLocalTableSet({
      projectId: "praxis-main",
      agentId: "main",
    })],
  });

  const projectionRead = adapter.buildProjectionSelect({
    agentId: "main",
    snapshotId: "snapshot:s1",
  });
  const packageRead = adapter.buildContextPackageSelect({
    agentId: "main",
    packageId: "pkg-1",
  });
  const deliveryRead = adapter.buildDeliverySelect({
    deliveryId: "delivery-1",
  });

  assert.equal(projectionRead.phase, "read");
  assert.equal(packageRead.phase, "read");
  assert.equal(deliveryRead.phase, "read");
  assert.match(projectionRead.text, /WHERE snapshot_id = \$1/);
  assert.match(packageRead.text, /WHERE package_id = \$1/);
  assert.match(deliveryRead.text, /WHERE delivery_registry_id = \$1/);
});
