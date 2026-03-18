import assert from "node:assert/strict";
import test from "node:test";

import type {
  CapabilityAdapter,
  CapabilityInvocationPlan,
  CapabilityLease,
  CapabilityResultEnvelope,
  PreparedCapabilityCall,
} from "../capability-types/index.js";
import { DefaultCapabilityPool } from "./pool-dispatch.js";

function createPlan(priority: CapabilityInvocationPlan["priority"] = "normal"): CapabilityInvocationPlan {
  return {
    planId: "plan_001",
    intentId: "intent_001",
    sessionId: "session_001",
    runId: "run_001",
    capabilityKey: "search.ground",
    operation: "ground",
    input: {
      query: "life meaning",
    },
    priority,
  };
}

function createAdapter(mode: PreparedCapabilityCall["executionMode"] = "direct"): CapabilityAdapter {
  return {
    id: `adapter.search.ground.${mode}`,
    runtimeKind: "tool",
    supports() {
      return true;
    },
    async prepare(plan: CapabilityInvocationPlan, lease: CapabilityLease): Promise<PreparedCapabilityCall> {
      return {
        preparedId: `${plan.planId}:prepared`,
        leaseId: lease.leaseId,
        capabilityKey: plan.capabilityKey,
        bindingId: lease.bindingId,
        generation: lease.generation,
        executionMode: mode,
        metadata: {
          idempotencyKey: plan.idempotencyKey,
          priority: plan.priority,
        },
      };
    },
    async execute(prepared: PreparedCapabilityCall): Promise<CapabilityResultEnvelope> {
      return {
        executionId: `${prepared.preparedId}:execution`,
        resultId: `${prepared.preparedId}:result`,
        status: "success",
        output: {
          text: "42",
        },
        completedAt: new Date().toISOString(),
      };
    },
  };
}

test("DefaultCapabilityPool acquire prepare and direct dispatch emits result", async () => {
  const pool = new DefaultCapabilityPool();
  pool.register({
    capabilityId: "cap_search_ground",
    capabilityKey: "search.ground",
    kind: "tool",
    version: "1.0.0",
    generation: 1,
    description: "Grounded search capability.",
  }, createAdapter());

  const resultPromise = new Promise<CapabilityResultEnvelope>((resolve) => {
    pool.onResult(resolve);
  });

  const plan = createPlan();
  const lease = await pool.acquire(plan);
  const prepared = await pool.prepare(lease, plan);
  const handle = await pool.dispatch(prepared);
  const result = await resultPromise;

  assert.equal(lease.capabilityId, "cap_search_ground");
  assert.equal(prepared.capabilityKey, "search.ground");
  assert.equal(handle.state, "running");
  assert.equal(result.status, "success");
});

test("DefaultCapabilityPool queued dispatch drains asynchronously", async () => {
  const pool = new DefaultCapabilityPool({
    maxInflight: 1,
  });
  pool.register({
    capabilityId: "cap_search_ground",
    capabilityKey: "search.ground",
    kind: "tool",
    version: "1.0.0",
    generation: 1,
    description: "Grounded search capability.",
  }, createAdapter("queued"));

  const resultPromise = new Promise<CapabilityResultEnvelope>((resolve) => {
    pool.onResult(resolve);
  });

  const plan = createPlan("high");
  const lease = await pool.acquire(plan);
  const prepared = await pool.prepare(lease, plan);
  const handle = await pool.dispatch(prepared);
  const result = await resultPromise;

  assert.equal(handle.state, "queued");
  assert.equal(result.status, "success");
});
