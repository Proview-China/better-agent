import assert from "node:assert/strict";
import test from "node:test";

import {
  createBacklogCapabilityAudit,
  TAP_BACKLOG_PRIORITY_LEVELS,
} from "./backlog-capability-audit.js";

test("createBacklogCapabilityAudit builds the Wave 3 backlog matrix without mixing formal families", () => {
  const audit = createBacklogCapabilityAudit(
    () => new Date("2026-03-25T00:00:00.000Z"),
  );

  assert.equal(audit.generatedAt, "2026-03-25T00:00:00.000Z");
  assert.deepEqual(audit.formalFamilyKeys, [
    "foundation",
    "websearch",
    "skill",
    "mcp",
    "mp",
    "userio",
  ]);
  assert.equal(audit.entries.some((entry) => entry.capabilityKey === "dependency.install"), true);
  assert.equal(audit.entries.some((entry) => entry.capabilityKey === "mcp.configure"), true);
  assert.equal(audit.entries.some((entry) => entry.capabilityKey === "memory.*"), true);
  assert.equal(audit.entries.some((entry) => entry.capabilityKey === "subagent.*"), true);
  assert.deepEqual(audit.overlapsWithFormalCapabilities, []);

  const install = audit.entries.find((entry) => entry.capabilityKey === "dependency.install");
  assert.ok(install);
  assert.equal(install?.familyKey, "pending_closure");
  assert.equal(install?.priority, "critical_path");
  assert.equal(install?.cannotBeFormalBecause.length > 0, true);
});

test("createBacklogCapabilityAudit produces stable priority summaries", () => {
  const audit = createBacklogCapabilityAudit();

  assert.deepEqual(
    audit.prioritySummary.map((entry) => entry.priority),
    [...TAP_BACKLOG_PRIORITY_LEVELS],
  );

  const critical = audit.prioritySummary.find((entry) => entry.priority === "critical_path");
  assert.ok(critical);
  assert.equal(critical?.capabilityKeys.includes("dependency.install"), true);
  assert.equal(critical?.capabilityKeys.includes("mcp.configure"), true);
  assert.equal(critical?.capabilityKeys.includes("system.write"), true);

  const high = audit.prioritySummary.find((entry) => entry.priority === "high");
  assert.ok(high);
  assert.equal(high?.capabilityKeys.includes("network.download"), true);
  assert.equal(high?.capabilityKeys.includes("memory.*"), true);
  assert.equal(high?.capabilityKeys.includes("guardrail.*"), true);
});
