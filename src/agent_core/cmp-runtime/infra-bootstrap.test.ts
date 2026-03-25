import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import {
  createCmpProjectDbTopology,
  createCmpAgentLocalTableSet,
  createCmpDbPostgresAdapter,
  createCmpDbPsqlLiveExecutor,
} from "../cmp-db/index.js";
import {
  createCmpGitProjectRepo,
  createGitCliCmpGitBackend,
} from "../cmp-git/index.js";
import {
  createInMemoryCmpRedisMqAdapter,
  createRedisCliCmpRedisMqAdapter,
} from "../cmp-mq/index.js";
import {
  createCmpProjectInfraBootstrapPlan,
  executeCmpProjectInfraBootstrap,
} from "./infra-bootstrap.js";

test("cmp runtime bootstrap plan can assemble git db and mq bootstrap artifacts for one project", () => {
  const plan = createCmpProjectInfraBootstrapPlan({
    projectId: "proj-bootstrap",
    repoName: "proj-bootstrap",
    repoRootPath: "/tmp/praxis/proj-bootstrap",
    agents: [
      { agentId: "main", depth: 0 },
      { agentId: "child-a", parentAgentId: "main", depth: 1 },
    ],
    databaseName: "cmp_proj_bootstrap",
    dbSchemaName: "cmp_proj_bootstrap",
    redisNamespaceRoot: "praxis",
  });

  assert.equal(plan.git.projectRepo.projectId, "proj-bootstrap");
  assert.equal(plan.db.projectId, "proj-bootstrap");
  assert.equal(plan.lineages.length, 2);
  assert.equal(plan.branchRuntimes.length, 2);
  assert.equal(plan.mqBootstraps.length, 2);
});

test("cmp runtime bootstrap execution can coordinate git and redis backends while carrying db contract", async () => {
  const plan = createCmpProjectInfraBootstrapPlan({
    projectId: "proj-bootstrap-exec",
    repoName: "proj-bootstrap-exec",
    repoRootPath: "/tmp/praxis/proj-bootstrap-exec",
    agents: [
      { agentId: "main", depth: 0 },
      { agentId: "child-a", parentAgentId: "main", depth: 1 },
    ],
  });

  const gitBackend = {
    bootstrapProjectRepo(gitPlan: typeof plan.git) {
      return {
        projectRepo: createCmpGitProjectRepo({
          projectId: gitPlan.projectRepo.projectId,
          repoName: gitPlan.projectRepo.repoName,
          defaultAgentId: gitPlan.projectRepo.defaultAgentId,
        }),
        repoRootPath: gitPlan.repoRootPath,
        defaultBranchName: gitPlan.defaultBranchName,
        createdBranchNames: gitPlan.branchKinds.map((kind) => `${kind}/${gitPlan.projectRepo.defaultAgentId}`),
        status: "bootstrapped" as const,
      };
    },
    bootstrapAgentBranchRuntime(runtime: (typeof plan.branchRuntimes)[number]) {
      return [
        runtime.branchFamily.work.fullRef,
        runtime.branchFamily.cmp.fullRef,
        runtime.branchFamily.mp.fullRef,
        runtime.branchFamily.tap.fullRef,
      ] as const;
    },
    readBranchHead(runtime: (typeof plan.branchRuntimes)[number]) {
      return {
        branchRef: runtime.branchFamily.cmp,
      };
    },
    writeCheckedRef(runtime: (typeof plan.branchRuntimes)[number], commitSha: string) {
      return {
        branchRef: runtime.branchFamily.cmp,
        checkedRefName: runtime.checkedRefName,
        checkedCommitSha: commitSha,
      };
    },
    writePromotedRef(runtime: (typeof plan.branchRuntimes)[number], commitSha: string) {
      return {
        branchRef: runtime.branchFamily.cmp,
        promotedRefName: runtime.promotedRefName,
        promotedCommitSha: commitSha,
      };
    },
  };
  const receipt = await executeCmpProjectInfraBootstrap({
    plan,
    gitBackend,
    mqAdapter: createInMemoryCmpRedisMqAdapter(),
  });

  assert.equal(receipt.git.status, "bootstrapped");
  assert.equal(receipt.gitBranchBootstraps.length, 2);
  assert.equal(receipt.db.projectId, "proj-bootstrap-exec");
  assert.equal(receipt.dbReceipt.status, "readback_incomplete");
  assert.equal(receipt.mqBootstraps.length, 2);
});

test("cmp runtime bootstrap can run across live git psql and redis backends when explicitly enabled", async (t) => {
  if (process.env.PRAXIS_CMP_INFRA_LIVE !== "1") {
    t.skip("Set PRAXIS_CMP_INFRA_LIVE=1 to run live CMP infra bootstrap smoke.");
    return;
  }

  const repoRootPath = await mkdtemp(path.join(os.tmpdir(), "praxis-cmp-infra-live-"));
  const projectId = `proj-live-${Date.now()}`;
  const databaseName = process.env.PRAXIS_CMP_DB_NAME?.trim() || "postgres";
  const dbSchemaName = `cmp_${projectId.replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase()}`;
  const plan = createCmpProjectInfraBootstrapPlan({
    projectId,
    repoName: projectId,
    repoRootPath,
    agents: [
      { agentId: "main", depth: 0 },
      { agentId: "child-a", parentAgentId: "main", depth: 1 },
    ],
    databaseName,
    dbSchemaName,
    redisNamespaceRoot: "praxis",
  });

  const receipt = await executeCmpProjectInfraBootstrap({
    plan,
    gitBackend: createGitCliCmpGitBackend(),
    dbExecutor: createCmpDbPsqlLiveExecutor({
      connection: {
        databaseName,
        host: process.env.PRAXIS_CMP_DB_HOST?.trim() || undefined,
        port: process.env.PRAXIS_CMP_DB_PORT ? Number(process.env.PRAXIS_CMP_DB_PORT) : undefined,
        user: process.env.PRAXIS_CMP_DB_USER?.trim() || undefined,
      },
    }),
    mqAdapter: createRedisCliCmpRedisMqAdapter({
      host: process.env.PRAXIS_CMP_REDIS_HOST?.trim() || undefined,
      port: process.env.PRAXIS_CMP_REDIS_PORT ? Number(process.env.PRAXIS_CMP_REDIS_PORT) : undefined,
      url: process.env.PRAXIS_CMP_REDIS_URL?.trim() || undefined,
      database: process.env.PRAXIS_CMP_REDIS_DB ? Number(process.env.PRAXIS_CMP_REDIS_DB) : undefined,
    }),
  });

  assert.equal(receipt.git.status, "bootstrapped");
  assert.equal(receipt.dbReceipt.status, "bootstrapped");
  assert.equal(receipt.mqBootstraps.length, 2);
});
