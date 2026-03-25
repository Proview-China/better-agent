import assert from "node:assert/strict";
import test from "node:test";

import { createCmpDbPsqlLiveExecutor } from "../agent_core/cmp-db/index.js";
import { createInMemoryCmpGitBackend } from "../agent_core/cmp-git/index.js";
import { createInMemoryCmpRedisMqAdapter } from "../agent_core/cmp-mq/index.js";
import {
  createCmpPostgresConnector,
  createCmpRedisConnector,
  createCmpSharedGitInfraConnector,
  createCmpSharedInfraConnectors,
} from "./cmp-connectors.js";

test("cmp shared git connector keeps shared ownership and can bootstrap project plus branch runtimes", async () => {
  const connector = createCmpSharedGitInfraConnector({
    backend: createInMemoryCmpGitBackend(),
  });
  const plan = connector.createProjectBootstrapPlan({
    projectId: "proj-rax-cmp-git",
    repoName: "proj-rax-cmp-git",
    repoRootPath: "/tmp/proj-rax-cmp-git",
    defaultAgentId: "main",
  });
  const lineages = connector.createLineages({
    projectId: "proj-rax-cmp-git",
    agents: [
      { agentId: "main", depth: 0 },
      { agentId: "child-a", parentAgentId: "main", depth: 1 },
    ],
  });
  const runtimes = connector.createBranchRuntimes({
    plan,
    lineages,
  });

  const bootstrap = await connector.bootstrapProject(plan);
  const branchBootstrap = await connector.bootstrapBranchRuntimes(runtimes);
  const checked = await connector.writeCheckedRef(runtimes[0], "abc123");
  const promoted = await connector.writePromotedRef(runtimes[0], "abc123");

  assert.equal(connector.metadata.ownership, "shared_infra");
  assert.equal(connector.metadata.scope, "multi_agent_system");
  assert.equal(bootstrap.projectRepo.projectId, "proj-rax-cmp-git");
  assert.equal(branchBootstrap.length, 2);
  assert.equal(checked.checkedCommitSha, "abc123");
  assert.equal(promoted.promotedCommitSha, "abc123");
});

test("cmp postgres connector can build contract adapter and bootstrap receipt through executor bridge", async () => {
  const executor = createCmpDbPsqlLiveExecutor({
    connection: {
      databaseName: "cmp_test",
    },
    commandRunner: async (invocation) => {
      return {
        stdout: invocation.statement.phase === "read" ? invocation.statement.target : "",
        stderr: "",
        exitCode: 0,
      };
    },
  });
  const connector = createCmpPostgresConnector({
    executor,
  });
  const contract = connector.createBootstrapContract({
    projectId: "proj-rax-cmp-db",
    agentIds: ["main", "child-a"],
    databaseName: "cmp_proj_rax_cmp_db",
    schemaName: "cmp_proj_rax_cmp_db",
  });
  const adapter = connector.createAdapter({
    topology: contract.topology,
    localTableSets: contract.localTableSets,
  });
  const executed = await connector.executeBootstrap(contract);
  const receipt = connector.createBootstrapReceiptFromReadback({
    contract,
    readbackRows: contract.readbackStatements.map((statement) => ({
      target: statement.target,
      tableRef: statement.target,
    })),
  });

  assert.equal(connector.metadata.ownership, "shared_infra");
  assert.equal(connector.metadata.scope, "multi_agent_system");
  assert.equal(adapter.driver, "postgresql");
  assert.equal(executed.receipt.status, "bootstrapped");
  assert.equal(receipt.status, "bootstrapped");
});

test("cmp redis connector keeps shared ownership and bridges publish paths through mq adapter", async () => {
  const connector = createCmpRedisConnector({
    adapter: createInMemoryCmpRedisMqAdapter(),
  });
  const bootstrap = await connector.bootstrapProject({
    projectId: "proj-rax-cmp-redis",
    agentId: "main",
    namespaceRoot: "praxis",
  });
  const publishReceipt = await connector.publishEnvelope({
    envelope: {
      envelopeId: "env-1",
      projectId: "proj-rax-cmp-redis",
      sourceAgentId: "main",
      direction: "peer",
      targetAgentIds: ["peer-a"],
      granularityLabel: "cmp-section",
      payloadRef: "section:1",
      createdAt: "2026-03-24T00:00:00.000Z",
    },
  });
  const escalationReceipt = await connector.publishCriticalEscalation({
    envelope: {
      escalationId: "esc-1",
      projectId: "proj-rax-cmp-redis",
      sourceAgentId: "main",
      targetAncestorId: "root",
      severity: "critical",
      reason: "infra down",
      evidenceRef: "evidence:1",
      createdAt: "2026-03-24T00:00:00.000Z",
      deliveryMode: "alert_envelope",
      redactionLevel: "summary_only",
    },
  });

  assert.equal(connector.metadata.ownership, "shared_infra");
  assert.equal(bootstrap.projectId, "proj-rax-cmp-redis");
  assert.equal(publishReceipt.channel, "peer");
  assert.equal(escalationReceipt.lane, "queue");
});

test("cmp shared infra connector bundle can compose git db and mq connectors together", () => {
  const bundle = createCmpSharedInfraConnectors({
    gitBackend: createInMemoryCmpGitBackend(),
    mqAdapter: createInMemoryCmpRedisMqAdapter(),
  });

  assert.equal(bundle.git.kind, "shared_git_infra");
  assert.equal(bundle.db.kind, "shared_postgresql");
  assert.equal(bundle.mq.kind, "shared_redis");
});
