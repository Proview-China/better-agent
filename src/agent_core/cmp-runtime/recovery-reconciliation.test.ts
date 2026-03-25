import assert from "node:assert/strict";
import test from "node:test";

import { createAgentLineage, createCmpBranchFamily } from "../cmp-types/index.js";
import {
  createCmpGitAgentBranchRuntime,
  createCmpGitLineageNode,
  createCmpGitProjectRepo,
} from "../cmp-git/index.js";
import { createCmpRedisProjectBootstrap } from "../cmp-mq/index.js";
import { createCmpRuntimeInfraProjectState } from "./infra-state.js";
import {
  CMP_RECOVERY_RECONCILIATION_STATUSES,
  type CmpRecoveryReconciliationRecord,
  getCmpRecoveryReconciliationRecord,
  planCmpHistoricalFallback,
  reconcileCmpRuntimeSnapshotWithInfraProjects,
  summarizeCmpRecoveryReconciliation,
} from "./recovery-reconciliation.js";
import {
  getCmpRuntimeRecoveryReconciliation,
  hydrateCmpRuntimeSnapshotWithReconciliation,
} from "./runtime-recovery.js";
import { createCmpRuntimeSnapshot } from "./runtime-snapshot.js";

test("cmp recovery reconciliation can compare snapshot projects with infra projects", () => {
  const repo = createCmpGitProjectRepo({
    projectId: "proj-reconcile",
    repoName: "proj-reconcile",
  });
  const gitLineage = createCmpGitLineageNode({
    projectId: "proj-reconcile",
    agentId: "main",
  });
  const branchRuntime = createCmpGitAgentBranchRuntime({
    projectRepo: repo,
    lineage: gitLineage,
    repoRootPath: "/tmp/praxis/proj-reconcile",
  });
  const project = createCmpRuntimeInfraProjectState({
    projectId: "proj-reconcile",
    git: undefined,
    gitBranchBootstraps: [],
    branchRuntimes: [branchRuntime],
    db: undefined,
    dbReceipt: undefined,
    mqBootstraps: [createCmpRedisProjectBootstrap({
      projectId: "proj-reconcile",
      agentId: "main",
    })],
    lineages: [gitLineage],
    updatedAt: "2026-03-25T00:00:00.000Z",
  });
  const snapshot = createCmpRuntimeSnapshot({
    projectRepos: [repo],
    lineages: [createAgentLineage({
      agentId: "main",
      projectId: "proj-reconcile",
      depth: 0,
      branchFamily: createCmpBranchFamily({
        workBranch: "work/main",
        cmpBranch: "cmp/main",
        mpBranch: "mp/main",
        tapBranch: "tap/main",
      }),
    })],
  });

  const reconciled = reconcileCmpRuntimeSnapshotWithInfraProjects({
    snapshot,
    projects: [project],
  });

  assert.equal(reconciled.length, 1);
  assert.equal(reconciled[0]?.snapshotRepoPresent, true);
  assert.equal(reconciled[0]?.branchRuntimeCount, 1);
  assert.equal(reconciled[0]?.mqBootstrapCount, 1);
  assert.equal(reconciled[0]?.snapshotLineageCount, 1);
  assert.equal(reconciled[0]?.status, "aligned");
  assert.equal(reconciled[0]?.recommendedAction, "none");
  assert.deepEqual(reconciled[0]?.issues, []);
});

test("cmp recovery reconciliation marks snapshot-only projects and recommends snapshot hydration", () => {
  const repo = createCmpGitProjectRepo({
    projectId: "proj-snapshot-only",
    repoName: "proj-snapshot-only",
  });
  const snapshot = createCmpRuntimeSnapshot({
    projectRepos: [repo],
    lineages: [createAgentLineage({
      agentId: "main",
      projectId: "proj-snapshot-only",
      depth: 0,
      branchFamily: createCmpBranchFamily({
        workBranch: "work/main",
        cmpBranch: "cmp/main",
        mpBranch: "mp/main",
        tapBranch: "tap/main",
      }),
    })],
  });

  const reconciled = reconcileCmpRuntimeSnapshotWithInfraProjects({
    snapshot,
    projects: [],
  });

  assert.equal(reconciled.length, 1);
  assert.equal(reconciled[0]?.projectId, "proj-snapshot-only");
  assert.equal(reconciled[0]?.status, "snapshot_only");
  assert.equal(reconciled[0]?.infraProjectPresent, false);
  assert.equal(reconciled[0]?.recommendedAction, "hydrate_from_snapshot");
  assert.deepEqual(reconciled[0]?.orphanSnapshotLineageAgentIds, ["main"]);
});

