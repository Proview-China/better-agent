import assert from "node:assert/strict";
import test from "node:test";

import {
  createCmpAgentLocalTableSet,
  createCmpDbContextPackageBackfillRecord,
  createCmpDbPostgresAdapter,
  createCmpDbPsqlLiveExecutor,
  createCmpProjectDbTopology,
} from "../cmp-db/index.js";
import {
  applyCmpMqDeliveryProjectionPatchToRecord,
  createCmpDeliveryRecordFromMqProjectionPatch,
  executeCmpContextPackageLowering,
  executeCmpDeliveryLowering,
  executeCmpProjectionLowering,
  summarizeCmpProjectionTruthReadback,
} from "./db-lowering.js";

test("cmp db lowering executes projection/package/delivery write and read statements through the executor", async () => {
  const topology = createCmpProjectDbTopology({
    projectId: "proj-db-lowering",
    databaseName: "cmp_proj_db_lowering",
    schemaName: "cmp_proj_db_lowering",
  });
  const adapter = createCmpDbPostgresAdapter({
    topology,
    localTableSets: [
      createCmpAgentLocalTableSet({
        projectId: "proj-db-lowering",
        schemaName: "cmp_proj_db_lowering",
        agentId: "main",
      }),
    ],
  });
  const executions: string[] = [];
  const executor = createCmpDbPsqlLiveExecutor({
    connection: {
      databaseName: "postgres",
    },
    async commandRunner(invocation) {
      executions.push(invocation.statement.statementId);
      return {
        stdout: invocation.statement.target,
        stderr: "",
        exitCode: 0,
      };
    },
  });

  const projection = await executeCmpProjectionLowering({
    adapter,
    executor,
    record: {
      projectionId: "projection:1",
      snapshotId: "snapshot:1",
      agentId: "main",
      branchRef: "refs/heads/cmp/main",
      commitRef: "cmp-commit-1",
      state: "local_only",
      updatedAt: "2026-03-25T00:00:00.000Z",
    },
  });
  const contextPackage = await executeCmpContextPackageLowering({
    adapter,
    executor,
    record: {
      packageId: "pkg-1",
      sourceProjectionId: "projection:1",
      sourceSnapshotId: "snapshot:1",
      sourceAgentId: "main",
      targetAgentId: "child-a",
      packageKind: "child_seed",
      packageRef: "cmp-package:snapshot:1:child-a:child_seed",
      fidelityLabel: "checked_high_fidelity",
      state: "materialized",
      createdAt: "2026-03-25T00:00:00.000Z",
      updatedAt: "2026-03-25T00:00:00.000Z",
    },
  });
  const delivery = await executeCmpDeliveryLowering({
    adapter,
    executor,
    record: {
      deliveryId: "delivery-1",
      dispatchId: "dispatch-1",
      packageId: "pkg-1",
      sourceAgentId: "main",
      targetAgentId: "child-a",
      state: "delivered",
      createdAt: "2026-03-25T00:00:00.000Z",
      deliveredAt: "2026-03-25T00:00:00.000Z",
    },
  });

  assert.equal(executions.length, 6);
  assert.match(projection.readExecution.stdout, /cmp_proj_db_lowering/);
  assert.equal(projection.truthReadback.status, "present");
  assert.match(contextPackage.readExecution.stdout, /cmp_proj_db_lowering/);
  assert.match(delivery.readExecution.stdout, /cmp_proj_db_lowering/);
});

