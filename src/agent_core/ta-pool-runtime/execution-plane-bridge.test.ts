import assert from "node:assert/strict";
import test from "node:test";

import { createCapabilityGrant } from "../ta-pool-types/index.js";
import { createExecutionRequest, createInvocationPlanFromGrant } from "./execution-plane-bridge.js";

test("execution plane bridge normalizes execution requests", () => {
  const request = createExecutionRequest({
    requestId: "request-1",
    sessionId: "session-1",
    runId: "run-1",
    intentId: "intent-1",
    capabilityKey: "search.web",
    operation: "",
    input: { query: "Praxis" },
    priority: "high",
  });

  assert.equal(request.operation, "web");
});

test("execution plane bridge lowers grants into invocation plans", () => {
  const grant = createCapabilityGrant({
    grantId: "grant-1",
    requestId: "access-1",
    capabilityKey: "mcp.playwright",
    grantedTier: "B1",
    mode: "balanced",
    issuedAt: "2026-03-18T00:00:00.000Z",
    constraints: {
      maxScreenshots: 1,
    },
  });

  const plan = createInvocationPlanFromGrant({
    grant,
    request: {
      requestId: "exec-1",
      sessionId: "session-1",
      runId: "run-1",
      intentId: "intent-1",
      capabilityKey: "mcp.playwright",
      operation: "playwright",
      input: {
        action: "screenshot",
      },
      priority: "normal",
    },
  });

  assert.equal(plan.capabilityKey, "mcp.playwright");
  assert.equal(plan.metadata?.grantId, "grant-1");
  assert.deepEqual(plan.input, {
    action: "screenshot",
  });
});
