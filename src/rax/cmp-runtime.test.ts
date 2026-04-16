import assert from "node:assert/strict";
import test from "node:test";

import {
  createContextPackage,
  createDispatchReceipt,
} from "../agent_core/cmp-types/index.js";
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
  assert.equal(typeof runtime.worksite.exportCorePackage, "function");
});

test("createRaxCmpRuntime can carry peer approval from pending to approved through the real five-agent summary", async () => {
  const config = createRaxCmpConfig({
    projectId: "proj-rax-cmp-runtime-peer-approval",
    git: {
      repoName: "proj-rax-cmp-runtime-peer-approval",
      repoRootPath: "/tmp/praxis/proj-rax-cmp-runtime-peer-approval",
    },
    db: {
      databaseName: "cmp_proj_rax_cmp_runtime_peer_approval",
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
  const runtime = createRaxCmpRuntime({
    config,
    connectors,
  });

  const dispatched = await runtime.agentCoreRuntime.cmp.fiveAgent.dispatchDispatcherWithLlm({
    contextPackage: createContextPackage({
      packageId: "pkg-runtime-peer-1",
      sourceProjectionId: "projection-runtime-peer-1",
      targetAgentId: "peer-b",
      packageKind: "peer_exchange",
      packageRef: "cmp-package:runtime-peer-1",
      fidelityLabel: "checked_high_fidelity",
      createdAt: "2026-04-11T16:00:00.000Z",
    }),
    dispatch: {
      agentId: "peer-a",
      packageId: "pkg-runtime-peer-1",
      sourceAgentId: "peer-a",
      targetAgentId: "peer-b",
      targetKind: "peer",
      metadata: {
        parentAgentId: "parent-main",
        currentStateSummary: "peer exchange awaits explicit parent approval",
        sourceRequestId: "request-runtime-peer-1",
        sourceSnapshotId: "snapshot-runtime-peer-1",
      },
    },
    receipt: createDispatchReceipt({
      dispatchId: "dispatch-runtime-peer-1",
      packageId: "pkg-runtime-peer-1",
      sourceAgentId: "peer-a",
      targetAgentId: "peer-b",
      status: "delivered",
      deliveredAt: "2026-04-11T16:00:00.000Z",
    }),
    createdAt: "2026-04-11T16:00:00.000Z",
    loopId: "dispatcher-runtime-peer-1",
  }, {
    mode: "llm_assisted",
    executor: async () => ({
      output: {
        routeRationale: "peer exchange can proceed after explicit parent approval",
        bodyStrategy: "peer_exchange_slim",
        slimExchangeFields: ["packageId", "packageKind", "primaryRef"],
        scopePolicy: "peer_exchange_requires_explicit_parent_approval",
      },
      provider: "openai",
      model: "gpt-5.4",
      requestId: "req-runtime-peer-1",
    }),
  });

  const approvalId = dispatched.peerApproval?.approvalId;
  assert.ok(approvalId);
  const pendingSummary = runtime.fiveAgent.getSummary!("peer-a");
  assert.equal(pendingSummary.flow.pendingPeerApprovalCount, 1);
  assert.equal(pendingSummary.flow.approvedPeerApprovalCount, 0);

  const approval = await runtime.roles.approvePeerExchange!({
    approvalId,
    actorAgentId: "parent-main",
    decision: "approved",
    note: "allow one peer exchange",
  });

  assert.equal(approval.status, "approved");
  const approvedSummary = runtime.fiveAgent.getSummary!("peer-a");
  assert.equal(approvedSummary.flow.pendingPeerApprovalCount, 0);
  assert.equal(approvedSummary.flow.approvedPeerApprovalCount, 1);
  assert.equal(
    ((approvedSummary.latestRoleMetadata.dispatcher?.bundle as { governance?: { approvalStatus?: string } } | undefined)
      ?.governance?.approvalStatus),
    "approved",
  );
});

test("createRaxCmpRuntime proxies CMP worksite exports through the runtime port", async () => {
  const config = createRaxCmpConfig({
    projectId: "proj-rax-cmp-runtime-worksite",
    git: {
      repoName: "proj-rax-cmp-runtime-worksite",
      repoRootPath: "/tmp/praxis/proj-rax-cmp-runtime-worksite",
    },
    db: {
      databaseName: "cmp_proj_rax_cmp_runtime_worksite",
      liveExecutionPreferred: false,
    },
    mq: {
      liveExecutionPreferred: false,
    },
  });

  const runtime = createRaxCmpRuntime({
    config,
  });

  runtime.worksite.observeTurn({
    sessionId: "session-runtime-worksite",
    turnIndex: 2,
    currentObjective: "继续推进 runtime worksite",
    cmp: {
      syncStatus: "synced",
      agentId: "cmp-live-cli-main",
      packageId: "pkg-runtime-worksite",
      packageRef: "cmp-package:runtime-worksite",
      packageKind: "active_reseed",
      packageMode: "core_return",
      fidelityLabel: "checked_high_fidelity",
      projectionId: "projection-runtime-worksite",
      snapshotId: "snapshot-runtime-worksite",
      intent: "keep runtime worksite aligned",
      operatorGuide: "focus on the checked worksite",
      childGuide: "child icma only",
      checkerReason: "usable",
      routeRationale: "core return",
      scopePolicy: "current_worksite_only",
      packageStrategy: "primary",
      timelineStrategy: "timeline",
    },
  });

  const worksite = await runtime.worksite.exportCorePackage({
    sessionId: "session-runtime-worksite",
    currentObjective: "现在继续 runtime worksite",
  });

  assert.equal(worksite.schemaVersion, "core-cmp-worksite-package/v1");
  assert.equal(worksite.identity?.packageRef, "cmp-package:runtime-worksite");
  assert.equal(worksite.objective?.currentObjective, "现在继续 runtime worksite");
});
