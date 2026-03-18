import assert from "node:assert/strict";
import test from "node:test";

import { createAgentCapabilityProfile } from "../ta-pool-types/index.js";
import {
  createDefaultCapabilityGrant,
  resolveBaselineCapability,
} from "./profile-baseline.js";

const profile = createAgentCapabilityProfile({
  profileId: "profile.main",
  agentClass: "main-agent",
  defaultMode: "balanced",
  baselineTier: "B0",
  baselineCapabilities: ["docs.read", "code.read"],
  allowedCapabilityPatterns: ["search.*", "mcp.*"],
  deniedCapabilityPatterns: ["shell.*", "system.*"],
});

test("profile baseline resolves direct baseline capability hits", () => {
  const resolution = resolveBaselineCapability({
    profile,
    capabilityKey: "docs.read",
  });

  assert.equal(resolution.status, "baseline_allowed");
  assert.equal(resolution.tier, "B0");
});

test("profile baseline keeps denied patterns ahead of allow patterns", () => {
  const resolution = resolveBaselineCapability({
    profile,
    capabilityKey: "shell.exec",
    requestedTier: "B3",
  });

  assert.equal(resolution.status, "denied");
  assert.equal(resolution.tier, "B3");
});

test("profile baseline can classify allowed patterns without baseline grants", () => {
  const resolution = resolveBaselineCapability({
    profile,
    capabilityKey: "search.web",
    requestedTier: "B1",
  });

  assert.equal(resolution.status, "pattern_allowed");
});

test("profile baseline builds default grants for downstream control plane use", () => {
  const grant = createDefaultCapabilityGrant({
    requestId: "req-1",
    capabilityKey: "docs.read",
    issuedAt: "2026-03-18T01:30:00.000Z",
  });

  assert.equal(grant.capabilityKey, "docs.read");
  assert.equal(grant.constraints?.source, "default-profile");
});
