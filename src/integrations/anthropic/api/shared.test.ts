import assert from "node:assert/strict";
import test from "node:test";

import {
  mapAnthropicReasoningEffortToThinking,
} from "./shared.js";
import {
  anthropicGenerateCreateDescriptor,
} from "./generation/messages/descriptor.js";

test("mapAnthropicReasoningEffortToThinking maps supported effort levels onto thinking budgets", () => {
  assert.deepEqual(mapAnthropicReasoningEffortToThinking("low"), {
    type: "enabled",
    budget_tokens: 1024,
  });
  assert.deepEqual(mapAnthropicReasoningEffortToThinking("medium"), {
    type: "enabled",
    budget_tokens: 4096,
  });
  assert.deepEqual(mapAnthropicReasoningEffortToThinking("high"), {
    type: "enabled",
    budget_tokens: 8192,
  });
  assert.deepEqual(mapAnthropicReasoningEffortToThinking("max"), {
    type: "enabled",
    budget_tokens: 16384,
  });
  assert.deepEqual(mapAnthropicReasoningEffortToThinking("xhigh"), {
    type: "enabled",
    budget_tokens: 16384,
  });
  assert.equal(mapAnthropicReasoningEffortToThinking("none"), undefined);
});

test("anthropic messages descriptor forwards thinking into the Messages payload", () => {
  const invocation = anthropicGenerateCreateDescriptor.prepare({
    provider: "anthropic",
    model: "claude-opus-4-6",
    layer: "api",
    capability: "generate",
    action: "create",
    input: {
      maxTokens: 128,
      messages: [{ role: "user", content: "Reply with OK only." }],
      thinking: {
        type: "enabled",
        budget_tokens: 4096,
      },
    },
  });

  assert.deepEqual(invocation.payload.thinking, {
    type: "enabled",
    budget_tokens: 4096,
  });
});
