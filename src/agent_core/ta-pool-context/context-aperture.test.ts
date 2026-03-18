import assert from "node:assert/strict";
import test from "node:test";

import { createAgentCapabilityProfile } from "../ta-pool-types/index.js";
import {
  createProvisionContextAperture,
  createReviewContextAperture,
} from "./context-aperture.js";

test("review context aperture preserves placeholder snapshots", () => {
  const profile = createAgentCapabilityProfile({
    profileId: "profile-main",
    agentClass: "main-agent",
    baselineCapabilities: ["docs.read"],
  });

  const aperture = createReviewContextAperture({
    projectSummary: "Praxis runtime migration in progress.",
    runSummary: "Need browser screenshot capability.",
    profileSnapshot: profile,
    capabilityInventorySnapshot: {
      totalCapabilities: 3,
      availableCapabilityKeys: ["docs.read", "search.web", "mcp.playwright"],
    },
    modeSnapshot: "strict",
  });

  assert.equal(aperture.profileSnapshot?.profileId, "profile-main");
  assert.equal(aperture.capabilityInventorySnapshot?.totalCapabilities, 3);
});

test("provision context aperture requires a requested capability key", () => {
  const aperture = createProvisionContextAperture({
    requestedCapabilityKey: "mcp.playwright",
    inventorySnapshot: {
      knownBindings: ["binding:websearch"],
      knownTools: ["websearch"],
    },
  });

  assert.equal(aperture.requestedCapabilityKey, "mcp.playwright");
  assert.equal(aperture.inventorySnapshot?.knownTools[0], "websearch");
});
