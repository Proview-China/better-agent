import assert from "node:assert/strict";
import test from "node:test";

import { createInMemoryMpLanceDbAdapter, createMpLanceBootstrapPlan } from "../mp-lancedb/index.js";
import { createMpMemoryRecord } from "../mp-types/index.js";
import { createMpLineageNode } from "./runtime-types.js";
import {
  buildMpSourceLineages,
  createMpSearchPlan,
  executeMpSearchPlan,
  summarizeMpSearchHits,
} from "./search-planner.js";
import { createMpSessionBridgeRecord } from "./session-bridge.js";

test("mp search planner builds table targets from requested scopes", () => {
  const plan = createMpSearchPlan({
    projectId: "project.praxis",
    queryText: "history answer",
    requesterLineage: createMpLineageNode({
      projectId: "project.praxis",
      agentId: "agent.main",
      depth: 0,
    }),
    agentTableName: "agent_table",
    projectTableName: "project_table",
    globalTableName: "global_table",
    scopeLevels: ["agent_isolated", "project"],
  });

  assert.deepEqual(plan.tableNames, ["agent_table", "project_table"]);
  assert.deepEqual(plan.requestedScopeLevels, ["agent_isolated", "project"]);
});

test("mp search planner filters hits through scope and session bridge enforcement", async () => {
  const adapter = createInMemoryMpLanceDbAdapter();
  const plan = createMpLanceBootstrapPlan({
    projectId: "project.praxis",
    agentIds: ["agent.main", "agent.child"],
    rootPath: "/tmp/praxis-mp",
  });
  await adapter.bootstrap(plan);

  const local = createMpMemoryRecord({
    memoryId: "memory-local",
    projectId: "project.praxis",
    agentId: "agent.main",
    sessionId: "session-a",
    scopeLevel: "agent_isolated",
    sessionMode: "isolated",
    visibilityState: "local_only",
    promotionState: "local_only",
    lineagePath: ["agent.main"],
    payloadRefs: ["payload-1"],
    tags: ["history", "answer"],
    bodyRef: "history answer",
    createdAt: "2026-04-08T00:00:00.000Z",
    updatedAt: "2026-04-08T00:00:01.000Z",
  });
  const bridged = createMpMemoryRecord({
    memoryId: "memory-bridged",
    projectId: "project.praxis",
    agentId: "agent.child",
    sessionId: "session-child",
    scopeLevel: "agent_isolated",
    sessionMode: "bridged",
    visibilityState: "session_bridged",
    promotionState: "submitted_to_parent",
    lineagePath: ["agent.root", "agent.child"],
    payloadRefs: ["payload-2"],
    tags: ["history", "answer"],
    bodyRef: "history answer bridged",
    createdAt: "2026-04-08T00:00:00.000Z",
    updatedAt: "2026-04-08T00:00:01.000Z",
  });
  const projectShared = createMpMemoryRecord({
    memoryId: "memory-project",
    projectId: "project.praxis",
    agentId: "agent.child",
    scopeLevel: "project",
    sessionMode: "shared",
    visibilityState: "project_shared",
    promotionState: "promoted_to_project",
    lineagePath: ["agent.root", "agent.child"],
    payloadRefs: ["payload-3"],
    tags: ["history"],
    bodyRef: "history answer project",
    createdAt: "2026-04-08T00:00:00.000Z",
    updatedAt: "2026-04-08T00:00:01.000Z",
  });

  await adapter.upsertMemories({
    tableName: plan.layout.agentTables[0]?.tableName ?? "",
    records: [local],
  });
  await adapter.upsertMemories({
    tableName: plan.layout.agentTables[1]?.tableName ?? "",
    records: [bridged],
  });
  await adapter.upsertMemories({
    tableName: plan.layout.projectTable.tableName,
    records: [projectShared],
  });

  const requester = createMpLineageNode({
    projectId: "project.praxis",
    agentId: "agent.main",
    depth: 0,
    childAgentIds: ["agent.child"],
  });
  const sourceLineages = buildMpSourceLineages([
    requester,
    createMpLineageNode({
      projectId: "project.praxis",
      agentId: "agent.child",
      parentAgentId: "agent.main",
      depth: 1,
    }),
  ]);

  const searchPlan = createMpSearchPlan({
    projectId: "project.praxis",
    queryText: "history answer",
    requesterLineage: requester,
    requesterSessionId: "session-a",
    agentTableName: plan.layout.agentTables[0]?.tableName,
    agentTableNames: plan.layout.agentTables.map((table) => table.tableName),
    projectTableName: plan.layout.projectTable.tableName,
    globalTableName: plan.layout.globalTable.tableName,
  });
  const withoutBridge = await executeMpSearchPlan({
    adapter,
    plan: searchPlan,
    requesterLineage: requester,
    sourceLineages,
  });
  const withBridge = await executeMpSearchPlan({
    adapter,
    plan: searchPlan,
    requesterLineage: requester,
    sourceLineages,
    bridgeRecords: [createMpSessionBridgeRecord({
      bridgeId: "bridge-1",
      memoryId: "memory-bridged",
      ownerAgentId: "agent.child",
      sourceSessionId: "session-child",
      targetSessionId: "session-a",
      status: "active",
      createdAt: "2026-04-08T00:00:02.000Z",
    })],
  });

  assert.deepEqual(
    summarizeMpSearchHits(withoutBridge.hits).map((hit) => hit.memoryId),
    ["memory-local", "memory-project"],
  );
  assert.deepEqual(
    summarizeMpSearchHits(withBridge.hits).map((hit) => hit.memoryId),
    ["memory-local", "memory-bridged", "memory-project"],
  );
});
