import assert from "node:assert/strict";
import test from "node:test";

import { createRaxCmpConfig, loadRaxCmpConfigFromEnv } from "./cmp-config.js";

test("createRaxCmpConfig fills stable defaults for shared git infra and live db/mq", () => {
  const config = createRaxCmpConfig({
    projectId: "proj-cmp",
    git: {
      repoName: "proj-cmp",
      repoRootPath: "/tmp/praxis/proj-cmp",
    },
  });

  assert.equal(config.profileId, "cmp.default");
  assert.equal(config.defaultAgentId, "main");
  assert.equal(config.mode, "active_preferred");
  assert.equal(config.controlDefaults.executionStyle, "automatic");
  assert.equal(config.controlDefaults.truth.readbackPriority, "db_first");
  assert.equal(config.controlDefaults.truth.fallbackPolicy, "git_rebuild");
  assert.equal(config.controlDefaults.truth.recoveryPreference, "reconcile");
  assert.equal(config.controlDefaults.scope.dispatch, "lineage_only");
  assert.equal(config.controlDefaults.automation.autoReturnToCoreAgent, true);
  assert.equal(config.controlDefaults.automation.autoSeedChildren, true);
  assert.equal(config.git.provider, "shared_git_infra");
  assert.equal(config.git.defaultBranchName, "main");
  assert.equal(config.db.kind, "postgresql");
  assert.equal(config.db.liveExecutionPreferred, true);
  assert.equal(config.mq.kind, "redis");
  assert.equal(config.mq.liveExecutionPreferred, true);
});

test("loadRaxCmpConfigFromEnv reads explicit environment overrides", () => {
  const config = loadRaxCmpConfigFromEnv({
    PRAXIS_CMP_PROJECT_ID: "proj-env",
    PRAXIS_CMP_REPO_ROOT: "/tmp/praxis/proj-env",
    PRAXIS_CMP_REPO_NAME: "proj-env-repo",
    PRAXIS_CMP_DEFAULT_AGENT_ID: "lead",
    PRAXIS_CMP_MODE: "mixed",
    PRAXIS_CMP_EXECUTION_STYLE: "manual",
    PRAXIS_CMP_READBACK_PRIORITY: "reconcile",
    PRAXIS_CMP_FALLBACK_POLICY: "degraded",
    PRAXIS_CMP_RECOVERY_PREFERENCE: "infra_first",
    PRAXIS_CMP_DISPATCH_SCOPE: "manual_targets",
    PRAXIS_CMP_GIT_DEFAULT_BRANCH: "trunk",
    PRAXIS_CMP_DB_NAME: "cmp_proj_env",
    PRAXIS_CMP_DB_SCHEMA: "cmp_proj_env",
    PRAXIS_CMP_DB_LIVE: "0",
    PRAXIS_CMP_REDIS_NAMESPACE_ROOT: "praxis",
    PRAXIS_CMP_REDIS_LIVE: "0",
    PRAXIS_CMP_AUTO_RETURN_TO_CORE_AGENT: "0",
    PRAXIS_CMP_AUTO_SEED_CHILDREN: "0",
  });

  assert.equal(config.projectId, "proj-env");
  assert.equal(config.defaultAgentId, "lead");
  assert.equal(config.mode, "mixed");
  assert.equal(config.controlDefaults.executionStyle, "manual");
  assert.equal(config.controlDefaults.truth.readbackPriority, "reconcile");
  assert.equal(config.controlDefaults.truth.fallbackPolicy, "degraded");
  assert.equal(config.controlDefaults.truth.recoveryPreference, "infra_first");
  assert.equal(config.controlDefaults.scope.dispatch, "manual_targets");
  assert.equal(config.controlDefaults.automation.autoReturnToCoreAgent, false);
  assert.equal(config.controlDefaults.automation.autoSeedChildren, false);
  assert.equal(config.git.repoName, "proj-env-repo");
  assert.equal(config.git.defaultBranchName, "trunk");
  assert.equal(config.db.databaseName, "cmp_proj_env");
  assert.equal(config.db.schemaName, "cmp_proj_env");
  assert.equal(config.db.liveExecutionPreferred, false);
  assert.equal(config.mq.namespaceRoot, "praxis");
  assert.equal(config.mq.liveExecutionPreferred, false);
});

test("createRaxCmpConfig merges explicit control defaults onto mode-aware defaults", () => {
  const config = createRaxCmpConfig({
    projectId: "proj-control",
    mode: "mixed",
    controlDefaults: {
      executionStyle: "guided",
      scope: {
        dispatch: "core_agent_only",
        lineage: {
          agentIds: [" main ", "worker-a", "main"],
          branchFamilies: ["cmp", "tap"],
        },
      },
      automation: {
        autoDispatch: false,
        autoSeedChildren: false,
      },
    },
    git: {
      repoName: "proj-control",
      repoRootPath: "/tmp/praxis/proj-control",
    },
  });

  assert.equal(config.controlDefaults.mode, "mixed");
  assert.equal(config.controlDefaults.executionStyle, "guided");
  assert.deepEqual(config.controlDefaults.scope.lineage.agentIds, ["main", "worker-a"]);
  assert.deepEqual(config.controlDefaults.scope.lineage.branchFamilies, ["cmp", "tap"]);
  assert.equal(config.controlDefaults.scope.dispatch, "core_agent_only");
  assert.equal(config.controlDefaults.automation.autoDispatch, false);
  assert.equal(config.controlDefaults.automation.autoSeedChildren, false);
  assert.equal(config.controlDefaults.automation.autoReturnToCoreAgent, true);
});
