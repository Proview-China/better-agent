import assert from "node:assert/strict";
import test from "node:test";

import {
  createCmpSection,
  createCmpStoredSectionFromSection,
  createMpLineageNode,
  createMpScopeDescriptor,
} from "../agent_core/index.js";
import { createRaxMpFacade } from "./mp-facade.js";

test("createRaxMpFacade can create session bootstrap and search through the runtime shell", async () => {
  const facade = createRaxMpFacade();
  const session = facade.create({
    config: {
      projectId: "proj-rax-mp-facade",
      lance: {
        rootPath: "/tmp/praxis/proj-rax-mp-facade",
        liveExecutionPreferred: false,
      },
    },
  });
  const bootstrap = await facade.bootstrap({
    session,
    payload: {
      agentIds: ["main"],
    },
  });

  const section = createCmpSection({
    id: "section-1",
    projectId: "proj-rax-mp-facade",
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
  await facade.materialize({
    session,
    payload: {
      storedSection,
      checkedSnapshotRef: "snapshot-1",
      branchRef: "mp/main",
      scope: createMpScopeDescriptor({
        projectId: "proj-rax-mp-facade",
        agentId: "main",
        scopeLevel: "project",
        sessionMode: "shared",
      }),
    },
  });

  const search = await facade.search({
    session,
    payload: {
      queryText: "stored",
      requesterLineage: createMpLineageNode({
        projectId: "proj-rax-mp-facade",
        agentId: "main",
        depth: 0,
      }),
      sourceLineages: [
        createMpLineageNode({
          projectId: "proj-rax-mp-facade",
          agentId: "main",
          depth: 0,
        }),
      ],
    },
  });

  assert.equal(bootstrap.status, "bootstrapped");
  assert.equal(search.hits.length, 1);
  assert.equal(search.hits[0]?.record.sourceStoredSectionId, "stored-1");
});
