import assert from "node:assert/strict";
import test from "node:test";

import { createTapLiveAvailabilityReport, createTapFormalFamilyCheckReports } from "./family-check-assembly.js";

test("createTapLiveAvailabilityReport builds a registered formal-family availability baseline from live assembly", () => {
  const report = createTapLiveAvailabilityReport({
    foundation: {
      workspaceRoot: "/tmp/praxis-tap-family-checks",
    },
  });

  assert.equal(report.summary.totalCapabilities, 14);
  assert.equal(report.summary.registeredCapabilities, 14);
  assert.equal(report.summary.executeReadyCapabilities, 14);
  assert.equal(report.rows.some((row) => row.familyKey === "foundation"), true);
  assert.equal(report.rows.some((row) => row.familyKey === "mcp"), true);
});

test("createTapFormalFamilyCheckReports assembles all four family reports from one live report", () => {
  const report = createTapLiveAvailabilityReport({
    foundation: {
      workspaceRoot: "/tmp/praxis-tap-family-checks",
    },
  });
  const familyReports = createTapFormalFamilyCheckReports(report);

  assert.deepEqual(Object.keys(familyReports), [
    "foundation",
    "websearch",
    "skill",
    "mcp",
  ]);
  assert.equal(familyReports.foundation.familyKey, "foundation");
  assert.equal(familyReports.websearch.familyKey, "websearch");
  assert.equal(familyReports.skill.familyKey, "skill");
  assert.equal(familyReports.mcp.familyKey, "mcp");
});
