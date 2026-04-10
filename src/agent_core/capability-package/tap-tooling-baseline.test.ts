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
  assert.equal(isTapToolingBaselineCapabilityKey("browser.playwright"), true);
  assert.equal(isTapToolingBaselineCapabilityKey("spreadsheet.write"), true);
  assert.equal(isTapToolingBaselineCapabilityKey("doc.write"), true);
  assert.equal(isTapToolingBaselineCapabilityKey("docs.read"), false);
});

test("spreadsheet.write package carries first-wave worksheet write metadata", () => {
  const capabilityPackage = createTapToolingCapabilityPackage("spreadsheet.write");

  assert.equal(capabilityPackage.policy.riskLevel, "normal");
  assert.equal(
    capabilityPackage.activationSpec?.adapterFactoryRef,
    "factory:tap-tooling:spreadsheet.write",
  );
  assert.match(
    capabilityPackage.policy.safetyFlags.join(" "),
    /single_sheet_xlsx_v1/i,
  );
});

test("doc.write package carries first-wave docx generation metadata", () => {
  const capabilityPackage = createTapToolingCapabilityPackage("doc.write");

  assert.equal(capabilityPackage.policy.riskLevel, "normal");
  assert.equal(
    capabilityPackage.activationSpec?.adapterFactoryRef,
    "factory:tap-tooling:doc.write",
  );
  assert.match(
    capabilityPackage.policy.safetyFlags.join(" "),
    /docx_generation_v1/i,
  );
});

test("git.commit package carries new-commit safety metadata", () => {
  const capabilityPackage = createTapToolingCapabilityPackage("git.commit");

  assert.equal(capabilityPackage.policy.riskLevel, "risky");
  assert.equal(
    capabilityPackage.activationSpec?.adapterFactoryRef,
    "factory:tap-tooling:git.commit",
  );
  assert.equal(
    capabilityPackage.policy.defaultBaseline.scope?.allowedOperations?.includes("git.commit"),
    true,
  );
  assert.match(
    capabilityPackage.policy.safetyFlags.join(" "),
    /no_amend/i,
  );
});

test("git.push package carries non-force remote safety metadata", () => {
  const capabilityPackage = createTapToolingCapabilityPackage("git.push");

  assert.equal(capabilityPackage.policy.riskLevel, "risky");
  assert.equal(
    capabilityPackage.activationSpec?.adapterFactoryRef,
    "factory:tap-tooling:git.push",
  );
  assert.match(
    capabilityPackage.policy.safetyFlags.join(" "),
    /no_force_push/i,
  );
});

test("browser.playwright package carries risky browser-automation metadata", () => {
  const capabilityPackage = createTapToolingCapabilityPackage("browser.playwright");

  assert.equal(capabilityPackage.policy.riskLevel, "risky");
  assert.equal(
    capabilityPackage.activationSpec?.adapterFactoryRef,
    "factory:tap-tooling:browser.playwright",
  );
  assert.match(
    capabilityPackage.policy.safetyFlags.join(" "),
    /file_upload_blocked_by_default/i,
  );
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
