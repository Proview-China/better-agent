import assert from "node:assert/strict";
import test from "node:test";

import {
  createMpFiveAgentCapabilityMatrixSummary,
  createMpFiveAgentConfiguration,
  createMpFiveAgentRoleSummaryCatalog,
  createMpFiveAgentTapProfileSummaryCatalog,
  MP_FIVE_AGENT_CONFIGURATION_VERSION,
} from "./index.js";

test("mp five-agent configuration exposes five separated role definitions", () => {
  const configuration = createMpFiveAgentConfiguration();
  assert.equal(configuration.version, MP_FIVE_AGENT_CONFIGURATION_VERSION);
  assert.equal(configuration.roles.icma.promptPack.promptPackId, "mp-five-agent/icma-prompt-pack/v1");
  assert.equal(configuration.roles.dispatcher.capabilityContract.contractId, "mp-five-agent/dispatcher-capability-contract/v1");
});

test("mp five-agent summary catalogs are readback friendly", () => {
  const summaryCatalog = createMpFiveAgentRoleSummaryCatalog();
  const tapProfiles = createMpFiveAgentTapProfileSummaryCatalog();
  const matrix = createMpFiveAgentCapabilityMatrixSummary();

  assert.equal(summaryCatalog.checker.tapProfileId, "mp-five-agent/checker-tap-profile/v1");
  assert.equal(tapProfiles.dbagent.profileId, "mp-five-agent/dbagent-tap-profile/v1");
  assert.deepEqual(matrix.memoryWriters, ["dbagent"]);
  assert.deepEqual(matrix.retrievalOwners, ["dispatcher"]);
});
