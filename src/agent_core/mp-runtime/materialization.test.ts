import assert from "node:assert/strict";
import test from "node:test";

import { createCmpSection, createCmpStoredSectionFromSection } from "../cmp-types/cmp-section.js";
import {
  createInMemoryMpLanceDbAdapter,
  createMpLanceBootstrapPlan,
} from "../mp-lancedb/index.js";
import { createMpScopeDescriptor } from "../mp-types/index.js";
import { createMpLineageNode } from "./runtime-types.js";
import {
  archiveMpMemoryRecord,
  materializeMpStoredSection,
  materializeMpStoredSectionBatch,
  promoteMpMemoryRecord,
} from "./materialization.js";

test("mp materialization lowers a stored section and writes it into the inferred table", async () => {
  const adapter = createInMemoryMpLanceDbAdapter();
  const plan = createMpLanceBootstrapPlan({
    projectId: "project.praxis",
    agentIds: ["agent.main"],
    rootPath: "/tmp/praxis-mp",
  });
  await adapter.bootstrap(plan);

  const section = createCmpSection({
    id: "section-1",
    projectId: "project.praxis",
    agentId: "agent.main",
    lineagePath: ["agent.main"],
    source: "core_agent",
    kind: "runtime_context",
    fidelity: "checked",
    payloadRefs: ["payload-1"],
    tags: [],
    createdAt: "2026-04-08T00:00:00.000Z",
  });
  const storedSection = createCmpStoredSectionFromSection({
    storedSectionId: "stored-1",
    section,
    plane: "postgresql",
    storageRef: "postgresql:stored-1",
    persistedAt: "2026-04-08T00:00:01.000Z",
  });

  const records = await materializeMpStoredSection({
    input: {
      storedSection,
      checkedSnapshotRef: "snapshot-1",
      branchRef: "mp/main",
      scope: createMpScopeDescriptor({
        projectId: "project.praxis",
        agentId: "agent.main",
        scopeLevel: "agent_isolated",
        sessionMode: "isolated",
      }),
    },
    adapter,
  });

  const stored = await adapter.getMemoryById({
    tableName: plan.layout.agentTables[0]?.tableName ?? "",
    memoryId: records[0]?.memoryId ?? "",
  });

  assert.equal(records.length, 1);
  assert.equal(stored?.sourceStoredSectionId, "stored-1");
  assert.equal(stored?.scopeLevel, "agent_isolated");
});

test("mp materialization batch and archive keep records addressable through the adapter", async () => {
  const adapter = createInMemoryMpLanceDbAdapter();
  const plan = createMpLanceBootstrapPlan({
    projectId: "project.praxis",
    agentIds: ["agent.main"],
    rootPath: "/tmp/praxis-mp",
  });
  await adapter.bootstrap(plan);

  const baseSection = createCmpSection({
    id: "section-2",
    projectId: "project.praxis",
    agentId: "agent.main",
    lineagePath: ["agent.main"],
    source: "system",
    kind: "task_seed",
    fidelity: "checked",
    payloadRefs: ["payload-2"],
    tags: [],
    createdAt: "2026-04-08T00:00:00.000Z",
  });

  const records = await materializeMpStoredSectionBatch({
    adapter,
    inputs: ["stored-a", "stored-b"].map((storedSectionId, index) => ({
      storedSection: createCmpStoredSectionFromSection({
        storedSectionId,
        section: {
          ...baseSection,
          id: `section-${index + 2}`,
        },
        plane: "postgresql",
        storageRef: `postgresql:${storedSectionId}`,
        persistedAt: `2026-04-08T00:00:0${index + 1}.000Z`,
      }),
      checkedSnapshotRef: `snapshot-${index + 2}`,
      branchRef: "mp/main",
      scope: createMpScopeDescriptor({
        projectId: "project.praxis",
        agentId: "agent.main",
        scopeLevel: "agent_isolated",
        sessionMode: "isolated",
      }),
    })),
  });

  const archived = await archiveMpMemoryRecord({
    adapter,
    projectId: "project.praxis",
    agentId: "agent.main",
    scopeLevel: "agent_isolated",
    memoryId: records[0]?.memoryId ?? "",
    archivedAt: "2026-04-08T00:00:03.000Z",
  });

  assert.equal(records.length, 2);
  assert.equal(archived?.visibilityState, "archived");
  assert.equal(archived?.promotionState, "archived");
});

test("mp materialization promotes an agent-local memory into the project table with parent approval", async () => {
  const adapter = createInMemoryMpLanceDbAdapter();
  const plan = createMpLanceBootstrapPlan({
    projectId: "project.praxis",
    agentIds: ["agent.child"],
    rootPath: "/tmp/praxis-mp",
  });
  await adapter.bootstrap(plan);

  const section = createCmpSection({
    id: "section-3",
    projectId: "project.praxis",
    agentId: "agent.child",
    lineagePath: ["agent.root", "agent.child"],
    source: "core_agent",
    kind: "runtime_context",
    fidelity: "checked",
    payloadRefs: ["payload-3"],
    tags: [],
    createdAt: "2026-04-08T00:00:00.000Z",
  });
  const storedSection = createCmpStoredSectionFromSection({
    storedSectionId: "stored-3",
    section,
    plane: "postgresql",
    storageRef: "postgresql:stored-3",
    persistedAt: "2026-04-08T00:00:01.000Z",
  });

  const [memory] = await materializeMpStoredSection({
    input: {
      storedSection,
      checkedSnapshotRef: "snapshot-3",
      branchRef: "mp/child",
      scope: createMpScopeDescriptor({
        projectId: "project.praxis",
        agentId: "agent.child",
        scopeLevel: "agent_isolated",
        sessionMode: "isolated",
      }),
    },
    adapter,
  });

  const promoted = await promoteMpMemoryRecord({
    adapter,
    memory,
    owner: createMpLineageNode({
      projectId: "project.praxis",
      agentId: "agent.child",
      parentAgentId: "agent.root",
      depth: 1,
    }),
    promoter: createMpLineageNode({
      projectId: "project.praxis",
      agentId: "agent.root",
      depth: 0,
    }),
    nextScopeLevel: "project",
    promotedAt: "2026-04-08T00:00:02.000Z",
  });

  const stored = await adapter.getMemoryById({
    tableName: plan.layout.projectTable.tableName,
    memoryId: promoted.memoryId,
  });

  assert.equal(promoted.scopeLevel, "project");
  assert.equal(promoted.visibilityState, "project_shared");
  assert.equal(stored?.promotionState, "promoted_to_project");
});
