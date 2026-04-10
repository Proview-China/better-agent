import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createAgentCapabilityProfile,
  createAgentCoreRuntime,
  createCmpSection,
  createCmpStoredSectionFromSection,
  createGoalSource,
  createMpLineageNode,
  createMpMemoryRecordFromStoredSection,
  createMpScopeDescriptor,
} from "./index.js";
import type { CapabilityCallIntent } from "./index.js";
import { createRaxMpFacade } from "../rax/index.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createMpRuntimeFixture(input: {
  baselineCapabilities: string[];
  goalId: string;
  userInput: string;
}) {
  const runtime = createAgentCoreRuntime({
    taProfile: createAgentCapabilityProfile({
      profileId: `profile.${input.goalId}`,
      agentClass: "main-agent",
      baselineCapabilities: input.baselineCapabilities,
    }),
  });
  const session = runtime.createSession();
  const goal = runtime.createCompiledGoal(
    createGoalSource({
      goalId: input.goalId,
      sessionId: session.sessionId,
      userInput: input.userInput,
    }),
  );
  const created = await runtime.createRun({
    sessionId: session.sessionId,
    goal,
  });

  return {
    runtime,
    session,
    runId: created.run.runId,
  };
}

async function dispatchMpCapability(input: {
  runtime: ReturnType<typeof createAgentCoreRuntime>;
  sessionId: string;
  runId: string;
  capabilityKey: string;
  requestId: string;
  payload: Record<string, unknown>;
}) {
  const intent: CapabilityCallIntent = {
    intentId: `${input.requestId}:intent`,
    sessionId: input.sessionId,
    runId: input.runId,
    kind: "capability_call",
    createdAt: "2026-04-08T00:00:00.000Z",
    priority: "high",
    request: {
      requestId: input.requestId,
      intentId: `${input.requestId}:intent`,
      sessionId: input.sessionId,
      runId: input.runId,
      capabilityKey: input.capabilityKey,
      input: input.payload,
      priority: "high",
    },
  };

  const dispatched = await input.runtime.dispatchCapabilityIntentViaTaPool(intent, {
    agentId: "agent-main",
    requestedTier: "B1",
    mode: "standard",
    reason: `Dispatch ${input.capabilityKey} through default MP workflow.`,
  });

  assert.equal(dispatched.status, "dispatched");
  assert.equal(dispatched.grant?.capabilityKey, input.capabilityKey);
  return dispatched;
}

async function createSearchFacadeSession(input: {
  projectId: string;
  rootPath: string;
  agentIds: string[];
}) {
  const facade = createRaxMpFacade();
  const session = facade.create({
    config: {
      projectId: input.projectId,
      lance: {
        rootPath: input.rootPath,
        liveExecutionPreferred: false,
      },
    },
  });
  await facade.bootstrap({
    session,
    payload: {
      projectId: input.projectId,
      rootPath: input.rootPath,
      agentIds: input.agentIds,
    },
  });

  return {
    facade,
    session,
  };
}

test("mp workflow can materialize through TAP and then return a search hit through rax.mp", async () => {
  const projectId = "project.mp.workflow.materialize";
  const rootPath = await mkdtemp(join(tmpdir(), "praxis-mp-workflow-materialize-"));
  const { runtime, session, runId } = await createMpRuntimeFixture({
    baselineCapabilities: ["mp.materialize"],
    goalId: "goal-mp-materialize-workflow",
    userInput: "Materialize MP memory through the default workflow.",
  });

  const section = createCmpSection({
    id: "section-materialize",
    projectId,
    agentId: "main",
    lineagePath: ["main"],
    source: "core_agent",
    kind: "runtime_context",
    fidelity: "checked",
    payloadRefs: ["payload-materialize"],
    tags: [],
    createdAt: "2026-04-08T00:00:00.000Z",
  });
  const storedSection = createCmpStoredSectionFromSection({
    storedSectionId: "stored-materialize",
    section,
    plane: "postgresql",
    storageRef: "postgresql:stored-materialize",
    persistedAt: "2026-04-08T00:00:01.000Z",
  });

  await dispatchMpCapability({
    runtime,
    sessionId: session.sessionId,
    runId,
    capabilityKey: "mp.materialize",
    requestId: "request-mp-materialize-1",
    payload: {
      projectId,
      rootPath,
      agentIds: ["main"],
      storedSection,
      checkedSnapshotRef: "snapshot-materialize",
      branchRef: "mp/main",
      scope: createMpScopeDescriptor({
        projectId,
        agentId: "main",
        scopeLevel: "project",
        sessionMode: "shared",
      }),
    },
  });

  await sleep(50);

  const { facade, session: searchSession } = await createSearchFacadeSession({
    projectId,
    rootPath,
    agentIds: ["main"],
  });
  const result = await facade.search({
    session: searchSession,
    payload: {
      queryText: "stored materialize",
      requesterLineage: createMpLineageNode({
        projectId,
        agentId: "main",
        depth: 0,
      }),
      sourceLineages: [
        createMpLineageNode({
          projectId,
          agentId: "main",
          depth: 0,
        }),
      ],
    },
  });

  assert.equal(result.hits.length, 1);
  assert.equal(result.hits[0]?.record.sourceStoredSectionId, "stored-materialize");
});

