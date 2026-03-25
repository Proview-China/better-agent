import assert from "node:assert/strict";
import test from "node:test";

import {
  createCmpProjectDbBootstrapReceipt,
  createCmpProjectDbBootstrapContract,
  listCmpProjectDbReadbackTargets,
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

test("createCmpProjectDbBootstrapReceipt marks all targets present when readback rows are complete", () => {
  const contract = createCmpProjectDbBootstrapContract({
    projectId: "praxis-main",
    agentIds: ["main"],
  });

  const receipt = createCmpProjectDbBootstrapReceipt({
    contract,
    readbackRows: listCmpProjectDbReadbackTargets(contract).map((target) => ({
      target,
      tableRef: target,
    })),
  });

  assert.equal(receipt.status, "bootstrapped");
  assert.equal(receipt.presentTargetCount, receipt.expectedTargetCount);
  assert.ok(receipt.readbackRecords.every((record) => record.status === "present"));
});

test("createCmpProjectDbBootstrapReceipt marks missing targets when readback rows are incomplete", () => {
  const contract = createCmpProjectDbBootstrapContract({
    projectId: "praxis-main",
    agentIds: ["main"],
  });
  const [firstTarget] = listCmpProjectDbReadbackTargets(contract);

  const receipt = createCmpProjectDbBootstrapReceipt({
    contract,
    readbackRows: [
      {
        target: firstTarget,
        tableRef: firstTarget,
      },
    ],
  });

  assert.equal(receipt.status, "readback_incomplete");
  assert.equal(receipt.presentTargetCount, 1);
  assert.ok(receipt.readbackRecords.some((record) => record.status === "missing"));
});
