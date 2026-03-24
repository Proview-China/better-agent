import assert from "node:assert/strict";
import test from "node:test";

import {
  createCmpProjectDbBootstrapContract,
} from "./index.js";

test("createCmpProjectDbBootstrapContract builds schema bootstrap and readback statements", () => {
  const contract = createCmpProjectDbBootstrapContract({
    projectId: "praxis-main",
    agentIds: ["main", "yahho"],
  });

  assert.equal(contract.databaseName, "cmp_praxis_main");
  assert.equal(contract.schemaName, "cmp");
  assert.equal(contract.localTableSets.length, 2);
  assert.ok(contract.bootstrapStatements.some((statement) => statement.text.includes("CREATE SCHEMA IF NOT EXISTS")));
  assert.ok(contract.bootstrapStatements.some((statement) => statement.text.includes("CREATE TABLE IF NOT EXISTS \"cmp\".\"cmp_praxis_main_agent_registry\"")));
  assert.ok(contract.bootstrapStatements.some((statement) => statement.text.includes("CREATE UNIQUE INDEX IF NOT EXISTS \"uidx_praxis_main_main_snapshots_snapshot_id\"")));
  assert.ok(contract.readbackStatements.every((statement) => statement.text.includes("to_regclass")));
});
