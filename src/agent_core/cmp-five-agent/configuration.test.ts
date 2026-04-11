import assert from "node:assert/strict";
import test from "node:test";

import {
  CMP_DEFAULT_ROLE_LIVE_LLM_MODES,
  CMP_FIVE_AGENT_CONFIGURATION_VERSION,
  createCmpFiveAgentCapabilityMatrixSummary,
  createCmpFiveAgentConfiguration,
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

test("cmp five-agent configuration can produce a lean prompt variant for comparison runs", () => {
  const baseline = createCmpFiveAgentConfiguration();
  const lean = createCmpFiveAgentConfiguration({ promptVariant: "lean_v2" });

  assert.equal(baseline.version, CMP_FIVE_AGENT_CONFIGURATION_VERSION);
  assert.equal(lean.version, `${CMP_FIVE_AGENT_CONFIGURATION_VERSION}:lean_v2`);
  assert.equal(lean.roles.icma.promptPack.promptPackId, "cmp-five-agent/icma-prompt-pack/lean-v2");
  assert.equal(lean.roles.checker.promptPack.promptPackId, "cmp-five-agent/checker-prompt-pack/lean-v2");
  assert.equal(lean.roles.dbagent.promptPack.promptPackId, "cmp-five-agent/dbagent-prompt-pack/lean-v2");
  assert.ok(
    lean.roles.icma.promptPack.guardrails.join(" ").length
      < baseline.roles.icma.promptPack.guardrails.join(" ").length,
  );
  assert.ok(
    lean.roles.dbagent.promptPack.guardrails.join(" ").length
      < baseline.roles.dbagent.promptPack.guardrails.join(" ").length,
  );
  assert.ok(
    lean.roles.checker.promptPack.mission.length
      < baseline.roles.checker.promptPack.mission.length,
  );
  assert.deepEqual(
    lean.roles.dispatcher.promptPack.outputContract,
    baseline.roles.dispatcher.promptPack.outputContract,
  );
});

test("cmp five-agent configuration can produce a workflow-aligned prompt variant for checker and dbagent", () => {
  const baseline = createCmpFiveAgentConfiguration();
  const workflow = createCmpFiveAgentConfiguration({ promptVariant: "workflow_v3" });

  assert.equal(workflow.version, `${CMP_FIVE_AGENT_CONFIGURATION_VERSION}:workflow_v3`);
  assert.equal(workflow.roles.icma.promptPack.promptPackId, "cmp-five-agent/icma-prompt-pack/lean-v2");
  assert.equal(workflow.roles.checker.promptPack.promptPackId, "cmp-five-agent/checker-prompt-pack/workflow-v3");
  assert.equal(workflow.roles.dbagent.promptPack.promptPackId, "cmp-five-agent/dbagent-prompt-pack/workflow-v3");
  assert.match(workflow.roles.checker.promptPack.guardrails.join(" "), /checked-ready output before any escalation signal/i);
  assert.match(workflow.roles.dbagent.promptPack.guardrails.join(" "), /passive mode, prioritize clean historical return/i);
  assert.match(workflow.roles.checker.promptPack.handoffContract, /checked core first/i);
  assert.match(workflow.roles.dbagent.promptPack.handoffContract, /minimum review state needed/i);
  assert.equal(workflow.roles.iterator.promptPack.promptPackId, baseline.roles.iterator.promptPack.promptPackId);
  assert.equal(workflow.roles.dispatcher.promptPack.promptPackId, baseline.roles.dispatcher.promptPack.promptPackId);
});

test("cmp five-agent configuration can produce a full workmode-aligned prompt variant", () => {
  const baseline = createCmpFiveAgentConfiguration();
  const workmode = createCmpFiveAgentConfiguration({ promptVariant: "workmode_v4" });

  assert.equal(workmode.version, `${CMP_FIVE_AGENT_CONFIGURATION_VERSION}:workmode_v4`);
  assert.equal(workmode.roles.icma.promptPack.promptPackId, "cmp-five-agent/icma-prompt-pack/workmode-v4");
  assert.equal(workmode.roles.iterator.promptPack.promptPackId, "cmp-five-agent/iterator-prompt-pack/workmode-v4");
  assert.equal(workmode.roles.checker.promptPack.promptPackId, "cmp-five-agent/checker-prompt-pack/workmode-v4");
  assert.equal(workmode.roles.dbagent.promptPack.promptPackId, "cmp-five-agent/dbagent-prompt-pack/workmode-v4");
  assert.equal(workmode.roles.dispatcher.promptPack.promptPackId, "cmp-five-agent/dispatcher-prompt-pack/workmode-v4");
  assert.match(workmode.roles.icma.promptPack.systemPrompt, /pre-processing/i);
  assert.match(workmode.roles.iterator.promptPack.systemPrompt, /line and granularity governor/i);
  assert.match(workmode.roles.checker.promptPack.systemPrompt, /signal quality and direction/i);
  assert.match(workmode.roles.dbagent.promptPack.systemPrompt, /high-value sections/i);
  assert.match(workmode.roles.dispatcher.promptPack.systemPrompt, /control console/i);
  assert.deepEqual(workmode.roles.dispatcher.promptPack.outputContract, baseline.roles.dispatcher.promptPack.outputContract);
});

test("cmp five-agent configuration can produce a v5 workmode prompt variant aligned to async companion workflow", () => {
  const workmode = createCmpFiveAgentConfiguration({ promptVariant: "workmode_v5" });

  assert.equal(workmode.version, `${CMP_FIVE_AGENT_CONFIGURATION_VERSION}:workmode_v5`);
  assert.equal(workmode.roles.icma.promptPack.promptPackId, "cmp-five-agent/icma-prompt-pack/workmode-v5");
  assert.equal(workmode.roles.iterator.promptPack.promptPackId, "cmp-five-agent/iterator-prompt-pack/workmode-v5");
  assert.equal(workmode.roles.checker.promptPack.promptPackId, "cmp-five-agent/checker-prompt-pack/workmode-v5");
  assert.equal(workmode.roles.dbagent.promptPack.promptPackId, "cmp-five-agent/dbagent-prompt-pack/workmode-v5");
  assert.equal(workmode.roles.dispatcher.promptPack.promptPackId, "cmp-five-agent/dispatcher-prompt-pack/workmode-v5");
  assert.match(workmode.roles.icma.promptPack.systemPrompt, /pre-processing desk/i);
  assert.match(workmode.roles.iterator.promptPack.systemPrompt, /package-line and granularity governor/i);
  assert.match(workmode.roles.checker.promptPack.systemPrompt, /signal and direction gate/i);
  assert.match(workmode.roles.dbagent.promptPack.systemPrompt, /package truth manager/i);
  assert.match(workmode.roles.dispatcher.promptPack.systemPrompt, /control console/i);
});

test("cmp five-agent configuration can produce a v6 workmode prompt variant with tighter contract discipline", () => {
  const workmode = createCmpFiveAgentConfiguration({ promptVariant: "workmode_v6" });

  assert.equal(workmode.version, `${CMP_FIVE_AGENT_CONFIGURATION_VERSION}:workmode_v6`);
  assert.equal(workmode.roles.icma.promptPack.promptPackId, "cmp-five-agent/icma-prompt-pack/workmode-v6");
  assert.equal(workmode.roles.iterator.promptPack.promptPackId, "cmp-five-agent/iterator-prompt-pack/workmode-v6");
  assert.equal(workmode.roles.checker.promptPack.promptPackId, "cmp-five-agent/checker-prompt-pack/workmode-v6");
  assert.equal(workmode.roles.dbagent.promptPack.promptPackId, "cmp-five-agent/dbagent-prompt-pack/workmode-v6");
  assert.equal(workmode.roles.dispatcher.promptPack.promptPackId, "cmp-five-agent/dispatcher-prompt-pack/workmode-v6");
  assert.match(workmode.roles.dbagent.promptPack.guardrails.join(" "), /existing strategy fields/i);
  assert.match(workmode.roles.checker.promptPack.systemPrompt, /signal and direction gate/i);
});

test("cmp five-agent configuration can produce a v7 workmode prompt variant with a narrower ICMA desk", () => {
  const workmode = createCmpFiveAgentConfiguration({ promptVariant: "workmode_v7" });

  assert.equal(workmode.version, `${CMP_FIVE_AGENT_CONFIGURATION_VERSION}:workmode_v7`);
  assert.equal(workmode.roles.icma.promptPack.promptPackId, "cmp-five-agent/icma-prompt-pack/workmode-v7");
  assert.equal(workmode.roles.dispatcher.promptPack.promptPackId, "cmp-five-agent/dispatcher-prompt-pack/workmode-v7");
  assert.match(workmode.roles.icma.promptPack.systemPrompt, /pre-processing desk/i);
  assert.ok(
    workmode.roles.icma.promptPack.mission.length
      < createCmpFiveAgentConfiguration({ promptVariant: "workmode_v6" }).roles.icma.promptPack.mission.length,
  );
});

test("cmp five-agent configuration can produce a v8 hybrid workmode variant", () => {
  const baseline = createCmpFiveAgentConfiguration();
  const v8 = createCmpFiveAgentConfiguration({ promptVariant: "workmode_v8" });

  assert.equal(v8.version, `${CMP_FIVE_AGENT_CONFIGURATION_VERSION}:workmode_v8`);
  assert.equal(v8.roles.icma.promptPack.promptPackId, baseline.roles.icma.promptPack.promptPackId);
  assert.equal(v8.roles.iterator.promptPack.promptPackId, baseline.roles.iterator.promptPack.promptPackId);
  assert.equal(v8.roles.dispatcher.promptPack.promptPackId, baseline.roles.dispatcher.promptPack.promptPackId);
  assert.equal(v8.roles.checker.promptPack.promptPackId, "cmp-five-agent/checker-prompt-pack/workmode-v6");
  assert.equal(v8.roles.dbagent.promptPack.promptPackId, "cmp-five-agent/dbagent-prompt-pack/workmode-v6");
});
