import assert from "node:assert/strict";
import test from "node:test";

import type {
  CommitContextDeltaInput,
  CommitContextDeltaResult,
  CmpProjectInfraBootstrapReceipt,
  CmpRuntimeInfraProjectState,
  CmpRuntimeSnapshot,
  DispatchContextPackageInput,
  DispatchContextPackageResult,
  IngestRuntimeContextInput,
  IngestRuntimeContextResult,
  MaterializeContextPackageInput,
  MaterializeContextPackageResult,
  RequestHistoricalContextInput,
  RequestHistoricalContextResult,
  ResolveCheckedSnapshotInput,
  ResolveCheckedSnapshotResult,
} from "../agent_core/index.js";
import { createRaxCmpFacade } from "./cmp-facade.js";

function createCmpRedisNamespaceFixture(projectId: string, agentId: string) {
  const keyPrefix = `cmp:${projectId}:${agentId}`;
  return {
    projectId,
    namespaceRoot: "cmp",
    keyPrefix,
    channelsPrefix: `${keyPrefix}:channel`,
    streamsPrefix: `${keyPrefix}:stream`,
    queuesPrefix: `${keyPrefix}:queue`,
    consumerGroupPrefix: `${keyPrefix}:group`,
  };
}

function createCmpLineageFixture(projectId: string, agentId: string, childAgentIds: string[] = []) {
  return {
    lineageId: `lineage-${agentId}`,
    projectId,
    agentId,
    depth: 0,
    branchFamily: {
      agentId,
      work: { kind: "work" as const, agentId, branchName: `work/${agentId}`, fullRef: `refs/heads/work/${agentId}` },
      cmp: { kind: "cmp" as const, agentId, branchName: `cmp/${agentId}`, fullRef: `refs/heads/cmp/${agentId}` },
      mp: { kind: "mp" as const, agentId, branchName: `mp/${agentId}`, fullRef: `refs/heads/mp/${agentId}` },
      tap: { kind: "tap" as const, agentId, branchName: `tap/${agentId}`, fullRef: `refs/heads/tap/${agentId}` },
    },
    childAgentIds,
    status: "active" as const,
  };
}