test("cmp recovery reconciliation reports degraded infra gaps for known project agents", () => {
  const repo = createCmpGitProjectRepo({
    projectId: "proj-degraded",
    repoName: "proj-degraded",
  });
  const gitLineageMain = createCmpGitLineageNode({
    projectId: "proj-degraded",
    agentId: "main",
  });
  const gitLineageChild = createCmpGitLineageNode({
    projectId: "proj-degraded",
    agentId: "child-a",
    parentAgentId: "main",
    depth: 1,
  });
  const branchRuntime = createCmpGitAgentBranchRuntime({
    projectRepo: repo,
    lineage: gitLineageMain,
    repoRootPath: "/tmp/praxis/proj-degraded",
  });
  const project = createCmpRuntimeInfraProjectState({
    projectId: "proj-degraded",
    git: undefined,
    gitBranchBootstraps: [],
    branchRuntimes: [branchRuntime],
    db: undefined,
    dbReceipt: undefined,
    mqBootstraps: [createCmpRedisProjectBootstrap({
      projectId: "proj-degraded",
      agentId: "main",
    })],
    lineages: [gitLineageMain, gitLineageChild],
    updatedAt: "2026-03-25T00:00:00.000Z",
  });
  const snapshot = createCmpRuntimeSnapshot({
    projectRepos: [repo],
    lineages: [createAgentLineage({
      agentId: "main",
      projectId: "proj-degraded",
      depth: 0,
      branchFamily: createCmpBranchFamily({
        workBranch: "work/main",
        cmpBranch: "cmp/main",
        mpBranch: "mp/main",
        tapBranch: "tap/main",
      }),
    })],
  });

  const reconciled = reconcileCmpRuntimeSnapshotWithInfraProjects({
    snapshot,
    projects: [project],
  });

  assert.equal(reconciled[0]?.status, "degraded");
  assert.deepEqual(reconciled[0]?.missingBranchRuntimeAgentIds, ["child-a"]);
  assert.deepEqual(reconciled[0]?.missingMqBootstrapAgentIds, ["child-a"]);
  assert.deepEqual(reconciled[0]?.missingSnapshotLineageAgentIds, ["child-a"]);
  assert.equal(reconciled[0]?.recommendedAction, "reconcile_snapshot_and_infra");
  assert.ok(reconciled[0]?.issues.some((issue) => issue.includes("child-a")));
});

test("cmp recovery reconciliation marks db-readback-incomplete projects as degraded and recommends reconciliation", () => {
  const repo = createCmpGitProjectRepo({
    projectId: "proj-reconcile-db-gap",
    repoName: "proj-reconcile-db-gap",
  });
  const gitLineage = createCmpGitLineageNode({
    projectId: "proj-reconcile-db-gap",
    agentId: "main",
  });
  const branchRuntime = createCmpGitAgentBranchRuntime({
    projectRepo: repo,
    lineage: gitLineage,
    repoRootPath: "/tmp/praxis/proj-reconcile-db-gap",
  });
  const project = createCmpRuntimeInfraProjectState({
    projectId: "proj-reconcile-db-gap",
    git: undefined,
    gitBranchBootstraps: [],
    branchRuntimes: [branchRuntime],
    db: undefined,
    dbReceipt: {
      projectId: "proj-reconcile-db-gap",
      databaseName: "cmp_proj_reconcile_db_gap",
      schemaName: "cmp_proj_reconcile_db_gap",
      status: "readback_incomplete",
      expectedTargetCount: 4,
      presentTargetCount: 1,
      readbackRecords: [],
    },
    mqBootstraps: [createCmpRedisProjectBootstrap({
      projectId: "proj-reconcile-db-gap",
      agentId: "main",
    })],
    lineages: [gitLineage],
    updatedAt: "2026-03-25T00:00:00.000Z",
  });
  const snapshot = createCmpRuntimeSnapshot({
    projectRepos: [repo],
    lineages: [createAgentLineage({
      agentId: "main",
      projectId: "proj-reconcile-db-gap",
      depth: 0,
      branchFamily: createCmpBranchFamily({
        workBranch: "work/main",
        cmpBranch: "cmp/main",
        mpBranch: "mp/main",
        tapBranch: "tap/main",
      }),
    })],
  });

  const reconciled = reconcileCmpRuntimeSnapshotWithInfraProjects({
    snapshot,
    projects: [project],
  });

  assert.equal(reconciled[0]?.status, "degraded");
  assert.equal(reconciled[0]?.recommendedAction, "reconcile_snapshot_and_infra");
  assert.ok(reconciled[0]?.issues.includes("CMP DB bootstrap readback is incomplete for this project."));
});

