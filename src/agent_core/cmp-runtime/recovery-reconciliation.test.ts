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
import { reconcileCmpRuntimeSnapshotWithInfraProjects } from "./recovery-reconciliation.js";
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
});