test("createRaxCmpFacade creates a session and delegates bootstrap/readback/recover/smoke", async () => {
  const bootstrapCalls: unknown[] = [];
  const runtime = {
    async bootstrapCmpProjectInfra(input: unknown) {
      bootstrapCalls.push(input);
      return {
        git: {
          projectRepo: {
            projectId: "proj-facade",
            repoId: "repo-1",
            repoName: "proj-facade",
            repoStrategy: "single_project_repo",
            defaultAgentId: "main",
          },
          repoRootPath: "/tmp/praxis/proj-facade",
          defaultBranchName: "main",
          createdBranchNames: ["work/main", "cmp/main", "mp/main", "tap/main"],
          status: "bootstrapped",
        },
        gitBranchBootstraps: [
          {
            agentId: "main",
            createdBranchNames: ["work/main", "cmp/main", "mp/main", "tap/main"],
          },
        ],
        db: {
          projectId: "proj-facade",
          databaseName: "cmp_proj_facade",
          schemaName: "cmp_proj_facade",
          topology: {
            projectId: "proj-facade",
            databaseName: "cmp_proj_facade",
            schemaName: "cmp_proj_facade",
            sharedTables: [],
          },
          localTableSets: [],
          bootstrapStatements: [],
          readbackStatements: [],
        },
        dbReceipt: {
          projectId: "proj-facade",
          databaseName: "cmp_proj_facade",
          schemaName: "cmp_proj_facade",
          status: "bootstrapped" as const,
          expectedTargetCount: 1,
          presentTargetCount: 1,
          readbackRecords: [],
        },
        mqBootstraps: [
          {
            projectId: "proj-facade",
            agentId: "main",
            namespace: createCmpRedisNamespaceFixture("proj-facade", "main"),
            topicBindings: [],
          },
        ],
        lineages: [
          createCmpLineageFixture("proj-facade", "main"),
        ],
        branchRuntimes: [],
      } satisfies CmpProjectInfraBootstrapReceipt;
    },
    getCmpProjectInfraBootstrapReceipt() {
      return {
        git: {
          projectRepo: {
            projectId: "proj-facade",
            repoId: "repo-1",
            repoName: "proj-facade",
            repoStrategy: "single_project_repo",
            defaultAgentId: "main",
          },
          repoRootPath: "/tmp/praxis/proj-facade",
          defaultBranchName: "main",
          createdBranchNames: ["work/main", "cmp/main", "mp/main", "tap/main"],
          status: "bootstrapped",
        },
        gitBranchBootstraps: [
          {
            agentId: "main",
            createdBranchNames: ["work/main", "cmp/main", "mp/main", "tap/main"],
          },
        ],
        db: {
          projectId: "proj-facade",
          databaseName: "cmp_proj_facade",
          schemaName: "cmp_proj_facade",
          topology: {
            projectId: "proj-facade",
            databaseName: "cmp_proj_facade",
            schemaName: "cmp_proj_facade",
            sharedTables: [],
          },
          localTableSets: [],
          bootstrapStatements: [],
          readbackStatements: [],
        },
        dbReceipt: {
          projectId: "proj-facade",
          databaseName: "cmp_proj_facade",
          schemaName: "cmp_proj_facade",
          status: "bootstrapped" as const,
          expectedTargetCount: 1,
          presentTargetCount: 1,
          readbackRecords: [],
        },
        mqBootstraps: [
          {
            projectId: "proj-facade",
            agentId: "main",
            namespace: createCmpRedisNamespaceFixture("proj-facade", "main"),
            topicBindings: [],
          },
        ],
        lineages: [
          createCmpLineageFixture("proj-facade", "main"),
        ],
        branchRuntimes: [],
      } satisfies CmpProjectInfraBootstrapReceipt;
    },
    getCmpRuntimeInfraProjectState() {
      return {
        projectId: "proj-facade",
        gitBranchBootstraps: [
          {
            agentId: "main",
            createdBranchNames: ["work/main", "cmp/main", "mp/main", "tap/main"],
          },
        ],
        dbReceipt: {
          projectId: "proj-facade",
          databaseName: "cmp_proj_facade",
          schemaName: "cmp_proj_facade",
          status: "bootstrapped",
          expectedTargetCount: 1,
          presentTargetCount: 1,
          readbackRecords: [],
        },
        mqBootstraps: [
          {
            projectId: "proj-facade",
            agentId: "main",
            namespace: createCmpRedisNamespaceFixture("proj-facade", "main"),
            topicBindings: [],
          },
        ],
        lineages: [
          {
            lineageId: "lineage-main",
            projectId: "proj-facade",
            agentId: "main",
            depth: 0,
            branchFamily: {
              agentId: "main",
              work: { kind: "work", agentId: "main", branchName: "work/main", fullRef: "refs/heads/work/main" },
              cmp: { kind: "cmp", agentId: "main", branchName: "cmp/main", fullRef: "refs/heads/cmp/main" },
              mp: { kind: "mp", agentId: "main", branchName: "mp/main", fullRef: "refs/heads/mp/main" },
              tap: { kind: "tap", agentId: "main", branchName: "tap/main", fullRef: "refs/heads/tap/main" },
            },
            childAgentIds: [],
            status: "active",
          },
        ],
        branchRuntimes: [],
        updatedAt: "2026-03-24T00:00:00.000Z",
      } satisfies CmpRuntimeInfraProjectState;
    },
    async recoverCmpRuntimeSnapshot(_snapshot: CmpRuntimeSnapshot) {
      return undefined;
    },
    async ingestRuntimeContext(_input: IngestRuntimeContextInput) {
      return {
        status: "accepted",
        acceptedEventIds: ["event-1"],
        nextAction: "commit_context_delta",
      } satisfies IngestRuntimeContextResult;
    },
    async commitContextDelta(_input: CommitContextDeltaInput) {
      return {
        status: "accepted",
        delta: {
          deltaId: "delta-1",
          agentId: "main",
          eventRefs: ["event-1"],
          changeSummary: "delta",
          createdAt: "2026-03-24T00:00:00.000Z",
          syncIntent: "local_record",
        },
      } satisfies CommitContextDeltaResult;
    },
    async resolveCheckedSnapshot(_input: ResolveCheckedSnapshotInput) {
      return {
        status: "resolved",
        found: true,
        snapshot: {
          snapshotId: "snapshot-1",
          agentId: "main",
          lineageRef: "lineage:main",
          branchRef: "refs/heads/cmp/main",
          commitRef: "cmp-commit-1",
          checkedAt: "2026-03-24T00:00:00.000Z",
          qualityLabel: "usable",
          promotable: true,
        },
      } satisfies ResolveCheckedSnapshotResult;
    },
    async materializeContextPackage(_input: MaterializeContextPackageInput) {
      return {
        status: "materialized",
        contextPackage: {
          packageId: "package-1",
          sourceProjectionId: "projection-1",
          targetAgentId: "child-1",
          packageKind: "child_seed",
          packageRef: "cmp-package:snapshot-1:child-1:child_seed",
          fidelityLabel: "checked_high_fidelity",
          createdAt: "2026-03-24T00:00:00.000Z",
        },
      } satisfies MaterializeContextPackageResult;
    },
    async dispatchContextPackage(_input: DispatchContextPackageInput) {
      return {
        status: "dispatched",
        receipt: {
          dispatchId: "dispatch-1",
          packageId: "package-1",
          sourceAgentId: "main",
          targetAgentId: "child-1",
          status: "delivered",
          deliveredAt: "2026-03-24T00:00:00.000Z",
        },
      } satisfies DispatchContextPackageResult;
    },
    async requestHistoricalContext(_input: RequestHistoricalContextInput) {
      return {
        status: "not_found",
        found: false,
      } satisfies RequestHistoricalContextResult;
    },
  };

  const cmp = createRaxCmpFacade();
  const session = cmp.create({
    config: {
      projectId: "proj-facade",
      git: {
        provider: "shared_git_infra" as const,
        repoName: "proj-facade",
        repoRootPath: "/tmp/praxis/proj-facade",
        defaultBranchName: "main",
      },
    },
    runtime,
  });

  const bootstrap = await cmp.bootstrap({
    session,
    payload: {
      agents: [{ agentId: "main", depth: 0 }],
    },
  });
  const readback = await cmp.readback({ session });
  const smoke = await cmp.smoke({ session });

  assert.equal(session.projectId, "proj-facade");
  assert.equal(bootstrap.status, "bootstrapped");
  assert.equal(bootstrapCalls.length, 1);
  assert.equal(readback.status, "found");
  assert.equal(readback.summary?.status, "ready");
  assert.equal(smoke.status, "ready");
  assert.equal(smoke.checks.length, 6);
});

