import assert from "node:assert/strict";
import test from "node:test";

import {
  createCmpSection,
  createCmpStoredSectionFromSection,
  createMpLineageNode,
  createMpScopeDescriptor,
} from "../agent_core/index.js";
import { createRaxMpFacade } from "./mp-facade.js";
import type { RaxMpRuntimeLike } from "./mp-types.js";

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

test("createRaxMpFacade can route native memory for core and keep routing readback", async () => {
  const facade = createRaxMpFacade();
  const session = facade.create({
    config: {
      projectId: "proj-rax-mp-route",
      lance: {
        rootPath: "/tmp/praxis/proj-rax-mp-route",
        liveExecutionPreferred: false,
      },
    },
  });

  const section = createCmpSection({
    id: "section-route",
    projectId: "proj-rax-mp-route",
    agentId: "main",
    lineagePath: ["main"],
    source: "core_agent",
    kind: "runtime_context",
    fidelity: "checked",
    payloadRefs: ["payload-route"],
    tags: ["routing"],
    createdAt: "2026-04-08T00:00:00.000Z",
  });
  const storedSection = createCmpStoredSectionFromSection({
    storedSectionId: "stored-route",
    section,
    plane: "postgresql",
    storageRef: "postgresql:stored-route",
    state: "promoted",
    visibility: "parent",
    persistedAt: "2026-04-08T00:00:01.000Z",
  });

  await facade.bootstrap({
    session,
    payload: {
      agentIds: ["main"],
    },
  });
  await facade.ingest({
    session,
    payload: {
      storedSection,
      checkedSnapshotRef: "snapshot-route",
      branchRef: "mp/main",
      scope: createMpScopeDescriptor({
        projectId: "proj-rax-mp-route",
        agentId: "main",
        scopeLevel: "project",
        sessionMode: "shared",
      }),
      confidence: "high",
      metadata: {
        candidateSource: "cmp",
      },
    },
  });

  const routed = await facade.routeForCore({
    session,
    payload: {
      queryText: "stored-route",
      currentObjective: "继续 routing 设计",
      requesterLineage: createMpLineageNode({
        projectId: "proj-rax-mp-route",
        agentId: "main",
        depth: 0,
      }),
      sourceLineages: [
        createMpLineageNode({
          projectId: "proj-rax-mp-route",
          agentId: "main",
          depth: 0,
        }),
      ],
      governanceSignals: {
        cmpRouteRationale: "core worksite return",
      },
    },
  });

  const readback = facade.getRoutingReadback(session);
  assert.equal(routed.routeKind, "resolve");
  assert.equal(routed.primaryRecords.length, 1);
  assert.equal(readback?.routeKind, "resolve");
  assert.equal(readback?.primaryMemoryRefs[0], routed.primaryRecords[0]?.memoryId);
});

