import { randomUUID } from "node:crypto";

import type { ProviderId, SdkLayer } from "../../rax/index.js";
import {
  executeModelInference,
  type ModelInferenceExecutionResult,
} from "../integrations/model-inference.js";
import type { GoalFrameCompiled, ModelInferenceIntent } from "../types/index.js";
import type { CmpRoleLiveLlmExecutor } from "./types.js";

export interface CreateCmpRoleLiveLlmModelExecutorInput {
  provider?: ProviderId;
  model?: string;
  layer?: Exclude<SdkLayer, "auto">;
  variant?: string;
  executor?: (params: { intent: ModelInferenceIntent }) => Promise<ModelInferenceExecutionResult>;
}

function buildInstruction(request: Parameters<CmpRoleLiveLlmExecutor>[0]): string {
  return [
    request.prompt.systemPrompt,
    `Mission: ${request.prompt.mission}`,
    "",
    "Return strict JSON only. Do not wrap the answer in markdown fences.",
    typeof request.metadata?.promptText === "string"
      ? request.metadata.promptText
      : JSON.stringify(request.metadata ?? {}, null, 2),
  ].join("\n");
}

export function createCmpRoleLiveLlmModelExecutor(
  input: CreateCmpRoleLiveLlmModelExecutorInput = {},
): CmpRoleLiveLlmExecutor {
  const provider = input.provider ?? "openai";
  const model = input.model ?? "gpt-5.4";
  const layer = input.layer ?? "api";
  const variant = input.variant ?? "responses";
  const executor = input.executor ?? ((params: { intent: ModelInferenceIntent }) => executeModelInference(params));

  return async function runCmpRoleLiveLlm(request) {
    const frame: GoalFrameCompiled = {
      goalId: `cmp-live-llm:${request.role}:goal`,
      instructionText: buildInstruction(request),
      successCriteria: [],
      failureCriteria: [],
      constraints: [],
      inputRefs: [],
      cacheKey: `cmp-live-llm:${request.role}:${randomUUID()}`,
      metadata: {
        provider,
        model,
        layer,
        variant,
        cmpRole: request.role,
        cmpLiveMode: request.mode,
        ...(request.metadata ?? {}),
      },
    };

    const intent: ModelInferenceIntent = {
      intentId: `cmp-live-llm:${request.role}:${randomUUID()}`,
      sessionId: `cmp-live-llm:${request.role}:session`,
      runId: `cmp-live-llm:${request.role}:run`,
      kind: "model_inference",
      createdAt: new Date().toISOString(),
      priority: "normal",
      frame,
    };

    const result = await executor({
      intent,
    });
    const text = (result.result.output as { text?: string }).text ?? "";
    let output: Record<string, unknown>;
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("CMP role live executor expected a JSON object.");
      }
      output = parsed as Record<string, unknown>;
    } catch (error) {
      throw new Error(
        `CMP ${request.role} live LLM executor returned non-JSON output: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return {
      output,
      raw: result.raw,
      provider: result.provider,
      model: result.model,
      requestId: intent.intentId,
      metadata: {
        provider: result.provider,
        model: result.model,
        layer: result.layer,
      },
    };
  };
}
