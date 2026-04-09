import assert from "node:assert/strict";
import test from "node:test";

import { createTapLiveAvailabilityReport, createTapFormalFamilyCheckReports } from "./family-check-assembly.js";

test("createTapLiveAvailabilityReport builds a registered formal-family availability baseline from live assembly", () => {
  const report = createTapLiveAvailabilityReport({
    foundation: {
      workspaceRoot: "/tmp/praxis-tap-family-checks",
    },
  });

  assert.equal(report.summary.totalCapabilities, 51);
  assert.equal(report.summary.registeredCapabilities, 51);
  assert.equal(report.summary.executeReadyCapabilities, 51);
  assert.equal(report.rows.some((row) => row.familyKey === "foundation"), true);
  assert.equal(report.rows.some((row) => row.familyKey === "mcp"), true);
  assert.equal(report.rows.some((row) => row.familyKey === "mp"), true);
  assert.equal(report.rows.some((row) => row.familyKey === "userio"), true);
});

test("createTapFormalFamilyCheckReports assembles all six family reports from one live report", () => {
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
    "mp",
    "userio",
  ]);
  assert.equal(familyReports.foundation.familyKey, "foundation");
  assert.equal(familyReports.websearch.familyKey, "websearch");
  assert.equal(familyReports.skill.familyKey, "skill");
  assert.equal(familyReports.mcp.familyKey, "mcp");
  assert.equal(familyReports.mp.familyKey, "mp");
  assert.equal(familyReports.userio.familyKey, "userio");
});
