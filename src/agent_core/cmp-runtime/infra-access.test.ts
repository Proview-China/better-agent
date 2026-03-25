import assert from "node:assert/strict";
import test from "node:test";

import {
  createCmpGitAgentBranchRuntime,
  createCmpGitLineageNode,
  createCmpGitProjectRepo,
} from "../cmp-git/index.js";
import { createCmpRedisProjectBootstrap } from "../cmp-mq/index.js";
import { createCmpRuntimeInfraProjectState } from "./infra-state.js";
import { createCmpProjectInfraAccess, resolveCmpAgentInfraAccess } from "./infra-access.js";

test("cmp project infra access can index branch runtimes and mq bootstraps by agent", () => {
  const repo = createCmpGitProjectRepo({
    projectId: "proj-access",
    repoName: "proj-access",
  });
  const lineage = createCmpGitLineageNode({
    projectId: "proj-access",
    agentId: "main",
  });
  const branchRuntime = createCmpGitAgentBranchRuntime({
    projectRepo: repo,
    lineage,
    repoRootPath: "/tmp/praxis/proj-access",
  });
  const project = createCmpRuntimeInfraProjectState({
    projectId: "proj-access",
    git: undefined,
    gitBranchBootstraps: [],
    branchRuntimes: [branchRuntime],
    db: undefined,
    dbReceipt: undefined,
    mqBootstraps: [createCmpRedisProjectBootstrap({
      projectId: "proj-access",
      agentId: "main",
    })],
    lineages: [lineage],
    updatedAt: "2026-03-25T00:00:00.000Z",
  });

  const access = createCmpProjectInfraAccess(project);
  assert.equal(access.branchRuntimes.size, 1);
  assert.equal(access.mqBootstraps.size, 1);
  assert.equal(access.branchRuntimes.get("main")?.agentId, "main");
});

test("cmp agent infra access resolves a single agent runtime and mq bootstrap", () => {
  const repo = createCmpGitProjectRepo({
    projectId: "proj-access-agent",
    repoName: "proj-access-agent",
  });
  const lineage = createCmpGitLineageNode({
    projectId: "proj-access-agent",
    agentId: "child-a",
    parentAgentId: "main",
    depth: 1,
  });
  const branchRuntime = createCmpGitAgentBranchRuntime({
    projectRepo: repo,
    lineage,
    repoRootPath: "/tmp/praxis/proj-access-agent",
  });
  const project = createCmpRuntimeInfraProjectState({
    projectId: "proj-access-agent",
    git: undefined,
    gitBranchBootstraps: [],
    branchRuntimes: [branchRuntime],
    db: undefined,
    dbReceipt: undefined,
    mqBootstraps: [createCmpRedisProjectBootstrap({
      projectId: "proj-access-agent",
      agentId: "child-a",
    })],
    lineages: [lineage],
    updatedAt: "2026-03-25T00:00:00.000Z",
  });

  const access = resolveCmpAgentInfraAccess({
    project,
    agentId: "child-a",
  });
  assert.equal(access.branchRuntime.agentId, "child-a");
  assert.equal(access.mqBootstrap?.agentId, "child-a");
});