test("createRaxCmpFacade delegates ingest commit and requestHistory to runtime", async () => {
  const calls: string[] = [];
  const runtime = {
    async bootstrapCmpProjectInfra() {
      throw new Error("not used");
    },
    getCmpProjectInfraBootstrapReceipt() {
      return undefined;
    },
    async recoverCmpRuntimeSnapshot() {
      return undefined;
    },
    async ingestRuntimeContext(_input: IngestRuntimeContextInput) {
      calls.push("ingest");
      return {
        status: "accepted",
        acceptedEventIds: ["event-1"],
        nextAction: "commit_context_delta",
      } satisfies IngestRuntimeContextResult;
    },
    async commitContextDelta(_input: CommitContextDeltaInput) {
      calls.push("commit");
      return {
        status: "accepted",
        delta: {
          deltaId: "delta-1",
          agentId: "main",
          eventRefs: ["event-1"],
          changeSummary: "delta",
          createdAt: "2026-03-24T00:00:00.000Z",
          syncIntent: "local_record",
        },
      } satisfies CommitContextDeltaResult;
    },
    async resolveCheckedSnapshot(_input: ResolveCheckedSnapshotInput) {
      calls.push("resolve");
      return {
        status: "resolved",
        found: true,
        snapshot: {
          snapshotId: "snapshot-1",
          agentId: "main",
          lineageRef: "lineage:main",
          branchRef: "refs/heads/cmp/main",
          commitRef: "cmp-commit-1",
          checkedAt: "2026-03-24T00:00:00.000Z",
          qualityLabel: "usable",
          promotable: true,
        },
      } satisfies ResolveCheckedSnapshotResult;
    },
    async materializeContextPackage(_input: MaterializeContextPackageInput) {
      calls.push("materialize");
      return {
        status: "materialized",
        contextPackage: {
          packageId: "package-1",
          sourceProjectionId: "projection-1",
          targetAgentId: "child-1",
          packageKind: "child_seed",
          packageRef: "cmp-package:snapshot-1:child-1:child_seed",
          fidelityLabel: "checked_high_fidelity",
          createdAt: "2026-03-24T00:00:00.000Z",
        },
      } satisfies MaterializeContextPackageResult;
    },
    async dispatchContextPackage(_input: DispatchContextPackageInput) {
      calls.push("dispatch");
      return {
        status: "dispatched",
        receipt: {
          dispatchId: "dispatch-1",
          packageId: "package-1",
          sourceAgentId: "main",
          targetAgentId: "child-1",
          status: "delivered",
          deliveredAt: "2026-03-24T00:00:00.000Z",
        },
      } satisfies DispatchContextPackageResult;
    },
    async requestHistoricalContext(_input: RequestHistoricalContextInput) {
      calls.push("history");
      return {
        status: "not_found",
        found: false,
      } satisfies RequestHistoricalContextResult;
    },
  };

  const cmp = createRaxCmpFacade();
  const session = cmp.create({
    config: {
      projectId: "proj-facade-2",
      git: {
        provider: "shared_git_infra" as const,
        repoName: "proj-facade-2",
        repoRootPath: "/tmp/praxis/proj-facade-2",
        defaultBranchName: "main",
      },
    },
    runtime,
  });

  await cmp.ingest({
    session,
    payload: {
      agentId: "main",
      sessionId: "s1",
      lineage: {
        agentId: "main",
        projectId: "proj-facade-2",
        depth: 0,
        branchFamily: {
          workBranch: "work/main",
          cmpBranch: "cmp/main",
          mpBranch: "mp/main",
          tapBranch: "tap/main",
        },
        status: "active",
      },
      taskSummary: "ingest",
      materials: [
        {
          kind: "user_input",
          ref: "ctx:1",
        },
      ],
    },
  });
  await cmp.commit({
    session,
    payload: {
      agentId: "main",
      sessionId: "s1",
      eventIds: ["event-1"],
      changeSummary: "delta",
      syncIntent: "local_record",
    },
  });
  await cmp.resolve({
    session,
    payload: {
      agentId: "main",
      projectId: "proj-facade-2",
    },
  });
  await cmp.materialize({
    session,
    payload: {
      agentId: "main",
      snapshotId: "snapshot-1",
      targetAgentId: "child-1",
      packageKind: "child_seed",
    },
  });
  await cmp.dispatch({
    session,
    payload: {
      agentId: "main",
      packageId: "package-1",
      sourceAgentId: "main",
      targetAgentId: "child-1",
      targetKind: "child",
    },
  });
  await cmp.requestHistory({
    session,
    payload: {
      requesterAgentId: "main",
      projectId: "proj-facade-2",
      reason: "history",
      query: {},
    },
  });

  assert.deepEqual(calls, ["ingest", "commit", "resolve", "materialize", "dispatch", "history"]);
});

