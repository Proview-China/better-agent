import { randomUUID } from "node:crypto";

import type { ModelInferenceExecutionResult } from "./model-inference.js";
import type { GoalFrameCompiled, ModelInferenceIntent } from "../types/index.js";
import type { RaxcodeRoleId } from "../../raxcode-config.js";

export interface TapAgentModelRoute {
  provider: string;
  model: string;
  layer?: string;
  variant?: string;
  roleId?: RaxcodeRoleId;
  reasoningEffort?: string;
  serviceTier?: "fast";
  maxOutputTokens?: number;
}

export interface ExecuteTapAgentStructuredOutputInput<TOutput> {
  executor: (params: { intent: ModelInferenceIntent }) => Promise<ModelInferenceExecutionResult>;
  sessionId: string;
  runId: string;
  workerKind: string;
  systemPrompt: string;
  userPrompt: string;
  route?: Partial<TapAgentModelRoute>;
  parse?: (jsonValue: unknown) => TOutput;
}

export const DEFAULT_TAP_AGENT_MODEL_ROUTE: TapAgentModelRoute = {
  provider: "openai",
  model: "gpt-5.4",
  layer: "api",
  variant: "responses",
};

function buildGoalFrame(params: {
  workerKind: string;
  systemPrompt: string;
  userPrompt: string;
  route: TapAgentModelRoute;
}): GoalFrameCompiled {
  const instructionText = [
    params.systemPrompt.trim(),
    "",
    params.userPrompt.trim(),
  ].join("\n");

  return {
    goalId: `${params.workerKind}:${randomUUID()}`,
    instructionText,
    successCriteria: [],
    failureCriteria: [],
    constraints: [],
    inputRefs: [],
    cacheKey: `${params.workerKind}:${params.route.provider}:${params.route.model}:${instructionText}`,
    metadata: {
      provider: params.route.provider,
      model: params.route.model,
      layer: params.route.layer ?? DEFAULT_TAP_AGENT_MODEL_ROUTE.layer,
      variant: params.route.variant ?? DEFAULT_TAP_AGENT_MODEL_ROUTE.variant,
      roleId: params.route.roleId,
      reasoningEffort: params.route.reasoningEffort,
      serviceTier: params.route.serviceTier,
      maxOutputTokens: params.route.maxOutputTokens,
      tapWorkerKind: params.workerKind,
      tapWorkerModel: true,
    },
  };
}

function readOutputText(result: ModelInferenceExecutionResult): string {
  const output = result.result.output;
  if (!output || typeof output !== "object") {
    throw new Error("Tap agent model result did not include an object output.");
  }
  const text = (output as { text?: unknown }).text;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Tap agent model result did not include text output.");
  }
  return text;
}

function extractFirstJsonObject(source: string): string {
  const fenceMatch = source.match(/```json\s*([\s\S]*?)```/iu) ?? source.match(/```\s*([\s\S]*?)```/iu);
  if (fenceMatch?.[1]) {
    return extractFirstJsonObject(fenceMatch[1]);
  }

  const trimmed = source.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const start = source.indexOf("{");
  if (start === -1) {
    throw new Error("Tap agent model output did not contain a JSON object.");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  throw new Error("Tap agent model output contained an unterminated JSON object.");
}

export function parseTapAgentStructuredText<TOutput>(
  text: string,
  parse?: (jsonValue: unknown) => TOutput,
): TOutput {
  const jsonText = extractFirstJsonObject(text);
  const jsonValue = JSON.parse(jsonText) as unknown;
  return parse ? parse(jsonValue) : jsonValue as TOutput;
}

export async function executeTapAgentStructuredOutput<TOutput>(
  input: ExecuteTapAgentStructuredOutputInput<TOutput>,
): Promise<TOutput> {
  const route: TapAgentModelRoute = {
    ...DEFAULT_TAP_AGENT_MODEL_ROUTE,
    ...(input.route ?? {}),
  };
  const frame = buildGoalFrame({
    workerKind: input.workerKind,
    systemPrompt: input.systemPrompt,
    userPrompt: input.userPrompt,
    route,
  });
  const intent: ModelInferenceIntent = {
    intentId: `${input.workerKind}:${randomUUID()}`,
    sessionId: input.sessionId,
    runId: input.runId,
    kind: "model_inference",
    createdAt: new Date().toISOString(),
    priority: "normal",
    correlationId: `${input.workerKind}:${randomUUID()}`,
    frame,
    metadata: {
      provider: route.provider,
      model: route.model,
      layer: route.layer ?? DEFAULT_TAP_AGENT_MODEL_ROUTE.layer,
      variant: route.variant ?? DEFAULT_TAP_AGENT_MODEL_ROUTE.variant,
      tapWorkerKind: input.workerKind,
    },
  };

  const result = await input.executor({ intent });
  return parseTapAgentStructuredText(readOutputText(result), input.parse);
}
