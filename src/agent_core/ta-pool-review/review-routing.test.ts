import assert from "node:assert/strict";
import test from "node:test";

import {
  createAccessRequest,
  createAgentCapabilityProfile,
} from "../ta-pool-types/index.js";
import { routeAccessRequest } from "./review-routing.js";

const clock = () => new Date("2026-03-18T00:00:00.000Z");
let counter = 0;
const idFactory = () => `id-${++counter}`;

test("routeAccessRequest baseline-approves allowed baseline capability", () => {
  counter = 0;
  const profile = createAgentCapabilityProfile({
    profileId: "profile-main",
    agentClass: "main-agent",
    baselineCapabilities: ["docs.read"],
  });
  const request = createAccessRequest({
    requestId: "req-1",
    sessionId: "session-1",
    runId: "run-1",
    agentId: "agent-1",
    requestedCapabilityKey: "docs.read",
    requestedTier: "B0",
    reason: "Need to read docs.",
    mode: "strict",
    createdAt: clock().toISOString(),
  });

  const routed = routeAccessRequest({
    profile,
    request,
    idFactory,
    clock,
  });

  assert.equal(routed.outcome, "baseline_approved");
  assert.equal(routed.decision.decision, "approved");
  assert.equal(routed.grant?.capabilityKey, "docs.read");
});

test("routeAccessRequest denies capability when denied pattern wins", () => {
  counter = 0;
  const profile = createAgentCapabilityProfile({
    profileId: "profile-main",
    agentClass: "main-agent",
    allowedCapabilityPatterns: ["shell.*"],
    deniedCapabilityPatterns: ["shell.rm.*"],
  });
  const request = createAccessRequest({
    requestId: "req-2",
    sessionId: "session-1",
    runId: "run-1",
    agentId: "agent-1",
    requestedCapabilityKey: "shell.rm.rf",
    requestedTier: "B3",
    reason: "Delete all files.",
    mode: "yolo",
    createdAt: clock().toISOString(),
  });

  const routed = routeAccessRequest({
    profile,
    request,
    idFactory,
    clock,
  });

  assert.equal(routed.outcome, "denied");
  assert.equal(routed.decision.decision, "denied");
});

test("routeAccessRequest redirects to provisioning when capability is missing but requestable", () => {
  counter = 0;
  const profile = createAgentCapabilityProfile({
    profileId: "profile-main",
    agentClass: "main-agent",
  });
  const request = createAccessRequest({
    requestId: "req-3",
    sessionId: "session-1",
    runId: "run-1",
    agentId: "agent-1",
    requestedCapabilityKey: "mcp.playwright",
    requestedTier: "B1",
    reason: "User explicitly asked for browser screenshots.",
    mode: "balanced",
    createdAt: clock().toISOString(),
  });

  const routed = routeAccessRequest({
    profile,
    request,
    capabilityAvailable: false,
    idFactory,
    clock,
  });

  assert.equal(routed.outcome, "redirected_to_provisioning");
  assert.equal(routed.decision.decision, "redirected_to_provisioning");
});

test("routeAccessRequest escalates human gate when tier requires it", () => {
  counter = 0;
  const profile = createAgentCapabilityProfile({
    profileId: "profile-main",
    agentClass: "main-agent",
  });
  const request = createAccessRequest({
    requestId: "req-4",
    sessionId: "session-1",
    runId: "run-1",
    agentId: "agent-1",
    requestedCapabilityKey: "system.sudo",
    requestedTier: "B3",
    reason: "Needs sudo.",
    mode: "strict",
    createdAt: clock().toISOString(),
  });

  const routed = routeAccessRequest({
    profile,
    request,
    capabilityAvailable: true,
    idFactory,
    clock,
  });

  assert.equal(routed.outcome, "escalated_to_human");
  assert.equal(routed.decision.decision, "escalated_to_human");
});