test("cmp historical fallback prefers DB projection and degrades to git when projection is missing", () => {
  const preferred = planCmpHistoricalFallback({
    projectId: "proj-history",
    requesterAgentId: "main",
    snapshotId: "snapshot-1",
    hasDbProjection: true,
    dbReadbackComplete: true,
    hasGitCheckedSnapshot: true,
  });
  assert.equal(preferred.resolvedSource, "db_projection");
  assert.equal(preferred.degraded, false);

  const fallback = planCmpHistoricalFallback({
    projectId: "proj-history",
    requesterAgentId: "main",
    snapshotId: "snapshot-2",
    hasDbProjection: false,
    dbReadbackComplete: false,
    hasGitCheckedSnapshot: true,
  });
  assert.equal(fallback.resolvedSource, "git_checked");
  assert.equal(fallback.degraded, true);
  assert.equal(fallback.reason, "projection_missing");
});

test("cmp historical fallback marks git rebuild as degraded when DB is unavailable", () => {
  const fallback = planCmpHistoricalFallback({
    projectId: "proj-history-db-down",
    requesterAgentId: "main",
    snapshotId: "snapshot-db-down",
    hasDbProjection: false,
    dbReadbackComplete: false,
    dbAvailable: false,
    hasGitCheckedSnapshot: true,
  });

  assert.equal(fallback.resolvedSource, "git_checked");
  assert.equal(fallback.degraded, true);
  assert.equal(fallback.reason, "db_unavailable");
});

test("cmp historical fallback rejects rebuild when git checked truth is unavailable", () => {
  assert.throws(() => {
    planCmpHistoricalFallback({
      projectId: "proj-history-fail",
      requesterAgentId: "main",
      hasDbProjection: false,
      dbReadbackComplete: false,
      hasGitCheckedSnapshot: false,
    });
  }, /no git checked snapshot/i);
});

test("cmp runtime recovery can hydrate snapshot and attach reconciliation records together", () => {
  const repo = createCmpGitProjectRepo({
    projectId: "proj-hydrated",
    repoName: "proj-hydrated",
  });
  const gitLineage = createCmpGitLineageNode({
    projectId: "proj-hydrated",
    agentId: "main",
  });
  const branchRuntime = createCmpGitAgentBranchRuntime({
    projectRepo: repo,
    lineage: gitLineage,
    repoRootPath: "/tmp/praxis/proj-hydrated",
  });
  const snapshot = createCmpRuntimeSnapshot({
    projectRepos: [repo],
    lineages: [createAgentLineage({
      agentId: "main",
      projectId: "proj-hydrated",
      depth: 0,
      branchFamily: createCmpBranchFamily({
        workBranch: "work/main",
        cmpBranch: "cmp/main",
        mpBranch: "mp/main",
        tapBranch: "tap/main",
      }),
    })],
  });
  const project = createCmpRuntimeInfraProjectState({
    projectId: "proj-hydrated",
    git: undefined,
    gitBranchBootstraps: [],
    branchRuntimes: [branchRuntime],
    db: undefined,
    dbReceipt: undefined,
    mqBootstraps: [createCmpRedisProjectBootstrap({
      projectId: "proj-hydrated",
      agentId: "main",
    })],
    lineages: [gitLineage],
    updatedAt: "2026-03-25T00:00:00.000Z",
  });

  const recovered = hydrateCmpRuntimeSnapshotWithReconciliation({
    snapshot,
    projects: [project],
  });

  assert.equal(CMP_RECOVERY_RECONCILIATION_STATUSES.includes(recovered.reconciliation[0]!.status), true);
  assert.equal(recovered.hydrated.projectRepos.get("proj-hydrated")?.projectId, "proj-hydrated");
  assert.equal(recovered.reconciliation[0]?.status, "aligned");
  assert.equal(recovered.summary.totalProjects, 1);
  assert.deepEqual(recovered.summary.alignedProjectIds, ["proj-hydrated"]);
  assert.equal(getCmpRuntimeRecoveryReconciliation({
    recovery: recovered,
    projectId: "proj-hydrated",
  })?.status, "aligned");
});

