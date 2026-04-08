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
});
