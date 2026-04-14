import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveCapabilityFamilyDefinition,
  shouldRenderCapabilityFamilyBlock,
} from "./family-telemetry.js";

test("resolveCapabilityFamilyDefinition maps known capabilities into display families", () => {
  assert.equal(resolveCapabilityFamilyDefinition("search.web")?.familyKey, "websearch");
  assert.equal(resolveCapabilityFamilyDefinition("code.read")?.familyKey, "code");
  assert.equal(resolveCapabilityFamilyDefinition("shell.session")?.familyKey, "shell");
});

test("shouldRenderCapabilityFamilyBlock accepts explicit telemetry families", () => {
  assert.equal(shouldRenderCapabilityFamilyBlock({ familyKey: "workflow" }), true);
});

test("shouldRenderCapabilityFamilyBlock accepts inferred capability families", () => {
  assert.equal(shouldRenderCapabilityFamilyBlock({ capabilityKey: "code.read" }), true);
  assert.equal(shouldRenderCapabilityFamilyBlock({ capabilityKey: "git.status" }), true);
});

test("shouldRenderCapabilityFamilyBlock rejects unknown capabilities without family telemetry", () => {
  assert.equal(shouldRenderCapabilityFamilyBlock({ capabilityKey: "totally.unknown" }), false);
  assert.equal(shouldRenderCapabilityFamilyBlock({}), false);
});
