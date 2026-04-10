import assert from "node:assert/strict";
import test from "node:test";

import { registerTapCapabilityFamilyAssembly } from "../integrations/tap-capability-family-assembly.js";
import { createTapCapabilityAvailabilityReport } from "./availability-audit.js";
import {
  createFoundationFamilyAvailabilityCheck,
  FOUNDATION_FAMILY_CAPABILITY_KEYS,
} from "./foundation-family-check.js";

test("foundation family check reports blocked when local tooling baseline is not registered", () => {
  const report = createTapCapabilityAvailabilityReport();
  const result = createFoundationFamilyAvailabilityCheck({ report });

  assert.equal(result.familyKey, "foundation");
  assert.equal(result.productionLike, false);
  assert.equal(result.summary.capabilityCount, 29);
  assert.equal(result.summary.blockedCount, 29);
  assert.equal(result.blockers.includes("missing_registration"), true);
  assert.equal(
    result.capabilityFindings.every((entry) => entry.status === "blocked"),
    true,
  );
});

test("foundation family check reports production-like readiness once all local capabilities are assembled", () => {
  const assembly = registerTapCapabilityFamilyAssembly({
    runtime: {
      registerCapabilityAdapter(manifest, adapter) {
        return {
          bindingId: `binding:${manifest.capabilityKey}`,
          adapterId: adapter.id,
        };
      },
      registerTaActivationFactory() {},
    },
    foundation: {
      workspaceRoot: "/tmp/praxis-foundation-check",
    },
    includeFamilies: {
      foundation: true,
      websearch: false,
      skill: false,
      mcp: false,
    },
  });

  const report = createTapCapabilityAvailabilityReport({
    registrationAudit: assembly.registrationAudit,
    activationFactoryAudit: assembly.activationFactoryAudit,
  });
  const result = createFoundationFamilyAvailabilityCheck({ report });

  assert.equal(result.productionLike, true);
  assert.equal(result.summary.capabilityCount, 29);
  assert.equal(result.summary.blockedCount, 0);
  assert.deepEqual(
    [...result.capabilityFindings.map((entry) => entry.capabilityKey)].sort(),
    [...FOUNDATION_FAMILY_CAPABILITY_KEYS].sort(),
  );
  assert.equal(
    result.capabilityFindings.every((entry) => entry.status !== "blocked"),
    true,
  );
  assert.equal(result.warnings.includes("health_hook_not_implemented"), true);
});
