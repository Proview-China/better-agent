import assert from "node:assert/strict";
import test from "node:test";

import { createMpMemoryRecord } from "../mp-types/index.js";
import { createInMemoryMpLanceDbAdapter } from "./lancedb-adapter.js";
import { createMpLanceBootstrapPlan } from "./lancedb-bootstrap.js";
import {
  compactMpSemanticGroup,
  mergeMpMemoryRecords,
  reindexMpMemoryRecord,
  splitMpMemoryRecord,
} from "./lancedb-maintenance.js";

test("mp lancedb maintenance splits one memory into multiple derived chunks", async () => {
  const adapter = createInMemoryMpLanceDbAdapter();
  const plan = createMpLanceBootstrapPlan({
    projectId: "project.praxis",
    agentIds: ["agent.main"],
    rootPath: "/tmp/praxis-mp",
  });
  await adapter.bootstrap(plan);
  const tableName = plan.layout.agentTables[0]?.tableName ?? "";
  const source = createMpMemoryRecord({
    memoryId: "memory-source",
    projectId: "project.praxis",
    agentId: "agent.main",
    scopeLevel: "agent_isolated",
    sessionMode: "isolated",
    visibilityState: "local_only",
    promotionState: "local_only",
    lineagePath: ["agent.main"],
    payloadRefs: ["payload-a", "payload-b", "payload-c"],
    tags: ["history"],
    bodyRef: "body:source",
    createdAt: "2026-04-08T00:00:00.000Z",
    updatedAt: "2026-04-08T00:00:01.000Z",
  });
  await adapter.upsertMemories({ tableName, records: [source] });

  const derived = await splitMpMemoryRecord({
    adapter,
    tableName,
    sourceRecord: source,
    split: {
      memoryId: "memory-source",
      sourceAgentId: "agent.main",
      targetChunkCount: 2,
      splitReason: "Need smaller chunks.",
      createdAt: "2026-04-08T00:00:02.000Z",
    },
  });

  assert.equal(derived.length, 2);
  assert.equal(derived[0]?.ancestry?.parentMemoryId, "memory-source");
  assert.equal(derived[1]?.ancestry?.splitFromIds?.[0], "memory-source");
});

test("mp lancedb maintenance merges sibling memories into one bundle and can reindex/compact", async () => {
  const adapter = createInMemoryMpLanceDbAdapter();
  const plan = createMpLanceBootstrapPlan({
    projectId: "project.praxis",
    agentIds: ["agent.main"],
    rootPath: "/tmp/praxis-mp",
  });
  await adapter.bootstrap(plan);
  const tableName = plan.layout.projectTable.tableName;
  const sourceA = createMpMemoryRecord({
    memoryId: "memory-a",
    projectId: "project.praxis",
    agentId: "agent.main",
    scopeLevel: "project",
    sessionMode: "shared",
    visibilityState: "project_shared",
    promotionState: "promoted_to_project",
    lineagePath: ["agent.main"],
    payloadRefs: ["payload-a"],
    tags: ["history"],
    createdAt: "2026-04-08T00:00:00.000Z",
    updatedAt: "2026-04-08T00:00:01.000Z",
  });
  const sourceB = createMpMemoryRecord({
    ...sourceA,
    memoryId: "memory-b",
    payloadRefs: ["payload-b"],
  });
  await adapter.upsertMemories({ tableName, records: [sourceA, sourceB] });

  const merged = await mergeMpMemoryRecords({
    adapter,
    tableName,
    sourceRecords: [sourceA, sourceB],
    merge: {
      sourceMemoryIds: ["memory-a", "memory-b"],
      mergedMemoryId: "memory-merged",
      targetAgentId: "agent.main",
      mergeReason: "Collapse sibling memories.",
      createdAt: "2026-04-08T00:00:02.000Z",
    },
  });
  const reindexed = await reindexMpMemoryRecord({
    adapter,
    tableName,
    record: merged.record,
    reindexedAt: "2026-04-08T00:00:03.000Z",
  });
  const archived = await compactMpSemanticGroup({
    adapter,
    tableName,
    records: [sourceA, sourceB, merged.record],
    keepMemoryId: "memory-merged",
    archivedAt: "2026-04-08T00:00:04.000Z",
  });

  assert.equal(merged.record.memoryId, "memory-merged");
  assert.deepEqual(merged.bundle.memberMemoryIds, ["memory-a", "memory-b"]);
  assert.equal(reindexed.metadata?.reindexedAt, "2026-04-08T00:00:03.000Z");
  assert.equal(archived.length, 2);
  assert(archived.every((record) => record.visibilityState === "archived"));
});