test("mp workflow promote changes parent visibility in subsequent search", async () => {
  const projectId = "project.mp.workflow.promote";
  const rootPath = await mkdtemp(join(tmpdir(), "praxis-mp-workflow-promote-"));
  const { runtime, session, runId } = await createMpRuntimeFixture({
    baselineCapabilities: ["mp.materialize", "mp.promote"],
    goalId: "goal-mp-promote-workflow",
    userInput: "Promote MP memory through the default workflow.",
  });

  const section = createCmpSection({
    id: "section-promote",
    projectId,
    agentId: "child",
    lineagePath: ["root", "child"],
    source: "core_agent",
    kind: "runtime_context",
    fidelity: "checked",
    payloadRefs: ["payload-promote"],
    tags: [],
    createdAt: "2026-04-08T00:00:00.000Z",
  });
  const storedSection = createCmpStoredSectionFromSection({
    storedSectionId: "stored-promote",
    section,
    plane: "postgresql",
    storageRef: "postgresql:stored-promote",
    persistedAt: "2026-04-08T00:00:01.000Z",
  });
  const scope = createMpScopeDescriptor({
    projectId,
    agentId: "child",
    scopeLevel: "agent_isolated",
    sessionMode: "isolated",
  });

  await dispatchMpCapability({
    runtime,
    sessionId: session.sessionId,
    runId,
    capabilityKey: "mp.materialize",
    requestId: "request-mp-promote-materialize-1",
    payload: {
      projectId,
      rootPath,
      agentIds: ["root", "child"],
      storedSection,
      checkedSnapshotRef: "snapshot-promote",
      branchRef: "mp/child",
      scope,
    },
  });
  await sleep(50);

  const { facade, session: searchSession } = await createSearchFacadeSession({
    projectId,
    rootPath,
    agentIds: ["root", "child"],
  });
  const beforePromotion = await facade.search({
    session: searchSession,
    payload: {
      queryText: "stored promote",
      requesterLineage: createMpLineageNode({
        projectId,
        agentId: "root",
        depth: 0,
      }),
      sourceLineages: [
        createMpLineageNode({
          projectId,
          agentId: "root",
          depth: 0,
        }),
        createMpLineageNode({
          projectId,
          agentId: "child",
          parentAgentId: "root",
          depth: 1,
        }),
      ],
    },
  });
  assert.equal(beforePromotion.hits.length, 0);

  const memory = createMpMemoryRecordFromStoredSection({
    storedSection,
    checkedSnapshotRef: "snapshot-promote",
    branchRef: "mp/child",
    scope,
  });

  const promoteRun = await createMpRuntimeFixture({
    baselineCapabilities: ["mp.materialize", "mp.promote"],
    goalId: "goal-mp-promote-followup",
    userInput: "Promote MP memory in a follow-up workflow step.",
  });

  await dispatchMpCapability({
    runtime: promoteRun.runtime,
    sessionId: promoteRun.session.sessionId,
    runId: promoteRun.runId,
    capabilityKey: "mp.promote",
    requestId: "request-mp-promote-1",
    payload: {
      projectId,
      rootPath,
      agentIds: ["root", "child"],
      memory,
      owner: createMpLineageNode({
        projectId,
        agentId: "child",
        parentAgentId: "root",
        depth: 1,
      }),
      promoter: createMpLineageNode({
        projectId,
        agentId: "root",
        depth: 0,
      }),
      nextScopeLevel: "project",
      promotedAt: "2026-04-08T00:00:02.000Z",
    },
  });
  await sleep(50);

  const afterPromotion = await facade.search({
    session: searchSession,
    payload: {
      queryText: "stored promote",
      requesterLineage: createMpLineageNode({
        projectId,
        agentId: "root",
        depth: 0,
      }),
      sourceLineages: [
        createMpLineageNode({
          projectId,
          agentId: "root",
          depth: 0,
        }),
        createMpLineageNode({
          projectId,
          agentId: "child",
          parentAgentId: "root",
          depth: 1,
        }),
      ],
    },
  });

  assert.equal(afterPromotion.hits.length, 1);
  assert.equal(afterPromotion.hits[0]?.record.scopeLevel, "project");
});

