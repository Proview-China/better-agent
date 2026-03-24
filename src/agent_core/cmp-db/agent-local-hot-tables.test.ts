import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCmpAgentOwnsLocalTable,
  createCmpAgentLocalTableSet,
  getCmpAgentLocalTableByKind,
} from "./index.js";

test("createCmpAgentLocalTableSet builds the four logical hot tables for one agent", () => {
  const set = createCmpAgentLocalTableSet({
    projectId: "praxis-main",
    agentId: "agent-yahoo",
  });

  assert.equal(set.projectId, "praxis-main");
  assert.equal(set.schemaName, "cmp");
  assert.equal(set.tables.length, 4);
  assert.equal(getCmpAgentLocalTableByKind({
    set,
    kind: "events",
  })?.tableName, "cmp_praxis_main_agent_yahoo_events");
  assert.equal(getCmpAgentLocalTableByKind({
    set,
    kind: "events",
  })?.storageEngine, "postgresql");
  assert.ok((getCmpAgentLocalTableByKind({
    set,
    kind: "events",
  })?.columns.length ?? 0) > 0);
  assert.equal(getCmpAgentLocalTableByKind({
    set,
    kind: "dispatch",
  })?.ownership, "agent_local");
  assert.equal(getCmpAgentLocalTableByKind({
    set,
    kind: "packages",
  })?.indexes?.some((index) => index.unique && index.columns.includes("package_id")), true);
});

test("assertCmpAgentOwnsLocalTable blocks cross-agent ownership", () => {
  const set = createCmpAgentLocalTableSet({
    projectId: "praxis-main",
    agentId: "agent-yahoo",
  });
  const table = getCmpAgentLocalTableByKind({
    set,
    kind: "packages",
  });

  assert.ok(table);
  assert.doesNotThrow(() => assertCmpAgentOwnsLocalTable({
    agentId: "agent-yahoo",
    table,
  }));
  assert.throws(() => assertCmpAgentOwnsLocalTable({
    agentId: "agent-sibling",
    table,
  }), /belongs to agent-yahoo/i);
});
