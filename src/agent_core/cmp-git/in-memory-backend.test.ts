import assert from "node:assert/strict";
import test from "node:test";

import {
  CmpGitAdapterError,
  CmpGitLineageRegistry,
  createCmpGitAgentBranchRuntime,
  createCmpGitProjectRepo,
  createCmpGitProjectRepoBootstrapPlan,
  createInMemoryCmpGitBackend,
} from "./index.js";

test("cmp git in-memory backend bootstraps a project repo and returns already_exists on repeat", () => {
  const backend = createInMemoryCmpGitBackend();
  const plan = createCmpGitProjectRepoBootstrapPlan({
    projectId: "project.cmp",
    repoName: "cmp-history",
    repoRootPath: "/tmp/praxis/project.cmp",
    defaultAgentId: "main",
  });

  const first = backend.bootstrapProjectRepo(plan);
  const second = backend.bootstrapProjectRepo(plan);

  assert.equal(first.status, "bootstrapped");
  assert.equal(second.status, "already_exists");
  assert.deepEqual(first.createdBranchNames, [
    "work/main",
    "cmp/main",
    "mp/main",
    "tap/main",
  ]);
});

test("cmp git in-memory backend bootstraps one agent runtime and can read cmp branch head state", () => {
  const backend = createInMemoryCmpGitBackend();
  const repo = createCmpGitProjectRepo({
    projectId: "project.cmp",
    repoName: "cmp-history",
  });
  const registry = new CmpGitLineageRegistry();
  const main = registry.register({
    projectId: "project.cmp",
    agentId: "main",
  });
  const child = registry.register({
    projectId: "project.cmp",
    agentId: "child-a",
    parentAgentId: main.agentId,
    depth: 1,
  });
  const runtime = createCmpGitAgentBranchRuntime({
    projectRepo: repo,
    lineage: child,
    repoRootPath: "/tmp/praxis/project.cmp",
  });

  const created = backend.bootstrapAgentBranchRuntime(runtime);
  const readback = backend.readBranchHead(runtime);

  assert.deepEqual(created, [
    "work/child-a",
    "cmp/child-a",
    "mp/child-a",
    "tap/child-a",
  ]);
  assert.equal(readback.branchRef.fullRef, "refs/heads/cmp/child-a");
  assert.equal(readback.checkedRefName, runtime.checkedRefName);
  assert.equal(readback.promotedRefName, runtime.promotedRefName);
  assert.equal(readback.headCommitSha, undefined);
});

test("cmp git in-memory backend writes checked and promoted refs against the cmp branch", () => {
  const backend = createInMemoryCmpGitBackend();
  const repo = createCmpGitProjectRepo({
    projectId: "project.cmp",
    repoName: "cmp-history",
  });
  const registry = new CmpGitLineageRegistry();
  const main = registry.register({
    projectId: "project.cmp",
    agentId: "main",
  });
  const runtime = createCmpGitAgentBranchRuntime({
    projectRepo: repo,
    lineage: main,
    repoRootPath: "/tmp/praxis/project.cmp",
  });
  backend.bootstrapAgentBranchRuntime(runtime);

  const checked = backend.writeCheckedRef(runtime, "sha-checked-1");
  const promoted = backend.writePromotedRef(runtime, "sha-checked-1");

  assert.equal(checked.headCommitSha, "sha-checked-1");
  assert.equal(checked.checkedCommitSha, "sha-checked-1");
  assert.equal(promoted.promotedCommitSha, "sha-checked-1");
  assert.equal(promoted.promotedRefName, runtime.promotedRefName);
});

test("cmp git in-memory backend rejects promoted ref writes before checked ref exists", () => {
  const backend = createInMemoryCmpGitBackend();
  const repo = createCmpGitProjectRepo({
    projectId: "project.cmp",
    repoName: "cmp-history",
  });
  const registry = new CmpGitLineageRegistry();
  const main = registry.register({
    projectId: "project.cmp",
    agentId: "main",
  });
  const runtime = createCmpGitAgentBranchRuntime({
    projectRepo: repo,
    lineage: main,
    repoRootPath: "/tmp/praxis/project.cmp",
  });
  backend.bootstrapAgentBranchRuntime(runtime);

  assert.throws(() => backend.writePromotedRef(runtime, "sha-promoted-1"), (error: unknown) => {
    assert.ok(error instanceof CmpGitAdapterError);
    assert.equal(error.code, "ref_write_failed");
    return true;
  });
});
