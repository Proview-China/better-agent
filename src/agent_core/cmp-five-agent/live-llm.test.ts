import assert from "node:assert/strict";
import test from "node:test";

import { getCmpFiveAgentRoleDefinition } from "./configuration.js";
import {
  createCmpRoleLiveLlmPrompt,
  executeCmpRoleLiveLlm,
} from "./live-llm.js";

test("createCmpRoleLiveLlmPrompt composes role config into a stable prompt envelope", () => {
  const configuration = getCmpFiveAgentRoleDefinition("icma");
  const prompt = createCmpRoleLiveLlmPrompt({
    configuration,
    task: "shape ingress context",
    payload: {
      taskSummary: "整理当前上下文",
    },
  });

  assert.match(prompt.system, /CMP role icma/);
  assert.match(prompt.system, /Return only structured output/i);
  assert.match(prompt.user, /shape ingress context/);
  assert.match(prompt.user, /taskSummary/);
});

test("executeCmpRoleLiveLlm returns fallback in rules_only mode", async () => {
  const result = await executeCmpRoleLiveLlm({
    role: "checker",
    request: {
      role: "checker",
      mode: "rules_only",
      prompt: {
        system: "system",
        user: "user",
      },
      fallbackOutput: {
        trimSummary: "fallback",
      },
    },
  });

  assert.equal(result.output.trimSummary, "fallback");
  assert.equal(result.trace.status, "rules_only");
});

test("executeCmpRoleLiveLlm falls back in llm_assisted mode and throws in llm_required mode", async () => {
  const fallback = await executeCmpRoleLiveLlm({
    role: "dbagent",
    mode: "llm_assisted",
    request: {
      role: "dbagent",
      mode: "llm_assisted",
      prompt: {
        system: "system",
        user: "user",
      },
      fallbackOutput: {
        packageTopology: "fallback",
      },
    },
    executor: async () => {
      throw new Error("gateway timeout");
    },
  });

  assert.equal(fallback.output.packageTopology, "fallback");
  assert.equal(fallback.trace.status, "fallback_rules");
  assert.equal(fallback.trace.fallbackApplied, true);

  await assert.rejects(
    () => executeCmpRoleLiveLlm({
      role: "dbagent",
      mode: "llm_required",
      request: {
        role: "dbagent",
        mode: "llm_required",
        prompt: {
          system: "system",
          user: "user",
        },
        fallbackOutput: {
          packageTopology: "fallback",
        },
      },
      executor: async () => {
        throw new Error("hard fail");
      },
    }),
    /hard fail/,
  );
});
