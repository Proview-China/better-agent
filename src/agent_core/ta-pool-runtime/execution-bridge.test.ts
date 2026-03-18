import assert from "node:assert/strict";
import test from "node:test";

import {
  createCapabilityGrant,
} from "../ta-pool-types/index.js";
import {
  createTaExecutionBridgeRequest,
  lowerGrantToCapabilityPlan,
} from "./execution-bridge.js";

test("execution bridge exposes a lightweight request envelope for downstream runtime assembly", () => {
  const grant = createCapabilityGrant({
    grantId: "grant-1",
    requestId: "req-1",
    capabilityKey: "mcp.playwright",
    grantedTier: "B1",
    mode: "strict",
    issuedAt: "2026-03-18T00:00:00.000Z",
    grantedScope: {
      allowedOperations: ["screenshot"],
      metadata: {
        target: "frontend-preview",
      },
    },
  });

  const request = createTaExecutionBridgeRequest({
    grant,
    request: {
      sessionId: "session-1",
      runId: "run-1",
      requestedCapabilityKey: "mcp.playwright",
    },
    planId: "plan-1",
    intentId: "intent-1",
  });

  assert.equal(request.capabilityKey, "mcp.playwright");
  assert.equal(request.grantId, grant.grantId);
  assert.deepEqual(request.scope, { target: "frontend-preview" });
});

test("execution bridge can lower a grant into a capability invocation plan", () => {
  const grant = createCapabilityGrant({
    grantId: "grant-2",
    requestId: "req-2",
    capabilityKey: "search.web",
    grantedTier: "B1",
    mode: "balanced",
    issuedAt: "2026-03-18T00:00:00.000Z",
  });

  const plan = lowerGrantToCapabilityPlan({
    grant,
    request: {
      sessionId: "session-2",
      runId: "run-2",
      requestedCapabilityKey: "search.web",
    },
    planId: "plan-2",
    intentId: "intent-2",
    input: {
      query: "Praxis ta pool",
    },
    priority: "high",
  });

  assert.equal(plan.capabilityKey, "search.web");
  assert.equal(plan.priority, "high");
  assert.equal(plan.metadata?.bridge, "ta-pool");
  assert.equal(typeof plan.input.taGrant, "object");
});
