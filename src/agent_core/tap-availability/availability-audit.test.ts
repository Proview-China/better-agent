import assert from "node:assert/strict";
import test from "node:test";

import { createTapFormalFamilyInventory } from "./formal-family-inventory.js";
import { createTapCapabilityAvailabilityReport } from "./availability-audit.js";

test("createTapCapabilityAvailabilityReport shows declared gaps when nothing is registered", () => {
  const report = createTapCapabilityAvailabilityReport({
    now: () => new Date("2026-03-25T00:00:00.000Z"),
  });

  assert.equal(report.generatedAt, "2026-03-25T00:00:00.000Z");
  assert.equal(report.summary.totalCapabilities, 40);
  assert.equal(report.summary.registeredCapabilities, 0);
  assert.equal(report.summary.executeReadyCapabilities, 0);
  assert.equal(report.summary.healthyCapabilities, 0);
  assert.equal(report.summary.readyCapabilities, 0);
  assert.equal(report.summary.reviewRequiredCapabilities, 0);
  assert.equal(report.summary.blockedCapabilities, 40);

  const searchGround = report.rows.find((row) => row.capabilityKey === "search.ground");
  assert.ok(searchGround);
  assert.equal(searchGround?.observed.registered, false);
  assert.equal(searchGround?.observed.executeReady, false);
  assert.equal(
    searchGround?.evidence.some(
      (entry) => entry.source === "registered_manifest" && entry.status === "missing",
    ),
    true,
  );
});

test("createTapCapabilityAvailabilityReport marks capabilities ready when registration audit and health are observed", () => {
  const inventory = createTapFormalFamilyInventory();
  const searchGround = inventory.entries.find((entry) => entry.capabilityKey === "search.ground");
  assert.ok(searchGround);

  const report = createTapCapabilityAvailabilityReport({
    inventory,
    registrationAudit: [{
      capabilityKey: "search.ground",
      familyKey: "websearch",
      manifest: searchGround!.manifest,
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

  const row = report.rows.find((candidate) => candidate.capabilityKey === "search.ground");
  assert.ok(row);
  assert.equal(row?.observed.registered, true);
  assert.equal(row?.observed.prepareReady, true);
  assert.equal(row?.observed.executeReady, true);
  assert.equal(row?.observed.healthy, true);
  assert.equal(row?.observed.hasActivationFactory, true);
  assert.equal(row?.gate.status, "ready");

  const websearchFamily = report.families.find((family) => family.familyKey === "websearch");
  assert.deepEqual(websearchFamily, {
    familyKey: "websearch",
    total: 3,
    registered: 1,
    executeReady: 1,
    healthy: 1,
    ready: 1,
    reviewRequired: 0,
    blocked: 2,
  });
});
