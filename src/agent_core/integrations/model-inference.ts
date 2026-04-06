import OpenAI from "openai";

import type { OpenAIInvocationPayload } from "../../integrations/openai/api/index.js";
import { loadOpenAILiveConfig } from "../../rax/live-config.js";
import type { ProviderId, SdkLayer } from "../../rax/index.js";
import { rax } from "../../rax/index.js";
import type { ModelInferenceIntent, KernelResult } from "../types/index.js";
import type { RaxFacade as FullRaxFacade } from "../../rax/facade.js";

type GenerateFacade = Pick<FullRaxFacade, "generate">;

export interface ModelInferenceExecutionParams {
  intent: ModelInferenceIntent;
  facade?: GenerateFacade;
}

export interface ModelInferenceExecutionResult {
  result: KernelResult;
  provider: ProviderId;
  model: string;
  layer: Exclude<SdkLayer, "auto">;
  raw: unknown;
}

type OpenAIModelInvocation = {
  payload: OpenAIInvocationPayload<Record<string, unknown>>;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function readRetryAfterMs(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const headers = "headers" in error ? (error as { headers?: unknown }).headers : undefined;
  if (!headers || typeof headers !== "object") {
    return undefined;
  }

  const retryAfter = "retry-after" in headers
    ? (headers as Record<string, unknown>)["retry-after"]
    : "Retry-After" in headers
      ? (headers as Record<string, unknown>)["Retry-After"]
      : undefined;

  if (typeof retryAfter === "number" && Number.isFinite(retryAfter)) {
    return Math.max(0, retryAfter * 1000);
  }

  if (typeof retryAfter === "string") {
    const seconds = Number.parseFloat(retryAfter);
    if (Number.isFinite(seconds)) {
      return Math.max(0, seconds * 1000);
    }
  }

  return undefined;
}

function readStringMetadata(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

function parseOpenAITextResponse(raw: unknown): string {
  if (typeof raw === "string") {
    try {
      return parseOpenAITextResponse(JSON.parse(raw));
    } catch {
      return raw;
    }
  }

  if (raw && typeof raw === "object" && "output_text" in raw && typeof (raw as { output_text?: unknown }).output_text === "string") {
    return (raw as { output_text: string }).output_text;
  }

  if (
    raw &&
    typeof raw === "object" &&
    "choices" in raw &&
    Array.isArray((raw as { choices?: unknown[] }).choices)
  ) {
    const firstChoice = (raw as {
      choices: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
    }).choices[0];
    const content = firstChoice?.message?.content;
    if (typeof content === "string") {
      return content;
    }
    if (Array.isArray(content)) {
      const textPart = content.find((item) => item?.type === "text" && typeof item.text === "string");
      if (textPart?.text) {
        return textPart.text;
      }
    }
  }

  return JSON.stringify(raw);
}

export function omitResponsesMetadataForGatewayRetry<T extends Record<string, unknown>>(params: T): T {
  if (!("metadata" in params)) {
    return params;
  }

  const cloned = {
    ...params,
  };
  delete cloned.metadata;
  return cloned as T;
}

export function shouldRetryOpenAIResponsesWithoutMetadata(input: {
  invocation: OpenAIModelInvocation;
  error: unknown;
}): boolean {
  if (input.invocation.payload.surface !== "responses") {
    return false;
  }

  if (input.invocation.payload.params.metadata === undefined) {
    return false;
  }

  if (!input.error || typeof input.error !== "object") {
    return false;
  }

  const status = "status" in input.error ? input.error.status : undefined;
  return status === 502 || status === 403;
}

export function shouldRetryOpenAIResponsesOnRateLimit(input: {
  invocation: OpenAIModelInvocation;
  error: unknown;
}): boolean {
  if (input.invocation.payload.surface !== "responses") {
    return false;
  }

  if (!input.error || typeof input.error !== "object") {
    return false;
  }

  const status = "status" in input.error ? input.error.status : undefined;
  return status === 429;
}

export function shouldRetryOpenAIResponsesOnTransientGateway(input: {
  invocation: OpenAIModelInvocation;
  error: unknown;
}): boolean {
  if (input.invocation.payload.surface !== "responses") {
    return false;
  }

  if (!input.error || typeof input.error !== "object") {
    return false;
  }

  const status = "status" in input.error ? input.error.status : undefined;
  return status === 503;
}

async function executeOpenAIInvocation(
  invocation: OpenAIModelInvocation,
): Promise<unknown> {
  const config = loadOpenAILiveConfig();
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  switch (invocation.payload.surface) {
    case "responses":
      {
        let params = invocation.payload.params;
        let metadataStripped = false;
        for (let attempt = 0; attempt < 5; attempt += 1) {
          try {
            return await client.responses.create(params as never);
          } catch (error) {
            if (
              !metadataStripped
              && shouldRetryOpenAIResponsesWithoutMetadata({
                invocation: {
                  payload: {
                    ...invocation.payload,
                    params,
                  },
                },
                error,
              })
            ) {
              params = omitResponsesMetadataForGatewayRetry(params);
              metadataStripped = true;
              continue;
            }

            if (attempt < 4) {
              const retryInvocation = {
                payload: {
                  ...invocation.payload,
                  params,
                },
              };

              if (
                shouldRetryOpenAIResponsesOnRateLimit({
                  invocation: retryInvocation,
                  error,
                })
                || shouldRetryOpenAIResponsesOnTransientGateway({
                  invocation: retryInvocation,
                  error,
                })
              ) {
                await sleep(readRetryAfterMs(error) ?? 2500 * (attempt + 1));
                continue;
              }
            }

            throw error;
          }
        }
        throw new Error("OpenAI responses invocation exhausted retry policy unexpectedly.");
      }
    case "chat_completions":
      return client.chat.completions.create(invocation.payload.params as never);
    default:
      throw new Error(`Unsupported OpenAI generation surface for model inference: ${invocation.payload.surface}`);
  }
}

export async function executeModelInference(
  params: ModelInferenceExecutionParams,
): Promise<ModelInferenceExecutionResult> {
  const facade = params.facade ?? (rax as unknown as GenerateFacade);
  const metadata = params.intent.frame.metadata;
  const provider = (readStringMetadata(metadata, "provider") as ProviderId | undefined) ?? "openai";
  const model = readStringMetadata(metadata, "model") ?? loadOpenAILiveConfig().model;
  const layer = (readStringMetadata(metadata, "layer") as SdkLayer | undefined) ?? "api";
  const variant = readStringMetadata(metadata, "variant") ?? "chat_completions_compat";
  const compatibilityProfileId = readStringMetadata(metadata, "compatibilityProfileId");

  if (provider !== "openai") {
    throw new Error(`Model inference integration currently only supports provider ${"openai"}, received ${provider}.`);
  }

  const config = loadOpenAILiveConfig();
  const invocation = facade.generate.create({
    provider,
    model,
    layer,
    variant,
    compatibilityProfileId,
    input:
      variant === "chat_completions_compat"
        ? {
            model,
            messages: [{ role: "user", content: params.intent.frame.instructionText }],
            metadata: params.intent.frame.metadata,
            reasoningEffort: config.reasoningEffort as "low" | "medium" | "high" | undefined,
          }
        : {
            input: params.intent.frame.instructionText,
            metadata: params.intent.frame.metadata,
          },
  }) as {
    provider: ProviderId;
    model: string;
    layer: Exclude<SdkLayer, "auto">;
    payload: OpenAIInvocationPayload<Record<string, unknown>>;
  };

  const raw = await executeOpenAIInvocation(invocation);
  const text = parseOpenAITextResponse(raw);

  return {
    provider: invocation.provider,
    model: invocation.model,
    layer: invocation.layer,
    raw,
    result: {
      resultId: params.intent.intentId,
      sessionId: params.intent.sessionId,
      runId: params.intent.runId,
      source: "model",
      status: "success",
      output: {
        text,
        raw,
      },
      evidence: [],
      emittedAt: new Date().toISOString(),
      correlationId: params.intent.correlationId,
      metadata: {
        provider: invocation.provider,
        model: invocation.model,
        layer: invocation.layer,
        variant: invocation.payload.surface,
      },
    },
  };
}
