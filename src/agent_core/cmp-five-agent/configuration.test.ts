import assert from "node:assert/strict";
import test from "node:test";

import {
  CMP_DEFAULT_ROLE_LIVE_LLM_MODES,
  CMP_FIVE_AGENT_CONFIGURATION_VERSION,
  createCmpFiveAgentCapabilityMatrixSummary,
  createCmpFiveAgentRoleSummaryCatalog,
  createCmpRoleLiveLlmModeCatalog,
  createCmpFiveAgentTapProfileCatalog,
  createCmpRoleTapProfile,
  createCmpRoleCapabilityMatrix,
  createDefaultCmpFiveAgentRoleCatalog,
  getCmpDefaultRoleLiveLlmMode,
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
  const checker = getCmpFiveAgentRoleDefinition("checker");
  const dbagent = getCmpFiveAgentRoleDefinition("dbagent");
  const dispatcher = getCmpFiveAgentRoleDefinition("dispatcher");

  assert.equal(CMP_FIVE_AGENT_CONFIGURATION_VERSION, "cmp-five-agent-role-catalog/v1");
  assert.match(icma.promptPack.systemPrompt, /root system prompt/i);
  assert.equal(icma.capabilityContract.git.access, "none");
  assert.match(icma.promptPack.handoffContract, /multiple intent chunks/i);
  assert.equal(iterator.capabilityContract.git.access, "write");
  assert.match(iterator.capabilityContract.git.rationale, /primary writer/i);
  assert.ok(iterator.promptPack.outputContract.includes("progression verdict"));
  assert.match(checker.promptPack.mission, /executable split\/merge semantics/i);
  assert.ok(checker.promptPack.outputContract.includes("split execution semantics"));
  assert.match(dbagent.promptPack.mission, /primary-package, timeline-package, task-snapshot, and passive-history/i);
  assert.ok(dbagent.promptPack.outputContract.includes("passive historical reply package"));
  assert.equal(dispatcher.capabilityContract.git.access, "none");
  assert.match(dispatcher.promptPack.mission, /peer-slim/i);
  assert.match(dispatcher.promptPack.guardrails.join(" "), /child icma only/i);
  assert.ok(dispatcher.promptPack.outputContract.includes("peer slim exchange bundle"));
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
  assert.ok(getCmpFiveAgentRoleDefinition("checker").promptPack.outputContract.includes("split execution semantics"));
  assert.ok(getCmpFiveAgentRoleDefinition("dbagent").promptPack.outputContract.includes("package-specific strategy set"));
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

test("cmp five-agent configuration exposes default live llm modes for every role", () => {
  const catalog = createCmpRoleLiveLlmModeCatalog();

  assert.deepEqual(CMP_DEFAULT_ROLE_LIVE_LLM_MODES, {
    icma: "llm_assisted",
    iterator: "llm_assisted",
    checker: "llm_assisted",
    dbagent: "llm_assisted",
    dispatcher: "llm_assisted",
  });
  assert.equal(getCmpDefaultRoleLiveLlmMode("icma"), "llm_assisted");
  assert.equal(getCmpDefaultRoleLiveLlmMode("dispatcher"), "llm_assisted");
  assert.equal(catalog.checker, "llm_assisted");
});

test("cmp five-agent configuration reflects the chosen fine-grained strategy deltas", () => {
  const icma = getCmpFiveAgentRoleDefinition("icma");
  const checker = getCmpFiveAgentRoleDefinition("checker");
  const dbagent = getCmpFiveAgentRoleDefinition("dbagent");
  const dispatcher = getCmpFiveAgentRoleDefinition("dispatcher");

  assert.match(icma.profile.responsibilities.join(" "), /Auto-detect controlled fragment kinds/i);
  assert.ok(icma.promptPack.outputContract.includes("chunk-level operator/child guide set"));
  assert.match(checker.promptPack.guardrails.join(" "), /Execution semantics are advisory/i);
  assert.match(checker.profile.responsibilities.join(" "), /execution-grade split\/merge semantics/i);
  assert.match(dbagent.promptPack.guardrails.join(" "), /active package, timeline package, task snapshots, and passive packaging strategies/i);
  assert.match(dispatcher.profile.responsibilities.join(" "), /child seed, peer slim exchange, and passive return/i);
});
