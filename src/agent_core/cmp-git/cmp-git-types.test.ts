import assert from "node:assert/strict";
import test from "node:test";

import {
  CMP_GIT_BRANCH_KINDS,
  CMP_GIT_CANDIDATE_STATUSES,
  CMP_GIT_LINEAGE_STATUSES,
  CMP_GIT_REPO_STRATEGIES,
  CMP_GIT_SYNC_INTENTS,
  CmpGitLineageRegistry,
  createCmpGitBranchFamily,
  createCmpGitBranchRef,
  createCmpGitProjectRepo,
  syncCmpGitCommitDelta,
} from "./index.js";

test("cmp git protocol constants freeze repo, branch, lineage, and sync enums", () => {
  assert.deepEqual(CMP_GIT_REPO_STRATEGIES, ["single_project_repo"]);
  assert.deepEqual(CMP_GIT_BRANCH_KINDS, ["work", "cmp", "mp", "tap"]);
  assert.deepEqual(CMP_GIT_LINEAGE_STATUSES, ["active", "suspended", "archived"]);
  assert.deepEqual(CMP_GIT_SYNC_INTENTS, [
    "local_record",
    "submit_to_parent",
    "peer_exchange",
    "seed_children",
  ]);
  assert.deepEqual(CMP_GIT_CANDIDATE_STATUSES, [
    "pending_check",
    "checked",
    "rejected",
  ]);
});

test("project repo and branch family model a single project repo with four branch families", () => {
  const repo = createCmpGitProjectRepo({
    projectId: "project.cmp",
    repoName: "cmp-history",
  });
  const family = createCmpGitBranchFamily("yahoo!");

  assert.equal(repo.repoStrategy, "single_project_repo");
  assert.equal(repo.defaultAgentId, "main");
  assert.equal(family.agentId, "yahoo-");
  assert.equal(family.work.branchName, "work/yahoo-");
  assert.equal(family.cmp.fullRef, "refs/heads/cmp/yahoo-");
  assert.equal(family.mp.branchName, "mp/yahoo-");
  assert.equal(family.tap.branchName, "tap/yahoo-");
});

test("lineage registry preserves parent-child topology and peer discovery", () => {
  const registry = new CmpGitLineageRegistry();

  const root = registry.register({
    projectId: "project.cmp",
    agentId: "main",
  });
  const childA = registry.register({
    projectId: "project.cmp",
    agentId: "child-a",
    parentAgentId: root.agentId,
    depth: 1,
  });
  const childB = registry.register({
    projectId: "project.cmp",
    agentId: "child-b",
    parentAgentId: root.agentId,
    depth: 1,
  });
  const grandchild = registry.register({
    projectId: "project.cmp",
    agentId: "grandchild",
    parentAgentId: childA.agentId,
    depth: 2,
  });

  assert.deepEqual(registry.get(root.agentId)?.childAgentIds.sort(), ["child-a", "child-b"]);
  assert.equal(registry.get(grandchild.agentId)?.parentAgentId, "child-a");
  assert.deepEqual(
    registry.listPeers(childA.agentId).map((entry) => entry.agentId),
    ["child-b"],
  );
});

test("cmp commit delta sync only accepts cmp branches and produces pending snapshot candidates", () => {
  const cmpBranch = createCmpGitBranchRef({
    kind: "cmp",
    agentId: "child-a",
  });
  const { binding, candidate } = syncCmpGitCommitDelta({
    projectId: "project.cmp",
    commitSha: "abc123",
    branchRef: cmpBranch,
    delta: {
      deltaId: "delta-1",
      agentId: "child-a",
      sessionId: "session-1",
      runId: "run-1",
    },
  });

  assert.equal(binding.branchRef.kind, "cmp");
  assert.equal(binding.deltaId, "delta-1");
  assert.equal(candidate.status, "pending_check");
  assert.equal(candidate.commitSha, binding.commitSha);
  assert.equal(candidate.deltaId, binding.deltaId);
});

test("cmp commit delta sync rejects non-cmp branches and branch ownership mismatches", () => {
  assert.throws(() => {
    syncCmpGitCommitDelta({
      projectId: "project.cmp",
      commitSha: "abc123",
      branchRef: createCmpGitBranchRef({
        kind: "work",
        agentId: "child-a",
      }),
      delta: {
        deltaId: "delta-1",
        agentId: "child-a",
      },
    });
  }, /must use cmp branches/i);

  assert.throws(() => {
    syncCmpGitCommitDelta({
      projectId: "project.cmp",
      commitSha: "abc123",
      branchRef: createCmpGitBranchRef({
        kind: "cmp",
        agentId: "child-a",
      }),
      delta: {
        deltaId: "delta-1",
        agentId: "child-b",
      },
    });
  }, /branch ownership mismatch/i);
});
