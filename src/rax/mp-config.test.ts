import assert from "node:assert/strict";
import test from "node:test";

import { createRaxMpConfig, loadRaxMpConfigFromEnv } from "./mp-config.js";

test("createRaxMpConfig fills stable defaults for lance-backed mp runtime", () => {
  const config = createRaxMpConfig({
    projectId: "proj-mp",
  });

  assert.equal(config.profileId, "mp.default");
  assert.equal(config.defaultAgentId, "main");
  assert.equal(config.mode, "balanced");
  assert.equal(config.lance.kind, "lancedb");
  assert.equal(config.lance.schemaVersion, 1);
  assert.equal(config.lance.liveExecutionPreferred, true);
  assert.equal(config.searchDefaults.limit, 10);
  assert.deepEqual(config.searchDefaults.scopeLevels, ["agent_isolated", "project", "global"]);
  assert.equal(config.searchDefaults.preferSameAgent, true);
  assert.equal(config.workflow.enabled, true);
  assert.equal(config.workflow.roleModes.icma, "llm_assisted");
  assert.equal(config.workflow.freshnessPolicy.preferFresh, true);
  assert.equal(config.workflow.alignmentPolicy.autoSupersede, true);
  assert.equal(config.workflow.retrievalPolicy.primaryBundleLimit, 3);
});

test("loadRaxMpConfigFromEnv reads explicit environment overrides", () => {
  const config = loadRaxMpConfigFromEnv({
    PRAXIS_MP_PROJECT_ID: "proj-env",
    PRAXIS_MP_PROFILE_ID: "mp.env",
    PRAXIS_MP_DEFAULT_AGENT_ID: "lead",
    PRAXIS_MP_MODE: "shared_first",
    PRAXIS_MP_ROOT_PATH: "/tmp/praxis/mp/proj-env",
    PRAXIS_MP_SCHEMA_VERSION: "3",
    PRAXIS_MP_LIVE: "0",
    PRAXIS_MP_SEARCH_LIMIT: "15",
    PRAXIS_MP_SCOPE_LEVELS: "project,global",
    PRAXIS_MP_PREFER_SAME_AGENT: "0",
    PRAXIS_MP_WORKFLOW_ENABLED: "1",
    PRAXIS_MP_PREFER_FRESH: "0",
    PRAXIS_MP_ALLOW_STALE_FALLBACK: "0",
    PRAXIS_MP_AUTO_SUPERSEDE: "0",
    PRAXIS_MP_MARK_OLDER_STALE: "0",
    PRAXIS_MP_PRIMARY_BUNDLE_LIMIT: "4",
    PRAXIS_MP_SUPPORTING_BUNDLE_LIMIT: "6",
    PRAXIS_MP_OMIT_SUPERSEDED_PRIMARY: "0",
  });

  assert.equal(config.projectId, "proj-env");
  assert.equal(config.profileId, "mp.env");
  assert.equal(config.defaultAgentId, "lead");
  assert.equal(config.mode, "shared_first");
  assert.equal(config.lance.rootPath, "/tmp/praxis/mp/proj-env");
  assert.equal(config.lance.schemaVersion, 3);
  assert.equal(config.lance.liveExecutionPreferred, false);
  assert.equal(config.searchDefaults.limit, 15);
  assert.deepEqual(config.searchDefaults.scopeLevels, ["project", "global"]);
  assert.equal(config.searchDefaults.preferSameAgent, false);
  assert.equal(config.workflow.freshnessPolicy.preferFresh, false);
  assert.equal(config.workflow.freshnessPolicy.allowStaleFallback, false);
  assert.equal(config.workflow.alignmentPolicy.autoSupersede, false);
  assert.equal(config.workflow.alignmentPolicy.markOlderAsStale, false);
  assert.equal(config.workflow.retrievalPolicy.primaryBundleLimit, 4);
  assert.equal(config.workflow.retrievalPolicy.supportingBundleLimit, 6);
  assert.equal(config.workflow.retrievalPolicy.omitSupersededFromPrimary, false);
});
