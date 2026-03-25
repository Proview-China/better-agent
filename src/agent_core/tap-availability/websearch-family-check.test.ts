import assert from "node:assert/strict";
import test from "node:test";

import { createTapCapabilityAvailabilityReport } from "./availability-audit.js";
import { createTapFormalFamilyInventory } from "./formal-family-inventory.js";
import type { TapCapabilityAvailabilityReport } from "./availability-types.js";
import { createWebsearchFamilyAvailabilityReport } from "./websearch-family-check.js";

function createReadyAvailabilityReport(): TapCapabilityAvailabilityReport {
  const inventory = createTapFormalFamilyInventory();
  const searchGround = inventory.entries.find((entry) => entry.capabilityKey === "search.ground");
  assert.ok(searchGround);

  const report = createTapCapabilityAvailabilityReport({
    inventory,
    registrationAudit: [{
      capabilityKey: "search.ground",
      familyKey: "websearch",
      manifest: searchGround.manifest,
      adapterId: "adapter:search.ground",
      runtimeKind: "rax-websearch",
      bindingId: "binding:search.ground:1",
      supportsPrepare: true,
      supportsCancellation: false,
      hasHealthCheck: true,
    }],
    activationFactoryAudit: [{
      ref: "factory:search.ground.rax-websearch",
      capabilityKey: "search.ground",
      familyKey: "websearch",
    }],
    healthRecords: [{
      bindingId: "binding:search.ground:1",
      state: "healthy",
      checkedAt: "2026-03-25T00:00:00.000Z",
      details: {
        status: "healthy",
      },
    }],
  });

  const row = report.rows.find((entry) => entry.capabilityKey === "search.ground");
  assert.ok(row);
  row.supportRoutes = 3;
  row.evidence.push(
    {
      source: "support_matrix",
      status: "declared",
      ref: "openai:api:package-runtime:documented",
      summary: "OpenAI route available.",
    },
    {
      source: "support_matrix",
      status: "declared",
      ref: "anthropic:agent:shared-runtime:beta",
      summary: "Anthropic route available.",
    },
  );

  return report;
}

test("createWebsearchFamilyAvailabilityReport returns ready for a production-like search.ground report", () => {
  const report = createReadyAvailabilityReport();
  const familyReport = createWebsearchFamilyAvailabilityReport(report);

  assert.equal(familyReport.familyKey, "websearch");
  assert.equal(familyReport.capabilityKey, "search.ground");
  assert.equal(familyReport.status, "ready");
  assert.equal(familyReport.productionLikeReady, true);
  assert.deepEqual(familyReport.checks, {
    register: true,
    prepare: true,
    execute: true,
    health: true,
    smoke: true,
  });
  assert.equal(familyReport.failureTaxonomy.status, "ready");
  assert.equal(familyReport.truthfulness.status, "ready");
  assert.equal(familyReport.providerCoverage.status, "ready");
  assert.equal(familyReport.providerCoverage.providers.includes("openai"), true);
  assert.equal(familyReport.providerCoverage.providers.includes("anthropic"), true);
  assert.deepEqual(familyReport.blockers, []);
  assert.deepEqual(familyReport.warnings, []);
});

test("createWebsearchFamilyAvailabilityReport degrades to review_required when provider coverage is still shallow", () => {
  const report = createTapCapabilityAvailabilityReport();
  const familyReport = createWebsearchFamilyAvailabilityReport(report);

  assert.equal(familyReport.status, "blocked");
  assert.equal(familyReport.productionLikeReady, false);
  assert.equal(familyReport.checks.register, false);
  assert.equal(familyReport.failureTaxonomy.status, "ready");
  assert.equal(familyReport.truthfulness.status, "ready");
  assert.equal(familyReport.providerCoverage.status, "blocked");
  assert.equal(
    familyReport.blockers.includes("search.ground is not registered in the observed TAP runtime."),
    true,
  );
  assert.equal(
    familyReport.warnings.some((entry) => entry.includes("provider/support-route")),
    true,
  );
});
