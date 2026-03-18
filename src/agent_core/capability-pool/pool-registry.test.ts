import assert from "node:assert/strict";
import test from "node:test";

import type {
  CapabilityAdapter,
  CapabilityInvocationPlan,
  CapabilityLease,
  CapabilityResultEnvelope,
  PreparedCapabilityCall,
} from "../capability-types/index.js";
import { CapabilityPoolRegistry } from "./pool-registry.js";

function createAdapter(): CapabilityAdapter {
  return {
    id: "adapter.search.ground",
    runtimeKind: "tool",
    supports() {
      return true;
    },
    async prepare(
      _plan: CapabilityInvocationPlan,
      lease: CapabilityLease,
    ): Promise<PreparedCapabilityCall> {
      return {
        preparedId: `${lease.leaseId}:prepared`,
        leaseId: lease.leaseId,
        capabilityKey: "search.ground",
        bindingId: lease.bindingId,
        generation: lease.generation,
        executionMode: "direct",
      };
    },
    async execute(prepared: PreparedCapabilityCall): Promise<CapabilityResultEnvelope> {
      return {
        executionId: `${prepared.preparedId}:execution`,
        resultId: `${prepared.preparedId}:result`,
        status: "success",
        completedAt: new Date().toISOString(),
      };
    },
  };
}

test("CapabilityPoolRegistry register list and active selection", () => {
  const registry = new CapabilityPoolRegistry();
  const entry = registry.register({
    capabilityId: "cap_search_ground",
    capabilityKey: "search.ground",
    kind: "tool",
    version: "1.0.0",
    generation: 1,
    description: "Grounded search capability.",
  }, createAdapter());

  assert.equal(registry.listCapabilities().length, 1);
  assert.equal(registry.listBindings().length, 1);
  assert.equal(entry.binding.state, "active");
  assert.equal(registry.getActiveRegistrationsForCapability("search.ground").length, 1);
});

test("CapabilityPoolRegistry replace drains old binding and creates higher generation", () => {
  const registry = new CapabilityPoolRegistry();
  const original = registry.register({
    capabilityId: "cap_search_ground",
    capabilityKey: "search.ground",
    kind: "tool",
    version: "1.0.0",
    generation: 1,
    description: "Grounded search capability.",
  }, createAdapter());

  const replacement = registry.replace(original.binding.bindingId, {
    capabilityId: "cap_search_ground",
    capabilityKey: "search.ground",
    kind: "tool",
    version: "1.1.0",
    generation: 1,
    description: "Grounded search capability v2.",
  }, createAdapter());

  const bindings = registry.listBindings();
  assert.equal(bindings.length, 2);
  const oldBinding = bindings.find((entry) => entry.bindingId === original.binding.bindingId);
  assert.equal(oldBinding?.state, "draining");
  assert.ok(replacement.binding.generation > original.binding.generation);
});

test("CapabilityPoolRegistry suspend and resume mutate lifecycle state", () => {
  const registry = new CapabilityPoolRegistry();
  const entry = registry.register({
    capabilityId: "cap_search_ground",
    capabilityKey: "search.ground",
    kind: "tool",
    version: "1.0.0",
    generation: 1,
    description: "Grounded search capability.",
  }, createAdapter());

  registry.suspend(entry.binding.bindingId);
  assert.equal(registry.listBindings()[0]?.state, "disabled");

  registry.resume(entry.binding.bindingId);
  assert.equal(registry.listBindings()[0]?.state, "active");
});
