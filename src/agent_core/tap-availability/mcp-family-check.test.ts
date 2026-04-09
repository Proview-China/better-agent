import assert from "node:assert/strict";
import test from "node:test";

import {
  registerTapCapabilityFamilyAssembly,
  type TapActivationFactoryAuditEntry,
  type TapCapabilityRegistrationAuditEntry,
} from "../integrations/tap-capability-family-assembly.js";
import { createTapCapabilityAvailabilityReport } from "./availability-audit.js";
import { createMcpFamilyCheckReport } from "./mcp-family-check.js";

function createLiveMcpAvailabilityReport() {
  const registrationAudit: TapCapabilityRegistrationAuditEntry[] = [];
  const activationFactoryAudit: TapActivationFactoryAuditEntry[] = [];

  registerTapCapabilityFamilyAssembly({
    runtime: {
      registerCapabilityAdapter(manifest, adapter) {
        const bindingId = `binding:${manifest.capabilityKey}`;
        registrationAudit.push({
          capabilityKey: manifest.capabilityKey,
          familyKey: manifest.capabilityKey.startsWith("mcp.")
            ? "mcp"
            : manifest.capabilityKey === "search.ground"
              ? "websearch"
              : manifest.capabilityKey.startsWith("skill.")
                ? "skill"
                : "foundation",
          manifest,
          adapterId: adapter.id,
          runtimeKind: adapter.runtimeKind,
          bindingId,
          supportsPrepare: manifest.supportsPrepare ?? false,
          supportsCancellation: manifest.supportsCancellation ?? false,
          hasHealthCheck: typeof adapter.healthCheck === "function",
        });
        return {
          bindingId,
          capabilityId: manifest.capabilityId,
          generation: manifest.generation,
          adapterId: adapter.id,
          runtimeKind: adapter.runtimeKind,
          state: "active" as const,
        };
      },
      registerTaActivationFactory(ref) {
        activationFactoryAudit.push({
          ref,
        });
      },
    },
    foundation: {
      workspaceRoot: "/tmp/praxis-mcp-family-check",
    },
  });

  const report = createTapCapabilityAvailabilityReport({
    registrationAudit,
    activationFactoryAudit: [
      { ref: "factory:rax.mcp.adapter", capabilityKey: "mcp.listTools", familyKey: "mcp" },
      { ref: "factory:rax.mcp.adapter", capabilityKey: "mcp.listResources", familyKey: "mcp" },
      { ref: "factory:rax.mcp.adapter", capabilityKey: "mcp.readResource", familyKey: "mcp" },
      { ref: "factory:rax.mcp.adapter", capabilityKey: "mcp.call", familyKey: "mcp" },
      { ref: "factory:rax.mcp.adapter", capabilityKey: "mcp.native.execute", familyKey: "mcp" },
    ],
  });
  return report;
}

test("createMcpFamilyCheckReport marks MCP family ready on live formal-family assembly baseline", () => {
  const report = createLiveMcpAvailabilityReport();

  const familyReport = createMcpFamilyCheckReport(
    report,
    () => new Date("2026-03-25T00:00:00.000Z"),
  );

  assert.equal(familyReport.familyKey, "mcp");
  assert.equal(familyReport.status, "ready");
  assert.equal(familyReport.productionLikeReady, true);
  assert.deepEqual(familyReport.capabilityKeys, [
    "mcp.listTools",
    "mcp.listResources",
    "mcp.readResource",
    "mcp.call",
    "mcp.native.execute",
  ]);
  assert.equal(familyReport.blockers.length, 0);
  assert.equal(familyReport.warnings.length, 0);
  assert.equal(
    familyReport.findings.every((entry) => entry.severity === "info"),
    true,
  );
});

test("createMcpFamilyCheckReport marks MCP family blocked when call/native truthfulness boundaries drift", () => {
  const report = createLiveMcpAvailabilityReport();
  const driftedRows = report.rows.map((row) => {
    if (row.capabilityKey === "mcp.call") {
      return {
        ...row,
        evidence: row.evidence.filter((entry) =>
          !(entry.source === "support_matrix" && entry.ref.includes(":shared-runtime:"))
        ),
      };
    }
    if (row.capabilityKey === "mcp.native.execute") {
      return {
        ...row,
        evidence: row.evidence.filter((entry) =>
          !(entry.source === "support_matrix" && entry.ref.includes(":provider-native-"))
        ),
        contract: {
          ...row.contract,
          supportsRecovery: false,
        },
      };
    }
    return row;
  });

  const familyReport = createMcpFamilyCheckReport({
    ...report,
    rows: driftedRows,
  });

  assert.equal(familyReport.status, "blocked");
  assert.equal(familyReport.productionLikeReady, false);
  assert.equal(
    familyReport.blockers.some((entry) => entry.includes("mcp.call")),
    true,
  );
  assert.equal(
    familyReport.blockers.some((entry) => entry.includes("mcp.native.execute")),
    true,
  );
});
