import assert from "node:assert/strict";
import test from "node:test";

import {
  createAccessRequest,
  createAgentCapabilityProfile,
} from "../ta-pool-types/index.js";
import { createTaControlPlaneGateway } from "./control-plane-gateway.js";

const clock = () => new Date("2026-03-18T00:00:00.000Z");
let counter = 0;
const idFactory = () => `id-${++counter}`;

test("control-plane gateway passes baseline-approved requests into execution", () => {
  counter = 0;
  const gateway = createTaControlPlaneGateway();
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
    reason: "Need docs.",
    mode: "strict",
    createdAt: clock().toISOString(),
  });

  const result = gateway.authorize({
    profile,
    request,
    idFactory,
    clock,
  });

  assert.equal(gateway.shouldEnterExecution(result), true);
  assert.equal(gateway.toExecutionGrant(result)?.capabilityKey, "docs.read");
});

test("control-plane gateway exposes provisioning and human-gate branches", () => {
  counter = 0;
  const gateway = createTaControlPlaneGateway();
  const profile = createAgentCapabilityProfile({
    profileId: "profile-main",
    agentClass: "main-agent",
  });

  const provisionRequest = createAccessRequest({
    requestId: "req-2",
    sessionId: "session-1",
    runId: "run-1",
    agentId: "agent-1",
    requestedCapabilityKey: "mcp.playwright",
    requestedTier: "B1",
    reason: "Need browser automation.",
    mode: "balanced",
    createdAt: clock().toISOString(),
  });
  const provisionResult = gateway.authorize({
    profile,
    request: provisionRequest,
    capabilityAvailable: false,
    idFactory,
    clock,
  });
  assert.equal(gateway.requiresProvisioning(provisionResult), true);
  assert.equal(gateway.shouldEnterExecution(provisionResult), false);

  const humanRequest = createAccessRequest({
    requestId: "req-3",
    sessionId: "session-1",
    runId: "run-1",
    agentId: "agent-1",
    requestedCapabilityKey: "system.sudo",
    requestedTier: "B3",
    reason: "Need sudo.",
    mode: "strict",
    createdAt: clock().toISOString(),
  });
  const humanResult = gateway.authorize({
    profile,
    request: humanRequest,
    capabilityAvailable: true,
    idFactory,
    clock,
  });
  assert.equal(gateway.requiresHuman(humanResult), true);
  assert.equal(gateway.shouldEnterExecution(humanResult), false);
});
