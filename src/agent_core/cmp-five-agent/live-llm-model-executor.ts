import { randomUUID } from "node:crypto";

import type { ProviderId, SdkLayer } from "../../rax/index.js";
import { loadResolvedRoleConfig } from "../../raxcode-config.js";
import { loadOpenAILiveConfig, resolveProviderGenerationVariant, resolveOpenAIGenerationVariant } from "../../rax/live-config.js";
import {
  executeModelInference,
  type ModelInferenceExecutionResult,
} from "../integrations/model-inference.js";
import {
  resolveProviderRouteKind,
  sanitizeProviderRouteFeatureOptions,
} from "../integrations/model-route-features.js";
import type { GoalFrameCompiled, ModelInferenceIntent } from "../types/index.js";
import type { CmpRoleLiveLlmExecutor } from "./types.js";

export interface CreateCmpRoleLiveLlmModelExecutorInput {
  provider?: ProviderId;
  model?: string;
  layer?: Exclude<SdkLayer, "auto">;
  variant?: string;
  roleId?: Parameters<typeof loadResolvedRoleConfig>[0];
  reasoningEffort?: string;
  serviceTier?: "fast";
  maxOutputTokens?: number;
  executor?: (params: { intent: ModelInferenceIntent }) => Promise<ModelInferenceExecutionResult>;
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
    throw new Error("CMP role live executor did not contain a JSON object.");
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

  throw new Error("CMP role live executor contained an unterminated JSON object.");
}

function isNonEmptyValue(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }
  return value !== undefined && value !== null;
}

function isProviderEnvelope(value: Record<string, unknown>): boolean {
  return typeof value.object === "string"
    && ("usage" in value || "output" in value || "choices" in value);
}

function validateStructuredOutput(
  value: Record<string, unknown>,
  expectedFields: string[],
): Record<string, unknown> {
  if (isProviderEnvelope(value)) {
    throw new Error("CMP role live executor received a provider response envelope instead of structured output.");
  }

  if (expectedFields.length === 0) {
    return value;
  }

  if (!expectedFields.some((field) => isNonEmptyValue(value[field]))) {
    throw new Error(
      `CMP role live executor did not return any expected structured fields: ${expectedFields.join(", ")}`,
    );
  }

  return value;
}

function buildInstruction(request: Parameters<CmpRoleLiveLlmExecutor>[0]): string {
  return [
    request.prompt.systemPrompt,
    `Mission: ${request.prompt.mission}`,
    "",
    "Return strict JSON only.",
    "Return exactly one JSON object with double-quoted keys and no leading or trailing prose.",
    "Do not wrap the answer in markdown fences.",
    typeof request.metadata?.promptText === "string"
      ? request.metadata.promptText
      : JSON.stringify(request.metadata ?? {}, null, 2),
  ].join("\n");
}

export function createCmpRoleLiveLlmModelExecutor(
  input: CreateCmpRoleLiveLlmModelExecutorInput = {},
): CmpRoleLiveLlmExecutor {
  const roleId = input.roleId;
  const resolvedRole = roleId ? loadResolvedRoleConfig(roleId) : null;
  const provider = input.provider ?? resolvedRole?.profile.provider ?? "openai";
  const model = input.model ?? "gpt-5.4";
  const layer = input.layer ?? "api";
  const variant = input.variant
    ?? (resolvedRole
      ? resolveProviderGenerationVariant({
          provider: resolvedRole.profile.provider,
          baseURL: resolvedRole.profile.route.baseURL,
          apiStyle: resolvedRole.profile.route.apiStyle,
        })
      : provider === "openai"
        ? resolveOpenAIGenerationVariant(loadOpenAILiveConfig("core.main"))
        : provider === "anthropic"
          ? "messages"
          : "generateContent");
  const routeKind = resolvedRole
    ? resolveProviderRouteKind({
      provider: resolvedRole.profile.provider,
      baseURL: resolvedRole.profile.route.baseURL,
      apiStyle: resolvedRole.profile.route.apiStyle,
      variant,
    })
    : "openai_responses";
  const sanitized = sanitizeProviderRouteFeatureOptions(routeKind, {
    reasoningEffort: input.reasoningEffort,
    serviceTier: input.serviceTier,
  });
  const reasoningEffort = sanitized.reasoningEffort;
  const serviceTier = sanitized.serviceTier;
  const maxOutputTokens = input.maxOutputTokens;
  const executor = input.executor ?? ((params: { intent: ModelInferenceIntent }) => executeModelInference(params));

  return async function runCmpRoleLiveLlm(request) {
    const expectedFields = Array.isArray(request.metadata?.schemaFields)
      ? request.metadata.schemaFields.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : request.prompt.outputContract;
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
        roleId,
        cmpRole: request.role,
        cmpLiveMode: request.mode,
        reasoningEffort,
        serviceTier,
        maxOutputTokens,
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
      const parsed = JSON.parse(extractFirstJsonObject(text));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("CMP role live executor expected a JSON object.");
      }
      output = validateStructuredOutput(parsed as Record<string, unknown>, expectedFields);
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
