import assert from "node:assert/strict";
import test from "node:test";

import {
  CMP_FIVE_AGENT_CONFIGURATION_VERSION,
  createCmpFiveAgentCapabilityMatrixSummary,
  createCmpFiveAgentRoleSummaryCatalog,
  createCmpFiveAgentTapProfileCatalog,
  createCmpRoleTapProfile,
  createCmpRoleCapabilityMatrix,
  createDefaultCmpFiveAgentRoleCatalog,
  getCmpFiveAgentRoleDefinition,
} from "./configuration.js";
import { isCapabilityAllowedByProfile } from "../ta-pool-types/index.js";

test("cmp five-agent role catalog exposes five separated role definitions", () => {
  const catalog = createDefaultCmpFiveAgentRoleCatalog();

  assert.deepEqual(Object.keys(catalog), ["icma", "iterator", "checker", "dbagent", "dispatcher"]);
  assert.equal(catalog.icma.promptPack.systemPolicy, "append_only_fragment");
  assert.equal(catalog.iterator.profile.ownsStages.at(-1), "update_review_ref");
  assert.equal(catalog.checker.capabilityContract.git.access, "limited_write");
  assert.equal(catalog.dbagent.capabilityContract.db.access, "write");
  assert.equal(catalog.dispatcher.capabilityContract.mq.access, "route_only");
});

test("getCmpFiveAgentRoleDefinition preserves hard boundaries and authority edges", () => {
  const icma = getCmpFiveAgentRoleDefinition("icma");
  const iterator = getCmpFiveAgentRoleDefinition("iterator");
  const dispatcher = getCmpFiveAgentRoleDefinition("dispatcher");

  assert.equal(CMP_FIVE_AGENT_CONFIGURATION_VERSION, "cmp-five-agent-role-catalog/v1");
  assert.match(icma.promptPack.systemPrompt, /root system prompt/i);
  assert.equal(icma.capabilityContract.git.access, "none");
  assert.equal(iterator.capabilityContract.git.access, "write");
  assert.match(iterator.capabilityContract.git.rationale, /primary writer/i);
  assert.equal(dispatcher.capabilityContract.git.access, "none");
  assert.match(dispatcher.promptPack.guardrails.join(" "), /child icma only/i);
});

test("cmp five-agent role summary catalog and capability matrix are readback friendly", () => {
  const summary = createCmpFiveAgentRoleSummaryCatalog();
  const matrix = createCmpRoleCapabilityMatrix();
  const capabilitySummary = createCmpFiveAgentCapabilityMatrixSummary();

  assert.equal(summary.icma.promptPackId, "cmp-five-agent/icma-prompt-pack/v1");
  assert.equal(summary.iterator.gitAccessLevel, "write");
  assert.equal(summary.dbagent.dbAccessLevel, "write");
  assert.equal(summary.dispatcher.mqAccessLevel, "route_only");
  assert.equal(summary.iterator.tapProfileId, "cmp-five-agent/iterator-tap-profile/v1");

  const dbagent = matrix.find((entry) => entry.role === "dbagent");
  const dispatcher = matrix.find((entry) => entry.role === "dispatcher");
  assert.equal(dbagent?.db.accessLevel, "write");
  assert.equal(dbagent?.db.ownership, "primary");
  assert.equal(dispatcher?.git.accessLevel, "none");
  assert.deepEqual(capabilitySummary.gitWriters, ["iterator", "checker"]);
  assert.deepEqual(capabilitySummary.dbWriters, ["dbagent"]);
  assert.deepEqual(capabilitySummary.mqPublishers, ["icma", "dispatcher"]);
});

test("cmp five-agent configuration compiles role-specific TAP profiles from capability contracts", () => {
  const iterator = createCmpRoleTapProfile("iterator");
  const dbagent = createCmpRoleTapProfile("dbagent");
  const dispatcher = createCmpRoleTapProfile("dispatcher");
  const icma = createCmpRoleTapProfile("icma");
  const checker = createCmpRoleTapProfile("checker");
  const catalog = createCmpFiveAgentTapProfileCatalog();

  assert.equal(iterator.profileId, "cmp-five-agent/iterator-tap-profile/v1");
  assert.equal(iterator.agentClass, "cmp-five-agent.iterator");
  assert.equal(iterator.baselineTier, "B2");
  assert.equal(isCapabilityAllowedByProfile({ profile: iterator, capabilityKey: "cmp.git.write" }), true);
  assert.equal(isCapabilityAllowedByProfile({ profile: iterator, capabilityKey: "cmp.db.write" }), false);

  assert.equal(dbagent.profileId, "cmp-five-agent/dbagent-tap-profile/v1");
  assert.equal(isCapabilityAllowedByProfile({ profile: dbagent, capabilityKey: "cmp.db.write" }), true);
  assert.equal(isCapabilityAllowedByProfile({ profile: dbagent, capabilityKey: "cmp.git.write" }), false);

  assert.equal(dispatcher.profileId, "cmp-five-agent/dispatcher-tap-profile/v1");
  assert.equal(isCapabilityAllowedByProfile({ profile: dispatcher, capabilityKey: "cmp.mq.publish.delivery" }), true);
  assert.equal(isCapabilityAllowedByProfile({ profile: dispatcher, capabilityKey: "cmp.git.write" }), false);

  assert.equal(icma.profileId, "cmp-five-agent/icma-tap-profile/v1");
  assert.equal(isCapabilityAllowedByProfile({ profile: icma, capabilityKey: "cmp.git.write" }), false);
  assert.equal(isCapabilityAllowedByProfile({ profile: icma, capabilityKey: "cmp.mq.publish.input" }), true);

  assert.equal(checker.profileId, "cmp-five-agent/checker-tap-profile/v1");
  assert.equal(isCapabilityAllowedByProfile({ profile: checker, capabilityKey: "cmp.git.review_fix" }), true);
  assert.equal(isCapabilityAllowedByProfile({ profile: checker, capabilityKey: "cmp.git.write" }), false);

  assert.equal(catalog.dispatcher.profileId, dispatcher.profileId);
});
