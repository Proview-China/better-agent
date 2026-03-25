import assert from "node:assert/strict";
import test from "node:test";

import {
  TAP_BOOTSTRAP_TMA_BASELINE_CAPABILITY_KEYS,
  TAP_EXTENDED_TMA_BASELINE_CAPABILITY_KEYS,
  TAP_REVIEWER_BASELINE_CAPABILITY_KEYS,
  createTapBootstrapTmaProfile,
  createTapExtendedTmaProfile,
  createTapReviewerProfile,
} from "./tooling-baseline.js";
import {
  isCapabilityAllowedByProfile,
  isCapabilityDeniedByProfile,
} from "../ta-pool-types/index.js";

test("tap reviewer profile stays read-only and does not baseline execution capabilities", () => {
  const reviewer = createTapReviewerProfile();

  assert.deepEqual(reviewer.baselineCapabilities, [...TAP_REVIEWER_BASELINE_CAPABILITY_KEYS]);
  assert.equal(isCapabilityAllowedByProfile({ profile: reviewer, capabilityKey: "repo.write" }), false);
  assert.equal(isCapabilityDeniedByProfile({ profile: reviewer, capabilityKey: "shell.restricted" }), true);
  assert.equal(isCapabilityDeniedByProfile({ profile: reviewer, capabilityKey: "test.run" }), true);
});

test("tap bootstrap TMA profile carries the first-class tooling baseline", () => {
  const bootstrap = createTapBootstrapTmaProfile();

  assert.deepEqual(
    bootstrap.baselineCapabilities,
    [...TAP_BOOTSTRAP_TMA_BASELINE_CAPABILITY_KEYS],
  );
  assert.equal(isCapabilityAllowedByProfile({ profile: bootstrap, capabilityKey: "repo.write" }), true);
  assert.equal(isCapabilityAllowedByProfile({ profile: bootstrap, capabilityKey: "shell.restricted" }), true);
  assert.equal(isCapabilityAllowedByProfile({ profile: bootstrap, capabilityKey: "test.run" }), true);
  assert.equal(isCapabilityAllowedByProfile({ profile: bootstrap, capabilityKey: "skill.doc.generate" }), true);
});

test("tap extended TMA profile extends bootstrap with install and network capabilities", () => {
  const extended = createTapExtendedTmaProfile();

  assert.deepEqual(
    extended.baselineCapabilities,
    [...TAP_EXTENDED_TMA_BASELINE_CAPABILITY_KEYS],
  );
  assert.equal(isCapabilityAllowedByProfile({ profile: extended, capabilityKey: "dependency.install" }), true);
  assert.equal(isCapabilityAllowedByProfile({ profile: extended, capabilityKey: "network.download" }), true);
});
