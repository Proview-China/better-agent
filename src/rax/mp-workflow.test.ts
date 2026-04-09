import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createCmpSection,
  createCmpStoredSectionFromSection,
  createMpLineageNode,
  createMpScopeDescriptor,
} from "../agent_core/index.js";
import { createRaxMpFacade } from "./mp-facade.js";

test("rax mp facade exposes workflow readback smoke ingest and resolve surfaces", async () => {
  const facade = createRaxMpFacade();
  const rootPath = await mkdtemp(join(tmpdir(), "praxis-rax-mp-workflow-"));
  const session = facade.create({
    config: {
      projectId: "proj-rax-mp-workflow",
      lance: {
        rootPath,
        liveExecutionPreferred: false,
      },
    },
  });

  await facade.bootstrap({
    session,
    payload: {
      agentIds: ["main"],
      rootPath,
    },
  });

  const storedSection = createCmpStoredSectionFromSection({
    storedSectionId: "stored-workflow",
    section: createCmpSection({
      id: "section-workflow",
      projectId: "proj-rax-mp-workflow",
      agentId: "main",
      lineagePath: ["main"],
      source: "core_agent",
      kind: "runtime_context",
      fidelity: "checked",
      payloadRefs: ["payload-workflow"],
      tags: ["sync", "workflow"],
      createdAt: "2026-04-09T00:00:00.000Z",
    }),
    plane: "postgresql",
    storageRef: "postgresql:stored-workflow",
    state: "promoted",
    visibility: "parent",
    persistedAt: "2026-04-09T00:00:00.000Z",
    metadata: {
      semanticGroupId: "semantic:workflow",
      tags: ["workflow", "sync"],
    },
  });

  const ingest = await facade.ingest({
    session,
    payload: {
      storedSection,
      checkedSnapshotRef: "snapshot-workflow",
      branchRef: "mp/main",
      scope: createMpScopeDescriptor({
        projectId: "proj-rax-mp-workflow",
        agentId: "main",
        scopeLevel: "project",
        sessionMode: "shared",
      }),
      sourceRefs: ["source:workflow"],
      observedAt: "2026-04-09T00:00:00.000Z",
    },
  });
  const resolve = await facade.resolve({
    session,
    payload: {
      queryText: "workflow sync",
      requesterLineage: createMpLineageNode({
        projectId: "proj-rax-mp-workflow",
        agentId: "main",
        depth: 0,
      }),
      sourceLineages: [
        createMpLineageNode({
          projectId: "proj-rax-mp-workflow",
          agentId: "main",
          depth: 0,
        }),
      ],
    },
  });
  const readback = await facade.readback({ session });
  const smoke = await facade.smoke({ session });

  assert.equal(ingest.status, "ingested");
  assert.equal(resolve.bundle.primary.length >= 1, true);
  assert.equal(resolve.bundle.primary[0]?.sourceStoredSectionId, "stored-workflow");
  assert.equal(readback.status, "found");
  assert.equal((readback.summary?.fiveAgentSummary.roleCounts.dispatcher ?? 0) >= 1, true);
  assert.equal(smoke.status, "ready");
});
