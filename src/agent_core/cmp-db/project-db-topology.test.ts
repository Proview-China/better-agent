import assert from "node:assert/strict";
import test from "node:test";

import {
  createCmpProjectDbTopology,
  getCmpSharedTableByKind,
} from "./index.js";

test("createCmpProjectDbTopology builds one project db with all shared tables", () => {
  const topology = createCmpProjectDbTopology({
    projectId: "praxis-main",
  });

  assert.equal(topology.databaseName, "cmp_praxis_main");
  assert.equal(topology.schemaName, "cmp");
  assert.equal(topology.sharedTables.length, 6);
  assert.equal(getCmpSharedTableByKind({
    topology,
    kind: "agent_registry",
  })?.tableName, "cmp_praxis_main_agent_registry");
  assert.equal(getCmpSharedTableByKind({
    topology,
    kind: "agent_registry",
  })?.storageEngine, "postgresql");
  assert.equal(getCmpSharedTableByKind({
    topology,
    kind: "agent_registry",
  })?.schemaName, "cmp");
  assert.ok((getCmpSharedTableByKind({
    topology,
    kind: "agent_registry",
  })?.columns.length ?? 0) > 0);
  assert.equal(getCmpSharedTableByKind({
    topology,
    kind: "delivery_registry",
  })?.ownership, "project_shared");
});