test("createRaxCmpFacade readback and smoke degrade when DB readback or lineage coverage is incomplete", async () => {
  const runtime = {
    async bootstrapCmpProjectInfra() {
      throw new Error("not used");
    },
    getCmpProjectInfraBootstrapReceipt() {
      return {
        git: {
          projectRepo: {
            projectId: "proj-facade-3",
            repoId: "repo-3",
            repoName: "proj-facade-3",
            repoStrategy: "single_project_repo",
            defaultAgentId: "main",
          },
          repoRootPath: "/tmp/praxis/proj-facade-3",
          defaultBranchName: "main",
          createdBranchNames: ["work/main", "cmp/main", "mp/main", "tap/main"],
          status: "already_exists" as const,
        },
        gitBranchBootstraps: [
          {
            agentId: "main",
            createdBranchNames: ["work/main", "cmp/main", "mp/main", "tap/main"],
          },
        ],
        db: {
          projectId: "proj-facade-3",
          databaseName: "cmp_proj_facade_3",
          schemaName: "cmp_proj_facade_3",
          topology: {
            projectId: "proj-facade-3",
            databaseName: "cmp_proj_facade_3",
            schemaName: "cmp_proj_facade_3",
            sharedTables: [],
          },
          localTableSets: [],
          bootstrapStatements: [],
          readbackStatements: [],
        },
        dbReceipt: {
          projectId: "proj-facade-3",
          databaseName: "cmp_proj_facade_3",
          schemaName: "cmp_proj_facade_3",
          status: "readback_incomplete" as const,
          expectedTargetCount: 3,
          presentTargetCount: 1,
          readbackRecords: [],
        },
        mqBootstraps: [
          {
            projectId: "proj-facade-3",
            agentId: "main",
            namespace: createCmpRedisNamespaceFixture("proj-facade-3", "main"),
            topicBindings: [],
          },
        ],
        lineages: [
          {
            lineageId: "lineage-main",
            projectId: "proj-facade-3",
            agentId: "main",
            depth: 0,
            branchFamily: {
              agentId: "main",
              work: { kind: "work", agentId: "main", branchName: "work/main", fullRef: "refs/heads/work/main" },
              cmp: { kind: "cmp", agentId: "main", branchName: "cmp/main", fullRef: "refs/heads/cmp/main" },
              mp: { kind: "mp", agentId: "main", branchName: "mp/main", fullRef: "refs/heads/mp/main" },
              tap: { kind: "tap", agentId: "main", branchName: "tap/main", fullRef: "refs/heads/tap/main" },
            },
            childAgentIds: ["child-a"],
            status: "active",
          },
          {
            lineageId: "lineage-child-a",
            projectId: "proj-facade-3",
            agentId: "child-a",
            parentAgentId: "main",
            depth: 1,
            branchFamily: {
              agentId: "child-a",
              work: { kind: "work", agentId: "child-a", branchName: "work/child-a", fullRef: "refs/heads/work/child-a" },
              cmp: { kind: "cmp", agentId: "child-a", branchName: "cmp/child-a", fullRef: "refs/heads/cmp/child-a" },
              mp: { kind: "mp", agentId: "child-a", branchName: "mp/child-a", fullRef: "refs/heads/mp/child-a" },
              tap: { kind: "tap", agentId: "child-a", branchName: "tap/child-a", fullRef: "refs/heads/tap/child-a" },
            },
            childAgentIds: [],
            status: "active",
          },
        ],
        branchRuntimes: [],
      } satisfies CmpProjectInfraBootstrapReceipt;
    },
    getCmpRuntimeInfraProjectState() {
      return {
        projectId: "proj-facade-3",
        gitBranchBootstraps: [
          {
            agentId: "main",
            createdBranchNames: ["work/main", "cmp/main", "mp/main", "tap/main"],
          },
        ],
        dbReceipt: {
          projectId: "proj-facade-3",
          databaseName: "cmp_proj_facade_3",
          schemaName: "cmp_proj_facade_3",
          status: "readback_incomplete" as const,
          expectedTargetCount: 3,
          presentTargetCount: 1,
          readbackRecords: [],
        },
        mqBootstraps: [
          {
            projectId: "proj-facade-3",
            agentId: "main",
            namespace: createCmpRedisNamespaceFixture("proj-facade-3", "main"),
            topicBindings: [],
          },
        ],
        lineages: [
          createCmpLineageFixture("proj-facade-3", "main", ["child-a"]),
        ],
        branchRuntimes: [],
        updatedAt: "2026-03-25T00:00:00.000Z",
      } satisfies CmpRuntimeInfraProjectState;
    },
    async recoverCmpRuntimeSnapshot() {
      return undefined;
    },
    async ingestRuntimeContext() {
      throw new Error("not used");
    },
    async commitContextDelta() {
      throw new Error("not used");
    },
    async resolveCheckedSnapshot() {
      throw new Error("not used");
    },
    async materializeContextPackage() {
      throw new Error("not used");
    },
    async dispatchContextPackage() {
      throw new Error("not used");
    },
    async requestHistoricalContext() {
      throw new Error("not used");
    },
  };

  const cmp = createRaxCmpFacade();
  const session = cmp.create({
    config: {
      projectId: "proj-facade-3",
      git: {
        provider: "shared_git_infra" as const,
        repoName: "proj-facade-3",
        repoRootPath: "/tmp/praxis/proj-facade-3",
        defaultBranchName: "main",
      },
    },
    runtime,
  });

  const readback = await cmp.readback({ session });
  const smoke = await cmp.smoke({ session });

  assert.equal(readback.status, "found");
  assert.equal(readback.summary?.status, "degraded");
  assert.deepEqual(readback.summary?.issues, [
    "CMP DB bootstrap readback is incomplete.",
    "CMP hydrated lineage coverage is incomplete.",
    "CMP git branch bootstrap coverage is incomplete.",
    "CMP mq bootstrap coverage is incomplete.",
  ]);
  assert.equal(smoke.status, "degraded");
  assert.equal(smoke.checks.find((check) => check.id === "cmp.db.readback")?.status, "degraded");
  assert.equal(smoke.checks.find((check) => check.id === "cmp.lineage.coverage")?.status, "degraded");
});
