import assert from "node:assert/strict";
import test from "node:test";

import {
  MP_LANCE_SCHEMA_VERSION,
  createMpLanceBootstrapPlan,
  createMpLanceBootstrapReceipt,
  createMpLanceTableNames,
} from "./index.js";

test("mp lancedb bootstrap plan creates global project and per-agent memory tables", () => {
  const names = createMpLanceTableNames({
    projectId: "project.praxis/main",
    agentId: "agent.main",
  });
  const plan = createMpLanceBootstrapPlan({
    projectId: "project.praxis/main",
    agentIds: ["agent.main", "agent.worker", "agent.main"],
    rootPath: "/tmp/praxis-mp",
  });

  assert.equal(names.globalMemories, "mp_global_memories");
  assert.equal(names.projectMemories, "mp_project_project_praxis_main_memories");
  assert.equal(names.agentMemories, "mp_project_project_praxis_main_agent_agent_main_memories");

  assert.equal(plan.schemaVersion, MP_LANCE_SCHEMA_VERSION);
  assert.equal(plan.tableDescriptors.length, 4);
  assert.equal(plan.layout.agentTables.length, 2);
  assert.equal(plan.layout.globalTable.scopeLevel, "global");
  assert.equal(plan.layout.projectTable.scopeLevel, "project");
  assert(plan.layout.agentTables.every((table) => table.scopeLevel === "agent_isolated"));
});

test("mp lancedb bootstrap receipt tracks partial versus complete table presence", () => {
  const plan = createMpLanceBootstrapPlan({
    projectId: "project.praxis",
    agentIds: ["agent.main"],
    rootPath: "/tmp/praxis-mp",
  });

  const partial = createMpLanceBootstrapReceipt({
    plan,
    createdTables: [
      plan.layout.globalTable.tableName,
      plan.layout.projectTable.tableName,
    ],
  });
  const complete = createMpLanceBootstrapReceipt({
    plan,
    createdTables: plan.tableDescriptors.map((descriptor) => descriptor.tableName),
  });

  assert.equal(partial.status, "partial");
  assert.equal(partial.presentTableCount, 2);
  assert.equal(complete.status, "bootstrapped");
  assert.equal(complete.presentTableCount, plan.tableDescriptors.length);
});
