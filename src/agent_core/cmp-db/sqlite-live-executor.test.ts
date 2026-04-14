import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { createCmpProjectDbBootstrapContract } from "./postgresql-bootstrap.js";
import { createCmpDbSqliteLiveExecutor } from "./sqlite-live-executor.js";

test("cmp sqlite live executor bootstraps and readbacks all expected targets", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cmp-sqlite-live-"));
  const databaseName = join(dir, "cmp.sqlite");
  const contract = createCmpProjectDbBootstrapContract({
    projectId: "cmp_sqlite_live_executor",
    storageEngine: "sqlite",
    databaseName,
    agentIds: ["main"],
  });
  const executor = createCmpDbSqliteLiveExecutor({
    connection: {
      databaseName,
    },
  });

  const result = await executor.executeBootstrapContract(contract);

  assert.equal(result.receipt.storageEngine, "sqlite");
  assert.equal(result.receipt.status, "bootstrapped");
  assert.equal(result.receipt.presentTargetCount, result.receipt.expectedTargetCount);
  assert.ok(result.receipt.readbackRecords.every((record) => record.status === "present"));
});
