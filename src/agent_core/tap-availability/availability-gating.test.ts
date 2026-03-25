import assert from "node:assert/strict";
import test from "node:test";

import {
  createTapFormalFamilyCheckReports,
  createTapLiveAvailabilityReport,
} from "./family-check-assembly.js";
import { createTapAvailabilityGatingReport } from "./availability-gating.js";

test("availability gating marks ready foundation baseline capabilities as baseline", () => {
  const availabilityReport = createTapLiveAvailabilityReport({
    foundation: {
      workspaceRoot: "/tmp/praxis-wave3-gating",
    },
  });
  const familyReports = createTapFormalFamilyCheckReports(availabilityReport);
  const gating = createTapAvailabilityGatingReport({
    availabilityReport,
    familyReports,
  });

  const codeRead = gating.decisions.find((entry) => entry.capabilityKey === "code.read");
  assert.ok(codeRead);
  assert.equal(codeRead.decision, "baseline");
  assert.equal(codeRead.runtimeAllowed, true);
  assert.equal(codeRead.reviewRequired, false);
});

test("availability gating marks review_required family checks as review_only", () => {
  const availabilityReport = createTapLiveAvailabilityReport({
    foundation: {
      workspaceRoot: "/tmp/praxis-wave3-gating",
    },
  });
  const familyReports = createTapFormalFamilyCheckReports(availabilityReport);
  const gating = createTapAvailabilityGatingReport({
    availabilityReport,
    familyReports,
  });

  const skillUse = gating.decisions.find((entry) => entry.capabilityKey === "skill.use");
  assert.ok(skillUse);
  assert.equal(skillUse.decision, "review_only");
  assert.equal(skillUse.reviewRequired, true);
  assert.equal(skillUse.runtimeAllowed, true);
});

test("availability gating marks blocked capabilities as blocked", () => {
  const availabilityReport = createTapLiveAvailabilityReport({
    foundation: {
      workspaceRoot: "/tmp/praxis-wave3-gating",
    },
  });
  const familyReports = createTapFormalFamilyCheckReports(availabilityReport);
  availabilityReport.rows = availabilityReport.rows.map((row) =>
    row.capabilityKey === "mcp.native.execute"
      ? {
          ...row,
          gate: {
            status: "blocked",
            reasons: ["missing_provider_native_route"],
          },
        }
      : row
  );

  const gating = createTapAvailabilityGatingReport({
    availabilityReport,
    familyReports,
  });

  const nativeExecute = gating.decisions.find((entry) => entry.capabilityKey === "mcp.native.execute");
  assert.ok(nativeExecute);
  assert.equal(nativeExecute.decision, "blocked");
  assert.equal(nativeExecute.runtimeAllowed, false);
});

test("availability gating marks backlog capabilities as pending_backlog", () => {
  const availabilityReport = createTapLiveAvailabilityReport({
    foundation: {
      workspaceRoot: "/tmp/praxis-wave3-gating",
    },
  });
  const familyReports = createTapFormalFamilyCheckReports(availabilityReport);
  const gating = createTapAvailabilityGatingReport({
    availabilityReport,
    familyReports,
    backlogEntries: [
      {
        capabilityKey: "dependency.install",
        familyKey: "pending_closure",
        reason: "Dependency install is still half-wired and not formalized into TAP runtime.",
        priority: "p0",
        recommendedAction: "implement",
      },
    ],
  });

  const dependencyInstall = gating.decisions.find((entry) => entry.capabilityKey === "dependency.install");
  assert.ok(dependencyInstall);
  assert.equal(dependencyInstall.decision, "pending_backlog");
  assert.equal(dependencyInstall.runtimeAllowed, false);
  assert.equal(gating.summary.pendingBacklog, 1);
});
