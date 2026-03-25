import assert from "node:assert/strict";
import test from "node:test";

import {
  createCmpAgentLocalTableSet,
  createCmpDbPostgresAdapter,
  createCmpDbPsqlLiveExecutor,
  createCmpProjectDbTopology,
} from "../cmp-db/index.js";
import {
  executeCmpContextPackageLowering,
  executeCmpDeliveryLowering,
  executeCmpProjectionLowering,
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
  assert.match(contextPackage.readExecution.stdout, /cmp_proj_db_lowering/);
  assert.match(delivery.readExecution.stdout, /cmp_proj_db_lowering/);
});
