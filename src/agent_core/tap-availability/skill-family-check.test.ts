import assert from "node:assert/strict";
import test from "node:test";

import { createTapLiveAvailabilityReport } from "./family-check-assembly.js";
import { createSkillFamilyCheckReport } from "./skill-family-check.js";

test("createSkillFamilyCheckReport returns review_required when runtime health hooks are the main remaining gap", () => {
  const report = createTapLiveAvailabilityReport({
    foundation: {
      workspaceRoot: "/tmp/praxis-skill-family-check",
    },
  });
  const familyReport = createSkillFamilyCheckReport(report);

  assert.equal(familyReport.familyKey, "skill");
  assert.equal(familyReport.status, "review_required");
  assert.equal(familyReport.productionLikeReady, false);
  assert.equal(familyReport.capabilityKeys.length, 3);
  assert.equal(
    familyReport.warnings.some((entry) => entry.includes("missing_runtime_health_observation")),
    true,
  );
});

test("createSkillFamilyCheckReport blocks when progressive loading coverage is broken", () => {
  const report = createTapLiveAvailabilityReport({
    foundation: {
      workspaceRoot: "/tmp/praxis-skill-family-check",
    },
  });
  report.rows = report.rows.filter((row) => row.capabilityKey !== "skill.prepare");

  const familyReport = createSkillFamilyCheckReport(report);

  assert.equal(familyReport.status, "blocked");
  assert.equal(familyReport.productionLikeReady, false);
  assert.equal(
    familyReport.blockers.some((entry) => entry.includes("progressive loading")),
    true,
  );
});
