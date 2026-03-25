import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  CmpGitAdapterError,
  CmpGitLineageRegistry,
  assertGitCliAvailable,
  createCmpGitAgentBranchRuntime,
  createCmpGitProjectRepo,
  createCmpGitProjectRepoBootstrapPlan,
  createGitCliCmpGitBackend,
} from "./index.js";

async function createTempRepoRoot(prefix: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

test("cmp git cli backend bootstraps a project repo and returns already_exists on repeat", async (t) => {
  await assertGitCliAvailable();
  const repoRootPath = await createTempRepoRoot("praxis-cmp-git-cli-");
  t.after(async () => {
    await rm(repoRootPath, { recursive: true, force: true });
  });

  const backend = createGitCliCmpGitBackend();
  const plan = createCmpGitProjectRepoBootstrapPlan({
    projectId: "project.cmp",
    repoName: "cmp-history",
    repoRootPath,
    defaultAgentId: "main",
  });

  const first = await backend.bootstrapProjectRepo(plan);
  const second = await backend.bootstrapProjectRepo(plan);

  assert.equal(first.status, "bootstrapped");
  assert.equal(second.status, "already_exists");
  assert.deepEqual(first.createdBranchNames, [
    "work/main",
    "cmp/main",
    "mp/main",
    "tap/main",
  ]);
});

test("cmp git cli backend bootstraps one agent runtime and can read cmp branch head state", async (t) => {
  await assertGitCliAvailable();
  const repoRootPath = await createTempRepoRoot("praxis-cmp-git-cli-runtime-");
  t.after(async () => {
    await rm(repoRootPath, { recursive: true, force: true });
  });

  const backend = createGitCliCmpGitBackend();
  const plan = createCmpGitProjectRepoBootstrapPlan({
    projectId: "project.cmp",
    repoName: "cmp-history",
    repoRootPath,
    defaultAgentId: "main",
  });
  await backend.bootstrapProjectRepo(plan);

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
    repoRootPath,
  });

  const created = await backend.bootstrapAgentBranchRuntime(runtime);
  const readback = await backend.readBranchHead(runtime);

  assert.deepEqual(created, [
    "work/child-a",
    "cmp/child-a",
    "mp/child-a",
    "tap/child-a",
  ]);
  assert.equal(readback.branchRef.fullRef, "refs/heads/cmp/child-a");
  assert.equal(readback.checkedRefName, runtime.checkedRefName);
  assert.equal(readback.promotedRefName, runtime.promotedRefName);
  assert.ok(readback.headCommitSha);
});

test("cmp git cli backend writes checked and promoted refs against the cmp branch", async (t) => {
  await assertGitCliAvailable();
  const repoRootPath = await createTempRepoRoot("praxis-cmp-git-cli-refs-");
  t.after(async () => {
    await rm(repoRootPath, { recursive: true, force: true });
  });

  const backend = createGitCliCmpGitBackend();
  const plan = createCmpGitProjectRepoBootstrapPlan({
    projectId: "project.cmp",
    repoName: "cmp-history",
    repoRootPath,
    defaultAgentId: "main",
  });
  await backend.bootstrapProjectRepo(plan);

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
    repoRootPath,
  });
  await backend.bootstrapAgentBranchRuntime(runtime);

  const baseReadback = await backend.readBranchHead(runtime);
  const commitSha = baseReadback.headCommitSha;
  assert.ok(commitSha);
  const checked = await backend.writeCheckedRef(runtime, commitSha);
  const promoted = await backend.writePromotedRef(runtime, commitSha);

  assert.equal(checked.checkedCommitSha, commitSha);
  assert.equal(promoted.promotedCommitSha, commitSha);
});

test("cmp git cli backend rejects promoted ref writes before checked ref exists", async (t) => {
  await assertGitCliAvailable();
  const repoRootPath = await createTempRepoRoot("praxis-cmp-git-cli-promoted-");
  t.after(async () => {
    await rm(repoRootPath, { recursive: true, force: true });
  });

  const backend = createGitCliCmpGitBackend();
  const plan = createCmpGitProjectRepoBootstrapPlan({
    projectId: "project.cmp",
    repoName: "cmp-history",
    repoRootPath,
    defaultAgentId: "main",
  });
  await backend.bootstrapProjectRepo(plan);

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
    repoRootPath,
  });
  await backend.bootstrapAgentBranchRuntime(runtime);

  const readback = await backend.readBranchHead(runtime);
  await assert.rejects(
    () => backend.writePromotedRef(runtime, readback.headCommitSha ?? "missing"),
    (error: unknown) => {
      assert.ok(error instanceof CmpGitAdapterError);
      assert.equal(error.code, "ref_write_failed");
      return true;
    },
  );
});