test("cmp recovery reconciliation can summarize mixed project states and look up individual records", () => {
  const records: CmpRecoveryReconciliationRecord[] = [
    {
      projectId: "proj-aligned",
      status: "aligned",
      snapshotProjectPresent: true,
      infraProjectPresent: true,
      snapshotRepoPresent: true,
      branchRuntimeCount: 1,
      mqBootstrapCount: 1,
      snapshotLineageCount: 1,
      infraLineageCount: 1,
      branchRuntimeAgentIds: ["main"],
      mqBootstrapAgentIds: ["main"],
      snapshotLineageAgentIds: ["main"],
      infraLineageAgentIds: ["main"],
      missingSnapshotRepo: false,
      missingBranchRuntimeAgentIds: [],
      missingMqBootstrapAgentIds: [],
      missingSnapshotLineageAgentIds: [],
      orphanSnapshotLineageAgentIds: [],
      issues: [],
      recommendedAction: "none",
    },
    {
      projectId: "proj-reconcile",
      status: "degraded",
      snapshotProjectPresent: true,
      infraProjectPresent: true,
      snapshotRepoPresent: true,
      branchRuntimeCount: 1,
      mqBootstrapCount: 0,
      snapshotLineageCount: 1,
      infraLineageCount: 2,
      branchRuntimeAgentIds: ["main"],
      mqBootstrapAgentIds: [],
      snapshotLineageAgentIds: ["main"],
      infraLineageAgentIds: ["main", "child"],
      missingSnapshotRepo: false,
      missingBranchRuntimeAgentIds: ["child"],
      missingMqBootstrapAgentIds: ["main", "child"],
      missingSnapshotLineageAgentIds: ["child"],
      orphanSnapshotLineageAgentIds: [],
      issues: ["gap"],
      recommendedAction: "reconcile_snapshot_and_infra",
    },
    {
      projectId: "proj-snapshot-only",
      status: "snapshot_only",
      snapshotProjectPresent: true,
      infraProjectPresent: false,
      snapshotRepoPresent: true,
      branchRuntimeCount: 0,
      mqBootstrapCount: 0,
      snapshotLineageCount: 1,
      infraLineageCount: 0,
      branchRuntimeAgentIds: [],
      mqBootstrapAgentIds: [],
      snapshotLineageAgentIds: ["main"],
      infraLineageAgentIds: [],
      missingSnapshotRepo: false,
      missingBranchRuntimeAgentIds: [],
      missingMqBootstrapAgentIds: [],
      missingSnapshotLineageAgentIds: [],
      orphanSnapshotLineageAgentIds: ["main"],
      issues: ["snapshot only"],
      recommendedAction: "hydrate_from_snapshot",
    },
  ];

  const summary = summarizeCmpRecoveryReconciliation(records);
  assert.equal(summary.totalProjects, 3);
  assert.deepEqual(summary.alignedProjectIds, ["proj-aligned"]);
  assert.deepEqual(summary.degradedProjectIds, ["proj-reconcile"]);
  assert.deepEqual(summary.snapshotOnlyProjectIds, ["proj-snapshot-only"]);
  assert.deepEqual(summary.recommendedHydrateFromSnapshot, ["proj-snapshot-only"]);
  assert.deepEqual(summary.recommendedReconcile, ["proj-reconcile"]);
  assert.equal(getCmpRecoveryReconciliationRecord({
    records,
    projectId: "proj-reconcile",
  })?.recommendedAction, "reconcile_snapshot_and_infra");
});
