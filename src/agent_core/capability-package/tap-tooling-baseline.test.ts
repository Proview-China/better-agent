import assert from "node:assert/strict";
import test from "node:test";

import {
  TAP_TOOLING_BASELINE_CAPABILITY_KEYS,
  createTapToolingBaselineCapabilityPackages,
  createTapToolingCapabilityPackage,
  isTapToolingBaselineCapabilityKey,
} from "./tap-tooling-baseline.js";

test("tap tooling capability package catalog exposes the bootstrap B-group capabilities", () => {
  const packages = createTapToolingBaselineCapabilityPackages();

  assert.deepEqual(
    packages.map((capabilityPackage) => capabilityPackage.manifest.capabilityKey),
    [...TAP_TOOLING_BASELINE_CAPABILITY_KEYS],
  );
});

test("repo.write package carries workspace write baseline and formal activation data", () => {
  const capabilityPackage = createTapToolingCapabilityPackage("repo.write");

  assert.equal(capabilityPackage.policy.riskLevel, "normal");
  assert.equal(capabilityPackage.policy.defaultBaseline.grantedTier, "B0");
  assert.equal(
    capabilityPackage.activationSpec?.adapterFactoryRef,
    "factory:tap-tooling:repo.write",
  );
  assert.equal(
    capabilityPackage.policy.defaultBaseline.scope?.allowedOperations?.includes("repo.write"),
    true,
  );
});

test("shell.restricted package stays formal but keeps risky policy metadata", () => {
  const capabilityPackage = createTapToolingCapabilityPackage("shell.restricted");

  assert.equal(capabilityPackage.policy.riskLevel, "risky");
  assert.equal(capabilityPackage.policy.recommendedMode, "standard");
  assert.match(
    capabilityPackage.policy.safetyFlags.join(" "),
    /deny_sudo_and_destructive_patterns/i,
  );
});

test("test.run package is recognized as part of the B-group tooling baseline", () => {
  assert.equal(isTapToolingBaselineCapabilityKey("test.run"), true);
  assert.equal(isTapToolingBaselineCapabilityKey("docs.read"), false);
});

test("skill.doc.generate package carries formal doc-generation metadata", () => {
  const capabilityPackage = createTapToolingCapabilityPackage("skill.doc.generate");

  assert.equal(capabilityPackage.policy.riskLevel, "normal");
  assert.equal(capabilityPackage.usage.skillRef, "skill-creator");
  assert.equal(
    capabilityPackage.activationSpec?.adapterFactoryRef,
    "factory:tap-tooling:skill.doc.generate",
  );
  assert.equal(
    capabilityPackage.policy.defaultBaseline.scope?.allowedOperations?.includes("skill.doc.generate"),
    true,
  );
});
