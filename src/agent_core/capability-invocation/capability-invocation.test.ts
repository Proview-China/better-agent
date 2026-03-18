import assert from "node:assert/strict";
import test from "node:test";

import {
  createCapabilityExecutionHandle,
  createInvocationPlanFromCapabilityIntent,
  createPreparedCapabilityCall,
} from "./capability-invocation.js";
import type { CapabilityCallIntent } from "../types/index.js";
import type { CapabilityLease } from "../capability-types/index.js";

test("capability invocation helpers map kernel intent into hot-path objects", () => {
  const intent: CapabilityCallIntent = {
    intentId: "intent_1",
    sessionId: "session_1",
    runId: "run_1",
    kind: "capability_call",
    createdAt: "2026-03-18T00:00:00.000Z",
    priority: "high",
    request: {
      requestId: "request_1",
      intentId: "intent_1",
      sessionId: "session_1",
      runId: "run_1",
      capabilityKey: "search.ground",
      input: { query: "life meaning" },
      priority: "high",
      idempotencyKey: "search:1",
    },
  };
  const lease: CapabilityLease = {
    leaseId: "lease_1",
    capabilityId: "capability_1",
    bindingId: "binding_1",
    generation: 1,
    grantedAt: "2026-03-18T00:00:01.000Z",
    priority: "high",
  };

  const plan = createInvocationPlanFromCapabilityIntent(intent);
  const prepared = createPreparedCapabilityCall({
    preparedId: "prepared_1",
    lease,
    plan,
  });
  const handle = createCapabilityExecutionHandle({
    executionId: "execution_1",
    prepared,
    startedAt: "2026-03-18T00:00:02.000Z",
  });

  assert.equal(plan.capabilityKey, "search.ground");
  assert.equal(plan.operation, "ground");
  assert.equal(prepared.bindingId, "binding_1");
  assert.equal(handle.preparedId, "prepared_1");
});
