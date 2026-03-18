import assert from "node:assert/strict";
import test from "node:test";

import type { CapabilityInvocationPlan, CapabilityLease, GoalFrameCompiled, ModelInferenceIntent } from "../index.js";
import { createModelInferenceCapabilityAdapter, MODEL_INFERENCE_CAPABILITY_KEY } from "./model-inference-adapter.js";

const frame: GoalFrameCompiled = {
  goalId: "goal-1",
  instructionText: "Answer the question briefly.",
  successCriteria: [],
  failureCriteria: [],
  constraints: [],
  inputRefs: [],
  cacheKey: "goal-cache-key",
};

function createPlan(): CapabilityInvocationPlan {
  return {
    planId: "plan-1",
    intentId: "intent-1",
    sessionId: "session-1",
    runId: "run-1",
    capabilityKey: MODEL_INFERENCE_CAPABILITY_KEY,
    operation: "infer",
    input: {
      provider: "openai",
      model: "gpt-5.4",
      frame,
      stateSummary: { compact: true },
    },
    priority: "normal",
  };
}

const lease: CapabilityLease = {
  leaseId: "lease-1",
  capabilityId: "cap-model-infer",
  bindingId: "binding-1",
  generation: 1,
  grantedAt: "2026-03-18T00:00:00.000Z",
  priority: "normal",
};

test("model inference adapter supports and prepares a direct invocation", async () => {
  const adapter = createModelInferenceCapabilityAdapter({
    executor: async ({ intent }: { intent: ModelInferenceIntent }) => ({
      provider: "openai",
      model: "gpt-5.4",
      layer: "api",
      raw: { text: "42" },
      result: {
        resultId: "result-1",
        sessionId: intent.sessionId,
        runId: intent.runId,
        source: "model",
        status: "success",
        output: { text: "42" },
        emittedAt: "2026-03-18T00:00:01.000Z",
      },
    }),
  });

  const plan = createPlan();
  assert.equal(adapter.supports(plan), true);

  const prepared = await adapter.prepare(plan, lease);
  assert.equal(prepared.executionMode, "direct");
  assert.equal(prepared.cacheKey, "goal-cache-key");
});

test("model inference adapter executes through the injected executor", async () => {
  const adapter = createModelInferenceCapabilityAdapter({
    executor: async ({ intent }: { intent: ModelInferenceIntent }) => ({
      provider: "openai",
      model: "gpt-5.4",
      layer: "api",
      raw: { text: "42" },
      result: {
        resultId: "result-1",
        sessionId: intent.sessionId,
        runId: intent.runId,
        source: "model",
        status: "success",
        output: { text: "42" },
        emittedAt: "2026-03-18T00:00:01.000Z",
      },
    }),
  });

  const prepared = await adapter.prepare(createPlan(), lease);
  const envelope = await adapter.execute(prepared);

  assert.equal(envelope.status, "success");
  assert.deepEqual(envelope.output, { text: "42" });
});
