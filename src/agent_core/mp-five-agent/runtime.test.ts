import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createCmpSection,
  createCmpStoredSectionFromSection,
  createMpFiveAgentRuntime,
  createMpLineageNode,
  createMpScopeDescriptor,
  createMpLanceBootstrapPlan,
  createInMemoryMpLanceDbAdapter,
} from "../index.js";

test("mp five-agent runtime ingests aligns and resolves fresher memory first", async () => {
  const adapter = createInMemoryMpLanceDbAdapter();
  const rootPath = await mkdtemp(join(tmpdir(), "praxis-mp-five-agent-"));
  const plan = createMpLanceBootstrapPlan({
    projectId: "project.mp.five-agent",
    agentIds: ["main"],
    rootPath,
  });
  await adapter.bootstrap(plan);
  const runtime = createMpFiveAgentRuntime({ adapter });

  const makeStoredSection = (id: string, persistedAt: string) => createCmpStoredSectionFromSection({
    storedSectionId: `stored-${id}`,
    section: createCmpSection({
      id: `section-${id}`,
      projectId: "project.mp.five-agent",
      agentId: "main",
      lineagePath: ["main"],
      source: "core_agent",
      kind: "runtime_context",
      fidelity: "checked",
      payloadRefs: [`payload-${id}`],
      tags: ["memory", "sync"],
      createdAt: persistedAt,
    }),
    plane: "postgresql",
    storageRef: `postgresql:${id}`,
    state: "promoted",
    visibility: "parent",
    persistedAt,
    metadata: {
      semanticGroupId: "semantic:sync-status",
      tags: ["sync", "status"],
      bodyRef: "team sync status",
    },
  });

  const first = await runtime.ingest({
    projectId: "project.mp.five-agent",
    storedSection: makeStoredSection("old", "2026-04-08T00:00:00.000Z"),
    checkedSnapshotRef: "snapshot-old",
    branchRef: "mp/main",
    scope: createMpScopeDescriptor({
      projectId: "project.mp.five-agent",
      agentId: "main",
      scopeLevel: "project",
      sessionMode: "shared",
    }),
    observedAt: "2026-04-08T00:00:00.000Z",
    sourceRefs: ["source:sync-status"],
  });
  const second = await runtime.ingest({
    projectId: "project.mp.five-agent",
    storedSection: makeStoredSection("new", "2026-04-09T00:00:00.000Z"),
    checkedSnapshotRef: "snapshot-new",
    branchRef: "mp/main",
    scope: createMpScopeDescriptor({
      projectId: "project.mp.five-agent",
      agentId: "main",
      scopeLevel: "project",
      sessionMode: "shared",
    }),
    observedAt: "2026-04-09T00:00:00.000Z",
    sourceRefs: ["source:sync-status"],
  });

  const resolved = await runtime.resolve({
    projectId: "project.mp.five-agent",
    queryText: "sync status",
    requesterLineage: createMpLineageNode({
      projectId: "project.mp.five-agent",
      agentId: "main",
      depth: 0,
    }),
    sourceLineages: new Map([
      ["main", createMpLineageNode({
        projectId: "project.mp.five-agent",
        agentId: "main",
        depth: 0,
      })],
    ]),
  });

  assert.equal(first.records[0]?.freshness.status, "fresh");
  assert.equal(second.alignment.supersededMemoryIds.includes(first.records[0]!.memoryId), true);
  assert.equal(resolved.bundle.primary[0]?.memoryId, second.records[0]?.memoryId);
  assert.equal(runtime.getSummary().quality.supersededMemoryCount, 1);
});
