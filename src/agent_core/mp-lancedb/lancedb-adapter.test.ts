import assert from "node:assert/strict";
import test from "node:test";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import { createMpMemoryRecord } from "../mp-types/index.js";
import {
  createLanceDbMpLanceDbAdapter,
  createInMemoryMpLanceDbAdapter,
  createMpLanceBootstrapPlan,
} from "./index.js";

test("mp in-memory lancedb adapter bootstraps project tables and upserts memory records", async () => {
  const adapter = createInMemoryMpLanceDbAdapter();
  const plan = createMpLanceBootstrapPlan({
    projectId: "project.praxis",
    agentIds: ["agent.main", "agent.worker"],
    rootPath: "/tmp/praxis-mp",
  });
  const receipt = await adapter.bootstrap(plan);
  const projectTable = plan.layout.projectTable.tableName;
  const memory = createMpMemoryRecord({
    memoryId: "memory-1",
    projectId: "project.praxis",
    agentId: "agent.main",
    scopeLevel: "project",
    sessionMode: "shared",
    visibilityState: "project_shared",
    promotionState: "promoted_to_project",
    lineagePath: ["agent.main"],
    payloadRefs: ["payload-1"],
    tags: ["tag-a"],
    bodyRef: "body:memory-1",
    createdAt: "2026-04-08T00:00:00.000Z",
    updatedAt: "2026-04-08T00:00:01.000Z",
  });

  await adapter.upsertMemories({
    tableName: projectTable,
    records: [memory],
  });

  const tables = await adapter.listProjectTables("project.praxis");
  const stored = await adapter.getMemoryById({
    tableName: projectTable,
    memoryId: "memory-1",
  });

  assert.equal(receipt.status, "bootstrapped");
  assert(tables.includes(projectTable));
  assert.equal(stored?.memoryId, "memory-1");
  assert.equal(stored?.scopeLevel, "project");
});

test("mp in-memory lancedb adapter archives a memory in place", async () => {
  const adapter = createInMemoryMpLanceDbAdapter();
  const plan = createMpLanceBootstrapPlan({
    projectId: "project.praxis",
    agentIds: ["agent.main"],
    rootPath: "/tmp/praxis-mp",
  });
  const agentTable = plan.layout.agentTables[0]?.tableName;
  const memory = createMpMemoryRecord({
    memoryId: "memory-1",
    projectId: "project.praxis",
    agentId: "agent.main",
    sessionId: "session-a",
    scopeLevel: "agent_isolated",
    sessionMode: "isolated",
    visibilityState: "local_only",
    promotionState: "local_only",
    lineagePath: ["agent.main"],
    payloadRefs: ["payload-1"],
    tags: [],
    createdAt: "2026-04-08T00:00:00.000Z",
    updatedAt: "2026-04-08T00:00:01.000Z",
  });

  await adapter.bootstrap(plan);
  await adapter.upsertMemories({
    tableName: agentTable,
    records: [memory],
  });

  const archived = await adapter.archiveMemory({
    tableName: agentTable,
    memoryId: "memory-1",
    archivedAt: "2026-04-08T00:00:02.000Z",
  });

  assert.equal(archived?.visibilityState, "archived");
  assert.equal(archived?.promotionState, "archived");
  assert.equal(archived?.metadata?.archivedAt, "2026-04-08T00:00:02.000Z");
});

test("mp real lancedb adapter can bootstrap local tables and round-trip a record", async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), "praxis-mp-lance-"));
  const adapter = createLanceDbMpLanceDbAdapter();
  const plan = createMpLanceBootstrapPlan({
    projectId: "project.praxis.real",
    agentIds: ["agent.main"],
    rootPath,
  });
  const projectTable = plan.layout.projectTable.tableName;
  const memory = createMpMemoryRecord({
    memoryId: "memory-real",
    projectId: "project.praxis.real",
    agentId: "agent.main",
    scopeLevel: "project",
    sessionMode: "shared",
    visibilityState: "project_shared",
    promotionState: "promoted_to_project",
    lineagePath: ["agent.main"],
    payloadRefs: ["payload-1"],
    tags: ["history", "real"],
    bodyRef: "real lance record",
    createdAt: "2026-04-08T00:00:00.000Z",
    updatedAt: "2026-04-08T00:00:01.000Z",
    metadata: {
      sectionKind: "runtime_context",
    },
  });

  const receipt = await adapter.bootstrap(plan);
  await adapter.upsertMemories({
    tableName: projectTable,
    records: [memory],
  });

  const stored = await adapter.getMemoryById({
    tableName: projectTable,
    memoryId: "memory-real",
  });
  const search = await adapter.searchMemories({
    projectId: "project.praxis.real",
    queryText: "real lance history",
    tableNames: [projectTable],
  });

  assert.equal(receipt.status, "bootstrapped");
  assert.equal(stored?.memoryId, "memory-real");
  assert.equal(stored?.metadata?.sectionKind, "runtime_context");
  assert.equal(search.hits[0]?.memoryId, "memory-real");
});