test("mp workflow archive removes a project-scoped record from subsequent search", async () => {
  const projectId = "project.mp.workflow.archive";
  const rootPath = await mkdtemp(join(tmpdir(), "praxis-mp-workflow-archive-"));
  const { runtime, session, runId } = await createMpRuntimeFixture({
    baselineCapabilities: ["mp.materialize", "mp.archive"],
    goalId: "goal-mp-archive-workflow",
    userInput: "Archive MP memory through the default workflow.",
  });

  const section = createCmpSection({
    id: "section-archive",
    projectId,
    agentId: "main",
    lineagePath: ["main"],
    source: "core_agent",
    kind: "runtime_context",
    fidelity: "checked",
    payloadRefs: ["payload-archive"],
    tags: [],
    createdAt: "2026-04-08T00:00:00.000Z",
  });
  const storedSection = createCmpStoredSectionFromSection({
    storedSectionId: "stored-archive",
    section,
    plane: "postgresql",
    storageRef: "postgresql:stored-archive",
    persistedAt: "2026-04-08T00:00:01.000Z",
  });

  await dispatchMpCapability({
    runtime,
    sessionId: session.sessionId,
    runId,
    capabilityKey: "mp.materialize",
    requestId: "request-mp-archive-materialize-1",
    payload: {
      projectId,
      rootPath,
      agentIds: ["main"],
      storedSection,
      checkedSnapshotRef: "snapshot-archive",
      branchRef: "mp/main",
      scope: createMpScopeDescriptor({
        projectId,
        agentId: "main",
        scopeLevel: "project",
        sessionMode: "shared",
      }),
    },
  });
  await sleep(50);

  const { facade, session: searchSession } = await createSearchFacadeSession({
    projectId,
    rootPath,
    agentIds: ["main"],
  });
  const beforeArchive = await facade.search({
    session: searchSession,
    payload: {
      queryText: "stored archive",
      requesterLineage: createMpLineageNode({
        projectId,
        agentId: "main",
        depth: 0,
      }),
      sourceLineages: [
        createMpLineageNode({
          projectId,
          agentId: "main",
          depth: 0,
        }),
      ],
    },
  });
  assert.equal(beforeArchive.hits.length, 1);

  const archiveRun = await createMpRuntimeFixture({
    baselineCapabilities: ["mp.materialize", "mp.archive"],
    goalId: "goal-mp-archive-followup",
    userInput: "Archive MP memory in a follow-up workflow step.",
  });

  await dispatchMpCapability({
    runtime: archiveRun.runtime,
    sessionId: archiveRun.session.sessionId,
    runId: archiveRun.runId,
    capabilityKey: "mp.archive",
    requestId: "request-mp-archive-1",
    payload: {
      projectId,
      rootPath,
      agentIds: ["main"],
      agentId: "main",
      scopeLevel: "project",
      memoryId: "memory:stored-archive",
      archivedAt: "2026-04-08T00:00:02.000Z",
    },
  });
  await sleep(50);

  const afterArchive = await facade.search({
    session: searchSession,
    payload: {
      queryText: "stored archive",
      requesterLineage: createMpLineageNode({
        projectId,
        agentId: "main",
        depth: 0,
      }),
      sourceLineages: [
        createMpLineageNode({
          projectId,
          agentId: "main",
          depth: 0,
        }),
      ],
    },
  });

  assert.equal(afterArchive.hits.length, 0);
});

test("mp workflow can ingest through TAP workflow capability and resolve fresher memory through rax.mp", async () => {
  const projectId = "project.mp.workflow.ingest";
  const rootPath = await mkdtemp(join(tmpdir(), "praxis-mp-workflow-ingest-"));
  const { runtime, session, runId } = await createMpRuntimeFixture({
    baselineCapabilities: ["mp.ingest", "mp.resolve"],
    goalId: "goal-mp-ingest-workflow",
    userInput: "Ingest and resolve MP memory through the workflow entry.",
  });

  const section = createCmpSection({
    id: "section-ingest",
    projectId,
    agentId: "main",
    lineagePath: ["main"],
    source: "core_agent",
    kind: "runtime_context",
    fidelity: "checked",
    payloadRefs: ["payload-ingest"],
    tags: ["sync", "status"],
    createdAt: "2026-04-09T00:00:00.000Z",
  });
  const storedSection = createCmpStoredSectionFromSection({
    storedSectionId: "stored-ingest",
    section,
    plane: "postgresql",
    storageRef: "postgresql:stored-ingest",
    state: "promoted",
    visibility: "parent",
    persistedAt: "2026-04-09T00:00:01.000Z",
    metadata: {
      semanticGroupId: "semantic:ingest:sync",
      tags: ["sync", "status"],
    },
  });

  await dispatchMpCapability({
    runtime,
    sessionId: session.sessionId,
    runId,
    capabilityKey: "mp.ingest",
    requestId: "request-mp-ingest-1",
    payload: {
      projectId,
      rootPath,
      agentIds: ["main"],
      storedSection,
      checkedSnapshotRef: "snapshot-ingest",
      branchRef: "mp/main",
      sourceRefs: ["source:sync-status"],
      scope: createMpScopeDescriptor({
        projectId,
        agentId: "main",
        scopeLevel: "project",
        sessionMode: "shared",
      }),
    },
  });

  await sleep(50);

  const { facade, session: searchSession } = await createSearchFacadeSession({
    projectId,
    rootPath,
    agentIds: ["main"],
  });
  const resolved = await facade.resolve({
    session: searchSession,
    payload: {
      queryText: "sync status",
      requesterLineage: createMpLineageNode({
        projectId,
        agentId: "main",
        depth: 0,
      }),
      sourceLineages: [
        createMpLineageNode({
          projectId,
          agentId: "main",
          depth: 0,
        }),
      ],
    },
  });

  assert.equal(resolved.bundle.primary.length, 1);
  assert.equal(resolved.bundle.primary[0]?.sourceStoredSectionId, "stored-ingest");
});
