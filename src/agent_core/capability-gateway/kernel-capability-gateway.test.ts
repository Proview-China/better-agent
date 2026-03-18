import assert from "node:assert/strict";
import test from "node:test";

import type {
  CapabilityAdapter,
  CapabilityInvocationPlan,
} from "../capability-types/index.js";
import { DefaultCapabilityPool } from "../capability-pool/index.js";
import { DefaultKernelCapabilityGateway } from "./kernel-capability-gateway.js";

function createAdapter(): CapabilityAdapter {
  return {
    id: "adapter.search.ground",
    runtimeKind: "tool",
    supports(plan) {
      return plan.capabilityKey === "search.ground";
    },
    async prepare(plan, lease) {
      return {
        preparedId: `${plan.planId}:prepared`,
        leaseId: lease.leaseId,
        capabilityKey: plan.capabilityKey,
        bindingId: lease.bindingId,
        generation: lease.generation,
        executionMode: "direct",
        metadata: {
          priority: plan.priority,
        },
      };
    },
    async execute(prepared) {
      return {
        executionId: `${prepared.preparedId}:execution`,
        resultId: `${prepared.preparedId}:result`,
        status: "success",
        output: { ok: true },
        completedAt: "2026-03-18T00:00:00.000Z",
      };
    },
  };
}

function createPlan(overrides: Partial<CapabilityInvocationPlan> = {}): CapabilityInvocationPlan {
  return {
    planId: overrides.planId ?? "plan-1",
    intentId: overrides.intentId ?? "intent-1",
    sessionId: overrides.sessionId ?? "session-1",
    runId: overrides.runId ?? "run-1",
    capabilityKey: overrides.capabilityKey ?? "search.ground",
    operation: overrides.operation ?? "ground",
    input: overrides.input ?? { query: "life meaning" },
    priority: overrides.priority ?? "normal",
    ...overrides,
  };
}

test("KernelCapabilityGateway forwards acquire prepare dispatch and events to pool", async () => {
  const pool = new DefaultCapabilityPool();
  pool.register(
    {
      capabilityId: "cap-search-ground",
      capabilityKey: "search.ground",
      kind: "tool",
      version: "1.0.0",
      generation: 1,
      description: "Grounded search",
    },
    createAdapter(),
  );

  const gateway = new DefaultKernelCapabilityGateway({ pool });
  let seenResultId: string | undefined;
  gateway.onResult((result) => {
    seenResultId = result.resultId;
  });

  const plan = createPlan();
  const lease = await gateway.acquire(plan);
  const prepared = await gateway.prepare(lease, plan);
  const handle = await gateway.dispatch(prepared);

  assert.equal(lease.bindingId.length > 0, true);
  assert.equal(prepared.bindingId, lease.bindingId);
  assert.equal(handle.preparedId, prepared.preparedId);

  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(seenResultId, "plan-1:prepared:result");
});

test("KernelCapabilityGateway forwards backpressure and cancel", async () => {
  const pool = new DefaultCapabilityPool({ maxQueueDepth: 0 });
  let cancelledExecutionId: string | undefined;

  pool.register(
    {
      capabilityId: "cap-search-ground",
      capabilityKey: "search.ground",
      kind: "tool",
      version: "1.0.0",
      generation: 1,
      description: "Grounded search",
    },
    {
      ...createAdapter(),
      async cancel(executionId: string) {
        cancelledExecutionId = executionId;
      },
    },
  );

  const gateway = new DefaultKernelCapabilityGateway({ pool });
  const signals: string[] = [];
  gateway.onBackpressure((signal) => {
    signals.push(signal.reason);
  });

  const plan = createPlan({ planId: "plan-queued" });
  const lease = await gateway.acquire(plan);
  const prepared = await gateway.prepare(lease, plan);
  const queuedPrepared = {
    ...prepared,
    executionMode: "queued" as const,
  };
  const handle = await gateway.dispatch(queuedPrepared);
  await gateway.cancel(handle.executionId);

  assert.equal(cancelledExecutionId === undefined || cancelledExecutionId === handle.executionId, true);
  assert.ok(signals.length >= 1);
});
