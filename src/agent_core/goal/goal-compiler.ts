import type { GoalFrameCompiled, GoalFrameNormalized, GoalPromptBlock } from "../types/kernel-goal.js";
import { buildGoalCompiledCacheKey } from "./goal-cache-key.js";
import type { GoalCompileContext } from "./goal-types.js";

function createPromptBlock(
  key: string,
  title: string,
  lines: string[]
): GoalPromptBlock[] {
  if (lines.length === 0) {
    return [];
  }

  return [{ key, title, lines }];
}

export function renderGoalPromptBlocksInstructionText(promptBlocks: GoalPromptBlock[]): string {
  return promptBlocks
    .flatMap((block) => {
      const renderedLines = block.lines.filter((line) => line.length > 0);
      if (renderedLines.length === 0) {
        return [];
      }
      return block.title ? [block.title, ...renderedLines] : renderedLines;
    })
    .join("\n");
}

function readPromptBlocksMetadata(value: unknown): GoalPromptBlock[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const blocks = value
    .filter((block): block is GoalPromptBlock =>
      !!block
      && typeof block === "object"
      && typeof (block as GoalPromptBlock).key === "string"
      && (!("title" in (block as GoalPromptBlock))
        || typeof (block as GoalPromptBlock).title === "string"
        || typeof (block as GoalPromptBlock).title === "undefined")
      && Array.isArray((block as GoalPromptBlock).lines)
      && (block as GoalPromptBlock).lines.every((line) => typeof line === "string"),
    )
    .map((block) => ({
      ...block,
      lines: [...block.lines],
      metadata:
        block.metadata && typeof block.metadata === "object" && !Array.isArray(block.metadata)
          ? { ...block.metadata }
          : undefined,
    }));
  return blocks.length > 0 ? blocks : undefined;
}

export function compileGoal(
  normalized: GoalFrameNormalized,
  context: GoalCompileContext = {}
): GoalFrameCompiled {
  const defaultPromptBlocks = [
    ...createPromptBlock("task", "Task", [normalized.taskStatement]),
    ...createPromptBlock(
      "success_criteria",
      "Success Criteria",
      normalized.successCriteria.map((criterion) => `- ${criterion.description}`)
    ),
    ...createPromptBlock(
      "failure_criteria",
      "Failure Criteria",
      normalized.failureCriteria.map((criterion) => `- ${criterion.description}`)
    ),
    ...createPromptBlock(
      "constraints",
      "Constraints",
      normalized.constraints.map((constraint) => {
        const description = constraint.description
          ? ` (${constraint.description})`
          : "";
        return `- ${constraint.key}=${JSON.stringify(constraint.value)}${description}`;
      })
    ),
    ...createPromptBlock(
      "input_refs",
      "Input Refs",
      normalized.inputRefs.map((ref) => `- ${ref}`)
    ),
    ...createPromptBlock(
      "static_instructions",
      "Static Instructions",
      (context.staticInstructions ?? []).map((instruction) => `- ${instruction}`)
    ),
    ...createPromptBlock(
      "capability_hints",
      "Capability Hints",
      (context.capabilityHints ?? []).map((hint) =>
        hint.description ? `- ${hint.key}: ${hint.description}` : `- ${hint.key}`
      )
    ),
    ...createPromptBlock(
      "context_summary",
      "Context Summary",
      context.contextSummary ? [context.contextSummary] : []
    )
  ];
  const promptBlocks = readPromptBlocksMetadata(normalized.metadata?.promptBlocks)
    ?? defaultPromptBlocks;

  const cacheKey = buildGoalCompiledCacheKey(normalized, context);

  return {
    goalId: normalized.goalId,
    instructionText: renderGoalPromptBlocksInstructionText(promptBlocks),
    promptBlocks: promptBlocks.map((block) => ({
      ...block,
      lines: [...block.lines],
      metadata: block.metadata ? { ...block.metadata } : undefined
    })),
    successCriteria: normalized.successCriteria.map((criterion) => ({ ...criterion })),
    failureCriteria: normalized.failureCriteria.map((criterion) => ({ ...criterion })),
    constraints: normalized.constraints.map((constraint) => ({ ...constraint })),
    inputRefs: [...normalized.inputRefs],
    cacheKey,
    metadata:
      normalized.metadata || context.metadata
        ? {
            ...(normalized.metadata ?? {}),
            ...(context.metadata ?? {})
          }
        : undefined
  };
}