test("cmp db lowering can persist a git fallback backfilled package record through the same package truth path", async () => {
  const topology = createCmpProjectDbTopology({
    projectId: "proj-db-backfill-lowering",
    databaseName: "cmp_proj_db_backfill_l",
    schemaName: "cmp_proj_db_backfill_l",
  });
  const adapter = createCmpDbPostgresAdapter({
    topology,
    localTableSets: [
      createCmpAgentLocalTableSet({
        projectId: "proj-db-backfill-lowering",
        schemaName: "cmp_proj_db_backfill_l",
        agentId: "main",
      }),
    ],
  });
  const executions: string[] = [];
  const executor = createCmpDbPsqlLiveExecutor({
    connection: {
      databaseName: "postgres",
    },
    async commandRunner(invocation) {
      executions.push(invocation.statement.statementId);
      return {
        stdout: invocation.statement.target,
        stderr: "",
        exitCode: 0,
      };
    },
  });

  const backfilledRecord = createCmpDbContextPackageBackfillRecord({
    packageId: "pkg-backfill-1",
    sourceProjection: {
      projectionId: "projection-backfill-1",
      snapshotId: "snapshot-backfill-1",
      agentId: "main",
    },
    targetAgentId: "restore-child",
    packageKind: "historical_reply",
    packageRef: "cmp-package:git-rebuild:pkg-backfill-1",
    fidelityLabel: "checked_high_fidelity",
    createdAt: "2026-03-25T10:00:00.000Z",
  });

  const lowered = await executeCmpContextPackageLowering({
    adapter,
    executor,
    record: backfilledRecord,
  });

  assert.equal(executions.length, 2);
  assert.match(lowered.writeExecution.stdout, /cmp_proj_db_backfill_l/);
  assert.match(lowered.readExecution.stdout, /cmp_proj_db_backfill_l/);
  assert.equal(backfilledRecord.metadata?.truthSource, "git_fallback_backfill");
});

test("cmp projection truth readback marks a projection as missing when select returns no table ref", () => {
  const truth = summarizeCmpProjectionTruthReadback({
    record: {
      projectionId: "projection:missing",
      snapshotId: "snapshot:missing",
      agentId: "main",
      branchRef: "refs/heads/cmp/main",
      commitRef: "cmp-commit-missing",
      state: "local_only",
      updatedAt: "2026-03-25T00:00:00.000Z",
    },
    execution: {
      statementId: "stmt-missing",
      target: "cmp_proj_db_lowering.cmp_proj_db_lowering_main_snapshots",
      phase: "read",
      stdout: "   ",
      stderr: "",
      exitCode: 0,
    },
  });

  assert.equal(truth.status, "missing");
  assert.equal(truth.tableRef, undefined);
});

test("cmp db lowering can derive a delivery registry record from mq projection patch", () => {
  const record = createCmpDeliveryRecordFromMqProjectionPatch({
    patch: {
      deliveryId: "delivery-patch-1",
      dispatchId: "dispatch-patch-1",
      packageId: "package-patch-1",
      sourceAgentId: "main",
      targetAgentId: "child-a",
      state: "pending_delivery",
      deliveredAt: "2026-03-25T02:00:00.000Z",
      metadata: {
        truthStatus: "published",
      },
    },
  });

  assert.equal(record.state, "pending_delivery");
  assert.equal(record.deliveredAt, "2026-03-25T02:00:00.000Z");
  assert.equal(record.metadata?.truthStatus, "published");
});

test("cmp db lowering can apply mq projection patch onto an existing delivery record", () => {
  const patched = applyCmpMqDeliveryProjectionPatchToRecord({
    record: {
      deliveryId: "delivery-patch-2",
      dispatchId: "dispatch-patch-2",
      packageId: "package-patch-2",
      sourceAgentId: "main",
      targetAgentId: "child-a",
      state: "delivered",
      createdAt: "2026-03-25T02:00:00.000Z",
      deliveredAt: "2026-03-25T02:00:00.000Z",
      metadata: {
        origin: "dispatch",
      },
    },
    patch: {
      deliveryId: "delivery-patch-2",
      dispatchId: "dispatch-patch-2",
      packageId: "package-patch-2",
      sourceAgentId: "main",
      targetAgentId: "child-a",
      state: "acknowledged",
      deliveredAt: "2026-03-25T02:00:00.000Z",
      acknowledgedAt: "2026-03-25T02:01:00.000Z",
      metadata: {
        truthStatus: "acknowledged",
      },
    },
    metadata: {
      loweringMode: "patch-test",
    },
  });

  assert.equal(patched.state, "acknowledged");
  assert.equal(patched.acknowledgedAt, "2026-03-25T02:01:00.000Z");
  assert.equal(patched.metadata?.origin, "dispatch");
  assert.equal(patched.metadata?.truthStatus, "acknowledged");
  assert.equal(patched.metadata?.loweringMode, "patch-test");
});