test("createRaxMpFacade uses objective and governance signals in routing discipline", async () => {
  let receivedQueryText = "";
  const facade = createRaxMpFacade({
    runtimeFactory() {
      return {
        bootstrapProject() {
          return {
            projectId: "proj-rax-mp-discipline",
            openedTableCount: 0,
            tableNames: [],
            rootPath: "/tmp/praxis/proj-rax-mp-discipline",
          };
        },
        materializeStoredSection() {
          return [];
        },
        materializeStoredSectionBatch() {
          return [];
        },
        search() {
          return { hits: [] };
        },
        archiveMemory() {
          return undefined;
        },
        promoteMemory() {
          throw new Error("not used");
        },
        splitMemory() {
          return [];
        },
        mergeMemories() {
          throw new Error("not used");
        },
        reindexMemory() {
          throw new Error("not used");
        },
        compactSemanticGroup() {
          return [];
        },
        ingestMemoryWorkflow() {
          throw new Error("not used");
        },
        alignMemoryWorkflow() {
          throw new Error("not used");
        },
        resolveMemoryWorkflow(input: any) {
          receivedQueryText = input.queryText;
          return {
            status: "resolved",
            bundle: {
              scope: createMpScopeDescriptor({
                projectId: "proj-rax-mp-discipline",
                agentId: "main",
                scopeLevel: "project",
                sessionMode: "shared",
              }),
              primary: [{
                memoryId: "memory-stale",
                projectId: "proj-rax-mp-discipline",
                agentId: "main",
                sessionId: "session-1",
                scopeLevel: "project",
                sessionMode: "shared",
                visibilityState: "project_shared",
                promotionState: "promoted_to_project",
                lineagePath: ["main"],
                semanticGroupId: "route-mismatch",
                sourceRefs: ["misc"],
                memoryKind: "summary",
                confidence: "low",
                freshness: { status: "stale", reason: "older" },
                alignment: { alignmentStatus: "unreviewed" },
                tags: ["misc"],
                createdAt: "2026-04-16T00:00:00.000Z",
                updatedAt: "2026-04-16T00:00:00.000Z",
              }],
              supporting: [{
                memoryId: "memory-fresh",
                projectId: "proj-rax-mp-discipline",
                agentId: "main",
                sessionId: "session-1",
                scopeLevel: "project",
                sessionMode: "shared",
                visibilityState: "project_shared",
                promotionState: "promoted_to_project",
                lineagePath: ["main"],
                semanticGroupId: "payment-refactor",
                sourceRefs: ["core worksite return"],
                bodyRef: "payment-refactor",
                memoryKind: "summary",
                confidence: "high",
                freshness: { status: "fresh", reason: "latest" },
                alignment: { alignmentStatus: "aligned" },
                tags: ["payment"],
                createdAt: "2026-04-16T00:00:00.000Z",
                updatedAt: "2026-04-16T00:00:00.000Z",
              }],
              diagnostics: {
                omittedSupersededMemoryIds: [],
                rerankComposition: {
                  fresh: 1,
                  aging: 0,
                  stale: 1,
                  superseded: 0,
                  aligned: 1,
                  unreviewed: 1,
                  drifted: 0,
                },
              },
            },
            summary: {} as never,
          };
        },
        requestMemoryHistory() {
          throw new Error("not used");
        },
        getMpManagedRecords() {
          return [];
        },
      } as unknown as RaxMpRuntimeLike;
    },
  });
  const session = facade.create({
    config: {
      projectId: "proj-rax-mp-discipline",
      lance: {
        rootPath: "/tmp/praxis/proj-rax-mp-discipline",
        liveExecutionPreferred: false,
      },
    },
  });

  const routed = await facade.routeForCore({
    session,
    payload: {
      queryText: "payment refactor",
      currentObjective: "continue payment refactor",
      requesterLineage: createMpLineageNode({
        projectId: "proj-rax-mp-discipline",
        agentId: "main",
        depth: 0,
      }),
      sourceLineages: [
        createMpLineageNode({
          projectId: "proj-rax-mp-discipline",
          agentId: "main",
          depth: 0,
        }),
      ],
      governanceSignals: {
        cmpRouteRationale: "core worksite return",
        freshnessHint: "fresh",
        confidenceHint: "high",
      },
    },
  });

  assert.match(receivedQueryText, /continue payment refactor/);
  assert.match(receivedQueryText, /core worksite return/);
  assert.equal(routed.primaryRecords[0]?.memoryId, "memory-fresh");
});

test("createRaxMpFacade can materialize from CMP candidates through ingest workflow", async () => {
  const facade = createRaxMpFacade();
  const session = facade.create({
    config: {
      projectId: "proj-rax-mp-cmp-candidates",
      lance: {
        rootPath: "/tmp/praxis/proj-rax-mp-cmp-candidates",
        liveExecutionPreferred: false,
      },
    },
  });

  await facade.bootstrap({
    session,
    payload: {
      agentIds: ["main"],
    },
  });

  const section = createCmpSection({
    id: "section-candidate",
    projectId: "proj-rax-mp-cmp-candidates",
    agentId: "main",
    lineagePath: ["main"],
    source: "core_agent",
    kind: "runtime_context",
    fidelity: "checked",
    payloadRefs: ["payload-candidate"],
    tags: ["cmp-candidate"],
    createdAt: "2026-04-08T00:00:00.000Z",
  });
  const storedSection = createCmpStoredSectionFromSection({
    storedSectionId: "stored-candidate",
    section,
    plane: "postgresql",
    storageRef: "postgresql:stored-candidate",
    state: "promoted",
    visibility: "parent",
    persistedAt: "2026-04-08T00:00:01.000Z",
  });

  const result = await facade.materializeFromCmpCandidates({
    session,
    payload: {
      candidates: [
        {
          storedSection,
          checkedSnapshotRef: "snapshot-candidate",
          branchRef: "mp/main",
          scope: createMpScopeDescriptor({
            projectId: "proj-rax-mp-cmp-candidates",
            agentId: "main",
            scopeLevel: "project",
            sessionMode: "shared",
          }),
          confidence: "high",
        },
      ],
    },
  });

  assert.equal(result.status, "materialized_from_cmp_candidates");
  assert.equal(result.records.length, 1);
});
