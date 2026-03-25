import assert from "node:assert/strict";
import test from "node:test";

import {
  createCmpGitAgentBranchRuntime,
  createCmpGitLineageNode,
  createCmpGitProjectRepo,
  createInMemoryCmpGitBackend,
} from "../cmp-git/index.js";
import { createCmpGitProjectRepoBootstrapPlan } from "../cmp-git/project-repo-bootstrap.js";
import { executeCmpGitSnapshotLowering } from "./git-lowering.js";

test("cmp git lowering writes checked then promoted refs through the backend", async () => {
  const backend = createInMemoryCmpGitBackend();
  const plan = createCmpGitProjectRepoBootstrapPlan({
    projectId: "proj-git-lowering",
    repoName: "proj-git-lowering",
    repoRootPath: "/tmp/praxis/proj-git-lowering",
    defaultAgentId: "main",
  });
  await backend.bootstrapProjectRepo(plan);
  const repo = createCmpGitProjectRepo({
    projectId: "proj-git-lowering",
    repoName: "proj-git-lowering",
  });
  const lineage = createCmpGitLineageNode({
    projectId: "proj-git-lowering",
    agentId: "main",
  });
  const runtime = createCmpGitAgentBranchRuntime({
    projectRepo: repo,
    lineage,
    repoRootPath: plan.repoRootPath,
    worktreeRootPath: plan.worktreeRootPath,
  });
  await backend.bootstrapAgentBranchRuntime(runtime);
  const commitSha = "cmp-commit-1";

  const lowered = await executeCmpGitSnapshotLowering({
    backend,
    runtime,
    commitSha,
    promotedCommitSha: commitSha,
  });

  assert.equal(lowered.initialReadback.branchRef.fullRef, runtime.branchFamily.cmp.fullRef);
  assert.equal(lowered.checkedReadback.checkedCommitSha, commitSha);
  assert.equal(lowered.promotedReadback?.promotedCommitSha, commitSha);
});
