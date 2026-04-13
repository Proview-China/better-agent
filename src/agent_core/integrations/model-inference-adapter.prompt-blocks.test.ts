import assert from "node:assert/strict";
import test from "node:test";

import type { CapabilityInvocationPlan, CapabilityLease, ModelInferenceIntent } from "../index.js";
import {
  createModelInferenceCapabilityAdapter,
  MODEL_INFERENCE_CAPABILITY_KEY,
} from "./model-inference-adapter.js";

function createPromptBlocksOnlyPlan(): CapabilityInvocationPlan {
  return {
    planId: "plan-prompt-blocks-1",
    intentId: "intent-prompt-blocks-1",
    sessionId: "session-prompt-blocks-1",
    runId: "run-prompt-blocks-1",
    capabilityKey: MODEL_INFERENCE_CAPABILITY_KEY,
    operation: "infer",
    input: {
      provider: "openai",
      model: "gpt-5.4",
      frame: {
        goalId: "goal-prompt-blocks-1",
        promptBlocks: [
          { key: "task", title: "Task", lines: ["Answer briefly."] },
          { key: "constraints", title: "Constraints", lines: ["- Keep compatibility."] },
        ],
        successCriteria: [],
        failureCriteria: [],
        constraints: [],
        inputRefs: [],
        cacheKey: "goal-prompt-blocks-cache",
      },
    },
    priority: "normal",
  };
}

const lease: CapabilityLease = {
  leaseId: "lease-prompt-blocks-1",
  capabilityId: "cap-model-infer",
  bindingId: "binding-prompt-blocks-1",
  generation: 1,
  grantedAt: "2026-04-13T00:00:00.000Z",
  priority: "normal",
};

test("model inference adapter accepts promptBlocks-only frames and synthesizes instructionText", async () => {
  let capturedIntent: ModelInferenceIntent | undefined;
  const adapter = createModelInferenceCapabilityAdapter({
    executor: async ({ intent }: { intent: ModelInferenceIntent }) => {
      capturedIntent = intent;
      return {
        provider: "openai",
        model: "gpt-5.4",
        layer: "api",
        raw: { text: "ok" },
        result: {
          resultId: "result-prompt-blocks-1",
          sessionId: intent.sessionId,
          runId: intent.runId,
          source: "model",
          status: "success",
          output: { text: "ok" },
          emittedAt: "2026-04-13T00:00:01.000Z",
        },
      };
    },
  });

  const plan = createPromptBlocksOnlyPlan();
  assert.equal(adapter.supports(plan), true);

  const prepared = await adapter.prepare(plan, lease);
  const envelope = await adapter.execute(prepared);

  assert.equal(envelope.status, "success");
  assert.equal(
    capturedIntent?.frame.instructionText,
    "Task\nAnswer briefly.\nConstraints\n- Keep compatibility.",
  );
  assert.deepEqual(capturedIntent?.frame.promptBlocks, [
    { key: "task", title: "Task", lines: ["Answer briefly."], metadata: undefined },
    { key: "constraints", title: "Constraints", lines: ["- Keep compatibility."], metadata: undefined },
  ]);
});
