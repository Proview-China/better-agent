import assert from "node:assert/strict";
import test from "node:test";

import { createAgentCoreRuntime } from "../agent_core/runtime.js";
import { createInMemoryCmpGitBackend } from "../agent_core/cmp-git/index.js";
import { createInMemoryCmpRedisMqAdapter } from "../agent_core/cmp-mq/index.js";
import { createRaxCmpConfig } from "./cmp-config.js";
import { createCmpSharedInfraConnectors } from "./cmp-connectors.js";
import { createRaxCmpRuntime } from "./cmp-runtime.js";

test("createRaxCmpRuntime can assemble shared connectors and agent_core runtime", () => {
  const config = createRaxCmpConfig({
    projectId: "proj-rax-cmp-runtime",
    git: {
      repoName: "proj-rax-cmp-runtime",
      repoRootPath: "/tmp/praxis/proj-rax-cmp-runtime",
    },
    db: {
      databaseName: "cmp_proj_rax_cmp_runtime",
      liveExecutionPreferred: false,
    },
    mq: {
      liveExecutionPreferred: false,
    },
  });

  const runtime = createRaxCmpRuntime({
    config,
  });

  assert.equal(runtime.config.projectId, "proj-rax-cmp-runtime");
  assert.equal(runtime.connectors.git.kind, "shared_git_infra");
  assert.equal(runtime.connectors.db.kind, "shared_postgresql");
  assert.equal(runtime.connectors.mq.kind, "shared_redis");
});

test("createRaxCmpRuntime can reuse injected connectors and agent_core runtime", () => {
  const config = createRaxCmpConfig({
    projectId: "proj-rax-cmp-runtime-injected",
    git: {
      repoName: "proj-rax-cmp-runtime-injected",
      repoRootPath: "/tmp/praxis/proj-rax-cmp-runtime-injected",
    },
    db: {
      databaseName: "cmp_proj_rax_cmp_runtime_injected",
      liveExecutionPreferred: false,
    },
    mq: {
      liveExecutionPreferred: false,
    },
  });
  const connectors = createCmpSharedInfraConnectors({
    gitBackend: createInMemoryCmpGitBackend(),
    mqAdapter: createInMemoryCmpRedisMqAdapter(),
  });
  const agentCoreRuntime = createAgentCoreRuntime({
    cmpInfraBackends: {
      git: connectors.git.backend,
      mq: connectors.mq.adapter,
      dbExecutor: connectors.db.executor,
    },
  });

  const runtime = createRaxCmpRuntime({
    config,
    connectors,
    runtime: agentCoreRuntime,
  });

  assert.equal(runtime.connectors, connectors);
  assert.equal(runtime.agentCoreRuntime, agentCoreRuntime);
});

test("createRaxCmpRuntime exposes full cmp workflow surface through agent_core runtime", () => {
  const config = createRaxCmpConfig({
    projectId: "proj-rax-cmp-runtime-surface",
    git: {
      repoName: "proj-rax-cmp-runtime-surface",
      repoRootPath: "/tmp/praxis/proj-rax-cmp-runtime-surface",
    },
    db: {
      databaseName: "cmp_proj_rax_cmp_runtime_surface",
      liveExecutionPreferred: false,
    },
    mq: {
      liveExecutionPreferred: false,
    },
  });

  const runtime = createRaxCmpRuntime({
    config,
  });

  assert.equal(typeof runtime.flow.resolve, "function");
  assert.equal(typeof runtime.flow.materialize, "function");
  assert.equal(typeof runtime.flow.dispatch, "function");
  assert.equal(typeof runtime.fiveAgent.getSummary, "function");
  assert.equal(typeof runtime.roles.resolveCapabilityAccess, "function");
  assert.equal(typeof runtime.roles.dispatchCapability, "function");
});
