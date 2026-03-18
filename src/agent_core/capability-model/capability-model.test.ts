import assert from "node:assert/strict";
import test from "node:test";

import type {
  CapabilityAdapter,
  CapabilityInvocationPlan,
  CapabilityLease,
  PreparedCapabilityCall,
  CapabilityResultEnvelope,
} from "../capability-types/index.js";
import {
  createCapabilityModelBinding,
  createCapabilityManifest,
  isCapabilityBindingActive,
  markCapabilityBindingState,
} from "./capability-model.js";

const adapter: CapabilityAdapter = {
  id: "adapter.search.ground",
  runtimeKind: "runtime",
  supports(_plan: CapabilityInvocationPlan) {
    return true;
  },
  async prepare(_plan: CapabilityInvocationPlan, lease: CapabilityLease): Promise<PreparedCapabilityCall> {
    return {
      preparedId: "prepared_1",
      leaseId: lease.leaseId,
      capabilityKey: "search.ground",
      bindingId: lease.bindingId,
      generation: lease.generation,
      executionMode: "direct",
    };
  },
  async execute(): Promise<CapabilityResultEnvelope> {
    return {
      executionId: "execution_1",
      resultId: "result_1",
      status: "success",
      completedAt: "2026-03-18T00:00:00.000Z",
    };
  },
};

test("capability manifest and binding helpers preserve lifecycle semantics", () => {
  const manifest = createCapabilityManifest({
    capabilityId: "capability_1",
    capabilityKey: "search.ground",
    kind: "runtime",
    description: "Grounded web search",
  });
  const binding = createCapabilityModelBinding({
    bindingId: "binding_1",
    capabilityId: manifest.capabilityId,
    generation: manifest.generation,
    adapter,
    runtimeKind: manifest.kind,
  });

  assert.equal(manifest.generation, 1);
  assert.equal(binding.state, "active");
  assert.equal(isCapabilityBindingActive(binding), true);
  assert.equal(markCapabilityBindingState(binding, "draining").state, "draining");
});
