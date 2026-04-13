import assert from "node:assert/strict";
import test from "node:test";

import { compileGoal, renderGoalPromptBlocksInstructionText } from "./goal-compiler.js";
import { normalizeGoal } from "./goal-normalizer.js";
import { createGoalSource } from "./goal-source.js";

test("compileGoal emits promptBlocks alongside the legacy instructionText view", () => {
  const normalized = normalizeGoal(
    createGoalSource({
      goalId: "goal-prompt-blocks-1",
      userInput: "Unify the kernel prompt entry",
      constraints: [{ key: "scope", value: "kernel" }],
      inputRefs: ["memory://task-pack-i"],
    }),
    {
      successCriteria: [
        { id: "compat", description: "instruction text stays compatible", required: true },
      ],
    },
  );

  const compiled = compileGoal(normalized, {
    staticInstructions: ["Do not touch live-agent-chat.ts"],
    contextSummary: "Task Pack I kernel entry only.",
  });

  assert.ok(compiled.promptBlocks);
  assert.deepEqual(
    compiled.promptBlocks?.map((block) => block.key),
    ["task", "success_criteria", "failure_criteria", "constraints", "input_refs", "static_instructions", "context_summary"],
  );
  assert.equal(
    compiled.instructionText,
    renderGoalPromptBlocksInstructionText(compiled.promptBlocks ?? []),
  );
  assert.match(compiled.instructionText, /Do not touch live-agent-chat\.ts/);
});

test("compileGoal preserves promptBlocks supplied through metadata", () => {
  const normalized = normalizeGoal(
    createGoalSource({
      goalId: "goal-prompt-blocks-2",
      userInput: "Fallback text should not win when prompt blocks are present",
      metadata: {
        promptBlocks: [
          {
            key: "core_system",
            title: "core_system",
            lines: ["You are Praxis Core."],
          },
          {
            key: "core_contextual_user",
            title: "core_contextual_user",
            lines: ["<core_contextual_user>", "  <current_objective>", "    continue", "  </current_objective>", "</core_contextual_user>"],
          },
        ],
      },
    }),
  );

  const compiled = compileGoal(normalized);

  assert.deepEqual(
    compiled.promptBlocks?.map((block) => block.key),
    ["core_system", "core_contextual_user"],
  );
  assert.match(compiled.instructionText, /You are Praxis Core\./);
  assert.doesNotMatch(compiled.instructionText, /Task\nFallback text should not win/);
});
