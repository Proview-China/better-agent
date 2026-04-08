import assert from "node:assert/strict";
import test from "node:test";

import { createMpMemoryRecord } from "../mp-types/index.js";
import { createInMemoryMpLanceDbAdapter } from "./lancedb-adapter.js";
import { createMpLanceBootstrapPlan } from "./lancedb-bootstrap.js";
import { executeMpLanceSearch, rerankMpLanceSearchResult } from "./lancedb-query.js";

test("mp lancedb query searches across bootstrap tables and dedupes by memory id", async () => {
  const adapter = createInMemoryMpLanceDbAdapter();
  const plan = createMpLanceBootstrapPlan({
    projectId: "project.praxis",
    agentIds: ["agent.main"],
    rootPath: "/tmp/praxis-mp",
  });
  await adapter.bootstrap(plan);

  const projectRecord = createMpMemoryRecord({
    memoryId: "memory-1",
    projectId: "project.praxis",
    agentId: "agent.main",
    scopeLevel: "project",
    sessionMode: "shared",
    visibilityState: "project_shared",
    promotionState: "promoted_to_project",
    lineagePath: ["agent.main"],
    payloadRefs: ["payload-1"],
    tags: ["search", "history"],
    bodyRef: "history answer",
    createdAt: "2026-04-08T00:00:00.000Z",
    updatedAt: "2026-04-08T00:00:01.000Z",
  });
  const duplicateRecord = createMpMemoryRecord({
    ...projectRecord,
    bodyRef: "history answer duplicate",
  });

  await adapter.upsertMemories({
    tableName: plan.layout.projectTable.tableName,
    records: [projectRecord],
  });
  await adapter.upsertMemories({
    tableName: plan.layout.globalTable.tableName,
    records: [duplicateRecord],
  });

  const result = await executeMpLanceSearch({
    adapter,
    projectId: "project.praxis",
    queryText: "history answer",
    limit: 10,
  });

  assert.equal(result.hits.length, 1);
  assert.equal(result.hits[0]?.memoryId, "memory-1");
  assert.equal(result.dedupedCount, 1);
});

test("mp lancedb query rerank prefers same-agent hits before broader scope hits", () => {
  const reranked = rerankMpLanceSearchResult({
    result: {
      projectId: "project.praxis",
      queryText: "history",
      hits: [
        {
          memoryId: "memory-project",
          tableName: "project",
          score: 0.8,
          record: createMpMemoryRecord({
            memoryId: "memory-project",
            projectId: "project.praxis",
            agentId: "agent.peer",
            scopeLevel: "project",
            sessionMode: "shared",
            visibilityState: "project_shared",
            promotionState: "promoted_to_project",
            lineagePath: ["agent.peer"],
            payloadRefs: ["payload-1"],
            tags: ["history"],
            createdAt: "2026-04-08T00:00:00.000Z",
            updatedAt: "2026-04-08T00:00:01.000Z",
          }),
        },
        {
          memoryId: "memory-local",
          tableName: "agent",
          score: 0.6,
          record: createMpMemoryRecord({
            memoryId: "memory-local",
            projectId: "project.praxis",
            agentId: "agent.main",
            scopeLevel: "agent_isolated",
            sessionMode: "isolated",
            visibilityState: "local_only",
            promotionState: "local_only",
            lineagePath: ["agent.main"],
            payloadRefs: ["payload-2"],
            tags: ["history"],
            createdAt: "2026-04-08T00:00:00.000Z",
            updatedAt: "2026-04-08T00:00:01.000Z",
          }),
        },
      ],
    },
    preferredAgentId: "agent.main",
  });

  assert.equal(reranked.hits[0]?.memoryId, "memory-local");
});
