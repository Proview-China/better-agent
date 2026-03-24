import assert from "node:assert/strict";
import test from "node:test";

import {
  CMP_GIT_ADAPTER_ERROR_CODES,
  CMP_GIT_BOOTSTRAP_STATUSES,
  CmpGitAdapterError,
  CmpGitLineageRegistry,
  createCmpGitAdapterError,
  createCmpGitProjectRepoBootstrapPlan,
  createCmpGitProjectRepo,
  createCmpGitAgentBranchRuntime,
  listCmpGitBranchRuntimes,
  resolveCmpGitAgentBranchRuntime,
} from "./index.js";

test("cmp git infra constants expose bootstrap status and adapter error code enums", () => {
  assert.deepEqual(CMP_GIT_BOOTSTRAP_STATUSES, [
    "pending",
    "bootstrapped",
    "already_exists",
  ]);
  assert.deepEqual(CMP_GIT_ADAPTER_ERROR_CODES, [
    "bootstrap_failed",
    "branch_conflict",
    "ref_write_failed",
    "readback_failed",
    "lineage_wiring_invalid",
    "unsupported_operation",
  ]);
});

test("cmp git project repo bootstrap plan fixes repo root, default branch, and worktree root", () => {
  const plan = createCmpGitProjectRepoBootstrapPlan({
    projectId: "project.cmp",
    repoName: "cmp-history",
    repoRootPath: "/tmp/praxis/project.cmp",
  });

  assert.equal(plan.projectRepo.projectId, "project.cmp");
  assert.equal(plan.projectRepo.defaultAgentId, "main");
  assert.equal(plan.defaultBranchName, "main");
  assert.equal(plan.worktreeRootPath, "/tmp/praxis/project.cmp/.cmp-worktrees");
  assert.deepEqual(plan.branchKinds, ["work", "cmp", "mp", "tap"]);
});

test("cmp git agent branch runtime wires lineage into branch family and ref storage layout", () => {
  const repo = createCmpGitProjectRepo({
    projectId: "project.cmp",
    repoName: "cmp-history",
  });
  const registry = new CmpGitLineageRegistry();
  const root = registry.register({
    projectId: "project.cmp",
    agentId: "main",
  });
  const child = registry.register({
    projectId: "project.cmp",
    agentId: "child-a",
    parentAgentId: root.agentId,
    depth: 1,
  });

  const runtime = createCmpGitAgentBranchRuntime({
    projectRepo: repo,
    lineage: child,
    repoRootPath: "/tmp/praxis/project.cmp",
  });

  assert.equal(runtime.branchFamily.cmp.branchName, "cmp/child-a");
  assert.equal(runtime.checkedRefName, "refs/praxis/cmp/checked/child-a");
  assert.equal(runtime.promotedRefName, "refs/praxis/cmp/promoted/child-a");
  assert.equal(runtime.cmpWorktreePath, "/tmp/praxis/project.cmp/.cmp-worktrees/cmp__child-a");
  assert.equal(runtime.parentAgentId, "main");
});

test("cmp git branch runtime can be resolved from registry and listed for the whole lineage tree", () => {
  const repo = createCmpGitProjectRepo({
    projectId: "project.cmp",
    repoName: "cmp-history",
  });
  const registry = new CmpGitLineageRegistry();
  const root = registry.register({
    projectId: "project.cmp",
    agentId: "main",
  });
  registry.register({
    projectId: "project.cmp",
    agentId: "child-a",
    parentAgentId: root.agentId,
    depth: 1,
  });
  registry.register({
    projectId: "project.cmp",
    agentId: "child-b",
    parentAgentId: root.agentId,
    depth: 1,
  });

  const resolved = resolveCmpGitAgentBranchRuntime({
    registry,
    projectRepo: repo,
    agentId: "child-a",
    repoRootPath: "/tmp/praxis/project.cmp",
  });
  const listed = listCmpGitBranchRuntimes({
    registry,
    projectRepo: repo,
    repoRootPath: "/tmp/praxis/project.cmp",
  });

  assert.equal(resolved.agentId, "child-a");
  assert.deepEqual(listed.map((entry) => entry.agentId), ["main", "child-a", "child-b"]);
});

test("cmp git adapter error keeps a stable code and metadata", () => {
  const error = createCmpGitAdapterError({
    code: "readback_failed",
    message: "readback failed for cmp/child-a",
    metadata: {
      branchName: "cmp/child-a",
    },
  });

  assert.ok(error instanceof CmpGitAdapterError);
  assert.equal(error.code, "readback_failed");
  assert.deepEqual(error.metadata, {
    branchName: "cmp/child-a",
  });
});
