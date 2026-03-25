import assert from "node:assert/strict";
import test from "node:test";

import {
  CMP_DB_AGENT_LOCAL_TABLE_KINDS,
  CMP_DB_BOOTSTRAP_READBACK_STATUSES,
  CMP_DB_BOOTSTRAP_RECEIPT_STATUSES,
  CMP_DB_SHARED_TABLE_KINDS,
  CMP_PROJECTION_STATES,
  validateCmpAgentLocalTableSet,
  validateCmpProjectDbTopology,
} from "./index.js";

test("cmp-db protocol constants expose frozen shared/local table kinds and projection states", () => {
  assert.deepEqual(CMP_DB_SHARED_TABLE_KINDS, [
    "agent_registry",
    "agent_lineage",
    "branch_registry",
    "sync_event_registry",
    "promotion_registry",
    "delivery_registry",
  ]);
  assert.deepEqual(CMP_DB_AGENT_LOCAL_TABLE_KINDS, [
    "events",
    "snapshots",
    "packages",
    "dispatch",
  ]);
  assert.deepEqual(CMP_PROJECTION_STATES, [
    "local_only",
    "submitted_to_parent",
    "accepted_by_parent",
    "promoted_by_parent",
    "dispatched_downward",
    "archived",
  ]);
  assert.deepEqual(CMP_DB_BOOTSTRAP_READBACK_STATUSES, [
    "present",
    "missing",
  ]);
  assert.deepEqual(CMP_DB_BOOTSTRAP_RECEIPT_STATUSES, [
    "bootstrapped",
    "readback_incomplete",
  ]);
});

test("cmp-db validators reject empty topologies and table sets", () => {
  assert.throws(() => validateCmpProjectDbTopology({
    projectId: "",
    databaseName: "",
    schemaName: "",
    sharedTables: [],
  }), /projectId/i);

  assert.throws(() => validateCmpAgentLocalTableSet({
    projectId: "praxis-main",
    schemaName: "cmp",
    agentId: "agent-1",
    tables: [],
  }), /at least one table/i);
});
