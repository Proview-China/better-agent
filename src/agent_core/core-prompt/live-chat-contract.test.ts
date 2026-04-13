import assert from "node:assert/strict";
import test from "node:test";

import {
  createCoreActionPlannerContractLines,
  createCoreUserInputContractLines,
} from "./live-chat-contract.js";

test("createCoreUserInputContractLines keeps heavy contract guidance in dedicated surface", () => {
  const lines = createCoreUserInputContractLines({});

  assert.match(lines[0] ?? "", /Exact JSON schema/);
  assert.match(lines.join("\n"), /shell\.restricted/);
  assert.match(lines.join("\n"), /Return JSON only/);
});

test("createCoreActionPlannerContractLines returns thinner planner contract surface", () => {
  const lines = createCoreActionPlannerContractLines();

  assert.match(lines[0] ?? "", /Schema:/);
  assert.match(lines.join("\n"), /capabilityRequest/);
  assert.doesNotMatch(lines.join("\n"), /shell\.restricted, use structured input/);
});
