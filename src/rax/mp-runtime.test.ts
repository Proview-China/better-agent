import assert from "node:assert/strict";
import test from "node:test";

import {
  createCmpSection,
  createCmpStoredSectionFromSection,
  createInMemoryMpLanceDbAdapter,
  createMpLineageNode,
  createMpScopeDescriptor,
} from "../agent_core/index.js";
import { createMpSharedInfraConnectors } from "./mp-connectors.js";
import { createRaxMpConfig } from "./mp-config.js";
import { createRaxMpRuntime } from "./mp-runtime.js";

test("createRaxMpRuntime can assemble shared lance connector and mp workflow surface", async () => {
  const config = createRaxMpConfig({
    projectId: "proj-rax-mp-runtime",
    lance: {
      rootPath: "/tmp/praxis/proj-rax-mp-runtime",
      liveExecutionPreferred: false,
    },
  });
  const runtime = createRaxMpRuntime({
    config,
  });
  const receipt = await runtime.bootstrapProject({
    agentIds: ["main"],
  });

  assert.equal(runtime.config.projectId, "proj-rax-mp-runtime");
  assert.equal(runtime.connectors.lance.kind, "shared_lancedb");
  assert.equal(receipt.status, "bootstrapped");
  assert.equal(typeof runtime.materializeStoredSection, "function");
  assert.equal(typeof runtime.search, "function");
  assert.equal(typeof runtime.splitMemory, "function");
  assert.equal(typeof runtime.mergeMemories, "function");
});

test("createRaxMpRuntime can reuse injected connectors", async () => {
  const config = createRaxMpConfig({
    projectId: "proj-rax-mp-runtime-injected",
    lance: {
      rootPath: "/tmp/praxis/proj-rax-mp-runtime-injected",
      liveExecutionPreferred: false,
    },
  });
  const connectors = createMpSharedInfraConnectors({
    adapter: createInMemoryMpLanceDbAdapter(),
  });
  const runtime = createRaxMpRuntime({
    config,
    connectors,
  });

  assert.equal(runtime.connectors, connectors);
});

test("createRaxMpRuntime search can surface materialized project memory", async () => {
  const config = createRaxMpConfig({
    projectId: "proj-rax-mp-runtime-search",
    lance: {
      rootPath: "/tmp/praxis/proj-rax-mp-runtime-search",
      liveExecutionPreferred: false,
    },
  });
  const runtime = createRaxMpRuntime({
    config,
  });
  await runtime.bootstrapProject({
    agentIds: ["main"],
  });

  const section = createCmpSection({
    id: "section-1",
    projectId: "proj-rax-mp-runtime-search",
    agentId: "main",
    lineagePath: ["main"],
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
    state: "promoted",
    visibility: "parent",
    persistedAt: "2026-04-08T00:00:01.000Z",
  });
  await runtime.materializeStoredSection({
    storedSection,
    checkedSnapshotRef: "snapshot-1",
    branchRef: "mp/main",
    scope: createMpScopeDescriptor({
      projectId: "proj-rax-mp-runtime-search",
      agentId: "main",
      scopeLevel: "project",
      sessionMode: "shared",
    }),
  });

  const result = await runtime.search({
    queryText: "stored",
    requesterLineage: createMpLineageNode({
      projectId: "proj-rax-mp-runtime-search",
      agentId: "main",
      depth: 0,
    }),
    sourceLineages: new Map([
      ["main", createMpLineageNode({
        projectId: "proj-rax-mp-runtime-search",
        agentId: "main",
        depth: 0,
      })],
    ]),
  });

  assert.equal(result.hits.length, 1);
  assert.equal(result.hits[0]?.record.scopeLevel, "project");
});
